# KL Subject Code Replacer – Chrome Extension (v2.0)

Transforms cryptic timetable cells on the **KL University ERP** (`newerp.kluniversity.in`) into clean, visually structured cards with color-coded session pills and highlighted classroom numbers.

## Visual Design

Each table cell is formatted into a clean visual card:

- **Subject Name**: Bold, dark, clear title.
- **Session Badges (Color-coded)**:
  - 📘 **Lecture**: Soft Indigo/Blue badge (`Lecture`)
  - 📙 **Tutorial**: Warm Amber/Gold badge (`Tutorial`)
  - 📗 **Practical**: Emerald Green badge (`Practical`)
  - 🔮 **Skilling**: Soft Violet/Purple badge (`Skilling`)
- **Classroom Indicator**: Prominent coral/red badge with pin icon (e.g. `📍 Room C307`, `📍 Room M121`) so you can spot your classroom instantly without scanning through text.
- **Section Indicator**: Clean slate badge (e.g. `S-1`).

## Display Modes

1. **Name only**: Full subject title + Badges (Session Type, Room, Section)
2. **Code + Name**: Full subject title + Subject Code (`25CS2101L`) + Badges

## Features

- **Instant In-Place Swapping**: Toggle ON/OFF or switch modes without reloading.
- **High Performance**: Debounced observer and re-entrancy locks ensure 0% CPU overhead and zero tab freezing.

## How to Install / Reload

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top-right corner.
3. Click the **↺ Reload** button on the **KL Subject Code Replacer** card.
4. Refresh your ERP timetable page.
