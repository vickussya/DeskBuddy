window.Studio = window.Studio || {};

Studio.diary = {
  currentDateId: null,
  currentText: '',
  saveTimer: null,

  init() {
    this.dateInput = document.getElementById('diary-date-input');
    this.textarea = document.getElementById('diary-textarea');
    this.dateLabel = document.getElementById('diary-date-label');
    this.saveStatus = document.getElementById('diary-save-status');

    document.getElementById('btn-diary-prev').addEventListener('click', () => this.shiftDay(-1));
    document.getElementById('btn-diary-next').addEventListener('click', () => this.shiftDay(1));
    document.getElementById('btn-diary-today').addEventListener('click', () => this.goToDate(new Date()));
    this.dateInput.addEventListener('change', () => {
      if (this.dateInput.value) this.goToDate(this.parseDateId(this.dateInput.value));
    });

    this.textarea.addEventListener('input', () => this.scheduleSave());
    this.textarea.addEventListener('blur', () => this.flushSave());

    this.loadEntry(this.formatDateId(new Date()));
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
    this.loadEntry(this.formatDateId(date));
  },

  shiftDay(delta) {
    const date = this.parseDateId(this.currentDateId);
    date.setDate(date.getDate() + delta);
    this.goToDate(date);
  },

  async loadEntry(dateId) {
    if (this.currentDateId && this.currentDateId !== dateId) {
      this.flushSave();
    }

    this.currentDateId = dateId;
    this.dateInput.value = dateId;
    this.dateLabel.textContent = this.parseDateId(dateId).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    this.saveStatus.textContent = '';

    const text = await window.api.getDiaryEntry(dateId);
    this.currentText = text;
    this.textarea.value = text;
  },

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveStatus.textContent = 'Saving…';
    this.saveTimer = setTimeout(() => this.flushSave(), 600);
  },

  async flushSave() {
    clearTimeout(this.saveTimer);
    const text = this.textarea.value;
    if (text === this.currentText) return;
    this.currentText = text;
    await window.api.saveDiaryEntry(this.currentDateId, text);
    this.saveStatus.textContent = 'Saved';
  }
};
