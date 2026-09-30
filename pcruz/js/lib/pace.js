import { STORAGE_PREFIX } from './constants.js';

// Stitching pace for the time estimate on the frame screen, in cuadritos
// (one full cross = two stitches) per day. It's a personal preference, so
// it lives in localStorage instead of the per-image draft.
export const DEFAULT_PACE = 30;
export const MIN_PACE = 5;
export const MAX_PACE = 300;
export const PACE_STEP = 5;
const KEY = STORAGE_PREFIX + 'stitchesPerDay';

/** A slider value: number or numeric string, snapped and clamped; else the default. */
export function sanitizePace(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_PACE;
  return Math.min(MAX_PACE, Math.max(MIN_PACE, Math.round(n / PACE_STEP) * PACE_STEP));
}

// Storage can throw (private mode, blocked site data): fall back silently.
export function loadPace() {
  try {
    return sanitizePace(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_PACE;
  }
}

export function savePace(v) {
  try {
    localStorage.setItem(KEY, String(sanitizePace(v)));
  } catch (_) {}
}
