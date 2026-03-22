// Version check — polls version.json, foreground-aware with debounce
// Shows blocking overlay when new version detected
// APP_VERSION uses YYYYMMDD.HHMM UTC timestamps (stamped by post-commit hook)
import { APP_VERSION } from './constants.js';

const POLL_INTERVAL_MS = 30 * 60 * 1000;     // 30 minutes periodic
const MIN_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes debounce on focus/visibility
const BG_CHECK_THRESHOLD_MS = 30 * 60 * 1000; // force check after 30 min in background
let lastCheckTime = 0;
let hiddenAt = 0;

async function checkForUpdate() {
  try {
    const res = await fetch('/hayt/version.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const { version } = await res.json();
    if (version && version !== APP_VERSION) {
      // If we just applied this update, the browser HTTP cache may still
      // serve the old constants.js. Don't show the overlay again.
      const applied = localStorage.getItem('hayt-applied-version');
      if (applied === version) return false;
      showUpdateOverlay(version);
      return true;
    } else {
      // APP_VERSION caught up — clear the transition marker
      localStorage.removeItem('hayt-applied-version');
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
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (document.visibilityState === 'visible') {
      if (hiddenAt > 0 && Date.now() - hiddenAt >= BG_CHECK_THRESHOLD_MS) {
        hiddenAt = 0;
        lastCheckTime = Date.now();
        checkForUpdate();
      } else {
        hiddenAt = 0;
        debouncedCheck();
      }
    }
  });
  window.addEventListener('focus', debouncedCheck);
}

function showUpdateOverlay(targetVersion) {
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
    // Mark which version we're updating to — prevents infinite loop if
    // the browser HTTP cache still serves stale constants.js after reload
    localStorage.setItem('hayt-applied-version', targetVersion);

    // 1. Delete all SW caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // 2. Unregister current SW
    const oldReg = await navigator.serviceWorker.getRegistration();
    if (oldReg) await oldReg.unregister();

    // 3. Reload — register-sw.js will re-register the SW on next load,
    //    which installs fresh assets with cache:'reload'
    location.reload();
  });

  document.body.appendChild(overlay);
}

export { checkForUpdate };
