const characterImg = document.getElementById('icon-character-img');

function getFallbackSVG(character) {
  const colors = { cat: '#f4a261', dog: '#e07b39', person: '#84b0c7', robot: '#8ecae6', custom: '#a8dadc' };
  const labels = { cat: '🐱', dog: '🐶', person: '😊', robot: '🤖', custom: '⭐' };
  const color = colors[character] || '#c9a96e';
  const label = labels[character] || '?';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='160' viewBox='0 0 100 160'>
    <rect width='100' height='160' rx='18' fill='${color}' opacity='0.3'/>
    <text x='50' y='90' font-size='56' text-anchor='middle' dominant-baseline='middle'>${label}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

async function loadCharacterImage(character) {
  const imgPath = await window.api.getCharacterImagePath(character);
  const src = imgPath
    ? `file://${imgPath.replace(/\\/g, '/')}`
    : getFallbackSVG(character);
  characterImg.src = src;
  characterImg.onerror = () => {
    characterImg.src = getFallbackSVG(character);
  };
}

async function init() {
  const data = await window.api.getIconInitData();
  document.documentElement.dataset.theme = data.theme || 'vivid';
  await loadCharacterImage(data.character || 'cat');

  characterImg.addEventListener('click', () => window.api.openStudio());

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.api.showIconContextMenu();
  });

  window.api.onCharacterChanged((char) => loadCharacterImage(char));
}

init();
