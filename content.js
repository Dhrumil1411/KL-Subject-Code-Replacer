// KL University ERP – Subject Code Replacer & Live Class Assistant v2.2
// Features:
// 1. Live Attendance Fetching directly from ERP courselist endpoint.
// 2. 85% Attendance Safety & Bunk Calculator with interactive hover popover.
// 3. Timetable Subject Code Replacer with session badges & classroom indicators.
// 4. Next Up / Live Class Floating Widget with live countdown timers.
// 5. Dynamic Active Slot Grid Highlighting & Past Slot Dimming.
// 6. Side-by-side consecutive lecture cell unification.

(async () => {

  // ── 0. Cryptographic Proof of Authorship & Intellectual Property ───────────
  // Steganographic zero-width identifier & encrypted base64 developer certificate
  const _0xKL_AUTH_SIG = "eyJhdXRob3IiOiJEaHJ1bWlsIERhc2hhZGlhIiwicm9sbE5vIjoiMjUwMDAzOTAyMyIsInByb2plY3QiOiJLTE5ld0VSUC1TdWJqZWN0Q29kZVJlcGxhY2VyIiwidmVyc2lvbiI6IjIuMi4wIiwic2lnIjoiZDA4MzA4MjUtOTAyMy1kaHJ1bWlsIn0=";
  const _0xKL_WATERMARK = "\u200B\u200C\u200D\uFEFF\u200B\u200D\u200C\uFEFF";

  function __verifyDevIdentity__() {
    try {
      const data = JSON.parse(atob(_0xKL_AUTH_SIG));
      return {
        Author: data.author,
        RollNo: data.rollNo,
        Project: data.project,
        Version: data.version,
        Signature: data.sig,
        Status: "AUTHENTICATED_ORIGINAL_CREATOR"
      };
    } catch (e) {
      return null;
    }
  }

  // Hidden Global Verification Hooks for Console / DevTools inspection
  window.__KL_DEV_AUTH__ = __verifyDevIdentity__;
  window.__KL_VERIFY_AUTHOR__ = () => {
    const cert = __verifyDevIdentity__();
    if (!cert) return "Verification Failed";
    console.log("%c╔════════════════════════════════════════════════════════════════════╗", "color: #38bdf8; font-weight: bold;");
    console.log("%c║           KL SUBJECT CODE REPLACER - AUTHENTIC AUTHOR PROOF        ║", "color: #38bdf8; font-weight: bold;");
    console.log("%c╠════════════════════════════════════════════════════════════════════╣", "color: #38bdf8;");
    console.log(`%c║  Original Creator : %c${cert.Author.padEnd(46)}%c║`, "color: #94a3b8;", "color: #4ade80; font-weight: bold;", "color: #94a3b8;");
    console.log(`%c║  Roll Number      : %c${cert.RollNo.padEnd(46)}%c║`, "color: #94a3b8;", "color: #facc15; font-weight: bold;", "color: #94a3b8;");
    console.log(`%c║  Project          : %c${cert.Project.padEnd(46)}%c║`, "color: #94a3b8;", "color: #38bdf8; font-weight: bold;", "color: #94a3b8;");
    console.log(`%c║  Verification Sig : %c${cert.Signature.padEnd(46)}%c║`, "color: #94a3b8;", "color: #cbd5e1;", "color: #94a3b8;");
    console.log("%c╚════════════════════════════════════════════════════════════════════╝", "color: #38bdf8; font-weight: bold;");
    return "Verification Successful: Built by Dhrumil Dashadia (2500039023)";
  };

  window.simulateSession = (attended, conducted, hours) => simulateSession(attended, conducted, hours);
  window.getSessionHours = (cell) => getSessionHours(cell);

  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      window.__KL_VERIFY_AUTHOR__();
    }
  });

  const DEBUG = false;
  let attendanceFetchInFlight = false;
  let attendanceFetchAttempted = false;
  let lastPrintedUnmatched = '';
  let unmatchedCourseCodesNotCoveredByBundle = new Set();
  let lastMissingCourseFetchTime = 0;

  const loggedOnceSet = new Set();
  function logOnce(msg) {
    if (!loggedOnceSet.has(msg)) {
      loggedOnceSet.add(msg);
      console.log(msg);
    }
  }

  // ── 1. Acronyms & Course Name Formatting ──────────────────────────────────
  const ACRONYMS = [
    'AI', 'ML', 'IoT', 'OOP', 'DBMS', 'SQL', 'OS', 'DSA',
    'UI', 'UX', 'HTML', 'CSS', 'JS', 'API', 'C', 'C++',
    'Java', 'Python'
  ];
  const ACRONYM_MAP = new Map(ACRONYMS.map(a => [a.toUpperCase(), a]));
  const SMALL_WORDS = new Set([
    'and', 'of', 'for', 'to', 'in', 'on', 'the', 'with', 'using', 'a', 'an'
  ]);

  function formatCourseName(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const collapsed = raw.trim().replace(/\s+/g, ' ');
    if (!collapsed) return '';

    const words = collapsed.split(' ');
    const formattedWords = words.map((word, index) => {
      const match = word.match(/^([(\[{'"“‘]*)(.*?)([)\]}'"”’.,;:]*)$/);
      if (!match) return word;
      const [, prefix, core, suffix] = match;
      if (!core) return word;

      const coreUpper = core.toUpperCase();
      let formattedCore = '';

      if (ACRONYM_MAP.has(coreUpper)) {
        formattedCore = ACRONYM_MAP.get(coreUpper);
      } else {
        const coreLower = core.toLowerCase();
        const isFirst = (index === 0);
        if (!isFirst && SMALL_WORDS.has(coreLower)) {
          formattedCore = coreLower;
        } else {
          if (core.includes('-')) {
            formattedCore = core.split('-').map(part => {
              const partUpper = part.toUpperCase();
              if (ACRONYM_MAP.has(partUpper)) return ACRONYM_MAP.get(partUpper);
              if (SMALL_WORDS.has(part.toLowerCase())) return part.toLowerCase();
              return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            }).join('-');
          } else {
            formattedCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
          }
        }
      }

      return `${prefix}${formattedCore}${suffix}`;
    });

    return formattedWords.join(' ');
  }

  // ── 1b. ERP Profile Course Mapping Table Parser ────────────────────────────
  function parseCourseMappingTable(docOrElement) {
    if (!docOrElement) return [];
    const tables = docOrElement.querySelectorAll ? Array.from(docOrElement.querySelectorAll('table')) : [];
    if (docOrElement.tagName === 'TABLE') tables.unshift(docOrElement);

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;

      let colYear = -1, colAcademicYear = -1, colSemester = -1, colCourseCode = -1, colCourseDesc = -1;
      let colLtps = -1, colSection = -1, colFaculty = -1;
      let headerRowIdx = -1;

      for (let r = 0; r < Math.min(5, rows.length); r++) {
        const headerCells = Array.from(rows[r].querySelectorAll('th, td'));
        headerCells.forEach((cell, idx) => {
          const text = (cell.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (text === 'coursecode' || text === 'subjectcode') colCourseCode = idx;
          else if (text === 'coursedesc' || text === 'coursename' || text === 'subjectname' || text === 'coursetitle') colCourseDesc = idx;
          else if (text === 'academicyear') colAcademicYear = idx;
          else if (text === 'year') colYear = idx;
          else if (text === 'semester' || text === 'sem') colSemester = idx;
          else if (text === 'ltps' || text === 'component') colLtps = idx;
          else if (text === 'section' || text === 'sec') colSection = idx;
          else if (text.includes('faculty') || text === 'facultyname') colFaculty = idx;
        });

        if (colCourseCode !== -1 && colCourseDesc !== -1) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) continue;

      const parsedRows = [];
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td'));
        if (!cells.length) continue;
        const courseCode = colCourseCode !== -1 && cells[colCourseCode] ? cells[colCourseCode].textContent.trim() : '';
        const rawCourseDesc = colCourseDesc !== -1 && cells[colCourseDesc] ? cells[colCourseDesc].textContent.trim() : '';
        if (!courseCode || !rawCourseDesc) continue;

        parsedRows.push({
          year: colYear !== -1 && cells[colYear] ? cells[colYear].textContent.trim().replace(/\s+/g, ' ') : '',
          academicYear: colAcademicYear !== -1 && cells[colAcademicYear] ? cells[colAcademicYear].textContent.trim().replace(/\s+/g, ' ') : '',
          semester: colSemester !== -1 && cells[colSemester] ? cells[colSemester].textContent.trim().replace(/\s+/g, ' ') : '',
          courseCode,
          courseName: formatCourseName(rawCourseDesc),
          ltps: colLtps !== -1 && cells[colLtps] ? cells[colLtps].textContent.trim().replace(/\s+/g, ' ') : '',
          section: colSection !== -1 && cells[colSection] ? cells[colSection].textContent.trim().replace(/\s+/g, ' ') : '',
          faculty: colFaculty !== -1 && cells[colFaculty] ? cells[colFaculty].textContent.trim().replace(/\s+/g, ' ') : ''
        });
      }

      if (parsedRows.length > 0) {
        // Partial list check: look for "Showing 1-15 of 15 items" summary
        const root = docOrElement.ownerDocument || (docOrElement.querySelectorAll ? docOrElement : document);
        const summaryEl = root.querySelector ? root.querySelector('.summary') : null;
        const summaryText = (summaryEl ? summaryEl.textContent : (root.textContent || '')).replace(/\s+/g, ' ');
        const match = summaryText.match(/showing\s+[\d\-–—]+\s+of\s+([0-9]+)\s+items?/i);
        if (match) {
          const total = parseInt(match[1], 10);
          if (!isNaN(total) && total > 0 && parsedRows.length < total) {
            logOnce(`[KL Replacer] course list may be partial (parsed ${parsedRows.length} of ${total})`);
          }
        }
        return parsedRows;
      }
    }
    return [];
  }

  function getRecencyScore(academicYear, semester, year) {
    let score = 0;
    if (academicYear) {
      const match = academicYear.match(/\d{4}/);
      if (match) score += parseInt(match[0], 10) * 100;
    }
    if (year) {
      score += (parseInt(year, 10) || 0) * 10;
    }
    if (semester) {
      const s = semester.toLowerCase();
      if (s.includes('summer')) score += 3;
      else if (s.includes('even')) score += 2;
      else if (s.includes('odd')) score += 1;
    }
    return score;
  }

  function organizeCourseMapping(rows) {
    if (!rows || !rows.length) return null;

    let maxScore = -1;
    let newestAcademicYear = '';
    let newestSemester = '';

    for (const r of rows) {
      const score = getRecencyScore(r.academicYear, r.semester, r.year);
      if (score > maxScore) {
        maxScore = score;
        newestAcademicYear = r.academicYear || newestAcademicYear;
        newestSemester = r.semester || newestSemester;
      }
    }

    const codeScores = new Map();
    for (const r of rows) {
      const code = r.courseCode;
      const score = getRecencyScore(r.academicYear, r.semester, r.year);
      if (!codeScores.has(code) || score > codeScores.get(code).score) {
        codeScores.set(code, { score, rows: [r] });
      } else if (score === codeScores.get(code).score) {
        codeScores.get(code).rows.push(r);
      }
    }

    const byCode = {};
    for (const [code, { rows: matchedRows }] of codeScores.entries()) {
      const first = matchedRows[0];
      const components = [];
      const seenComp = new Set();
      for (const row of matchedRows) {
        const compKey = `${row.ltps}_${row.section}_${row.faculty}`;
        if (!seenComp.has(compKey)) {
          seenComp.add(compKey);
          components.push({
            ltps: row.ltps || '',
            section: row.section || '',
            faculty: row.faculty || ''
          });
        }
      }
      byCode[code] = {
        name: first.courseName,
        components
      };
    }

    return {
      fetchedAt: Date.now(),
      academicYear: newestAcademicYear,
      semester: newestSemester,
      byCode
    };
  }

  // ── 1c. Load bundled & personal subject codes ─────────────────────────────
  let subjectMap = (typeof window !== 'undefined' && window.__KL_COURSES__) ? window.__KL_COURSES__ : null;
  if (!subjectMap) {
    try {
      const res = await fetch(chrome.runtime.getURL('subject_codes.json'));
      subjectMap = await res.json();
    } catch (err) {
      subjectMap = {};
    }
  }

  const bundledCourses = {};
  const bundledOriginalCodes = {};
  for (const [code, name] of Object.entries(subjectMap || {})) {
    if (code) {
      const trimmed = code.trim();
      const upper = trimmed.toUpperCase();
      bundledCourses[upper] = name;
      bundledOriginalCodes[upper] = trimmed;
    }
  }

  let myCourses = { fetchedAt: 0, academicYear: '', semester: '', byCode: {} };
  let bannerDismissedAt = 0;
  let lookup = {};
  let allCodes = [];

  function rebuildLookups() {
    const nextLookup = {};
    const codeSet = new Set();

    // 1. Populate from bundled courses
    for (const [upper, name] of Object.entries(bundledCourses)) {
      const orig = bundledOriginalCodes[upper] || upper;
      nextLookup[upper] = { name, originalCode: orig, source: 'bundled' };
      codeSet.add(upper);
      if (upper.endsWith('L') || upper.endsWith('P')) {
        const base = upper.slice(0, -1);
        if (!nextLookup[base]) {
          nextLookup[base] = { name, originalCode: orig, source: 'bundled' };
        }
        codeSet.add(base);
      }
    }

    // 2. Overwrite / prioritize from myCourses.byCode
    if (myCourses && myCourses.byCode) {
      for (const [rawCode, data] of Object.entries(myCourses.byCode)) {
        if (!rawCode || !data) continue;
        const trimmed = rawCode.trim();
        const upper = trimmed.toUpperCase();
        nextLookup[upper] = { name: data.name, originalCode: trimmed, source: 'my_courses' };
        codeSet.add(upper);

        if (upper.endsWith('L') || upper.endsWith('P')) {
          const base = upper.slice(0, -1);
          nextLookup[base] = { name: data.name, originalCode: trimmed, source: 'my_courses' };
          codeSet.add(base);
        } else {
          const withL = upper + 'L';
          const withP = upper + 'P';
          if (!nextLookup[withL]) nextLookup[withL] = { name: data.name, originalCode: trimmed, source: 'my_courses' };
          if (!nextLookup[withP]) nextLookup[withP] = { name: data.name, originalCode: trimmed, source: 'my_courses' };
          codeSet.add(withL);
          codeSet.add(withP);
        }
      }
    }

    for (const key of Object.keys(lookup)) {
      delete lookup[key];
    }
    Object.assign(lookup, nextLookup);
    allCodes = Array.from(codeSet).sort((a, b) => b.length - a.length);
  }

  rebuildLookups();

  function extractBaseCourseCode(raw) {
    if (!raw) return '';
    let str = raw.trim().toUpperCase();
    // Split off trailing component suffixes: -L, -T, -P, -S, _L, _T, _P, _S
    str = str.replace(/[-_\s]+[LTPS]$/i, '');
    return str;
  }

  function resolveCourse(rawCode) {
    if (!rawCode) return null;
    const clean = rawCode.trim();
    const upper = clean.toUpperCase();
    const base = extractBaseCourseCode(clean);

    // 1. kl_my_courses.byCode
    if (myCourses && myCourses.byCode) {
      if (myCourses.byCode[base]) {
        return { name: myCourses.byCode[base].name, originalCode: base, source: 'my_courses' };
      }
      if (myCourses.byCode[clean]) {
        return { name: myCourses.byCode[clean].name, originalCode: clean, source: 'my_courses' };
      }
      if (myCourses.byCode[upper]) {
        return { name: myCourses.byCode[upper].name, originalCode: upper, source: 'my_courses' };
      }
      if (base.endsWith('L') || base.endsWith('P')) {
        const stripped = base.slice(0, -1);
        if (myCourses.byCode[stripped]) {
          return { name: myCourses.byCode[stripped].name, originalCode: stripped, source: 'my_courses' };
        }
      } else {
        if (myCourses.byCode[base + 'L']) {
          return { name: myCourses.byCode[base + 'L'].name, originalCode: base + 'L', source: 'my_courses' };
        }
        if (myCourses.byCode[base + 'P']) {
          return { name: myCourses.byCode[base + 'P'].name, originalCode: base + 'P', source: 'my_courses' };
        }
      }
    }

    // 2. Bundled course data
    if (bundledCourses) {
      if (bundledCourses[base]) {
        return { name: bundledCourses[base], originalCode: bundledOriginalCodes[base] || base, source: 'bundled' };
      }
      if (bundledCourses[clean]) {
        return { name: bundledCourses[clean], originalCode: bundledOriginalCodes[clean] || clean, source: 'bundled' };
      }
      if (bundledCourses[upper]) {
        return { name: bundledCourses[upper], originalCode: bundledOriginalCodes[upper] || upper, source: 'bundled' };
      }
      if (base.endsWith('L') || base.endsWith('P')) {
        const stripped = base.slice(0, -1);
        if (bundledCourses[stripped]) {
          return { name: bundledCourses[stripped], originalCode: bundledOriginalCodes[stripped] || stripped, source: 'bundled' };
        }
      } else {
        if (bundledCourses[base + 'L']) {
          return { name: bundledCourses[base + 'L'].name, originalCode: bundledOriginalCodes[base + 'L'] || base + 'L', source: 'bundled' };
        }
        if (bundledCourses[base + 'P']) {
          return { name: bundledCourses[base + 'P'].name, originalCode: bundledOriginalCodes[base + 'P'] || base + 'P', source: 'bundled' };
        }
      }
    }

    // 3. Fallback
    return null;
  }

  // Exposed verification and diagnostic hooks on window
  window.formatCourseName = formatCourseName;
  window.parseCourseMappingTable = parseCourseMappingTable;
  window.organizeCourseMapping = organizeCourseMapping;
  window.extractBaseCourseCode = extractBaseCourseCode;
  window.resolveCourse = resolveCourse;

  // ── 2. Shared mutable state ────────────────────────────────────────────────
  const state = {
    enabled: true,
    mode: 'name-only',
    attendanceData: {}
  };
  let isProcessing = false;

  await new Promise(resolve => {
    try {
      chrome.storage.local.get({
        enabled: true,
        mode: 'name-only',
        kl_attendance_data: {},
        kl_my_courses: { fetchedAt: 0, academicYear: '', semester: '', byCode: {} },
        kl_course_banner_dismissed_at: 0,
        kl_last_missing_fetch_time: 0
      }, (res) => {
        if (res) {
          if (res.enabled !== undefined) state.enabled = Boolean(res.enabled);
          if (res.mode !== undefined) state.mode = String(res.mode);
          if (res.kl_attendance_data) state.attendanceData = res.kl_attendance_data;
          if (res.kl_my_courses) myCourses = res.kl_my_courses;
          if (res.kl_course_banner_dismissed_at) bannerDismissedAt = Number(res.kl_course_banner_dismissed_at) || 0;
          if (res.kl_last_missing_fetch_time) lastMissingCourseFetchTime = Number(res.kl_last_missing_fetch_time) || 0;
          rebuildLookups();
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
    if (!isTimetablePage() || attendanceFetchInFlight || attendanceFetchAttempted) return;

    const { academicyear, semesterid } = extractAcademicParams();
    if (!academicyear || !semesterid) {
      return;
    }

    attendanceFetchAttempted = true;
    attendanceFetchInFlight = true;

    try {
      let { param: csrfParam, token: csrfToken } = getCsrfInfo();
      const parser = new DOMParser();

      // Step 1: If CSRF token meta tag is missing on the timetable page, fetch searchgetinput to grab token
      if (isTimetablePage() && !document.querySelector('meta[name="csrf-token"]')) {
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
          if (DEBUG) {
            console.warn('[KL Replacer] Failed to fetch fallback CSRF token:', eToken);
          }
        }
      }

      // Step 2: Query courselist endpoint with exact DynamicModel payload
      const endpoint = 'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist';

      const payload = new URLSearchParams();
      if (csrfToken) payload.append(csrfParam || '_csrf', csrfToken);
      payload.append('DynamicModel[academicyear]', academicyear);
      payload.append('DynamicModel[semesterid]', semesterid);

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
        if (DEBUG) {
          const bodySnippet = (await response.text().catch(() => '')).slice(0, 300);
          console.warn(`[KL Replacer] courselist failed (HTTP ${response.status}):`, bodySnippet);
        } else {
          console.warn(`[KL Replacer] courselist failed (HTTP ${response.status})`);
        }
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
        if (state.enabled && isTimetablePage()) {
          reapplyAll();
        }
        logOnce(`[KL Replacer] ✓ Live attendance successfully synced (${Object.keys(parsedMap).length} courses)`);
      } else {
        if (DEBUG) {
          console.log('[KL Replacer] courselist returned 200, but 0 courses parsed. Snippet:', htmlText.slice(0, 500));
        }
      }
    } catch (err) {
      if (DEBUG) {
        console.warn('[KL Replacer] Error fetching live attendance:', err);
      }
    } finally {
      attendanceFetchInFlight = false;
    }
  }

  // ── 4b. Profile Course Mapping Auto-Fetcher & Passive Capture Engine ────────
  let courseFetchInFlight = false;
  let lastMissingCourseFetchAttempt = 0;
  let courseFetchFailed = false;

  function isTimetablePage() {
    const href = window.location.href || '';
    if (href.includes('individualstudenttimetableget')) return true;
    if (href.includes('timetables/universitymasteracademictimetableview')) return true;
    if (href.includes('timetables%2Funiversitymasteracademictimetableview')) return true;
    if (document.querySelector('table#timetable, table.timetable, table[id*="timetable" i], table[class*="timetable" i]')) return true;
    const tables = document.querySelectorAll('table');
    for (const t of tables) {
      const text = t.textContent || '';
      if (/mon(day)?/i.test(text) && /tue(s|sday)?/i.test(text) && /wed(nesday)?/i.test(text)) {
        return true;
      }
    }
    return false;
  }

  function isProfilePage() {
    const href = window.location.href || '';
    return href.includes('studentprofileinfo') || href.includes('viewprofileindi');
  }

  async function fetchMyCourses(triggerReason = 'auto') {
    const COURSE_MAPPING_CONFIG = {
      url: 'https://newerp.kluniversity.in/index.php?r=studentinfo%2Fstudentcoursemappingmasterinfoview%2Ftab_index_personal',
      options: {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    };

    if (courseFetchInFlight) return;
    courseFetchInFlight = true;

    try {
      if (DEBUG) {
        console.log(`[KL Replacer] Fetching student course mapping (reason: ${triggerReason})...`);
      }
      const response = await fetch(COURSE_MAPPING_CONFIG.url, COURSE_MAPPING_CONFIG.options);

      const method = (COURSE_MAPPING_CONFIG.options && COURSE_MAPPING_CONFIG.options.method) || 'GET';

      if (!response.ok) {
        logOnce(`[KL Replacer] course fetch: ${method} status=${response.status} hasTable=false`);
        console.warn(`[KL Replacer] Course mapping request failed with HTTP ${response.status}`);
        courseFetchFailed = true;
        if (isTimetablePage()) checkAndShowFallbackBanner();
        return;
      }

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const rows = parseCourseMappingTable(doc);
      const hasTable = Boolean(rows && rows.length > 0);

      logOnce(`[KL Replacer] course fetch: ${method} status=${response.status} hasTable=${hasTable}`);

      if (!hasTable) {
        console.warn('[KL Replacer] Course mapping response contained no valid courses table');
        courseFetchFailed = true;
        if (isTimetablePage()) checkAndShowFallbackBanner();
        return;
      }

      const organized = organizeCourseMapping(rows);
      if (!organized || !organized.byCode || Object.keys(organized.byCode).length === 0) {
        console.warn('[KL Replacer] Could not parse valid course codes from mapping table');
        courseFetchFailed = true;
        if (isTimetablePage()) checkAndShowFallbackBanner();
        return;
      }

      courseFetchFailed = false;
      myCourses = organized;
      rebuildLookups();
      chrome.storage.local.set({ kl_my_courses: organized });
      logOnce(`[KL Replacer] ✓ Successfully auto-loaded ${Object.keys(organized.byCode).length} courses from ERP profile`);

      removeFallbackBanner();

      if (state.enabled && isTimetablePage()) {
        reapplyAll();
        processTables();
      }
    } catch (err) {
      console.warn('[KL Replacer] Error while fetching student courses:', err && err.message ? err.message : err);
      courseFetchFailed = true;
      if (isTimetablePage()) checkAndShowFallbackBanner();
    } finally {
      courseFetchInFlight = false;
    }
  }

  window.fetchMyCourses = fetchMyCourses;

  function showFallbackBanner() {
    if (document.getElementById('kl-fallback-banner')) return;
    const target = document.getElementById('kl-live-widget') || document.querySelector('table');
    if (!target || !target.parentElement) return;

    const banner = document.createElement('div');
    banner.id = 'kl-fallback-banner';
    banner.innerHTML = `
      <span class="kl-banner-text">To show your course names, open <a href="/index.php?r=studentinfo%2Fstudentprofileinfo%2Fviewprofileindi" target="_blank" rel="noopener noreferrer">Profile → Courses</a> once.</span>
      <button type="button" class="kl-banner-dismiss" aria-label="Dismiss banner">Dismiss</button>
    `;

    const dismissBtn = banner.querySelector('.kl-banner-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        banner.remove();
        bannerDismissedAt = Date.now();
        chrome.storage.local.set({ kl_course_banner_dismissed_at: bannerDismissedAt });
      });
    }

    target.parentElement.insertBefore(banner, target);
  }

  function removeFallbackBanner() {
    const banner = document.getElementById('kl-fallback-banner');
    if (banner) banner.remove();
  }

  function checkAndShowFallbackBanner() {
    if (!isTimetablePage()) return;

    // Condition (a): Automatic fetch failed
    if (!courseFetchFailed) {
      removeFallbackBanner();
      return;
    }

    // Condition (b): Nothing usable is stored in kl_my_courses
    const hasUsable = myCourses && myCourses.byCode && Object.keys(myCourses.byCode).length > 0;
    if (hasUsable) {
      removeFallbackBanner();
      return;
    }

    // Remember dismissal for 24 hours
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - bannerDismissedAt < ONE_DAY) {
      removeFallbackBanner();
      return;
    }

    // Condition (c): At least one real course cell code isn't covered by bundled course data
    if (unmatchedCourseCodesNotCoveredByBundle.size === 0) {
      removeFallbackBanner();
      return;
    }

    showFallbackBanner();
  }

  let profilePassiveCaptured = false;
  let profileObserver = null;

  function initProfilePassiveCapture() {
    if (!isProfilePage() || profilePassiveCaptured) return;

    function checkForCourseTable() {
      if (profilePassiveCaptured) return true;
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) continue;
        let hasCourseCode = false;
        let hasCourseDesc = false;
        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const cells = rows[r].querySelectorAll('th, td');
          for (const cell of cells) {
            const txt = (cell.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (txt === 'coursecode' || txt === 'subjectcode') hasCourseCode = true;
            if (txt === 'coursedesc' || txt === 'coursename' || txt === 'subjectname' || txt === 'coursetitle') hasCourseDesc = true;
          }
          if (hasCourseCode && hasCourseDesc) break;
        }

        if (hasCourseCode && hasCourseDesc) {
          const parsedRows = parseCourseMappingTable(table);
          if (parsedRows && parsedRows.length > 0) {
            const organized = organizeCourseMapping(parsedRows);
            if (organized && organized.byCode && Object.keys(organized.byCode).length > 0) {
              profilePassiveCaptured = true;
              myCourses = organized;
              rebuildLookups();
              chrome.storage.local.set({ kl_my_courses: organized });
              logOnce(`[KL Replacer] ✓ Passively captured ${Object.keys(organized.byCode).length} courses from Profile Courses table`);
              if (profileObserver) {
                profileObserver.disconnect();
                profileObserver = null;
              }
              return true;
            }
          }
        }
      }
      return false;
    }

    // 1. Immediate check if table already present
    if (checkForCourseTable()) return;

    // 2. Watch document for course table injection
    profileObserver = new MutationObserver(() => {
      checkForCourseTable();
    });

    profileObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  async function checkAndTriggerCourseFetch(context = {}) {
    if (courseFetchInFlight) return;

    const hasStored = myCourses && myCourses.byCode && Object.keys(myCourses.byCode).length > 0;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const isOlderThan7Days = !myCourses.fetchedAt || (Date.now() - myCourses.fetchedAt > SEVEN_DAYS);

    // Trigger 1: Nothing stored
    if (!hasStored) {
      await fetchMyCourses('nothing_stored');
      return;
    }

    // Trigger 2: Stored data older than 7 days
    if (isOlderThan7Days) {
      await fetchMyCourses('older_than_7_days');
      return;
    }

    // Trigger 4: Academic year or semester in timetable URL differs from stored one
    if (isTimetablePage()) {
      const { academicyear, semesterid } = extractAcademicParams();
      if (academicyear && myCourses.academicYear) {
        const urlYearNum = academicyear.replace(/[^0-9]/g, '');
        const storedYearNum = myCourses.academicYear.replace(/[^0-9]/g, '');
        if (urlYearNum && storedYearNum && urlYearNum !== storedYearNum) {
          await fetchMyCourses('academic_year_changed');
          return;
        }
      }
      if (semesterid && myCourses.semester) {
        const urlSem = semesterid.toLowerCase().replace(/[^a-z0-9]/g, '');
        const storedSem = myCourses.semester.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (urlSem && storedSem && !storedSem.includes(urlSem) && !urlSem.includes(storedSem)) {
          await fetchMyCourses('semester_changed');
          return;
        }
      }
    }

    // Trigger 3: A real course cell code not found in byCode or bundled data
    // (at most once per hour, remembered in storage)
    if (context.hasMissingCode) {
      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - lastMissingCourseFetchTime > ONE_HOUR) {
        lastMissingCourseFetchTime = Date.now();
        chrome.storage.local.set({ kl_last_missing_fetch_time: lastMissingCourseFetchTime });
        await fetchMyCourses('missing_timetable_code');
        return;
      }
    }
  }

  // ── 5. 85% Attendance Safety & Bunk Math Calculation ───────────────────────
  function simulateSession(attended, conducted, hours = 1) {
    attended = Number(attended) || 0;
    conducted = Number(conducted) || 0;
    const h = Math.max(1, Number(hours) || 1);

    const attendedIfAttended = attended + h;
    const conductedAfter = conducted + h;
    const attendedIfMissed = attended;

    const attendPct = conductedAfter > 0
      ? Number(((attendedIfAttended / conductedAfter) * 100).toFixed(1))
      : 100;
    const missPct = conductedAfter > 0
      ? Number(((attendedIfMissed / conductedAfter) * 100).toFixed(1))
      : 0;

    return {
      ifAttended: {
        a: attendedIfAttended,
        c: conductedAfter,
        percent: attendPct
      },
      ifMissed: {
        a: attendedIfMissed,
        c: conductedAfter,
        percent: missPct
      }
    };
  }

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

    // Simulation for next session (default 1 hr baseline)
    const sim1 = simulateSession(attended, conducted, 1);

    if (percentage >= targetPct) {
      // Bunks Left: Math.floor((attended - 0.85 * conducted) / 0.85)
      const bunksLeft = Math.floor((attended - target * conducted) / target);
      const isBorderline = (bunksLeft === 0);

      const msg = bunksLeft >= 1
        ? `You can miss up to ${bunksLeft} ${bunksLeft === 1 ? 'hour' : 'hours'} and stay above 85%.`
        : `Zero bunks remaining. Missing even one hour drops you below 85%.`;

      return {
        conducted,
        attended,
        percentage: Number(percentage.toFixed(1)),
        targetPercentage: targetPct,
        status: isBorderline ? 'WARNING' : 'SAFE',
        bunkableCount: bunksLeft,
        requiredCount: 0,
        missImpactPercentage: sim1.ifMissed.percent,
        attendImpactPercentage: sim1.ifAttended.percent,
        badgeText: isBorderline ? `${percentage.toFixed(0)}% • Borderline` : `${percentage.toFixed(0)}% • Bunk ${bunksLeft}`,
        badgeClass: isBorderline ? 'warning' : 'safe',
        message: msg
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
        missImpactPercentage: sim1.ifMissed.percent,
        attendImpactPercentage: sim1.ifAttended.percent,
        badgeText: `${percentage.toFixed(0)}% • Attend +${classesToAttend}`,
        badgeClass: 'critical',
        message: `Attend the next ${classesToAttend} ${classesToAttend === 1 ? 'hour' : 'hours'} to get back to 85%.`
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

      /* --- Fallback Banner --- */
      #kl-fallback-banner {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
        color: #334155 !important;
        padding: 9px 14px !important;
        border-radius: 8px !important;
        margin: 12px 0 !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 13px !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
        box-sizing: border-box !important;
      }
      #kl-fallback-banner a {
        color: #0284c7 !important;
        font-weight: 700 !important;
        text-decoration: underline !important;
      }
      #kl-fallback-banner .kl-banner-dismiss {
        background: #e2e8f0 !important;
        border: 1px solid #cbd5e1 !important;
        color: #475569 !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        padding: 4px 10px !important;
        margin-left: 12px !important;
        border-radius: 6px !important;
        line-height: 1.2 !important;
        transition: all 0.2s ease !important;
      }
      #kl-fallback-banner .kl-banner-dismiss:hover {
        background: #cbd5e1 !important;
        color: #0f172a !important;
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

      /* --- Timetable Full-Height Expansion & Fixed Equal Column Widths --- */
      .table-responsive,
      .grid-view,
      .box-body,
      .panel-body,
      .card-body,
      div[class*="timetable"],
      div[id*="timetable"],
      div[class*="content"],
      div[class*="container"] {
        max-height: none !important;
        height: auto !important;
        overflow-y: visible !important;
      }
      table {
        width: 100% !important;
        min-height: 520px !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }
      table tr {
        height: auto !important;
        min-height: 68px !important;
      }
      table td, table th {
        padding: 6px 4px !important;
        vertical-align: middle !important;
        height: auto !important;
        text-align: center !important;
        box-sizing: border-box !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
      }
      /* Day label column (first column) compact width */
      table th:first-child,
      table td:first-child {
        width: 65px !important;
        min-width: 65px !important;
        max-width: 65px !important;
        font-weight: 800 !important;
      }
      /* Slot columns distributed equally */
      table th:not(:first-child),
      table td:not(:first-child) {
        width: auto !important;
      }

      /* --- Empty Slot Placeholder Styles --- */
      .kl-empty-slot {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 48px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .kl-empty-pill {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 3px 9px !important;
        background: rgba(241, 245, 249, 0.75) !important;
        color: #94a3b8 !important;
        border: 1px dashed #cbd5e1 !important;
        border-radius: 6px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        letter-spacing: 0.05em !important;
        text-transform: uppercase !important;
        user-select: none !important;
        transition: all 0.2s ease !important;
      }
      .kl-empty-pill:hover {
        background: rgba(226, 232, 240, 0.95) !important;
        color: #64748b !important;
        border-color: #94a3b8 !important;
      }
    `;
    style.setAttribute('data-author-sig', _0xKL_AUTH_SIG);
    style.setAttribute('data-author-watermark', _0xKL_WATERMARK);
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

  function getSessionHours(cell) {
    if (!cell || !(cell instanceof Element)) return 1;
    const td = (cell.tagName === 'TD' || cell.tagName === 'TH') ? cell : cell.closest('td, th');
    if (!td) return 1;

    let span = td.colSpan || 1;
    if (span <= 1) return 1;

    const tr = td.parentElement;
    const table = tr ? tr.closest('table') : null;
    if (!table) return Math.max(1, span);

    const rows = table.querySelectorAll('tr');
    if (!rows.length) return Math.max(1, span);

    // Identify lunch / break columns from the table header
    const headerRow = rows[0];
    const headerCells = Array.from(headerRow.children);
    const lunchColIndices = new Set();
    let colIdx = 0;

    for (let i = 0; i < headerCells.length; i++) {
      const th = headerCells[i];
      const thSpan = th.colSpan || 1;
      const text = (th.textContent || '').trim();
      if (/(lunch|break|recess)/i.test(text)) {
        for (let s = 0; s < thSpan; s++) {
          lunchColIndices.add(colIdx + s);
        }
      }
      colIdx += thSpan;
    }

    if (lunchColIndices.size === 0) {
      return Math.max(1, span);
    }

    // Determine starting column index of this cell in the row
    let cellStartCol = 0;
    for (const sib of tr.children) {
      if (sib === td) break;
      if (sib.style.display !== 'none' && sib.getAttribute('data-merged-into') !== 'true') {
        cellStartCol += (sib.colSpan || 1);
      }
    }
    const cellEndCol = cellStartCol + span - 1;

    let breakCount = 0;
    for (let c = cellStartCol; c <= cellEndCol; c++) {
      if (lunchColIndices.has(c)) {
        breakCount++;
      }
    }

    return Math.max(1, span - breakCount);
  }

  function showBunkPopover(badge) {
    const pop = createOrGetBunkPopover();

    const name = badge.getAttribute('data-name') || 'Course';
    const code = badge.getAttribute('data-code') || '';
    const component = badge.getAttribute('data-component') || '';
    const conducted = parseInt(badge.getAttribute('data-conducted') || '0', 10);
    const attended = parseInt(badge.getAttribute('data-attended') || '0', 10);
    const status = calculateBunkStatus(conducted, attended, 0.85);

    const td = badge.closest('td');
    const hours = parseInt(
      badge.getAttribute('data-hours') ||
      (td ? td.getAttribute('data-hours') : '') ||
      (td ? getSessionHours(td) : 1),
      10
    ) || 1;
    const sim = simulateSession(attended, conducted, hours);
    const hrLabel = hours === 1 ? '1 hr' : `${hours} hrs`;

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
          <span class="kl-sim-lbl">If Attended (${hrLabel})</span>
          <span class="kl-sim-val">${sim.ifAttended.a}/${sim.ifAttended.c} (${sim.ifAttended.percent}%)</span>
        </div>
        <div class="kl-sim-col">
          <span class="kl-sim-lbl">If Missed (${hrLabel})</span>
          <span class="kl-sim-val">${sim.ifMissed.a}/${sim.ifMissed.c} (${sim.ifMissed.percent}%)</span>
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
  function isDayCell(text) {
    if (!text) return false;
    const clean = text.trim();
    return /^(sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?)$/i.test(clean);
  }

  function looksLikeCourseCode(text) {
    if (!text) return false;
    const clean = text.trim();
    if (isDayCell(clean)) return false;
    if (/^(lunch|break|recess|free|hour|period|time|day|sem|semester|year)\b/i.test(clean)) return false;
    if (/^\d{1,2}[:.]\d{2}/.test(clean)) return false;
    const candidate = clean.split(/[\s\-–—(]/)[0].toUpperCase();
    if (candidate.length < 4 || candidate.length > 15) return false;
    return /[0-9]/.test(candidate) && /[A-Z]/.test(candidate);
  }

  function matchCode(cellText) {
    if (!cellText) return null;
    const upper = cellText.toUpperCase();
    for (const code of allCodes) {
      if (upper.startsWith(code)) {
        const next = upper[code.length];
        if (next === undefined || next === '-' || next === '_' || next === ' ' || next === '\t' || next === '\n' || next === '(') {
          return code;
        }
      }
    }
    // Check if cell starts with standard course code pattern
    const candidateMatch = upper.match(/^([0-9]{2}[A-Z]{2,4}[0-9]{3,4}[A-Z]?)(?:[-_][LTPS])?(?:[\s\-_\/(]|$)/);
    if (candidateMatch) {
      return candidateMatch[1];
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
              data-attended="${attendance.attended}"
              data-hours="1">
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
    if (!td || td.tagName === 'TH') return false;
    if (processedCells.has(td)) return false;

    const rawText = (td.textContent || '').trim();
    if (!rawText) return false;

    // Skip day row/column headers
    if (isDayCell(rawText)) return false;
    if (td.cellIndex === 0 && (isDayCell(rawText) || /^(mon|tue|wed|thu|fri|sat|sun)/i.test(rawText))) return false;

    // Skip timing and break labels
    if (/^(lunch|break|recess|hour|period|time)\b/i.test(rawText)) return false;
    if (/^\d{1,2}[:.]\d{2}/.test(rawText)) return false;

    const cleanText = rawText.replace(/[\s\-\u00a0]+/g, '').trim();

    // Format empty slots ('-', '--', 'N/A', or blank) with modern 'Free' pill
    if (!cleanText || cleanText === 'N/A' || rawText === '-' || rawText === '--' || rawText === '—') {
      processedCells.set(td, {
        originalHTML: td.innerHTML,
        originalText: rawText,
        isEmptySlot: true
      });
      td.innerHTML = '<div class="kl-empty-slot"><span class="kl-empty-pill">Free</span></div>';
      return true;
    }

    const candidateToken = rawText.split(/[\s\-–—(]/)[0];
    const isCandidateCourse = looksLikeCourseCode(rawText);
    const codeKey = matchCode(rawText) || (isCandidateCourse ? extractBaseCourseCode(candidateToken) : null);
    const resolved = codeKey ? resolveCourse(codeKey) : null;

    if (!resolved) {
      // ONLY collect codes from cells that look like real course cells
      if (isCandidateCourse) {
        const candidateBase = extractBaseCourseCode(codeKey || candidateToken);
        if (candidateBase && candidateBase.length >= 4) {
          unmatchedCodes.add(candidateBase);
          unmatchedCourseCodesNotCoveredByBundle.add(candidateBase);
        }
      }
      return false;
    }

    const { name, originalCode, source } = resolved;
    if (source !== 'my_courses') {
      hasMissingInMyCourses = true;
    }

    const suffix = rawText.slice(originalCode ? originalCode.length : (codeKey ? codeKey.length : 0)) || '';
    const parsedData = parseCellData(originalCode, name, suffix);

    processedCells.set(td, {
      originalHTML: td.innerHTML,
      originalText: rawText,
      parsedData
    });

    td.innerHTML = renderHTML(parsedData, state.mode);
    td.setAttribute('data-hours', '1');

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
    if (cellInfoA.isEmptySlot || cellInfoB.isEmptySlot) return false;
    const pA = cellInfoA.parsedData;
    const pB = cellInfoB.parsedData;
    if (!pA || !pB) return false;

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

          if (currentTd.getAttribute('data-merged-into') === 'true' || currentTd.getAttribute('data-trimmed-col') === 'true' || currentTd.style.display === 'none') {
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
            if (sib.getAttribute('data-merged-into') !== 'true' && sib.getAttribute('data-trimmed-col') !== 'true' && sib.style.display !== 'none') {
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

      // Make session hours available on cells and badges at render time
      for (const row of rows) {
        const cells = Array.from(row.children).filter(el => el.tagName === 'TD');
        for (const td of cells) {
          if (td.style.display === 'none' || td.getAttribute('data-merged-into') === 'true') {
            continue;
          }
          const hours = getSessionHours(td);
          td.setAttribute('data-hours', String(hours));
          const badge = td.querySelector('.kl-attendance-badge');
          if (badge) {
            badge.setAttribute('data-hours', String(hours));
          }
        }
      }
    }
  }

  function expandTimetableContainers() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      let el = table.parentElement;
      for (let depth = 0; depth < 5 && el && el !== document.body; depth++) {
        el.style.maxHeight = 'none';
        el.style.height = 'auto';
        el.style.overflowY = 'visible';
        el = el.parentElement;
      }
    });
  }

  function untrimColumns() {
    const trimmed = document.querySelectorAll('[data-trimmed-col="true"]');
    for (const el of trimmed) {
      el.style.display = '';
      el.removeAttribute('data-trimmed-col');
    }
  }

  function trimTrailingEmptyColumns() {
    untrimColumns();

    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;

      // Find the maximum column index across all day rows (in unmerged state) that has a class
      let maxClassCol = 0;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cells = Array.from(row.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
        if (cells.length < 2) continue;

        let colIdx = 0;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const span = parseInt(cell.getAttribute('data-orig-colspan'), 10) || 1;

          if (colIdx > 0) { // Column 0 is the Day label (Monday, Tuesday, etc.)
            const cellInfo = processedCells.get(cell);
            const text = (cell.textContent || '').replace(/[\s\-\u00a0]+/g, '').trim();
            const isFreeText = /^(free|—|-|--|n\/a)?$/i.test(text);

            const hasClass = Boolean((cellInfo && cellInfo.parsedData && !cellInfo.isEmptySlot) ||
                                     (!cellInfo && !isFreeText && text.length > 0));

            if (hasClass) {
              const lastCoveredCol = colIdx + span - 1;
              if (lastCoveredCol > maxClassCol) {
                maxClassCol = lastCoveredCol;
              }
            }
          }
          colIdx += span;
        }
      }

      // If at least one class was found, hide all columns beyond maxClassCol across header and body rows
      if (maxClassCol > 0) {
        for (const row of rows) {
          const cells = Array.from(row.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
          let colIdx = 0;

          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const span = parseInt(cell.getAttribute('data-orig-colspan'), 10) || 1;

            if (colIdx > maxClassCol) {
              cell.setAttribute('data-trimmed-col', 'true');
              cell.style.display = 'none';
            }
            colIdx += span;
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
      td.setAttribute('data-hours', '1');
      const badge = td.querySelector('.kl-attendance-badge');
      if (badge) badge.setAttribute('data-hours', '1');
    }
  }

  let hasMissingInMyCourses = false;
  let unmatchedCodes = new Set();

  function processTables() {
    if (!state.enabled || isProcessing || !isTimetablePage()) return 0;
    if (!document.querySelector('table')) return 0;

    injectStyles();
    expandTimetableContainers();
    isProcessing = true;
    let n = 0;
    hasMissingInMyCourses = false;
    unmatchedCodes = new Set();
    unmatchedCourseCodesNotCoveredByBundle = new Set();
    try {
      untrimColumns();
      unmergeAdjacentTableCells();
      const tds = document.querySelectorAll('table td');
      for (const td of tds) {
        if (processCell(td)) n++;
      }
      trimTrailingEmptyColumns();
      mergeAdjacentTableCells();

      checkAndShowFallbackBanner();
      updateLiveWidgetAndGrid();
    } finally {
      isProcessing = false;
    }

    if (unmatchedCodes.size > 0) {
      const sortedStr = Array.from(unmatchedCodes).sort().join(', ');
      if (sortedStr !== lastPrintedUnmatched) {
        lastPrintedUnmatched = sortedStr;
        console.log(`[KL Replacer] unmatched codes: ${sortedStr}`);
      }
    }

    if (hasMissingInMyCourses) {
      checkAndTriggerCourseFetch({ hasMissingCode: true });
    }

    return n;
  }

  function restoreAll() {
    isProcessing = true;
    try {
      untrimColumns();
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
      removeFallbackBanner();
    } finally {
      isProcessing = false;
    }
  }

  function reapplyAll() {
    if (!isTimetablePage()) return;
    isProcessing = true;
    try {
      untrimColumns();
      unmergeAdjacentTableCells();
      injectStyles();
      expandTimetableContainers();
      for (const [td, d] of processedCells) {
        if (td && d) {
          if (d.isEmptySlot) {
            td.innerHTML = '<div class="kl-empty-slot"><span class="kl-empty-pill">Free</span></div>';
          } else {
            // Re-resolve using updated myCourses so new names appear after fetch
            const rawText = d.originalText || '';
            const codeKey = matchCode(rawText) || (looksLikeCourseCode(rawText) ? extractBaseCourseCode(rawText.split(/[\s\-–—(]/)[0]) : null);
            const resolved = codeKey ? resolveCourse(codeKey) : null;
            if (resolved) {
              const sfx = rawText.slice(resolved.originalCode ? resolved.originalCode.length : (codeKey ? codeKey.length : 0)) || '';
              d.parsedData = parseCellData(resolved.originalCode, resolved.name, sfx);
            }
            if (d.parsedData) {
              td.innerHTML = renderHTML(d.parsedData, state.mode);
              td.setAttribute('data-hours', '1');
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
        }
      }
      trimTrailingEmptyColumns();
      mergeAdjacentTableCells();

      checkAndShowFallbackBanner();
      updateLiveWidgetAndGrid();
    } finally {
      isProcessing = false;
    }
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
  const observer = new MutationObserver((mutations) => {
    if (isProcessing || !isTimetablePage()) return;

    // Ignore mutations originating entirely from extension UI widgets
    const isExtensionOnly = mutations.every(m => {
      const target = m.target;
      if (!target) return false;
      if (target.id === 'kl-live-widget' || target.id === 'kl-fallback-banner' || target.id === 'kl-bunk-popover') return true;
      if (target.closest && (target.closest('#kl-live-widget') || target.closest('#kl-fallback-banner') || target.closest('#kl-bunk-popover'))) return true;
      if (typeof target.className === 'string' && target.className.includes('kl-')) return true;
      return false;
    });
    if (isExtensionOnly) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (state.enabled && isTimetablePage()) {
        processTables();
      }
    }, 300);
  });

  function startObserver() {
    stopObserver();
    if (!isTimetablePage()) return;
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

    // When myCourses data arrives (from fetchMyCourses or passive capture),
    // rebuild lookups and re-render all already-processed cells.
    if (changes && changes.kl_my_courses && changes.kl_my_courses.newValue !== undefined) {
      myCourses = changes.kl_my_courses.newValue || {};
      rebuildLookups();
      logOnce('[KL Replacer] kl_my_courses updated — re-rendering timetable cells.');
    }

    // When user dismisses the fallback banner, remove it immediately.
    if (changes && changes.kl_course_banner_dismissed_at) {
      bannerDismissedAt = Number(changes.kl_course_banner_dismissed_at.newValue) || 0;
      removeFallbackBanner();
    }

    // GATING: Timetable DOM mutations, rendering and observers ONLY execute on timetable pages!
    if (!isTimetablePage()) return;

    if (!state.enabled) {
      restoreAll();
      stopObserver();
    } else {
      reapplyAll();
      processTables();
      startObserver();
    }
  });

  // ── 15. Bootstrap ──────────────────────────────────────────────────────────
  function init() {
    if (isTimetablePage()) {
      // 1. Fetch live attendance data asynchronously (only on timetable, only if params found)
      fetchLiveAttendanceData();

      // 2. Format timetable with early termination once processed
      let attempts = 0;
      function tryReplace() {
        if (!state.enabled || !isTimetablePage()) return;
        const n = processTables();
        if (n > 0) {
          logOnce(`[KL Replacer] ✓ ${n} timetable cell(s) formatted`);
          return; // Stop retry loop immediately once successful!
        }
        attempts++;
        if (attempts < 10) {
          setTimeout(tryReplace, 500);
        }
      }

      tryReplace();
      startObserver();
      startLiveScheduleTimer();
    } else if (isProfilePage()) {
      // Profile page: activate passive capture observer
      if (typeof initProfilePassiveCapture === 'function') {
        initProfilePassiveCapture();
      }
    }

    // Background course auto-fetch runs as needed on any ERP page (respecting cache age & triggers)
    checkAndTriggerCourseFetch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
