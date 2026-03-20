// Calendar view — month grid + 30-day trend chart
import { formatMonthYear, toDateStr } from '../lib/date-utils.js';
import { renderCalendarGrid } from '../components/calendar-grid.js';
import { renderTrendChart } from '../components/trend-chart.js';
import { renderMoodBanner } from '../components/mood-banner.js';
import { getAllMoods } from '../db.js';
import * as state from '../state.js';

let currentYear, currentMonth;
let cleanupListener = null;

export async function render(container) {
  // Clean up previous listener to avoid leaks
  if (cleanupListener) cleanupListener();

  const today = new Date();
  currentYear = currentYear ?? today.getFullYear();
  currentMonth = currentMonth ?? today.getMonth();

  await renderView(container);

  // Re-render on mood changes
  cleanupListener = state.on('moodsUpdated', () => renderView(container));
}

async function renderView(container) {
  const allMoods = await getAllMoods();

  // Group by date
  const moodsByDate = new Map();
  for (const m of allMoods) {
    if (!moodsByDate.has(m.date)) moodsByDate.set(m.date, []);
    moodsByDate.get(m.date).push(m);
  }

  container.innerHTML = `
    <div class="calendar-view">
      <div class="cal-nav">
        <button class="cal-nav-btn" id="cal-prev" aria-label="Mes anterior">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 class="cal-month-title" id="cal-title">${formatMonthYear(currentYear, currentMonth)}</h2>
        <button class="cal-nav-btn" id="cal-next" aria-label="Mes siguiente">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      ${renderMoodBanner(allMoods)}
      <div id="cal-grid-container"></div>
      <div class="trend-section">
        <h3 class="trend-title">Últimos 30 días</h3>
        ${renderTrendChart(allMoods)}
      </div>
    </div>`;

  // Mount calendar grid
  const gridContainer = container.querySelector('#cal-grid-container');
  const grid = renderCalendarGrid(currentYear, currentMonth, moodsByDate, (dateStr) => {
    location.hash = `#day/${dateStr}`;
  });
  gridContainer.appendChild(grid);

  // FAB for adding mood anytime
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  fab.setAttribute('aria-label', 'Agregar estado de ánimo');
  fab.addEventListener('click', () => { location.hash = '#mood'; });
  container.appendChild(fab);

  // Nav buttons
  container.querySelector('#cal-prev').addEventListener('click', () => navigateMonth(container, -1));
  container.querySelector('#cal-next').addEventListener('click', () => navigateMonth(container, 1));

  // Swipe navigation
  let touchStartX = null;
  const calView = container.querySelector('.calendar-view');
  calView.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  calView.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) > 50) {
      navigateMonth(container, deltaX > 0 ? -1 : 1);
    }
  });
}

function navigateMonth(container, direction) {
  currentMonth += direction;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderView(container);
}
