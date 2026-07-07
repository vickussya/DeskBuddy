window.Studio = window.Studio || {};

Studio.settings = {
  settings: {},
  schedule: [],

  init(data) {
    this.settings = data.settings || {};
    this.schedule = data.schedule || [];

    this.applySettings();
    this.renderSchedule();
    this.setupListeners();

    window.api.onSettingsUpdated((newSettings) => {
      this.settings = { ...this.settings, ...newSettings };
      this.applySettings();
    });
  },

  applySettings() {
    document.getElementById('toggle-autostart').checked = !!this.settings.autoStart;

    document.querySelectorAll('.char-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.char === this.settings.character);
    });

    if (this.settings.customCharacterPath) {
      document.getElementById('custom-path-label').textContent = this.settings.customCharacterPath;
      const preview = document.getElementById('custom-preview');
      preview.innerHTML = `<img src="file://${this.settings.customCharacterPath.replace(/\\/g, '/')}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;" onerror="this.parentElement.textContent='⭐'" />`;
    }
  },

  setupListeners() {
    document.getElementById('toggle-autostart').addEventListener('change', async (e) => {
      this.settings.autoStart = e.target.checked;
      await window.api.saveSettings(this.settings);
    });

    document.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', async () => {
        this.settings.character = card.dataset.char;
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        await window.api.saveSettings(this.settings);
      });
    });

    document.getElementById('btn-upload-custom').addEventListener('click', async () => {
      const filePath = await window.api.chooseCustomImage();
      if (filePath) {
        this.settings.customCharacterPath = filePath;
        this.settings.character = 'custom';
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        document.querySelector('.char-card[data-char="custom"]').classList.add('selected');
        document.getElementById('custom-path-label').textContent = filePath;
        const preview = document.getElementById('custom-preview');
        preview.innerHTML = `<img src="file://${filePath.replace(/\\/g, '/')}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;" onerror="this.parentElement.textContent='⭐'" />`;
        await window.api.saveSettings(this.settings);
      }
    });

    document.getElementById('btn-add-schedule').addEventListener('click', () => this.addScheduleEntry());
  },

  renderSchedule() {
    const list = document.getElementById('schedule-list');
    list.innerHTML = '';
    if (this.schedule.length === 0) {
      list.innerHTML = '<span class="hint-text">No schedule entries yet.</span>';
      return;
    }
    this.schedule.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'schedule-entry';
      const fromStr = entry.from ? new Date(entry.from).toLocaleDateString() : '?';
      const toStr = entry.to ? new Date(entry.to).toLocaleDateString() : '?';
      row.innerHTML = `<span>${fromStr} → ${toStr}: <span class="schedule-entry-char">${entry.character}</span></span>`;
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del-schedule';
      btnDel.textContent = '✕';
      btnDel.addEventListener('click', async () => {
        this.schedule.splice(i, 1);
        await window.api.saveSchedule(this.schedule);
        this.renderSchedule();
      });
      row.appendChild(btnDel);
      list.appendChild(row);
    });
  },

  async addScheduleEntry() {
    const from = document.getElementById('sched-from').value;
    const to = document.getElementById('sched-to').value;
    const character = document.getElementById('sched-character').value;
    if (!from || !to) {
      alert('Please select both a start and end date.');
      return;
    }
    if (new Date(from) > new Date(to)) {
      alert('Start date must be before end date.');
      return;
    }
    this.schedule.push({ from, to, character });
    await window.api.saveSchedule(this.schedule);
    this.renderSchedule();
    document.getElementById('sched-from').value = '';
    document.getElementById('sched-to').value = '';
  }
};
