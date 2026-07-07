async function init() {
  document.documentElement.dataset.theme = 'cozy';

  const data = await window.api.getStudioInitData();
  document.documentElement.dataset.theme = data.settings.theme || 'cozy';

  Studio.nav.init();
  Studio.tasks.init(data);
  Studio.diary.init();
  Studio.goals.init();
  Studio.inspo.init();
  Studio.settings.init(data);
}

init();
