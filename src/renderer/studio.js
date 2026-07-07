async function init() {
  document.documentElement.dataset.theme = 'vivid';

  const data = await window.api.getStudioInitData();
  document.documentElement.dataset.theme = data.settings.theme || 'vivid';

  Studio.nav.init();
  Studio.tasks.init(data);
  Studio.folders.init();
  Studio.home.init();
  Studio.diary.init();
  Studio.goals.init();
  Studio.inspo.init();
  Studio.calendar.init();
  Studio.settings.init(data);

  window.api.onNavigateToSection((section) => Studio.nav.switchSection(section));
}

init();
