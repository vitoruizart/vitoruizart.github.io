// Tiny pub/sub reactive store
const state = {};
const listeners = new Map(); // key → Set<fn>

export function get(key) {
  return state[key];
}

export function set(key, value) {
  state[key] = value;
  const subs = listeners.get(key);
  if (subs) for (const fn of subs) {
    try { fn(value); } catch (err) { console.error(`state listener error [${key}]:`, err); }
  }
}

export function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  // Fire immediately with current value
  if (key in state) fn(state[key]);
  return () => listeners.get(key)?.delete(fn);
}

export function update(key, updater) {
  set(key, updater(state[key]));
}
