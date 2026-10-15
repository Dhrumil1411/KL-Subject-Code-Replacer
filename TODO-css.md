# CSS Issues / Observations (To Fix Later)

1. **Bunk Calculator Hover Popover Title Truncation (`.kl-pop-title`)**:
   - Location: `content.js` (around line 610)
   - Style: `max-width: 190px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;`
   - Issue: Long course titles (e.g., "Front End Development Frameworks for Web Applications", "Artificial Intelligence and Machine Learning") are prematurely truncated with an ellipsis instead of wrapping or allowing a flexible width tooltip.

2. **Live Schedule Widget Multi-Column Flexibility (`#kl-live-widget .kl-widget-grid`)**:
   - Location: `content.js` (around line 750)
   - Style: Displays cards side-by-side without intermediate responsive breakpoints for mid-width split-screen desktop windows prior to mobile mode trigger.

3. **Hardcoded Popover Bounding Height Assumption (`popHeight = 180`)**:
   - Location: `content.js` (around line 1770)
   - Issue: When the guidance message text or simulation values wrap to multiple lines, the actual popover element height can exceed 180px, causing the bottom viewport boundary check (`top + popHeight > window.innerHeight`) to underestimate height and potentially position the tooltip partially off-screen or overlapping the trigger.

4. **Simulation Column Min-Width / Wrapping in Popover Grid (`.kl-pop-sim .kl-sim-col`)**:
   - Location: `content.js` (around line 1370)
   - Issue: The simulation container uses a rigid `grid-template-columns: 1fr 1fr` within a 290px popover without min-width safeguards on column labels, meaning longer labels (e.g., when hour annotations are added) could wrap tightly on zoomed displays or non-standard system fonts.
