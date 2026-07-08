window.Studio = window.Studio || {};

Studio.calendar = {
  viewDate: null,
  selectedDateId: null,

  init() {
    this.viewDate = new Date();
    this.viewDate.setDate(1);
    this.selectedDateId = this.formatDateId(new Date());

    document.getElementById('btn-calendar-prev').addEventListener('click', () => this.prevMonth());
    document.getElementById('btn-calendar-next').addEventListener('click', () => this.nextMonth());
    document.getElementById('btn-calendar-today').addEventListener('click', () => this.goToday());

    this.render();
  },

  refresh() {
    this.render();
  },

  formatDateId(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  parseDateId(dateId) {
    const [y, m, d] = dateId.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  prevMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.render();
  },

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.render();
  },

  goToday() {
    const today = new Date();
    this.viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectedDateId = this.formatDateId(today);
    this.render();
  },

  selectDay(dateId) {
    this.selectedDateId = dateId;
    this.render();
  },

  buildMonthGrid(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-start: 0=Mon..6=Sun
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  },

  buildTasksByDate() {
    const map = {};
    (Studio.goals.workspaces || []).forEach(ws => {
      const goals = Studio.goals.goalsByWorkspace[ws.id] || [];
      goals.forEach(goal => {
        goal.tasks.forEach(task => {
          if (!task.startDate || !task.endDate) return;
          const cursor = this.parseDateId(task.startDate);
          const end = this.parseDateId(task.endDate);
          while (cursor <= end) {
            const dateId = this.formatDateId(cursor);
            if (!map[dateId]) map[dateId] = [];
            map[dateId].push({ ws, goal, task });
            cursor.setDate(cursor.getDate() + 1);
          }
        });
      });
    });
    return map;
  },

  render() {
    const label = document.getElementById('calendar-month-label');
    label.textContent = this.viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'calendar-weekday';
      el.textContent = d;
      grid.appendChild(el);
    });

    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const cells = this.buildMonthGrid(year, month);
    const todayId = this.formatDateId(new Date());
    const tasksByDate = this.buildTasksByDate();

    cells.forEach(date => {
      const cell = document.createElement('div');
      cell.className = 'calendar-day';

      if (!date) {
        cell.classList.add('calendar-day-empty');
        grid.appendChild(cell);
        return;
      }

      const dateId = this.formatDateId(date);
      if (dateId === todayId) cell.classList.add('calendar-day-today');
      if (dateId === this.selectedDateId) cell.classList.add('calendar-day-selected');

      const num = document.createElement('div');
      num.className = 'calendar-day-number';
      num.textContent = date.getDate();
      cell.appendChild(num);

      if (tasksByDate[dateId] && tasksByDate[dateId].length > 0) {
        const dot = document.createElement('div');
        dot.className = 'calendar-day-dot';
        cell.appendChild(dot);
      }

      cell.addEventListener('click', () => this.selectDay(dateId));
      grid.appendChild(cell);
    });

    this.renderDayDetail();
  },

  renderDayDetail() {
    const title = document.getElementById('calendar-day-detail-title');
    const list = document.getElementById('calendar-day-task-list');
    list.innerHTML = '';

    if (!this.selectedDateId) {
      title.textContent = '';
      return;
    }

    const date = this.parseDateId(this.selectedDateId);
    title.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const entries = this.buildTasksByDate()[this.selectedDateId] || [];

    if (entries.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'Nothing due this day.';
      list.appendChild(el);
      return;
    }

    entries.forEach(({ ws, goal, task }) => {
      const row = document.createElement('div');
      row.className = 'home-task-row';

      const checkbox = document.createElement('div');
      checkbox.className = 'task-checkbox' + (task.checked ? ' checked' : '');
      checkbox.addEventListener('click', () => this.toggleTask(ws.id, goal.id, task.id));

      const tag = document.createElement('span');
      tag.className = 'home-task-workspace-tag';
      tag.textContent = ws.name;

      const text = document.createElement('span');
      text.className = 'home-task-text';
      text.textContent = task.text;
      if (task.checked) text.style.textDecoration = 'line-through';

      row.appendChild(checkbox);
      row.appendChild(tag);
      row.appendChild(text);
      list.appendChild(row);
    });
  },

  async toggleTask(workspaceId, goalId, taskId) {
    await Studio.goals.toggleTaskChecked(workspaceId, goalId, taskId);
    this.render();
  }
};
