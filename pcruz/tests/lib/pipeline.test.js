import { describe, it, expect } from 'vitest';
import { gridFor, aspectFor, metaFor, fmtCm, stitchCount, hoursToStitch, fmtHours } from '../../js/lib/pipeline.js';
import { patternSummary, summaryLine, rgbaToRgb } from '../../js/lib/exporters.js';
import { defaultSettings } from '../../js/state.js';
import { stitchesPerSkein } from '../../js/lib/skeins.js';

const settings = (patch) => ({ ...defaultSettings(), ...patch });

describe('pipeline helpers', () => {
  it('derives the stitch grid from frame, fabric and orientation', () => {
    expect(gridFor(settings({ frameId: '20x25', count: 14 }))).toEqual({ cols: 110, rows: 138 });
    expect(gridFor(settings({ frameId: '20x25', count: 14, orientation: 'landscape' }))).toEqual({ cols: 138, rows: 110 });
  });

  it('crop aspect equals the grid aspect', () => {
    const s = settings({ frameId: '20x25', count: 14 });
    expect(aspectFor(s)).toBeCloseTo(110 / 138, 10);
  });

  it('builds labels with Spanish decimal commas', () => {
    expect(fmtCm(29.7)).toBe('29,7');
    const m = metaFor(settings({ frameId: 'a4', count: 11, orientation: 'landscape' }));
    expect(m).toEqual({ frameLabel: '29,7 × 21', orientationLabel: 'horizontal', fabricLabel: 'Aida 11', count: 11, strands: 3 });
    expect(metaFor(settings({ frameId: '30x30' })).orientationLabel).toBe('cuadrado');
  });
});

describe('stitch time estimate', () => {
  const image = { w: 1000, h: 1000 };

  it('counts every cell when the photo fills the frame', () => {
    // Square 30×30 frame on Aida 14 → 165×165 grid; "cover" crop = no margin.
    const s = settings({ image, frameId: '30x30', count: 14, crop: { cx: 0.5, cy: 0.5, zoom: 1 } });
    expect(stitchCount(s)).toBe(165 * 165);
  });

  it('leaves the white margin out', () => {
    // zoom 0.5: the photo covers the middle half of each side.
    const s = settings({ image, frameId: '30x30', count: 14, crop: { cx: 0.5, cy: 0.5, zoom: 0.5 } });
    const n = stitchCount(s);
    expect(n).toBeGreaterThan(82 * 82);
    expect(n).toBeLessThanOrEqual(83 * 83);
  });

  it('follows the frame and fabric passed in the settings', () => {
    const base = settings({ image, crop: { cx: 0.5, cy: 0.5, zoom: 1 } });
    expect(stitchCount({ ...base, frameId: '40x40' })).toBeGreaterThan(stitchCount({ ...base, frameId: '20x20' }));
    expect(stitchCount({ ...base, count: 18 })).toBeGreaterThan(stitchCount({ ...base, count: 11 }));
  });

  it('turns cuadritos into whole hours at the hourly pace', () => {
    expect(hoursToStitch(0, 30)).toBe(0);
    expect(hoursToStitch(1, 30)).toBe(1);
    expect(hoursToStitch(30, 30)).toBe(1);
    expect(hoursToStitch(31, 30)).toBe(2);
    expect(hoursToStitch(5890, 30)).toBe(197);
    expect(hoursToStitch(5890, 60)).toBe(99);
  });

  it('formats hours in Spanish, singular for one', () => {
    expect(fmtHours(1)).toBe('≈ 1 hora');
    expect(fmtHours(205)).toBe('≈ 205 horas');
    expect(fmtHours(12345)).toBe('≈ 12.345 horas');
  });
});

describe('patternSummary', () => {
  const pattern = {
    cols: 10, rows: 10,
    palette: [
      { code: '310', count: 60 },
      { code: 'Blanc', count: 40 }
    ]
  };
  const meta = { frameLabel: '10 × 10', fabricLabel: 'Aida 14', count: 14, strands: 2 };

  it('totals stitches, colours and skeins (at least one per colour)', () => {
    expect(patternSummary(pattern, meta)).toEqual({ stitches: 100, colors: 2, skeins: 2 });
  });

  it('adds up multiple skeins for heavily used colours', () => {
    const per = stitchesPerSkein(14, 2);
    const big = { ...pattern, palette: [{ code: '310', count: per * 2 + 1 }] };
    expect(patternSummary(big, meta).skeins).toBe(3);
  });

  it('counts only stitched cells, not bare-fabric margin', () => {
    const framed = { ...pattern, cols: 20, rows: 10 }; // 100 stitches + 100 fabric cells
    expect(patternSummary(framed, meta).stitches).toBe(100);
  });

  it('renders a one-line description', () => {
    expect(summaryLine(pattern, meta)).toBe('Marco 10 × 10 cm · Aida 14 (2 hebras) · 10 × 10 puntos · 2 colores DMC · 2 madejas');
  });
});

describe('rgbaToRgb', () => {
  it('drops the alpha channel', () => {
    expect(Array.from(rgbaToRgb(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 0])))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
