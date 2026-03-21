// Semi-circular gauge chart showing mood count distribution
import { MOODS } from '../lib/constants.js';

export function renderMoodGauge(allMoods) {
  const CX = 140, CY = 140, R = 110, SW = 28;
  const total = allMoods.length;

  // Count per mood value
  const counts = new Map();
  for (const mood of MOODS) counts.set(mood.value, 0);
  for (const m of allMoods) {
    counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
  }

  let arcs = '';
  if (total === 0) {
    // Empty state: full gray arc
    arcs = `<path d="M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX},${CY - R} A ${R},${R} 0 0,1 ${CX + R},${CY}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${SW}" stroke-linecap="butt"/>`;
  } else {
    let angle = Math.PI; // start from left
    for (const mood of MOODS) {
      const count = counts.get(mood.value);
      if (count === 0) continue;
      const span = (count / total) * Math.PI;
      const endAngle = angle - span;
      const x1 = CX + R * Math.cos(angle);
      const y1 = CY - R * Math.sin(angle);
      const x2 = CX + R * Math.cos(endAngle);
      const y2 = CY - R * Math.sin(endAngle);

      // Full semi-circle: split through midpoint to avoid degenerate arc
      if (span >= Math.PI - 0.001) {
        const mx = CX + R * Math.cos(angle - span / 2);
        const my = CY - R * Math.sin(angle - span / 2);
        arcs += `<path d="M ${x1.toFixed(2)},${y1.toFixed(2)} A ${R},${R} 0 0,1 ${mx.toFixed(2)},${my.toFixed(2)} A ${R},${R} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)}" fill="none" stroke="${mood.color}" stroke-width="${SW}" stroke-linecap="butt"/>`;
      } else {
        arcs += `<path d="M ${x1.toFixed(2)},${y1.toFixed(2)} A ${R},${R} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)}" fill="none" stroke="${mood.color}" stroke-width="${SW}" stroke-linecap="butt"/>`;
      }
      angle = endAngle;
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
    <h3 class="mood-gauge-title">Conteo de ánimos</h3>
    <svg viewBox="0 0 280 180" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Distribución de estados de ánimo">
      ${arcs}${centerText}
    </svg>
    <div class="mood-gauge-legend">${legendItems}</div>
  </div>`;
}
