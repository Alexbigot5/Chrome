// Service worker — manages saved creators via chrome.storage
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

    return true; // keep message channel open for async sendResponse
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
});
