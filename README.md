# KL Subject Code Replacer & Live Class Assistant (v2.2)

Transforms cryptic timetable cells on the **KL University ERP** (`newerp.kluniversity.in`) into clean visual cards with color-coded session pills, prominent room indicators, unified multi-hour lecture blocks, **Live 85% Attendance Safety & Bunk Calculator**, and a live timetable tracking widget.

---

## 🌟 Key Features

### 1. 🛡️ Live 85% Attendance Fetching & Bunk Calculator
- **Direct ERP Endpoint Sync**: Asynchronously fetches your real-time attendance statistics from:
  `https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`
  carrying your active `academicyear` and `semesterid` session parameters.
- **Component-Level Tracking**: Matches each timetable cell by its specific Course Code + LTPS component (Lecture = `L`, Tutorial = `T`, Practical = `P`, Skilling = `S`).
- **Mathematical Bunk Status (85% Target)**:
  - 🟢 **Safe (`>= 85%`)**: `🟢 86% • Bunk 1` — Allowed safe misses calculated via `Math.floor((attended - 0.85 * conducted) / 0.85)`.
  - 🟡 **Borderline (`= 85%`)**: `🟡 85% • Borderline` — Exact 85% threshold with 0 bunks remaining.
  - 🔴 **Critical (`< 85%`)**: `🔴 80% • Attend +2` — Minimum consecutive attendances needed calculated via `Math.ceil((0.85 * conducted - attended) / 0.15)`.
- **Interactive Hover Popover**: Hovering or tapping any attendance pill reveals:
  - Course Name & LTPS Component
  - Total Attended / Total Conducted (`12 / 14`)
  - Progress bar with 85% benchmark
  - Clear guidance message on allowed bunks or required attendances
  - Next-session impact simulation (*"If attended: 13/15 (86.7%)"*, *"If missed: 12/15 (80.0%)"*)

### 2. 🕒 Next Up & Live Class Widget
- **Ongoing Class Card**: Displays currently active subject name, session badge, room number (`📍 Room C307`), and real-time countdown to class dismissal (`Ends in 42m 15s`).
- **Next Up Card**: Shows upcoming class details with a live countdown timer (`Starts in 00:29:45`).
- **Consecutive Hour Merging**: Intelligently combines consecutive slots of the same subject (e.g., Hour 1 + 2 = 1h 40m uninterrupted session) so countdowns and active states span the full continuous duration.
- **Break Time & Lunch Awareness**: Automatically tracks 10-minute/30-minute breaks and lunch slots with status notifications.
- **Real-Time Clock**: Live digital clock synchronized to current system time.

### 3. 🔲 Side-by-Side Cell Unification (Merged Table Cards)
- Automatically merges adjacent timetable cells in the same row that belong to the same lecture/subject into **one single wide item** (`colSpan = 2+`), eliminating redundant duplicate cards.
- Cleanly restores original cell structures if toggled off.

### 4. ⏰ Official KL ERP Hourly Slot Timings
- **Hour 1**: `07:10 AM - 08:00 AM` (50 min)
- **Hour 2**: `08:00 AM - 08:50 AM` (50 min) *(Consecutive 1+2 = 07:10 - 08:50 = 1h 40m)*
- **Break**: `08:50 AM - 09:20 AM` (30 min)
- **Hour 3**: `09:20 AM - 10:10 AM` (50 min)
- **Hour 4**: `10:10 AM - 11:00 AM` (50 min) *(Consecutive 3+4 = 09:20 - 11:00 = 1h 40m)*
- **Break**: `11:00 AM - 11:10 AM` (10 min)
- **Hour 5**: `11:10 AM - 12:00 PM` (50 min)
- **Hour 6**: `12:00 PM - 12:50 PM` (50 min) *(Consecutive 5+6 = 11:10 - 12:50 = 1h 40m)*
- **Hour 7**: `12:50 PM - 01:50 PM` (60 min Lunch Break)
- **Hour 8**: `01:50 PM - 02:40 PM` (50 min)
- **Hour 9**: `02:40 PM - 03:30 PM` (50 min) *(Consecutive 8+9 = 01:50 - 03:30 = 1h 40m)*
- **Break**: `03:30 PM - 03:40 PM` (10 min)
- **Hour 10**: `03:40 PM - 04:30 PM` (50 min)
- **Break**: `04:30 PM - 04:40 PM` (10 min)
- **Hour 11**: `04:40 PM - 05:30 PM` (50 min)

### 5. 💡 Active Slot Grid Highlighting
- **Live Glowing Border**: Highlights current active timetable slot(s) with an animated emerald outline and an in-flow `● LIVE` text badge.
- **Past Slot Dimming**: Automatically dims completed time slots for streamlined focus on the rest of the day.

### 6. 📅 Timetable Subject Replacer
- **Subject Name**: Bold, clear subject title.
- **Session Badges (Color-coded)**:
  - 📘 **Lecture**: Lavender/Indigo badge (`Lecture`)
  - 📙 **Tutorial**: Warm Sand/Gold badge (`Tutorial`)
  - 📗 **Practical**: Sage Green badge (`Practical`)
  - 🔮 **Skilling**: Magenta Violet badge (`Skilling`)
- **Classroom Indicator**: Prominent coral badge with pin icon (e.g. `📍 Room C307`, `📍 Room M121`) for instant room identification.
- **Section Indicator**: Clean slate badge (e.g. `S-1`).

---

## 🚀 How to Install / Reload

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top-right corner.
3. Click the **↺ Reload** button on the **KL Subject Code Replacer** card (or click **Load unpacked** and choose this directory).
4. Refresh your ERP page (`https://newerp.kluniversity.in`). The live assistant, live attendance sync, and timetable cards will automatically initialize!
