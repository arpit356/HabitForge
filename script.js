const STORAGE_KEY = 'habitforge-state-v1';
const todayKey = () => new Date().toISOString().slice(0, 10);
const dateFromKey = key => new Date(`${key}T12:00:00`);
const addDays = (key, amount) => { const date = dateFromKey(key); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };
const prettyDate = date => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const defaultState = {
  tasks: [],
  habits: [
    { id: uid('habit'), name: 'Java practice', target: '30 min', createdDate: todayKey(), completionDates: [] },
    { id: uid('habit'), name: 'Cybersecurity learning', target: '30 min', createdDate: todayKey(), completionDates: [] },
    { id: uid('habit'), name: 'Reading', target: '20 min', createdDate: todayKey(), completionDates: [] }
  ],
  focusSessions: [],
  preferences: { darkMode: false }
};

let state = loadState();
let activeView = 'dashboard';
let taskFilter = 'all';
let timer = { seconds: 1800, total: 1800, interval: null, running: false };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return defaultState;
    return { ...defaultState, ...saved, tasks: saved.tasks || [], habits: saved.habits || [], focusSessions: saved.focusSessions || [], preferences: { ...defaultState.preferences, ...(saved.preferences || {}) } };
  } catch { return defaultState; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function byId(id) { return document.getElementById(id); }
function isToday(value) { return value === todayKey(); }
function completedOn(item, date = todayKey()) { return item.completionDates.includes(date); }
function activeTasks() { return state.tasks.filter(task => task.createdDate === todayKey()); }
function dateRange(days = 7) { return Array.from({ length: days }, (_, index) => addDays(todayKey(), index - days + 1)); }
function allActivityDates() {
  const dates = new Set();
  state.tasks.forEach(task => task.completionDates.forEach(date => dates.add(date)));
  state.habits.forEach(habit => habit.completionDates.forEach(date => dates.add(date)));
  return dates;
}
function streakForDates(dates) {
  const set = new Set(dates);
  let streak = 0;
  let cursor = todayKey();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  while (set.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}
function bestStreak(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0; let current = 0; let previous = '';
  sorted.forEach(date => { current = previous && addDays(previous, 1) === date ? current + 1 : 1; best = Math.max(best, current); previous = date; });
  return best;
}
function habitStats(habit) { return { current: streakForDates(habit.completionDates), best: bestStreak(habit.completionDates) }; }
function taskCompletion(task) { if (!task.completionDates.includes(todayKey())) task.completionDates.push(todayKey()); }
function removeTodayCompletion(task) { task.completionDates = task.completionDates.filter(date => date !== todayKey()); }

function render() {
  renderHeader(); renderDashboard(); renderTasks(); renderHabits(); renderStats(); renderTimerTasks();
  document.body.classList.toggle('dark', state.preferences.darkMode);
  byId('themeLabel').textContent = state.preferences.darkMode ? 'Light mode' : 'Dark mode';
}
function renderHeader() {
  const date = new Date();
  byId('greeting').textContent = date.getHours() < 12 ? 'Good morning' : date.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  byId('currentDate').textContent = prettyDate(date).toUpperCase();
  byId('topDate').textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  byId('pageName').textContent = activeView === 'dashboard' ? 'Overview' : activeView[0].toUpperCase() + activeView.slice(1);
  byId('navTaskCount').textContent = activeTasks().filter(task => !completedOn(task)).length;
}
function renderDashboard() {
  const tasks = activeTasks(); const completed = tasks.filter(task => completedOn(task)).length; const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const activities = allActivityDates(); const streak = streakForDates(activities); const best = bestStreak(activities);
  byId('progressPercent').textContent = `${percent}%`; byId('ringLabel').textContent = `${percent}%`; byId('progressBar').style.width = `${percent}%`; byId('progressRing').style.background = `conic-gradient(#f5c95e ${percent * 3.6}deg, rgba(255,255,255,.14) 0deg)`;
  byId('progressDetail').textContent = `${completed} of ${tasks.length} tasks complete`; byId('progressStatus').textContent = percent === 100 && tasks.length ? 'All clear' : percent ? 'Keep going' : 'A fresh start';
  byId('completedToday').textContent = completed; byId('currentStreak').textContent = streak; byId('bestStreak').textContent = `${best} ${best === 1 ? 'day' : 'days'}`; byId('focusToday').textContent = state.focusSessions.filter(session => session.date === todayKey()).length;
  const message = percent === 100 && tasks.length ? 'You showed up today. 🔥' : percent >= 50 ? "You're building consistency." : tasks.length ? 'One session at a time.' : 'Start small. Just begin.';
  byId('motivation').textContent = message;
  renderTaskList(byId('dashboardTasks'), tasks.slice().sort((a, b) => Number(completedOn(a)) - Number(completedOn(b))).slice(0, 5), true);
  renderHabitRows(byId('dashboardHabits'), state.habits.slice(0, 5));
  renderNeverMiss();
}
function taskMarkup(task) {
  const done = completedOn(task);
  return `<div class="task-item ${done ? 'done' : ''}" data-task-id="${task.id}"><button class="check-button" data-action="toggle-task" aria-label="${done ? 'Mark incomplete' : 'Mark complete'}">${done ? '✓' : ''}</button><div class="task-copy"><span class="task-name">${escapeHtml(task.title)}</span><div class="task-meta"><span class="priority-dot ${task.priority}"></span><span>${task.priority[0].toUpperCase() + task.priority.slice(1)}</span>${task.category ? `<span class="category-tag">${escapeHtml(task.category)}</span>` : ''}</div></div><div class="task-actions"><button class="small-action" data-action="edit-task" aria-label="Edit task">✎</button><button class="small-action" data-action="delete-task" aria-label="Delete task">×</button></div></div>`;
}
function renderTaskList(container, tasks, compact = false) { container.innerHTML = tasks.length ? tasks.map(taskMarkup).join('') : `<div class="empty-state"><span>${compact ? '✦' : '✓'}</span>${compact ? 'No tasks for today. Make the first move.' : 'Nothing here yet. Add a task to get moving.'}</div>`; }
function renderTasks() {
  let tasks = activeTasks(); if (taskFilter === 'active') tasks = tasks.filter(task => !completedOn(task)); if (taskFilter === 'completed') tasks = tasks.filter(task => completedOn(task));
  if (byId('taskSort').value === 'priority') { const weights = { high: 0, medium: 1, low: 2 }; tasks.sort((a, b) => weights[a.priority] - weights[b.priority]); } else tasks.sort((a, b) => b.createdAt - a.createdAt);
  renderTaskList(byId('tasksList'), tasks); byId('allTaskCount').textContent = activeTasks().length;
}
function renderHabitRows(container, habits) { container.innerHTML = habits.length ? habits.map(habit => { const stats = habitStats(habit); const done = completedOn(habit); return `<div class="habit-row" data-habit-id="${habit.id}"><span class="habit-icon">↗</span><div class="habit-info"><strong>${escapeHtml(habit.name)}</strong><span>${escapeHtml(habit.target || 'Keep showing up')} · ${stats.current} day streak</span></div><button class="habit-complete ${done ? 'done' : ''}" data-action="toggle-habit" aria-label="${done ? 'Mark habit incomplete' : 'Complete habit'}">${done ? '✓' : ''}</button></div>`; }).join('') : '<div class="empty-state"><span>↗</span>Add a habit to create your rhythm.</div>'; }
function renderHabits() {
  byId('habitsList').innerHTML = state.habits.length ? state.habits.map(habit => { const stats = habitStats(habit); const done = completedOn(habit); const days = dateRange(); return `<article class="panel habit-card" data-habit-id="${habit.id}"><div class="habit-card-head"><div><span class="habit-icon">↗</span><h3>${escapeHtml(habit.name)}</h3><p class="subtle">Target: ${escapeHtml(habit.target || 'Daily')}</p></div><button class="delete-habit" data-action="delete-habit" aria-label="Delete habit">×</button></div><div class="habit-stats"><div class="habit-stat"><strong>${stats.current}</strong><span>Current streak</span></div><div class="habit-stat"><strong>${stats.best}</strong><span>Best streak</span></div><button class="primary-button" data-action="toggle-habit">${done ? 'Completed ✓' : 'Complete today'}</button></div><div class="week-labels">${days.map(day => `<span>${dateFromKey(day).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}</span>`).join('')}</div><div class="week-dots">${days.map(day => `<span class="week-dot ${habit.completionDates.includes(day) ? 'done' : ''} ${day === todayKey() ? 'today' : ''}">${habit.completionDates.includes(day) ? '✓' : ''}</span>`).join('')}</div></article>`; }).join('') : '<div class="empty-state"><span>✦</span>No habits yet. Add one small ritual.</div>';
}
function renderNeverMiss() {
  const yesterday = addDays(todayKey(), -1); const candidate = state.habits.find(habit => habit.completionDates.some(date => date < yesterday) && !habit.completionDates.includes(yesterday));
  const returned = state.habits.find(habit => completedOn(habit) && habit.completionDates.some(date => date < yesterday) && !habit.completionDates.includes(yesterday));
  if (returned) { byId('neverMissTitle').textContent = 'You came back! 🔥 Keep going.'; byId('neverMissText').textContent = 'That is consistency: returning to what matters.'; } else if (candidate) { byId('neverMissTitle').textContent = "You missed yesterday. That's okay. Don't miss today."; byId('neverMissText').textContent = `Your ${candidate.name} routine is ready when you are.`; } else { byId('neverMissTitle').textContent = 'Consistency is built one day at a time.'; byId('neverMissText').textContent = 'A missed day is information, not failure.'; }
}
function renderStats() {
  const todayTasks = activeTasks(); const todayCompleted = todayTasks.filter(task => completedOn(task)).length; const ranges = dateRange(); const weekCompleted = state.tasks.reduce((sum, task) => sum + task.completionDates.filter(date => ranges.includes(date)).length, 0); const weekTotal = state.tasks.filter(task => ranges.includes(task.createdDate)).length; const weeklyPercent = weekTotal ? Math.round(weekCompleted / weekTotal * 100) : 0; const activities = allActivityDates();
  const current = streakForDates(activities); const best = bestStreak(activities); byId('statsToday').textContent = todayCompleted; byId('statsTodayBar').style.width = `${todayTasks.length ? todayCompleted / todayTasks.length * 100 : 0}%`; byId('statsWeek').textContent = weekCompleted; byId('statsWeekPercent').textContent = `${weeklyPercent}%`; byId('statsStreak').innerHTML = `${current} <small>${current === 1 ? 'day' : 'days'}</small>`; byId('statsBest').textContent = `${best} ${best === 1 ? 'day' : 'days'}`; byId('statsFocus').textContent = state.focusSessions.length;
  byId('weekChart').innerHTML = ranges.map(day => { const count = state.tasks.filter(task => task.completionDates.includes(day)).length; const height = Math.min(100, Math.max(5, count * 20)); return `<div class="day-column"><b>${count || ''}</b><div class="day-bar ${day === todayKey() ? 'today' : ''}" style="height:${height}%"></div><small>${dateFromKey(day).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}</small></div>`; }).join('');
}
function renderTimerTasks() { const select = byId('timerTaskSelect'); const current = select.value; select.innerHTML = '<option value="">No task selected</option>' + activeTasks().filter(task => !completedOn(task)).map(task => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join(''); select.value = current; byId('timerTaskLabel').textContent = select.value ? activeTasks().find(task => task.id === select.value)?.title : 'Choose a task to begin'; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

function showView(view) { activeView = view; document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === `${view}View`)); document.querySelectorAll('.nav-item').forEach(element => element.classList.toggle('active', element.dataset.view === view)); byId('sidebar').classList.remove('open'); render(); }
function openModal(id) { byId(id).classList.add('open'); const first = byId(id).querySelector('input:not([type="hidden"])'); if (first) setTimeout(() => first.focus(), 30); }
function closeModal(id) { byId(id).classList.remove('open'); }
function notify(message) { const toast = byId('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }
function openTaskModal(task) { byId('editingTaskId').value = task?.id || ''; byId('taskModalEyebrow').textContent = task ? 'EDIT TASK' : 'NEW TASK'; byId('taskModalTitle').textContent = task ? 'Edit task' : 'Add a task'; byId('taskTitle').value = task?.title || ''; byId('taskPriority').value = task?.priority || 'medium'; byId('taskCategory').value = task?.category || ''; openModal('taskModal'); }

function handleTaskAction(event) {
  const action = event.target.closest('[data-action]')?.dataset.action; const item = event.target.closest('[data-task-id]'); if (!action || !item) return; const task = state.tasks.find(entry => entry.id === item.dataset.taskId); if (!task) return;
  if (action === 'toggle-task') { completedOn(task) ? removeTodayCompletion(task) : taskCompletion(task); saveState(); render(); }
  if (action === 'delete-task') { state.tasks = state.tasks.filter(entry => entry.id !== task.id); saveState(); render(); notify('Task removed'); }
  if (action === 'edit-task') openTaskModal(task);
}
function handleHabitAction(event) {
  const action = event.target.closest('[data-action]')?.dataset.action; const item = event.target.closest('[data-habit-id]'); if (!action || !item) return; const habit = state.habits.find(entry => entry.id === item.dataset.habitId); if (!habit) return;
  if (action === 'toggle-habit') { completedOn(habit) ? habit.completionDates = habit.completionDates.filter(date => date !== todayKey()) : habit.completionDates.push(todayKey()); saveState(); render(); notify(completedOn(habit) ? 'Habit completed. Keep going.' : 'Habit unchecked'); }
  if (action === 'delete-habit') { state.habits = state.habits.filter(entry => entry.id !== habit.id); saveState(); render(); notify('Habit removed'); }
}
function finishTimer() { clearInterval(timer.interval); timer.running = false; timer.seconds = 0; const taskId = byId('timerTaskSelect').value; state.focusSessions.push({ date: todayKey(), taskId }); saveState(); updateTimerDisplay(); render(); notify('Focus session completed! 🎯'); }
function updateTimerDisplay() { const minutes = Math.floor(timer.seconds / 60).toString().padStart(2, '0'); const seconds = (timer.seconds % 60).toString().padStart(2, '0'); byId('timerDisplay').textContent = `${minutes}:${seconds}`; byId('timerProgress').style.width = `${((timer.total - timer.seconds) / timer.total) * 100}%`; }

// Navigation, forms, and controls
 document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]'); if (nav) showView(nav.dataset.view);
  const link = event.target.closest('[data-view-link]'); if (link) showView(link.dataset.viewLink);
  const close = event.target.closest('[data-close]'); if (close) closeModal(close.dataset.close);
  if (event.target === byId('taskModal') || event.target === byId('habitModal')) closeModal(event.target.id);
  if (event.target.closest('#quickAddButton') || event.target.closest('#taskAddButton')) openTaskModal();
  if (event.target.closest('#habitAddButton')) { byId('habitForm').reset(); openModal('habitModal'); }
  if (event.target.closest('#menuButton')) byId('sidebar').classList.toggle('open');
  const filter = event.target.closest('[data-filter]'); if (filter) { taskFilter = filter.dataset.filter; document.querySelectorAll('.filter').forEach(button => button.classList.toggle('active', button === filter)); renderTasks(); }
  const duration = event.target.closest('[data-minutes]'); if (duration) { document.querySelectorAll('.duration').forEach(button => button.classList.toggle('active', button === duration)); timer.total = Number(duration.dataset.minutes) * 60; timer.seconds = timer.total; updateTimerDisplay(); }
});

document.addEventListener('click', event => { handleTaskAction(event); handleHabitAction(event); });
byId('taskForm').addEventListener('submit', event => { event.preventDefault(); const id = byId('editingTaskId').value; const existing = state.tasks.find(task => task.id === id); const details = { title: byId('taskTitle').value.trim(), priority: byId('taskPriority').value, category: byId('taskCategory').value }; if (existing) Object.assign(existing, details); else state.tasks.push({ id: uid('task'), ...details, createdDate: todayKey(), createdAt: Date.now(), completionDates: [] }); saveState(); closeModal('taskModal'); render(); notify(existing ? 'Task updated' : 'Task added'); });
byId('habitForm').addEventListener('submit', event => { event.preventDefault(); state.habits.push({ id: uid('habit'), name: byId('habitName').value.trim(), target: byId('habitTarget').value.trim(), createdDate: todayKey(), completionDates: [] }); saveState(); closeModal('habitModal'); render(); notify('Habit added'); });
byId('taskSort').addEventListener('change', renderTasks);
byId('timerTaskSelect').addEventListener('change', event => { byId('timerTaskLabel').textContent = event.target.value ? activeTasks().find(task => task.id === event.target.value)?.title : 'Choose a task to begin'; });
byId('timerStart').addEventListener('click', () => { if (timer.running) return; timer.running = true; timer.interval = setInterval(() => { if (timer.seconds > 0) { timer.seconds -= 1; updateTimerDisplay(); } else finishTimer(); }, 1000); notify('Focus session started'); });
byId('timerPause').addEventListener('click', () => { clearInterval(timer.interval); timer.running = false; });
byId('timerReset').addEventListener('click', () => { clearInterval(timer.interval); timer.running = false; timer.seconds = timer.total; updateTimerDisplay(); });
byId('themeToggle').addEventListener('click', () => { state.preferences.darkMode = !state.preferences.darkMode; saveState(); render(); });

updateTimerDisplay(); render();
