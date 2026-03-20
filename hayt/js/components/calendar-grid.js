// Month calendar grid renderer
import { getDaysInMonth, getFirstDayOfWeek, toDateStr } from '../lib/date-utils.js';
import { getMood } from '../lib/constants.js';
import { moodFaceSvgSmall } from './mood-faces.js';

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

    // Dominant mood = most recent entry for that day
    const dominant = entries.length > 0
      ? entries.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
      : null;

    const moodInfo = dominant ? getMood(dominant.mood) : null;
    const dotColor = moodInfo ? moodInfo.color : 'transparent';
    const face = dominant ? moodFaceSvgSmall(dominant.mood, 24) : '';
    const countBadge = entries.length > 1 ? `<span class="cal-count">${entries.length}</span>` : '';

    html += `<button class="cal-cell${isToday ? ' cal-today' : ''}${dominant ? ' cal-has-mood' : ''}"
      data-date="${dateStr}" style="--mood-color:${dotColor}">
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
