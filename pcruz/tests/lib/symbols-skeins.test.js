import { describe, it, expect } from 'vitest';
import { SYMBOLS } from '../../js/lib/symbols.js';
import { stitchesPerSkein, skeinsNeeded } from '../../js/lib/skeins.js';
import { MAX_COLORS } from '../../js/lib/constants.js';

describe('SYMBOLS', () => {
  it('has a unique single-character symbol for every allowed colour', () => {
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(MAX_COLORS);
    expect(new Set(SYMBOLS).size).toBe(SYMBOLS.length);
    for (const s of SYMBOLS) expect([...s].length).toBe(1);
  });

  it('avoids characters that are easy to confuse on a chart', () => {
    for (const bad of ['0', 'O', 'o', 'I', 'l', '|', '1']) {
      expect(SYMBOLS).not.toContain(bad);
    }
  });
});

describe('skeins', () => {
  it('estimates roughly 2000 full stitches per skein on Aida 14 with 2 strands', () => {
    const n = stitchesPerSkein(14, 2);
    expect(n).toBeGreaterThan(1600);
    expect(n).toBeLessThan(2600);
  });

  it('gets more stitches per skein on finer fabric and fewer with more strands', () => {
    expect(stitchesPerSkein(18, 2)).toBeGreaterThan(stitchesPerSkein(14, 2));
    expect(stitchesPerSkein(11, 3)).toBeLessThan(stitchesPerSkein(11, 2));
  });

  it('rounds skeins up and returns 0 for unused colours', () => {
    const per = stitchesPerSkein(14, 2);
    expect(skeinsNeeded(0, 14, 2)).toBe(0);
    expect(skeinsNeeded(1, 14, 2)).toBe(1);
    expect(skeinsNeeded(per, 14, 2)).toBe(1);
    expect(skeinsNeeded(per + 1, 14, 2)).toBe(2);
  });
});
