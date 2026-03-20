// SVG kawaii mood faces for each mood level
// Returns an SVG string for a given mood value (1-5)
// Solid color-filled circles with white features inspired by justicon's Flaticon emoji pack

import { getMood } from '../lib/constants.js';

const FACE_PATHS = {
  5: `<!-- Feliz — heart eyes, open grin -->
    <circle cx="75" cy="23" r="4" fill="#fff" opacity="0.4"/>
    <circle cx="79" cy="19" r="2.5" fill="#fff" opacity="0.4"/>
    <path d="M35 35 C35 27 23 27 23 37 C23 46 35 53 35 56 C35 53 47 46 47 37 C47 27 35 27 35 35 Z" fill="#fff"/>
    <path d="M65 35 C65 27 53 27 53 37 C53 46 65 53 65 56 C65 53 77 46 77 37 C77 27 65 27 65 35 Z" fill="#fff"/>
    <path d="M28 64 L72 64 Q70 82 50 84 Q30 82 28 64 Z" fill="#fff"/>
    <path d="M32 68 L68 68 Q66 80 50 84 Q34 80 32 68 Z" fill="#000" opacity="0.15"/>`,

  4: `<!-- Contenta — squinted happy eyes, open grin with teeth -->
    <circle cx="75" cy="23" r="4" fill="#fff" opacity="0.4"/>
    <circle cx="79" cy="19" r="2.5" fill="#fff" opacity="0.4"/>
    <path d="M26 42 Q33 30 40 42" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M60 42 Q67 30 74 42" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M28 62 L72 62 Q70 80 50 82 Q30 80 28 62 Z" fill="#fff"/>
    <path d="M32 66 L68 66 Q66 78 50 82 Q34 78 32 66 Z" fill="#000" opacity="0.15"/>`,

  3: `<!-- Neutral — round eyes with pupils, flat mouth -->
    <circle cx="75" cy="23" r="4" fill="#fff" opacity="0.4"/>
    <circle cx="79" cy="19" r="2.5" fill="#fff" opacity="0.4"/>
    <circle cx="37" cy="44" r="10" fill="#fff"/>
    <circle cx="37" cy="44" r="7" fill="#2d3436"/>
    <circle cx="35" cy="42" r="2.5" fill="#fff"/>
    <circle cx="63" cy="44" r="10" fill="#fff"/>
    <circle cx="63" cy="44" r="7" fill="#2d3436"/>
    <circle cx="65" cy="42" r="2.5" fill="#fff"/>
    <line x1="40" y1="68" x2="60" y2="68" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,

  2: `<!-- Triste — big puppy eyes, sad brows, frown, tear -->
    <circle cx="75" cy="23" r="4" fill="#fff" opacity="0.4"/>
    <circle cx="79" cy="19" r="2.5" fill="#fff" opacity="0.4"/>
    <circle cx="37" cy="46" r="12" fill="#fff"/>
    <circle cx="37" cy="46" r="9" fill="#2d3436"/>
    <circle cx="34" cy="43" r="3.5" fill="#fff"/>
    <circle cx="38" cy="47" r="1.5" fill="#fff"/>
    <circle cx="63" cy="46" r="12" fill="#fff"/>
    <circle cx="63" cy="46" r="9" fill="#2d3436"/>
    <circle cx="60" cy="43" r="3.5" fill="#fff"/>
    <circle cx="64" cy="47" r="1.5" fill="#fff"/>
    <path d="M24 34 Q34 28 44 36" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M76 34 Q66 28 56 36" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M42 72 Q50 66 58 72" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="73" cy="66" rx="4.5" ry="7" fill="#fff" opacity="0.5"/>`,

  1: `<!-- Hecha polvo — closed eyes, tear streams, open mouth -->
    <circle cx="75" cy="23" r="4" fill="#fff" opacity="0.4"/>
    <circle cx="79" cy="19" r="2.5" fill="#fff" opacity="0.4"/>
    <rect x="22" y="38" width="12" height="42" rx="6" fill="#fff" opacity="0.3"/>
    <rect x="66" y="38" width="12" height="42" rx="6" fill="#fff" opacity="0.3"/>
    <path d="M26 42 Q33 30 40 42" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M60 42 Q67 30 74 42" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M34 68 L66 68 Q64 80 50 82 Q36 80 34 68 Z" fill="#fff"/>
    <path d="M37 72 L63 72 Q61 80 50 82 Q39 80 37 72 Z" fill="#000" opacity="0.15"/>`,
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
