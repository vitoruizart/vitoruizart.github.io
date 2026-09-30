import { describe, it, expect } from 'vitest';
import {
  cropRect, defaultCrop, normalizeCrop, resizeCrop, fillCrop, pickHandle, stageView,
  MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM
} from '../../js/lib/crop.js';

describe('cropRect', () => {
  it('zoom 1 is the smallest frame-shaped rect that holds the whole image', () => {
    // 4000×3000 image in a portrait 4:5 frame → full width, taller than the image.
    const r = cropRect(4000, 3000, 4 / 5, { cx: 0.5, cy: 0.5, zoom: 1 });
    expect(r.w).toBeCloseTo(4000);
    expect(r.h).toBeCloseTo(5000);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(-1000);
  });

  it('uses the full height when the image is taller than the frame aspect', () => {
    const r = cropRect(1000, 3000, 1, { cx: 0.5, cy: 0.5, zoom: 1 });
    expect(r).toEqual({ x: -1000, y: 0, w: 3000, h: 3000 });
  });

  it('default crop leaves a white margin all around the image', () => {
    const r = cropRect(1000, 1000, 1, defaultCrop());
    expect(r.w).toBeCloseTo(1000 / DEFAULT_ZOOM);
    expect(r.x).toBeLessThan(0);
    expect(r.y).toBeLessThan(0);
    expect(r.x + r.w).toBeGreaterThan(1000);
    expect(r.y + r.h).toBeGreaterThan(1000);
  });

  it('zoom above 1 crops into the image around the centre', () => {
    const r = cropRect(1000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 2 });
    expect(r).toEqual({ x: 250, y: 250, w: 500, h: 500 });
  });

  it('lets the frame hang over the image edge instead of clamping it inside', () => {
    const r = cropRect(1000, 1000, 1, { cx: 0, cy: 1, zoom: 2 });
    expect(r).toEqual({ x: -250, y: 750, w: 500, h: 500 });
  });

  it('clamps zoom and centre and tolerates garbage input', () => {
    expect(cropRect(1000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 0.01 }).w).toBeCloseTo(1000 / MIN_ZOOM);
    expect(cropRect(1000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 1000 }).w).toBeCloseTo(1000 / MAX_ZOOM);
    const far = cropRect(1000, 1000, 1, { cx: 5, cy: -5, zoom: 1 });
    expect(far.x + far.w / 2).toBeCloseTo(1000);
    expect(far.y + far.h / 2).toBeCloseTo(0);
    const bad = cropRect(1000, 1000, 1, { cx: NaN, cy: undefined, zoom: 'x' });
    expect(bad).toEqual(cropRect(1000, 1000, 1, defaultCrop()));
  });
});

describe('normalizeCrop', () => {
  it('keeps the centre inside the image and the zoom in range', () => {
    expect(normalizeCrop({ cx: -3, cy: 0.4, zoom: 99 })).toEqual({ cx: 0, cy: 0.4, zoom: MAX_ZOOM });
    expect(normalizeCrop(null)).toEqual(defaultCrop());
  });

  it('is idempotent', () => {
    const once = normalizeCrop({ cx: 0.9, cy: 1.2, zoom: 0.1 });
    expect(normalizeCrop(once)).toEqual(once);
  });
});

describe('resizeCrop', () => {
  const start = { cx: 0.5, cy: 0.5, zoom: 1 }; // 1000×1000 image, square frame = image

  it('keeps the opposite corner fixed while dragging a corner', () => {
    // Drag the bottom-right corner inwards to (800, 800).
    const next = resizeCrop(1000, 1000, 1, start, { sx: 1, sy: 1 }, { x: 800, y: 800 });
    const r = cropRect(1000, 1000, 1, next);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(800);
    expect(r.h).toBeCloseTo(800);
  });

  it('grows past the image to add a margin on one side only', () => {
    // Drag the top-left corner out to (-200, -200): bottom-right stays at (1000, 1000).
    const next = resizeCrop(1000, 1000, 1, start, { sx: -1, sy: -1 }, { x: -200, y: -200 });
    const r = cropRect(1000, 1000, 1, next);
    expect(r.x).toBeCloseTo(-200);
    expect(r.y).toBeCloseTo(-200);
    expect(r.x + r.w).toBeCloseTo(1000);
    expect(r.y + r.h).toBeCloseTo(1000);
  });

  it('locks the aspect by projecting the finger onto the diagonal', () => {
    const aspect = 0.8;
    const next = resizeCrop(1000, 1000, aspect, { cx: 0.5, cy: 0.5, zoom: 1 }, { sx: 1, sy: 1 }, { x: 900, y: 300 });
    const r = cropRect(1000, 1000, aspect, next);
    expect(r.w / r.h).toBeCloseTo(aspect, 10);
  });

  it('never flips or shrinks below the minimum size', () => {
    const next = resizeCrop(1000, 1000, 1, start, { sx: 1, sy: 1 }, { x: -500, y: -500 }, 300);
    const r = cropRect(1000, 1000, 1, next);
    expect(r.x).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(300);
  });

  it('never grows beyond MIN_ZOOM', () => {
    const next = resizeCrop(1000, 1000, 1, start, { sx: 1, sy: 1 }, { x: 99999, y: 99999 });
    expect(next.zoom).toBeCloseTo(MIN_ZOOM);
  });
});

describe('fillCrop', () => {
  it('fills the frame with the largest centred rect inside the image', () => {
    const r = cropRect(4000, 3000, 4 / 5, fillCrop(4000, 3000, 4 / 5));
    expect(r.x).toBeCloseTo(800);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(2400);
    expect(r.h).toBeCloseTo(3000);
  });
});

describe('pickHandle', () => {
  const frame = { x: 100, y: 100, w: 200, h: 300 };

  it('picks the corner under the finger', () => {
    expect(pickHandle(frame, { x: 105, y: 95 }, 20)).toEqual({ type: 'corner', sx: -1, sy: -1 });
    expect(pickHandle(frame, { x: 290, y: 410 }, 20)).toEqual({ type: 'corner', sx: 1, sy: 1 });
  });

  it('moves when grabbing inside the frame away from the corners', () => {
    expect(pickHandle(frame, { x: 200, y: 250 }, 20)).toEqual({ type: 'move' });
  });

  it('ignores touches outside the frame', () => {
    expect(pickHandle(frame, { x: 20, y: 250 }, 20)).toBeNull();
  });
});

describe('stageView', () => {
  it('fits the image when the frame is inside it', () => {
    const v = stageView(1000, 500, { x: 100, y: 100, w: 200, h: 200 }, 520, 520, 10);
    expect(v.s).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo(10);
    expect(v.y).toBeCloseTo(135);
  });

  it('fits image and frame together when the frame sticks out', () => {
    // Frame from x = −100 to 1100: 1200 px wide at 0.5 → 600 px, centred in 620.
    const v = stageView(1000, 500, { x: -100, y: 0, w: 1200, h: 500 }, 620, 400, 10);
    expect(v.s).toBeCloseTo(0.5);
    expect(v.x + -100 * v.s).toBeCloseTo(10);
    expect(v.y).toBeCloseTo(75);
  });
});
