import { beforeEach, describe, it, expect } from 'vitest';
import {
  getState, setState, patchUi, patchPlacement, setPlacement, resetPlacement,
  defaultPlacement, subscribe
} from '../js/state.js';

beforeEach(() => {
  // Reset the singleton to a known state.
  setState({ painting: null, frame: null, room: null });
  setPlacement(defaultPlacement());
  patchUi({ screen: 'pick-painting', toast: null });
});

describe('state', () => {
  it('defaultPlacement is centered with reasonable scale', () => {
    const p = defaultPlacement();
    expect(p.tx).toBe(0.5);
    expect(p.scale).toBeGreaterThan(0);
    expect(p.rotate).toBe(0);
    expect(p.rotateX).toBe(0);
    expect(p.rotateY).toBe(0);
  });

  it('patchPlacement merges only listed keys', () => {
    patchPlacement({ rotate: 15 });
    const p = getState().placement;
    expect(p.rotate).toBe(15);
    expect(p.tx).toBe(0.5);
  });

  it('subscribers fire on emit and can unsubscribe', () => {
    let count = 0;
    const off = subscribe(() => count++);
    patchPlacement({ scale: 0.4 });
    patchPlacement({ scale: 0.5 });
    expect(count).toBe(2);
    off();
    patchPlacement({ scale: 0.6 });
    expect(count).toBe(2);
  });

  it('resetPlacement restores defaults', () => {
    patchPlacement({ tx: 0.1, scale: 0.9 });
    resetPlacement();
    expect(getState().placement).toEqual(defaultPlacement());
  });
});
