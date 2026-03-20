// Version check — polls version.json, foreground-aware with debounce
// Shows blocking overlay when new version detected
// APP_VERSION uses YYYYMMDD.HHMM UTC timestamps (stamped by post-commit hook)
import { APP_VERSION } from './constants.js';

const POLL_INTERVAL_MS = 30 * 60 * 1000;     // 30 minutes periodic
const MIN_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes debounce on focus/visibility
let lastCheckTime = 0;

async function checkForUpdate() {
  try {
    const res = await fetch('/hayt/version.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const { version } = await res.json();
    if (version && version !== APP_VERSION) {
      showUpdateOverlay();
      return true;
    }
  } catch { /* network error — ignore */ }
  return false;
}

function debouncedCheck() {
  const now = Date.now();
  if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) return;
  lastCheckTime = now;
  checkForUpdate();
}

export function startUpdatePolling() {
  // Initial check
  lastCheckTime = Date.now();
  checkForUpdate();

  // Periodic fallback
  setInterval(() => {
    lastCheckTime = Date.now();
    checkForUpdate();
  }, POLL_INTERVAL_MS);

  // Foreground detection — check when user returns to the app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') debouncedCheck();
  });
  window.addEventListener('focus', debouncedCheck);
}

function showUpdateOverlay() {
  if (document.querySelector('.update-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'update-overlay';
  overlay.innerHTML = `
    <div class="update-card">
      <h2 class="update-title">Nueva versión disponible</h2>
      <p class="update-desc">Hay una actualización lista. Pulsa para recargar con la última versión.</p>
      <button class="update-btn">Actualizar ahora</button>
    </div>`;

  overlay.querySelector('.update-btn').addEventListener('click', async () => {
    // Delete all caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // Tell SW to update
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();

    // Fallback: in standalone PWA on some platforms, controllerchange may not
    // fire, so force reload after a short delay to ensure skipWaiting completes.
    setTimeout(() => location.reload(), 2000);
  });

  document.body.appendChild(overlay);
}

export { checkForUpdate };
