const STORAGE_KEY = 'habitforge-state-v1';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const todayKey = () => formatISODate(new Date());
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function formatISODate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return formatISODate(date);
}

function memoDate(dateValue) {
  const date = typeof dateValue === 'string' && dateValue ? parseDateKey(dateValue) : new Date();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function getDefaultState() {
  return {
    tasks: [],
    habits: [],
    focusSessions: [],
    notifications: [],
    preferences: {
      darkMode: false,
      desktopNotifications: true,
      notificationPermission: 'default'
    },
    timer: {
      durationMs: 30 * 60 * 1000,
      remainingMs: 30 * 60 * 1000,
      endTime: null,
      running: false,
      sessionRecorded: false
    }
  };
}

function normalizeState(rawState) {
  const defaults = getDefaultState();
  const likely = rawState && typeof rawState === 'object' ? rawState : {};

  return {
    tasks: Array.isArray(likely.tasks) ? likely.tasks.map(task => ({
      id: task.id || uid('task'),
      title: task.title || 'Untitled task',
      description: task.description || '',
      priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
      category: task.category || '',
      dueDate: task.dueDate || '',
      dueTime: task.dueTime || '',
      completionDates: Array.isArray(task.completionDates) ? task.completionDates : [],
      createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now()
    })) : defaults.tasks,
    habits: Array.isArray(likely.habits) ? likely.habits.map(habit => ({
      id: habit.id || uid('habit'),
      name: habit.name || 'New habit',
      description: habit.description || '',
      category: habit.category || 'Personal Growth',
      target: habit.target || 'Daily',
      reminderTime: habit.reminderTime || '',
      selectedDays: Array.isArray(habit.selectedDays) && habit.selectedDays.length ? habit.selectedDays : [0, 1, 2, 3, 4, 5, 6],
      completionDates: Array.isArray(habit.completionDates) ? habit.completionDates : [],
      createdDate: habit.createdDate || todayKey()
    })) : defaults.habits,
    focusSessions: Array.isArray(likely.focusSessions) ? likely.focusSessions : defaults.focusSessions,
    notifications: Array.isArray(likely.notifications) ? likely.notifications : defaults.notifications,
    preferences: {
      ...defaults.preferences,
      ...(likely.preferences || {})
    },
    timer: {
      ...defaults.timer,
      ...(likely.timer || {})
    }
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return getDefaultState();
    }
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    return getDefaultState();
  }
}

function saveState() {
  state.timer = timer;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function showView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach(element => {
    element.classList.toggle('active', element.id === `${view}View`);
  });

  document.querySelectorAll('.nav-item').forEach(element => {
    element.classList.toggle('active', element.dataset.view === view);
  });

  const sidebar = byId('sidebar');
  if (sidebar) {
    sidebar.classList.remove('open');
  }

  updatePageTitle();
}

function updatePageTitle() {
  const labelMap = {
    dashboard: 'Overview',
    tasks: 'Task manager',
    habits: 'Habit tracker',
    focus: 'Focus timer',
    stats: 'Statistics'
  };
  const pageName = byId('pageName');
  if (pageName) {
    pageName.textContent = labelMap[activeView] || 'Overview';
  }
}

function taskCompleted(task, dateKey = todayKey()) {
  return Array.isArray(task.completionDates) && task.completionDates.includes(dateKey);
}

function toggleTaskCompletion(task) {
  const today = todayKey();
  if (taskCompleted(task, today)) {
    task.completionDates = (task.completionDates || []).filter(date => date !== today);
  } else {
    task.completionDates = [...(task.completionDates || []), today];
  }
  saveState();
  render();
}

function removeTask(taskId) {
  state.tasks = state.tasks.filter(task => task.id !== taskId);
  saveState();
  render();
  addNotification('Task removed from your plan.', 'info');
  showToast('Task removed');
}

function toggleHabitCompletion(habit) {
  const today = todayKey();
  if (habit.completionDates.includes(today)) {
    habit.completionDates = habit.completionDates.filter(date => date !== today);
    addNotification(`Nice reset for ${habit.name}.`, 'info');
  } else {
    habit.completionDates = [...habit.completionDates, today];
    addNotification(`${habit.name} is complete for today.`, 'success');
  }
  saveState();
  render();
}

function deleteHabit(habitId) {
  state.habits = state.habits.filter(habit => habit.id !== habitId);
  saveState();
  render();
  addNotification('Habit removed from your routine.', 'info');
  showToast('Habit removed');
}

function streakForDates(dates) {
  const uniqueDates = [...new Set(dates)].sort();
  if (!uniqueDates.length) return 0;

  let streak = 0;
  let cursor = todayKey();
  if (!uniqueDates.includes(cursor)) {
    cursor = addDays(cursor, -1);
  }

  while (uniqueDates.includes(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function bestStreak(dates) {
  const uniqueDates = [...new Set(dates)].sort();
  if (!uniqueDates.length) return 0;

  let best = 0;
  let current = 0;
  let previous = '';

  uniqueDates.forEach(date => {
    if (!previous || addDays(previous, 1) === date) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > best) best = current;
    previous = date;
  });

  return best;
}

function taskDueStatus(task) {
  if (!task.dueDate) return 'none';
  const dueDateTime = new Date(`${task.dueDate}T${task.dueTime || '23:59'}:00`).getTime();
  const now = Date.now();
  if (taskCompleted(task)) return 'done';
  if (dueDateTime < now) return 'overdue';
  if (task.dueDate === todayKey()) return 'today';
  return 'upcoming';
}

function getTaskPriorityWeight(priority) {
  const weights = { high: 0, medium: 1, low: 2 };
  return weights[priority] ?? 1;
}

function renderDashboard() {
  const today = todayKey();
  const todayTasks = state.tasks;
  const completedToday = todayTasks.filter(task => taskCompleted(task, today)).length;
  const percent = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  const allDates = [...new Set([
    ...state.tasks.flatMap(task => task.completionDates || []),
    ...state.habits.flatMap(habit => habit.completionDates || [])
  ])];
  const currentStreak = streakForDates(allDates);
  const highestStreak = bestStreak(allDates);

  byId('greeting').textContent = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  byId('currentDate').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).toUpperCase();
  byId('topDate').textContent = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  byId('motivation').textContent = percent >= 70 ? 'Momentum is looking strong.' : percent >= 30 ? 'One good step at a time.' : 'Start small. Just begin.';
  byId('progressPercent').textContent = `${percent}%`;
  byId('progressBar').style.width = `${percent}%`;
  byId('ringLabel').textContent = `${percent}%`;
  byId('progressRing').style.background = `conic-gradient(#f4d26a ${percent * 3.6}deg, rgba(255,255,255,0.18) 0deg)`;
  byId('progressDetail').textContent = `${completedToday} of ${todayTasks.length || 0} tasks complete`;
  byId('progressStatus').textContent = todayTasks.length === 0 ? 'A fresh start' : percent >= 100 ? 'All clear' : percent >= 50 ? 'Keep going' : 'One step at a time';
  byId('completedToday').textContent = completedToday;
  byId('currentStreak').textContent = currentStreak;
  byId('bestStreak').textContent = `${highestStreak} ${highestStreak === 1 ? 'day' : 'days'}`;
  byId('focusToday').textContent = state.focusSessions.filter(session => session.date === today).length;

  const dashboardTasks = state.tasks.slice().sort((a, b) => {
    const aDone = taskCompleted(a) ? 1 : 0;
    const bDone = taskCompleted(b) ? 1 : 0;
    return aDone - bDone || getTaskPriorityWeight(a.priority) - getTaskPriorityWeight(b.priority);
  }).slice(0, 4);

  byId('dashboardTasks').innerHTML = dashboardTasks.length
    ? dashboardTasks.map(task => {
        const done = taskCompleted(task, today);
        const dueText = getDueText(task);
        return `
          <div class="task-item ${done ? 'done' : ''}" data-task-id="${task.id}">
            <button class="check-button" type="button" data-task-action="toggle">${done ? '✓' : ''}</button>
            <div class="task-copy">
              <span class="task-name">${escapeHtml(task.title)}</span>
              <div class="task-meta">
                <span class="priority-dot ${task.priority}"></span>
                <span>${task.priority[0].toUpperCase() + task.priority.slice(1)}</span>
                ${task.category ? `<span class="category-tag">${escapeHtml(task.category)}</span>` : ''}
                ${dueText ? `<span class="meta-pill ${taskDueStatus(task) === 'overdue' ? 'overdue' : ''}">${escapeHtml(dueText)}</span>` : ''}
              </div>
            </div>
            <div class="task-actions">
              <button class="small-action" type="button" data-task-action="edit" aria-label="Edit task">✎</button>
              <button class="small-action" type="button" data-task-action="delete" aria-label="Delete task">×</button>
            </div>
          </div>`;
      }).join('')
    : '<div class="empty-state"><span>✦</span>No tasks yet. Create your first win.</div>';

  const dashboardHabits = state.habits.slice(0, 4);
  byId('dashboardHabits').innerHTML = dashboardHabits.length
    ? dashboardHabits.map(habit => {
        const done = habit.completionDates.includes(today);
        const streak = streakForDates(habit.completionDates);
        return `
          <div class="habit-row" data-habit-id="${habit.id}">
            <span class="habit-icon">↗</span>
            <div class="habit-info">
              <strong>${escapeHtml(habit.name)}</strong>
              <span>${escapeHtml(habit.target || 'Daily')} · ${streak} day streak</span>
            </div>
            <button class="habit-complete ${done ? 'done' : ''}" type="button" data-habit-action="toggle" aria-label="Toggle habit completion">${done ? '✓' : ''}</button>
          </div>`;
      }).join('')
    : '<div class="empty-state"><span>↗</span>No habits yet. Build a small routine.</div>';

  const upcoming = state.tasks
    .filter(task => task.dueDate && !taskCompleted(task))
    .sort((a, b) => new Date(`${a.dueDate}T${a.dueTime || '23:59'}`).getTime() - new Date(`${b.dueDate}T${b.dueTime || '23:59'}`).getTime())
    .slice(0, 4);

  byId('upcomingTasks').innerHTML = upcoming.length
    ? upcoming.map(task => `
        <div class="mini-item">
          <div>
            <strong>${escapeHtml(task.title)}</strong>
            <span>${task.dueDate ? memoDate(task.dueDate) : 'No due date'} · ${task.priority}</span>
          </div>
          <span class="priority-dot ${task.priority}"></span>
        </div>`).join('')
    : '<div class="empty-state small-empty">No upcoming deadlines.</div>';

  const notificationsPreview = state.notifications.slice(0, 3);
  byId('recentNotifications').innerHTML = notificationsPreview.length
    ? notificationsPreview.map(item => `
        <div class="mini-item notification-item">
          <div>
            <strong>${escapeHtml(item.title || 'Update')}</strong>
            <span>${escapeHtml(item.message)}</span>
          </div>
          <span class="notification-chip ${item.type}">${item.type}</span>
        </div>`).join('')
    : '<div class="empty-state small-empty">Everything is calm right now.</div>';

  const neverMiss = state.habits.find(habit => {
    if (!habit.completionDates.length) return false;
    const latest = [...new Set(habit.completionDates)].sort().slice(-1)[0];
    return latest && latest < addDays(today, -1) && !habit.completionDates.includes(addDays(today, -1));
  });

  if (neverMiss) {
    byId('neverMissTitle').textContent = `A missed day is not failure. Pick up ${neverMiss.name} tomorrow.`;
    byId('neverMissText').textContent = 'Never miss twice. One small step is enough.';
  } else {
    byId('neverMissTitle').textContent = 'Consistency is built one day at a time.';
    byId('neverMissText').textContent = 'A missed day is information, not failure.';
  }
}

function getDueText(task) {
  if (!task.dueDate) return '';
  const date = parseDateKey(task.dueDate);
  const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (!task.dueTime) return formatted;
  return `${formatted} · ${task.dueTime}`;
}

function renderTaskList(tasks) {
  const list = byId('tasksList');
  if (!list) return;

  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state"><span>✓</span>No tasks match your filters.</div>';
    return;
  }

  list.innerHTML = tasks.map(task => {
    const done = taskCompleted(task, todayKey());
    const dueState = taskDueStatus(task);
    const dueText = getDueText(task);
    return `
      <div class="task-item ${done ? 'done' : ''} ${dueState === 'overdue' ? 'overdue-item' : ''}" data-task-id="${task.id}">
        <button class="check-button" type="button" data-task-action="toggle" aria-label="Toggle task completion">${done ? '✓' : ''}</button>
        <div class="task-copy">
          <span class="task-name">${escapeHtml(task.title)}</span>
          ${task.description ? `<span class="task-description">${escapeHtml(task.description)}</span>` : ''}
          <div class="task-meta">
            <span class="priority-dot ${task.priority}"></span>
            <span>${task.priority[0].toUpperCase() + task.priority.slice(1)}</span>
            ${task.category ? `<span class="category-tag">${escapeHtml(task.category)}</span>` : ''}
            ${dueText ? `<span class="meta-pill ${dueState === 'overdue' ? 'overdue' : ''}">${escapeHtml(dueText)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="small-action" type="button" data-task-action="edit" aria-label="Edit task">✎</button>
          <button class="small-action" type="button" data-task-action="delete" aria-label="Delete task">×</button>
        </div>
      </div>`;
  }).join('');
}

function renderTasks() {
  const searchTerm = (byId('taskSearch')?.value || '').trim().toLowerCase();
  let tasks = [...state.tasks];

  if (taskFilter === 'active') {
    tasks = tasks.filter(task => !taskCompleted(task, todayKey()));
  }

  if (taskFilter === 'completed') {
    tasks = tasks.filter(task => taskCompleted(task, todayKey()));
  }

  if (taskFilter === 'today') {
    tasks = tasks.filter(task => {
      if (taskCompleted(task, todayKey())) return true;
      return task.dueDate === todayKey() || (!task.dueDate && task.createdAt);
    });
  }

  if (taskFilter === 'upcoming') {
    tasks = tasks.filter(task => !taskCompleted(task, todayKey()) && task.dueDate && task.dueDate >= todayKey());
  }

  if (searchTerm) {
    tasks = tasks.filter(task => task.title.toLowerCase().includes(searchTerm));
  }

  if (taskSort === 'priority') {
    tasks.sort((a, b) => getTaskPriorityWeight(a.priority) - getTaskPriorityWeight(b.priority));
  } else if (taskSort === 'due') {
    tasks.sort((a, b) => {
      const aDate = a.dueDate ? new Date(`${a.dueDate}T${a.dueTime || '23:59'}`).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.dueDate ? new Date(`${b.dueDate}T${b.dueTime || '23:59'}`).getTime() : Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
  } else {
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  renderTaskList(tasks);

  const allTaskCount = byId('allTaskCount');
  if (allTaskCount) {
    allTaskCount.textContent = state.tasks.length;
  }
}

function renderHabits() {
  const container = byId('habitsList');
  if (!container) return;

  if (!state.habits.length) {
    container.innerHTML = '<div class="empty-state"><span>✦</span>No habits yet. Add one simple routine.</div>';
    return;
  }

  const lastWeek = Array.from({ length: 7 }, (_, index) => addDays(todayKey(), index - 6));

  container.innerHTML = state.habits.map(habit => {
    const current = streakForDates(habit.completionDates);
    const best = bestStreak(habit.completionDates);
    const rate = habit.completionDates.length ? Math.min(100, Math.round((habit.completionDates.length / Math.max(1, 30)) * 100)) : 0;
    const doneToday = habit.completionDates.includes(todayKey());

    return `
      <article class="panel habit-card" data-habit-id="${habit.id}">
        <div class="habit-card-head">
          <div class="habit-card-title">
            <span class="habit-icon">↗</span>
            <div>
              <h3>${escapeHtml(habit.name)}</h3>
              <p>${escapeHtml(habit.category || 'Personal Growth')}</p>
            </div>
          </div>
          <button class="delete-habit" type="button" data-habit-action="delete" aria-label="Delete habit">×</button>
        </div>
        ${habit.description ? `<p class="habit-description">${escapeHtml(habit.description)}</p>` : ''}
        <div class="habit-stats">
          <div>
            <strong>${current}</strong>
            <span>Current streak</span>
          </div>
          <div>
            <strong>${best}</strong>
            <span>Best streak</span>
          </div>
          <div>
            <strong>${rate}%</strong>
            <span>Progress</span>
          </div>
        </div>
        <div class="week-labels">
          ${lastWeek.map(day => `<span>${DAY_NAMES[parseDateKey(day).getDay()]}</span>`).join('')}
        </div>
        <div class="week-dots">
          ${lastWeek.map(day => `<span class="week-dot ${habit.completionDates.includes(day) ? 'done' : ''} ${day === todayKey() ? 'today' : ''}">${habit.completionDates.includes(day) ? '✓' : ''}</span>`).join('')}
        </div>
        <div class="habit-footer">
          <span>${escapeHtml(habit.target || 'Daily goal')}</span>
          <button class="primary-button compact" type="button" data-habit-action="toggle">${doneToday ? 'Completed ✓' : 'Complete today'}</button>
        </div>
      </article>`;
  }).join('');
}

function renderStats() {
  const allCompletedDates = [...new Set([
    ...state.tasks.flatMap(task => task.completionDates || []),
    ...state.habits.flatMap(habit => habit.completionDates || [])
  ])];
  const currentStreak = streakForDates(allCompletedDates);
  const best = bestStreak(allCompletedDates);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(todayKey(), index - 6));
  const chartValues = weekDates.map(day => {
    const taskCount = state.tasks.filter(task => (task.completionDates || []).includes(day)).length;
    const habitCount = state.habits.filter(habit => (habit.completionDates || []).includes(day)).length;
    return taskCount + habitCount;
  });
  const maxValue = Math.max(1, ...chartValues);

  const statsGrid = byId('statsGrid');
  if (statsGrid) {
    const todayCompleted = state.tasks.filter(task => taskCompleted(task, todayKey())).length;
    const weeklyCompleted = state.tasks.filter(task => {
      const completions = task.completionDates || [];
      return weekDates.some(day => completions.includes(day));
    }).length;
    const totalFocusMinutes = state.focusSessions.reduce((sum, session) => sum + (session.durationMinutes || 0), 0);
    const completionRate = state.tasks.length ? Math.round((todayCompleted / state.tasks.length) * 100) : 0;

    statsGrid.innerHTML = `
      <article class="panel stat-card">
        <span class="mini-icon orange">✓</span>
        <p class="eyebrow">TASKS TODAY</p>
        <h2>${todayCompleted}</h2>
        <div class="thin-bar"><span style="width:${completionRate}%"></span></div>
      </article>
      <article class="panel stat-card">
        <span class="mini-icon blue">7</span>
        <p class="eyebrow">WEEKLY TASKS</p>
        <h2>${weeklyCompleted}</h2>
        <span class="subtle">Completed in the last 7 days</span>
      </article>
      <article class="panel stat-card">
        <span class="mini-icon green">%</span>
        <p class="eyebrow">CURRENT STREAK</p>
        <h2>${currentStreak} <small>days</small></h2>
        <span class="subtle">Best: ${best} day(s)</span>
      </article>
      <article class="panel stat-card">
        <span class="mini-icon flame">◷</span>
        <p class="eyebrow">FOCUS TIME</p>
        <h2>${totalFocusMinutes} <small>min</small></h2>
        <span class="subtle">Across ${state.focusSessions.length} sessions</span>
      </article>
    `;
  }

  const chart = byId('weekChart');
  if (chart) {
    chart.innerHTML = weekDates.map(day => {
      const count = chartValues[weekDates.indexOf(day)] || 0;
      const height = Math.max(10, (count / maxValue) * 100);
      return `
        <div class="day-column">
          <div class="day-bar ${day === todayKey() ? 'today' : ''}" style="height:${height}%"><span>${count}</span></div>
          <small>${DAY_NAMES[parseDateKey(day).getDay()].slice(0, 3)}</small>
        </div>`;
    }).join('');
  }
}

function renderNotificationCenter() {
  const container = byId('notificationList');
  const badge = byId('notificationBadge');
  const countText = byId('notificationCountText');
  const unreadCount = state.notifications.length;

  if (badge) badge.textContent = unreadCount;
  if (countText) countText.textContent = unreadCount;

  if (!container) return;

  if (!state.notifications.length) {
    container.innerHTML = '<div class="empty-state small-empty">No notifications yet. Start with a task or habit.</div>';
    return;
  }

  container.innerHTML = [...state.notifications].reverse().map(item => `
    <div class="notification-item-card ${item.type}">
      <div class="notification-row">
        <span class="notification-dot"></span>
        <div>
          <strong>${escapeHtml(item.title || 'Update')}</strong>
          <p>${escapeHtml(item.message)}</p>
        </div>
      </div>
      <small>${new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
    </div>`).join('');

  container.scrollTop = container.scrollHeight;
}

function showToast(message) {
  const toast = byId('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function addNotification(message, type = 'info', title = 'HabitForge') {
  state.notifications.push({
    id: uid('notification'),
    title,
    message,
    type,
    createdAt: Date.now()
  });
  saveState();
  renderNotificationCenter();
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    state.preferences.notificationPermission = 'unsupported';
    saveState();
    render();
    showToast('Browser notifications are not supported here.');
    return;
  }

  if (state.preferences.notificationPermission === 'denied') {
    showToast('Notifications are blocked in your browser settings.');
    return;
  }

  Notification.requestPermission().then(permission => {
    state.preferences.notificationPermission = permission;
    state.preferences.desktopNotifications = permission === 'granted';
    saveState();
    render();

    if (permission === 'granted') {
      showToast('Notifications enabled');
      addNotification('Desktop notifications are now enabled.', 'success', 'Notifications');
    }
  }).catch(() => {
    showToast('Unable to enable notifications right now.');
  });
}

function notifyDesktop(title, message) {
  if (!state.preferences.desktopNotifications) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body: message, silent: false });
  } catch (error) {
    console.warn('Notification failed', error);
  }
}

function renderTheme() {
  document.body.classList.toggle('dark', state.preferences.darkMode);
  const label = byId('themeLabel');
  if (label) {
    label.textContent = state.preferences.darkMode ? 'Light mode' : 'Dark mode';
  }
}

function renderTimer() {
  const display = byId('timerDisplay');
  if (display) {
    const minutes = Math.floor(timer.remainingMs / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((timer.remainingMs % 60000) / 1000).toString().padStart(2, '0');
    display.textContent = `${minutes}:${seconds}`;
  }

  const progress = byId('timerProgress');
  if (progress) {
    const ratio = timer.durationMs > 0 ? (timer.durationMs - timer.remainingMs) / timer.durationMs : 0;
    progress.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  }

  const startButton = byId('timerStart');
  if (startButton) {
    startButton.textContent = timer.running ? 'Running' : 'Start';
    startButton.disabled = timer.running;
  }

  const select = byId('timerTaskSelect');
  if (select) {
    const currentValue = select.value;
    const options = ['<option value="">No task selected</option>'];

    state.tasks.filter(task => !taskCompleted(task, todayKey())).forEach(task => {
      options.push(`<option value="${task.id}" ${task.id === currentValue ? 'selected' : ''}>${escapeHtml(task.title)}</option>`);
    });

    select.innerHTML = options.join('');
    if (currentValue) {
      select.value = currentValue;
    }
  }

  const label = byId('timerTaskLabel');
  if (label) {
    const selected = state.tasks.find(task => task.id === byId('timerTaskSelect')?.value);
    label.textContent = selected ? selected.title : 'Choose a task to begin';
  }
}

function finishTimerSession() {
  if (timer.sessionRecorded) return;
  timer.sessionRecorded = true;
  timer.running = false;
  timer.remainingMs = timer.durationMs;
  timer.endTime = null;

  const taskId = byId('timerTaskSelect')?.value || '';
  const minutes = Math.round((timer.durationMs || 0) / 60000);

  state.focusSessions.push({
    id: uid('session'),
    taskId,
    durationMinutes: minutes,
    date: todayKey(),
    completedAt: Date.now()
  });

  saveState();
  render();
  addNotification('Focus session complete. Your next action starts now.', 'success', 'Timer');
  notifyDesktop('Focus session complete', 'Nice work. Take a short break or keep moving.');
  showToast('Focus session completed');
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timer.sessionRecorded = false;
  if (!timer.endTime || timer.remainingMs <= 0) {
    timer.remainingMs = timer.durationMs;
  }
  timer.endTime = Date.now() + timer.remainingMs;
  saveState();
  renderTimer();

  if (timer.tickHandle) {
    window.clearInterval(timer.tickHandle);
  }

  timer.tickHandle = window.setInterval(() => {
    if (!timer.running || !timer.endTime) return;
    const calculation = timer.endTime - Date.now();
    timer.remainingMs = Math.max(0, calculation);
    if (timer.remainingMs <= 0) {
      window.clearInterval(timer.tickHandle);
      timer.tickHandle = null;
      finishTimerSession();
      return;
    }
    renderTimer();
    saveState();
  }, 250);
}

function pauseTimer() {
  if (!timer.running) return;
  timer.running = false;
  timer.endTime = null;
  if (timer.tickHandle) {
    window.clearInterval(timer.tickHandle);
    timer.tickHandle = null;
  }
  saveState();
  renderTimer();
}

function resetTimer() {
  timer.running = false;
  timer.remainingMs = timer.durationMs;
  timer.endTime = null;
  timer.sessionRecorded = false;
  if (timer.tickHandle) {
    window.clearInterval(timer.tickHandle);
    timer.tickHandle = null;
  }
  saveState();
  renderTimer();
}

function openTaskModal(task = null) {
  byId('editingTaskId').value = task ? task.id : '';
  byId('taskModalEyebrow').textContent = task ? 'EDIT TASK' : 'NEW TASK';
  byId('taskModalTitle').textContent = task ? 'Edit task' : 'Add a task';
  byId('taskTitle').value = task ? task.title : '';
  byId('taskDescription').value = task ? task.description : '';
  byId('taskPriority').value = task ? task.priority : 'medium';
  byId('taskCategory').value = task ? task.category : '';
  byId('taskDueDate').value = task ? task.dueDate : '';
  byId('taskDueTime').value = task ? task.dueTime : '';
  byId('taskModal').classList.add('open');
}

function openHabitModal(habit = null) {
  byId('editingHabitId').value = habit ? habit.id : '';
  byId('habitName').value = habit ? habit.name : '';
  byId('habitDescription').value = habit ? habit.description : '';
  byId('habitCategory').value = habit ? habit.category : 'Personal Growth';
  byId('habitTarget').value = habit ? habit.target : '';
  byId('habitReminderTime').value = habit ? habit.reminderTime : '';

  const selectedDays = habit ? habit.selectedDays : [0, 1, 2, 3, 4, 5, 6];
  document.querySelectorAll('input[name="habitDays"]').forEach(input => {
    input.checked = selectedDays.includes(Number(input.value));
  });

  byId('habitModal').classList.add('open');
}

function closeModal(modalId) {
  const modal = byId(modalId);
  if (modal) {
    modal.classList.remove('open');
  }
}

function renderHeader() {
  const date = new Date();
  byId('greeting').textContent = date.getHours() < 12 ? 'Good morning' : date.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  byId('currentDate').textContent = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).toUpperCase();
  byId('topDate').textContent = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const navTaskCount = byId('navTaskCount');
  if (navTaskCount) {
    navTaskCount.textContent = state.tasks.length;
  }
}

function render() {
  renderHeader();
  renderDashboard();
  renderTasks();
  renderHabits();
  renderStats();
  renderNotificationCenter();
  renderTheme();
  renderTimer();
  updatePageTitle();
}

let state = loadState();
let activeView = 'dashboard';
let taskFilter = 'all';
let taskSort = 'created';
let timer = { ...getDefaultState().timer, ...state.timer };

if (timer.running && timer.endTime) {
  const remaining = timer.endTime - Date.now();
  if (remaining > 0) {
    timer.remainingMs = remaining;
  } else {
    timer.running = false;
    timer.remainingMs = timer.durationMs;
    timer.endTime = null;
  }
}

if (!state.notifications.length) {
  state.notifications = [
    {
      id: uid('notification'),
      title: 'Daily focus',
      message: 'Your habit streak starts with one small action.',
      type: 'info',
      createdAt: Date.now()
    }
  ];
}

saveState();

byId('themeToggle')?.addEventListener('click', () => {
  state.preferences.darkMode = !state.preferences.darkMode;
  saveState();
  renderTheme();
});

byId('notificationCenterButton')?.addEventListener('click', () => {
  const panel = byId('notificationPanel');
  if (panel) {
    panel.classList.toggle('open');
  }
});

byId('notificationsButton')?.addEventListener('click', () => {
  const panel = byId('notificationPanel');
  if (panel) {
    panel.classList.toggle('open');
  }
});

byId('enableNotificationsButton')?.addEventListener('click', requestNotificationPermission);

byId('menuButton')?.addEventListener('click', () => {
  byId('sidebar')?.classList.toggle('open');
});

document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

document.querySelectorAll('[data-view-link]').forEach(link => {
  link.addEventListener('click', () => showView(link.dataset.viewLink));
});

byId('taskAddButton')?.addEventListener('click', () => openTaskModal());
byId('quickAddButton')?.addEventListener('click', () => openTaskModal());
byId('habitAddButton')?.addEventListener('click', () => openHabitModal());

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => closeModal(button.dataset.close));
});

byId('taskModal')?.addEventListener('click', event => {
  if (event.target === byId('taskModal')) closeModal('taskModal');
});

byId('habitModal')?.addEventListener('click', event => {
  if (event.target === byId('habitModal')) closeModal('habitModal');
});

byId('notificationPanel')?.addEventListener('click', event => {
  if (event.target === byId('notificationPanel')) {
    byId('notificationPanel').classList.remove('open');
  }
});

byId('taskForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const id = byId('editingTaskId').value;
  const payload = {
    title: byId('taskTitle').value.trim(),
    description: byId('taskDescription').value.trim(),
    priority: byId('taskPriority').value,
    category: byId('taskCategory').value,
    dueDate: byId('taskDueDate').value,
    dueTime: byId('taskDueTime').value,
    completionDates: []
  };

  if (!payload.title) {
    showToast('Task title is required.');
    return;
  }

  const existing = state.tasks.find(task => task.id === id);

  if (existing) {
    Object.assign(existing, payload);
    showToast('Task updated');
    addNotification(`Updated ${payload.title}.`, 'info', 'Task');
  } else {
    state.tasks.push({
      id: uid('task'),
      ...payload,
      createdAt: Date.now()
    });
    showToast('Task added');
    addNotification(`Added ${payload.title} to your plan.`, 'success', 'Task');
  }

  closeModal('taskModal');
  saveState();
  render();
});

byId('habitForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const id = byId('editingHabitId')?.value || '';
  const name = byId('habitName').value.trim();
  const description = byId('habitDescription').value.trim();
  const category = byId('habitCategory').value;
  const target = byId('habitTarget').value.trim();
  const reminderTime = byId('habitReminderTime').value;
  const selectedDays = Array.from(document.querySelectorAll('input[name="habitDays"]:checked')).map(item => Number(item.value));

  if (!name) {
    showToast('Habit name is required.');
    return;
  }

  const habitData = {
    name,
    description,
    category,
    target,
    reminderTime,
    selectedDays: selectedDays.length ? selectedDays : [0, 1, 2, 3, 4, 5, 6],
    completionDates: []
  };

  const existing = state.habits.find(habit => habit.id === id);

  if (existing) {
    Object.assign(existing, habitData);
    addNotification(`Updated ${name}.`, 'info', 'Habit');
  } else {
    state.habits.push({ id: uid('habit'), createdDate: todayKey(), ...habitData });
    addNotification(`Added ${name} to your routine.`, 'success', 'Habit');
  }

  closeModal('habitModal');
  saveState();
  render();
});

byId('taskSearch')?.addEventListener('input', renderTasks);

byId('taskSort')?.addEventListener('change', event => {
  taskSort = event.target.value;
  renderTasks();
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    taskFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach(node => node.classList.toggle('active', node === button));
    renderTasks();
  });
});

byId('timerStart')?.addEventListener('click', startTimer);
byId('timerPause')?.addEventListener('click', pauseTimer);
byId('timerReset')?.addEventListener('click', resetTimer);

document.querySelectorAll('[data-minutes]').forEach(button => {
  button.addEventListener('click', () => {
    const minutes = Number(button.dataset.minutes);
    const buttons = document.querySelectorAll('.duration');
    buttons.forEach(item => item.classList.toggle('active', item === button));

    timer.durationMs = minutes * 60 * 1000;
    timer.remainingMs = timer.durationMs;
    timer.endTime = null;
    timer.running = false;
    if (timer.tickHandle) {
      window.clearInterval(timer.tickHandle);
      timer.tickHandle = null;
    }
    saveState();
    renderTimer();
  });
});

document.addEventListener('click', event => {
  const taskAction = event.target.closest('[data-task-action]');
  if (taskAction) {
    const taskId = taskAction.closest('[data-task-id]')?.dataset.taskId;
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;

    const action = taskAction.dataset.taskAction;
    if (action === 'toggle') {
      toggleTaskCompletion(task);
    }
    if (action === 'delete') {
      removeTask(task.id);
    }
    if (action === 'edit') {
      openTaskModal(task);
    }
  }

  const habitAction = event.target.closest('[data-habit-action]');
  if (habitAction) {
    const habitId = habitAction.closest('[data-habit-id]')?.dataset.habitId;
    const habit = state.habits.find(item => item.id === habitId);
    if (!habit) return;

    const action = habitAction.dataset.habitAction;
    if (action === 'toggle') {
      toggleHabitCompletion(habit);
    }
    if (action === 'delete') {
      deleteHabit(habit.id);
    }
  }
});

window.addEventListener('beforeunload', () => {
  if (timer.running && timer.endTime) {
    state.timer = { ...timer };
    saveState();
  }
});

render();
renderTimer();

if (timer.running && timer.endTime) {
  startTimer();
}
