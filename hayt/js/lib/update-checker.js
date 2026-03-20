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
    // 1. Delete all SW caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // 2. Unregister current SW so stale HTTP-cached files don't get re-cached
    const oldReg = await navigator.serviceWorker.getRegistration();
    if (oldReg) await oldReg.unregister();

    // 3. Re-register fresh SW — browser always fetches sw.js from network
    //    The install handler uses cache:'reload' to bypass HTTP cache
    try {
      const newReg = await navigator.serviceWorker.register('sw.js');
      const sw = newReg.installing || newReg.waiting;
      if (sw && sw.state !== 'activated') {
        await new Promise((resolve) => {
          sw.addEventListener('statechange', function handler() {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', handler);
              resolve();
            }
          });
          setTimeout(resolve, 5000); // fallback if activation stalls
        });
      }
    } catch { /* SW not supported or registration failed — reload anyway */ }

    // 4. Reload — new SW with fresh cache serves the request
    location.reload();
  });

  document.body.appendChild(overlay);
}

export { checkForUpdate };
