// Entry point — hash router, screen orchestration
import { renderNav } from './components/nav.js';
import { shouldShowPrompt, render as renderMoodPrompt } from './screens/mood-prompt.js';
import { render as renderCalendar } from './screens/calendar.js';
import { render as renderDayDetail } from './screens/day-detail.js';
import { render as renderSettings } from './screens/settings.js';
import { startSync } from './sync.js';
import { startUpdatePolling } from './lib/update-checker.js';
import * as state from './state.js';

const APP_VERSION = 'f02f34f';

const navEl = document.getElementById('nav');
const mainEl = document.getElementById('main');
const versionEl = document.getElementById('app-version');
if (versionEl) versionEl.textContent = `v${APP_VERSION}`;

// Initialize state
state.set('syncStatus', 'idle');

function hasCredentials() {
  return !!(localStorage.getItem('hayt-pat') &&
    localStorage.getItem('hayt-repo') &&
    localStorage.getItem('hayt-password'));
}

async function route() {
  const hash = location.hash || '';

  // First-time: force settings if no credentials
  if (!hasCredentials() && hash !== '#settings') {
    location.hash = '#settings';
    return;
  }

  mainEl.innerHTML = '';

  if (hash === '#settings') {
    renderSettings(mainEl);
  } else if (hash === '#mood') {
    renderMoodPrompt(mainEl);
  } else if (hash.startsWith('#day/')) {
    const dateStr = hash.slice(5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      location.hash = '#calendar';
      return;
    }
    renderDayDetail(mainEl, dateStr);
  } else if (hash === '#calendar') {
    renderCalendar(mainEl);
  } else {
    // Default: check if should prompt or go to calendar
    const showPrompt = await shouldShowPrompt();
    if (showPrompt) {
      renderMoodPrompt(mainEl);
    } else {
      renderCalendar(mainEl);
    }
  }
}

// Render nav once
renderNav(navEl);

// Hash-based routing
window.addEventListener('hashchange', route);
route();

// Start sync if credentials exist
if (hasCredentials()) {
  startSync();
}

// Poll for app updates
startUpdatePolling();
