import { describe, it, expect } from 'vitest';
import {
  FRAMES, FABRICS, DEFAULT_FRAME_ID, DEFAULT_COUNT,
  findFrame, findFabric, frameDims, stitchGrid, autoOrientation
} from '../../js/lib/frames.js';

describe('frames catalogue', () => {
  it('has unique ids and portrait-or-square dimensions', () => {
    const ids = FRAMES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FRAMES) {
      expect(f.w).toBeGreaterThan(0);
      expect(f.h).toBeGreaterThanOrEqual(f.w);
    }
  });

  it('includes the common photo frame sizes', () => {
    for (const id of ['10x15', '13x18', '20x25', '30x40', '40x50', '50x70', 'a4']) {
      expect(findFrame(id)).toBeTruthy();
    }
  });

  it('default frame and fabric exist', () => {
    expect(findFrame(DEFAULT_FRAME_ID)).toBeTruthy();
    expect(findFabric(DEFAULT_COUNT)).toBeTruthy();
    expect(DEFAULT_COUNT).toBe(14);
  });

  it('offers Aida 11/14/16/18 with a strand recommendation', () => {
    expect(FABRICS.map((f) => f.count)).toEqual([11, 14, 16, 18]);
    for (const f of FABRICS) expect(f.strands).toBeGreaterThanOrEqual(1);
  });

  it('returns null for unknown ids', () => {
    expect(findFrame('nope')).toBeNull();
    expect(findFabric(99)).toBeNull();
  });
});

describe('frameDims', () => {
  it('keeps portrait dimensions and swaps for landscape', () => {
    const f = findFrame('20x25');
    expect(frameDims(f, 'portrait')).toEqual({ wCm: 20, hCm: 25 });
    expect(frameDims(f, 'landscape')).toEqual({ wCm: 25, hCm: 20 });
  });
});

describe('stitchGrid', () => {
  it('converts 20×25 cm on Aida 14 into 110×138 stitches', () => {
    expect(stitchGrid(findFrame('20x25'), 14, 'portrait')).toEqual({ cols: 110, rows: 138 });
  });

  it('swaps cols/rows for landscape', () => {
    expect(stitchGrid(findFrame('20x25'), 14, 'landscape')).toEqual({ cols: 138, rows: 110 });
  });

  it('scales with the fabric count', () => {
    const f = findFrame('30x40');
    const g11 = stitchGrid(f, 11, 'portrait');
    const g18 = stitchGrid(f, 18, 'portrait');
    expect(g11).toEqual({ cols: 130, rows: 173 });
    expect(g18).toEqual({ cols: 213, rows: 283 });
  });

  it('never returns a zero-sized grid', () => {
    const g = stitchGrid({ id: 'tiny', w: 0.01, h: 0.01 }, 11, 'portrait');
    expect(g.cols).toBeGreaterThanOrEqual(1);
    expect(g.rows).toBeGreaterThanOrEqual(1);
  });
});

describe('autoOrientation', () => {
  it('picks landscape only for wider-than-tall images', () => {
    expect(autoOrientation(4000, 3000)).toBe('landscape');
    expect(autoOrientation(3000, 4000)).toBe('portrait');
    expect(autoOrientation(1000, 1000)).toBe('portrait');
  });
});
