// Month calendar grid renderer
import { getDaysInMonth, getFirstDayOfWeek, toDateStr } from '../lib/date-utils.js';
import { moodFaceSvgSmall } from './mood-faces.js';

// Greyish blue (worst) → pinkish red (best)
const MOOD_BG = {
  1: 'rgba(100,130,170,0.50)',
  2: 'rgba(140,115,175,0.50)',
  3: 'rgba(175,95,155,0.50)',
  4: 'rgba(205,75,115,0.50)',
  5: 'rgba(230,55,85,0.50)',
};

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// moodsByDate: Map<dateStr, moodEntry[]>
export function renderCalendarGrid(year, month, moodsByDate, onDayClick) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayStr = toDateStr();

  let html = '<div class="cal-grid">';

  // Header row
  html += DAY_NAMES.map(d => `<div class="cal-header">${d}</div>`).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell cal-empty"></div>';
  }

  // Day cells
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entries = moodsByDate.get(dateStr) ?? [];
    const isToday = dateStr === todayStr;

    // Average mood for the day
    let moodValue = null;
    if (entries.length > 0) {
      const sum = entries.reduce((acc, e) => acc + e.mood, 0);
      moodValue = Math.round(sum / entries.length);
    }
    const face = moodValue !== null ? moodFaceSvgSmall(moodValue, 24) : '';
    const countBadge = entries.length > 1 ? `<span class="cal-count">${entries.length}</span>` : '';
    const bgStyle = moodValue !== null ? `--mood-bg:${MOOD_BG[moodValue]}` : '';

    html += `<button class="cal-cell${isToday ? ' cal-today' : ''}${moodValue !== null ? ' cal-has-mood' : ''}"
      data-date="${dateStr}" style="${bgStyle}">
      <span class="cal-day-num">${d}</span>
      ${face ? `<span class="cal-face">${face}</span>` : ''}
      ${countBadge}
    </button>`;
  }

  html += '</div>';

  const el = document.createElement('div');
  el.innerHTML = html;

  el.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => onDayClick(cell.dataset.date));
  });

  return el;
}
