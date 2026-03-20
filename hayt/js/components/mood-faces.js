// SVG kawaii mood faces for each mood level
// Returns an SVG string for a given mood value (1-5)
// Solid color-filled circles with expressive kawaii features (3-layer anime eyes, filled mouths)

import { getMood } from '../lib/constants.js';

const FACE_PATHS = {
  5: `<!-- Ecstatic ^_^ — closed arc eyes, filled grin, blush, sparkle -->
    <path d="M28 44 Q35 34 42 44" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M58 44 Q65 34 72 44" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="54" r="8" fill="#fff" opacity="0.3"/>
    <circle cx="72" cy="54" r="8" fill="#fff" opacity="0.3"/>
    <path d="M30 60 Q50 80 70 60" stroke="#fff" stroke-width="3.5" fill="#fff" fill-opacity="0.35" stroke-linecap="round"/>
    <path d="M78 28 L80 22 L82 28 L88 30 L82 32 L80 38 L78 32 L72 30 Z" fill="#fff" opacity="0.5"/>`,

  4: `<!-- Contenta — 3-layer anime eyes, U-smile, subtle blush -->
    <circle cx="36" cy="42" r="10" fill="#fff"/>
    <circle cx="36" cy="41" r="5.5" fill="#333"/>
    <circle cx="34" cy="39" r="2.5" fill="#fff"/>
    <circle cx="64" cy="42" r="10" fill="#fff"/>
    <circle cx="64" cy="41" r="5.5" fill="#333"/>
    <circle cx="62" cy="39" r="2.5" fill="#fff"/>
    <circle cx="28" cy="54" r="6" fill="#fff" opacity="0.2"/>
    <circle cx="72" cy="54" r="6" fill="#fff" opacity="0.2"/>
    <path d="M34 62 Q50 76 66 62" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,

  3: `<!-- Neutral — 3-layer anime eyes, flat dash mouth -->
    <circle cx="36" cy="42" r="10" fill="#fff"/>
    <circle cx="36" cy="42" r="5.5" fill="#333"/>
    <circle cx="34" cy="40" r="2.5" fill="#fff"/>
    <circle cx="64" cy="42" r="10" fill="#fff"/>
    <circle cx="64" cy="42" r="5.5" fill="#333"/>
    <circle cx="62" cy="40" r="2.5" fill="#fff"/>
    <line x1="38" y1="66" x2="62" y2="66" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,

  2: `<!-- Triste — 3-layer anime eyes (looking down), eyebrows, frown, tear -->
    <circle cx="36" cy="44" r="10" fill="#fff"/>
    <circle cx="36" cy="47" r="5.5" fill="#333"/>
    <circle cx="34" cy="45" r="2.5" fill="#fff"/>
    <circle cx="64" cy="44" r="10" fill="#fff"/>
    <circle cx="64" cy="47" r="5.5" fill="#333"/>
    <circle cx="62" cy="45" r="2.5" fill="#fff"/>
    <line x1="26" y1="30" x2="42" y2="34" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="74" y1="30" x2="58" y2="34" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M38 70 Q50 62 62 70" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="46" cy="58" rx="3" ry="5" fill="#fff" opacity="0.4"/>`,

  1: `<!-- Devastated >_< — chevron eyes, wobbly mouth, 6 tears, sweat drop -->
    <path d="M28 34 L38 42 L28 50" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M72 34 L62 42 L72 50" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="30" cy="56" rx="2.5" ry="4" fill="#fff" opacity="0.5"/>
    <ellipse cx="28" cy="64" rx="2" ry="3.5" fill="#fff" opacity="0.4"/>
    <ellipse cx="32" cy="70" rx="2" ry="3" fill="#fff" opacity="0.3"/>
    <ellipse cx="70" cy="56" rx="2.5" ry="4" fill="#fff" opacity="0.5"/>
    <ellipse cx="72" cy="64" rx="2" ry="3.5" fill="#fff" opacity="0.4"/>
    <ellipse cx="68" cy="70" rx="2" ry="3" fill="#fff" opacity="0.3"/>
    <path d="M78 24 Q80 18 82 24 Q82 28 80 30 Q78 28 78 24 Z" fill="#fff" opacity="0.5"/>
    <path d="M30 72 Q38 66 46 72 Q54 78 62 72 Q66 68 70 70" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
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
