window.Studio = window.Studio || {};

Studio.folders = {
  folders: [],
  shortcuts: [],
  expanded: new Set(),
  focusFolderId: null,

  init() {
    document.querySelectorAll('.tasks-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchSubview(btn.dataset.subview));
    });

    document.getElementById('btn-add-root-folder').addEventListener('click', () => this.addFolder(null));
    document.getElementById('btn-add-root-shortcut').addEventListener('click', () => this.addShortcut(null));

    this.load();
  },

  switchSubview(view) {
    document.querySelectorAll('.tasks-subnav-btn').forEach(b => b.classList.toggle('active', b.dataset.subview === view));
    document.getElementById('tasks-subview-tasks').classList.toggle('active', view === 'tasks');
    document.getElementById('tasks-subview-shortcuts').classList.toggle('active', view === 'shortcuts');
  },

  async load() {
    const data = await window.api.getFoldersShortcuts();
    this.folders = data.folders || [];
    this.shortcuts = data.shortcuts || [];
    this.render();
  },

  async save() {
    await window.api.saveFoldersShortcuts({ folders: this.folders, shortcuts: this.shortcuts });
  },

  addFolder(parentId) {
    const folder = { id: Date.now() + Math.random(), name: 'New Folder', parentId };
    this.folders.push(folder);
    if (parentId) this.expanded.add(parentId);
    this.focusFolderId = folder.id;
    this.save();
    this.render();
  },

  async addShortcut(folderId) {
    const result = await window.api.pickShortcutTarget();
    if (!result) return;
    this.shortcuts.push({ id: Date.now() + Math.random(), name: result.name, path: result.path, type: result.type, folderId });
    if (folderId) this.expanded.add(folderId);
    this.save();
    this.render();
  },

  renameFolder(folder, newName) {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== folder.name) {
      folder.name = trimmed;
      this.save();
    }
    this.render();
  },

  deleteFolder(folderId) {
    const confirmed = confirm('Delete this folder and everything inside it? This only removes the links in DeskBuddy — nothing on your computer is touched.');
    if (!confirmed) return;

    const idsToDelete = new Set([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      this.folders.forEach(f => {
        if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
          idsToDelete.add(f.id);
          changed = true;
        }
      });
    }

    this.folders = this.folders.filter(f => !idsToDelete.has(f.id));
    this.shortcuts = this.shortcuts.filter(s => !idsToDelete.has(s.folderId));
    this.save();
    this.render();
  },

  deleteShortcut(id) {
    this.shortcuts = this.shortcuts.filter(s => s.id !== id);
    this.save();
    this.render();
  },

  render() {
    const tree = document.getElementById('folders-tree');
    tree.innerHTML = '';
    this.renderLevel(tree, null, 0);

    if (this.focusFolderId) {
      const input = tree.querySelector(`input[data-folder-id="${this.focusFolderId}"]`);
      if (input) { input.focus(); input.select(); }
      this.focusFolderId = null;
    }
  },

  renderLevel(container, parentId, depth) {
    const childFolders = this.folders.filter(f => f.parentId === parentId);
    const childShortcuts = this.shortcuts.filter(s => s.folderId === parentId);

    if (depth === 0 && childFolders.length === 0 && childShortcuts.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'No folders or shortcuts yet — add one above.';
      container.appendChild(el);
      return;
    }

    childFolders.forEach(folder => {
      const row = document.createElement('div');
      row.className = 'folder-row';
      row.style.marginLeft = (depth * 20) + 'px';

      const isExpanded = this.expanded.has(folder.id);
      const chevron = document.createElement('button');
      chevron.className = 'folder-row-chevron';
      chevron.textContent = isExpanded ? '▾' : '▸';
      chevron.title = isExpanded ? 'Collapse' : 'Expand';
      chevron.addEventListener('click', () => {
        if (isExpanded) this.expanded.delete(folder.id); else this.expanded.add(folder.id);
        this.render();
      });

      const icon = document.createElement('span');
      icon.className = 'folder-row-icon';
      icon.textContent = '📁';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'folder-name-input';
      nameInput.dataset.folderId = folder.id;
      nameInput.value = folder.name;
      nameInput.maxLength = 60;
      nameInput.addEventListener('blur', () => this.renameFolder(folder, nameInput.value));
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

      const btnAddSubFolder = document.createElement('button');
      btnAddSubFolder.className = 'task-btn';
      btnAddSubFolder.textContent = '📁+';
      btnAddSubFolder.title = 'Add sub-folder';
      btnAddSubFolder.addEventListener('click', () => this.addFolder(folder.id));

      const btnAddShortcutHere = document.createElement('button');
      btnAddShortcutHere.className = 'task-btn';
      btnAddShortcutHere.textContent = '🔗+';
      btnAddShortcutHere.title = 'Add shortcut here';
      btnAddShortcutHere.addEventListener('click', () => this.addShortcut(folder.id));

      const btnDel = document.createElement('button');
      btnDel.className = 'task-btn';
      btnDel.textContent = '✕';
      btnDel.title = 'Delete folder';
      btnDel.addEventListener('click', () => this.deleteFolder(folder.id));

      row.appendChild(chevron);
      row.appendChild(icon);
      row.appendChild(nameInput);
      row.appendChild(btnAddSubFolder);
      row.appendChild(btnAddShortcutHere);
      row.appendChild(btnDel);
      container.appendChild(row);

      if (isExpanded) {
        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'folder-children';
        container.appendChild(childrenWrap);
        this.renderLevel(childrenWrap, folder.id, depth + 1);
      }
    });

    childShortcuts.forEach(shortcut => {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      row.style.marginLeft = (depth * 20) + 'px';

      const icon = document.createElement('span');
      icon.className = 'shortcut-row-icon';
      icon.textContent = shortcut.type === 'folder' ? '📁' : '📄';

      const name = document.createElement('span');
      name.className = 'shortcut-row-name';
      name.textContent = shortcut.name;
      name.title = 'Click to open';
      name.addEventListener('click', () => window.api.openShortcutTarget(shortcut.path));

      const pathLabel = document.createElement('span');
      pathLabel.className = 'shortcut-row-path';
      pathLabel.textContent = shortcut.path;
      pathLabel.title = shortcut.path;

      const btnDel = document.createElement('button');
      btnDel.className = 'task-btn';
      btnDel.textContent = '✕';
      btnDel.title = 'Remove shortcut';
      btnDel.addEventListener('click', () => this.deleteShortcut(shortcut.id));

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(pathLabel);
      row.appendChild(btnDel);
      container.appendChild(row);
    });
  }
};
