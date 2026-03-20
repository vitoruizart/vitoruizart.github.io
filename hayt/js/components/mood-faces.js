// SVG kawaii mood faces for each mood level
// Returns an SVG string for a given mood value (1-5)
// Solid color-filled circles with white facial features

import { getMood } from '../lib/constants.js';

const FACE_PATHS = {
  5: `<!-- Ecstatic ^_^ -->
    <path d="M30 42 Q35 34 40 42" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M60 42 Q65 34 70 42" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="32" cy="52" r="5" fill="#fff" opacity="0.3"/>
    <circle cx="68" cy="52" r="5" fill="#fff" opacity="0.3"/>
    <path d="M30 60 Q50 78 70 60" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,

  4: `<!-- Cute smile -->
    <circle cx="36" cy="42" r="5" fill="#fff"/>
    <circle cx="64" cy="42" r="5" fill="#fff"/>
    <path d="M34 62 Q50 74 66 62" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,

  3: `<!-- Neutral -->
    <circle cx="36" cy="42" r="5" fill="#fff"/>
    <circle cx="64" cy="42" r="5" fill="#fff"/>
    <line x1="36" y1="64" x2="64" y2="64" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,

  2: `<!-- Worried/sad -->
    <circle cx="36" cy="44" r="5" fill="#fff"/>
    <circle cx="64" cy="44" r="5" fill="#fff"/>
    <line x1="28" y1="32" x2="40" y2="36" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="72" y1="32" x2="60" y2="36" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M34 70 Q50 58 66 70" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,

  1: `<!-- Devastated -->
    <line x1="30" y1="36" x2="42" y2="48" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="42" y1="36" x2="30" y2="48" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="58" y1="36" x2="70" y2="48" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="70" y1="36" x2="58" y2="48" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="44" cy="56" rx="3" ry="5" fill="#fff" opacity="0.4"/>
    <ellipse cx="56" cy="56" rx="3" ry="5" fill="#fff" opacity="0.4"/>
    <path d="M30 68 Q38 62 46 68 Q54 74 62 68 Q70 62 72 66" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};

export function moodFaceSvg(value, size = 100) {
  const mood = getMood(value);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"
    style="color:${mood.color}" aria-label="${mood.label}">
    <circle cx="50" cy="50" r="46" fill="currentColor"/>
    ${FACE_PATHS[value] ?? FACE_PATHS[3]}
  </svg>`;
}

export function moodFaceSvgSmall(value, size = 28) {
  return moodFaceSvg(value, size);
}
