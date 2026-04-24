// LiveChrome — service worker
// Handles SAVE_TO_SHEET messages and identity (chrome.identity only works here).

const BACKEND_URL = 'https://backendchrome-production-de12.up.railway.app';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Content script can't use chrome.identity — proxy it through here
  if (message.type === 'GET_GOOGLE_TOKEN') {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token });
      }
    });
    return true; // keep channel open for async
  }

  if (message.type === 'SAVE_TO_SHEET') {
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

  if (message.type === 'GET_FIELDS') {
    chrome.storage.local.get(['livechrome_fields'], (result) => {
      sendResponse({
        fields: result.livechrome_fields || ['followers', 'eng', 'views', 'likes', 'comments', 'cost'],
      });
    });
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['livechrome_token', 'livechrome_sheet_id', 'livechrome_fields'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

});
