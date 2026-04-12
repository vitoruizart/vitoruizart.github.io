import { STORAGE_PREFIX } from './constants.js';

const KEY = STORAGE_PREFIX + 'installHintDismissed';

/**
 * One-time iOS Safari "Add to Home Screen" hint. Shows only when:
 *  - Running on iOS
 *  - NOT already in standalone mode
 *  - User hasn't dismissed it before
 */
export function maybeShowInstallHint() {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  if (!isIOS) return;
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (standalone) return;
  if (localStorage.getItem(KEY)) return;

  const el = document.createElement('div');
  el.className = 'install-hint';
  el.innerHTML = `
    <div>
      Toca <span style="display:inline-block; vertical-align:middle;">⬆︎</span> y luego
      <strong>“Añadir a pantalla de inicio”</strong> para usar feditor a pantalla completa.
    </div>
    <button id="dismiss" class="ghost" style="margin-top:8px;">Entendido</button>
  `;
  el.style.cssText = `
    position: fixed; bottom: calc(env(safe-area-inset-bottom) + 12px); left: 12px; right: 12px;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 14px; font-size: 13px; line-height: 1.4; z-index: 30;
    color: var(--text); box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  `;
  document.body.appendChild(el);
  el.querySelector('#dismiss').addEventListener('click', () => {
    localStorage.setItem(KEY, '1');
    el.remove();
  });
}
