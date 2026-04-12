import { describe, it, expect } from 'vitest';
import { drawFrame } from '../../js/lib/frame-render.js';

// The strip built by strip-cropper/bundled-frame-gen is a 9-slice texture with
// four differently-oriented mitered trapezoids at its four source corners.
// drawFrame must pull each destination corner from the matching source corner
// so that the miter diagonal runs the correct way at every corner. Pulling
// the wrong source corner is what produced the visible inner-corner gap when
// exporting on a transparent / solid-color background.
describe('drawFrame corner source extraction', () => {
  it('maps each destination corner to its matching source corner', () => {
    const calls = [];
    const ctx = { drawImage: (...args) => calls.push(args) };
    const strip = { width: 100, height: 100 };
    const borderPx = 10;
    const sliceFrac = 0.25;
    const slice = Math.max(2, Math.round(Math.min(strip.width, strip.height) * sliceFrac));

    drawFrame(ctx, { stripBitmap: strip, sliceWidth: sliceFrac, borderPx },
      { x: 50, y: 50, w: 200, h: 200 });

    // The last four draw calls are the corners (TL, TR, BL, BR in that order).
    const corners = calls.slice(-4);
    // Each call: (strip, srcX, srcY, srcW, srcH, dx, dy, dw, dh).
    const srcOf = (c) => [c[1], c[2]];
    expect(srcOf(corners[0])).toEqual([0, 0]);
    expect(srcOf(corners[1])).toEqual([strip.width - slice, 0]);
    expect(srcOf(corners[2])).toEqual([0, strip.height - slice]);
    expect(srcOf(corners[3])).toEqual([strip.width - slice, strip.height - slice]);
    // Source crop is always a `slice × slice` square.
    for (const c of corners) {
      expect(c[3]).toBe(slice);
      expect(c[4]).toBe(slice);
      expect(c[7]).toBe(borderPx);
      expect(c[8]).toBe(borderPx);
    }
  });

  it('places corners at the four outer corners of the frame rect', () => {
    const calls = [];
    const ctx = { drawImage: (...args) => calls.push(args) };
    const strip = { width: 100, height: 100 };
    const borderPx = 10;
    const inner = { x: 50, y: 60, w: 200, h: 180 };
    drawFrame(ctx, { stripBitmap: strip, sliceWidth: 0.25, borderPx }, inner);
    const corners = calls.slice(-4);
    const ox = inner.x - borderPx;
    const oy = inner.y - borderPx;
    const ow = inner.w + 2 * borderPx;
    const oh = inner.h + 2 * borderPx;
    expect([corners[0][5], corners[0][6]]).toEqual([ox, oy]);
    expect([corners[1][5], corners[1][6]]).toEqual([ox + ow - borderPx, oy]);
    expect([corners[2][5], corners[2][6]]).toEqual([ox, oy + oh - borderPx]);
    expect([corners[3][5], corners[3][6]]).toEqual([ox + ow - borderPx, oy + oh - borderPx]);
  });
});

describe('drawFrame edge tiling', () => {
  it('uses an integer tile count that fits each edge exactly (no partial tail)', () => {
    const calls = [];
    const ctx = { drawImage: (...args) => calls.push(args) };
    const strip = { width: 100, height: 100 };
    const borderPx = 10;
    // inner.w / natural tile width should land between 2 and 3 tiles so we can
    // assert the count gets rounded and every tile has the same width.
    const inner = { x: 50, y: 50, w: 125, h: 125 };
    drawFrame(ctx, { stripBitmap: strip, sliceWidth: 0.25, borderPx }, inner);
    // Top-edge tiles use the strip's middle horizontal band: srcY=0 and
    // srcW = stripW - 2*slice = 50 (vs slice=25 for corners).
    const slice = Math.round(Math.min(strip.width, strip.height) * 0.25);
    const midSrcW = strip.width - 2 * slice;
    const topEdge = calls.filter((c) => c[2] === 0 && c[3] === midSrcW && c[6] === 40);
    expect(topEdge.length).toBeGreaterThanOrEqual(1);
    // Every tile is the same width and the sum equals the full edge span
    // (inner.w + 2 * 0.5 overlap = inner.w + 1).
    const widths = topEdge.map((c) => c[7]);
    const first = widths[0];
    for (const w of widths) expect(w).toBeCloseTo(first, 6);
    const total = widths.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(inner.w + 1, 6);
  });
});
