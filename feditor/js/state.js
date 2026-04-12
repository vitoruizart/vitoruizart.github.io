const listeners = new Set();

const state = {
  painting: null,
  frame: null,
  room: null,
  placement: defaultPlacement(),
  ui: { screen: 'pick-painting', toast: null }
};

export function defaultPlacement() {
  return { tx: 0.5, ty: 0.45, scale: 0.35, rotate: 0, rotateX: 0, rotateY: 0 };
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

export function patchPlacement(placementPatch) {
  state.placement = { ...state.placement, ...placementPatch };
  emit();
}

export function patchRoom(roomPatch) {
  state.room = { ...state.room, ...roomPatch };
  emit();
}

export function setPlacement(next) {
  state.placement = next;
  emit();
}

export function resetPlacement() {
  state.placement = defaultPlacement();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}
