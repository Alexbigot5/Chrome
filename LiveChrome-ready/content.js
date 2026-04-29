// WePullData Sidebar — creator intelligence only
// Design: warm off-white #fbfaf6, JetBrains Mono for numbers, Inter for UI
// 320px wide, full viewport height, injected as iframe

// ── Design tokens (match design file exactly) ─────────────────
const C = {
  panel:      '#fbfaf6',
  surface:    '#f2efe8',
  surface2:   '#ecebe4',
  border:     '#e4e0d6',
  borderSoft: '#ece9e0',
  text:       '#1c1a15',
  textDim:    '#6b6658',
  textFaint:  '#9a9486',
};
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace";
const UI = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

// ── App state ─────────────────────────────────────────────────
let state = {
  uiState:     'loading',   // loading | ready | locked | notfound | error
  view:        'main',      // main | sheets
  handle:      null,
  platform:    null,
  data:        null,
  fields:      ['followers', 'engagementRate', 'avgViews', 'avgLikes', 'avgComments', 'estimatedCpm'],
  saveState:   'idle',      // idle | saving | saved | error
  error:       null,
  // Sheet picker
  activeSheet: null,        // { id, name, url } — currently selected sheet
  sheets:      [],          // all sheets fetched from Drive
  sheetsState: 'idle',      // idle | loading | loaded | error
  sheetsError: null,
};

// ── Persist active sheet to chrome.storage ────────────────────
function loadActiveSheet() {
  window.parent.postMessage({ source: 'livechrome-sidebar', type: 'GET_ACTIVE_SHEET' }, '*');
}
loadActiveSheet();

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// ── Field definitions ─────────────────────────────────────────
// Keys match onboarding field keys and backend FIELD_LABELS keys exactly
const FIELD_CONFIG = {
  followers: {
    label:    'Followers',
    tt:       'Total follower count',
    icon:     icon('M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 14c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4M11 4.5a2 2 0 110 4M11.5 10c1.8.2 3 1.8 3 4'),
    getValue: (d) => fmtNum(d?.followers),
  },
  engagementRate: {
    label:    'Eng Rate',
    tt:       'Avg (likes+comments) ÷ followers across last 8 posts',
    icon:     icon('M2 11l4-4 3 3 5-6M9 4h4v4'),
    getValue: (d) => d?.engagementRate || '—',
  },
  avgViews: {
    label:    'Avg Views',
    tt:       'Average views across last 8 posts',
    icon:     iconMulti([
      'M1.5 8s2.5-5 6.5-5 6.5 5 6.5 5-2.5 5-6.5 5-6.5-5-6.5-5z',
      'M8 8m-2 0a2 2 0 104 0 2 2 0 10-4 0',
    ]),
    getValue: (d) => fmtNum(d?.avgViews),
  },
  avgLikes: {
    label:    'Avg Likes',
    tt:       'Average likes per post across last 8 posts',
    icon:     icon('M8 13.5S2 10 2 5.8A3.3 3.3 0 015.3 2.5c1.2 0 2.2.6 2.7 1.5.5-.9 1.5-1.5 2.7-1.5A3.3 3.3 0 0114 5.8C14 10 8 13.5 8 13.5z'),
    getValue: (d) => fmtNum(d?.avgLikes),
  },
  avgComments: {
    label:    'Avg Comments',
    tt:       'Average comments per post across last 8 posts',
    icon:     icon('M14 8.5a5.5 5.5 0 01-8.2 4.8L2.5 14l.7-3.3A5.5 5.5 0 1114 8.5z'),
    getValue: (d) => fmtNum(d?.avgComments),
  },
  estimatedCpm: {
    label:    'Est. CPM',
    tt:       'Estimated cost per 1,000 views',
    icon:     iconCircle(),
    getValue: (d) => d?.estimatedCpm || '—',
  },
  estimatedPostCost: {
    label:    'Post Cost',
    tt:       'Estimated cost per post — avg views × tier rate',
    icon:     iconCircle(),
    getValue: (d) => d?.estimatedPostCost || '—',
  },
  videos: {
    label:    'Total Videos',
    tt:       'Total posts or videos on profile',
    icon:     icon('M1.5 4a1 1 0 011-1h11a1 1 0 011 1v8a1 1 0 01-1 1h-11a1 1 0 01-1-1zM10.5 8l-3.5-2v4z'),
    getValue: (d) => fmtNum(d?.videos),
  },
  niche: {
    label:    'Niche',
    tt:       'Creator category or niche',
    icon:     icon('M8 2a6 6 0 100 12A6 6 0 008 2zM4 8h8'),
    getValue: (d) => d?.niche || '—',
  },
  location: {
    label:    'Location',
    tt:       'Profile location',
    icon:     icon('M8 2a4.5 4.5 0 014.5 4.5c0 3-4.5 7.5-4.5 7.5S3.5 9.5 3.5 6.5A4.5 4.5 0 018 2zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3z'),
    getValue: (d) => d?.location || '—',
  },
};

// ── SVG icon helpers ──────────────────────────────────────────
function icon(d) {
  return `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><path d="${d}"/></svg>`;
}
function iconMulti(paths) {
  return `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0">${paths.map(d => `<path d="${d}"/>`).join('')}</svg>`;
}
function iconCircle() {
  return `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v6M6.5 6.5h2.5a1 1 0 010 2h-2a1 1 0 000 2h3"/></svg>`;
}
function iconBolt() {
  return `<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" style="display:block"><path d="M8.5 1.5L3 9h4l-1 5.5L12 7H8l.5-5.5z"/></svg>`;
}
function iconCopy() {
  return `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M3 10.5h-.5A1 1 0 011.5 9.5v-7A1 1 0 012.5 1.5h7a1 1 0 011 1V3"/></svg>`;
}
function iconCheck(size = 12) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3L13 4.5"/></svg>`;
}
function spinner(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="display:block">
    <circle cx="8" cy="8" r="6" fill="none" stroke="${C.border}" stroke-width="1.5"/>
    <circle cx="8" cy="8" r="6" fill="none" stroke="${C.text}" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="10 30">
      <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite"/>
    </circle>
  </svg>`;
}

// ── Number formatter ──────────────────────────────────────────
function fmtNum(n) {
  if (n == null) return '—';
  const num = typeof n === 'string' ? parseFloat(n.replace(/,/g, '')) : n;
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(num));
}

function platformLabel(p) {
  return p === 'tiktok' ? 'TikTok' : p === 'instagram' ? 'Instagram' : p || '';
}
function platformColor(p) {
  return p === 'tiktok' ? '#ff2d55' : p === 'instagram' ? '#e1306c' : C.textFaint;
}

// ── DOM helper ────────────────────────────────────────────────
function el(tag, style = '', attrs = {}) {
  const node = document.createElement(tag);
  if (style) node.style.cssText = style;
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  return node;
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('root');
  root.innerHTML = '';

  const shell = el('div', `
    width:320px; height:100vh; background:${C.panel};
    border-left:1px solid ${C.border};
    display:flex; flex-direction:column;
    font-family:${UI}; color:${C.text}; font-size:13px; line-height:1.4;
    box-sizing:border-box;
    box-shadow:-1px 0 0 rgba(0,0,0,0.03),-8px 0 32px rgba(40,30,15,0.06);
  `);

  shell.appendChild(buildHeader());
  shell.appendChild(buildBody());
  shell.appendChild(buildFooter());
  root.appendChild(shell);
}

// ── Header ────────────────────────────────────────────────────
function iconSettings() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"/></svg>`;
}
function iconBack() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M10 3L5 8l5 5"/></svg>`;
}
function iconSheet() {
  return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 6h12M2 10h12M6 2v12"/></svg>`;
}
function iconExtLink() {
  return `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M3 9l6-6M4 3h5v5"/></svg>`;
}
function iconCheck2() {
  return `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M3 8.5l3 3L13 4.5"/></svg>`;
}

function buildHeader() {
  const header = el('div', `
    padding:12px 16px;
    border-bottom:1px solid ${C.border};
    display:flex; align-items:center; justify-content:space-between;
    flex-shrink:0; min-height:44px;
  `);

  if (state.view === 'sheets') {
    // Back button + title
    const left = el('div', 'display:flex;align-items:center;gap:8px;');
    const backBtn = el('button', `
      border:none; background:transparent; padding:4px; cursor:pointer;
      color:${C.textDim}; display:flex; align-items:center; border-radius:4px;
    `);
    backBtn.innerHTML = iconBack();
    backBtn.addEventListener('click', () => setState({ view: 'main' }));
    left.appendChild(backBtn);
    const title = el('span', `font-size:13px;font-weight:600;color:${C.text};letter-spacing:-0.2px;`, { text: 'Choose Sheet' });
    left.appendChild(title);
    header.appendChild(left);

    // Active sheet name pill
    if (state.activeSheet) {
      const pill = el('div', `
        font-size:10px; color:${C.textFaint}; font-family:${MONO};
        background:${C.surface}; border:1px solid ${C.border};
        padding:2px 8px; border-radius:20px; max-width:110px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      `, { text: state.activeSheet.name });
      header.appendChild(pill);
    }
    return header;
  }

  // Main view header
  const brand = el('div', 'display:flex;align-items:center;gap:8px;color:' + C.text);
  brand.innerHTML = iconBolt();
  const name = el('span', 'font-size:13px;font-weight:600;letter-spacing:-0.2px;', { text: 'WePullData' });
  brand.appendChild(name);
  header.appendChild(brand);

  const right = el('div', 'display:flex;align-items:center;gap:8px;');

  // Platform badge
  if (state.handle && state.platform) {
    const badge = el('div', `
      display:flex; align-items:center; gap:5px;
      font-size:11px; font-weight:500; letter-spacing:0.3px;
      text-transform:uppercase; color:${C.textDim};
    `);
    const dot = el('span', `width:5px;height:5px;border-radius:50%;background:${platformColor(state.platform)};display:inline-block;`);
    badge.appendChild(dot);
    badge.appendChild(el('span', '', { text: platformLabel(state.platform) }));
    right.appendChild(badge);
  }

  // Settings gear → opens sheet picker
  const gearBtn = el('button', `
    border:none; background:transparent; padding:4px; cursor:pointer;
    color:${C.textFaint}; display:flex; align-items:center; border-radius:4px;
    transition:color .15s;
  `);
  gearBtn.innerHTML = iconSettings();
  gearBtn.title = 'Switch sheet';
  gearBtn.addEventListener('mouseenter', () => { gearBtn.style.color = C.text; });
  gearBtn.addEventListener('mouseleave', () => { gearBtn.style.color = C.textFaint; });
  gearBtn.addEventListener('click', () => {
    setState({ view: 'sheets' });
    if (state.sheetsState === 'idle') fetchSheets();
  });
  right.appendChild(gearBtn);
  header.appendChild(right);

  return header;
}

// ── Body ──────────────────────────────────────────────────────
function buildBody() {
  const body = el('div', 'flex:1;overflow-y:auto;overflow-x:hidden;');

  if (state.view === 'sheets') {
    body.appendChild(buildSheetPicker());
    return body;
  }

  switch (state.uiState) {
    case 'loading':  body.appendChild(buildLoadingState()); break;
    case 'locked':   body.appendChild(buildLockedState());  break;
    case 'notfound': body.appendChild(buildNotFoundState()); break;
    case 'error':    body.appendChild(buildErrorState());   break;
    case 'ready':
      body.appendChild(buildProfileRow());
      body.appendChild(buildDivider());
      body.appendChild(buildStatsGrid());
      break;
  }

  return body;
}

// ── Sheet picker view ─────────────────────────────────────────
function fetchSheets() {
  setState({ sheetsState: 'loading', sheetsError: null });
  window.parent.postMessage({ source: 'livechrome-sidebar', type: 'LIST_SHEETS' }, '*');
}

function buildSheetPicker() {
  const wrap = el('div', 'display:flex;flex-direction:column;');

  // Active sheet info bar
  if (state.activeSheet) {
    const bar = el('div', `
      display:flex; align-items:center; gap:8px; justify-content:space-between;
      padding:10px 16px; background:${C.surface};
      border-bottom:1px solid ${C.border};
    `);
    const left = el('div', 'display:flex;align-items:center;gap:7px;min-width:0;');
    left.innerHTML = iconSheet();
    const label = el('div', 'min-width:0;');
    label.appendChild(el('div', `font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${C.textFaint};`, { text: 'Saving to' }));
    label.appendChild(el('div', `font-size:12px;font-weight:500;color:${C.text};font-family:${MONO};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;`, { text: state.activeSheet.name }));
    left.appendChild(label);
    bar.appendChild(left);
    if (state.activeSheet.url) {
      const link = document.createElement('a');
      link.href = state.activeSheet.url;
      link.target = '_blank';
      link.style.cssText = `color:${C.textFaint};display:flex;`;
      link.innerHTML = iconExtLink();
      bar.appendChild(link);
    }
    wrap.appendChild(bar);
  }

  // Section label + refresh
  const topRow = el('div', `
    display:flex; align-items:center; justify-content:space-between;
    padding:12px 16px 8px;
  `);
  topRow.appendChild(el('span', `font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${C.textFaint};`, { text: 'Your Google Sheets' }));

  const refreshBtn = el('button', `
    border:none; background:transparent; cursor:pointer;
    font-size:11px; color:${C.textFaint}; font-family:${UI};
    padding:2px 0;
  `, { text: 'Refresh' });
  refreshBtn.addEventListener('click', fetchSheets);
  topRow.appendChild(refreshBtn);
  wrap.appendChild(topRow);

  // States
  if (state.sheetsState === 'loading') {
    const loading = el('div', `
      display:flex; flex-direction:column; align-items:center;
      padding:32px 16px; gap:10px;
    `);
    loading.innerHTML = spinner(18);
    loading.appendChild(el('div', `font-size:12px;color:${C.textDim};`, { text: 'Loading your sheets…' }));
    wrap.appendChild(loading);
    return wrap;
  }

  if (state.sheetsState === 'error') {
    const err = el('div', `padding:16px;text-align:center;`);
    err.appendChild(el('div', `font-size:12px;color:${C.textDim};margin-bottom:10px;`, { text: state.sheetsError || 'Could not load sheets' }));
    const retry = el('button', `
      border:1px solid ${C.border}; background:${C.surface};
      color:${C.text}; font-family:${UI}; font-size:12px;
      padding:6px 14px; border-radius:6px; cursor:pointer;
    `, { text: 'Try again' });
    retry.addEventListener('click', fetchSheets);
    err.appendChild(retry);
    wrap.appendChild(err);
    return wrap;
  }

  if (state.sheetsState === 'loaded' && state.sheets.length === 0) {
    wrap.appendChild(el('div', `padding:24px 16px;text-align:center;font-size:12px;color:${C.textFaint};`, { text: 'No Google Sheets found in your Drive.' }));
    return wrap;
  }

  // Sheet list
  if (state.sheets.length > 0) {
    const list = el('div', 'display:flex;flex-direction:column;');
    state.sheets.forEach((sheet, i) => {
      const isActive = state.activeSheet?.id === sheet.id;
      const row = el('div', `
        display:flex; align-items:center; gap:10px;
        padding:10px 16px; cursor:pointer;
        border-bottom:1px solid ${C.borderSoft};
        background:${isActive ? C.surface : 'transparent'};
        transition:background .1s;
      `);
      row.addEventListener('mouseenter', () => { if (!isActive) row.style.background = C.surface; });
      row.addEventListener('mouseleave', () => { if (!isActive) row.style.background = 'transparent'; });
      row.addEventListener('click', () => selectSheet(sheet));

      // Sheet icon
      const iconWrap = el('div', `color:${isActive ? C.text : C.textFaint};display:flex;flex-shrink:0;`);
      iconWrap.innerHTML = iconSheet();
      row.appendChild(iconWrap);

      // Name + modified date
      const info = el('div', 'flex:1;min-width:0;');
      info.appendChild(el('div', `
        font-size:12px; font-weight:${isActive ? '600' : '400'};
        color:${C.text}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      `, { text: sheet.name }));
      if (sheet.modifiedTime) {
        const d = new Date(sheet.modifiedTime);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        info.appendChild(el('div', `font-size:10px;color:${C.textFaint};font-family:${MONO};`, { text: `Modified ${label}` }));
      }
      row.appendChild(info);

      // Checkmark if active, open link otherwise
      const actions = el('div', 'display:flex;align-items:center;gap:6px;flex-shrink:0;');
      if (isActive) {
        const check = el('div', `color:${C.text};display:flex;`);
        check.innerHTML = iconCheck2();
        actions.appendChild(check);
      }
      if (sheet.url) {
        const link = document.createElement('a');
        link.href = sheet.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = `color:${C.textFaint};display:flex;`;
        link.innerHTML = iconExtLink();
        link.addEventListener('click', e => e.stopPropagation());
        actions.appendChild(link);
      }
      row.appendChild(actions);

      list.appendChild(row);
    });
    wrap.appendChild(list);
  }

  // Hint at bottom
  wrap.appendChild(el('div', `
    padding:12px 16px; font-size:11px; color:${C.textFaint}; line-height:1.4;
    border-top:1px solid ${C.borderSoft}; margin-top:auto;
  `, { text: 'Tap a sheet to save creators into it. Changes take effect immediately.' }));

  return wrap;
}

function selectSheet(sheet) {
  setState({ activeSheet: sheet, view: 'main' });
  // Persist to chrome.storage via content.js proxy
  window.parent.postMessage({
    source: 'livechrome-sidebar',
    type:   'SET_ACTIVE_SHEET',
    sheet,
  }, '*');
}

// ── Profile row — handle + copy button ───────────────────────
function buildProfileRow() {
  const row = el('div', 'padding:14px 16px 12px;');

  const handleBtn = el('button', `
    border:none; background:transparent; padding:0; cursor:pointer;
    display:flex; align-items:center; gap:6px; color:${C.text};
    font-family:${MONO}; font-size:15px; font-weight:500; letter-spacing:-0.2px;
  `);

  const handleText = el('span', '', { text: '@' + (state.handle || 'handle') });
  const copyWrap   = el('span', `color:${C.textFaint};display:flex;`, { html: iconCopy() });

  handleBtn.appendChild(handleText);
  handleBtn.appendChild(copyWrap);

  handleBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText('@' + state.handle).catch(() => {});
    copyWrap.innerHTML = iconCheck(12);
    copyWrap.style.color = C.text;
    setTimeout(() => {
      copyWrap.innerHTML = iconCopy();
      copyWrap.style.color = C.textFaint;
    }, 1400);
  });

  row.appendChild(handleBtn);
  return row;
}

// ── Stats grid — 2 columns, design-spec tile ─────────────────
function buildStatsGrid() {
  const wrap = el('div', 'padding:4px 12px 12px;');

  // Section label
  const label = el('div', `
    font-size:10px; font-weight:600; letter-spacing:1.4px;
    text-transform:uppercase; color:${C.textFaint};
    padding:10px 4px 8px;
  `, { text: 'Stats' });
  wrap.appendChild(label);

  const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:8px;');

  // Only render tiles for fields the user selected that have a matching config
  const fieldsToRender = state.fields.filter(key => FIELD_CONFIG[key]);

  if (fieldsToRender.length === 0) {
    const empty = el('div', `
      grid-column:1/-1; padding:24px 12px; text-align:center;
      font-size:12px; color:${C.textFaint};
    `, { text: 'No fields selected — update your preferences in the dashboard.' });
    grid.appendChild(empty);
  } else {
    fieldsToRender.forEach(key => {
      const cfg = FIELD_CONFIG[key];
      const value = cfg.getValue(state.data);
      grid.appendChild(buildStatTile(cfg.icon, cfg.label, cfg.tt, value));
    });
  }

  wrap.appendChild(grid);
  return wrap;
}

// ── Stat tile — exact design spec ────────────────────────────
function buildStatTile(iconHtml, label, tooltip, value) {
  const tile = el('div', `
    padding:12px 12px 11px;
    background:${C.surface};
    border:1px solid ${C.border};
    border-radius:6px;
    cursor:default;
    transition:background .12s, border-color .12s;
  `);

  tile.addEventListener('mouseenter', () => {
    tile.style.background = C.surface2;
    tile.style.borderColor = '#d4cfc5';
    if (tooltip) showTooltip(tooltip);
  });
  tile.addEventListener('mouseleave', () => {
    tile.style.background = C.surface;
    tile.style.borderColor = C.border;
    hideTooltip();
  });

  // Icon + label row
  const labelRow = el('div', `
    display:flex; align-items:center; gap:5px;
    color:${C.textFaint}; font-size:10px; font-weight:500;
    letter-spacing:0.5px; text-transform:uppercase;
    margin-bottom:6px; white-space:nowrap; overflow:hidden;
  `);
  labelRow.innerHTML = iconHtml;
  const labelText = el('span', 'overflow:hidden;text-overflow:ellipsis;', { text: label });
  labelRow.appendChild(labelText);

  // Value
  const valueEl = el('div', `
    font-family:${MONO}; font-size:18px; font-weight:500;
    color:${C.text}; letter-spacing:-0.5px; line-height:1;
  `, { text: value || '—' });

  tile.appendChild(labelRow);
  tile.appendChild(valueEl);
  return tile;
}

// ── Tooltip bar ───────────────────────────────────────────────
let tooltipEl = null;

function showTooltip(text) {
  if (!tooltipEl) return;
  tooltipEl.textContent = text;
  tooltipEl.style.color = C.textDim;
}
function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.textContent = '·';
  tooltipEl.style.color = 'transparent';
}

// ── Footer — save button + tooltip bar ───────────────────────
function buildFooter() {
  const footer = el('div', `margin-top:auto;border-top:1px solid ${C.border};flex-shrink:0;`);

  // Tooltip bar
  tooltipEl = el('div', `
    padding:6px 12px; min-height:26px;
    font-size:11px; color:transparent;
    border-top:1px solid ${C.borderSoft};
    transition:color .12s; font-style:italic;
  `, { text: '·' });
  footer.appendChild(tooltipEl);

  // Active sheet indicator — shows which sheet the save will go into
  if (state.activeSheet && state.view === 'main') {
    const sheetBar = el('div', `
      display:flex; align-items:center; justify-content:space-between;
      padding:6px 14px; border-top:1px solid ${C.borderSoft};
    `);
    const left = el('div', 'display:flex;align-items:center;gap:6px;min-width:0;');
    const iconWrap = el('div', `color:${C.textFaint};display:flex;flex-shrink:0;`);
    iconWrap.innerHTML = iconSheet();
    left.appendChild(iconWrap);
    left.appendChild(el('span', `font-size:11px;color:${C.textDim};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;`, { text: state.activeSheet.name }));
    sheetBar.appendChild(left);

    const switchBtn = el('button', `
      border:none; background:transparent; cursor:pointer;
      font-size:11px; color:${C.textFaint}; font-family:${UI};
      flex-shrink:0; padding:0;
    `, { text: 'Switch' });
    switchBtn.addEventListener('click', () => {
      setState({ view: 'sheets' });
      if (state.sheetsState === 'idle') fetchSheets();
    });
    sheetBar.appendChild(switchBtn);
    footer.appendChild(sheetBar);
  }

  const padded = el('div', 'padding:0 14px 14px;');
  padded.appendChild(buildSaveButton());
  footer.appendChild(padded);

  return footer;
}

function buildSaveButton() {
  const s = state.saveState;

  const disabled = s !== 'idle' || state.uiState !== 'ready';
  const bg    = s === 'saving' ? C.surface : s === 'error' ? 'oklch(0.58 0.11 25)' : C.text;
  const color = s === 'saving' ? C.textDim : C.panel;
  const label = s === 'saving' ? 'Saving…'
              : s === 'saved'  ? 'Saved to Sheet'
              : s === 'error'  ? 'Error — try again'
              : 'Save to Sheet';

  const btn = el('button', `
    width:100%; height:40px; border:none; border-radius:6px;
    background:${disabled && s === 'idle' ? C.surface : bg};
    color:${disabled && s === 'idle' ? C.textFaint : color};
    cursor:${s === 'idle' && !disabled ? 'pointer' : 'default'};
    font-family:${UI}; font-size:13px; font-weight:600; letter-spacing:0.2px;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:background .15s, color .15s, opacity .15s;
    border:${disabled && s === 'idle' ? '1px solid ' + C.border : 'none'};
  `);
  btn.disabled = disabled;

  if (s === 'saving') {
    btn.innerHTML = spinner(12) + '<span>Saving…</span>';
  } else if (s === 'saved') {
    btn.innerHTML = iconCheck(13) + '<span>Saved to Sheet</span>';
  } else {
    btn.textContent = label;
  }

  if (!disabled) {
    btn.addEventListener('mousedown', () => { btn.style.transform = 'scale(0.99)'; });
    btn.addEventListener('mouseup',   () => { btn.style.transform = ''; });
    btn.addEventListener('mouseleave',() => { btn.style.transform = ''; });
    btn.addEventListener('click', () => {
      window.parent.postMessage({ source: 'livechrome-sidebar', type: 'SAVE_TO_SHEET' }, '*');
    });
  }

  return btn;
}

// ── Empty / error states ──────────────────────────────────────
function buildLoadingState() {
  const wrap = el('div', `
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:40px 24px; gap:14px;
  `);
  wrap.innerHTML = spinner(22);

  const msg = el('div', `font-size:12px;color:${C.textDim};text-align:center;`, { text: 'Scraping profile data…' });
  const sub = el('div', `font-family:${MONO};font-size:10px;color:${C.textFaint};letter-spacing:0.3px;text-align:center;`);
  sub.textContent = '→ fetching stats…';

  // Cycle through log lines
  const lines = ['→ fetching profile…', '→ parsing last 8 posts…', '→ computing engagement…'];
  let i = 0;
  const t = setInterval(() => { sub.textContent = lines[i++ % lines.length]; }, 900);
  // Clean up interval when state changes by checking on next render
  sub._interval = t;

  wrap.appendChild(msg);
  wrap.appendChild(sub);
  return wrap;
}

function buildLockedState() {
  const wrap = el('div', `
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:40px 28px; gap:16px; text-align:center;
  `);

  const iconWrap = el('div', `
    width:44px; height:44px; border-radius:22px;
    background:${C.surface}; color:${C.textDim};
    display:flex; align-items:center; justify-content:center;
  `);
  iconWrap.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;

  const title = el('div', `font-size:14px;font-weight:600;color:${C.text};letter-spacing:-0.2px;`, { text: 'No active subscription' });
  const desc  = el('div', `font-size:12px;color:${C.textDim};line-height:1.5;`, { text: 'Get access at wepulldata.com to use this extension.' });

  const link = document.createElement('a');
  link.href = 'https://wepulldata.com';
  link.target = '_blank';
  link.textContent = 'Get access';
  link.style.cssText = `
    display:inline-block; padding:8px 18px;
    background:${C.text}; color:${C.panel};
    border-radius:6px; font-size:12px; font-weight:600;
    text-decoration:none; margin-top:4px;
  `;

  wrap.appendChild(iconWrap);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  wrap.appendChild(link);
  return wrap;
}

function buildNotFoundState() {
  const wrap = el('div', `
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:40px 28px; gap:14px; text-align:center;
  `);

  const iconWrap = el('div', `
    width:44px; height:44px; border-radius:22px;
    background:${C.surface}; color:${C.textDim};
    display:flex; align-items:center; justify-content:center;
  `);
  iconWrap.innerHTML = `<svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5"/></svg>`;

  const title = el('div', `font-size:14px;font-weight:600;color:${C.text};letter-spacing:-0.2px;`, { text: 'Profile not found' });
  const desc  = el('div', `font-size:12px;color:${C.textDim};line-height:1.5;`, { text: 'Navigate to a TikTok or Instagram profile page.' });

  wrap.appendChild(iconWrap);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  return wrap;
}

function buildErrorState() {
  const wrap = el('div', `
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:40px 28px; gap:14px; text-align:center;
  `);

  const iconWrap = el('div', `
    width:44px; height:44px; border-radius:22px;
    background:${C.surface}; color:oklch(0.58 0.11 25);
    display:flex; align-items:center; justify-content:center;
  `);
  iconWrap.innerHTML = `<svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5"/></svg>`;

  const msg = el('div', `font-size:12px;color:${C.textDim};`, { text: state.error || 'Something went wrong' });

  const retryBtn = el('button', `
    margin-top:4px; height:32px; padding:0 14px;
    border:1px solid ${C.border}; border-radius:6px;
    background:${C.surface}; color:${C.text};
    font-family:${UI}; font-size:12px; font-weight:500; cursor:pointer;
  `, { text: 'Retry' });
  retryBtn.addEventListener('click', () => {
    setState({ uiState: 'loading', error: null });
    // Signal content.js to re-init
    window.parent.postMessage({ source: 'livechrome-sidebar', type: 'RETRY' }, '*');
  });

  wrap.appendChild(iconWrap);
  wrap.appendChild(msg);
  wrap.appendChild(retryBtn);
  return wrap;
}

function buildDivider() {
  return el('div', `height:1px;background:${C.border};`);
}

// ── Message listener — receives from content.js ───────────────
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'SET_PAGE':
      if (msg.page) setState({ handle: msg.page.handle, platform: msg.page.platform });
      break;
    case 'SET_STATE':
      setState({ uiState: msg.state, error: msg.error || null });
      break;
    case 'SET_FIELDS':
      if (Array.isArray(msg.fields) && msg.fields.length > 0) {
        setState({ fields: msg.fields });
      }
      break;
    case 'SET_DATA':
      setState({ data: msg.data, handle: msg.handle || state.handle, platform: msg.platform || state.platform });
      break;
    case 'SAVE_STATE':
      setState({ saveState: msg.state });
      break;

    // Sheet picker responses
    case 'SHEETS_LOADED':
      setState({ sheets: msg.sheets || [], sheetsState: 'loaded', sheetsError: null });
      break;
    case 'SHEETS_ERROR':
      setState({ sheetsState: 'error', sheetsError: msg.error || 'Failed to load sheets' });
      break;
    case 'ACTIVE_SHEET_LOADED':
      if (msg.sheet) setState({ activeSheet: msg.sheet });
      break;
  }
});

// ── Boot ──────────────────────────────────────────────────────
render();

// Signal to content.js that the sidebar iframe is ready to receive messages
window.parent.postMessage({ type: 'SIDEBAR_READY' }, '*');
