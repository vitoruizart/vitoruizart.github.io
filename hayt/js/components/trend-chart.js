// 30-day SVG trend line chart
import { daysAgo, toDateStr } from '../lib/date-utils.js';
import { getMood } from '../lib/constants.js';

export function renderTrendChart(allMoods) {
  const W = 320, H = 100, PAD_X = 30, PAD_Y = 15;
  const days = 30;

  // Build daily averages for last 30 days
  const dailyAvg = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = daysAgo(i);
    dailyAvg.set(dateStr, []);
  }
  for (const m of allMoods) {
    if (dailyAvg.has(m.date)) {
      dailyAvg.get(m.date).push(m.mood);
    }
  }

  const points = [];
  const dates = [...dailyAvg.keys()];
  for (let i = 0; i < dates.length; i++) {
    const vals = dailyAvg.get(dates[i]);
    if (vals.length === 0) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const x = PAD_X + (i / (days - 1)) * (W - 2 * PAD_X);
    const y = PAD_Y + ((5 - avg) / 4) * (H - 2 * PAD_Y);
    points.push({ x, y, avg, date: dates[i] });
  }

  // Y-axis labels
  const yLabels = [5, 3, 1].map(v => {
    const y = PAD_Y + ((5 - v) / 4) * (H - 2 * PAD_Y);
    const mood = getMood(v);
    return `<text x="${PAD_X - 5}" y="${y + 4}" text-anchor="end" fill="${mood.color}" font-size="9">${v}</text>
      <line x1="${PAD_X}" y1="${y}" x2="${W - PAD_X}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`;
  }).join('');

  // Line path
  let path = '';
  if (points.length > 1) {
    path = `<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}"
      fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Dots
  const dots = points.map(p => {
    const mood = getMood(Math.round(p.avg));
    return `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${mood.color}"/>`;
  }).join('');

  const todayStr = toDateStr();
  const thirtyAgo = daysAgo(29);
  const xLabels = `
    <text x="${PAD_X}" y="${H - 2}" fill="rgba(255,255,255,0.4)" font-size="8">${thirtyAgo.slice(5)}</text>
    <text x="${W - PAD_X}" y="${H - 2}" text-anchor="end" fill="rgba(255,255,255,0.4)" font-size="8">${todayStr.slice(5)}</text>`;

  return `<div class="trend-chart">
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">
      ${yLabels}${path}${dots}${xLabels}
    </svg>
  </div>`;
}
