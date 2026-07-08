async function init() {
  document.documentElement.dataset.theme = 'vivid';

  const data = await window.api.getStudioInitData();
  document.documentElement.dataset.theme = data.settings.theme || 'vivid';

  Studio.nav.init();
  await Studio.stickers.init();
  Studio.inspo.init();
  Studio.folders.init();
  Studio.goals.init(data);
  Studio.home.init();
  Studio.diary.init();
  Studio.plan.init();
  Studio.calendar.init();
  Studio.settings.init(data);

  window.api.onNavigateToSection((section) => Studio.nav.switchSection(section));
}

init();
