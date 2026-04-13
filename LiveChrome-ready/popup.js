// ─── DOM refs ──────────────────────────────────────────────────────────────
const loadingState = document.getElementById('loading-state');
const notfoundState = document.getElementById('notfound-state');
const creatorSection = document.getElementById('creator-section');
const saveBtn = document.getElementById('save-btn');
const sheetSelect = document.getElementById('sheet-select');

let currentHandle = null;
let currentPlatform = null;

// ─── State helpers ─────────────────────────────────────────────────────────
function showLoading() {
  loadingState.style.display = 'flex';
  notfoundState.style.display = 'none';
  creatorSection.style.display = 'none';
  document.getElementById('locked-state').style.display = 'none';
}

function showNotFound() {
  loadingState.style.display = 'none';
  notfoundState.style.display = 'flex';
  creatorSection.style.display = 'none';
  document.getElementById('locked-state').style.display = 'none';
}

function showLocked() {
  loadingState.style.display = 'none';
  notfoundState.style.display = 'none';
  creatorSection.style.display = 'none';
  document.getElementById('locked-state').style.display = 'flex';
}

function showCreator() {
  loadingState.style.display = 'none';
  notfoundState.style.display = 'none';
  document.getElementById('locked-state').style.display = 'none';
  creatorSection.style.display = 'flex';
}

// ─── Auth: get Google token ────────────────────────────────────────────────
async function getGoogleToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(token);
    });
  });
}

// ─── Platform detection from tab URL ───────────────────────────────────────
function detectPlatform() {
  const url = window._currentTabUrl || '';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return 'tiktok';
}

// ─── URL handle detection ──────────────────────────────────────────────────
function detectHandle(url) {
  const tiktokMatch = url.match(/tiktok\.com\/@([\w.]+)/);
  if (tiktokMatch) return { handle: tiktokMatch[1], platform: 'tiktok' };

  const igExclude = /instagram\.com\/(explore|reels|stories|accounts|p\/|reel\/|direct|about)/i;
  if (!igExclude.test(url)) {
    const igMatch = url.match(/instagram\.com\/@?([\w.]+)/);
    if (igMatch) return { handle: igMatch[1], platform: 'instagram' };
  }

  return null;
}

// ─── Render detected creator ───────────────────────────────────────────────
function renderHandle(handle, platform) {
  document.getElementById('c-handle').textContent = '@' + handle;

  const platformEl = document.getElementById('c-platform');
  platformEl.textContent = platform === 'tiktok' ? 'TikTok' : 'Instagram';
  platformEl.className = 'platform-badge ' + platform;

  currentHandle = '@' + handle;
  currentPlatform = platform;

  showCreator();

  saveBtn.disabled = false;
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save to Sheet';
}

// ─── Populate sheet selector from storage ──────────────────────────────────
async function populateSheets() {
  const stored = await new Promise((resolve) =>
    chrome.storage.local.get(['livechrome_sheet_id', 'livechrome_sheet_name'], resolve)
  );

  sheetSelect.innerHTML = '';
  const name = stored.livechrome_sheet_name || 'My Creator Sheet';
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  sheetSelect.appendChild(opt);
}

// ─── Save to backend via background service worker ─────────────────────────
async function postToSheet(data) {
  const stored = await new Promise((resolve) =>
    chrome.storage.local.get(['livechrome_token'], resolve)
  );

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'SAVE_TO_SHEET',
      payload: {
        token: stored.livechrome_token,
        handle: data.handle.replace('@', ''),
        platform: data.platform,
      },
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

// ─── Save handler ──────────────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  if (!currentHandle || saveBtn.disabled) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = "<span class='btn-spinner'></span> Saving…";

  try {
    const result = await postToSheet({
      handle: currentHandle,
      platform: currentPlatform,
    });

    const scoreText = result.data?.matchScore != null
      ? ` — ${result.data.matchScore}% match`
      : '';

    saveBtn.className = 'save-btn saved';
    saveBtn.innerHTML = `<span>✓</span> Saved${scoreText}`;

    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.className = 'save-btn';
      saveBtn.textContent = 'Save to Sheet';
    }, 3000);
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.className = 'save-btn save-error';
    saveBtn.textContent = err.message.includes('limit')
      ? 'Limit reached'
      : 'Error — try again';

    setTimeout(() => {
      saveBtn.className = 'save-btn';
      saveBtn.textContent = 'Save to Sheet';
    }, 4000);
  }
});

// ─── Init ──────────────────────────────────────────────────────────────────
async function init() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    window._currentTabUrl = tabs[0]?.url || '';
  });

  showLoading();

  try {
    const googleToken = await getGoogleToken();

    const verifyRes = await fetch(`${CONFIG.BACKEND_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleToken }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.valid) {
      showLocked();
      return;
    }

    chrome.storage.local.set({
      livechrome_token: verifyData.token,
      livechrome_sheet_id: verifyData.sheetId,
    });
  } catch (err) {
    console.error('[AUTH] Failed to verify:', err);
    showLocked();
    return;
  }

  await populateSheets();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      showNotFound();
      return;
    }

    const detected = detectHandle(tab.url);
    if (detected) {
      renderHandle(detected.handle, detected.platform);
    } else {
      showNotFound();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
