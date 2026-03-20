// Toast notification component

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function toast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  ensureContainer().appendChild(el);

  // Trigger enter animation
  requestAnimationFrame(() => el.classList.add('toast-visible'));

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.addEventListener('transitionend', () => el.remove());
    // Fallback removal
    setTimeout(() => el.remove(), 500);
  }, duration);
}
