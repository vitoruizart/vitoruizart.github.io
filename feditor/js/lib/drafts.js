import { put, get, del } from '../db.js';

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
    roomRef: serializeRoomRef(state.room),
    paintingBlob: state.painting?.blob || null,
    paintingW: state.painting?.naturalW || null,
    paintingH: state.painting?.naturalH || null,
    savedAt: Date.now()
  };
  await put('drafts', draft);
}

function serializeRoomRef(room) {
  if (!room) return null;
  const ref = { kind: room.kind };
  if (room.id != null) ref.id = room.id;
  if (room.kind === 'mat') {
    ref.color = room.color;
    ref.padH = room.padH;
    ref.padV = room.padV;
    ref.lockPad = room.lockPad;
  }
  return ref;
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
