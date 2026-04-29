// WePullData — service worker
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
    return true;
  }

  // ── List all Google Sheets in the user's Drive ───────────────────────────
  if (message.type === 'LIST_SHEETS') {
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        sendResponse({ error: 'Not authenticated' });
        return;
      }
      try {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
        url.searchParams.set('fields', 'files(id,name,modifiedTime,webViewLink)');
        url.searchParams.set('orderBy', 'modifiedTime desc');
        url.searchParams.set('pageSize', '30');

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 401) chrome.identity.removeCachedAuthToken({ token }, () => {});
          sendResponse({ error: `Drive API ${res.status}` });
          return;
        }

        const data   = await res.json();
        const sheets = (data.files || []).map(f => ({
          id:           f.id,
          name:         f.name,
          modifiedTime: f.modifiedTime,
          url:          f.webViewLink,
        }));
        sendResponse({ sheets });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  // ── Save creator — supports optional sheetId override ───────────────────
  if (message.type === 'SAVE_TO_SHEET') {
    const { token, handle, platform, sheetId } = message.payload;
    fetch(`${BACKEND_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, handle, platform, sheetId }),
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_FIELDS') {
    chrome.storage.local.get(['livechrome_fields'], (result) => {
      sendResponse({
        fields: result.livechrome_fields || ['followers', 'engagementRate', 'avgViews', 'avgLikes', 'avgComments', 'estimatedCpm'],
      });
    });
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(
      ['livechrome_token', 'livechrome_sheet_id', 'livechrome_fields', 'livechrome_active_sheet'],
      () => { sendResponse({ ok: true }); }
    );
    return true;
  }

});
