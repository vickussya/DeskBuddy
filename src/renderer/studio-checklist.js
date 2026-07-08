window.Studio = window.Studio || {};

// Shared bullet-journal-style checklist renderer: reused by the Goals
// notebook page (with period/sticker/folders extra controls) and the Plan
// page (plain checkbox + text + description). A trailing blank "draft" row
// always waits at the end — typing into it and committing (Enter/blur)
// creates a real item and a fresh draft row takes its place.
Studio.checklist = {
  expandedIds: new Set(),

  renderRows(container, items, opts) {
    container.innerHTML = '';
    items.forEach(item => container.appendChild(this.renderRow(item, opts)));
    container.appendChild(this.renderDraftRow(opts));
  },

  renderRow(item, opts) {
    const isExpanded = this.expandedIds.has(item.id);

    const row = document.createElement('div');
    row.className = 'checklist-row';

    const main = document.createElement('div');
    main.className = 'checklist-row-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = !!item.checked;
    checkbox.setAttribute('aria-label', item.text ? `Mark "${item.text}" as done` : 'Mark item as done');
    checkbox.addEventListener('change', () => opts.onToggle(item));

    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'checklist-text-input' + (item.checked ? ' crossed' : '');
    text.value = item.text;
    text.maxLength = 140;
    text.addEventListener('blur', () => {
      const trimmed = text.value.trim();
      if (trimmed && trimmed !== item.text) {
        opts.onTextChange(item, trimmed);
      } else {
        text.value = item.text;
      }
    });
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') text.blur(); });

    main.appendChild(checkbox);
    main.appendChild(text);

    if (opts.mainExtras) {
      const extras = opts.mainExtras(item);
      if (extras) main.appendChild(extras);
    }

    if (opts.onReorder) {
      const btnUp = document.createElement('button');
      btnUp.className = 'task-btn';
      btnUp.textContent = '↑';
      btnUp.title = 'Move up';
      btnUp.setAttribute('aria-label', `Move "${item.text}" up`);
      btnUp.addEventListener('click', () => opts.onReorder(item, -1));

      const btnDown = document.createElement('button');
      btnDown.className = 'task-btn';
      btnDown.textContent = '↓';
      btnDown.title = 'Move down';
      btnDown.setAttribute('aria-label', `Move "${item.text}" down`);
      btnDown.addEventListener('click', () => opts.onReorder(item, 1));

      main.appendChild(btnUp);
      main.appendChild(btnDown);
    }

    const expandBtn = document.createElement('button');
    expandBtn.className = 'checklist-expand-toggle';
    expandBtn.textContent = isExpanded ? '▾' : '▸';
    expandBtn.title = 'Notes';
    expandBtn.setAttribute('aria-label', isExpanded ? 'Collapse notes' : 'Expand notes');
    expandBtn.setAttribute('aria-expanded', String(isExpanded));
    expandBtn.addEventListener('click', () => {
      if (isExpanded) this.expandedIds.delete(item.id); else this.expandedIds.add(item.id);
      opts.rerender();
    });
    main.appendChild(expandBtn);

    if (opts.onDelete) {
      const btnDel = document.createElement('button');
      btnDel.className = 'task-btn';
      btnDel.textContent = '✕';
      btnDel.title = 'Delete';
      btnDel.setAttribute('aria-label', `Delete "${item.text}"`);
      btnDel.addEventListener('click', () => opts.onDelete(item));
      main.appendChild(btnDel);
    }

    row.appendChild(main);

    if (isExpanded) {
      const expanded = document.createElement('div');
      expanded.className = 'checklist-row-expanded';

      const desc = document.createElement('textarea');
      desc.className = 'checklist-description-input';
      desc.placeholder = 'Add a note...';
      desc.value = item.description || '';
      desc.addEventListener('blur', () => {
        if (desc.value !== item.description) opts.onDescriptionChange(item, desc.value);
      });
      expanded.appendChild(desc);

      if (opts.extraControls) {
        const extra = opts.extraControls(item);
        if (extra) expanded.appendChild(extra);
      }

      row.appendChild(expanded);
    }

    return row;
  },

  renderDraftRow(opts) {
    const row = document.createElement('div');
    row.className = 'checklist-row checklist-draft-row';

    const main = document.createElement('div');
    main.className = 'checklist-row-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.disabled = true;
    checkbox.setAttribute('aria-hidden', 'true');
    checkbox.tabIndex = -1;

    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'checklist-text-input';
    text.placeholder = 'Add an item...';
    text.maxLength = 140;

    const commit = () => {
      const trimmed = text.value.trim();
      if (!trimmed) return;
      text.value = '';
      opts.onCommitNew(trimmed);
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    text.addEventListener('blur', commit);

    main.appendChild(checkbox);
    main.appendChild(text);
    row.appendChild(main);
    return row;
  }
};
