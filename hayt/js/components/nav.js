// Top navigation bar — gear icon + sync indicator
import * as state from '../state.js';
import { toast } from './toast.js';

function formatRelativeTime(ms) {
  if (!ms) return null;
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 30) return 'ahora';
  if (diff < 180) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export function renderNav(container) {
  container.innerHTML = `
    <nav class="top-nav">
      <a class="nav-logo" href="#calendar" aria-label="Inicio">
        <img src="icons/mood-5.png" class="nav-logo-icon" width="28" height="28" alt="" draggable="false">
        <span class="nav-title">hayt</span>
      </a>
      <div class="nav-actions">
        <button class="nav-btn" id="nav-sync" aria-label="Sync" title="Sincronizar">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
          </svg>
          <span class="sync-dot" id="sync-dot"></span>
        </button>
        <span class="sync-time" id="sync-time"></span>
        <button class="nav-btn" id="nav-settings" aria-label="Settings" title="Ajustes">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </nav>`;

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

  // Sync status indicator
  state.on('syncStatus', status => {
    const dot = document.getElementById('sync-dot');
    if (!dot) return;
    dot.className = 'sync-dot';
    if (status === 'syncing') dot.classList.add('sync-active');
    else if (status === 'error') dot.classList.add('sync-error');
    else if (status === 'pending') dot.classList.add('sync-pending');
  });

  // Last synced timestamp
  state.on('lastSyncAt', ts => {
    const el = document.getElementById('sync-time');
    if (!el) return;
    const text = formatRelativeTime(ts);
    el.textContent = text ?? '';
  });
}
