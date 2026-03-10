const UPDATE_EVENT_NAME = 'blop-devtools-update';

window.addEventListener(UPDATE_EVENT_NAME, (event) => {
  try {
    chrome.runtime.sendMessage({
      type: UPDATE_EVENT_NAME,
      detail: event?.detail || null,
    });
  } catch {
    // Ignore messaging failures (e.g., extension reloading)
  }
});
