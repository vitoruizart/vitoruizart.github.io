// Mood face icons for each mood level (1-5)
// Returns an <img> tag referencing PNG icons from justicon's Flaticon emoji pack

import { getMood } from '../lib/constants.js';

const ICON_PATH = 'icons/mood-';

export function moodFaceSvg(value, size = 100) {
  const mood = getMood(value);
  const src = `${ICON_PATH}${mood.value}.png`;
  return `<img src="${src}" width="${size}" height="${size}" alt="${mood.label}" draggable="false">`;
}

export function moodFaceSvgSmall(value, size = 28) {
  return moodFaceSvg(value, size);
}
