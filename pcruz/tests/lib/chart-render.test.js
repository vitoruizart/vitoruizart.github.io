import { describe, it, expect } from 'vitest';
import { drawChart } from '../../js/lib/chart-render.js';
import { FABRIC } from '../../js/lib/constants.js';

// Records method calls with the fillStyle in effect at the time.
function recordingCtx() {
  const calls = [];
  const target = { calls, fillStyle: null };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, t.fillStyle, ...args])),
    set: (t, k, v) => { t[k] = v; return true; }
  });
}

describe('drawChart', () => {
  it('leaves bare-fabric cells white and without a symbol', () => {
    // 4×1 row: fabric, thread 0, thread 0, fabric.
    const pattern = {
      cols: 4, rows: 1,
      indices: Uint16Array.from([FABRIC, 0, 0, FABRIC]),
      palette: [{ symbol: '2', rgb: [200, 0, 0], hex: '#C80000' }]
    };
    const ctx = recordingCtx();
    drawChart(ctx, pattern, { x: 0, y: 0, cellPx: 10, labelPx: 8, gutter: 20 });

    const fills = ctx.calls.filter((c) => c[0] === 'fillRect');
    expect(fills).toEqual([['fillRect', '#C80000', 10, 0, 20, 10]]);
    const symbols = ctx.calls.filter((c) => c[0] === 'fillText' && c[2] === '2');
    expect(symbols.map((c) => c[3])).toEqual([15, 25]);
  });
});
