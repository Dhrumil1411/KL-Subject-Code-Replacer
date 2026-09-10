// KL University ERP – Subject Code Replacer v1.6
// Robust error handling, safe DOM targets, guarded observer lifecycle.

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

  // ── 3. matchCode ───────────────────────────────────────────────────────────
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

  // ── 4. LTPS expansion ──────────────────────────────────────────────────────
  const LTPS = { L: 'Lecture', T: 'Tutorial', P: 'Practical', S: 'Skilling' };

  function expandSuffix(suffix) {
    if (!suffix) return '';
    return suffix.replace(/^-([LTPS])(?=[\s\-]|$)/i, (_, letter) => {
      const full = LTPS[letter.toUpperCase()];
      return full ? ` - ${full}` : `-${letter}`;
    });
  }

  // ── 5. Build display text ──────────────────────────────────────────────────
  function buildText(originalCode, name, suffix, displayMode) {
    const safeCode = originalCode || '';
    const safeName = name || '';
    const expanded = expandSuffix(suffix || '');
    return displayMode === 'code+name'
      ? `${safeName} (${safeCode})${expanded}`
      : `${safeName}${expanded}`;
  }

  // ── 6. Cell tracking Map ───────────────────────────────────────────────────
  const processedCells = new Map();

  function processCell(td) {
    if (!td) return false;
    if (processedCells.has(td)) {
      const d = processedCells.get(td);
      if (d) {
        td.textContent = buildText(d.originalCode, d.name, d.suffix, state.mode);
        return true;
      }
    }

    const text = (td.textContent || '').trim();
    if (!text || text === '-') return false;

    const codeKey = matchCode(text);
    if (!codeKey || !lookup[codeKey]) return false;

    const { name, originalCode } = lookup[codeKey];
    const suffix = text.slice(originalCode ? originalCode.length : codeKey.length) || '';

    processedCells.set(td, { original: text, originalCode, name, suffix });
    td.textContent = buildText(originalCode, name, suffix, state.mode);
    return true;
  }

  function processTables() {
    if (!state.enabled) return 0;
    let n = 0;
    const tds = document.querySelectorAll('table td');
    for (const td of tds) {
      if (processCell(td)) n++;
    }
    return n;
  }

  function restoreAll() {
    for (const [td, d] of processedCells) {
      if (td && d && d.original !== undefined) {
        td.textContent = d.original;
      }
    }
    processedCells.clear();
  }

  function reapplyAll() {
    for (const [td, d] of processedCells) {
      if (td && d) {
        td.textContent = buildText(d.originalCode, d.name, d.suffix, state.mode);
      }
    }
  }

  // ── 7. MutationObserver & Safe Lifecycle ───────────────────────────────────
  const observer = new MutationObserver(() => {
    if (state.enabled) processTables();
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
    if (observer) {
      try {
        observer.disconnect();
      } catch (e) {}
    }
  }

  // ── 8. Storage-change listener ─────────────────────────────────────────────
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

  // ── 9. Bootstrap ───────────────────────────────────────────────────────────
  if (!state.enabled) return;

  let attempts = 0;
  function tryReplace() {
    if (!state.enabled) return;
    const n = processTables();
    if (n > 0) {
      console.log(`[KL Replacer] ✓ ${n} cell(s) replaced (attempt ${attempts + 1})`);
    }
    if (++attempts < 30) {
      setTimeout(tryReplace, 500);
    }
  }

  // Run on ready
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
