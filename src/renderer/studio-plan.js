window.Studio = window.Studio || {};

Studio.plan = {
  currentDateId: null,
  items: [],

  init() {
    this.dateInput = document.getElementById('plan-date-input');
    this.dateLabel = document.getElementById('plan-date-label');

    document.getElementById('btn-plan-prev').addEventListener('click', () => this.shiftDay(-1));
    document.getElementById('btn-plan-next').addEventListener('click', () => this.shiftDay(1));
    document.getElementById('btn-plan-today').addEventListener('click', () => this.goToDate(new Date()));
    this.dateInput.addEventListener('change', () => {
      if (this.dateInput.value) this.goToDate(this.parseDateId(this.dateInput.value));
    });

    this.loadDate(this.formatDateId(new Date()));
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

  goToDate(date) {
    this.loadDate(this.formatDateId(date));
  },

  shiftDay(delta) {
    const date = this.parseDateId(this.currentDateId);
    date.setDate(date.getDate() + delta);
    this.goToDate(date);
  },

  async loadDate(dateId) {
    this.currentDateId = dateId;
    this.dateInput.value = dateId;
    this.dateLabel.textContent = this.parseDateId(dateId).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    this.items = await window.api.getPlanItems(dateId);
    this.render();
  },

  async persist() {
    await window.api.savePlanItems(this.currentDateId, this.items);
  },

  render() {
    const container = document.getElementById('plan-checklist');
    Studio.checklist.renderRows(container, this.items, {
      rerender: () => this.render(),
      onToggle: (item) => {
        item.checked = !item.checked;
        this.persist();
        this.render();
      },
      onTextChange: (item, text) => {
        item.text = text;
        this.persist();
        this.render();
      },
      onDescriptionChange: (item, desc) => {
        item.description = desc;
        this.persist();
      },
      onDelete: (item) => {
        this.items = this.items.filter(i => i.id !== item.id);
        this.persist();
        this.render();
      },
      onReorder: (item, dir) => {
        const i = this.items.findIndex(it => it.id === item.id);
        const j = i + dir;
        if (j < 0 || j >= this.items.length) return;
        [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
        this.persist();
        this.render();
      },
      onCommitNew: (text) => {
        this.items.push({ id: Date.now(), text, checked: false, description: '' });
        this.persist();
        this.render();
      }
    });
  }
};
