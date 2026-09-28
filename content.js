// KL University ERP – Subject Code Replacer v2.0
// Formatted visual cards with color-coded session badges & prominent room indicators.

(async () => {

  // ── 1. Load subject codes ──────────────────────────────────────────────────
  let subjectMap;
  try {
    const res = await fetch(chrome.runtime.getURL('subject_codes.json'));
    subjectMap = await res.json();
  } catch (err) {
    console.error('[KL Replacer] Could not load subject_codes.json:', err);
    return;
  }

  // UPPERCASE lookup: "25CS2101L" -> { name, originalCode }
  const lookup = {};
  for (const [code, name] of Object.entries(subjectMap || {})) {
    if (code) {
      lookup[code.trim().toUpperCase()] = { name, originalCode: code.trim() };
    }
  }
  // Longest-first so "25CS2101L" matches before shorter prefixes
  const allCodes = Object.keys(lookup).sort((a, b) => b.length - a.length);

  // ── 2. Shared mutable state ────────────────────────────────────────────────
  const state = { enabled: true, mode: 'name-only' };
  let isProcessing = false;

  await new Promise(resolve => {
    try {
      chrome.storage.local.get({ enabled: true, mode: 'name-only' }, (res) => {
        if (res) {
          if (res.enabled !== undefined) state.enabled = Boolean(res.enabled);
          if (res.mode !== undefined) state.mode = String(res.mode);
        }
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });

  // ── 3. Inject CSS Styles ───────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('kl-replacer-style')) return;
    const style = document.createElement('style');
    style.id = 'kl-replacer-style';
    style.textContent = `
      .kl-cell-card {
        display: flex !important;
        flex-direction: column !important;
        gap: 5px !important;
        padding: 5px 3px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 11.5px !important;
        line-height: 1.35 !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
      .kl-subject-name {
        font-weight: 700 !important;
        color: #0f172a !important;
        font-size: 11.5px !important;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        line-height: 1.3 !important;
      }
      .kl-subject-code {
        font-size: 10px !important;
        color: #475569 !important;
        font-weight: 600 !important;
        letter-spacing: 0.03em !important;
        margin-top: -2px !important;
      }
      .kl-badges-container {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 4px !important;
        justify-content: center !important;
        align-items: center !important;
        margin-top: 2px !important;
      }
      .kl-badge {
        display: inline-flex !important;
        align-items: center !important;
        padding: 2.5px 7px !important;
        border-radius: 5px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        letter-spacing: 0.02em !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
      }
      /* Color-coded session badges */
      .kl-badge-lecture {
        background: #e0e7ff !important;
        color: #3730a3 !important;
        border: 1px solid #c7d2fe !important;
      }
      .kl-badge-tutorial {
        background: #fef3c7 !important;
        color: #92400e !important;
        border: 1px solid #fde68a !important;
      }
      .kl-badge-practical {
        background: #dcfce7 !important;
        color: #166534 !important;
        border: 1px solid #bbf7d0 !important;
      }
      .kl-badge-skilling {
        background: #f3e8ff !important;
        color: #6b21a8 !important;
        border: 1px solid #e9d5ff !important;
      }
      /* High-contrast Room badge */
      .kl-badge-room {
        background: #fee2e2 !important;
        color: #991b1b !important;
        border: 1px solid #fca5a5 !important;
        font-weight: 800 !important;
      }
      /* Section badge */
      .kl-badge-section {
        background: #f1f5f9 !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── 4. Match & Parse Cell ──────────────────────────────────────────────────
  function matchCode(cellText) {
    if (!cellText) return null;
    const upper = cellText.toUpperCase();
    for (const code of allCodes) {
      if (upper.startsWith(code)) {
        const next = upper[code.length];
        if (next === undefined || next === '-' || next === ' ' || next === '\t' || next === '\n') {
          return code;
        }
      }
    }
    return null;
  }

  const LTPS = { L: 'Lecture', T: 'Tutorial', P: 'Practical', S: 'Skilling' };

  function parseCellData(originalCode, name, suffix) {
    // Session Type (Lecture / Tutorial / Practical / Skilling)
    const typeMatch = suffix.match(/-([LTPS])(?=[\s\-]|$)/i);
    const typeLetter = typeMatch ? typeMatch[1].toUpperCase() : null;
    const typeName = typeLetter ? (LTPS[typeLetter] || null) : null;

    // Section (e.g. S-1)
    const secMatch = suffix.match(/S-(\d+)/i);
    const section = secMatch ? `S-${secMatch[1]}` : null;

    // Room Number (e.g. M121, C307, S914, C221B2)
    const roomMatch = suffix.match(/RoomNo[-\s:]*([A-Za-z0-9]+)/i);
    const room = roomMatch ? roomMatch[1] : null;

    return { originalCode, name, typeName, section, room };
  }

  function renderHTML(data, displayMode) {
    const { originalCode, name, typeName, section, room } = data;
    let badgesHtml = '';

    if (typeName) {
      const typeClass = `kl-badge-${typeName.toLowerCase()}`;
      badgesHtml += `<span class="kl-badge ${typeClass}">${typeName}</span>`;
    }

    if (room) {
      badgesHtml += `<span class="kl-badge kl-badge-room"> Room ${room}</span>`;
    }

    if (section) {
      badgesHtml += `<span class="kl-badge kl-badge-section">${section}</span>`;
    }

    const codeHtml = (displayMode === 'code+name' && originalCode)
      ? `<div class="kl-subject-code">${originalCode}</div>`
      : '';

    return `
      <div class="kl-cell-card">
        <div class="kl-subject-name">${name}</div>
        ${codeHtml}
        ${badgesHtml ? `<div class="kl-badges-container">${badgesHtml}</div>` : ''}
      </div>
    `.trim();
  }

  // ── 5. Cell tracking Map ───────────────────────────────────────────────────
  // Map<td, { originalHTML, originalText, parsedData }>
  const processedCells = new Map();

  function processCell(td) {
    if (!td) return false;
    if (processedCells.has(td)) return false;

    const text = (td.textContent || '').trim();
    if (!text || text === '-') return false;

    const codeKey = matchCode(text);
    if (!codeKey || !lookup[codeKey]) return false;

    const { name, originalCode } = lookup[codeKey];
    const suffix = text.slice(originalCode ? originalCode.length : codeKey.length) || '';
    const parsedData = parseCellData(originalCode, name, suffix);

    processedCells.set(td, {
      originalHTML: td.innerHTML,
      originalText: text,
      parsedData
    });

    td.innerHTML = renderHTML(parsedData, state.mode);
    return true;
  }

  function processTables() {
    if (!state.enabled || isProcessing) return 0;
    if (!document.querySelector('table')) return 0;

    injectStyles();
    isProcessing = true;
    let n = 0;
    try {
      const tds = document.querySelectorAll('table td');
      for (const td of tds) {
        if (processCell(td)) n++;
      }
    } finally {
      isProcessing = false;
    }
    return n;
  }

  function restoreAll() {
    isProcessing = true;
    try {
      for (const [td, d] of processedCells) {
        if (td && d) {
          td.innerHTML = d.originalHTML || d.originalText;
        }
      }
      processedCells.clear();
    } finally {
      isProcessing = false;
    }
  }

  function reapplyAll() {
    isProcessing = true;
    try {
      injectStyles();
      for (const [td, d] of processedCells) {
        if (td && d && d.parsedData) {
          td.innerHTML = renderHTML(d.parsedData, state.mode);
        }
      }
    } finally {
      isProcessing = false;
    }
  }

  // ── 6. Debounced MutationObserver (Prevents CPU lockups) ───────────────────
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (!state.enabled || isProcessing) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processTables();
    }, 200);
  });

  function startObserver() {
    stopObserver();
    const target = document.body || document.documentElement;
    if (target && observer) {
      try {
        observer.observe(target, { childList: true, subtree: true });
      } catch (e) {
        console.warn('[KL Replacer] Could not start observer:', e);
      }
    }
  }

  function stopObserver() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (observer) {
      try {
        observer.disconnect();
      } catch (e) {}
    }
  }

  // ── 7. Storage-change listener ─────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName && areaName !== 'local') return;

    if (changes && changes.enabled && changes.enabled.newValue !== undefined) {
      state.enabled = Boolean(changes.enabled.newValue);
    }
    if (changes && changes.mode && changes.mode.newValue !== undefined) {
      state.mode = String(changes.mode.newValue);
    }

    if (!state.enabled) {
      restoreAll();
      stopObserver();
    } else {
      reapplyAll();
      processTables();
      startObserver();
    }
  });

  // ── 8. Bootstrap ───────────────────────────────────────────────────────────
  if (!state.enabled) return;

  let attempts = 0;
  function tryReplace() {
    if (!state.enabled) return;
    const n = processTables();
    if (n > 0) {
      console.log(`[KL Replacer] ✓ ${n} cell(s) formatted (attempt ${attempts + 1})`);
    }
    attempts++;
    if (attempts < 20) {
      setTimeout(tryReplace, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tryReplace();
      startObserver();
    }, { once: true });
  } else {
    tryReplace();
    startObserver();
  }

})();
