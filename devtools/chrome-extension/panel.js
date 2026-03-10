const treeEl = document.getElementById('tree');
const rawOutputEl = document.getElementById('rawOutput');
const statusEl = document.getElementById('status');
const refreshButton = document.getElementById('refresh');
const viewModeSelect = document.getElementById('viewMode');
const hoverHighlightEl = document.getElementById('hoverHighlight');
const PAGE_OVERLAY_ID = '__blop_devtools_overlay__';
const UPDATE_EVENT_NAME = 'blop-devtools-update';
const inspectedTabId = chrome.devtools.inspectedWindow.tabId;

const SNAPSHOT_EXPR = `(() => {
  const hook = window.__BLOP_DEVTOOLS__;
  if (!hook || typeof hook.getTree !== 'function') {
    return {
      error: 'window.__BLOP_DEVTOOLS__.getTree() is not available. Is the Blop runtime loaded on this page?'
    };
  }
  return hook.getTree();
})()`;
const DEFAULT_EXPANDED_BRANCHES = 8;

let latestSnapshot = null;
let queuedPushRefresh = null;
const openStateByPath = new Map();

function setStatus(message) {
  statusEl.textContent = message;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function runInPage(expression) {
  chrome.devtools.inspectedWindow.eval(expression, () => {});
}

function clearPageHighlight() {
  runInPage(`(() => {
    const overlay = window.document.getElementById('${PAGE_OVERLAY_ID}');
    if (overlay) {
      overlay.style.display = 'none';
    }
    return true;
  })()`);
}

function highlightPath(path) {
  if (!hoverHighlightEl.checked) return;
  runInPage(`(() => {
    const hook = window.__BLOP_DEVTOOLS__;
    if (!hook || typeof hook.getRect !== 'function') return false;

    const rect = hook.getRect(${JSON.stringify(path)});
    if (!rect) {
      const previous = window.document.getElementById('${PAGE_OVERLAY_ID}');
      if (previous) previous.style.display = 'none';
      return false;
    }

    let overlay = window.document.getElementById('${PAGE_OVERLAY_ID}');
    if (!overlay) {
      overlay = window.document.createElement('div');
      overlay.id = '${PAGE_OVERLAY_ID}';
      overlay.style.position = 'fixed';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483647';
      overlay.style.border = '2px solid #ff5a36';
      overlay.style.background = 'rgba(255, 90, 54, 0.12)';
      overlay.style.borderRadius = '2px';
      overlay.style.boxSizing = 'border-box';
      overlay.style.display = 'none';
      window.document.documentElement.appendChild(overlay);
    }

    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = Math.max(rect.width, 1) + 'px';
    overlay.style.height = Math.max(rect.height, 1) + 'px';
    overlay.style.display = 'block';
    return true;
  })()`);
}

function formatKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  return keys.join(', ');
}

function buildNodeMeta(node) {
  const parts = [];
  const attributes = formatKeys(node.attributeKeys);
  const state = formatKeys(node.stateKeys);
  const context = formatKeys(node.contextKeys);
  const tracked = formatKeys(node.trackedKeys);

  if (attributes) parts.push(`attrs: ${attributes}`);
  if (state) parts.push(`state: ${state}`);
  if (context) parts.push(`context: ${context}`);
  if (tracked) parts.push(`tracked: ${tracked}`);

  if (parts.length === 0) return null;
  return parts.join(' | ');
}

function buildNodeView(node, expansionBudget) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const wrapper = createElement('details', 'node');
  const shouldAutoOpen = hasChildren && expansionBudget.remaining > 0;
  if (shouldAutoOpen) {
    expansionBudget.remaining -= 1;
  }
  const savedOpen = openStateByPath.get(node.path);
  wrapper.open = savedOpen === undefined ? shouldAutoOpen : savedOpen;
  wrapper.dataset.path = node.path;
  wrapper.addEventListener('toggle', () => {
    openStateByPath.set(node.path, wrapper.open);
  });

  const summary = createElement('summary');
  const displayName = node.displayName || node.name;
  summary.appendChild(createElement('span', 'node-name', displayName));
  if (displayName !== node.name) {
    summary.appendChild(createElement('span', 'node-tech-name', `(${node.name})`));
  }
  summary.appendChild(createElement('span', 'node-path', node.path));
  summary.addEventListener('mouseenter', () => highlightPath(node.path));
  summary.addEventListener('mouseleave', clearPageHighlight);

  const flagParts = [];
  if (node.destroyed) flagParts.push('destroyed');
  if (node.mounted) flagParts.push('mounted');
  if (Array.isArray(node.children) && node.children.length > 0) flagParts.push(`children:${node.children.length}`);
  if (node.stateKeys && node.stateKeys.length > 0) flagParts.push(`state:${node.stateKeys.length}`);
  if (node.trackedKeys && node.trackedKeys.length > 0) flagParts.push(`tracked:${node.trackedKeys.length}`);
  if (flagParts.length > 0) {
    summary.appendChild(createElement('span', 'node-flags', flagParts.join(' ')));
  }
  wrapper.appendChild(summary);

  const meta = buildNodeMeta(node);
  if (meta) {
    wrapper.appendChild(createElement('div', 'node-meta', meta));
  }

  if (hasChildren) {
    const childrenEl = createElement('div', 'node-children');
    node.children.forEach((child) => {
      childrenEl.appendChild(buildNodeView(child, expansionBudget));
    });
    wrapper.appendChild(childrenEl);
  }

  return wrapper;
}

function renderTree(value) {
  treeEl.innerHTML = '';

  if (!value) {
    treeEl.appendChild(createElement('div', 'empty', 'No data.'));
    return;
  }

  if (value.error) {
    treeEl.appendChild(createElement('div', 'error', value.error));
    return;
  }

  if (!value.root) {
    treeEl.appendChild(createElement('div', 'error', 'Snapshot has no root node.'));
    return;
  }

  // Keep only states for currently-existing nodes to avoid stale entries.
  const activePaths = new Set();
  (function collectPaths(node) {
    activePaths.add(node.path);
    (node.children || []).forEach(collectPaths);
  }(value.root));

  [...openStateByPath.keys()].forEach((path) => {
    if (!activePaths.has(path)) {
      openStateByPath.delete(path);
    }
  });

  treeEl.appendChild(buildNodeView(value.root, { remaining: DEFAULT_EXPANDED_BRANCHES }));
}

function renderJSON(value) {
  rawOutputEl.textContent = JSON.stringify(value, null, 2);
}

function renderSnapshot(value) {
  const viewMode = viewModeSelect.value;
  const isTree = viewMode === 'tree';

  treeEl.hidden = !isTree;
  rawOutputEl.hidden = isTree;

  if (isTree) {
    renderTree(value);
  } else {
    renderJSON(value);
  }
}

function refreshSnapshot(source = 'manual') {
  setStatus(`Reading snapshot (${source})...`);
  chrome.devtools.inspectedWindow.eval(SNAPSHOT_EXPR, (result, exceptionInfo) => {
    if (exceptionInfo && exceptionInfo.isException) {
      setStatus('Eval error');
      latestSnapshot = { error: exceptionInfo.value };
      renderSnapshot(latestSnapshot);
      return;
    }
    latestSnapshot = result;
    setStatus(`Updated (${source}) at ${new Date().toLocaleTimeString()}`);
    renderSnapshot(result);
  });
}

function queuePushRefresh() {
  if (queuedPushRefresh) return;
  queuedPushRefresh = setTimeout(() => {
    queuedPushRefresh = null;
    refreshSnapshot('push');
  }, 16);
}

function clearQueuedPushRefresh() {
  if (queuedPushRefresh) {
    clearTimeout(queuedPushRefresh);
    queuedPushRefresh = null;
  }
}

function onRuntimeMessage(message, sender) {
  if (!message || message.type !== UPDATE_EVENT_NAME) {
    return;
  }
  if (!sender?.tab || sender.tab.id !== inspectedTabId) {
    return;
  }
  queuePushRefresh();
}

refreshButton.addEventListener('click', () => refreshSnapshot('manual'));
viewModeSelect.addEventListener('change', () => {
  renderSnapshot(latestSnapshot);
});
hoverHighlightEl.addEventListener('change', () => {
  if (!hoverHighlightEl.checked) {
    clearPageHighlight();
  }
});
chrome.runtime.onMessage.addListener(onRuntimeMessage);
window.addEventListener('beforeunload', () => {
  chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  clearQueuedPushRefresh();
  clearPageHighlight();
});

refreshSnapshot('initial');
