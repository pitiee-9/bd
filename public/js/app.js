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

function setupAmbientWishes() {
  const section = document.getElementById('wishes');
  const ambient = section?.querySelector('.wish-ambient');
  const sources = [...(section?.querySelectorAll('.wish-note[data-wish-message]') || [])];
  if (!section || !ambient || !sources.length || reducedMotion) return;
  let inView = false;
  let nextTimer = null;
  let serial = sources.length;
  const active = [];
  const maxNotes = window.innerWidth < 700 ? 6 : 10;
  const random = (min, max) => min + Math.random() * (max - min);

  const schedule = () => {
    if (nextTimer) window.clearTimeout(nextTimer);
    nextTimer = window.setTimeout(() => { if (inView) spawn(); else schedule(); }, random(900, 2400));
  };
  const spawn = () => {
    if (!inView) return schedule();
    if (active.length >= maxNotes) {
      const oldest = active.shift();
      oldest.classList.add('note-expiring');
      window.setTimeout(() => { oldest.remove(); spawn(); }, oldest.dataset.fadeOut);
      return;
    }
    const source = sources[serial % sources.length];
    serial += 1;
    const note = source.cloneNode(true);
    note.classList.add('ambient-note', `note-size-${1 + Math.floor(Math.random() * 3)}`);
    note.querySelector('.note-tag').textContent = `>> wish_${String(serial).padStart(2, '0')}.txt`;
    note.style.left = `${random(4, 76)}%`;
    note.style.setProperty('--note-rotate', `${random(-6, 6)}deg`);
    const fadeIn = random(600, 800); const hold = random(2500, 4000); const fadeOut = random(500, 700);
    note.dataset.fadeOut = String(fadeOut);
    note.style.setProperty('--fade-in', `${fadeIn}ms`);
    note.style.setProperty('--hold', `${hold}ms`);
    note.style.setProperty('--fade-out', `${fadeOut}ms`);
    note.style.setProperty('--note-end', `${fadeIn + hold}ms`);
    ambient.appendChild(note);
    active.push(note);
    window.setTimeout(() => {
      const position = active.indexOf(note);
      if (position !== -1) active.splice(position, 1);
      note.classList.add('note-expiring');
      window.setTimeout(() => note.remove(), fadeOut);
    }, fadeIn + hold);
    schedule();
  };
  const observer = new IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting);
    if (inView) schedule(); else if (nextTimer) window.clearTimeout(nextTimer);
  }, { threshold: .2 });
  observer.observe(section);
}

createPetals();
revealGallery();
setupCountdown();
setupAmbientWishes();
