// Semi-circular gauge chart showing mood count distribution (last 60 days)
import { MOODS } from '../lib/constants.js';
import { daysAgo } from '../lib/date-utils.js';

export function renderMoodGauge(allMoods) {
  const CX = 140, CY = 140, R = 110, SW = 28;
  const cutoff = daysAgo(59);
  const recentMoods = allMoods.filter(m => m.date >= cutoff);
  const total = recentMoods.length;

  // Count per mood value
  const counts = new Map();
  for (const mood of MOODS) counts.set(mood.value, 0);
  for (const m of recentMoods) {
    counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
  }

  // Dome-shaped semicircle: left → top → right (two 90° arcs to avoid degenerate path)
  const arcPath = `M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX},${CY - R} A ${R},${R} 0 0,1 ${CX + R},${CY}`;
  const halfCirc = Math.PI * R;

  let arcs = '';
  if (total === 0) {
    arcs = `<path d="${arcPath}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${SW}" stroke-linecap="butt"/>`;
  } else {
    // Each segment reuses the same dome path, showing only its portion via stroke-dasharray
    let offset = 0;
    for (const mood of MOODS) {
      const count = counts.get(mood.value);
      if (count === 0) continue;
      const segLen = (count / total) * halfCirc;
      // dasharray: 0-length dash, skip offset, draw segLen, hide rest
      arcs += `<path d="${arcPath}" fill="none" stroke="${mood.color}" stroke-width="${SW}" stroke-linecap="butt" stroke-dasharray="0 ${offset.toFixed(2)} ${segLen.toFixed(2)} ${(2 * halfCirc).toFixed(2)}"/>`;
      offset += segLen;
    }
  }

  const centerText = `<text x="${CX}" y="${CY - 25}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="36" font-weight="700">${total}</text>`;

  // Legend row
  const legendItems = MOODS.map(mood => {
    const count = counts.get(mood.value) ?? 0;
    return `<div class="mood-gauge-item">
      <div class="mood-gauge-icon">
        <img src="icons/mood-${mood.value}.png" width="36" height="36" alt="${mood.label}">
        <span class="mood-gauge-badge" style="background:${mood.color}">${count}</span>
      </div>
      <span class="mood-gauge-label">${mood.label}</span>
    </div>`;
  }).join('');

  return `<div class="mood-gauge">
    <h3 class="mood-gauge-title">Últimos 60 días</h3>
    <svg viewBox="0 0 280 180" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Distribución de estados de ánimo">
      ${arcs}${centerText}
    </svg>
    <div class="mood-gauge-legend">${legendItems}</div>
  </div>`;
}
