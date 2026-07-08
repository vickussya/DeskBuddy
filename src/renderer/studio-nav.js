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

    // Panels stay mounted rather than being destroyed, so whichever one just
    // became visible needs a fresh read of data that may have changed while
    // it was hidden (e.g. a task checked off from Home while Tasks was open).
    if (section === 'home') { Studio.home.refresh(); Studio.calendar.refresh(); }
    if (section === 'goals') Studio.goals.refreshActiveWorkspace();
    if (section === 'diary') Studio.diary.loadEntry(Studio.diary.currentDateId);
    if (section === 'plan') Studio.plan.loadDate(Studio.plan.currentDateId);
  }
};
