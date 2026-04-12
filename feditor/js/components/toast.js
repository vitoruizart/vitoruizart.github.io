let timer = null;

export function showToast(msg, ms = 1800) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), ms);
}
