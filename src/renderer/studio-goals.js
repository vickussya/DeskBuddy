window.Studio = window.Studio || {};

// Owns Workspaces (tabs, CRUD) and Goals (list + notebook page). Absorbs
// what used to be the standalone Tasks section: tasks now live nested
// inside goals instead of a flat per-workspace list.
Studio.goals = {
  workspaces: [],
  activeWorkspaceId: null,
  goalsByWorkspace: {},
  currentNotebookGoalId: null,

  init(data) {
    this.workspaces = data.workspaces || [];
    this.goalsByWorkspace = data.goalsByWorkspace || {};
    this.activeWorkspaceId = data.activeWorkspaceId && this.workspaces.some(w => w.id === data.activeWorkspaceId)
      ? data.activeWorkspaceId
      : (this.workspaces[0] ? this.workspaces[0].id : null);

    this.renderWorkspaceTabs();
    this.renderGoalsList();
    this.setupListeners();
  },

  setupListeners() {
    document.getElementById('btn-add-goal').addEventListener('click', () => this.addGoal());
    document.getElementById('new-goal-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addGoal();
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

    document.getElementById('btn-close-goal-notebook').addEventListener('click', () => this.closeNotebook());
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
    this.renderGoalsList();
  },

  refreshActiveWorkspace() {
    this.renderGoalsList();
  },

  async persist() {
    const goals = this.goalsByWorkspace[this.activeWorkspaceId] || [];
    await window.api.saveGoals(this.activeWorkspaceId, goals);
  },

  computeProgress(goal) {
    if (goal.tasks && goal.tasks.length > 0) {
      const done = goal.tasks.filter(t => t.checked).length;
      return Math.round((done / goal.tasks.length) * 100);
    }
    return goal.manualProgress || 0;
  },

  addGoal() {
    const input = document.getElementById('new-goal-input');
    const title = input.value.trim();
    if (!title || !this.activeWorkspaceId) return;
    const goals = this.goalsByWorkspace[this.activeWorkspaceId] || (this.goalsByWorkspace[this.activeWorkspaceId] = []);
    goals.push({ id: Date.now(), title, manualProgress: 0, tasks: [] });
    input.value = '';
    this.persist();
    this.renderGoalsList();
  },

  deleteGoal(goalId) {
    const goals = this.goalsByWorkspace[this.activeWorkspaceId] || [];
    this.goalsByWorkspace[this.activeWorkspaceId] = goals.filter(g => g.id !== goalId);
    if (this.currentNotebookGoalId === goalId) this.closeNotebook();
    this.persist();
    this.renderGoalsList();
  },

  renameGoal(goalId, title) {
    const goal = (this.goalsByWorkspace[this.activeWorkspaceId] || []).find(g => g.id === goalId);
    if (goal && title.trim() && title.trim() !== goal.title) {
      goal.title = title.trim();
      this.persist();
    }
    this.renderGoalsList();
  },

  setManualProgress(goalId, value) {
    const goal = (this.goalsByWorkspace[this.activeWorkspaceId] || []).find(g => g.id === goalId);
    if (goal) {
      goal.manualProgress = Number(value);
      this.persist();
    }
  },

  // ===== Goals list (cards) =====

  renderGoalsList() {
    const list = document.getElementById('goals-list');
    list.innerHTML = '';

    if (!this.activeWorkspaceId) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No workspace selected. Create one to get started.';
      list.appendChild(el);
      return;
    }

    const goals = this.goalsByWorkspace[this.activeWorkspaceId] || [];

    if (goals.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No goals yet — add one above.';
      list.appendChild(el);
      return;
    }

    goals.forEach(goal => {
      const progress = this.computeProgress(goal);
      const openCount = goal.tasks.filter(t => !t.checked).length;

      const card = document.createElement('div');
      card.className = 'goal-card';
      card.addEventListener('click', (e) => {
        if (e.target.closest('input, button')) return;
        this.openNotebook(goal.id);
      });

      const header = document.createElement('div');
      header.className = 'goal-card-header';

      const ring = document.createElement('div');
      ring.className = 'progress-ring';
      ring.style.setProperty('--pct', progress);
      const ringLabel = document.createElement('span');
      ringLabel.className = 'progress-ring-label';
      ringLabel.textContent = `${progress}%`;
      ring.appendChild(ringLabel);

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'goal-title-input';
      titleInput.value = goal.title;
      titleInput.maxLength = 140;
      titleInput.addEventListener('blur', () => this.renameGoal(goal.id, titleInput.value));
      titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') titleInput.blur(); });

      const btnDel = document.createElement('button');
      btnDel.className = 'task-btn';
      btnDel.textContent = '✕';
      btnDel.title = 'Delete goal';
      btnDel.addEventListener('click', () => this.deleteGoal(goal.id));

      header.appendChild(ring);
      header.appendChild(titleInput);
      header.appendChild(btnDel);
      card.appendChild(header);

      const summary = document.createElement('div');
      summary.className = 'goal-card-summary';
      summary.textContent = goal.tasks.length === 0
        ? 'No tasks yet — open to start writing.'
        : `${openCount} open of ${goal.tasks.length}`;
      card.appendChild(summary);

      if (goal.tasks.length === 0) {
        const manualRow = document.createElement('div');
        manualRow.className = 'goal-manual-progress';
        const range = document.createElement('input');
        range.type = 'range';
        range.min = 0;
        range.max = 100;
        range.value = goal.manualProgress || 0;
        range.addEventListener('click', (e) => e.stopPropagation());
        range.addEventListener('change', () => this.setManualProgress(goal.id, range.value));
        manualRow.appendChild(range);
        card.appendChild(manualRow);
      }

      list.appendChild(card);
    });
  },

  // ===== Goal notebook page (checklist + freeform canvas) =====

  openNotebook(goalId) {
    const goal = (this.goalsByWorkspace[this.activeWorkspaceId] || []).find(g => g.id === goalId);
    if (!goal) return;
    this.currentNotebookGoalId = goalId;
    document.getElementById('goal-notebook-modal-title').textContent = goal.title;
    document.getElementById('goal-notebook-modal').classList.remove('hidden');
    this.renderNotebookChecklist();
    Studio.inspo.openForGoal(goalId);
  },

  closeNotebook() {
    document.getElementById('goal-notebook-modal').classList.add('hidden');
    this.currentNotebookGoalId = null;
    Studio.inspo.closeGoalBoard();
    this.renderGoalsList();
  },

  getCurrentGoal() {
    return (this.goalsByWorkspace[this.activeWorkspaceId] || []).find(g => g.id === this.currentNotebookGoalId);
  },

  renderNotebookChecklist() {
    const goal = this.getCurrentGoal();
    if (!goal) return;
    const container = document.getElementById('goal-notebook-checklist');

    Studio.checklist.renderRows(container, goal.tasks, {
      rerender: () => this.renderNotebookChecklist(),
      onToggle: (task) => this.toggleTaskChecked(this.activeWorkspaceId, goal.id, task.id),
      onTextChange: (task, text) => {
        task.text = text;
        this.persist();
        this.renderNotebookChecklist();
      },
      onDescriptionChange: (task, desc) => {
        task.description = desc;
        this.persist();
      },
      onDelete: (task) => {
        goal.tasks = goal.tasks.filter(t => t.id !== task.id);
        this.persist();
        this.renderNotebookChecklist();
      },
      onReorder: (task, dir) => {
        const i = goal.tasks.findIndex(t => t.id === task.id);
        const j = i + dir;
        if (j < 0 || j >= goal.tasks.length) return;
        [goal.tasks[i], goal.tasks[j]] = [goal.tasks[j], goal.tasks[i]];
        this.persist();
        this.renderNotebookChecklist();
      },
      onCommitNew: (text) => {
        goal.tasks.push({
          id: Date.now(), text, checked: false, description: '',
          startDate: null, endDate: null, stickerId: null
        });
        this.persist();
        this.renderNotebookChecklist();
      },
      extraControls: (task) => this.buildTaskExtraControls(goal, task)
    });
  },

  buildTaskExtraControls(goal, task) {
    const wrap = document.createElement('div');
    wrap.className = 'checklist-extra-controls';

    const startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.className = 'task-date-input';
    startInput.title = 'Start date';
    startInput.value = task.startDate || '';
    startInput.addEventListener('change', () => {
      task.startDate = startInput.value || null;
      if (task.startDate && (!task.endDate || task.endDate < task.startDate)) {
        task.endDate = task.startDate;
      }
      this.persist();
      this.renderNotebookChecklist();
    });

    const endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.className = 'task-date-input';
    endInput.title = 'End date';
    endInput.value = task.endDate || '';
    endInput.addEventListener('change', () => {
      endInput.value = endInput.value && (!task.startDate || endInput.value >= task.startDate)
        ? endInput.value
        : (task.startDate || endInput.value);
      task.endDate = endInput.value || null;
      this.persist();
    });

    const stickerBadge = document.createElement('div');
    stickerBadge.className = 'task-sticker-badge';
    stickerBadge.title = 'Sticker';
    const stickerSrc = task.stickerId ? Studio.stickers.getStickerSrc(task.stickerId) : null;
    if (stickerSrc) {
      const img = document.createElement('img');
      img.src = stickerSrc;
      stickerBadge.appendChild(img);
    } else {
      stickerBadge.classList.add('task-sticker-badge-empty');
      stickerBadge.textContent = '+';
    }
    stickerBadge.addEventListener('click', () => {
      Studio.stickers.openPicker(stickerBadge, (stickerId) => {
        task.stickerId = stickerId;
        this.persist();
        this.renderNotebookChecklist();
      });
    });

    const btnFolders = document.createElement('button');
    btnFolders.className = 'task-btn';
    btnFolders.textContent = '📁';
    btnFolders.title = 'Folders for this task';
    btnFolders.addEventListener('click', () => Studio.folders.openForTask(task.id, task.text));

    wrap.appendChild(startInput);
    wrap.appendChild(endInput);
    wrap.appendChild(stickerBadge);
    wrap.appendChild(btnFolders);
    return wrap;
  },

  // Shared write-through used by Home/Calendar too, so a checkbox toggled
  // from either of those reflects here without a separate event bus.
  async toggleTaskChecked(wsId, goalId, taskId) {
    const goals = this.goalsByWorkspace[wsId] || [];
    const goal = goals.find(g => g.id === goalId);
    const task = goal && goal.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.checked = !task.checked;
    await window.api.saveGoals(wsId, goals);
    if (wsId === this.activeWorkspaceId) {
      this.renderGoalsList();
      if (this.currentNotebookGoalId === goalId) this.renderNotebookChecklist();
    }
  },

  // ===== Workspaces =====

  async createWorkspace() {
    const input = document.getElementById('new-workspace-input');
    const name = input.value.trim();
    if (!name) return;
    const ws = await window.api.createWorkspace(name);
    this.workspaces.push(ws);
    this.goalsByWorkspace[ws.id] = [{ id: `general-${ws.id}`, title: 'General', manualProgress: 0, tasks: [] }];
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
    const confirmed = confirm(`Delete workspace "${ws.name}"? All of its goals and tasks will be removed.`);
    if (!confirmed) return;

    await window.api.deleteWorkspace(ws.id);
    this.workspaces = this.workspaces.filter(w => w.id !== ws.id);
    delete this.goalsByWorkspace[ws.id];
    this.activeWorkspaceId = this.workspaces[0] ? this.workspaces[0].id : null;
    this.renderWorkspaceTabs();
    this.renderGoalsList();
  }
};
