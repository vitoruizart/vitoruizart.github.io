// Mood insights — bite-sized positive stats below the trend chart
import { daysAgo, toDateStr } from '../lib/date-utils.js';
import { getMood } from '../lib/constants.js';

// --- SVG icons (inline, use currentColor) ---

const ICONS = {
  flame: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c.5 3.5-1.5 6-1.5 6 1 1.5 2 3.5 2 6 0 3.5-2.5 6-5.5 6C4 20 2 17.5 2 14.5c0-2 .5-3.5 1.5-5C4.5 8 6 6.5 7 5c1-1.5 2.5-2.5 5-3z"/><path d="M12 16c0 2-1 3-2.5 3S7 18 7 16c0-1.5 1-3 2.5-4 1.5 1 2.5 2.5 2.5 4z"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  medal: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>',
  smiley: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
};

// --- Weekday names (Spanish, Mon=1..Sun=0 mapped from JS getDay) ---

const WEEKDAY_NAMES = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

// --- Shared data builder ---

function buildDailyAvgs(allMoods) {
  const buckets = new Map();
  for (const m of allMoods) {
    if (!buckets.has(m.date)) buckets.set(m.date, []);
    buckets.get(m.date).push(m.mood);
  }
  const dailyAvgs = new Map();
  for (const [date, vals] of buckets) {
    dailyAvgs.set(date, vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return dailyAvgs;
}

// --- Individual insight computers ---

function computeStreak(dailyAvgs) {
  const today = toDateStr();
  // Start from today; if today has no entry, start from yesterday
  let start = dailyAvgs.has(today) ? 0 : 1;
  let streak = 0;
  for (let i = start; ; i++) {
    if (dailyAvgs.has(daysAgo(i))) streak++;
    else break;
  }
  if (streak < 2) return null;
  return {
    type: 'streak',
    icon: ICONS.flame,
    text: `Llevas ${streak} días seguidos registrando`,
  };
}

function computeBestDay(dailyAvgs) {
  // Group all daily averages by weekday
  const byDay = Array.from({ length: 7 }, () => ({ sum: 0, count: 0, weeks: new Set() }));
  for (const [dateStr, avg] of dailyAvgs) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay(); // 0=Sun..6=Sat
    byDay[dow].sum += avg;
    byDay[dow].count++;
    // Track distinct weeks (ISO week-ish: year + week number)
    const jan1 = new Date(y, 0, 1);
    const weekNum = Math.ceil(((date - jan1) / 86400000 + jan1.getDay()) / 7);
    byDay[dow].weeks.add(`${y}-${weekNum}`);
  }

  // Total distinct weeks with any data
  const allWeeks = new Set();
  for (const d of byDay) {
    for (const w of d.weeks) allWeeks.add(w);
  }
  if (allWeeks.size < 3) return null;

  // Find weekday with highest avg, requiring ≥3 entries
  let bestDow = -1;
  let bestAvg = -1;
  for (let i = 0; i < 7; i++) {
    if (byDay[i].count < 3) continue;
    const avg = byDay[i].sum / byDay[i].count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDow = i;
    }
  }
  if (bestDow === -1) return null;

  return {
    type: 'bestDay',
    icon: ICONS.star,
    text: `Los ${WEEKDAY_NAMES[bestDow]} suelen ser tus mejores días`,
  };
}

function computeAverage(last30Avgs, daysWithDataIn30) {
  if (daysWithDataIn30 < 5) return null;
  const avg = last30Avgs.reduce((a, b) => a + b, 0) / last30Avgs.length;
  const rounded = Math.round(avg);
  const color = getMood(rounded).color;
  const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>`;
  return {
    type: 'average',
    icon: ICONS.gauge,
    text: `${dot}Tu ánimo promedio estos 30 días: ${avg.toFixed(1)}`,
  };
}

function computeImproving(dailyAvgs) {
  // Current week: days 0-6, previous week: days 7-13
  const currVals = [];
  const prevVals = [];
  for (let i = 0; i < 7; i++) {
    const v = dailyAvgs.get(daysAgo(i));
    if (v !== undefined) currVals.push(v);
  }
  for (let i = 7; i < 14; i++) {
    const v = dailyAvgs.get(daysAgo(i));
    if (v !== undefined) prevVals.push(v);
  }
  if (currVals.length === 0 || prevVals.length === 0) return null;
  const currAvg = currVals.reduce((a, b) => a + b, 0) / currVals.length;
  const prevAvg = prevVals.reduce((a, b) => a + b, 0) / prevVals.length;
  if (currAvg - prevAvg <= 0.3) return null;
  return {
    type: 'improving',
    icon: ICONS.arrow,
    text: 'Tu ánimo ha mejorado esta semana',
  };
}

function computeMilestone(totalEntries) {
  const tiers = [
    { min: 500, text: (n) => `${n} registros. Eres toda una experta.` },
    { min: 250, text: (n) => `${n} registros. Tu constancia es impresionante.` },
    { min: 100, text: (n) => `${n} registros y contando. Increíble compromiso.` },
    { min: 50,  text: (n) => `${n} registros. Vas construyendo un gran hábito.` },
    { min: 25,  text: (n) => `${n} registros. Cada uno cuenta.` },
    { min: 10,  text: (n) => `${n} registros. Buen comienzo.` },
  ];
  for (const tier of tiers) {
    if (totalEntries >= tier.min) {
      return {
        type: 'milestone',
        icon: ICONS.medal,
        text: tier.text(totalEntries),
      };
    }
  }
  return null;
}

function computeHappyDays(last30Avgs, daysWithDataIn30) {
  if (daysWithDataIn30 < 10) return null;
  const goodDays = last30Avgs.filter(v => v >= 4).length;
  const ratio = goodDays / daysWithDataIn30;
  if (ratio < 0.4) return null;
  return {
    type: 'happyDays',
    icon: ICONS.smiley,
    text: `${goodDays} de tus últimos ${daysWithDataIn30} días fueron buenos`,
  };
}

// --- Main compute function ---

export function computeInsights(allMoods) {
  if (allMoods.length === 0) return [];

  const dailyAvgs = buildDailyAvgs(allMoods);

  // Build last-30-days data
  const last30Avgs = [];
  let daysWithDataIn30 = 0;
  for (let i = 0; i < 30; i++) {
    const avg = dailyAvgs.get(daysAgo(i));
    if (avg !== undefined) {
      last30Avgs.push(avg);
      daysWithDataIn30++;
    }
  }

  const insights = [];

  const streak = computeStreak(dailyAvgs);
  if (streak) insights.push(streak);

  const bestDay = computeBestDay(dailyAvgs);
  if (bestDay) insights.push(bestDay);

  const avg = computeAverage(last30Avgs, daysWithDataIn30);
  if (avg) insights.push(avg);

  const improving = computeImproving(dailyAvgs);
  if (improving) insights.push(improving);

  const milestone = computeMilestone(allMoods.length);
  if (milestone) insights.push(milestone);

  const happy = computeHappyDays(last30Avgs, daysWithDataIn30);
  if (happy) insights.push(happy);

  return insights;
}

// --- Render function ---

export function renderMoodInsights(allMoods) {
  const insights = computeInsights(allMoods);
  if (insights.length === 0) return '';

  const cards = insights.map(ins =>
    `<div class="insight-card">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-text">${ins.text}</div>
    </div>`
  ).join('');

  return `<div class="insights-section">${cards}</div>`;
}
