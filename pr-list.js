const PR_LIST_LINK = 'a[data-testid="listitem-title-link"]';
const PR_LIST_HREF = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)$/;

const prListThreads = new Map();
const prListPending = new Set();
let prListLocation = null;

function prListRows() {
  const rows = [];
  for (const link of document.querySelectorAll(PR_LIST_LINK)) {
    const match = PR_LIST_HREF.exec(new URL(link.href, location.origin).pathname);
    const row = link.closest('li');
    if (match && row) {
      rows.push({ row, owner: match[1], repo: match[2], number: Number(match[3]), key: `${match[1]}/${match[2]}#${match[3]}` });
    }
  }
  return rows;
}

function loadPrListThreads(owner, repo, numbers) {
  const keys = numbers.map((number) => `${owner}/${repo}#${number}`);
  keys.forEach((key) => prListPending.add(key));
  const requestLocation = prListLocation;
  chrome.runtime.sendMessage({ type: 'getThreads', owner, repo, numbers }, (response) => {
    keys.forEach((key) => prListPending.delete(key));
    if (chrome.runtime.lastError || requestLocation !== prListLocation) {
      return;
    }
    if (response?.error) {
      console.warn('[fix-github-dumb-ui] Thread request failed:', response.error);
    }
    // Failed PRs get null so a failing request does not repeat on every DOM change.
    numbers.forEach((number, index) => prListThreads.set(keys[index], response?.threads?.[number] ?? null));
    renderPrListThreads(prListRows());
  });
}

// The list is a React app: our badge sits next to the native bubble, which CSS hides. With no
// unresolved threads, the bubble is hidden and nothing replaces it.
function renderPrListThreads(rows) {
  for (const { row, key } of rows) {
    const summary = prListThreads.get(key);
    const bubble = row.querySelector('svg.octicon-comment')?.parentElement;
    const container = bubble?.parentElement;
    if (!container) {
      continue;
    }
    const badge = container.querySelector(':scope > .fgu-threads');
    const signature = summary ? `${summary.count}:${summary.authors.map(({ login }) => login).join(',')}` : null;
    if ((container.dataset.fguThreads ?? null) === signature && Boolean(badge) === Boolean(summary?.count)) {
      continue;
    }
    badge?.remove();
    // Without data (no token, failed request) the native bubble stays.
    if (signature) {
      container.dataset.fguThreads = signature;
    } else {
      delete container.dataset.fguThreads;
    }
    if (summary?.count) {
      bubble.after(renderThreadsBadge(summary));
    }
  }
}

function syncPrListThreads() {
  if (location.href !== prListLocation) {
    prListLocation = location.href;
    prListThreads.clear();
  }
  const rows = prListRows();
  if (!rows.length) {
    return;
  }

  const missing = new Map();
  for (const { owner, repo, number, key } of rows) {
    if (!prListThreads.has(key) && !prListPending.has(key)) {
      const repoKey = `${owner}/${repo}`;
      missing.set(repoKey, [...(missing.get(repoKey) ?? []), number]);
    }
  }
  for (const [repoKey, numbers] of missing) {
    const [owner, repo] = repoKey.split('/');
    loadPrListThreads(owner, repo, numbers);
  }
  renderPrListThreads(rows);
}
