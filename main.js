const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

// --- Simple JSON store (replaces electron-store) ---
class JsonStore {
  constructor(filePath, defaults) {
    this._path = filePath;
    this._defaults = defaults;
    this._data = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this._path, 'utf8');
      return Object.assign({}, this._defaults, JSON.parse(raw));
    } catch {
      return Object.assign({}, this._defaults);
    }
  }

  _save() {
    fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2), 'utf8');
  }

  get(key, fallback) {
    const keys = key.split('.');
    let val = this._data;
    for (const k of keys) {
      if (val == null || typeof val !== 'object') return fallback !== undefined ? fallback : undefined;
      val = val[k];
    }
    return val !== undefined ? val : (fallback !== undefined ? fallback : undefined);
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] == null || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._save();
  }
}

// --- Store setup (deferred until app is ready so getPath works) ---
let store = null;
let userDataPath = null;
let tasksFilePath = null;

function initStore() {
  userDataPath = app.getPath('userData');
  tasksFilePath = path.join(userDataPath, 'tasks.txt');
  const storePath = path.join(userDataPath, 'deskbuddy-config.json');
  store = new JsonStore(storePath, {
    tasks: [],
    settings: {
      character: 'cat',
      muted: false,
      autoStart: false,
      customCharacterPath: null,
      speechBubbleStyle: 'default',
      tasksFilePath: null
    },
    schedule: [],
    windowPosition: { x: null, y: null },
    checkedTasks: []
  });
  // Always keep tasksFilePath up-to-date in settings
  store.set('settings.tasksFilePath', tasksFilePath);
}

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let fileWatcher = null;
let isMiniMode = false;

const FULL_W = 460, FULL_H = 280;
const MINI_W = 80, MINI_H = 88;
const MARGIN = 16;

// --- Ensure tasks.txt exists ---
function ensureTasksFile() {
  if (!fs.existsSync(tasksFilePath)) {
    const tasks = store.get('tasks', []);
    const content = tasks.map(t => t.text).join('\n');
    fs.writeFileSync(tasksFilePath, content, 'utf8');
  }
}

// --- Sync tasks.txt -> store ---
function loadTasksFromFile() {
  try {
    const content = fs.readFileSync(tasksFilePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const existingTasks = store.get('tasks', []);
    const newTasks = lines.map((text, i) => {
      const existing = existingTasks.find(t => t.text === text);
      return { id: existing ? existing.id : Date.now() + i, text };
    });
    store.set('tasks', newTasks);
    const checkedTasks = store.get('checkedTasks', []);
    const validIds = newTasks.map(t => t.id);
    const filteredChecked = checkedTasks.filter(id => validIds.includes(id));
    store.set('checkedTasks', filteredChecked);
    return newTasks;
  } catch (e) {
    return store.get('tasks', []);
  }
}

// --- Sync store -> tasks.txt ---
function saveTasksToFile(tasks) {
  const content = tasks.map(t => t.text).join('\n');
  fs.writeFileSync(tasksFilePath, content, 'utf8');
}

// --- Get active character based on schedule ---
function getActiveCharacter() {
  const schedule = store.get('schedule', []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const entry of schedule) {
    const from = new Date(entry.from);
    const to = new Date(entry.to);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (today >= from && today <= to) {
      return entry.character;
    }
  }
  return store.get('settings.character', 'cat');
}

// --- Auto-start helpers ---
const ELECTRON_EXE = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');

function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: ELECTRON_EXE,
    args: [__dirname]
  });
  store.set('settings.autoStart', enabled);
}

function getAutoStartStatus() {
  return app.getLoginItemSettings({
    path: ELECTRON_EXE,
    args: [__dirname]
  }).openAtLogin;
}

// --- Create main window ---
function createMainWindow() {
  const pos = store.get('windowPosition', { x: null, y: null });
  const { workArea } = screen.getPrimaryDisplay();

  const startX = pos.x !== null ? pos.x : workArea.x + workArea.width - FULL_W - MARGIN;
  const startY = pos.y !== null ? pos.y : workArea.y + workArea.height - FULL_H - MARGIN;

  mainWindow = new BrowserWindow({
    width: FULL_W,
    height: FULL_H,
    x: startX,
    y: startY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    store.set('windowPosition', { x, y });
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- Create settings window ---
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 600,
    title: 'DeskBuddy Settings',
    resizable: false,
    minimizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// --- Create tray ---
function createTray() {
  const iconPath = path.join(__dirname, 'src', 'assets', 'tray-icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    // Fallback: create a simple 16x16 orange icon
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAIUlEQVQ4jWNgGAWjgB' +
      'AAAAkAABAAFAAQABQAEAAUABAAFA=='
    );
  }

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show DeskBuddy',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: 'Settings',
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('DeskBuddy');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// --- File watcher ---
function startFileWatcher() {
  ensureTasksFile();
  let ignoreNext = false;

  fileWatcher = chokidar.watch(tasksFilePath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });

  fileWatcher.on('change', () => {
    if (ignoreNext) { ignoreNext = false; return; }
    const tasks = loadTasksFromFile();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tasks-updated', tasks);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('tasks-updated', tasks);
    }
  });

  global.suppressNextFileEvent = () => { ignoreNext = true; };
}

// --- IPC handlers ---
function setupIPC() {
ipcMain.handle('get-initial-data', () => {
  const tasks = loadTasksFromFile();
  const settings = store.get('settings');
  return {
    tasks,
    checkedTasks: store.get('checkedTasks', []),
    settings: { ...settings, tasksFilePath, autoStart: getAutoStartStatus() },
    schedule: store.get('schedule', []),
    character: getActiveCharacter(),
    tasksFilePath
  };
});

ipcMain.handle('get-tasks', () => {
  return {
    tasks: store.get('tasks', []),
    checkedTasks: store.get('checkedTasks', [])
  };
});

ipcMain.handle('save-tasks', (_, tasks) => {
  store.set('tasks', tasks);
  global.suppressNextFileEvent && global.suppressNextFileEvent();
  saveTasksToFile(tasks);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tasks-updated', tasks);
  }
  return true;
});

ipcMain.handle('set-checked', (_, checkedTasks) => {
  store.set('checkedTasks', checkedTasks);
  return true;
});

ipcMain.handle('get-settings', () => {
  return {
    ...store.get('settings'),
    autoStart: getAutoStartStatus(),
    tasksFilePath
  };
});

ipcMain.handle('save-settings', (_, settings) => {
  // Don't overwrite tasksFilePath from renderer
  const { tasksFilePath: _ignored, autoStart, ...rest } = settings;
  store.set('settings', { ...store.get('settings'), ...rest });
  if (autoStart !== undefined) {
    setAutoStart(autoStart);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', settings);
  }
  return true;
});

ipcMain.handle('get-schedule', () => {
  return store.get('schedule', []);
});

ipcMain.handle('save-schedule', (_, schedule) => {
  store.set('schedule', schedule);
  const activeChar = getActiveCharacter();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('character-changed', activeChar);
  }
  return true;
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
  return true;
});

ipcMain.handle('open-tasks-file', () => {
  shell.openPath(tasksFilePath);
  return true;
});

ipcMain.handle('choose-custom-image', async () => {
  const parent = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow;
  const result = await dialog.showOpenDialog(parent, {
    title: 'Choose Character Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const srcPath = result.filePaths[0];
    const destDir = path.join(userDataPath, 'custom');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const ext = path.extname(srcPath);
    const destPath = path.join(destDir, `custom-character${ext}`);
    fs.copyFileSync(srcPath, destPath);
    return destPath;
  }
  return null;
});

ipcMain.handle('get-character-image-path', (_, character) => {
  if (character === 'custom') {
    return store.get('settings.customCharacterPath');
  }
  // Prefer PNG, fall back to SVG
  const pngPath = path.join(__dirname, 'src', 'assets', 'characters', `${character}.png`);
  const svgPath = path.join(__dirname, 'src', 'assets', 'characters', `${character}.svg`);
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(svgPath)) return svgPath;
  return null;
});

ipcMain.handle('hide-window', () => {
  if (mainWindow) mainWindow.hide();
  return true;
});

ipcMain.handle('toggle-mini-mode', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return isMiniMode;
  isMiniMode = !isMiniMode;
  const { workArea } = screen.getPrimaryDisplay();

  mainWindow.setResizable(true);
  if (isMiniMode) {
    mainWindow.setSize(MINI_W, MINI_H);
    mainWindow.setPosition(
      workArea.x + workArea.width - MINI_W - MARGIN,
      workArea.y + workArea.height - MINI_H - MARGIN
    );
  } else {
    mainWindow.setSize(FULL_W, FULL_H);
    const pos = store.get('windowPosition', { x: null, y: null });
    const rx = pos.x !== null ? pos.x : workArea.x + workArea.width - FULL_W - MARGIN;
    const ry = pos.y !== null ? pos.y : workArea.y + workArea.height - FULL_H - MARGIN;
    mainWindow.setPosition(rx, ry);
  }
  mainWindow.setResizable(false);
  mainWindow.webContents.send('mini-mode-changed', isMiniMode);
  return isMiniMode;
});

ipcMain.handle('close-settings', () => {
  if (settingsWindow) settingsWindow.close();
  return true;
});
} // end setupIPC

// --- App lifecycle ---
app.on('ready', () => {
  initStore();
  ensureTasksFile();
  setupIPC();
  createTray();
  createMainWindow();
  startFileWatcher();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (fileWatcher) fileWatcher.close();
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.destroy();
  }
});
