/* ===== State ===== */
let settings = {};
let schedule = [];
let settingsTasks = [];
let activeTab = 'general';

/* ===== Init ===== */
async function init() {
  const data = await window.api.getInitialData();
  settings = data.settings || {};
  schedule = data.schedule || [];
  settingsTasks = (data.tasks || []).map(t => ({ ...t }));

  applySettings();
  renderSchedule();
  renderSettingsTasks();
  setupTabs();
  setupListeners();
}

/* ===== Apply settings to UI ===== */
function applySettings() {
  document.getElementById('toggle-autostart').checked = !!settings.autoStart;
  document.getElementById('toggle-mute').checked = !!settings.muted;
  document.getElementById('tasks-file-path').textContent = settings.tasksFilePath || '';

  // Highlight selected character
  document.querySelectorAll('.char-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.char === settings.character);
  });

  if (settings.customCharacterPath) {
    document.getElementById('custom-path-label').textContent = settings.customCharacterPath;
    const preview = document.getElementById('custom-preview');
    preview.innerHTML = `<img src="file://${settings.customCharacterPath.replace(/\\/g, '/')}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;" onerror="this.parentElement.textContent='⭐'" />`;
  }
}

/* ===== Tabs ===== */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${activeTab}`).classList.add('active');
    });
  });
}

/* ===== Listeners ===== */
function setupListeners() {
  // General
  document.getElementById('toggle-autostart').addEventListener('change', async (e) => {
    settings.autoStart = e.target.checked;
    await window.api.saveSettings(settings);
  });

  document.getElementById('toggle-mute').addEventListener('change', async (e) => {
    settings.muted = e.target.checked;
    await window.api.saveSettings(settings);
  });

  document.getElementById('btn-open-tasks-file').addEventListener('click', () => {
    window.api.openTasksFile();
  });

  // Character selection
  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', async () => {
      settings.character = card.dataset.char;
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      await window.api.saveSettings(settings);
    });
  });

  // Custom image upload
  document.getElementById('btn-upload-custom').addEventListener('click', async () => {
    const filePath = await window.api.chooseCustomImage();
    if (filePath) {
      settings.customCharacterPath = filePath;
      settings.character = 'custom';
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      document.querySelector('.char-card[data-char="custom"]').classList.add('selected');
      document.getElementById('custom-path-label').textContent = filePath;
      const preview = document.getElementById('custom-preview');
      preview.innerHTML = `<img src="file://${filePath.replace(/\\/g, '/')}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;" onerror="this.parentElement.textContent='⭐'" />`;
      await window.api.saveSettings(settings);
    }
  });

  // Tasks tab
  document.getElementById('btn-settings-add-task').addEventListener('click', addSettingsTask);
  document.getElementById('settings-new-task').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSettingsTask();
  });
  document.getElementById('btn-settings-save-tasks').addEventListener('click', saveSettingsTasks);

  // Schedule
  document.getElementById('btn-add-schedule').addEventListener('click', addScheduleEntry);

  // Close
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    window.api.closeSettings();
  });

  // IPC
  window.api.onTasksUpdated((newTasks) => {
    settingsTasks = newTasks.map(t => ({ ...t }));
    renderSettingsTasks();
  });
}

/* ===== Settings tasks ===== */
function renderSettingsTasks() {
  const list = document.getElementById('settings-task-list');
  list.innerHTML = '';
  settingsTasks.forEach((task, i) => {
    const row = document.createElement('div');
    row.className = 'settings-task-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.text;
    input.maxLength = 80;
    input.addEventListener('input', () => { settingsTasks[i].text = input.value; });

    const btnUp = document.createElement('button');
    btnUp.className = 'settings-task-btn';
    btnUp.textContent = '↑';
    btnUp.disabled = i === 0;
    btnUp.addEventListener('click', () => {
      if (i > 0) {
        [settingsTasks[i - 1], settingsTasks[i]] = [settingsTasks[i], settingsTasks[i - 1]];
        renderSettingsTasks();
      }
    });

    const btnDown = document.createElement('button');
    btnDown.className = 'settings-task-btn';
    btnDown.textContent = '↓';
    btnDown.disabled = i === settingsTasks.length - 1;
    btnDown.addEventListener('click', () => {
      if (i < settingsTasks.length - 1) {
        [settingsTasks[i + 1], settingsTasks[i]] = [settingsTasks[i], settingsTasks[i + 1]];
        renderSettingsTasks();
      }
    });

    const btnDel = document.createElement('button');
    btnDel.className = 'settings-task-btn';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', () => {
      settingsTasks.splice(i, 1);
      renderSettingsTasks();
    });

    row.appendChild(input);
    row.appendChild(btnUp);
    row.appendChild(btnDown);
    row.appendChild(btnDel);
    list.appendChild(row);
  });
}

function addSettingsTask() {
  const input = document.getElementById('settings-new-task');
  const text = input.value.trim();
  if (!text) return;
  settingsTasks.push({ id: Date.now(), text });
  input.value = '';
  renderSettingsTasks();
  document.getElementById('settings-task-list').scrollTop = 99999;
}

async function saveSettingsTasks() {
  const filtered = settingsTasks.filter(t => t.text.trim().length > 0);
  await window.api.saveTasks(filtered);
  settingsTasks = filtered;
  renderSettingsTasks();
  const btn = document.getElementById('btn-settings-save-tasks');
  btn.textContent = 'Saved!';
  setTimeout(() => { btn.textContent = 'Save Tasks'; }, 1500);
}

/* ===== Schedule ===== */
function renderSchedule() {
  const list = document.getElementById('schedule-list');
  list.innerHTML = '';
  if (schedule.length === 0) {
    list.innerHTML = '<span style="font-size:12px;color:#a07840;font-style:italic;">No schedule entries yet.</span>';
    return;
  }
  schedule.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'schedule-entry';
    const fromStr = entry.from ? new Date(entry.from).toLocaleDateString() : '?';
    const toStr = entry.to ? new Date(entry.to).toLocaleDateString() : '?';
    row.innerHTML = `<span>${fromStr} → ${toStr}: <span class="schedule-entry-char">${entry.character}</span></span>`;
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del-schedule';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', async () => {
      schedule.splice(i, 1);
      await window.api.saveSchedule(schedule);
      renderSchedule();
    });
    row.appendChild(btnDel);
    list.appendChild(row);
  });
}

async function addScheduleEntry() {
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
  schedule.push({ from, to, character });
  await window.api.saveSchedule(schedule);
  renderSchedule();
  document.getElementById('sched-from').value = '';
  document.getElementById('sched-to').value = '';
}

/* ===== Start ===== */
init();
