// Service worker — manages saved creators via chrome.storage
const BACKEND_URL = 'https://backendchrome-production-de12.up.railway.app';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_CREATOR") {
    const creator = message.payload;
    chrome.storage.local.get({ savedCreators: [] }, (result) => {
      const list = result.savedCreators;

      // Avoid exact duplicate saves (same handle + same date)
      const isDuplicate = list.some(
        (c) => c.handle === creator.handle && c.dateSaved === creator.dateSaved
      );

      if (!isDuplicate) {
        list.push(creator);
        chrome.storage.local.set({ savedCreators: list }, () => {
          sendResponse({ success: true, total: list.length });
        });
      } else {
        sendResponse({ success: false, reason: "duplicate" });
      }
    });

    return true;
  }

  if (message.type === "GET_SAVED") {
    chrome.storage.local.get({ savedCreators: [] }, (result) => {
      sendResponse({ creators: result.savedCreators });
    });
    return true;
  }

  if (message.type === "CLEAR_SAVED") {
    chrome.storage.local.set({ savedCreators: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "SAVE_TO_SHEET") {
    const { token, handle, platform } = message.payload;
    fetch(`${BACKEND_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, handle, platform }),
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});
