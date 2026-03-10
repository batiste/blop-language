# Blop Chrome DevTools MVP

This is a minimal unpacked Chrome extension that adds a `Blop` tab in DevTools.
It reads `window.__BLOP_DEVTOOLS__.getTree()` and receives push update events from the page runtime.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `devtools/chrome-extension`.

## Use it

1. Open a page running Blop runtime in the browser.
2. Open DevTools.
3. Open the `Blop` panel.
4. The panel updates automatically on runtime push events.
5. Use `Refresh` for a manual snapshot if needed.

If no hook is found, the panel shows an error message.
