window.Studio = window.Studio || {};

Studio.diary = {
  currentDateId: null,
  currentText: '',
  saveTimer: null,
  stickers: [],
  nextZ: 1,

  init() {
    this.dateInput = document.getElementById('diary-date-input');
    this.textarea = document.getElementById('diary-textarea');
    this.dateLabel = document.getElementById('diary-date-label');
    this.saveStatus = document.getElementById('diary-save-status');
    this.stickerLayer = document.getElementById('diary-sticker-layer');

    document.getElementById('btn-diary-prev').addEventListener('click', () => this.shiftDay(-1));
    document.getElementById('btn-diary-next').addEventListener('click', () => this.shiftDay(1));
    document.getElementById('btn-diary-today').addEventListener('click', () => this.goToDate(new Date()));
    this.dateInput.addEventListener('change', () => {
      if (this.dateInput.value) this.goToDate(this.parseDateId(this.dateInput.value));
    });

    const addStickerBtn = document.getElementById('btn-diary-add-sticker');
    addStickerBtn.addEventListener('click', () => {
      Studio.stickers.openPicker(addStickerBtn, (stickerId) => this.addSticker(stickerId));
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

    await this.loadStickers(dateId);
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
  },

  // ===== Stickers =====

  async loadStickers(dateId) {
    this.stickers = await window.api.getDiaryStickers(dateId);
    this.nextZ = this.stickers.reduce((max, s) => Math.max(max, s.z || 1), 1);
    this.renderStickers();
  },

  async saveStickers() {
    await window.api.saveDiaryStickers(this.currentDateId, this.stickers);
  },

  addSticker(stickerId) {
    if (!stickerId) return;
    const step = (this.stickers.length % 8) * 30;
    this.stickers.push({
      id: Date.now() + Math.random(),
      stickerId,
      x: 40 + step, y: 40 + step, w: 90, h: 90, rotation: 0,
      z: ++this.nextZ
    });
    this.saveStickers();
    this.renderStickers();
  },

  deleteSticker(id) {
    this.stickers = this.stickers.filter(s => s.id !== id);
    this.saveStickers();
    this.renderStickers();
  },

  renderStickers() {
    this.stickerLayer.innerHTML = '';
    this.stickers.forEach(item => this.renderSticker(item));
  },

  renderSticker(item) {
    const el = document.createElement('div');
    el.className = 'diary-sticker-item';
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.width = item.w + 'px';
    el.style.height = item.h + 'px';
    el.style.zIndex = item.z;
    el.style.transform = `rotate(${item.rotation || 0}deg)`;

    const img = document.createElement('img');
    img.src = Studio.stickers.getStickerSrc(item.stickerId);
    img.draggable = false;
    el.appendChild(img);

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'diary-sticker-rotate-handle';
    el.appendChild(rotateHandle);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'diary-sticker-resize-handle';
    el.appendChild(resizeHandle);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'diary-sticker-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteSticker(item.id); });
    el.appendChild(deleteBtn);

    this.attachDrag(el, item);
    this.attachResize(resizeHandle, el, item);
    this.attachRotate(rotateHandle, el, item);

    this.stickerLayer.appendChild(el);
  },

  attachDrag(boxEl, item) {
    boxEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.diary-sticker-resize-handle, .diary-sticker-rotate-handle, .diary-sticker-delete')) return;
      e.preventDefault();

      const startX = e.clientX, startY = e.clientY;
      const origLeft = parseFloat(boxEl.style.left);
      const origTop = parseFloat(boxEl.style.top);
      boxEl.style.zIndex = ++this.nextZ;
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
        item.z = this.nextZ;
        this.saveStickers();
      };
      boxEl.addEventListener('pointermove', onMove);
      boxEl.addEventListener('pointerup', onUp);
    });
  },

  attachResize(handle, boxEl, item) {
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
        this.saveStickers();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  },

  attachRotate(handle, boxEl, item) {
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
        this.saveStickers();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }
};
