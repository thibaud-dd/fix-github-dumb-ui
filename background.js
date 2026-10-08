const GRAPHQL_URL = 'https://api.github.com/graphql';
const TOKEN_KEY = 'githubToken';
const CACHE_TTL_MS = 30_000;
const STACK_COMMENT = /This stack of pull requests is managed by[\s\S]*graphite\.dev/;
const STACK_PR_LINE = /^\* \*\*#(\d+)\*\*/;
const STACK_BASE_LINE = /^\* `([^`]+)`/;

const COMMENTS_QUERY = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        comments(first: 100) {
          nodes {
            body
          }
        }
      }
    }
  }
`;

// Only review threads can be resolved. The API has no isResolved filter, so count on the client.
const THREAD_FIELDS = `
  reviewThreads(first: 100) {
    nodes {
      isResolved
      comments(first: 1) {
        nodes {
          author {
            login
            avatarUrl(size: 40)
            ... on User {
              name
            }
          }
        }
      }
    }
  }
`;

const stackCache = new Map();
const threadsCache = new Map();

class AuthError extends Error {}

async function graphql(token, query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 401) {
    throw new AuthError('GitHub rejected the token.');
  }
  const json = await response.json();
  if (json.errors?.length) {
    const [error] = json.errors;
    // SAML-protected orgs answer with FORBIDDEN until the token is authorized for SSO.
    if (error.type === 'FORBIDDEN') {
      throw new AuthError(error.message);
    }
    // Private repos the token cannot read look like missing repos.
    if (error.type === 'NOT_FOUND') {
      const sso = response.headers.get('x-github-sso');
      const scopes = response.headers.get('x-oauth-scopes');
      const hint = sso
        ? `Authorize the token for SSO: ${sso.replace(/^.*url=/, '')}`
        : `The token needs the repo scope or access to this repo (token scopes: ${scopes || 'none, or a fine-grained token'}).`;
      throw new AuthError(`${error.message} ${hint}`);
    }
    throw new Error(error.message);
  }
  return json.data;
}

// Graphite lists the stack from the top PR down, then the base branch.
function parseStackComment(body) {
  const numbers = [];
  let base = null;
  for (const line of body.split('\n')) {
    const prMatch = STACK_PR_LINE.exec(line);
    if (prMatch) {
      numbers.push(Number(prMatch[1]));
      continue;
    }
    const baseMatch = STACK_BASE_LINE.exec(line);
    if (baseMatch) {
      base = baseMatch[1];
    }
  }
  return { numbers, base };
}

// Authors are the thread starters, most threads first.
function summarizeThreads(pr) {
  const unresolved = pr.reviewThreads.nodes.filter(({ isResolved }) => !isResolved);
  const authors = new Map();
  for (const thread of unresolved) {
    const author = thread.comments.nodes[0]?.author;
    if (author) {
      const entry = authors.get(author.login) ?? { ...author, count: 0 };
      entry.count += 1;
      authors.set(author.login, entry);
    }
  }
  return { count: unresolved.length, authors: [...authors.values()].sort((a, b) => b.count - a.count) };
}

async function fetchStack(token, owner, repo, number) {
  const data = await graphql(token, COMMENTS_QUERY, { owner, repo, number });
  const comment = data.repository?.pullRequest?.comments.nodes.find(({ body }) => STACK_COMMENT.test(body));
  if (!comment) {
    return null;
  }

  const { numbers, base } = parseStackComment(comment.body);
  if (numbers.length < 2) {
    return null;
  }

  const fields = numbers
    .map((n) => `pr${n}: pullRequest(number: ${n}) { number title state isDraft ${THREAD_FIELDS} }`)
    .join('\n');
  const prData = await graphql(
    token,
    `query ($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`,
    { owner, repo },
  );
  const prs = numbers
    .map((n) => prData.repository[`pr${n}`])
    .filter(Boolean)
    .map(({ reviewThreads, ...pr }) => ({ ...pr, threads: summarizeThreads({ reviewThreads }) }));
  return { owner, repo, prs, base };
}

async function getStack({ owner, repo, number }) {
  const { [TOKEN_KEY]: token } = await chrome.storage.local.get(TOKEN_KEY);
  if (!token) {
    return { stack: null };
  }

  const key = `${owner}/${repo}#${number}`;
  const cached = stackCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { stack: cached.stack };
  }

  try {
    const stack = await fetchStack(token, owner, repo, number);
    const entry = { stack, at: Date.now() };
    stackCache.set(key, entry);
    stack?.prs.forEach((pr) => stackCache.set(`${owner}/${repo}#${pr.number}`, entry));
    return { stack };
  } catch (error) {
    console.error(`[fix-github-dumb-ui] Stack request for ${key} failed:`, error);
    return { stack: null, error: error.message, authError: error instanceof AuthError };
  }
}

async function fetchThreads(token, owner, repo, numbers) {
  const fields = numbers.map((n) => `pr${n}: pullRequest(number: ${n}) { ${THREAD_FIELDS} }`).join('\n');
  const data = await graphql(
    token,
    `query ($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`,
    { owner, repo },
  );
  return Object.fromEntries(
    numbers.filter((n) => data.repository[`pr${n}`]).map((n) => [n, summarizeThreads(data.repository[`pr${n}`])]),
  );
}

async function getThreads({ owner, repo, numbers }) {
  const { [TOKEN_KEY]: token } = await chrome.storage.local.get(TOKEN_KEY);
  if (!token) {
    return { threads: {} };
  }

  const threads = {};
  const missing = [];
  for (const number of numbers) {
    const cached = threadsCache.get(`${owner}/${repo}#${number}`);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      threads[number] = cached.threads;
    } else {
      missing.push(number);
    }
  }
  if (!missing.length) {
    return { threads };
  }

  try {
    const fetched = await fetchThreads(token, owner, repo, missing);
    for (const [number, summary] of Object.entries(fetched)) {
      threadsCache.set(`${owner}/${repo}#${number}`, { threads: summary, at: Date.now() });
      threads[number] = summary;
    }
    return { threads };
  } catch (error) {
    console.error(`[fix-github-dumb-ui] Thread request for ${owner}/${repo} failed:`, error);
    return { threads, error: error.message };
  }
}

async function validateToken(token) {
  try {
    const data = await graphql(token, 'query { viewer { login } }');
    return { login: data.viewer.login };
  } catch (error) {
    return { error: error.message };
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && TOKEN_KEY in changes) {
    stackCache.clear();
    threadsCache.clear();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'getStack':
      getStack(message).then(sendResponse);
      return true;
    case 'getThreads':
      getThreads(message).then(sendResponse);
      return true;
    case 'validateToken':
      validateToken(message.token).then(sendResponse);
      return true;
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      return false;
    default:
      return false;
  }
});
