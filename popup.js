// popup.js  v1.4

const toggle       = document.getElementById('toggle');
const statusPill   = document.getElementById('status');
const statusText   = document.getElementById('status-text');
const modeSection  = document.getElementById('mode-section');
const modeButtons  = document.querySelectorAll('.mode-btn');
const previewAfter = document.getElementById('preview-after');

const PREVIEWS = {
  'name-only':  'Front End Development Frameworks - Practical - S-1 -RoomNo-C110',
  'code+name':  'Front End Development Frameworks (25CS2101L) - Practical - S-1 -RoomNo-C110'
};

function applyUI(enabled, mode) {
  // Toggle switch
  toggle.checked = enabled;

  // Status pill
  if (enabled) {
    statusPill.className = 'status-pill on';
    statusText.textContent = 'Active — codes are replaced';
  } else {
    statusPill.className = 'status-pill off';
    statusText.textContent = 'OFF — original codes shown';
  }

  // Mode section dimmed when disabled
  modeSection.style.opacity        = enabled ? '1' : '0.4';
  modeSection.style.pointerEvents  = enabled ? 'auto' : 'none';

  // Highlight correct mode button
  modeButtons.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === mode)
  );

  // Update preview
  previewAfter.textContent = PREVIEWS[mode] ?? PREVIEWS['name-only'];
}

// ── Load saved state on popup open ────────────────────────────────────────
chrome.storage.local.get({ enabled: true, mode: 'name-only' }, ({ enabled, mode }) => {
  applyUI(enabled, mode);
});

// ── ON/OFF toggle ──────────────────────────────────────────────────────────
toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.get({ mode: 'name-only' }, ({ mode }) => {
    chrome.storage.local.set({ enabled }, () => applyUI(enabled, mode));
  });
});

// ── Mode buttons ───────────────────────────────────────────────────────────
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const newMode = btn.dataset.mode;
    chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
      chrome.storage.local.set({ mode: newMode }, () => applyUI(enabled, newMode));
    });
  });
});
