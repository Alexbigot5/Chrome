// LiveChrome — service worker
// Handles SAVE_TO_SHEET messages and storage helpers.
// Brand intelligence is dashboard-only — no brand handlers here.

const BACKEND_URL = 'https://backendchrome-production-de12.up.railway.app';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

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
    return true; // keep channel open for async response
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
