// popup.js  v2.0

const toggle       = document.getElementById('toggle');
const statusPill   = document.getElementById('status');
const statusText   = document.getElementById('status-text');
const modeSection  = document.getElementById('mode-section');
const modeButtons  = document.querySelectorAll('.mode-btn');
const previewAfter = document.getElementById('preview-after');

const PREVIEWS = {
  'name-only': `
    <div class="pv-card">
      <div class="pv-title">Front End Development Frameworks for Web Applications</div>
      <div class="pv-badges">
        <span class="pv-badge pv-badge-practical">Practical</span>
        <span class="pv-badge pv-badge-room">📍 Room C307</span>
        <span class="pv-badge pv-badge-sec">S-1</span>
      </div>
    </div>
  `,
  'code+name': `
    <div class="pv-card">
      <div class="pv-title">Front End Development Frameworks for Web Applications</div>
      <div class="pv-code">25CS2101L</div>
      <div class="pv-badges">
        <span class="pv-badge pv-badge-practical">Practical</span>
        <span class="pv-badge pv-badge-room">📍 Room C307</span>
        <span class="pv-badge pv-badge-sec">S-1</span>
      </div>
    </div>
  `
};

function applyUI(enabled, mode) {
  // Toggle switch
  toggle.checked = enabled;

  // Status pill
  if (enabled) {
    statusPill.className = 'status-pill on';
    statusText.textContent = 'Active — timetable formatted';
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
  previewAfter.innerHTML = PREVIEWS[mode] || PREVIEWS['name-only'];
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
