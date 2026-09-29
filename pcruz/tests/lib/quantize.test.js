import { describe, it, expect } from 'vitest';
import { buildPattern } from '../../js/lib/quantize.js';
import { DMC_COLORS } from '../../js/lib/dmc.js';
import { SYMBOLS } from '../../js/lib/symbols.js';

const byCode = (code) => DMC_COLORS.find((c) => c.code === code);

function cellsFrom(cols, rows, colorAt) {
  const cells = new Uint8Array(cols * rows * 3);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [r, g, b] = colorAt(x, y);
      const i = (y * cols + x) * 3;
      cells[i] = r; cells[i + 1] = g; cells[i + 2] = b;
    }
  }
  return cells;
}

function gradientCells(cols, rows) {
  return cellsFrom(cols, rows, (x, y) => [
    Math.round((x / (cols - 1)) * 255),
    Math.round((y / (rows - 1)) * 255),
    Math.round(((x + y) / (cols + rows - 2)) * 255)
  ]);
}

describe('DMC palette data', () => {
  it('has 489 unique codes with valid colours', () => {
    expect(DMC_COLORS).toHaveLength(489);
    expect(new Set(DMC_COLORS.map((c) => c.code)).size).toBe(489);
    for (const c of DMC_COLORS) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);
    }
  });

  it('contains every code used in the reference chart', () => {
    const codes = ['3799', '524', '522', '928', '372', '798', 'Blanc', '3731', '3774', '523',
      '422', '420', '799', '809', '800', '797', '869', '739', '503', '504', '502', '501', '950'];
    for (const code of codes) expect(byCode(code)).toBeTruthy();
  });
});

describe('buildPattern', () => {
  it('maps exact DMC colours to their own thread codes', () => {
    const colors = [byCode('310'), byCode('Blanc'), byCode('321')];
    const cells = cellsFrom(6, 3, (x) => colors[x % 3].rgb);
    const p = buildPattern(cells, 6, 3, 10);
    expect(p.palette.map((e) => e.code).sort()).toEqual(['310', '321', 'Blanc']);
  });

  it('maps pure white to B5200 (the only pure-white DMC)', () => {
    const p = buildPattern(cellsFrom(4, 4, () => [255, 255, 255]), 4, 4, 5);
    expect(p.palette).toHaveLength(1);
    expect(p.palette[0].code).toBe('B5200');
    expect(p.palette[0].count).toBe(16);
  });

  it('uses exactly maxColors when the image has enough distinct colours', () => {
    for (const k of [2, 8, 30]) {
      const p = buildPattern(gradientCells(60, 40), 60, 40, k);
      expect(p.palette).toHaveLength(k);
    }
  });

  it('merges near-duplicate background shades before a small, very different accent', () => {
    // 396 cells of textured beige (like painted canvas) plus a 4-cell red
    // spot (like lips): the texture shades must merge first.
    const cells = cellsFrom(20, 20, (x, y) => (x >= 9 && x <= 10 && y >= 9 && y <= 10
      ? [190, 20, 40]
      : [160 + ((x * 3) % 14), 150 + ((y * 5) % 14), 135 + (((x + y) * 2) % 12)]));
    const p = buildPattern(cells, 20, 20, 3);
    const spot = p.palette[p.indices[9 * 20 + 9]];
    expect(spot.rgb[0]).toBeGreaterThan(150);
    expect(spot.rgb[1]).toBeLessThan(80);
    expect(spot.count).toBe(4);
  });

  it('keeps the accent in a noisy image once the budget allows it', () => {
    const cells = cellsFrom(20, 20, (x, y) => (x >= 9 && x <= 10 && y >= 9 && y <= 10
      ? [190, 20, 40]
      : [150 + ((x * 5) % 40), 145 + ((y * 7) % 40), 130 + (((x + y) * 3) % 30)]));
    const p = buildPattern(cells, 20, 20, 8);
    expect(p.palette[p.indices[9 * 20 + 9]].code).toBe('817');
  });

  it('produces consistent indices and counts', () => {
    const cols = 50, rows = 30;
    const p = buildPattern(gradientCells(cols, rows), cols, rows, 12);
    expect(p.cols).toBe(cols);
    expect(p.rows).toBe(rows);
    expect(p.indices).toHaveLength(cols * rows);
    const counts = new Array(p.palette.length).fill(0);
    for (const idx of p.indices) {
      expect(idx).toBeLessThan(p.palette.length);
      counts[idx]++;
    }
    expect(counts).toEqual(p.palette.map((e) => e.count));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(cols * rows);
  });

  it('sorts the palette by usage and hands out symbols in order', () => {
    const p = buildPattern(gradientCells(40, 40), 40, 40, 10);
    for (let i = 1; i < p.palette.length; i++) {
      expect(p.palette[i - 1].count).toBeGreaterThanOrEqual(p.palette[i].count);
    }
    expect(p.palette.map((e) => e.symbol)).toEqual(SYMBOLS.slice(0, p.palette.length));
  });

  it('has no duplicate DMC codes and no unused entries', () => {
    const p = buildPattern(gradientCells(80, 60), 80, 60, 30);
    const codes = p.palette.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const e of p.palette) expect(e.count).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', () => {
    const cells = gradientCells(70, 50);
    const a = buildPattern(cells, 70, 50, 15);
    const b = buildPattern(cells, 70, 50, 15);
    expect(a.palette.map((e) => e.code)).toEqual(b.palette.map((e) => e.code));
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });

  it('keeps clearly different regions in different threads', () => {
    // Left half red, right half blue, with slight noise.
    const cells = cellsFrom(20, 10, (x, y) => (x < 10
      ? [200 + ((x * 7 + y) % 5), 30, 40]
      : [30, 40, 180 + ((x + y * 3) % 5)]));
    const p = buildPattern(cells, 20, 10, 2);
    expect(p.palette).toHaveLength(2);
    expect(p.indices[0]).not.toBe(p.indices[19]);
  });
});
