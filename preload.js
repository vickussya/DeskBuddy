const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  setChecked: (checkedTasks) => ipcRenderer.invoke('set-checked', checkedTasks),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSchedule: () => ipcRenderer.invoke('get-schedule'),
  saveSchedule: (schedule) => ipcRenderer.invoke('save-schedule', schedule),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  openTasksFile: () => ipcRenderer.invoke('open-tasks-file'),
  chooseCustomImage: () => ipcRenderer.invoke('choose-custom-image'),
  getCharacterImagePath: (character) => ipcRenderer.invoke('get-character-image-path', character),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),

  onTasksUpdated: (cb) => ipcRenderer.on('tasks-updated', (_, data) => cb(data)),
  onTasksReset: (cb) => ipcRenderer.on('tasks-reset', () => cb()),
  onSettingsUpdated: (cb) => ipcRenderer.on('settings-updated', (_, data) => cb(data)),
  onCharacterChanged: (cb) => ipcRenderer.on('character-changed', (_, char) => cb(char)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
