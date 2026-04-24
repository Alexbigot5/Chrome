// LiveChrome — content script
// Injects the creator intel sidebar into TikTok and Instagram profile pages.

(function () {
  if (document.getElementById('livechrome-sidebar-root')) return;

  const BACKEND_URL = 'https://backendchrome-production-de12.up.railway.app';

  // ── Page detection ────────────────────────────────────────
  function detectPage() {
    const url = window.location.href;

    // TikTok profile: tiktok.com/@handle
    const tt = url.match(/tiktok\.com\/@([\w.]+)(?:\/|$|\?)/);
    if (tt) return { platform: 'tiktok', handle: tt[1] };

    // Instagram profile — exclude non-profile paths
    const igSkip = /instagram\.com\/(explore|reels|stories|accounts|p\/|reel\/|direct|about|tv\/)/i;
    if (!igSkip.test(url)) {
      const ig = url.match(/instagram\.com\/@?([\w.]+)(?:\/|$|\?)/);
      if (ig && ig[1] !== 'instagram') return { platform: 'instagram', handle: ig[1] };
    }

    return null;
  }

  // ── Inject sidebar root + iframe ──────────────────────────
  const root = document.createElement('div');
  root.id = 'livechrome-sidebar-root';
  document.body.appendChild(root);

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('sidebar.html');
  root.appendChild(iframe);

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'livechrome-toggle-btn';
  toggleBtn.title = 'LiveChrome';
  toggleBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
      stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
      <path d="M8.5 1.5L3 9h4l-1 5.5L12 7H8l.5-5.5z"/>
    </svg>`;
  document.body.appendChild(toggleBtn);

  let isOpen = false;

  function openSidebar() {
    isOpen = true;
    root.classList.add('open');
    toggleBtn.classList.add('open');
    toggleBtn.style.right = '320px';
    document.body.style.transition = 'margin-right 0.22s cubic-bezier(0.4,0,0.2,1)';
    document.body.style.marginRight = '320px';
    chrome.storage.local.set({ livechrome_sidebar_open: true });
  }

  function closeSidebar() {
    isOpen = false;
    root.classList.remove('open');
    toggleBtn.classList.remove('open');
    toggleBtn.style.right = '0';
    document.body.style.marginRight = '0';
    chrome.storage.local.set({ livechrome_sidebar_open: false });
  }

  toggleBtn.addEventListener('click', () => {
    if (isOpen) { closeSidebar(); } else { openSidebar(); initSidebar(); }
  });

  // ── Auth ──────────────────────────────────────────────────
  let cachedToken = null;

  async function getToken() {
    const stored = await new Promise(r =>
      chrome.storage.local.get(['livechrome_token'], r)
    );
    if (stored.livechrome_token) {
      cachedToken = stored.livechrome_token;
      return stored.livechrome_token;
    }

    const googleToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(token);
      });
    });

    const res  = await fetch(`${BACKEND_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleToken }),
    });
    const data = await res.json();
    if (!data.valid) return null;

    chrome.storage.local.set({
      livechrome_token:    data.token,
      livechrome_sheet_id: data.sheetId,
    });
    cachedToken = data.token;
    return data.token;
  }

  // ── Sync field preferences from backend ──────────────────
  // Reads user's onboarding selections from DB and caches in storage.
  // Only runs once per session (fieldsAlreadySynced flag).
  let fieldsAlreadySynced = false;

  async function syncUserFields(token) {
    try {
      const res = await fetch(`${BACKEND_URL}/onboarding/fields`, {
        headers: { 'x-livechrome-token': token },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.fields) && data.fields.length > 0) {
        await chrome.storage.local.set({ livechrome_fields: data.fields });
      }
    } catch (err) {
      console.warn('[LiveChrome] Field sync failed:', err.message);
    }
  }

  async function getUserFields() {
    const stored = await new Promise(r =>
      chrome.storage.local.get(['livechrome_fields'], r)
    );
    return stored.livechrome_fields || ['followers', 'eng', 'views', 'likes', 'comments', 'cost'];
  }

  // ── Init: detect page, auth, scrape, send to sidebar ─────
  async function initSidebar() {
    const page = detectPage();
    postToSidebar({ type: 'SET_PAGE', page });

    if (!page) {
      postToSidebar({ type: 'SET_STATE', state: 'notfound' });
      return;
    }

    postToSidebar({ type: 'SET_STATE', state: 'loading' });

    try {
      const token = await getToken();
      if (!token) {
        postToSidebar({ type: 'SET_STATE', state: 'locked' });
        return;
      }

      // Sync field choices once per session
      if (!fieldsAlreadySynced) {
        await syncUserFields(token);
        fieldsAlreadySynced = true;
      }

      const fields = await getUserFields();
      postToSidebar({ type: 'SET_FIELDS', fields });

      // Scrape — previewOnly means no sheet write yet
      const scrapeRes = await fetch(`${BACKEND_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          handle: page.handle,
          platform: page.platform,
          previewOnly: true,
        }),
      });
      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        postToSidebar({ type: 'SET_STATE', state: 'error', error: scrapeData.error || 'Scrape failed' });
        return;
      }

      postToSidebar({ type: 'SET_DATA', data: scrapeData.data, handle: page.handle, platform: page.platform });
      postToSidebar({ type: 'SET_STATE', state: 'ready' });

    } catch (err) {
      postToSidebar({ type: 'SET_STATE', state: 'error', error: err.message });
    }
  }

  function postToSidebar(msg) {
    if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
  }

  // ── Messages from sidebar ─────────────────────────────────
  window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'livechrome-sidebar') return;

    // User clicked "Save to Sheet"
    if (msg.type === 'SAVE_TO_SHEET') {
      postToSidebar({ type: 'SAVE_STATE', state: 'saving' });
      try {
        const token = cachedToken || await getToken();
        const page  = detectPage();
        if (!token || !page) throw new Error('Not authenticated');

        const res    = await fetch(`${BACKEND_URL}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, handle: page.handle, platform: page.platform }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Save failed');

        postToSidebar({ type: 'SAVE_STATE', state: 'saved' });
        setTimeout(() => postToSidebar({ type: 'SAVE_STATE', state: 'idle' }), 2400);
      } catch (err) {
        postToSidebar({ type: 'SAVE_STATE', state: 'error', error: err.message });
        setTimeout(() => postToSidebar({ type: 'SAVE_STATE', state: 'idle' }), 3000);
      }
    }

    if (msg.type === 'RETRY') {
      initSidebar();
    }

    if (msg.type === 'CLOSE_SIDEBAR') {
      closeSidebar();
    }
  });

  // Auto-open if sidebar was open on last visit
  chrome.storage.local.get(['livechrome_sidebar_open'], (result) => {
    if (result.livechrome_sidebar_open) { openSidebar(); initSidebar(); }
  });

  // SPA navigation — re-scrape when URL changes (TikTok/IG are SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (isOpen) initSidebar();
    }
  }).observe(document, { subtree: true, childList: true });

})();
