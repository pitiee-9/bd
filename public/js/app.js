document.documentElement.classList.add('js');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupCountdown() {
  const countdown = document.querySelector('[data-countdown-target]');
  if (!countdown) return;
  const target = new Date(countdown.dataset.countdownTarget).getTime();
  const units = ['days', 'hours', 'minutes', 'seconds'];
  let timer;
  const update = () => {
    const remaining = Math.max(0, target - Date.now());
    const values = [
      Math.floor(remaining / 86400000),
      Math.floor((remaining / 3600000) % 24),
      Math.floor((remaining / 60000) % 60),
      Math.floor((remaining / 1000) % 60)
    ];
    units.forEach((unit, index) => {
      countdown.querySelector(`[data-unit="${unit}"]`).textContent = String(values[index]).padStart(2, '0');
    });
    if (remaining === 0) window.clearInterval(timer);
  };
  update();
  timer = window.setInterval(update, 1000);
}

function createPetals() {
  const field = document.querySelector('.petal-field');
  if (!field || reducedMotion) return;
  const count = window.innerWidth < 700 ? 12 : 20;
  for (let index = 0; index < count; index += 1) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.innerHTML = '<svg viewBox="0 0 30 42" focusable="false"><path d="M15 1C5 7 2 16 9 24c3 3 6 3 6 3s-1-7 4-13c4-5 3-9-4-13Z"/><path d="M15 27c-6-2-10 2-9 7 1 5 6 7 10 7 4-3 5-8 3-11-1-2-2-3-4-3Z"/></svg>';
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.setProperty('--drift', `${-70 + Math.random() * 140}px`);
    petal.style.setProperty('--spin', `${180 + Math.random() * 360}deg`);
    petal.style.animationDuration = `${10 + Math.random() * 10}s`;
    petal.style.animationDelay = `${-Math.random() * 20}s`;
    field.appendChild(petal);
  }
}

function revealGallery() {
  document.querySelectorAll('.gallery-tile').forEach((tile, index) => {
    window.setTimeout(() => tile.classList.add('in'), index * 90);
  });
}

createPetals();
revealGallery();
setupCountdown();
