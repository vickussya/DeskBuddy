window.Studio = window.Studio || {};

// Global command layer: Ctrl+K search, Ctrl+N quick capture, and a shared
// toast helper. Reachable from anywhere in the app, independent of which
// section is currently open.
Studio.command = {
  lastGoalKey: null,
  searchResults: [],
  searchSelectedIndex: 0,

  init() {
    document.getElementById('btn-open-search').addEventListener('click', () => this.openSearch());
    document.getElementById('btn-open-quick-capture').addEventListener('click', () => this.openQuickCapture());
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

    const searchInput = document.getElementById('search-input');
    let searchDebounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => this.runSearch(searchInput.value), 150);
    });
    searchInput.addEventListener('keydown', (e) => this.handleSearchKeydown(e));

    document.getElementById('search-modal').addEventListener('click', (e) => {
      if (e.target.id === 'search-modal') this.closeSearch();
    });

    const quickInput = document.getElementById('quick-capture-input');
    quickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submitQuickCapture(); });
    document.getElementById('btn-quick-capture-submit').addEventListener('click', () => this.submitQuickCapture());
    document.getElementById('quick-capture-modal').addEventListener('click', (e) => {
      if (e.target.id === 'quick-capture-modal') this.closeQuickCapture();
    });
  },

  handleGlobalKeydown(e) {
    const key = e.key.toLowerCase();
    if (e.ctrlKey && key === 'k') {
      e.preventDefault();
      this.openSearch();
      return;
    }
    if (e.ctrlKey && key === 'n') {
      e.preventDefault();
      this.openQuickCapture();
      return;
    }
    if (e.key === 'Escape') {
      if (!document.getElementById('search-modal').classList.contains('hidden')) this.closeSearch();
      if (!document.getElementById('quick-capture-modal').classList.contains('hidden')) this.closeQuickCapture();
    }
  },

  // ===== Search (Ctrl+K) =====

  openSearch() {
    if (!document.getElementById('quick-capture-modal').classList.contains('hidden')) this.closeQuickCapture();
    document.getElementById('search-modal').classList.remove('hidden');
    const input = document.getElementById('search-input');
    input.value = '';
    this.searchResults = [];
    this.searchSelectedIndex = 0;
    this.renderSearchResults();
    setTimeout(() => input.focus(), 50);
  },

  closeSearch() {
    document.getElementById('search-modal').classList.add('hidden');
  },

  async runSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      this.searchResults = [];
      this.searchSelectedIndex = 0;
      this.renderSearchResults();
      return;
    }
    this.searchResults = await window.api.globalSearch(trimmed);
    this.searchSelectedIndex = 0;
    this.renderSearchResults();
  },

  renderSearchResults() {
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    if (this.searchResults.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = document.getElementById('search-input').value.trim()
        ? 'No matches.'
        : 'Type to search across goals, tasks, plan, and diary.';
      container.appendChild(el);
      return;
    }

    const icons = { goal: '🎯', task: '☑', plan: '📋', diary: '📓' };

    this.searchResults.forEach((result, i) => {
      const row = document.createElement('div');
      row.className = 'search-result-row' + (i === this.searchSelectedIndex ? ' selected' : '');

      const icon = document.createElement('span');
      icon.className = 'search-result-icon';
      icon.textContent = icons[result.type] || '•';

      const info = document.createElement('div');
      info.className = 'search-result-info';
      const title = document.createElement('div');
      title.className = 'search-result-title';
      const meta = document.createElement('div');
      meta.className = 'search-result-meta';

      if (result.type === 'goal') {
        title.textContent = result.goalTitle;
        meta.textContent = `Goal · ${result.workspaceName}`;
      } else if (result.type === 'task') {
        title.textContent = result.taskText;
        meta.textContent = `Task in "${result.goalTitle}" · ${result.workspaceName}`;
      } else if (result.type === 'plan') {
        title.textContent = result.itemText;
        meta.textContent = `Plan · ${result.dateId}`;
      } else if (result.type === 'diary') {
        title.textContent = result.snippet;
        meta.textContent = `Diary · ${result.dateId}`;
      }

      info.appendChild(title);
      info.appendChild(meta);
      row.appendChild(icon);
      row.appendChild(info);
      row.addEventListener('click', () => this.navigateToResult(result));
      container.appendChild(row);
    });
  },

  handleSearchKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.searchSelectedIndex < this.searchResults.length - 1) this.searchSelectedIndex++;
      this.renderSearchResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.searchSelectedIndex > 0) this.searchSelectedIndex--;
      this.renderSearchResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = this.searchResults[this.searchSelectedIndex];
      if (result) this.navigateToResult(result);
    }
  },

  navigateToResult(result) {
    this.closeSearch();
    if (result.type === 'goal' || result.type === 'task') {
      Studio.nav.switchSection('goals');
      Studio.goals.switchWorkspace(result.workspaceId);
      Studio.goals.openNotebook(result.goalId);
    } else if (result.type === 'plan') {
      Studio.nav.switchSection('plan');
      Studio.plan.loadDate(result.dateId);
    } else if (result.type === 'diary') {
      Studio.nav.switchSection('diary');
      Studio.diary.loadEntry(result.dateId);
    }
  },

  // ===== Quick Capture (Ctrl+N) =====

  openQuickCapture() {
    if (!document.getElementById('search-modal').classList.contains('hidden')) this.closeSearch();
    const select = document.getElementById('quick-capture-goal-select');
    select.innerHTML = '';
    Studio.goals.workspaces.forEach(ws => {
      const goals = Studio.goals.goalsByWorkspace[ws.id] || [];
      goals.forEach(goal => {
        const opt = document.createElement('option');
        opt.value = `${ws.id}::${goal.id}`;
        opt.textContent = `${ws.name} / ${goal.title}`;
        select.appendChild(opt);
      });
    });
    if (this.lastGoalKey && [...select.options].some(o => o.value === this.lastGoalKey)) {
      select.value = this.lastGoalKey;
    }

    const hasGoals = select.options.length > 0;
    document.getElementById('quick-capture-empty-hint').classList.toggle('hidden', hasGoals);
    document.getElementById('quick-capture-input').disabled = !hasGoals;
    select.disabled = !hasGoals;
    document.getElementById('btn-quick-capture-submit').disabled = !hasGoals;

    document.getElementById('quick-capture-input').value = '';
    document.getElementById('quick-capture-modal').classList.remove('hidden');
    if (hasGoals) setTimeout(() => document.getElementById('quick-capture-input').focus(), 50);
  },

  closeQuickCapture() {
    document.getElementById('quick-capture-modal').classList.add('hidden');
  },

  submitQuickCapture() {
    const text = document.getElementById('quick-capture-input').value.trim();
    const select = document.getElementById('quick-capture-goal-select');
    if (!text || !select.value) return;
    const [wsId, goalId] = select.value.split('::');
    const goals = Studio.goals.goalsByWorkspace[wsId] || [];
    const goal = goals.find(g => String(g.id) === goalId);
    if (!goal) return;

    goal.tasks.push({
      id: Date.now(), text, checked: false, description: '',
      startDate: null, endDate: null, stickerId: null
    });
    window.api.saveGoals(wsId, goals);
    this.lastGoalKey = select.value;
    this.closeQuickCapture();
    this.showToast(`Added to "${goal.title}"`);

    if (wsId === Studio.goals.activeWorkspaceId) {
      Studio.goals.renderGoalsList();
      if (Studio.goals.currentNotebookGoalId === goal.id) Studio.goals.renderNotebookChecklist();
    }
  },

  // ===== Toast =====
  // action = { label, onClick } shows an inline button (e.g. "Undo") and
  // gives the toast longer to sit on screen before it fades.

  showToast(message, action) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    const dismiss = () => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    };

    if (action) {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        action.onClick();
        dismiss();
      });
      toast.appendChild(btn);
    }

    document.getElementById('toast-container').appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(dismiss, action ? 5000 : 2200);
  }
};
