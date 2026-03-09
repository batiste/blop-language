# Blop Chrome DevTools MVP

This is a minimal unpacked Chrome extension that adds a `Blop` tab in DevTools.
It reads `window.__BLOP_DEVTOOLS__.getTree()` from the inspected page and prints the tree as JSON.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `devtools/chrome-extension`.

## Use it

1. Open a page running Blop runtime in the browser.
2. Open DevTools.
3. Open the `Blop` panel.
4. Click `Refresh` (or keep auto-refresh enabled).

If no hook is found, the panel shows an error message.
