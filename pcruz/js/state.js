import { DEFAULT_FRAME_ID, DEFAULT_COUNT } from './lib/frames.js';
import { defaultCrop } from './lib/crop.js';
import { DEFAULT_COLORS } from './lib/constants.js';

const listeners = new Set();

const state = {
  image: null, // { blob, bitmap, w, h }
  pattern: null, // { cols, rows, palette, indices } — built on the pattern screen
  ...defaultSettings(),
  ui: { screen: 'pick-image' }
};

export function defaultSettings() {
  return {
    frameId: DEFAULT_FRAME_ID,
    count: DEFAULT_COUNT,
    orientation: 'portrait',
    crop: defaultCrop(),
    maxColors: DEFAULT_COLORS
  };
}

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  emit();
}

export function patchUi(uiPatch) {
  state.ui = { ...state.ui, ...uiPatch };
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}
