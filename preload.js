const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getIconInitData: () => ipcRenderer.invoke('get-icon-init-data'),
  getStudioInitData: () => ipcRenderer.invoke('get-studio-init-data'),

  createWorkspace: (name) => ipcRenderer.invoke('create-workspace', name),
  renameWorkspace: (id, newName) => ipcRenderer.invoke('rename-workspace', id, newName),
  deleteWorkspace: (id) => ipcRenderer.invoke('delete-workspace', id),
  setActiveWorkspace: (id) => ipcRenderer.invoke('set-active-workspace', id),

  getTasks: (workspaceId) => ipcRenderer.invoke('get-tasks', workspaceId),
  saveTasks: (workspaceId, tasks) => ipcRenderer.invoke('save-tasks', workspaceId, tasks),
  setChecked: (workspaceId, checkedIds) => ipcRenderer.invoke('set-checked', workspaceId, checkedIds),
  openTasksFile: (workspaceId) => ipcRenderer.invoke('open-tasks-file', workspaceId),

  getDiaryEntry: (dateId) => ipcRenderer.invoke('get-diary-entry', dateId),
  saveDiaryEntry: (dateId, text) => ipcRenderer.invoke('save-diary-entry', dateId, text),

  getGoals: () => ipcRenderer.invoke('get-goals'),
  saveGoals: (goals) => ipcRenderer.invoke('save-goals', goals),

  getFoldersShortcuts: (boardId) => ipcRenderer.invoke('get-folders-shortcuts', boardId),
  saveFoldersShortcuts: (boardId, data) => ipcRenderer.invoke('save-folders-shortcuts', boardId, data),
  pickShortcutTarget: () => ipcRenderer.invoke('pick-shortcut-target'),
  openShortcutTarget: (targetPath) => ipcRenderer.invoke('open-shortcut-target', targetPath),

  getInspoBoard: (boardId) => ipcRenderer.invoke('get-inspo-board', boardId),
  saveInspoBoard: (boardId, board) => ipcRenderer.invoke('save-inspo-board', boardId, board),
  importInspoImage: (boardId, srcPath) => ipcRenderer.invoke('import-inspo-image', boardId, srcPath),
  pickInspoImages: (boardId) => ipcRenderer.invoke('pick-inspo-images', boardId),
  saveInspoDrawing: (boardId, dataUrl, existingPath) => ipcRenderer.invoke('save-inspo-drawing', boardId, dataUrl, existingPath),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSchedule: () => ipcRenderer.invoke('get-schedule'),
  saveSchedule: (schedule) => ipcRenderer.invoke('save-schedule', schedule),

  openStudio: () => ipcRenderer.invoke('open-studio'),
  closeIconWindow: () => ipcRenderer.invoke('close-icon-window'),
  showIconContextMenu: () => ipcRenderer.invoke('show-icon-context-menu'),

  chooseCustomImage: () => ipcRenderer.invoke('choose-custom-image'),
  getCharacterImagePath: (character) => ipcRenderer.invoke('get-character-image-path', character),

  onTasksUpdated: (cb) => ipcRenderer.on('tasks-updated', (_, data) => cb(data)),
  onSettingsUpdated: (cb) => ipcRenderer.on('settings-updated', (_, data) => cb(data)),
  onCharacterChanged: (cb) => ipcRenderer.on('character-changed', (_, char) => cb(char)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
