/**
 * Blocking modal shown when a new app version is detected. The user cannot
 * dismiss it — the only action is "Actualizar ahora", which:
 *   1. Messages any waiting SW to skipWaiting so the new SW takes over.
 *   2. Wipes every Cache Storage entry (both via the SW and directly, for
 *      belt-and-suspenders) so the next load cannot serve stale code.
 *   3. Reloads the page.
 *
 * Why the aggressive cache wipe: installed PWAs rarely reload on their own,
 * and a user on a stale cache-first build would otherwise keep running the
 * old bundle. The wipe forces a round-trip to the network on every resource.
 */
export function showUpdateModal() {
  if (document.querySelector('.update-modal')) return;

  const overlay = document.createElement('div');
  overlay.className = 'update-modal';
  overlay.innerHTML = `
    <div class="update-modal-card">
      <h2>Hay una nueva versión</h2>
      <p>Para usar la última versión hace falta actualizar la app. Es rápido.</p>
      <button class="primary" id="update-now">Actualizar ahora</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btn = overlay.querySelector('#update-now');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Actualizando…';
    await hardRefresh();
  });
}

async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Ask the SW to nuke its caches and, if a new SW is waiting, to
        // take over. Both messages are best-effort.
        try { reg.active && reg.active.postMessage({ type: 'CLEAR_CACHES' }); } catch (_) {}
        try { reg.waiting && reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
        try { await reg.update(); } catch (_) {}
      }
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (_) {
    // Even if cleanup fails, force the reload.
  }
  // Bypass the HTTP cache on the navigation itself.
  location.replace(location.pathname + '?_=' + Date.now());
}
