// Top navigation bar — sync icon with state-based icons, offline banner
import * as state from '../state.js';
import { toast } from './toast.js';

const SYNC_ICONS = {
  idle: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  syncing: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>`,
  error: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

const SYNC_TITLES = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando…',
  pending: 'Cambios pendientes',
  error: 'Error de sincronización',
};

export function renderNav(container) {
  container.innerHTML = `
    <nav class="top-nav">
      <a class="nav-logo" href="#calendar" aria-label="Inicio">
        <img src="icons/mood-5.png" class="nav-logo-icon" width="28" height="28" alt="" draggable="false">
        <span class="nav-title">hayt</span>
      </a>
      <div class="nav-actions">
        <button class="nav-btn nav-sync-idle" id="nav-sync" aria-label="Sincronizado" title="Sincronizado">
          ${SYNC_ICONS.idle}
        </button>
        <button class="nav-btn" id="nav-settings" aria-label="Settings" title="Ajustes">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </nav>
    <div class="offline-banner${navigator.onLine ? ' hidden' : ''}" id="offline-banner">Sin conexión</div>`;

  container.querySelector('#nav-settings').addEventListener('click', () => {
    location.hash = '#settings';
  });

  container.querySelector('#nav-sync').addEventListener('click', () => {
    const currentStatus = state.get('syncStatus');
    if (currentStatus === 'error') {
      const lastError = state.get('syncError');
      if (lastError) toast(lastError, 'error');
    }
    const { syncNow } = window._haytSync ?? {};
    if (syncNow) syncNow(true);
  });

  // Sync status — swap icon and class per state
  state.on('syncStatus', status => {
    const btn = document.getElementById('nav-sync');
    if (!btn) return;
    const s = status || 'idle';
    const icon = SYNC_ICONS[s] || SYNC_ICONS.idle;
    const title = SYNC_TITLES[s] || SYNC_TITLES.idle;
    btn.innerHTML = icon;
    btn.className = 'nav-btn';
    btn.classList.add(`nav-sync-${s}`);
    btn.setAttribute('aria-label', title);
    btn.setAttribute('title', title);
  });

  // Offline banner
  const showOffline = () => {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.classList.remove('hidden');
  };
  const hideOffline = () => {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.classList.add('hidden');
  };
  window.addEventListener('offline', showOffline);
  window.addEventListener('online', hideOffline);
}
