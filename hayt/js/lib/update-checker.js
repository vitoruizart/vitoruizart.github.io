// Version check — polls version.json and shows update overlay when new version detected
import { APP_VERSION } from './constants.js';

export async function checkForUpdate() {
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

export function startUpdatePolling(intervalMs = 60_000) {
  checkForUpdate();
  setInterval(checkForUpdate, intervalMs);
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

    location.reload();
  });

  document.body.appendChild(overlay);
}
