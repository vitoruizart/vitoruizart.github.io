// SVG line-art circle faces for each mood level
// Returns an SVG string for a given mood value (1-5)

import { getMood } from '../lib/constants.js';

const FACE_PATHS = {
  5: `<!-- Wide grin -->
    <circle cx="35" cy="38" r="4" fill="currentColor"/>
    <circle cx="65" cy="38" r="4" fill="currentColor"/>
    <path d="M28 58 Q50 78 72 58" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,

  4: `<!-- Smile -->
    <circle cx="35" cy="40" r="3.5" fill="currentColor"/>
    <circle cx="65" cy="40" r="3.5" fill="currentColor"/>
    <path d="M32 60 Q50 72 68 60" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>`,

  3: `<!-- Neutral -->
    <circle cx="35" cy="40" r="3.5" fill="currentColor"/>
    <circle cx="65" cy="40" r="3.5" fill="currentColor"/>
    <line x1="34" y1="62" x2="66" y2="62" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,

  2: `<!-- Frown -->
    <circle cx="35" cy="40" r="3.5" fill="currentColor"/>
    <circle cx="65" cy="40" r="3.5" fill="currentColor"/>
    <path d="M32 68 Q50 56 68 68" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>`,

  1: `<!-- X eyes + wavy mouth -->
    <line x1="30" y1="35" x2="40" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="35" x2="30" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="60" y1="35" x2="70" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="70" y1="35" x2="60" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 64 Q38 58 46 64 Q54 70 62 64 Q70 58 72 62" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};

export function moodFaceSvg(value, size = 100) {
  const mood = getMood(value);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"
    style="color:${mood.color}" aria-label="${mood.label}">
    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/>
    ${FACE_PATHS[value] ?? FACE_PATHS[3]}
  </svg>`;
}

export function moodFaceSvgSmall(value, size = 28) {
  return moodFaceSvg(value, size);
}
