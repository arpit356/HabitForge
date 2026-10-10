# HabitForge

HabitForge is a local-first productivity dashboard for study, coding, learning, and personal routines.

**Small actions. Every day.**

## Overview

HabitForge is built as a lightweight vanilla HTML, CSS, and JavaScript app with no backend, no database, and no dependency install step. It keeps everything local in the browser using `localStorage`, making it fast, private, and easy to use.

## Run it

You can open `index.html` directly in a browser, or serve the project locally for a smoother experience:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Features

- Dashboard overview with progress cards and daily momentum tracking
- Task manager with add, edit, delete, complete, search, and priority sorting
- Habit tracker with streaks, target labels, repeat-day selection, and seven-day history
- Focus timer for 15, 30, and 45 minute sessions
- Statistics view with weekly completion data and consistency trends
- Local notifications center for habit and task updates
- Dark mode preference saved in the browser
- Responsive desktop/mobile layout with sidebar navigation and modals

## Project structure

- `index.html` — application shell, navigation, views, modal forms, and timer layout
- `style.css` — design system, dashboard styling, responsive layout, and dark mode visuals
- `script.js` — application state, rendering logic, task/habit logic, timer behavior, notifications, and persistence

## Local-first architecture

The app stores its full state in a single `localStorage` key named `habitforge-state-v1`.

This includes:

- tasks
- habits
- focus sessions
- notifications
- user preferences
- timer state

Task and habit completion data is stored as ISO date keys (`completionDates`), which makes streak tracking, weekly charts, and daily progress easy to derive without storing a backend database.

## Streak logic

The current streak is calculated from consecutive completion dates ending at today. If a task or habit was not completed today, the logic can continue from yesterday so the dashboard remains meaningful before the day is over.

The best streak scans all stored completion dates in order and finds the longest consecutive run. This same logic is used for habits and aggregated daily activity.

The "Never Miss Twice" encouragement is triggered when a habit has a recent gap and the user has not yet returned to the routine.

## Notes

HabitForge intentionally keeps the app simple and portable. It is designed for personal tracking, learning routines, and small daily wins without requiring a framework or server-side infrastructure.
