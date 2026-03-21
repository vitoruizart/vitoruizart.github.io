// Calendar view — month grid + 30-day trend chart
import { formatMonthYear, toDateStr } from '../lib/date-utils.js';
import { renderCalendarGrid } from '../components/calendar-grid.js';
import { renderTrendChart } from '../components/trend-chart.js';
import { renderMoodBanner } from '../components/mood-banner.js';
import { renderMoodInsights } from '../components/mood-insights.js';
import { renderMoodGauge } from '../components/mood-gauge.js';
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

  // Re-render on mood changes — only if calendar is still displayed
  cleanupListener = state.on('moodsUpdated', () => {
    if (container.querySelector('.calendar-view')) {
      renderView(container);
    }
  });
}

async function renderView(container) {
  const allMoods = await getAllMoods();
  const today = new Date();
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();

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
        <button class="cal-month-title${isCurrentMonth ? '' : ' can-go-today'}" id="cal-title"
          aria-label="${isCurrentMonth ? formatMonthYear(currentYear, currentMonth) : 'Ir al mes actual'}"
          ${isCurrentMonth ? 'disabled' : ''}>${formatMonthYear(currentYear, currentMonth)}</button>
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
      ${renderMoodGauge(allMoods)}
      ${renderMoodInsights(allMoods)}
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

  // Today shortcut — tap month title to jump to current month
  container.querySelector('#cal-title').addEventListener('click', () => {
    const now = new Date();
    if (currentYear === now.getFullYear() && currentMonth === now.getMonth()) return;
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    renderView(container);
  });

}

function navigateMonth(container, direction) {
  currentMonth += direction;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderView(container);
}
