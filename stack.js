const STACK_COLLAPSED_KEY = 'stackCollapsed';
const STACK_PR_URL = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/([^/]+))?/;
const STACK_TABS = new Set(['files', 'changes', 'commits', 'checks']);
const SVG_NS = 'http://www.w3.org/2000/svg';
const stackRoot = document.documentElement;

const ICON_PATHS = {
  open: 'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z',
  draft: 'M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z',
  merged: 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z',
  closed: 'M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z',
  stack: 'M7.122.392a1.75 1.75 0 0 1 1.756 0l5.003 2.902c.83.481.83 1.68 0 2.162L8.878 8.358a1.75 1.75 0 0 1-1.756 0L2.119 5.456a1.251 1.251 0 0 1 0-2.162ZM8.125 1.69a.248.248 0 0 0-.25 0l-4.63 2.685 4.63 2.685a.248.248 0 0 0 .25 0l4.63-2.685ZM1.601 7.789a.75.75 0 0 1 1.025-.273l5.249 3.044a.248.248 0 0 0 .25 0l5.249-3.044a.75.75 0 0 1 .752 1.298l-5.248 3.044a1.75 1.75 0 0 1-1.756 0L1.874 8.814A.75.75 0 0 1 1.6 7.789Zm0 3.5a.75.75 0 0 1 1.025-.273l5.249 3.044a.248.248 0 0 0 .25 0l5.249-3.044a.75.75 0 0 1 .752 1.298l-5.248 3.044a1.75 1.75 0 0 1-1.756 0l-5.248-3.044a.75.75 0 0 1-.273-1.025Z',
  branch: 'M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z',
  collapse: 'M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z',
  expand: 'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z',
};

const STATE_LABELS = { open: 'Open', draft: 'Draft', merged: 'Merged', closed: 'Closed' };

const stackState = {
  locationKey: null,
  current: null,
  stack: null,
  error: null,
  collapsed: false,
};

let stackSidebar = null;

function stackIcon(name, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

function stackElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function prStateName(pr) {
  if (pr.state === 'MERGED') {
    return 'merged';
  }
  if (pr.state === 'CLOSED') {
    return 'closed';
  }
  return pr.isDraft ? 'draft' : 'open';
}

function renderStackHeader() {
  const header = stackElement('div', 'fgu-stack-header');
  header.append(stackIcon('stack', 'fgu-stack-header-icon'), stackElement('span', 'fgu-stack-heading', 'Stack'));
  if (stackState.stack) {
    header.append(stackElement('span', 'fgu-stack-count', String(stackState.stack.prs.length)));
  }

  const toggle = stackElement('button', 'fgu-stack-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', stackState.collapsed ? 'Expand stack sidebar' : 'Collapse stack sidebar');
  toggle.setAttribute('aria-expanded', String(!stackState.collapsed));
  toggle.append(stackIcon(stackState.collapsed ? 'expand' : 'collapse', 'fgu-stack-toggle-icon'));
  toggle.addEventListener('click', () => {
    stackState.collapsed = !stackState.collapsed;
    chrome.storage.local.set({ [STACK_COLLAPSED_KEY]: stackState.collapsed });
    renderStackSidebar();
  });
  header.append(toggle);
  return header;
}

function renderStackList() {
  const { owner, repo, prs, base } = stackState.stack;
  const { number: currentNumber, tab } = stackState.current;
  const fragment = document.createDocumentFragment();

  const list = stackElement('ol', 'fgu-stack-list');
  for (const pr of prs) {
    const state = prStateName(pr);
    const isCurrent = pr.number === currentNumber;
    const link = stackElement('a', 'fgu-stack-item');
    link.href = `/${owner}/${repo}/pull/${pr.number}${tab ? `/${tab}` : ''}`;
    link.title = `#${pr.number} ${pr.title} (${STATE_LABELS[state]})`;
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    }

    const meta = stackElement('span', 'fgu-stack-meta');
    meta.append(stackElement('span', 'fgu-stack-number', `#${pr.number}`));
    if (pr.threads?.count) {
      meta.append(renderThreadsBadge(pr.threads));
    }
    const text = stackElement('span', 'fgu-stack-text');
    text.append(stackElement('span', 'fgu-stack-title', pr.title), meta);
    link.append(stackIcon(state, `fgu-stack-state fgu-stack-state-${state}`), text);

    const item = document.createElement('li');
    item.append(link);
    list.append(item);
  }
  fragment.append(list);

  if (base) {
    const baseRow = stackElement('div', 'fgu-stack-base');
    baseRow.title = base;
    baseRow.append(stackIcon('branch', 'fgu-stack-base-icon'), stackElement('span', 'fgu-stack-base-name', base));
    fragment.append(baseRow);
  }
  return fragment;
}

function renderStackError() {
  const container = stackElement('div', 'fgu-stack-error');
  const button = stackElement('button', 'fgu-stack-options', 'Open options');
  button.type = 'button';
  button.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'openOptions' }));
  container.append(stackElement('p', '', stackState.error), button);
  return container;
}

function renderStackSidebar() {
  const visible = Boolean(stackState.current && (stackState.stack || stackState.error));
  stackRoot.toggleAttribute('data-fgu-stack', visible);
  stackRoot.toggleAttribute('data-fgu-stack-collapsed', visible && stackState.collapsed);
  if (!visible) {
    stackSidebar?.remove();
    return;
  }

  stackSidebar ??= stackElement('nav', 'fgu-stack');
  stackSidebar.setAttribute('aria-label', 'Pull request stack');
  const panel = stackElement('div', 'fgu-stack-panel');
  panel.append(renderStackHeader(), stackState.stack ? renderStackList() : renderStackError());
  stackSidebar.replaceChildren(panel);
  mountStackSidebar();
  alignStackSidebar();
}

// Inside .application-main so the sidebar starts below the GitHub header. Turbo replaces <body> on
// navigation, so the sidebar is mounted again when it gets detached.
function mountStackSidebar() {
  const container = document.querySelector('.application-main');
  if (container && stackSidebar.parentElement !== container) {
    container.prepend(stackSidebar);
    alignStackSidebar();
  }
}

// .application-main starts 24px below the header (a collapsed margin), so pull the sidebar up to it.
function alignStackSidebar() {
  const container = stackSidebar?.parentElement;
  if (!container) {
    return;
  }
  let contentAbove = 0;
  for (let element = container.previousElementSibling; element; element = element.previousElementSibling) {
    const { position } = getComputedStyle(element);
    if (position !== 'absolute' && position !== 'fixed') {
      contentAbove = Math.max(contentAbove, element.getBoundingClientRect().bottom);
    }
  }
  const gap = Math.max(0, container.getBoundingClientRect().top - contentAbove);
  stackSidebar.style.setProperty('--fgu-stack-gap', `${gap}px`);
}

window.addEventListener('resize', alignStackSidebar);

function loadStack(current, locationKey) {
  chrome.runtime.sendMessage({ type: 'getStack', ...current }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[fix-github-dumb-ui] Stack request failed:', chrome.runtime.lastError.message);
      return;
    }
    if (response?.error) {
      console.warn('[fix-github-dumb-ui] Stack request failed:', response.error);
    }
    if (locationKey !== stackState.locationKey) {
      return;
    }
    stackState.stack = response?.stack ?? null;
    stackState.error = response?.authError ? `${response.error} Update the token in the extension options.` : null;
    renderStackSidebar();
  });
}

function syncStackSidebar() {
  const match = STACK_PR_URL.exec(location.pathname);
  const current = match
    ? { owner: match[1], repo: match[2], number: Number(match[3]), tab: STACK_TABS.has(match[4]) ? match[4] : null }
    : null;
  const locationKey = current ? `${current.owner}/${current.repo}#${current.number}/${current.tab}` : null;

  if (locationKey === stackState.locationKey) {
    if (stackSidebar && stackRoot.hasAttribute('data-fgu-stack')) {
      mountStackSidebar();
    }
    return;
  }

  stackState.locationKey = locationKey;
  stackState.current = current;
  const { stack } = stackState;
  // Keep showing the stack while moving between its PRs, so the sidebar does not flicker.
  const isInStack =
    current &&
    stack?.owner === current.owner &&
    stack.repo === current.repo &&
    stack.prs.some(({ number }) => number === current.number);
  if (!isInStack) {
    stackState.stack = null;
    stackState.error = null;
  }
  renderStackSidebar();
  if (current) {
    loadStack(current, locationKey);
  }
}

chrome.storage.local.get(STACK_COLLAPSED_KEY, (items) => {
  stackState.collapsed = Boolean(items[STACK_COLLAPSED_KEY]);
  renderStackSidebar();
});
