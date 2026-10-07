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

const stackCache = new Map();

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

  const fields = numbers.map((n) => `pr${n}: pullRequest(number: ${n}) { number title state isDraft }`).join('\n');
  const prData = await graphql(
    token,
    `query ($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`,
    { owner, repo },
  );
  const prs = numbers.map((n) => prData.repository[`pr${n}`]).filter(Boolean);
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
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'getStack':
      getStack(message).then(sendResponse);
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
