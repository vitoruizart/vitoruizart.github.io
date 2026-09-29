import { describe, it, expect } from 'vitest';
import { cropRect, defaultCrop, normalizeCrop, MAX_ZOOM } from '../../js/lib/crop.js';

describe('cropRect', () => {
  it('default crop is the largest centred rect with the frame aspect', () => {
    // 4000×3000 image, portrait 4:5 frame → full height, width 2400, centred.
    const r = cropRect(4000, 3000, 4 / 5, defaultCrop());
    expect(r.h).toBeCloseTo(3000);
    expect(r.w).toBeCloseTo(2400);
    expect(r.x).toBeCloseTo(800);
    expect(r.y).toBeCloseTo(0);
  });

  it('uses full width when the image is taller than the frame aspect', () => {
    const r = cropRect(1000, 3000, 1, defaultCrop());
    expect(r).toEqual({ x: 0, y: 1000, w: 1000, h: 1000 });
  });

  it('zoom shrinks the rect around the centre', () => {
    const r = cropRect(1000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 2 });
    expect(r).toEqual({ x: 250, y: 250, w: 500, h: 500 });
  });

  it('clamps the rect inside the image when the centre is near an edge', () => {
    const r = cropRect(1000, 1000, 1, { cx: 0, cy: 1, zoom: 2 });
    expect(r).toEqual({ x: 0, y: 500, w: 500, h: 500 });
  });

  it('clamps zoom to [1, MAX_ZOOM] and tolerates garbage input', () => {
    const lo = cropRect(1000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 0.1 });
    expect(lo.w).toBe(1000);
    const hi = cropRect(1000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 1000 });
    expect(hi.w).toBeCloseTo(1000 / MAX_ZOOM);
    const bad = cropRect(1000, 1000, 1, { cx: NaN, cy: undefined, zoom: 'x' });
    expect(bad).toEqual({ x: 0, y: 0, w: 1000, h: 1000 });
  });
});

describe('normalizeCrop', () => {
  it('pulls an out-of-range centre back to where the clamped rect actually is', () => {
    const c = normalizeCrop(1000, 1000, 1, { cx: -3, cy: 0.5, zoom: 2 });
    expect(c.cx).toBeCloseTo(0.25);
    expect(c.cy).toBeCloseTo(0.5);
    expect(c.zoom).toBe(2);
  });

  it('is idempotent', () => {
    const once = normalizeCrop(1200, 800, 0.8, { cx: 0.9, cy: 0.1, zoom: 1.7 });
    const twice = normalizeCrop(1200, 800, 0.8, once);
    expect(twice.cx).toBeCloseTo(once.cx, 10);
    expect(twice.cy).toBeCloseTo(once.cy, 10);
  });
});
