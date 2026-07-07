window.Studio = window.Studio || {};

Studio.nav = {
  init() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchSection(btn.dataset.section));
    });
  },

  switchSection(section) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === section));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${section}`));
  }
};
