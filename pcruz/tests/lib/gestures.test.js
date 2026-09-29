import { describe, it, expect } from 'vitest';
import { computeDelta } from '../../js/lib/gestures.js';

describe('computeDelta', () => {
  it('returns translate-only delta for single pointer', () => {
    const baseline = { centroid: { x: 100, y: 200 }, distance: 0, angle: 0, count: 1 };
    const cur = { centroid: { x: 130, y: 180 }, distance: 0, angle: 0, count: 1 };
    const d = computeDelta(baseline, cur);
    expect(d.dx).toBe(30);
    expect(d.dy).toBe(-20);
    expect(d.scale).toBe(1);
    expect(d.rotate).toBe(0);
  });

  it('returns scale and rotate from two-pointer delta', () => {
    const baseline = { centroid: { x: 0, y: 0 }, distance: 100, angle: 0, count: 2 };
    const cur = { centroid: { x: 0, y: 0 }, distance: 200, angle: 90, count: 2 };
    const d = computeDelta(baseline, cur);
    expect(d.scale).toBe(2);
    expect(d.rotate).toBe(90);
  });

  it('normalizes rotation across the ±180 boundary', () => {
    const baseline = { centroid: { x: 0, y: 0 }, distance: 100, angle: 170, count: 2 };
    const cur = { centroid: { x: 0, y: 0 }, distance: 100, angle: -170, count: 2 };
    const d = computeDelta(baseline, cur);
    // 170 -> -170 should be +20°, not -340°.
    expect(d.rotate).toBe(20);
  });

  it('does not divide by zero when baseline distance is 0', () => {
    const baseline = { centroid: { x: 0, y: 0 }, distance: 0, angle: 0, count: 2 };
    const cur = { centroid: { x: 50, y: 50 }, distance: 100, angle: 45, count: 2 };
    const d = computeDelta(baseline, cur);
    expect(d.scale).toBe(1);
    expect(d.rotate).toBe(0);
    expect(d.dx).toBe(50);
  });
});
