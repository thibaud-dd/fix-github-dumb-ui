const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
const MIN_SIDEBAR_WIDTH = 160;
const MIN_MAIN_WIDTH = 400;
const PR_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+/;
const ELLIPSIS = /^(\.\.\.|…)/;

const root = document.documentElement;

function syncPrFlag() {
  root.toggleAttribute('data-fgu-pr', PR_PATH.test(location.pathname));
}

// GitHub cuts long paths to ~93 chars on the server and keeps the full path in `title`.
function expandTruncatedPaths() {
  document.querySelectorAll('.file-header .file-info a[title]:not(.fgu-path)').forEach((link) => {
    const text = link.textContent.trim();
    if (!ELLIPSIS.test(text) || !link.title.endsWith(text.replace(ELLIPSIS, ''))) {
      return;
    }
    // <bdi> keeps the path in LTR order inside the RTL link that moves the ellipsis to the start.
    const bdi = document.createElement('bdi');
    bdi.textContent = link.title;
    link.replaceChildren(bdi);
    link.classList.add('fgu-path');
  });
}

function applySidebarWidth(width) {
  if (width) {
    root.style.setProperty('--fgu-sidebar-width', `${width}px`);
    root.setAttribute('data-fgu-sidebar', '');
  } else {
    root.style.removeProperty('--fgu-sidebar-width');
    root.removeAttribute('data-fgu-sidebar');
  }
}

function clampSidebarWidth(layout, width) {
  const gutter = parseFloat(getComputedStyle(layout).columnGap) || 0;
  const max = layout.clientWidth - gutter - MIN_MAIN_WIDTH;
  return Math.round(Math.max(MIN_SIDEBAR_WIDTH, Math.min(width, max)));
}

function ensureResizeHandle() {
  const layout = document.getElementById('diff-layout-component');
  if (!layout || layout.querySelector(':scope > .fgu-resize-handle')) {
    return;
  }

  const handle = document.createElement('div');
  handle.className = 'fgu-resize-handle';
  handle.title = 'Drag to resize. Double-click to reset.';

  let width = null;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    root.classList.add('fgu-resizing');
  });

  handle.addEventListener('pointermove', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) {
      return;
    }
    width = clampSidebarWidth(layout, event.clientX - layout.getBoundingClientRect().left);
    applySidebarWidth(width);
  });

  const endDrag = (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) {
      return;
    }
    handle.releasePointerCapture(event.pointerId);
    root.classList.remove('fgu-resizing');
    if (width) {
      chrome.storage.local.set({ [SIDEBAR_WIDTH_KEY]: width });
    }
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  handle.addEventListener('dblclick', () => {
    width = null;
    applySidebarWidth(null);
    chrome.storage.local.remove(SIDEBAR_WIDTH_KEY);
  });

  layout.append(handle);
}

chrome.storage.local.get(SIDEBAR_WIDTH_KEY, (items) => applySidebarWidth(items[SIDEBAR_WIDTH_KEY]));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && SIDEBAR_WIDTH_KEY in changes) {
    applySidebarWidth(changes[SIDEBAR_WIDTH_KEY].newValue);
  }
});

// GitHub navigates with Turbo and React and loads diffs lazily, so re-apply on every DOM change.
let scheduled = false;
function update() {
  scheduled = false;
  syncPrFlag();
  expandTruncatedPaths();
  ensureResizeHandle();
  syncStackSidebar();
  syncPrListThreads();
}

new MutationObserver(() => {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(update);
  }
}).observe(root, { childList: true, subtree: true });

update();
