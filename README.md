# KL Subject Code Replacer

A Google Chrome browser extension that enhances the KL University ERP timetable interface by automatically replacing cryptic course codes with clear, readable subject titles.

## Features
- Automatically detects and replaces course codes (e.g. `25CS2101L`) with full subject titles on the ERP timetable page
- Expands course component abbreviations into full labels (`-L` to Lecture, `-T` to Tutorial, `-P` to Practical, `-S` to Skilling)
- Supports two display modes: "Name Only" and "Code + Name"
- In-place instantaneous swapping toggle without needing to reload the webpage
- Robust asynchronous DOM tracking using MutationObserver to seamlessly handle dynamic timetable rendering

## Tech Stack
- Chrome Extensions Manifest V3
- HTML5 & CSS3 (Popup UI)
- JavaScript (Chrome Storage API, Content Scripts, DOM MutationObserver)
- JSON (Course code database)

## How to Run
1. Open Google Chrome (or any Chromium-based browser like Brave/Edge) and navigate to `chrome://extensions/`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the project folder: `d:\Project\KL-Subject-Code-Replacer`.
5. Navigate to the KL University ERP portal (`https://newerp.kluniversity.in/`) to view the expanded timetable.

## Status
Complete
