window.Studio = window.Studio || {};

Studio.tasks = {
  workspaces: [],
  activeWorkspaceId: null,
  tasksByWorkspace: {},
  checkedByWorkspace: {},

  init(data) {
    this.workspaces = data.workspaces || [];
    this.tasksByWorkspace = data.tasksByWorkspace || {};
    this.checkedByWorkspace = data.checkedByWorkspace || {};
    this.activeWorkspaceId = data.activeWorkspaceId && this.workspaces.some(w => w.id === data.activeWorkspaceId)
      ? data.activeWorkspaceId
      : (this.workspaces[0] ? this.workspaces[0].id : null);

    this.renderWorkspaceTabs();
    this.renderTaskList();
    this.setupListeners();

    window.api.onTasksUpdated(({ workspaceId, tasks }) => {
      this.tasksByWorkspace[workspaceId] = tasks;
      if (workspaceId === this.activeWorkspaceId) this.renderTaskList();
    });
  },

  setupListeners() {
    document.getElementById('btn-add-task').addEventListener('click', () => this.addTask());
    document.getElementById('new-task-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addTask();
    });

    document.getElementById('btn-add-workspace').addEventListener('click', () => {
      document.getElementById('workspace-add-form').classList.remove('hidden');
      document.getElementById('new-workspace-input').focus();
    });
    document.getElementById('btn-cancel-add-workspace').addEventListener('click', () => {
      document.getElementById('workspace-add-form').classList.add('hidden');
      document.getElementById('new-workspace-input').value = '';
    });
    document.getElementById('btn-confirm-add-workspace').addEventListener('click', () => this.createWorkspace());
    document.getElementById('new-workspace-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.createWorkspace();
    });

    document.getElementById('btn-open-tasks-file').addEventListener('click', () => {
      if (this.activeWorkspaceId) window.api.openTasksFile(this.activeWorkspaceId);
    });

    document.getElementById('btn-rename-workspace').addEventListener('click', () => {
      const ws = this.workspaces.find(w => w.id === this.activeWorkspaceId);
      if (!ws) return;
      const input = document.getElementById('rename-workspace-input');
      input.value = ws.name;
      document.getElementById('workspace-rename-form').classList.remove('hidden');
      input.focus();
    });
    document.getElementById('btn-cancel-rename-workspace').addEventListener('click', () => {
      document.getElementById('workspace-rename-form').classList.add('hidden');
    });
    document.getElementById('btn-confirm-rename-workspace').addEventListener('click', () => this.renameWorkspace());
    document.getElementById('rename-workspace-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.renameWorkspace();
    });

    document.getElementById('btn-delete-workspace').addEventListener('click', () => this.deleteWorkspace());
  },

  renderWorkspaceTabs() {
    const container = document.getElementById('workspace-tabs');
    container.innerHTML = '';
    this.workspaces.forEach(ws => {
      const btn = document.createElement('button');
      btn.className = 'workspace-tab' + (ws.id === this.activeWorkspaceId ? ' active' : '');
      btn.textContent = ws.name;
      btn.addEventListener('click', () => this.switchWorkspace(ws.id));
      container.appendChild(btn);
    });
  },

  switchWorkspace(id) {
    if (id === this.activeWorkspaceId) return;
    this.activeWorkspaceId = id;
    window.api.setActiveWorkspace(id);
    this.renderWorkspaceTabs();
    this.renderTaskList();
  },

  renderTaskList() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';

    if (!this.activeWorkspaceId) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No workspace selected. Create one to get started.';
      list.appendChild(el);
      return;
    }

    const tasks = this.tasksByWorkspace[this.activeWorkspaceId] || [];
    const checked = this.checkedByWorkspace[this.activeWorkspaceId] || [];

    if (tasks.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No tasks yet — add one above.';
      list.appendChild(el);
      return;
    }

    tasks.forEach((task, i) => {
      const isChecked = checked.includes(task.id);

      const row = document.createElement('div');
      row.className = 'task-row';

      const checkbox = document.createElement('div');
      checkbox.className = 'task-checkbox' + (isChecked ? ' checked' : '');
      checkbox.addEventListener('click', () => this.toggleChecked(task.id));

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-text-input' + (isChecked ? ' crossed' : '');
      input.value = task.text;
      input.maxLength = 140;
      input.addEventListener('blur', () => {
        const trimmed = input.value.trim();
        if (trimmed && trimmed !== task.text) {
          task.text = trimmed;
          this.saveTasks();
        } else {
          input.value = task.text;
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
      });

      const btnUp = document.createElement('button');
      btnUp.className = 'task-btn';
      btnUp.textContent = '↑';
      btnUp.title = 'Move up';
      btnUp.disabled = i === 0;
      btnUp.addEventListener('click', () => {
        if (i > 0) {
          [tasks[i - 1], tasks[i]] = [tasks[i], tasks[i - 1]];
          this.saveTasks();
        }
      });

      const btnDown = document.createElement('button');
      btnDown.className = 'task-btn';
      btnDown.textContent = '↓';
      btnDown.title = 'Move down';
      btnDown.disabled = i === tasks.length - 1;
      btnDown.addEventListener('click', () => {
        if (i < tasks.length - 1) {
          [tasks[i + 1], tasks[i]] = [tasks[i], tasks[i + 1]];
          this.saveTasks();
        }
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'task-btn';
      btnDel.textContent = '✕';
      btnDel.title = 'Delete';
      btnDel.addEventListener('click', () => {
        this.tasksByWorkspace[this.activeWorkspaceId] = tasks.filter(t => t.id !== task.id);
        this.saveTasks();
      });

      row.appendChild(checkbox);
      row.appendChild(input);
      row.appendChild(btnUp);
      row.appendChild(btnDown);
      row.appendChild(btnDel);
      list.appendChild(row);
    });
  },

  addTask() {
    const input = document.getElementById('new-task-input');
    const text = input.value.trim();
    if (!text || !this.activeWorkspaceId) return;
    const tasks = this.tasksByWorkspace[this.activeWorkspaceId] || [];
    tasks.push({ id: Date.now(), text });
    this.tasksByWorkspace[this.activeWorkspaceId] = tasks;
    input.value = '';
    this.saveTasks();
  },

  async saveTasks() {
    const tasks = this.tasksByWorkspace[this.activeWorkspaceId] || [];
    await window.api.saveTasks(this.activeWorkspaceId, tasks);
    this.renderTaskList();
  },

  async toggleChecked(taskId) {
    const checked = this.checkedByWorkspace[this.activeWorkspaceId] || [];
    this.checkedByWorkspace[this.activeWorkspaceId] = checked.includes(taskId)
      ? checked.filter(id => id !== taskId)
      : [...checked, taskId];
    await window.api.setChecked(this.activeWorkspaceId, this.checkedByWorkspace[this.activeWorkspaceId]);
    this.renderTaskList();
  },

  async createWorkspace() {
    const input = document.getElementById('new-workspace-input');
    const name = input.value.trim();
    if (!name) return;
    const ws = await window.api.createWorkspace(name);
    this.workspaces.push(ws);
    this.tasksByWorkspace[ws.id] = [];
    this.checkedByWorkspace[ws.id] = [];
    input.value = '';
    document.getElementById('workspace-add-form').classList.add('hidden');
    this.switchWorkspace(ws.id);
    this.renderWorkspaceTabs();
  },

  async renameWorkspace() {
    const input = document.getElementById('rename-workspace-input');
    const newName = input.value.trim();
    const ws = this.workspaces.find(w => w.id === this.activeWorkspaceId);
    if (!newName || !ws) return;
    ws.name = newName;
    await window.api.renameWorkspace(ws.id, newName);
    document.getElementById('workspace-rename-form').classList.add('hidden');
    this.renderWorkspaceTabs();
  },

  async deleteWorkspace() {
    const ws = this.workspaces.find(w => w.id === this.activeWorkspaceId);
    if (!ws) return;
    const confirmed = confirm(`Delete workspace "${ws.name}"? Its tasks file will be archived, not deleted.`);
    if (!confirmed) return;

    await window.api.deleteWorkspace(ws.id);
    this.workspaces = this.workspaces.filter(w => w.id !== ws.id);
    delete this.tasksByWorkspace[ws.id];
    delete this.checkedByWorkspace[ws.id];
    this.activeWorkspaceId = this.workspaces[0] ? this.workspaces[0].id : null;
    this.renderWorkspaceTabs();
    this.renderTaskList();
  }
};
