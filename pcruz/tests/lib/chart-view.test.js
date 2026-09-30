import { describe, it, expect } from 'vitest';
import {
  fitView, viewLimits, clampView, transformView, visibleRange, drawChartView, MAX_VIEW_CELL_PX
} from '../../js/lib/chart-view.js';
import { FABRIC } from '../../js/lib/constants.js';

// Records every method call; property writes (fillStyle, font…) just stick.
function recordingCtx() {
  const calls = [];
  const target = { calls };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, ...args])),
    set: (t, k, v) => { t[k] = v; return true; }
  });
}

const count = (ctx, name) => ctx.calls.filter((c) => c[0] === name).length;

function pattern(cols, rows, fabricAt = () => false) {
  const indices = new Uint16Array(cols * rows);
  for (let i = 0; i < indices.length; i++) indices[i] = fabricAt(i % cols, Math.floor(i / cols)) ? FABRIC : i % 2;
  return {
    cols, rows, indices,
    palette: [
      { symbol: '2', rgb: [0, 0, 0], hex: '#000000' },
      { symbol: '3', rgb: [255, 255, 255], hex: '#FFFFFF' }
    ]
  };
}

describe('fitView', () => {
  it('centres the whole chart inside the padded viewport', () => {
    const v = fitView(100, 50, 420, 420, 10);
    expect(v.s).toBeCloseTo(4);
    expect(v.x).toBeCloseTo(10);
    expect(v.y).toBeCloseTo(110);
  });
});

describe('clampView', () => {
  it('keeps the zoom between fit and the maximum', () => {
    const { min, max } = viewLimits(100, 50, 420, 420, 10);
    expect(min).toBeCloseTo(4);
    expect(max).toBe(MAX_VIEW_CELL_PX);
    expect(clampView({ s: 1, x: 0, y: 0 }, 100, 50, 420, 420, 10).s).toBeCloseTo(4);
    expect(clampView({ s: 999, x: 0, y: 0 }, 100, 50, 420, 420, 10).s).toBe(MAX_VIEW_CELL_PX);
  });

  it('centres an axis that fits and stops panning past the edges otherwise', () => {
    // 100×50 chart at 8 px/stitch is 800×400: with the 10 px pad it overflows
    // the 420 px viewport on both axes, so both are clamped rather than centred.
    const v = clampView({ s: 8, x: 500, y: -9999 }, 100, 50, 420, 420, 10);
    expect(v.x).toBe(10); // left edge can't come further in than the pad
    expect(v.y).toBe(420 - 10 - 400);
    const small = clampView({ s: 4, x: 123, y: 7 }, 100, 50, 420, 420, 10);
    expect(small.y).toBeCloseTo(110); // 200 px tall chart: centred
  });
});

describe('transformView', () => {
  it('keeps the point under the fingers fixed while zooming', () => {
    const v = { s: 2, x: 10, y: 20 };
    const p = { x: 110, y: 120 }; // chart point (50, 50)
    const z = transformView(v, 3, p, p);
    expect(z.s).toBe(6);
    expect((p.x - z.x) / z.s).toBeCloseTo(50);
    expect((p.y - z.y) / z.s).toBeCloseTo(50);
  });

  it('pans by the finger delta when the factor is 1', () => {
    expect(transformView({ s: 2, x: 10, y: 20 }, 1, { x: 0, y: 0 }, { x: 5, y: -7 })).toEqual({ s: 2, x: 15, y: 13 });
  });
});

describe('visibleRange', () => {
  it('returns only the stitches inside the viewport', () => {
    expect(visibleRange({ s: 10, x: -55, y: 0 }, 100, 50, 200, 100)).toEqual({ c0: 5, c1: 26, r0: 0, r1: 10 });
  });

  it('clamps to the chart', () => {
    expect(visibleRange({ s: 1, x: 10, y: 10 }, 100, 50, 400, 400)).toEqual({ c0: 0, c1: 100, r0: 0, r1: 50 });
  });
});

describe('drawChartView', () => {
  it('shows only colours and the outline when zoomed out', () => {
    const ctx = recordingCtx();
    drawChartView(ctx, pattern(100, 50), {}, { s: 2, x: 0, y: 0 }, 200, 100, 1);
    expect(count(ctx, 'drawImage')).toBe(1);
    expect(count(ctx, 'fillText')).toBe(0);
    expect(count(ctx, 'stroke')).toBe(0);
    expect(count(ctx, 'strokeRect')).toBe(1);
  });

  it('adds grid and symbols for the visible stitches once zoomed in', () => {
    const ctx = recordingCtx();
    drawChartView(ctx, pattern(100, 50), {}, { s: 20, x: 0, y: 0 }, 200, 100, 2);
    expect(count(ctx, 'fillText')).toBe(10 * 5);
    expect(count(ctx, 'stroke')).toBe(2);
  });

  it('draws no symbol on bare fabric', () => {
    const ctx = recordingCtx();
    const p = pattern(10, 10, (x) => x < 3);
    drawChartView(ctx, p, {}, { s: 20, x: 0, y: 0 }, 200, 200, 1);
    expect(count(ctx, 'fillText')).toBe(7 * 10);
  });
});
