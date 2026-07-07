window.Studio = window.Studio || {};

Studio.stickers = {
  catalog: [],
  activePopup: null,

  async init() {
    this.catalog = await window.api.getStickerCatalog();
  },

  getStickerSrc(stickerId) {
    const entry = this.catalog.find(s => s.id === stickerId);
    return entry ? `file://${entry.path.replace(/\\/g, '/')}` : null;
  },

  // Shows a small floating grid of sticker thumbnails anchored near anchorEl.
  // onSelect(stickerId) fires with the chosen id, or null if "None" is picked.
  // Clicking outside just closes it without calling onSelect.
  openPicker(anchorEl, onSelect) {
    this.closePicker();

    const popup = document.createElement('div');
    popup.className = 'sticker-picker-popup';

    const noneBtn = document.createElement('button');
    noneBtn.className = 'sticker-picker-none';
    noneBtn.textContent = 'None';
    noneBtn.addEventListener('click', () => {
      onSelect(null);
      this.closePicker();
    });
    popup.appendChild(noneBtn);

    const grid = document.createElement('div');
    grid.className = 'sticker-picker-grid';
    this.catalog.forEach(sticker => {
      const thumb = document.createElement('img');
      thumb.className = 'sticker-picker-thumb';
      thumb.src = `file://${sticker.path.replace(/\\/g, '/')}`;
      thumb.title = sticker.id;
      thumb.addEventListener('click', () => {
        onSelect(sticker.id);
        this.closePicker();
      });
      grid.appendChild(thumb);
    });
    popup.appendChild(grid);

    document.body.appendChild(popup);

    const rect = anchorEl.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    let left = rect.left;
    if (left + popupRect.width > window.innerWidth) left = window.innerWidth - popupRect.width - 8;
    popup.style.left = Math.max(8, left) + 'px';
    popup.style.top = (rect.bottom + 6) + 'px';

    this.activePopup = popup;

    const onOutsideClick = (e) => {
      if (!popup.contains(e.target) && e.target !== anchorEl) {
        this.closePicker();
      }
    };
    setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
    popup._onOutsideClick = onOutsideClick;
  },

  closePicker() {
    if (this.activePopup) {
      if (this.activePopup._onOutsideClick) {
        document.removeEventListener('click', this.activePopup._onOutsideClick);
      }
      this.activePopup.remove();
      this.activePopup = null;
    }
  }
};
