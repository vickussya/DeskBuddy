/* ===== State ===== */
let tasks = [];
let checkedTasks = [];
let settings = {};
let currentPage = 0;
const PAGE_SIZE = 5;
let editorTasks = [];
let activeCharacter = 'cat';

/* ===== DOM refs ===== */
const characterImg = document.getElementById('character-img');
const taskList = document.getElementById('task-list');
const btnMute = document.getElementById('btn-mute');
const btnSettings = document.getElementById('btn-settings');
const btnHide = document.getElementById('btn-hide');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnAddTask = document.getElementById('btn-add-task');
const pageCurrent = document.getElementById('page-current');
const pageTotal = document.getElementById('page-total');
const characterSound = document.getElementById('character-sound');

const btnMinimize = document.getElementById('btn-minimize');
const miniView = document.getElementById('mini-view');
const miniCharacterImg = document.getElementById('mini-character-img');

const taskEditor = document.getElementById('task-editor');
const taskEditorList = document.getElementById('task-editor-list');
const newTaskInput = document.getElementById('new-task-input');
const btnEditorAdd = document.getElementById('btn-editor-add');
const btnEditorSave = document.getElementById('btn-editor-save');
const btnEditorCancel = document.getElementById('btn-editor-cancel');

/* ===== Sound map ===== */
const SOUNDS = {
  cat: 'meow.wav',
  dog: 'woof.wav',
  person: 'hi-there.wav',
  robot: 'beep-boop.wav',
  custom: 'meow.wav'
};

/* ===== Init ===== */
async function init() {
  const data = await window.api.getInitialData();
  tasks = data.tasks || [];
  checkedTasks = data.checkedTasks || [];
  settings = data.settings || {};
  activeCharacter = data.character || 'cat';

  applyMuteState();
  await loadCharacterImage(activeCharacter);
  renderTasks();
  playCharacterSound();
  setupListeners();
}

function applyMiniMode(isMini) {
  if (isMini) {
    document.body.classList.add('mini-mode');
    // Mirror the character image into the mini view
    miniCharacterImg.src = characterImg.src;
  } else {
    document.body.classList.remove('mini-mode');
  }
}

/* ===== Character image ===== */
async function loadCharacterImage(character) {
  const imgPath = await window.api.getCharacterImagePath(character);
  const src = imgPath
    ? `file://${imgPath.replace(/\\/g, '/')}`
    : getFallbackSVG(character);
  characterImg.src = src;
  miniCharacterImg.src = src;
  characterImg.onerror = () => {
    const fallback = getFallbackSVG(character);
    characterImg.src = fallback;
    miniCharacterImg.src = fallback;
  };
}

function getFallbackSVG(character) {
  const colors = { cat: '#f4a261', dog: '#e07b39', person: '#84b0c7', robot: '#8ecae6', custom: '#a8dadc' };
  const labels = { cat: '🐱', dog: '🐶', person: '😊', robot: '🤖', custom: '⭐' };
  const color = colors[character] || '#c9a96e';
  const label = labels[character] || '?';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='160' viewBox='0 0 100 160'>
    <rect width='100' height='160' rx='18' fill='${color}' opacity='0.3'/>
    <text x='50' y='90' font-size='56' text-anchor='middle' dominant-baseline='middle'>${label}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/* ===== Sound ===== */
function playCharacterSound() {
  if (settings.muted) return;
  const soundFile = SOUNDS[activeCharacter] || 'meow.mp3';
  characterSound.src = `../assets/sounds/${soundFile}`;
  characterSound.volume = 0.6;
  characterSound.play().catch(() => {});
}

function applyMuteState() {
  if (settings.muted) {
    document.body.classList.add('muted');
    btnMute.textContent = '🔇';
    btnMute.title = 'Unmute';
  } else {
    document.body.classList.remove('muted');
    btnMute.textContent = '🔊';
    btnMute.title = 'Mute';
  }
}

/* ===== Task rendering ===== */
function renderTasks() {
  taskList.innerHTML = '';
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  if (currentPage >= totalPages) currentPage = totalPages - 1;

  pageCurrent.textContent = currentPage + 1;
  pageTotal.textContent = totalPages;

  btnPrev.disabled = currentPage === 0;
  btnNext.disabled = currentPage >= totalPages - 1;

  const start = currentPage * PAGE_SIZE;
  const slice = tasks.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    const el = document.createElement('div');
    el.className = 'no-tasks';
    el.textContent = tasks.length === 0 ? 'No tasks yet! Click + Task to add some.' : 'No tasks on this page.';
    taskList.appendChild(el);
    return;
  }

  slice.forEach(task => {
    const isChecked = checkedTasks.includes(task.id);
    const item = document.createElement('div');
    item.className = 'task-item';
    item.dataset.id = task.id;

    const checkbox = document.createElement('div');
    checkbox.className = 'task-checkbox' + (isChecked ? ' checked' : '');

    const label = document.createElement('span');
    label.className = 'task-label' + (isChecked ? ' crossed' : '');
    label.textContent = task.text;

    item.appendChild(checkbox);
    item.appendChild(label);
    item.addEventListener('click', () => toggleTask(task.id));
    taskList.appendChild(item);
  });
}

function toggleTask(id) {
  if (checkedTasks.includes(id)) {
    checkedTasks = checkedTasks.filter(x => x !== id);
  } else {
    checkedTasks = [...checkedTasks, id];
  }
  window.api.setChecked(checkedTasks);
  renderTasks();
}

/* ===== Event listeners ===== */
function setupListeners() {
  btnMute.addEventListener('click', async () => {
    settings.muted = !settings.muted;
    await window.api.saveSettings(settings);
    applyMuteState();
  });

  btnSettings.addEventListener('click', () => window.api.openSettings());

  btnHide.addEventListener('click', () => window.api.hideWindow());

  btnMinimize.addEventListener('click', () => window.api.toggleMiniMode());
  miniView.addEventListener('click', () => window.api.toggleMiniMode());

  characterImg.addEventListener('click', () => playCharacterSound());

  btnPrev.addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderTasks(); }
  });

  btnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(tasks.length / PAGE_SIZE);
    if (currentPage < totalPages - 1) { currentPage++; renderTasks(); }
  });

  btnAddTask.addEventListener('click', () => openTaskEditor());

  btnEditorAdd.addEventListener('click', addEditorTask);
  newTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addEditorTask();
  });

  btnEditorSave.addEventListener('click', saveEditorTasks);
  btnEditorCancel.addEventListener('click', closeTaskEditor);

  /* IPC events */
  window.api.onTasksUpdated((newTasks) => {
    tasks = newTasks;
    renderTasks();
  });

  window.api.onSettingsUpdated((newSettings) => {
    settings = { ...settings, ...newSettings };
    applyMuteState();
  });

  window.api.onCharacterChanged(async (char) => {
    activeCharacter = char;
    await loadCharacterImage(char);
  });

  window.api.onMiniModeChanged((isMini) => {
    applyMiniMode(isMini);
  });
}

/* ===== Task editor ===== */
function openTaskEditor() {
  editorTasks = tasks.map(t => ({ ...t }));
  renderEditorList();
  taskEditor.classList.remove('hidden');
  newTaskInput.focus();
}

function closeTaskEditor() {
  taskEditor.classList.add('hidden');
  newTaskInput.value = '';
}

function renderEditorList() {
  taskEditorList.innerHTML = '';
  editorTasks.forEach((task, i) => {
    const row = document.createElement('div');
    row.className = 'editor-task-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.text;
    input.maxLength = 80;
    input.addEventListener('input', () => { editorTasks[i].text = input.value; });

    const btnUp = document.createElement('button');
    btnUp.className = 'editor-task-btn';
    btnUp.textContent = '↑';
    btnUp.title = 'Move up';
    btnUp.disabled = i === 0;
    btnUp.addEventListener('click', () => {
      if (i > 0) {
        [editorTasks[i - 1], editorTasks[i]] = [editorTasks[i], editorTasks[i - 1]];
        renderEditorList();
      }
    });

    const btnDown = document.createElement('button');
    btnDown.className = 'editor-task-btn';
    btnDown.textContent = '↓';
    btnDown.title = 'Move down';
    btnDown.disabled = i === editorTasks.length - 1;
    btnDown.addEventListener('click', () => {
      if (i < editorTasks.length - 1) {
        [editorTasks[i + 1], editorTasks[i]] = [editorTasks[i], editorTasks[i + 1]];
        renderEditorList();
      }
    });

    const btnDel = document.createElement('button');
    btnDel.className = 'editor-task-btn';
    btnDel.textContent = '✕';
    btnDel.title = 'Delete';
    btnDel.addEventListener('click', () => {
      editorTasks.splice(i, 1);
      renderEditorList();
    });

    row.appendChild(input);
    row.appendChild(btnUp);
    row.appendChild(btnDown);
    row.appendChild(btnDel);
    taskEditorList.appendChild(row);
  });
}

function addEditorTask() {
  const text = newTaskInput.value.trim();
  if (!text) return;
  editorTasks.push({ id: Date.now(), text });
  newTaskInput.value = '';
  renderEditorList();
  taskEditorList.scrollTop = taskEditorList.scrollHeight;
}

async function saveEditorTasks() {
  const filtered = editorTasks.filter(t => t.text.trim().length > 0);
  await window.api.saveTasks(filtered);
  tasks = filtered;
  closeTaskEditor();
  renderTasks();
}

/* ===== Start ===== */
init();
