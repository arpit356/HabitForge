# HabitForge

HabitForge is a local-first personal productivity and consistency tracker for studying, coding, projects, and personal goals.

**Small actions. Every day.**

## Run it

Open `index.html` in a modern browser. No build step, backend, or dependency installation is required.

## Architecture

- `index.html` contains the app shell, dashboard views, forms, and accessible controls.
- `style.css` contains the responsive layout, design tokens, light/dark themes, cards, and interaction states.
- `script.js` owns the application state, rendering, navigation, timer, and persistence.

The app uses one `localStorage` record under `habitforge-state-v1`. Tasks and habits keep an array of ISO date keys in `completionDates`, while focus sessions retain their completion date. Rendering derives today's progress, weekly totals, and history from those dates, so a daily reset never deletes historical information.

## Streak calculation

The current streak counts consecutive completed dates ending today. If nothing was completed today, it can continue from yesterday, which keeps the dashboard useful before the first action of the day. The best streak scans all stored completion dates in order and finds the longest consecutive run. Habit streaks use that same calculation per habit.

The Never Miss Twice message checks for a habit completed before yesterday but missed yesterday. Once that habit is completed today, the message changes to a return-to-routine encouragement.

## Included V1 features

- Date-aware tasks with edit, delete, priority, category, and completion state
- Habits with targets, daily completion, current/best streaks, and seven-day history
- Focus timer with 15, 30, and 45 minute sessions
- Weekly statistics and completion bars
- Responsive desktop sidebar and mobile navigation drawer
- Light/dark mode preference stored locally
