window.Studio = window.Studio || {};

Studio.goals = {
  goals: [],

  async init() {
    this.goals = await window.api.getGoals();

    document.getElementById('btn-add-goal').addEventListener('click', () => this.addGoal());
    document.getElementById('new-goal-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addGoal();
    });

    this.render();
  },

  computeProgress(goal) {
    if (goal.milestones && goal.milestones.length > 0) {
      const done = goal.milestones.filter(m => m.done).length;
      return Math.round((done / goal.milestones.length) * 100);
    }
    return goal.manualProgress || 0;
  },

  async save() {
    await window.api.saveGoals(this.goals);
    this.render();
  },

  addGoal() {
    const input = document.getElementById('new-goal-input');
    const title = input.value.trim();
    if (!title) return;
    this.goals.push({ id: Date.now(), title, milestones: [], manualProgress: 0 });
    input.value = '';
    this.save();
  },

  deleteGoal(goalId) {
    this.goals = this.goals.filter(g => g.id !== goalId);
    this.save();
  },

  renameGoal(goalId, title) {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal && title.trim() && title.trim() !== goal.title) {
      goal.title = title.trim();
      this.save();
    } else {
      this.render();
    }
  },

  addMilestone(goalId, text) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal || !text.trim()) return;
    goal.milestones.push({ id: Date.now(), text: text.trim(), done: false });
    this.save();
  },

  toggleMilestone(goalId, milestoneId) {
    const goal = this.goals.find(g => g.id === goalId);
    const milestone = goal && goal.milestones.find(m => m.id === milestoneId);
    if (milestone) {
      milestone.done = !milestone.done;
      this.save();
    }
  },

  deleteMilestone(goalId, milestoneId) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;
    goal.milestones = goal.milestones.filter(m => m.id !== milestoneId);
    this.save();
  },

  setManualProgress(goalId, value) {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal) {
      goal.manualProgress = Number(value);
      this.save();
    }
  },

  render() {
    const list = document.getElementById('goals-list');
    list.innerHTML = '';

    if (this.goals.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No goals yet — add one above.';
      list.appendChild(el);
      return;
    }

    this.goals.forEach(goal => {
      const progress = this.computeProgress(goal);

      const card = document.createElement('div');
      card.className = 'goal-card';

      // Header: ring + title + delete
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

      if (goal.milestones.length > 0) {
        goal.milestones.forEach(m => {
          const row = document.createElement('div');
          row.className = 'milestone-row';

          const checkbox = document.createElement('div');
          checkbox.className = 'task-checkbox' + (m.done ? ' checked' : '');
          checkbox.addEventListener('click', () => this.toggleMilestone(goal.id, m.id));

          const text = document.createElement('input');
          text.type = 'text';
          text.className = 'milestone-text-input' + (m.done ? ' crossed' : '');
          text.value = m.text;
          text.maxLength = 140;
          text.addEventListener('blur', () => {
            const trimmed = text.value.trim();
            if (trimmed && trimmed !== m.text) {
              m.text = trimmed;
              this.save();
            } else {
              text.value = m.text;
            }
          });
          text.addEventListener('keydown', (e) => { if (e.key === 'Enter') text.blur(); });

          const btnDelM = document.createElement('button');
          btnDelM.className = 'task-btn';
          btnDelM.textContent = '✕';
          btnDelM.addEventListener('click', () => this.deleteMilestone(goal.id, m.id));

          row.appendChild(checkbox);
          row.appendChild(text);
          row.appendChild(btnDelM);
          card.appendChild(row);
        });
      } else {
        const manualRow = document.createElement('div');
        manualRow.className = 'goal-manual-progress';

        const range = document.createElement('input');
        range.type = 'range';
        range.min = 0;
        range.max = 100;
        range.value = goal.manualProgress || 0;
        range.addEventListener('change', () => this.setManualProgress(goal.id, range.value));

        manualRow.appendChild(range);
        card.appendChild(manualRow);
      }

      const addRow = document.createElement('div');
      addRow.className = 'goal-add-milestone-row';
      const addInput = document.createElement('input');
      addInput.type = 'text';
      addInput.placeholder = '+ Add milestone...';
      addInput.maxLength = 140;
      const commitAdd = () => {
        this.addMilestone(goal.id, addInput.value);
        addInput.value = '';
      };
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitAdd(); });
      addRow.appendChild(addInput);
      card.appendChild(addRow);

      list.appendChild(card);
    });
  }
};
