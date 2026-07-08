window.Studio = window.Studio || {};

Studio.calendar = {
  viewDate: null,
  selectedDateId: null,
  plansByDate: {},
  decorItems: [],
  decorNextZ: 1,

  async init() {
    this.viewDate = new Date();
    this.viewDate.setDate(1);
    this.selectedDateId = this.formatDateId(new Date());

    document.getElementById('btn-calendar-prev').addEventListener('click', () => this.prevMonth());
    document.getElementById('btn-calendar-next').addEventListener('click', () => this.nextMonth());
    document.getElementById('btn-calendar-today').addEventListener('click', () => this.goToday());

    const addStickerBtn = document.getElementById('btn-calendar-decor-add-sticker');
    addStickerBtn.addEventListener('click', () => {
      Studio.stickers.openPicker(addStickerBtn, (stickerId) => this.addDecorSticker(stickerId));
    });
    document.getElementById('btn-calendar-decor-add-photo').addEventListener('click', () => this.pickDecorPhotos());

    const decorLayer = document.getElementById('calendar-decor-layer');
    decorLayer.addEventListener('dragover', (e) => { e.preventDefault(); decorLayer.classList.add('drop-active'); });
    decorLayer.addEventListener('dragleave', () => decorLayer.classList.remove('drop-active'));
    decorLayer.addEventListener('drop', (e) => this.handleDecorDrop(e));

    this.plansByDate = await window.api.getAllPlanItems();
    await this.loadDecor(this.selectedDateId);
    this.render();
  },

  async refresh() {
    this.plansByDate = await window.api.getAllPlanItems();
    await this.loadDecor(this.selectedDateId);
    this.render();
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

  prevMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.render();
  },

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.render();
  },

  async goToday() {
    const today = new Date();
    this.viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
    await this.selectDay(this.formatDateId(today));
  },

  async selectDay(dateId) {
    this.selectedDateId = dateId;
    await this.loadDecor(dateId);
    this.render();
  },

  buildMonthGrid(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-start: 0=Mon..6=Sun
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  },

  buildTasksByDate() {
    const map = {};
    (Studio.goals.workspaces || []).forEach(ws => {
      const goals = Studio.goals.goalsByWorkspace[ws.id] || [];
      goals.forEach(goal => {
        goal.tasks.forEach(task => {
          if (!task.startDate || !task.endDate) return;
          const cursor = this.parseDateId(task.startDate);
          const end = this.parseDateId(task.endDate);
          while (cursor <= end) {
            const dateId = this.formatDateId(cursor);
            if (!map[dateId]) map[dateId] = [];
            map[dateId].push({ kind: 'task', ws, goal, task });
            cursor.setDate(cursor.getDate() + 1);
          }
        });
      });
    });
    Object.keys(this.plansByDate).forEach(dateId => {
      const items = this.plansByDate[dateId] || [];
      items.forEach(item => {
        if (!map[dateId]) map[dateId] = [];
        map[dateId].push({ kind: 'plan', dateId, item });
      });
    });
    return map;
  },

  render() {
    const label = document.getElementById('calendar-month-label');
    label.textContent = this.viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'calendar-weekday';
      el.textContent = d;
      grid.appendChild(el);
    });

    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const cells = this.buildMonthGrid(year, month);
    const todayId = this.formatDateId(new Date());
    const tasksByDate = this.buildTasksByDate();

    cells.forEach(date => {
      const cell = document.createElement('div');
      cell.className = 'calendar-day';

      if (!date) {
        cell.classList.add('calendar-day-empty');
        grid.appendChild(cell);
        return;
      }

      const dateId = this.formatDateId(date);
      if (dateId === todayId) cell.classList.add('calendar-day-today');
      if (dateId === this.selectedDateId) cell.classList.add('calendar-day-selected');

      const num = document.createElement('div');
      num.className = 'calendar-day-number';
      num.textContent = date.getDate();
      cell.appendChild(num);

      if (tasksByDate[dateId] && tasksByDate[dateId].length > 0) {
        const dot = document.createElement('div');
        dot.className = 'calendar-day-dot';
        cell.appendChild(dot);
      }

      cell.addEventListener('click', () => this.selectDay(dateId));
      grid.appendChild(cell);
    });

    this.renderDayDetail();
    this.renderDecorLayer();
  },

  renderDayDetail() {
    const title = document.getElementById('calendar-day-detail-title');
    const list = document.getElementById('calendar-day-task-list');
    list.innerHTML = '';

    if (!this.selectedDateId) {
      title.textContent = '';
      return;
    }

    const date = this.parseDateId(this.selectedDateId);
    title.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const entries = this.buildTasksByDate()[this.selectedDateId] || [];

    if (entries.length === 0) {
      const el = document.createElement('div');
      el.className = 'no-tasks';
      el.textContent = 'Nothing due this day.';
      list.appendChild(el);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'home-task-row';

      const isChecked = entry.kind === 'task' ? entry.task.checked : entry.item.checked;
      const label = entry.kind === 'task' ? entry.task.text : entry.item.text;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = isChecked;
      checkbox.setAttribute('aria-label', `Mark "${label}" as done`);
      checkbox.addEventListener('change', () => {
        if (entry.kind === 'task') this.toggleTask(entry.ws.id, entry.goal.id, entry.task.id);
        else this.togglePlanItem(entry.dateId, entry.item.id);
      });

      const tag = document.createElement('span');
      tag.className = 'home-task-workspace-tag';
      tag.textContent = entry.kind === 'task' ? entry.ws.name : 'Plan';

      const text = document.createElement('span');
      text.className = 'home-task-text';
      text.textContent = label;
      if (isChecked) text.style.textDecoration = 'line-through';

      row.appendChild(checkbox);
      row.appendChild(tag);
      row.appendChild(text);
      list.appendChild(row);
    });
  },

  async toggleTask(workspaceId, goalId, taskId) {
    await Studio.goals.toggleTaskChecked(workspaceId, goalId, taskId);
    this.render();
  },

  async togglePlanItem(dateId, itemId) {
    const items = this.plansByDate[dateId] || [];
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    item.checked = !item.checked;
    await window.api.savePlanItems(dateId, items);
    this.render();
  },

  // ===== Day decoration (stickers + photos) =====

  async loadDecor(dateId) {
    this.decorItems = await window.api.getCalendarDecor(dateId);
    this.decorNextZ = this.decorItems.reduce((max, i) => Math.max(max, i.z || 1), 1);
  },

  async saveDecor() {
    await window.api.saveCalendarDecor(this.selectedDateId, this.decorItems);
  },

  nextDecorPosition() {
    const step = (this.decorItems.length % 8) * 30;
    return { x: 40 + step, y: 40 + step };
  },

  addDecorSticker(stickerId) {
    if (!stickerId) return;
    const { x, y } = this.nextDecorPosition();
    this.decorItems.push({ id: Date.now() + Math.random(), kind: 'sticker', stickerId, x, y, w: 90, h: 90, rotation: 0, z: ++this.decorNextZ });
    this.saveDecor();
    this.renderDecorLayer();
  },

  addDecorPhoto(mediaPath) {
    const { x, y } = this.nextDecorPosition();
    this.decorItems.push({ id: Date.now() + Math.random(), kind: 'photo', mediaPath, x, y, w: 140, h: 140, rotation: 0, z: ++this.decorNextZ });
    this.saveDecor();
    this.renderDecorLayer();
  },

  async pickDecorPhotos() {
    const paths = await window.api.pickCalendarPhotos();
    paths.forEach(p => this.addDecorPhoto(p));
  },

  async handleDecorDrop(e) {
    e.preventDefault();
    document.getElementById('calendar-decor-layer').classList.remove('drop-active');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      const destPath = await window.api.importCalendarPhoto(file.path);
      this.addDecorPhoto(destPath);
    }
  },

  deleteDecorItem(id) {
    this.decorItems = this.decorItems.filter(i => i.id !== id);
    this.saveDecor();
    this.renderDecorLayer();
  },

  renderDecorLayer() {
    const layer = document.getElementById('calendar-decor-layer');
    layer.innerHTML = '';
    this.decorItems.forEach(item => this.renderDecorItem(layer, item));
  },

  renderDecorItem(layer, item) {
    const el = document.createElement('div');
    el.className = 'calendar-decor-item';
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.width = item.w + 'px';
    el.style.height = item.h + 'px';
    el.style.zIndex = item.z;
    el.style.transform = `rotate(${item.rotation || 0}deg)`;

    const img = document.createElement('img');
    img.src = item.kind === 'sticker'
      ? Studio.stickers.getStickerSrc(item.stickerId)
      : `file://${item.mediaPath.replace(/\\/g, '/')}`;
    img.draggable = false;
    el.appendChild(img);

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'calendar-decor-rotate-handle';
    el.appendChild(rotateHandle);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'calendar-decor-resize-handle';
    el.appendChild(resizeHandle);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'calendar-decor-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteDecorItem(item.id); });
    el.appendChild(deleteBtn);

    this.attachDecorDrag(el, item);
    this.attachDecorResize(resizeHandle, el, item);
    this.attachDecorRotate(rotateHandle, el, item);

    layer.appendChild(el);
  },

  attachDecorDrag(boxEl, item) {
    boxEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.calendar-decor-resize-handle, .calendar-decor-rotate-handle, .calendar-decor-delete')) return;
      e.preventDefault();

      const startX = e.clientX, startY = e.clientY;
      const origLeft = parseFloat(boxEl.style.left);
      const origTop = parseFloat(boxEl.style.top);
      boxEl.style.zIndex = ++this.decorNextZ;
      boxEl.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        boxEl.style.left = (origLeft + ev.clientX - startX) + 'px';
        boxEl.style.top = (origTop + ev.clientY - startY) + 'px';
      };
      const onUp = () => {
        boxEl.removeEventListener('pointermove', onMove);
        boxEl.removeEventListener('pointerup', onUp);
        item.x = parseFloat(boxEl.style.left);
        item.y = parseFloat(boxEl.style.top);
        item.z = this.decorNextZ;
        this.saveDecor();
      };
      boxEl.addEventListener('pointermove', onMove);
      boxEl.addEventListener('pointerup', onUp);
    });
  },

  attachDecorResize(handle, boxEl, item) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const origW = parseFloat(boxEl.style.width);
      const origH = parseFloat(boxEl.style.height);
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const scale = Math.max(0.2, (origW + ev.clientX - startX) / origW);
        boxEl.style.width = Math.max(24, origW * scale) + 'px';
        boxEl.style.height = Math.max(24, origH * scale) + 'px';
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        item.w = parseFloat(boxEl.style.width);
        item.h = parseFloat(boxEl.style.height);
        this.saveDecor();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  },

  attachDecorRotate(handle, boxEl, item) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const rect = boxEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180 / Math.PI + 90;
        boxEl.style.transform = `rotate(${angle}deg)`;
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        const match = boxEl.style.transform.match(/rotate\(([-\d.]+)deg\)/);
        item.rotation = match ? parseFloat(match[1]) : 0;
        this.saveDecor();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }
};
