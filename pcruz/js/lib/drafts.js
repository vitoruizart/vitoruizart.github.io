import { put, get, del } from '../db.js';
import { findFrame, findFabric } from './frames.js';
import { MIN_ZOOM, MAX_ZOOM } from './crop.js';
import { MIN_COLORS, MAX_COLORS, MAX_FILE_BYTES } from './constants.js';
import { defaultSettings } from '../state.js';

let saveTimer = null;

/** Debounced save of the current image + settings, so a reload resumes. */
export function scheduleDraftSave(state, ms = 400) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraft(state).catch((err) => console.warn('draft save failed', err));
  }, ms);
}

export async function saveDraft(state) {
  if (!state.image?.blob) return;
  await put('drafts', {
    id: 'current',
    imageBlob: state.image.blob,
    frameId: state.frameId,
    count: state.count,
    orientation: state.orientation,
    crop: state.crop,
    maxColors: state.maxColors,
    savedAt: Date.now()
  });
}

export async function loadDraft() {
  try {
    return await get('drafts', 'current');
  } catch {
    return null;
  }
}

export async function clearDraft() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    await del('drafts', 'current');
  } catch (_) {
    // Nothing to do — an empty draft store is the desired state anyway.
  }
}

/** Only a real, reasonably sized Blob is worth decoding at startup. */
export function isRestorableDraft(draft) {
  const blob = draft?.imageBlob;
  return typeof Blob !== 'undefined' && blob instanceof Blob && blob.size > 0 && blob.size <= MAX_FILE_BYTES;
}

/**
 * Stored drafts are validated field by field before they reach the app:
 * anything unknown or out of range falls back to the default.
 */
export function sanitizeSettings(raw) {
  const d = defaultSettings();
  const src = raw && typeof raw === 'object' ? raw : {};
  const crop = src.crop && typeof src.crop === 'object' ? src.crop : {};
  return {
    frameId: typeof src.frameId === 'string' && findFrame(src.frameId) ? src.frameId : d.frameId,
    count: findFabric(src.count) ? src.count : d.count,
    orientation: src.orientation === 'landscape' || src.orientation === 'portrait' ? src.orientation : d.orientation,
    crop: {
      cx: clampNum(crop.cx, 0, 1, d.crop.cx),
      cy: clampNum(crop.cy, 0, 1, d.crop.cy),
      zoom: clampNum(crop.zoom, MIN_ZOOM, MAX_ZOOM, d.crop.zoom)
    },
    maxColors: Math.round(clampNum(src.maxColors, MIN_COLORS, MAX_COLORS, d.maxColors))
  };
}

function clampNum(v, lo, hi, fallback) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}
