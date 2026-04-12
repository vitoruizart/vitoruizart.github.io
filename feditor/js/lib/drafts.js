import { put, get } from '../db.js';

let saveTimer = null;

/**
 * Debounced save of the current placement + selected frame/room IDs.
 * Heavy blobs (painting/room/frame data) live in their own stores already
 * (or are bundled by id); the draft only stores ids + placement.
 */
export function scheduleDraftSave(state, ms = 400) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraft(state).catch((err) => console.warn('draft save failed', err));
  }, ms);
}

async function saveDraft(state) {
  const draft = {
    id: 'current',
    placement: state.placement,
    frameRef: state.frame ? { kind: state.frame.kind, id: state.frame.id, sliceWidth: state.frame.sliceWidth, borderFrac: state.frame.borderFrac } : null,
    roomRef: state.room ? { kind: state.room.kind, id: state.room.id } : null,
    paintingBlob: state.painting?.blob || null,
    paintingW: state.painting?.naturalW || null,
    paintingH: state.painting?.naturalH || null,
    savedAt: Date.now()
  };
  await put('drafts', draft);
}

export async function loadDraft() {
  try {
    return await get('drafts', 'current');
  } catch {
    return null;
  }
}
