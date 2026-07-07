window.Studio = window.Studio || {};

Studio.inspo = {
  items: [],
  nextZ: 1,
  canvasInner: null,

  async init() {
    this.canvasInner = document.getElementById('inspo-canvas-inner');
    const canvas = document.getElementById('inspo-canvas');

    const board = await window.api.getInspoBoard();
    this.items = board.items || [];
    this.nextZ = board.nextZ || 1;

    document.getElementById('btn-inspo-add-note').addEventListener('click', () => this.addNote());
    document.getElementById('btn-inspo-add-drawing').addEventListener('click', () => this.addDrawing());
    document.getElementById('btn-inspo-add-image').addEventListener('click', () => this.pickImages());

    canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('drop-active'); });
    canvas.addEventListener('dragleave', () => canvas.classList.remove('drop-active'));
    canvas.addEventListener('drop', (e) => this.handleDrop(e));

    this.render();
  },

  nextPosition() {
    const n = this.items.length;
    const step = (n % 8) * 30;
    return { x: 40 + step, y: 40 + step };
  },

  async save() {
    await window.api.saveInspoBoard({ items: this.items, nextZ: this.nextZ });
  },

  async handleDrop(e) {
    e.preventDefault();
    document.getElementById('inspo-canvas').classList.remove('drop-active');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      const destPath = await window.api.importInspoImage(file.path);
      this.addImageItem(destPath);
    }
  },

  async pickImages() {
    const paths = await window.api.pickInspoImages();
    paths.forEach(p => this.addImageItem(p));
  },

  addImageItem(mediaPath) {
    const { x, y } = this.nextPosition();
    this.items.push({ id: Date.now() + Math.random(), type: 'image', x, y, w: 220, h: 220, z: ++this.nextZ, mediaPath });
    this.save();
    this.render();
  },

  addNote() {
    const { x, y } = this.nextPosition();
    this.items.push({ id: Date.now() + Math.random(), type: 'note', x, y, w: 180, h: 140, z: ++this.nextZ, text: '' });
    this.save();
    this.render();
  },

  addDrawing() {
    const { x, y } = this.nextPosition();
    this.items.push({ id: Date.now() + Math.random(), type: 'drawing', x, y, w: 240, h: 240, z: ++this.nextZ, mediaPath: null, editing: true });
    this.save();
    this.render();
  },

  deleteItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
    this.render();
  },

  render() {
    this.canvasInner.innerHTML = '';
    this.items.forEach(item => this.renderItem(item));
  },

  renderItem(item) {
    const el = document.createElement('div');
    el.className = 'inspo-item';
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.width = item.w + 'px';
    el.style.height = item.h + 'px';
    el.style.zIndex = item.z;

    if (item.type === 'note') {
      el.classList.add('inspo-item-note');
      const handle = document.createElement('div');
      handle.className = 'inspo-drag-handle';
      this.attachDrag(handle, el, item);

      const textarea = document.createElement('textarea');
      textarea.value = item.text || '';
      textarea.addEventListener('blur', () => {
        if (textarea.value !== item.text) {
          item.text = textarea.value;
          this.save();
        }
      });

      el.appendChild(handle);
      el.appendChild(textarea);
    } else if (item.type === 'image') {
      el.classList.add('inspo-item-image');
      const img = document.createElement('img');
      img.src = `file://${item.mediaPath.replace(/\\/g, '/')}`;
      el.appendChild(img);
      this.attachDrag(el, el, item);
    } else if (item.type === 'drawing') {
      if (item.editing) {
        this.renderDrawingEditor(el, item);
      } else {
        el.classList.add('inspo-item-drawing-display');
        const img = document.createElement('img');
        img.src = `file://${item.mediaPath.replace(/\\/g, '/')}?t=${Date.now()}`;
        el.appendChild(img);
        el.addEventListener('dblclick', () => { item.editing = true; this.render(); });
        this.attachDrag(el, el, item);
      }
    }

    if (!item.editing) {
      const resize = document.createElement('div');
      resize.className = 'inspo-resize-handle';
      this.attachResize(resize, el, item);
      el.appendChild(resize);

      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'inspo-item-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteItem(item.id); });
      el.appendChild(deleteBtn);
    }

    this.canvasInner.appendChild(el);
  },

  attachDrag(handleEl, boxEl, item) {
    handleEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.inspo-item-delete, .inspo-resize-handle, .inspo-draw-toolbar')) return;
      e.preventDefault();

      const startX = e.clientX, startY = e.clientY;
      const origLeft = parseFloat(boxEl.style.left);
      const origTop = parseFloat(boxEl.style.top);
      boxEl.style.zIndex = ++this.nextZ;
      handleEl.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        boxEl.style.left = (origLeft + ev.clientX - startX) + 'px';
        boxEl.style.top = (origTop + ev.clientY - startY) + 'px';
      };
      const onUp = () => {
        handleEl.removeEventListener('pointermove', onMove);
        handleEl.removeEventListener('pointerup', onUp);
        item.x = parseFloat(boxEl.style.left);
        item.y = parseFloat(boxEl.style.top);
        item.z = this.nextZ;
        this.save();
      };
      handleEl.addEventListener('pointermove', onMove);
      handleEl.addEventListener('pointerup', onUp);
    });
  },

  attachResize(handle, boxEl, item) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX, startY = e.clientY;
      const origW = parseFloat(boxEl.style.width);
      const origH = parseFloat(boxEl.style.height);
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        boxEl.style.width = Math.max(60, origW + ev.clientX - startX) + 'px';
        boxEl.style.height = Math.max(60, origH + ev.clientY - startY) + 'px';
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        item.w = parseFloat(boxEl.style.width);
        item.h = parseFloat(boxEl.style.height);
        this.save();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  },

  renderDrawingEditor(el, item) {
    const canvas = document.createElement('canvas');
    canvas.width = item.w;
    canvas.height = item.h;
    el.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (item.mediaPath) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = `file://${item.mediaPath.replace(/\\/g, '/')}?t=${Date.now()}`;
    }

    let color = '#3a3a3a';
    let size = 4;
    let drawing = false;
    let lastX = 0, lastY = 0;

    const toolbar = document.createElement('div');
    toolbar.className = 'inspo-draw-toolbar';

    ['#3a3a3a', '#c0392b', '#2980b9', '#27ae60', '#e67e22'].forEach((c, i) => {
      const sw = document.createElement('div');
      sw.className = 'inspo-color-swatch' + (i === 0 ? ' selected' : '');
      sw.style.background = c;
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        color = c;
        toolbar.querySelectorAll('.inspo-color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
      });
      toolbar.appendChild(sw);
    });

    [2, 4, 8].forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'inspo-brush-btn' + (s === size ? ' selected' : '');
      btn.textContent = s;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        size = s;
        toolbar.querySelectorAll('.inspo-brush-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      toolbar.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'inspo-brush-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    toolbar.appendChild(clearBtn);

    const doneBtn = document.createElement('button');
    doneBtn.className = 'inspo-draw-action-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dataUrl = canvas.toDataURL('image/png');
      item.mediaPath = await window.api.saveInspoDrawing(dataUrl, item.mediaPath);
      item.editing = false;
      this.save();
      this.render();
    });
    toolbar.appendChild(doneBtn);

    el.appendChild(toolbar);

    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
      lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
    });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    canvas.addEventListener('pointerleave', () => { drawing = false; });
  }
};
