const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage, screen, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

// Force English regardless of the OS locale — affects native form controls
// (e.g. <input type="date">) that JS date formatting can't override on its own.
app.commandLine.appendSwitch('lang', 'en-US');

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
let tasksDir = null;
let archivedTasksDir = null;
let diaryDir = null;
let inspoDir = null;
let inspoMediaDir = null;

function initStore() {
  userDataPath = app.getPath('userData');
  tasksDir = path.join(userDataPath, 'tasks');
  archivedTasksDir = path.join(tasksDir, '.archived');
  diaryDir = path.join(userDataPath, 'diary');
  inspoDir = path.join(userDataPath, 'inspo');
  inspoMediaDir = path.join(inspoDir, 'media');
  const storePath = path.join(userDataPath, 'deskbuddy-config.json');
  store = new JsonStore(storePath, {
    schemaVersion: 1,
    workspaces: [],
    activeWorkspaceId: null,
    tasksByWorkspace: {},
    checkedByWorkspace: {},
    settings: {
      character: 'cat',
      autoStart: false,
      customCharacterPath: null,
      iconWindowVisible: true,
      iconWindowPosition: { x: null, y: null },
      theme: 'vivid'
    },
    schedule: [],
    studioWindowBounds: null,
    goals: []
  });
  if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });
  if (!fs.existsSync(diaryDir)) fs.mkdirSync(diaryDir, { recursive: true });
  if (!fs.existsSync(inspoMediaDir)) fs.mkdirSync(inspoMediaDir, { recursive: true });
}

function getDiaryFilePath(dateId) {
  return path.join(diaryDir, `${dateId}.txt`);
}

function getInspoDirs(boardId) {
  if (!boardId) return { dir: inspoDir, mediaDir: inspoMediaDir };
  const dir = path.join(inspoDir, 'tasks', boardId);
  return { dir, mediaDir: path.join(dir, 'media') };
}

function getInspoBoardPath(boardId) {
  return path.join(getInspoDirs(boardId).dir, 'board.json');
}

function ensureInspoMediaDir(boardId) {
  const { dir, mediaDir } = getInspoDirs(boardId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  return mediaDir;
}

function uniqueMediaName(ext) {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
}

// --- Workspace id slugging ---
function toWorkspaceId(name, existingIds) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

// --- One-time migration to the multi-workspace schema ---
function migrateLegacyDataIfNeeded() {
  if (store.get('schemaVersion') === 2) return;

  let workspaces = store.get('workspaces', []);
  if (!workspaces || workspaces.length === 0) {
    workspaces = [
      { id: 'uni', name: 'Uni' },
      { id: 'personal', name: 'Personal' },
      { id: 'work', name: 'Work' }
    ];
    store.set('workspaces', workspaces);
  }
  if (!store.get('activeWorkspaceId')) {
    store.set('activeWorkspaceId', workspaces[0].id);
  }

  const tasksByWorkspace = store.get('tasksByWorkspace', {});
  const checkedByWorkspace = store.get('checkedByWorkspace', {});
  for (const ws of workspaces) {
    if (!tasksByWorkspace[ws.id]) tasksByWorkspace[ws.id] = [];
    if (!checkedByWorkspace[ws.id]) checkedByWorkspace[ws.id] = [];
  }

  // One-time import of the legacy single tasks.txt into "personal"
  const legacyPath = path.join(userDataPath, 'tasks.txt');
  if (fs.existsSync(legacyPath) && tasksByWorkspace.personal && tasksByWorkspace.personal.length === 0) {
    const legacyTasks = store.get('tasks', []);
    const legacyChecked = store.get('checkedTasks', []);
    const lines = fs.readFileSync(legacyPath, 'utf8').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const imported = lines.map((text, i) => {
      const existing = legacyTasks.find(t => t.text === text);
      return { id: existing ? existing.id : Date.now() + i, text };
    });
    tasksByWorkspace.personal = imported;
    checkedByWorkspace.personal = legacyChecked.filter(id => imported.some(t => t.id === id));
  }

  store.set('tasksByWorkspace', tasksByWorkspace);
  store.set('checkedByWorkspace', checkedByWorkspace);
  store.set('schemaVersion', 2);
}

let iconWindow = null;
let studioWindow = null;
let tray = null;
const fileWatchers = new Map();
const ignoreNextChange = new Set();

const ICON_W = 80, ICON_H = 88, ICON_MARGIN = 16;
const STUDIO_W = 900, STUDIO_H = 650, STUDIO_MIN_W = 720, STUDIO_MIN_H = 480;

// --- Per-workspace task files ---
function getTasksFilePath(id) {
  return path.join(tasksDir, `${id}.txt`);
}

function ensureTasksFile(id) {
  const filePath = getTasksFilePath(id);
  if (!fs.existsSync(filePath)) {
    const tasks = store.get(`tasksByWorkspace.${id}`, []);
    const content = tasks.map(t => t.text).join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function loadTasksFromFile(id) {
  try {
    const content = fs.readFileSync(getTasksFilePath(id), 'utf8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const existingTasks = store.get(`tasksByWorkspace.${id}`, []);
    const newTasks = lines.map((text, i) => {
      const existing = existingTasks.find(t => t.text === text);
      return { ...(existing || {}), id: existing ? existing.id : Date.now() + i, text };
    });
    store.set(`tasksByWorkspace.${id}`, newTasks);
    const checked = store.get(`checkedByWorkspace.${id}`, []);
    const validIds = newTasks.map(t => t.id);
    store.set(`checkedByWorkspace.${id}`, checked.filter(cid => validIds.includes(cid)));
    return newTasks;
  } catch (e) {
    return store.get(`tasksByWorkspace.${id}`, []);
  }
}

function saveTasksToFile(id, tasks) {
  const content = tasks.map(t => t.text).join('\n');
  fs.writeFileSync(getTasksFilePath(id), content, 'utf8');
}

function startWatcherForWorkspace(id) {
  if (fileWatchers.has(id)) return;
  ensureTasksFile(id);
  const watcher = chokidar.watch(getTasksFilePath(id), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });
  watcher.on('change', () => {
    if (ignoreNextChange.has(id)) { ignoreNextChange.delete(id); return; }
    const tasks = loadTasksFromFile(id);
    if (studioWindow && !studioWindow.isDestroyed()) {
      studioWindow.webContents.send('tasks-updated', { workspaceId: id, tasks });
    }
  });
  fileWatchers.set(id, watcher);
}

function stopWatcherForWorkspace(id) {
  const watcher = fileWatchers.get(id);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(id);
  }
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

// --- Create icon window (always-on-top character launcher) ---
function createIconWindow() {
  if (iconWindow && !iconWindow.isDestroyed()) {
    iconWindow.focus();
    return;
  }

  const pos = store.get('settings.iconWindowPosition', { x: null, y: null });
  const { workArea } = screen.getPrimaryDisplay();

  const startX = pos.x !== null ? pos.x : workArea.x + workArea.width - ICON_W - ICON_MARGIN;
  const startY = pos.y !== null ? pos.y : workArea.y + workArea.height - ICON_H - ICON_MARGIN;

  iconWindow = new BrowserWindow({
    width: ICON_W,
    height: ICON_H,
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

  iconWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'icon.html'));

  iconWindow.on('moved', () => {
    const [x, y] = iconWindow.getPosition();
    store.set('settings.iconWindowPosition', { x, y });
  });

  iconWindow.on('closed', () => {
    iconWindow = null;
  });

  store.set('settings.iconWindowVisible', true);
}

function closeIconWindow() {
  store.set('settings.iconWindowVisible', false);
  if (iconWindow && !iconWindow.isDestroyed()) {
    iconWindow.destroy();
  }
  iconWindow = null;
}

// --- Create Studio window (the main organiser) ---
function createStudioWindow() {
  if (studioWindow && !studioWindow.isDestroyed()) {
    studioWindow.show();
    studioWindow.focus();
    return;
  }

  const bounds = store.get('studioWindowBounds');

  studioWindow = new BrowserWindow({
    width: bounds ? bounds.width : STUDIO_W,
    height: bounds ? bounds.height : STUDIO_H,
    x: bounds ? bounds.x : undefined,
    y: bounds ? bounds.y : undefined,
    minWidth: STUDIO_MIN_W,
    minHeight: STUDIO_MIN_H,
    title: 'DeskBuddy Studio',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  studioWindow.setMenu(null);
  studioWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'studio.html'));
  studioWindow.maximize();

  const persistBounds = () => {
    if (!studioWindow || studioWindow.isDestroyed()) return;
    store.set('studioWindowBounds', studioWindow.getBounds());
  };
  studioWindow.on('resize', persistBounds);
  studioWindow.on('move', persistBounds);

  studioWindow.on('close', (e) => {
    e.preventDefault();
    studioWindow.hide();
  });

  studioWindow.on('closed', () => {
    studioWindow = null;
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
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAIUlEQVQ4jWNgGAWjgB' +
      'AAAAkAABAAFAAQABQAEAAUABAAFA=='
    );
  }

  tray = new Tray(icon);

  const rebuildMenu = () => {
    const iconVisible = iconWindow && !iconWindow.isDestroyed();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Studio',
        click: () => createStudioWindow()
      },
      {
        label: 'Show Character Icon',
        enabled: !iconVisible,
        click: () => createIconWindow()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ]);
    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('DeskBuddy');
  rebuildMenu();

  tray.on('click', () => createStudioWindow());

  global.refreshTrayMenu = rebuildMenu;
}

// --- IPC handlers ---
function setupIPC() {

ipcMain.handle('get-icon-init-data', () => {
  return {
    character: getActiveCharacter(),
    theme: store.get('settings.theme', 'vivid')
  };
});

ipcMain.handle('get-studio-init-data', () => {
  const workspaces = store.get('workspaces', []);
  const tasksByWorkspace = {};
  const checkedByWorkspace = {};
  for (const ws of workspaces) {
    tasksByWorkspace[ws.id] = store.get(`tasksByWorkspace.${ws.id}`, []);
    checkedByWorkspace[ws.id] = store.get(`checkedByWorkspace.${ws.id}`, []);
  }
  return {
    workspaces,
    activeWorkspaceId: store.get('activeWorkspaceId'),
    tasksByWorkspace,
    checkedByWorkspace,
    settings: { ...store.get('settings'), autoStart: getAutoStartStatus() },
    schedule: store.get('schedule', [])
  };
});

ipcMain.handle('create-workspace', (_, name) => {
  const workspaces = store.get('workspaces', []);
  const id = toWorkspaceId(name, workspaces.map(w => w.id));
  const ws = { id, name: name.trim() };
  workspaces.push(ws);
  store.set('workspaces', workspaces);
  store.set(`tasksByWorkspace.${id}`, []);
  store.set(`checkedByWorkspace.${id}`, []);
  startWatcherForWorkspace(id);
  return ws;
});

ipcMain.handle('rename-workspace', (_, id, newName) => {
  const workspaces = store.get('workspaces', []);
  const ws = workspaces.find(w => w.id === id);
  if (ws) {
    ws.name = newName.trim();
    store.set('workspaces', workspaces);
  }
  return true;
});

ipcMain.handle('delete-workspace', (_, id) => {
  const workspaces = store.get('workspaces', []).filter(w => w.id !== id);
  store.set('workspaces', workspaces);

  stopWatcherForWorkspace(id);

  const tasksByWorkspace = store.get('tasksByWorkspace', {});
  delete tasksByWorkspace[id];
  store.set('tasksByWorkspace', tasksByWorkspace);

  const checkedByWorkspace = store.get('checkedByWorkspace', {});
  delete checkedByWorkspace[id];
  store.set('checkedByWorkspace', checkedByWorkspace);

  const filePath = getTasksFilePath(id);
  if (fs.existsSync(filePath)) {
    if (!fs.existsSync(archivedTasksDir)) fs.mkdirSync(archivedTasksDir, { recursive: true });
    const archivedPath = path.join(archivedTasksDir, `${id}-${Date.now()}.txt`);
    fs.renameSync(filePath, archivedPath);
  }

  if (store.get('activeWorkspaceId') === id) {
    store.set('activeWorkspaceId', workspaces.length > 0 ? workspaces[0].id : null);
  }

  return true;
});

ipcMain.handle('set-active-workspace', (_, id) => {
  store.set('activeWorkspaceId', id);
  return true;
});

ipcMain.handle('get-tasks', (_, workspaceId) => {
  return {
    tasks: store.get(`tasksByWorkspace.${workspaceId}`, []),
    checkedTasks: store.get(`checkedByWorkspace.${workspaceId}`, [])
  };
});

ipcMain.handle('save-tasks', (_, workspaceId, tasks) => {
  store.set(`tasksByWorkspace.${workspaceId}`, tasks);
  ignoreNextChange.add(workspaceId);
  saveTasksToFile(workspaceId, tasks);
  if (studioWindow && !studioWindow.isDestroyed()) {
    studioWindow.webContents.send('tasks-updated', { workspaceId, tasks });
  }
  return true;
});

ipcMain.handle('set-checked', (_, workspaceId, checkedIds) => {
  store.set(`checkedByWorkspace.${workspaceId}`, checkedIds);
  return true;
});

ipcMain.handle('open-tasks-file', (_, workspaceId) => {
  shell.openPath(getTasksFilePath(workspaceId));
  return true;
});

ipcMain.handle('get-goals', () => {
  return store.get('goals', []);
});

ipcMain.handle('save-goals', (_, goals) => {
  store.set('goals', goals);
  return true;
});

ipcMain.handle('get-folders-shortcuts', (_, boardId) => {
  if (!boardId) {
    return {
      folders: store.get('folders', []),
      shortcuts: store.get('shortcuts', [])
    };
  }
  return store.get(`taskFoldersShortcuts.${boardId}`, { folders: [], shortcuts: [] });
});

ipcMain.handle('save-folders-shortcuts', (_, boardId, data) => {
  if (!boardId) {
    store.set('folders', data.folders);
    store.set('shortcuts', data.shortcuts);
  } else {
    store.set(`taskFoldersShortcuts.${boardId}`, data);
  }
  return true;
});

ipcMain.handle('pick-shortcut-target', async () => {
  const parent = studioWindow && !studioWindow.isDestroyed() ? studioWindow : undefined;
  const result = await dialog.showOpenDialog(parent, {
    title: 'Add Shortcut',
    properties: ['openFile', 'openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const targetPath = result.filePaths[0];
  const isDirectory = fs.statSync(targetPath).isDirectory();
  return {
    path: targetPath,
    name: path.basename(targetPath),
    type: isDirectory ? 'folder' : 'file'
  };
});

ipcMain.handle('open-shortcut-target', (_, targetPath) => {
  shell.openPath(targetPath);
  return true;
});

ipcMain.handle('get-diary-entry', (_, dateId) => {
  try {
    return fs.readFileSync(getDiaryFilePath(dateId), 'utf8');
  } catch {
    return '';
  }
});

ipcMain.handle('save-diary-entry', (_, dateId, text) => {
  fs.writeFileSync(getDiaryFilePath(dateId), text, 'utf8');
  return true;
});

ipcMain.handle('get-diary-stickers', (_, dateId) => {
  return store.get(`diaryStickers.${dateId}`, []);
});

ipcMain.handle('save-diary-stickers', (_, dateId, stickers) => {
  store.set(`diaryStickers.${dateId}`, stickers);
  return true;
});

ipcMain.handle('get-sticker-catalog', () => {
  const stickersDir = path.join(__dirname, 'src', 'assets', 'stickers');
  try {
    return fs.readdirSync(stickersDir)
      .filter(f => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f))
      .map(f => ({ id: path.parse(f).name, path: path.join(stickersDir, f) }));
  } catch {
    return [];
  }
});

ipcMain.handle('get-inspo-board', (_, boardId) => {
  try {
    return JSON.parse(fs.readFileSync(getInspoBoardPath(boardId), 'utf8'));
  } catch {
    return { items: [], nextZ: 1 };
  }
});

ipcMain.handle('save-inspo-board', (_, boardId, board) => {
  const { dir } = getInspoDirs(boardId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getInspoBoardPath(boardId), JSON.stringify(board, null, 2), 'utf8');
  return true;
});

ipcMain.handle('import-inspo-image', (_, boardId, srcPath) => {
  const mediaDir = ensureInspoMediaDir(boardId);
  const ext = path.extname(srcPath) || '.png';
  const destPath = path.join(mediaDir, uniqueMediaName(ext));
  fs.copyFileSync(srcPath, destPath);
  return destPath;
});

ipcMain.handle('pick-inspo-images', async (_, boardId) => {
  const parent = studioWindow && !studioWindow.isDestroyed() ? studioWindow : undefined;
  const result = await dialog.showOpenDialog(parent, {
    title: 'Add Images to Inspo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return [];
  const mediaDir = ensureInspoMediaDir(boardId);
  return result.filePaths.map(srcPath => {
    const ext = path.extname(srcPath) || '.png';
    const destPath = path.join(mediaDir, uniqueMediaName(ext));
    fs.copyFileSync(srcPath, destPath);
    return destPath;
  });
});

ipcMain.handle('save-inspo-drawing', (_, boardId, dataUrl, existingPath) => {
  const mediaDir = ensureInspoMediaDir(boardId);
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const destPath = existingPath || path.join(mediaDir, uniqueMediaName('.png'));
  fs.writeFileSync(destPath, buffer);
  return destPath;
});

ipcMain.handle('get-settings', () => {
  return {
    ...store.get('settings'),
    autoStart: getAutoStartStatus()
  };
});

ipcMain.handle('save-settings', (_, settings) => {
  const { autoStart, ...rest } = settings;
  store.set('settings', { ...store.get('settings'), ...rest });
  if (autoStart !== undefined) {
    setAutoStart(autoStart);
  }
  if (studioWindow && !studioWindow.isDestroyed()) {
    studioWindow.webContents.send('settings-updated', settings);
  }
  if (iconWindow && !iconWindow.isDestroyed()) {
    iconWindow.webContents.send('character-changed', getActiveCharacter());
  }
  return true;
});

ipcMain.handle('get-schedule', () => {
  return store.get('schedule', []);
});

ipcMain.handle('save-schedule', (_, schedule) => {
  store.set('schedule', schedule);
  const activeChar = getActiveCharacter();
  if (iconWindow && !iconWindow.isDestroyed()) {
    iconWindow.webContents.send('character-changed', activeChar);
  }
  return true;
});

ipcMain.handle('open-studio', () => {
  createStudioWindow();
  return true;
});

ipcMain.handle('close-icon-window', () => {
  closeIconWindow();
  if (global.refreshTrayMenu) global.refreshTrayMenu();
  return true;
});

ipcMain.handle('show-icon-context-menu', () => {
  if (!iconWindow || iconWindow.isDestroyed()) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Open Studio', click: () => createStudioWindow() },
    { label: 'Close Icon', click: () => {
      closeIconWindow();
      if (global.refreshTrayMenu) global.refreshTrayMenu();
    } }
  ]);
  menu.popup({ window: iconWindow });
});

ipcMain.handle('choose-custom-image', async () => {
  const parent = studioWindow && !studioWindow.isDestroyed() ? studioWindow : undefined;
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
  const pngPath = path.join(__dirname, 'src', 'assets', 'characters', `${character}.png`);
  const svgPath = path.join(__dirname, 'src', 'assets', 'characters', `${character}.svg`);
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(svgPath)) return svgPath;
  return null;
});

} // end setupIPC

// --- Deadlines & reminders ---
function formatDateId(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function checkDeadlinesAndNotify() {
  const todayId = formatDateId(new Date());
  if (store.get('lastDeadlineNotifyDate') === todayId) return;
  store.set('lastDeadlineNotifyDate', todayId);

  const workspaces = store.get('workspaces', []);
  const dueTasks = [];
  for (const ws of workspaces) {
    const tasks = store.get(`tasksByWorkspace.${ws.id}`, []);
    const checked = store.get(`checkedByWorkspace.${ws.id}`, []);
    for (const task of tasks) {
      if (task.dueDate && task.dueDate <= todayId && !checked.includes(task.id)) {
        dueTasks.push(task);
      }
    }
  }

  if (dueTasks.length === 0 || !Notification.isSupported()) return;

  const body = dueTasks.length === 1
    ? dueTasks[0].text
    : `${dueTasks.slice(0, 2).map(t => t.text).join(', ')}${dueTasks.length > 2 ? `, +${dueTasks.length - 2} more` : ''}`;

  const notification = new Notification({
    title: dueTasks.length === 1 ? 'Task due' : `${dueTasks.length} tasks due`,
    body
  });
  notification.on('click', () => {
    createStudioWindow();
    if (studioWindow && !studioWindow.isDestroyed()) {
      studioWindow.webContents.send('navigate-to-section', 'calendar');
    }
  });
  notification.show();
}

// --- App lifecycle ---
app.on('ready', () => {
  initStore();
  migrateLegacyDataIfNeeded();
  setupIPC();
  createTray();

  const workspaces = store.get('workspaces', []);
  for (const ws of workspaces) {
    startWatcherForWorkspace(ws.id);
  }

  if (store.get('settings.iconWindowVisible', true)) {
    createIconWindow();
  }

  checkDeadlinesAndNotify();
  setInterval(checkDeadlinesAndNotify, 60 * 60 * 1000);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  for (const watcher of fileWatchers.values()) watcher.close();
  fileWatchers.clear();

  if (studioWindow) {
    studioWindow.removeAllListeners('close');
    studioWindow.destroy();
  }
  if (iconWindow) {
    iconWindow.removeAllListeners('close');
    iconWindow.destroy();
  }
});
