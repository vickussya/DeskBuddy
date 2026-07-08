window.Studio = window.Studio || {};

Studio.home = {
  diaryDateId: null,
  diaryText: '',
  diarySaveTimer: null,

  init() {
    document.getElementById('btn-home-open-diary').addEventListener('click', () => Studio.nav.switchSection('diary'));

    const textarea = document.getElementById('home-diary-textarea');
    textarea.addEventListener('input', () => this.scheduleDiarySave());
    textarea.addEventListener('blur', () => this.flushDiarySave());

    this.refresh();
  },

  formatDateId(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  async refresh() {
    this.renderTasks();
    this.renderGoals();

    this.diaryDateId = this.formatDateId(new Date());
    this.diaryText = await window.api.getDiaryEntry(this.diaryDateId);
    document.getElementById('home-diary-textarea').value = this.diaryText;
  },

  renderTasks() {
    const list = document.getElementById('home-task-list');
    list.innerHTML = '';

    const workspaces = Studio.goals.workspaces || [];
    const rows = [];
    workspaces.forEach(ws => {
      const goals = Studio.goals.goalsByWorkspace[ws.id] || [];
      goals.forEach(goal => {
        goal.tasks.forEach(task => {
          if (!task.checked) rows.push({ ws, goal, task });
        });
      });
    });

    if (rows.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'Nothing open — nice work.';
      list.appendChild(el);
      return;
    }

    rows.forEach(({ ws, goal, task }) => {
      const row = document.createElement('div');
      row.className = 'home-task-row';

      const checkbox = document.createElement('div');
      checkbox.className = 'task-checkbox';
      checkbox.addEventListener('click', () => this.toggleTask(ws.id, goal.id, task.id));

      const tag = document.createElement('span');
      tag.className = 'home-task-workspace-tag';
      tag.textContent = ws.name;

      const text = document.createElement('span');
      text.className = 'home-task-text';
      text.textContent = task.text;

      row.appendChild(checkbox);
      row.appendChild(tag);
      row.appendChild(text);
      list.appendChild(row);
    });
  },

  async toggleTask(workspaceId, goalId, taskId) {
    await Studio.goals.toggleTaskChecked(workspaceId, goalId, taskId);
    this.renderTasks();
  },

  renderGoals() {
    const list = document.getElementById('home-goals-list');
    list.innerHTML = '';

    const workspaces = Studio.goals.workspaces || [];
    const rows = [];
    workspaces.forEach(ws => {
      (Studio.goals.goalsByWorkspace[ws.id] || []).forEach(goal => rows.push({ ws, goal }));
    });

    if (rows.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No goals yet.';
      list.appendChild(el);
      return;
    }

    rows.forEach(({ ws, goal }) => {
      const progress = Studio.goals.computeProgress(goal);

      const row = document.createElement('div');
      row.className = 'home-goal-row';
      row.addEventListener('click', () => {
        Studio.goals.switchWorkspace(ws.id);
        Studio.nav.switchSection('goals');
      });

      const ring = document.createElement('div');
      ring.className = 'progress-ring progress-ring--sm';
      ring.style.setProperty('--pct', progress);
      const ringLabel = document.createElement('span');
      ringLabel.className = 'progress-ring-label';
      ringLabel.textContent = `${progress}%`;
      ring.appendChild(ringLabel);

      const tag = document.createElement('span');
      tag.className = 'home-task-workspace-tag';
      tag.textContent = ws.name;

      const title = document.createElement('div');
      title.className = 'home-goal-title';
      title.textContent = goal.title;

      row.appendChild(ring);
      row.appendChild(tag);
      row.appendChild(title);
      list.appendChild(row);
    });
  },

  scheduleDiarySave() {
    clearTimeout(this.diarySaveTimer);
    this.diarySaveTimer = setTimeout(() => this.flushDiarySave(), 600);
  },

  async flushDiarySave() {
    clearTimeout(this.diarySaveTimer);
    const text = document.getElementById('home-diary-textarea').value;
    if (text === this.diaryText) return;
    this.diaryText = text;
    await window.api.saveDiaryEntry(this.diaryDateId, text);
  }
};
