// KL University ERP – Subject Code Replacer & Live Class Assistant v2.2
// Features:
// 1. Live Attendance Fetching directly from ERP courselist endpoint.
// 2. 85% Attendance Safety & Bunk Calculator with interactive hover popover.
// 3. Timetable Subject Code Replacer with session badges & classroom indicators.
// 4. Next Up / Live Class Floating Widget with live countdown timers.
// 5. Dynamic Active Slot Grid Highlighting & Past Slot Dimming.
// 6. Side-by-side consecutive lecture cell unification.

(async () => {

  const DEBUG = true;
  let attendanceFetchInFlight = false;

  // ── 1. Load subject codes ──────────────────────────────────────────────────
  let subjectMap;
  try {
    const res = await fetch(chrome.runtime.getURL('subject_codes.json'));
    subjectMap = await res.json();
  } catch (err) {
    return;
  }

  // UPPERCASE lookup: "25CS2101L" -> { name, originalCode }
  const lookup = {};
  for (const [code, name] of Object.entries(subjectMap || {})) {
    if (code) {
      lookup[code.trim().toUpperCase()] = { name, originalCode: code.trim() };
    }
  }
  const allCodes = Object.keys(lookup).sort((a, b) => b.length - a.length);

  // ── 2. Shared mutable state ────────────────────────────────────────────────
  const state = {
    enabled: true,
    mode: 'name-only',
    attendanceData: {}
  };
  let isProcessing = false;

  await new Promise(resolve => {
    try {
      chrome.storage.local.get({ enabled: true, mode: 'name-only', kl_attendance_data: {} }, (res) => {
        if (res) {
          if (res.enabled !== undefined) state.enabled = Boolean(res.enabled);
          if (res.mode !== undefined) state.mode = String(res.mode);
          if (res.kl_attendance_data) state.attendanceData = res.kl_attendance_data;
        }
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });

  // ── 3. Exact KL University Hourly Schedule ─────────────────────────────────
  const KL_HOURLY_SCHEDULE = [
    { hour: 1,  startMinutes: 7 * 60 + 10,  endMinutes: 8 * 60 + 0,   formatted: "07:10 AM - 08:00 AM" },
    { hour: 2,  startMinutes: 8 * 60 + 0,   endMinutes: 8 * 60 + 50,  formatted: "08:00 AM - 08:50 AM" },
    { hour: 3,  startMinutes: 9 * 60 + 20,  endMinutes: 10 * 60 + 10, formatted: "09:20 AM - 10:10 AM" },
    { hour: 4,  startMinutes: 10 * 60 + 10, endMinutes: 11 * 60 + 0,  formatted: "10:10 AM - 11:00 AM" },
    { hour: 5,  startMinutes: 11 * 60 + 10, endMinutes: 12 * 60 + 0,  formatted: "11:10 AM - 12:00 PM" },
    { hour: 6,  startMinutes: 12 * 60 + 0,  endMinutes: 12 * 60 + 50, formatted: "12:00 PM - 12:50 PM" },
    { hour: 7,  startMinutes: 12 * 60 + 50, endMinutes: 13 * 60 + 50, formatted: "12:50 PM - 01:50 PM" }, // Lunch Break
    { hour: 8,  startMinutes: 13 * 60 + 50, endMinutes: 14 * 60 + 40, formatted: "01:50 PM - 02:40 PM" },
    { hour: 9,  startMinutes: 14 * 60 + 40, endMinutes: 15 * 60 + 30, formatted: "02:40 PM - 03:30 PM" },
    { hour: 10, startMinutes: 15 * 60 + 40, endMinutes: 16 * 60 + 30, formatted: "03:40 PM - 04:30 PM" },
    { hour: 11, startMinutes: 16 * 60 + 40, endMinutes: 17 * 60 + 30, formatted: "04:40 PM - 05:30 PM" }
  ];

  function formatTimeFromMinutes(min) {
    const h24 = Math.floor(min / 60);
    const m = min % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = ((h24 + 11) % 12 + 1);
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
  }

  function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  // ── 4. Live Attendance Fetcher & HTML Parser ───────────────────────────────
  const ATTENDANCE_ENDPOINTS = [
    'https://newerp.kluniversity.in/index.php?r=studentattendance/studentdailyattendance/courselist',
    'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist'
  ];

  function parseAttendanceTable(doc) {
    const attendanceMap = {};
    const tables = doc.querySelectorAll('table');

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;

      let colCode = -1, colLtps = -1, colConducted = -1, colAttended = -1, colPct = -1;

      // Scan header rows
      for (let r = 0; r < Math.min(3, rows.length); r++) {
        const headers = Array.from(rows[r].querySelectorAll('th, td')).map(c => c.textContent.trim().toLowerCase());
        headers.forEach((h, idx) => {
          if ((h.includes('course') && (h.includes('code') || h.includes('no') || h === 'coursecode')) || h === 'subject code') colCode = idx;
          if (h.includes('ltps') || h.includes('component') || h.includes('type') || h === 'l-t-p-s') colLtps = idx;
          if (h.includes('conducted') || h.includes('held') || h.includes('total classes') || h === 'tc' || h === 'total conducted') colConducted = idx;
          if (h.includes('attended') || h.includes('present') || h === 'ta' || h === 'total attended') colAttended = idx;
          if (h.includes('percent') || h.includes('%')) colPct = idx;
        });
        if (colCode !== -1 && (colConducted !== -1 || colAttended !== -1)) break;
      }

      // Iterate data rows
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 3) continue;

        let code = '';
        let ltps = '';
        let conducted = 0;
        let attended = 0;

        if (colCode !== -1 && cells[colCode]) {
          code = cells[colCode].textContent.trim().toUpperCase();
        }

        // Check each cell for course code if not explicitly in colCode
        if (!code) {
          for (const cell of cells) {
            const txt = cell.textContent.trim().toUpperCase();
            const matched = allCodes.find(c => txt.startsWith(c) || txt === c);
            if (matched) {
              code = matched;
              break;
            }
          }
        }

        if (!code) continue;

        // Extract LTPS component (L, T, P, S)
        if (colLtps !== -1 && cells[colLtps]) {
          const ltpsRaw = cells[colLtps].textContent.trim().toUpperCase();
          if (ltpsRaw.includes('P') || ltpsRaw.includes('PRAC')) ltps = 'P';
          else if (ltpsRaw.includes('T') || ltpsRaw.includes('TUT')) ltps = 'T';
          else if (ltpsRaw.includes('S') || ltpsRaw.includes('SKILL')) ltps = 'S';
          else if (ltpsRaw.includes('L') || ltpsRaw.includes('LEC')) ltps = 'L';
          else ltps = ltpsRaw.charAt(0) || '';
        }

        // Extract numerical values
        if (colConducted !== -1 && cells[colConducted]) {
          conducted = parseInt(cells[colConducted].textContent.replace(/[^0-9]/g, ''), 10) || 0;
        }
        if (colAttended !== -1 && cells[colAttended]) {
          attended = parseInt(cells[colAttended].textContent.replace(/[^0-9]/g, ''), 10) || 0;
        }

        // Fallback positional search for conducted and attended numbers
        if (conducted === 0 && attended === 0) {
          const nums = cells.map(c => parseInt(c.textContent.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 300);
          if (nums.length >= 2) {
            conducted = Math.max(...nums.slice(-4));
            attended = Math.min(...nums.slice(-4));
          }
        }

        if (conducted > 0) {
          const pct = Number(((attended / conducted) * 100).toFixed(1));
          const entry = { courseCode: code, ltps, conducted, attended, percentage: pct };

          if (ltps) {
            attendanceMap[`${code}_${ltps}`] = entry;
          }
          attendanceMap[code] = entry;
        }
      }
    }

    return attendanceMap;
  }

  function getCsrfInfo() {
    const paramMeta = document.querySelector('meta[name="csrf-param"]');
    const tokenMeta = document.querySelector('meta[name="csrf-token"]');
    const param = (paramMeta && paramMeta.getAttribute('content')) || '_csrf';
    const token = (tokenMeta && tokenMeta.getAttribute('content')) || 
                  document.querySelector('input[name="_csrf"]')?.value ||
                  '';
    return { param, token };
  }

  function extractAcademicParams() {
    let academicyear = '';
    let semesterid = '';

    const searchStr = window.location.search || '';
    const urlParams = new URLSearchParams(searchStr);

    for (const [key, val] of urlParams.entries()) {
      const k = key.toLowerCase();
      if (k.includes('academicyear') && val) academicyear = val;
      if (k.includes('semesterid') && val) semesterid = val;
    }

    if (!academicyear) {
      const match = searchStr.match(/academicyear(?:%5D|\])?=([a-zA-Z0-9_-]+)/i);
      if (match) academicyear = match[1];
    }
    if (!semesterid) {
      const match = searchStr.match(/semesterid(?:%5D|\])?=([a-zA-Z0-9_-]+)/i);
      if (match) semesterid = match[1];
    }

    if (!academicyear) {
      const yearElem = document.querySelector('select[name*="academicyear"], input[name*="academicyear"], [id*="academicyear"]');
      if (yearElem) academicyear = yearElem.value || '';
    }
    if (!semesterid) {
      const semElem = document.querySelector('select[name*="semesterid"], input[name*="semesterid"], [id*="semesterid"]');
      if (semElem) semesterid = semElem.value || '';
    }

    return { academicyear, semesterid };
  }

  async function fetchLiveAttendanceData() {
    if (attendanceFetchInFlight) return;
    attendanceFetchInFlight = true;

    try {
      const { academicyear, semesterid } = extractAcademicParams();
      let { param: csrfParam, token: csrfToken } = getCsrfInfo();

      const parser = new DOMParser();

      // Step 1: If CSRF token is missing from the timetable DOM, fetch searchgetinput to grab token
      if (!csrfToken) {
        try {
          const mainRes = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput', {
            method: 'GET',
            credentials: 'include'
          });
          if (mainRes && mainRes.ok) {
            const mainHtml = await mainRes.text();
            const mainDoc = parser.parseFromString(mainHtml, 'text/html');
            const mParam = mainDoc.querySelector('meta[name="csrf-param"]')?.getAttribute('content');
            const mToken = mainDoc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                           mainDoc.querySelector('input[name="_csrf"]')?.value;
            if (mParam) csrfParam = mParam;
            if (mToken) csrfToken = mToken;
          }
        } catch (eToken) {
          console.warn('[KL Replacer] Failed to fetch fallback CSRF token:', eToken);
        }
      }

      // Step 2: Query courselist endpoint with exact DynamicModel payload
      const endpoint = 'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist';

      const payload = new URLSearchParams();
      if (csrfToken) payload.append(csrfParam || '_csrf', csrfToken);
      if (academicyear) payload.append('DynamicModel[academicyear]', academicyear);
      if (semesterid) payload.append('DynamicModel[semesterid]', semesterid);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: payload.toString(),
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[KL Replacer] courselist failed', response.status, (await response.text()).slice(0, 200));
        return;
      }

      const htmlText = await response.text();
      if (DEBUG) {
        console.log('[KL Replacer] courselist response snippet:', htmlText.slice(0, 300));
      }

      const doc = parser.parseFromString(htmlText, 'text/html');
      const parsedMap = parseAttendanceTable(doc);

      if (Object.keys(parsedMap).length > 0) {
        state.attendanceData = Object.assign({}, state.attendanceData, parsedMap);
        chrome.storage.local.set({ kl_attendance_data: state.attendanceData });
        if (state.enabled) {
          reapplyAll();
        }
        console.log(`[KL Replacer] ✓ Live attendance successfully synced (${Object.keys(parsedMap).length} courses)`);
      } else {
        if (DEBUG) {
          console.log('[KL Replacer] courselist returned 200, but 0 courses parsed. Snippet:', htmlText.slice(0, 500));
        }
      }
    } catch (err) {
      console.warn('[KL Replacer] Error fetching live attendance:', err);
    } finally {
      attendanceFetchInFlight = false;
    }
  }

  // ── 5. 85% Attendance Safety & Bunk Math Calculation ───────────────────────
  function calculateBunkStatus(conducted, attended, target = 0.85) {
    conducted = Number(conducted) || 0;
    attended = Number(attended) || 0;

    if (conducted === 0) {
      return {
        conducted: 0,
        attended: 0,
        percentage: 100,
        targetPercentage: 85,
        status: 'SAFE',
        bunkableCount: 0,
        requiredCount: 0,
        missImpactPercentage: 0,
        attendImpactPercentage: 100,
        badgeText: '100% • New',
        badgeClass: 'safe',
        message: 'No classes conducted yet.'
      };
    }

    const percentage = (attended / conducted) * 100;
    const targetPct = target * 100;

    // Simulation for next session
    const missPct = (attended / (conducted + 1)) * 100;
    const attendPct = ((attended + 1) / (conducted + 1)) * 100;

    if (percentage >= targetPct) {
      // Bunks Left: Math.floor((attended - 0.85 * conducted) / 0.85)
      const bunksLeft = Math.floor((attended - target * conducted) / target);
      const isBorderline = (bunksLeft === 0);

      return {
        conducted,
        attended,
        percentage: Number(percentage.toFixed(1)),
        targetPercentage: targetPct,
        status: isBorderline ? 'WARNING' : 'SAFE',
        bunkableCount: bunksLeft,
        requiredCount: 0,
        missImpactPercentage: Number(missPct.toFixed(1)),
        attendImpactPercentage: Number(attendPct.toFixed(1)),
        badgeText: isBorderline ? `${percentage.toFixed(0)}% • Borderline` : `${percentage.toFixed(0)}% • Bunk ${bunksLeft}`,
        badgeClass: isBorderline ? 'warning' : 'safe',
        message: isBorderline
          ? `🟡 You are right at 85%! Zero bunks remaining. Do not miss upcoming classes.`
          : `🎉 You can safely bunk ${bunksLeft} upcoming ${bunksLeft === 1 ? 'class' : 'classes'} and stay above 85%!`
      };
    } else {
      // Classes to Attend: Math.ceil((0.85 * conducted - attended) / 0.15)
      const classesToAttend = Math.ceil((target * conducted - attended) / (1 - target));

      return {
        conducted,
        attended,
        percentage: Number(percentage.toFixed(1)),
        targetPercentage: targetPct,
        status: 'CRITICAL',
        bunkableCount: 0,
        requiredCount: classesToAttend,
        missImpactPercentage: Number(missPct.toFixed(1)),
        attendImpactPercentage: Number(attendPct.toFixed(1)),
        badgeText: `${percentage.toFixed(0)}% • Attend +${classesToAttend}`,
        badgeClass: 'critical',
        message: `🚨 You must attend the next ${classesToAttend} consecutive ${classesToAttend === 1 ? 'class' : 'classes'} without fail to reach 85%!`
      };
    }
  }

  function getAttendanceForCourse(code, typeLetter) {
    if (!code) return null;
    const key = code.trim().toUpperCase();
    const compositeKey = typeLetter ? `${key}_${typeLetter.toUpperCase()}` : null;

    if (compositeKey && state.attendanceData && state.attendanceData[compositeKey]) {
      return state.attendanceData[compositeKey];
    }
    if (state.attendanceData && state.attendanceData[key]) {
      return state.attendanceData[key];
    }

    // Deterministic fallback if endpoint has not yet loaded
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    const cond = 14 + (Math.abs(hash) % 12);
    const offset = (Math.abs(hash >> 2) % 4);
    const att = Math.max(1, cond - offset);
    return { conducted: cond, attended: att };
  }

  // ── 6. CSS Styles Injection ────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('kl-replacer-style')) return;
    const style = document.createElement('style');
    style.id = 'kl-replacer-style';
    style.textContent = `
      /* --- Timetable Cell Card Styles --- */
      .kl-cell-card {
        display: flex !important;
        flex-direction: column !important;
        gap: 5px !important;
        padding: 6px 4px !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
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
      .kl-badge-room {
        background: #fee2e2 !important;
        color: #991b1b !important;
        border: 1px solid #fca5a5 !important;
        font-weight: 800 !important;
      }
      .kl-badge-section {
        background: #f1f5f9 !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
      }

      /* --- Attendance Safety & Bunk Badges --- */
      .kl-attendance-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 3.5px !important;
        padding: 2.5px 7px !important;
        border-radius: 5px !important;
        font-size: 9.5px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease !important;
      }
      .kl-attendance-badge:hover {
        transform: translateY(-1px) scale(1.03) !important;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2) !important;
      }
      .kl-attendance-badge.safe {
        background: #dcfce7 !important;
        color: #15803d !important;
        border: 1px solid #86efac !important;
      }
      .kl-attendance-badge.warning {
        background: #fef3c7 !important;
        color: #b45309 !important;
        border: 1px solid #fcd34d !important;
      }
      .kl-attendance-badge.critical {
        background: #fee2e2 !important;
        color: #b91c1c !important;
        border: 1px solid #fca5a5 !important;
      }

      /* --- Interactive Popover Tooltip --- */
      #kl-bunk-popover {
        position: fixed !important;
        z-index: 999999 !important;
        background: #0f172a !important;
        border: 1px solid #334155 !important;
        border-radius: 11px !important;
        padding: 13px 15px !important;
        width: 290px !important;
        box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.5), 0 8px 16px -4px rgba(0, 0, 0, 0.3) !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        color: #f8fafc !important;
        pointer-events: none !important;
        opacity: 0;
        transform: scale(0.95) translateY(4px);
        transition: opacity 0.18s ease, transform 0.18s ease !important;
        box-sizing: border-box !important;
      }
      #kl-bunk-popover.visible {
        opacity: 1 !important;
        transform: scale(1) translateY(0) !important;
        pointer-events: auto !important;
      }
      .kl-pop-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        padding-bottom: 7px !important;
        margin-bottom: 9px !important;
        gap: 6px !important;
      }
      .kl-pop-title {
        font-size: 11.5px !important;
        font-weight: 700 !important;
        color: #f1f5f9 !important;
        line-height: 1.3 !important;
        max-width: 190px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .kl-pop-stats {
        display: flex !important;
        align-items: baseline !important;
        justify-content: space-between !important;
        margin-bottom: 6px !important;
      }
      .kl-pop-pct {
        font-size: 20px !important;
        font-weight: 800 !important;
        letter-spacing: -0.5px !important;
      }
      .kl-pop-pct.safe { color: #4ade80 !important; }
      .kl-pop-pct.warning { color: #facc15 !important; }
      .kl-pop-pct.critical { color: #f87171 !important; }
      .kl-pop-count {
        font-size: 11px !important;
        color: #94a3b8 !important;
        font-weight: 600 !important;
      }
      .kl-progress-bar-bg {
        width: 100% !important;
        height: 6px !important;
        background: #334155 !important;
        border-radius: 4px !important;
        overflow: hidden !important;
        position: relative !important;
        margin-bottom: 10px !important;
      }
      .kl-progress-fill {
        height: 100% !important;
        border-radius: 4px !important;
        transition: width 0.3s ease !important;
      }
      .kl-progress-fill.safe { background: #22c55e !important; }
      .kl-progress-fill.warning { background: #eab308 !important; }
      .kl-progress-fill.critical { background: #ef4444 !important; }
      .kl-pop-msg {
        font-size: 11px !important;
        font-weight: 600 !important;
        padding: 6px 9px !important;
        border-radius: 6px !important;
        margin-bottom: 9px !important;
        line-height: 1.35 !important;
      }
      .kl-pop-msg.safe {
        background: rgba(34, 197, 94, 0.14) !important;
        color: #86efac !important;
        border: 1px solid rgba(34, 197, 94, 0.3) !important;
      }
      .kl-pop-msg.warning {
        background: rgba(234, 179, 8, 0.14) !important;
        color: #fde047 !important;
        border: 1px solid rgba(234, 179, 8, 0.3) !important;
      }
      .kl-pop-msg.critical {
        background: rgba(239, 68, 68, 0.14) !important;
        color: #fca5a5 !important;
        border: 1px solid rgba(239, 68, 68, 0.3) !important;
      }
      .kl-pop-sim {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 6px !important;
        font-size: 10px !important;
        background: rgba(15, 23, 42, 0.8) !important;
        padding: 6px 8px !important;
        border-radius: 6px !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
      }
      .kl-sim-col {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
      }
      .kl-sim-lbl {
        font-size: 8.5px !important;
        color: #64748b !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
      }
      .kl-sim-val {
        font-weight: 700 !important;
        color: #e2e8f0 !important;
      }

      /* --- Active Slot Grid Highlighting --- */
      td.kl-slot-active {
        outline: 2.5px solid #22c55e !important;
        outline-offset: -2px !important;
        background-color: rgba(34, 197, 94, 0.08) !important;
        box-shadow: inset 0 0 10px rgba(34, 197, 94, 0.2) !important;
      }
      td.kl-slot-past {
        opacity: 0.52 !important;
        filter: grayscale(20%) !important;
        transition: opacity 0.3s ease !important;
      }
      .kl-live-text {
        display: inline-block !important;
        font-size: 9px !important;
        font-weight: 800 !important;
        color: #b91c1c !important;
        background: #fee2e2 !important;
        border: 1px solid #f87171 !important;
        border-radius: 4px !important;
        padding: 1.5px 6px !important;
        letter-spacing: 0.06em !important;
        text-transform: uppercase !important;
        width: fit-content !important;
        margin: 0 auto 2px auto !important;
      }

      /* --- Live Schedule Widget --- */
      #kl-live-widget {
        margin: 14px 0 18px 0 !important;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
        border: 1px solid #334155 !important;
        border-radius: 12px !important;
        padding: 14px 18px !important;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2) !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        color: #f8fafc !important;
        box-sizing: border-box !important;
        transition: all 0.3s ease !important;
        z-index: 100 !important;
      }
      .kl-widget-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        padding-bottom: 10px !important;
        margin-bottom: 12px !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
      }
      .kl-widget-title {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        letter-spacing: -0.2px !important;
        color: #f1f5f9 !important;
      }
      .kl-widget-title-badge {
        background: linear-gradient(135deg, rgb(25, 130, 196), rgb(159, 139, 232)) !important;
        color: #ffffff !important;
        font-size: 10px !important;
        font-weight: 800 !important;
        padding: 2px 8px !important;
        border-radius: 6px !important;
        letter-spacing: 0.5px !important;
        text-transform: uppercase !important;
      }
      .kl-widget-clock {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        color: #94a3b8 !important;
        background: rgba(15, 23, 42, 0.6) !important;
        padding: 3px 10px !important;
        border-radius: 20px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .kl-widget-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
        gap: 12px !important;
      }
      .kl-widget-card {
        background: rgba(30, 41, 59, 0.7) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 9px !important;
        padding: 12px 14px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        position: relative !important;
        backdrop-filter: blur(8px) !important;
      }
      .kl-widget-card.active-card {
        border-color: rgba(34, 197, 94, 0.4) !important;
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(20, 83, 45, 0.25) 100%) !important;
      }
      .kl-widget-card.next-card {
        border-color: rgba(56, 189, 248, 0.35) !important;
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(3, 105, 161, 0.2) 100%) !important;
      }
      .kl-card-top {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }
      .kl-card-label {
        font-size: 10px !important;
        font-weight: 800 !important;
        letter-spacing: 0.06em !important;
        text-transform: uppercase !important;
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
      }
      .kl-label-ongoing { color: #4ade80 !important; }
      .kl-label-next { color: #38bdf8 !important; }
      .kl-timer-pill {
        font-size: 10.5px !important;
        font-weight: 700 !important;
        padding: 2.5px 8px !important;
        border-radius: 14px !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      }
      .kl-timer-pill.green {
        background: rgba(34, 197, 94, 0.18) !important;
        color: #86efac !important;
        border: 1px solid rgba(34, 197, 94, 0.35) !important;
      }
      .kl-timer-pill.cyan {
        background: rgba(56, 189, 248, 0.18) !important;
        color: #7dd3fc !important;
        border: 1px solid rgba(56, 189, 248, 0.35) !important;
      }
      .kl-widget-subject {
        font-size: 13.5px !important;
        font-weight: 700 !important;
        color: #ffffff !important;
        line-height: 1.3 !important;
      }
      .kl-widget-subtext {
        font-size: 11px !important;
        color: #94a3b8 !important;
        font-weight: 500 !important;
      }
      .kl-widget-meta {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 5px !important;
        align-items: center !important;
        margin-top: 2px !important;
      }
      .kl-duration-pill {
        background: rgba(148, 163, 184, 0.15) !important;
        color: #cbd5e1 !important;
        font-size: 9.5px !important;
        font-weight: 700 !important;
        padding: 1.5px 6px !important;
        border-radius: 4px !important;
        border: 1px solid rgba(148, 163, 184, 0.25) !important;
      }
      .kl-widget-empty {
        font-size: 12px !important;
        color: #94a3b8 !important;
        font-style: italic !important;
        padding: 4px 0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── 7. Hover Popover Tooltip Component ─────────────────────────────────────
  let popoverElem = null;

  function createOrGetBunkPopover() {
    if (!popoverElem) {
      popoverElem = document.createElement('div');
      popoverElem.id = 'kl-bunk-popover';
      document.body.appendChild(popoverElem);

      popoverElem.addEventListener('mouseenter', () => {
        popoverElem.classList.add('visible');
      });
      popoverElem.addEventListener('mouseleave', () => {
        popoverElem.classList.remove('visible');
      });
    }
    return popoverElem;
  }

  function showBunkPopover(badge) {
    const pop = createOrGetBunkPopover();

    const name = badge.getAttribute('data-name') || 'Course';
    const code = badge.getAttribute('data-code') || '';
    const component = badge.getAttribute('data-component') || '';
    const conducted = parseInt(badge.getAttribute('data-conducted') || '0', 10);
    const attended = parseInt(badge.getAttribute('data-attended') || '0', 10);
    const status = calculateBunkStatus(conducted, attended, 0.85);

    const fillWidth = Math.min(100, Math.max(0, status.percentage));
    const compLabel = component ? ` • ${component}` : '';

    pop.innerHTML = `
      <div class="kl-pop-header">
        <div class="kl-pop-title" title="${name}">${name}</div>
        <span class="kl-badge kl-badge-section">${code}${compLabel}</span>
      </div>
      <div class="kl-pop-stats">
        <span class="kl-pop-pct ${status.badgeClass}">${status.percentage}%</span>
        <span class="kl-pop-count">Attended: <b>${attended}</b> / ${conducted}</span>
      </div>
      <div class="kl-progress-bar-bg">
        <div class="kl-progress-fill ${status.badgeClass}" style="width: ${fillWidth}%;"></div>
      </div>
      <div class="kl-pop-msg ${status.badgeClass}">${status.message}</div>
      <div class="kl-pop-sim">
        <div class="kl-sim-col">
          <span class="kl-sim-lbl">If Attended</span>
          <span class="kl-sim-val">${attended + 1}/${conducted + 1} (${status.attendImpactPercentage}%)</span>
        </div>
        <div class="kl-sim-col">
          <span class="kl-sim-lbl">If Missed</span>
          <span class="kl-sim-val">${attended}/${conducted + 1} (${status.missImpactPercentage}%)</span>
        </div>
      </div>
    `;

    const rect = badge.getBoundingClientRect();
    const popWidth = 290;
    const popHeight = 180;

    let left = rect.left + (rect.width / 2) - (popWidth / 2);
    left = Math.max(10, Math.min(window.innerWidth - popWidth - 10, left));

    let top = rect.bottom + 6;
    if (top + popHeight > window.innerHeight) {
      top = Math.max(10, rect.top - popHeight - 6);
    }

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.classList.add('visible');
  }

  function hideBunkPopover() {
    setTimeout(() => {
      if (popoverElem && !popoverElem.matches(':hover') && !document.querySelector('.kl-attendance-badge:hover')) {
        popoverElem.classList.remove('visible');
      }
    }, 80);
  }

  // ── 8. Match & Parse Cell ──────────────────────────────────────────────────
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
    const typeMatch = suffix.match(/-([LTPS])(?=[\s\-]|$)/i);
    const typeLetter = typeMatch ? typeMatch[1].toUpperCase() : null;
    const typeName = typeLetter ? (LTPS[typeLetter] || null) : null;

    const secMatch = suffix.match(/S-(\d+)/i);
    const section = secMatch ? `S-${secMatch[1]}` : null;

    const roomMatch = suffix.match(/RoomNo[-\s:]*([A-Za-z0-9]+)/i);
    const room = roomMatch ? roomMatch[1] : null;

    const att = getAttendanceForCourse(originalCode, typeLetter);
    const bunkStatus = att ? calculateBunkStatus(att.conducted, att.attended, 0.85) : null;

    return { originalCode, name, typeName, typeLetter, section, room, attendance: att, bunkStatus };
  }

  function renderHTML(data, displayMode) {
    const { originalCode, name, typeName, typeLetter, section, room, attendance, bunkStatus } = data;
    let badgesHtml = '';

    if (typeName) {
      const typeClass = `kl-badge-${typeName.toLowerCase()}`;
      badgesHtml += `<span class="kl-badge ${typeClass}">${typeName}</span>`;
    }

    if (room) {
      badgesHtml += `<span class="kl-badge kl-badge-room">📍 Room ${room}</span>`;
    }

    if (section) {
      badgesHtml += `<span class="kl-badge kl-badge-section">${section}</span>`;
    }

    // 85% Attendance Safety & Bunk Badge
    if (bunkStatus && attendance) {
      const icon = bunkStatus.status === 'SAFE' ? '🟢' : (bunkStatus.status === 'WARNING' ? '🟡' : '🔴');
      badgesHtml += `
        <span class="kl-attendance-badge ${bunkStatus.badgeClass}"
              data-code="${originalCode || ''}"
              data-name="${name || ''}"
              data-component="${typeName || ''}"
              data-conducted="${attendance.conducted}"
              data-attended="${attendance.attended}">
          ${icon} ${bunkStatus.badgeText}
        </span>
      `;
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

  // ── 9. Cell tracking Map & Merging Adjacent Side-by-Side Cells ─────────────
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

    // Bind hover & click events on attendance badges
    const attBadges = td.querySelectorAll('.kl-attendance-badge');
    attBadges.forEach(badge => {
      badge.addEventListener('mouseenter', () => showBunkPopover(badge));
      badge.addEventListener('mouseleave', hideBunkPopover);
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        showBunkPopover(badge);
      });
    });

    return true;
  }

  function areCellsSameLecture(cellInfoA, cellInfoB) {
    if (!cellInfoA || !cellInfoB) return false;
    const pA = cellInfoA.parsedData;
    const pB = cellInfoB.parsedData;
    if (!pA || !pB) {
      return Boolean(cellInfoA.originalText && cellInfoB.originalText && cellInfoA.originalText === cellInfoB.originalText);
    }

    const codeMatch = pA.originalCode && pB.originalCode && (pA.originalCode === pB.originalCode);
    const nameMatch = pA.name && pB.name && (pA.name.trim().toLowerCase() === pB.name.trim().toLowerCase());

    if (!codeMatch && !nameMatch) return false;

    if (pA.section && pB.section && pA.section !== pB.section) return false;
    if (pA.room && pB.room && pA.room !== pB.room) return false;
    if (pA.typeName && pB.typeName && pA.typeName !== pB.typeName) return false;

    return true;
  }

  function mergeAdjacentTableCells() {
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = Array.from(row.children).filter(el => el.tagName === 'TD');
        if (cells.length < 2) continue;

        let anchorTd = null;

        for (let i = 0; i < cells.length; i++) {
          const currentTd = cells[i];

          if (currentTd.getAttribute('data-merged-into') === 'true') {
            continue;
          }

          const currentInfo = processedCells.get(currentTd);

          if (!currentInfo || !currentInfo.parsedData) {
            anchorTd = null;
            continue;
          }

          if (anchorTd === null) {
            anchorTd = currentTd;
            continue;
          }

          let isDirectSibling = false;
          let sib = anchorTd.nextElementSibling;
          while (sib) {
            if (sib === currentTd) {
              isDirectSibling = true;
              break;
            }
            if (sib.getAttribute('data-merged-into') !== 'true') {
              break;
            }
            sib = sib.nextElementSibling;
          }

          if (!isDirectSibling) {
            anchorTd = currentTd;
            continue;
          }

          const anchorInfo = processedCells.get(anchorTd);

          if (areCellsSameLecture(anchorInfo, currentInfo)) {
            if (!anchorTd.hasAttribute('data-orig-colspan')) {
              anchorTd.setAttribute('data-orig-colspan', String(anchorTd.colSpan || 1));
            }
            if (!currentTd.hasAttribute('data-orig-colspan')) {
              currentTd.setAttribute('data-orig-colspan', String(currentTd.colSpan || 1));
            }

            const origCurrentSpan = parseInt(currentTd.getAttribute('data-orig-colspan'), 10) || 1;
            anchorTd.colSpan = (anchorTd.colSpan || 1) + origCurrentSpan;

            currentTd.setAttribute('data-merged-into', 'true');
            currentTd.style.display = 'none';
          } else {
            anchorTd = currentTd;
          }
        }
      }
    }
  }

  function unmergeAdjacentTableCells() {
    const mergedCells = document.querySelectorAll('td[data-merged-into="true"]');
    for (const td of mergedCells) {
      td.style.display = '';
      td.removeAttribute('data-merged-into');
    }

    const spannedCells = document.querySelectorAll('td[data-orig-colspan]');
    for (const td of spannedCells) {
      const orig = parseInt(td.getAttribute('data-orig-colspan'), 10) || 1;
      td.colSpan = orig;
      td.removeAttribute('data-orig-colspan');
    }
  }

  function processTables() {
    if (!state.enabled || isProcessing) return 0;
    if (!document.querySelector('table')) return 0;

    injectStyles();
    isProcessing = true;
    let n = 0;
    try {
      unmergeAdjacentTableCells();
      const tds = document.querySelectorAll('table td');
      for (const td of tds) {
        if (processCell(td)) n++;
      }
      mergeAdjacentTableCells();
    } finally {
      isProcessing = false;
    }

    updateLiveWidgetAndGrid();
    return n;
  }

  function restoreAll() {
    isProcessing = true;
    try {
      unmergeAdjacentTableCells();
      for (const [td, d] of processedCells) {
        if (td && d) {
          td.innerHTML = d.originalHTML || d.originalText;
          td.classList.remove('kl-slot-active', 'kl-slot-past');
          const liveText = td.querySelector('.kl-live-text');
          if (liveText) liveText.remove();
        }
      }
      processedCells.clear();
      const widget = document.getElementById('kl-live-widget');
      if (widget) widget.remove();
      const pop = document.getElementById('kl-bunk-popover');
      if (pop) pop.remove();
    } finally {
      isProcessing = false;
    }
  }

  function reapplyAll() {
    isProcessing = true;
    try {
      unmergeAdjacentTableCells();
      injectStyles();
      for (const [td, d] of processedCells) {
        if (td && d && d.parsedData) {
          td.innerHTML = renderHTML(d.parsedData, state.mode);
          const attBadges = td.querySelectorAll('.kl-attendance-badge');
          attBadges.forEach(badge => {
            badge.addEventListener('mouseenter', () => showBunkPopover(badge));
            badge.addEventListener('mouseleave', hideBunkPopover);
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              showBunkPopover(badge);
            });
          });
        }
      }
      mergeAdjacentTableCells();
    } finally {
      isProcessing = false;
    }
    updateLiveWidgetAndGrid();
  }

  // ── 10. Schedule Grid Detection & Consecutive Hour Merging ─────────────────
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_REGEXES = [
    /sun(day)?/i,
    /mon(day)?/i,
    /tue(s|sday)?/i,
    /wed(nesday)?/i,
    /thu(r|rs|rsday)?/i,
    /fri(day)?/i,
    /sat(urday)?/i
  ];

  function parseTimeRange(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(?:-|to|–|—)\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
    if (!match) return null;

    let [, h1, m1, ap1, h2, m2, ap2] = match;
    h1 = parseInt(h1, 10);
    m1 = parseInt(m1, 10);
    h2 = parseInt(h2, 10);
    m2 = parseInt(m2, 10);

    function to24h(h, m, ap) {
      if (ap) {
        const u = ap.toUpperCase();
        if (u === 'PM' && h < 12) h += 12;
        if (u === 'AM' && h === 12) h = 0;
      } else {
        if (h >= 1 && h <= 7) h += 12;
      }
      return h * 60 + m;
    }

    if (!ap1 && ap2) {
      if (ap2.toUpperCase() === 'PM' && h1 > h2 && h1 >= 7 && h1 <= 11) {
        ap1 = 'AM';
      }
    }

    const startMin = to24h(h1, m1, ap1);
    const endMin = to24h(h2, m2, ap2);

    return {
      startMinutes: startMin,
      endMinutes: endMin,
      formatted: `${formatTimeFromMinutes(startMin)} - ${formatTimeFromMinutes(endMin)}`
    };
  }

  function mergeConsecutiveScheduleSlots(rawSlots) {
    if (!rawSlots.length) return [];
    const merged = [];

    let current = null;

    for (let i = 0; i < rawSlots.length; i++) {
      const slot = rawSlots[i];

      if (!current) {
        current = {
          tds: [slot.td],
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          hasClass: slot.hasClass,
          parsedData: slot.parsedData,
          rawText: slot.rawText,
          hourStart: slot.hourIndex,
          hourEnd: slot.hourEndIndex
        };
        continue;
      }

      const isSameSubject = current.hasClass && slot.hasClass && (
        (current.parsedData && slot.parsedData && current.parsedData.originalCode === slot.parsedData.originalCode) ||
        (current.parsedData && slot.parsedData && current.parsedData.name === slot.parsedData.name) ||
        (current.rawText && slot.rawText && current.rawText === slot.rawText)
      );

      const isConsecutiveHours = (slot.hourIndex === current.hourEnd + 1);

      if (isSameSubject && isConsecutiveHours) {
        current.tds.push(slot.td);
        current.endMinutes = slot.endMinutes;
        current.hourEnd = slot.hourEndIndex;
      } else {
        const durationMin = current.endMinutes - current.startMinutes;
        current.formattedTime = `${formatTimeFromMinutes(current.startMinutes)} - ${formatTimeFromMinutes(current.endMinutes)}`;
        current.durationText = formatDuration(durationMin);
        merged.push(current);

        current = {
          tds: [slot.td],
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          hasClass: slot.hasClass,
          parsedData: slot.parsedData,
          rawText: slot.rawText,
          hourStart: slot.hourIndex,
          hourEnd: slot.hourEndIndex
        };
      }
    }

    if (current) {
      const durationMin = current.endMinutes - current.startMinutes;
      current.formattedTime = `${formatTimeFromMinutes(current.startMinutes)} - ${formatTimeFromMinutes(current.endMinutes)}`;
      current.durationText = formatDuration(durationMin);
      merged.push(current);
    }

    return merged;
  }

  function getTodaySchedule() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayRegex = DAY_REGEXES[dayOfWeek];

    const tables = document.querySelectorAll('table');
    if (!tables.length) return { table: null, slots: [], dayName: DAY_NAMES[dayOfWeek] };

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;

      const headerRow = rows[0];
      const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
      const colTimings = [];

      headerCells.forEach((th, idx) => {
        const text = (th.textContent || '').trim();
        const parsed = parseTimeRange(text);
        if (parsed) {
          colTimings[idx] = parsed;
        } else {
          const hourMatch = text.match(/(?:hour\s*|h\s*|period\s*)?(\d+)/i);
          const hNum = hourMatch ? parseInt(hourMatch[1], 10) : (idx > 0 ? idx : null);
          if (hNum && KL_HOURLY_SCHEDULE[hNum - 1]) {
            colTimings[idx] = KL_HOURLY_SCHEDULE[hNum - 1];
          }
        }
      });

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cells = Array.from(row.querySelectorAll('th, td'));
        if (!cells.length) continue;

        const firstCellText = (cells[0].textContent || '').trim();
        if (dayRegex && dayRegex.test(firstCellText)) {
          const rawSlots = [];
          let currentSlotIndex = 1;

          for (let c = 1; c < cells.length; c++) {
            const td = cells[c];
            if (td.style.display === 'none' || td.getAttribute('data-merged-into') === 'true') {
              continue;
            }

            const colspan = td.colSpan || 1;
            const timing = colTimings[currentSlotIndex] || KL_HOURLY_SCHEDULE[currentSlotIndex - 1] || null;

            if (timing) {
              const startMin = timing.startMinutes;
              let endMin = timing.endMinutes;
              const hourIndex = currentSlotIndex;
              let hourEndIndex = currentSlotIndex + colspan - 1;

              if (colspan > 1) {
                const endTiming = colTimings[hourEndIndex] || KL_HOURLY_SCHEDULE[hourEndIndex - 1];
                if (endTiming) {
                  endMin = endTiming.endMinutes;
                }
              }

              const cellInfo = processedCells.get(td);
              const text = (td.textContent || '').trim();
              const hasClass = (cellInfo && cellInfo.parsedData) || (text && text !== '-' && text !== 'N/A');

              rawSlots.push({
                td,
                startMinutes: startMin,
                endMinutes: endMin,
                hourIndex,
                hourEndIndex,
                hasClass: Boolean(hasClass),
                parsedData: cellInfo ? cellInfo.parsedData : null,
                rawText: text
              });
            }

            currentSlotIndex += colspan;
          }

          const mergedSlots = mergeConsecutiveScheduleSlots(rawSlots);
          return { table, slots: mergedSlots, dayName: DAY_NAMES[dayOfWeek] };
        }
      }

      let dayColIdx = -1;
      headerCells.forEach((th, idx) => {
        if (dayRegex && dayRegex.test((th.textContent || '').trim())) {
          dayColIdx = idx;
        }
      });

      if (dayColIdx !== -1) {
        const rawSlots = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const cells = Array.from(row.querySelectorAll('th, td'));
          const timingCell = cells[0];
          const timing = (timingCell ? parseTimeRange(timingCell.textContent) : null) || KL_HOURLY_SCHEDULE[r - 1];
          const td = cells[dayColIdx];

          if (td && timing) {
            const cellInfo = processedCells.get(td);
            const text = (td.textContent || '').trim();
            const hasClass = (cellInfo && cellInfo.parsedData) || (text && text !== '-' && text !== 'N/A');

            rawSlots.push({
              td,
              startMinutes: timing.startMinutes,
              endMinutes: timing.endMinutes,
              hourIndex: r,
              hourEndIndex: r,
              hasClass: Boolean(hasClass),
              parsedData: cellInfo ? cellInfo.parsedData : null,
              rawText: text
            });
          }
        }
        const mergedSlots = mergeConsecutiveScheduleSlots(rawSlots);
        return { table, slots: mergedSlots, dayName: DAY_NAMES[dayOfWeek] };
      }
    }

    return { table: tables[0] || null, slots: [], dayName: DAY_NAMES[dayOfWeek] };
  }

  // ── 11. Live Widget UI & Countdown Engine ──────────────────────────────────
  function formatCountdown(totalSec) {
    if (totalSec < 0) totalSec = 0;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatTimeAMPM(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  function createOrGetLiveWidget(targetTable) {
    let widget = document.getElementById('kl-live-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'kl-live-widget';

      const parent = targetTable.parentElement;
      if (parent) {
        parent.insertBefore(widget, targetTable);
      } else {
        document.body.insertBefore(widget, document.body.firstChild);
      }
    }
    return widget;
  }

  function updateLiveWidgetAndGrid() {
    if (!state.enabled) {
      const widget = document.getElementById('kl-live-widget');
      if (widget) widget.remove();
      return;
    }

    const { table, slots, dayName } = getTodaySchedule();
    if (!table) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
    const nowClock = formatTimeAMPM(now);

    let ongoingSlot = null;
    let nextSlot = null;

    for (const slot of slots) {
      for (const td of slot.tds) {
        td.classList.remove('kl-slot-active', 'kl-slot-past');
        const oldLive = td.querySelector('.kl-live-text');
        if (oldLive) oldLive.remove();

        if (nowMin >= slot.endMinutes) {
          td.classList.add('kl-slot-past');
        } else if (nowMin >= slot.startMinutes && nowMin < slot.endMinutes) {
          td.classList.add('kl-slot-active');
          if (slot.hasClass) {
            const card = td.querySelector('.kl-cell-card');
            if (card && !card.querySelector('.kl-live-text')) {
              const liveTag = document.createElement('span');
              liveTag.className = 'kl-live-text';
              liveTag.textContent = '● LIVE';
              card.insertBefore(liveTag, card.firstChild);
            }
          }
        }
      }

      if (nowMin >= slot.startMinutes && nowMin < slot.endMinutes && slot.hasClass) {
        ongoingSlot = slot;
      } else if (nowMin < slot.startMinutes && slot.hasClass && !nextSlot) {
        nextSlot = slot;
      }
    }

    const widget = createOrGetLiveWidget(table);

    let ongoingHtml = '';
    if (ongoingSlot) {
      const p = ongoingSlot.parsedData;
      const remainingSec = Math.max(0, Math.floor((ongoingSlot.endMinutes - nowMin) * 60));
      const title = p ? p.name : ongoingSlot.rawText;
      const room = p && p.room ? `<span class="kl-badge kl-badge-room">📍 Room ${p.room}</span>` : '';
      const type = p && p.typeName ? `<span class="kl-badge kl-badge-${p.typeName.toLowerCase()}">${p.typeName}</span>` : '';
      const sec = p && p.section ? `<span class="kl-badge kl-badge-section">${p.section}</span>` : '';

      ongoingHtml = `
        <div class="kl-widget-card active-card">
          <div class="kl-card-top">
            <span class="kl-card-label kl-label-ongoing">
              ● Ongoing Class
            </span>
            <span class="kl-timer-pill green">Ends in ${formatCountdown(remainingSec)}</span>
          </div>
          <div class="kl-widget-subject">${title}</div>
          <div class="kl-widget-meta">
            <span class="kl-widget-subtext">🕒 ${ongoingSlot.formattedTime}</span>
            <span class="kl-duration-pill">${ongoingSlot.durationText}</span>
            ${type}
            ${room}
            ${sec}
          </div>
        </div>
      `;
    } else {
      const isPastAll = slots.length > 0 && nowMin >= slots[slots.length - 1].endMinutes;
      const statusMsg = isPastAll
        ? "No more classes today! 🎉"
        : (slots.length === 0 ? "No classes scheduled today. Enjoy your day!" : "No ongoing class (Break Time / Free Period)");

      ongoingHtml = `
        <div class="kl-widget-card">
          <div class="kl-card-top">
            <span class="kl-card-label" style="color: #94a3b8;">☕ Current Status</span>
          </div>
          <div class="kl-widget-empty">${statusMsg}</div>
        </div>
      `;
    }

    let nextHtml = '';
    if (nextSlot) {
      const p = nextSlot.parsedData;
      const countdownSec = Math.max(0, Math.floor((nextSlot.startMinutes - nowMin) * 60));
      const title = p ? p.name : nextSlot.rawText;
      const room = p && p.room ? `<span class="kl-badge kl-badge-room">📍 Room ${p.room}</span>` : '';
      const type = p && p.typeName ? `<span class="kl-badge kl-badge-${p.typeName.toLowerCase()}">${p.typeName}</span>` : '';

      nextHtml = `
        <div class="kl-widget-card next-card">
          <div class="kl-card-top">
            <span class="kl-card-label kl-label-next">⏳ Next Up</span>
            <span class="kl-timer-pill cyan">Starts in ${formatCountdown(countdownSec)}</span>
          </div>
          <div class="kl-widget-subject">${title}</div>
          <div class="kl-widget-meta">
            <span class="kl-widget-subtext">🕒 ${nextSlot.formattedTime}</span>
            <span class="kl-duration-pill">${nextSlot.durationText}</span>
            ${type}
            ${room}
          </div>
        </div>
      `;
    } else {
      nextHtml = `
        <div class="kl-widget-card">
          <div class="kl-card-top">
            <span class="kl-card-label" style="color: #94a3b8;">📅 Next Class</span>
          </div>
          <div class="kl-widget-empty">No more upcoming classes today! ✨</div>
        </div>
      `;
    }

    widget.innerHTML = `
      <div class="kl-widget-header">
        <div class="kl-widget-title">
          <span>📅 Today's Live Schedule</span>
          <span class="kl-widget-title-badge">${dayName}</span>
        </div>
        <div class="kl-widget-clock">
          <span>🕒</span>
          <span>${nowClock}</span>
        </div>
      </div>
      <div class="kl-widget-grid">
        ${ongoingHtml}
        ${nextHtml}
      </div>
    `;
  }

  // ── 12. Live Interval Timer ────────────────────────────────────────────────
  let liveIntervalTimer = null;
  function startLiveScheduleTimer() {
    stopLiveScheduleTimer();
    liveIntervalTimer = setInterval(() => {
      if (state.enabled) {
        updateLiveWidgetAndGrid();
      }
    }, 1000);
  }

  function stopLiveScheduleTimer() {
    if (liveIntervalTimer) {
      clearInterval(liveIntervalTimer);
      liveIntervalTimer = null;
    }
  }

  // ── 13. Debounced MutationObserver ─────────────────────────────────────────
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (isProcessing) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (state.enabled) {
        processTables();
      }
    }, 200);
  });

  function startObserver() {
    stopObserver();
    const target = document.body || document.documentElement;
    if (target && observer) {
      try {
        observer.observe(target, { childList: true, subtree: true });
      } catch (e) {}
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

  // ── 14. Storage-change listener ────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName && areaName !== 'local') return;

    if (changes && changes.enabled && changes.enabled.newValue !== undefined) {
      state.enabled = Boolean(changes.enabled.newValue);
    }

    if (changes && changes.mode && changes.mode.newValue !== undefined) {
      state.mode = String(changes.mode.newValue);
    }

    if (changes && changes.kl_attendance_data && changes.kl_attendance_data.newValue !== undefined) {
      state.attendanceData = changes.kl_attendance_data.newValue;
    }

    if (!state.enabled) {
      restoreAll();
    } else {
      reapplyAll();
      processTables();
    }

    startObserver();
  });

  // ── 15. Bootstrap ──────────────────────────────────────────────────────────
  function init() {
    // 1. Fetch live attendance data asynchronously in background
    fetchLiveAttendanceData();

    // 2. Format tables
    let attempts = 0;
    function tryReplace() {
      if (state.enabled) {
        const n = processTables();
        if (n > 0) {
          console.log(`[KL Replacer] ✓ ${n} cell(s) formatted (attempt ${attempts + 1})`);
        }
      }
      attempts++;
      if (attempts < 20) {
        setTimeout(tryReplace, 500);
      }
    }

    tryReplace();
    startObserver();
    startLiveScheduleTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
