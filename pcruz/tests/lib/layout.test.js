import { describe, it, expect } from 'vitest';
import { pickCellPx, sheetLayout, paginate, axisLabels, legendGrid, PDF, LEGEND_COL_UNITS } from '../../js/lib/layout.js';
import { PNG_PIXEL_BUDGET, MIN_CELL_PX, MAX_CELL_PX, MAX_COLORS } from '../../js/lib/constants.js';

describe('pickCellPx', () => {
  it('uses the maximum cell size for typical frames', () => {
    expect(pickCellPx(110, 138)).toBe(MAX_CELL_PX); // 20×25 cm on Aida 14
  });

  it('shrinks cells for big patterns but never below the legibility floor', () => {
    const px = pickCellPx(220, 330); // 40×60 cm on Aida 14
    expect(px).toBeLessThan(MAX_CELL_PX);
    expect(px).toBeGreaterThanOrEqual(MIN_CELL_PX);
    expect(pickCellPx(354, 496)).toBe(MIN_CELL_PX); // 50×70 cm on Aida 18
  });

  it('keeps the chart area within the pixel budget when not at the floor', () => {
    const px = pickCellPx(220, 330);
    expect(220 * 330 * px * px).toBeLessThanOrEqual(PNG_PIXEL_BUDGET);
  });
});

describe('sheetLayout', () => {
  it('places the chart below the title and the legend below the chart', () => {
    const l = sheetLayout(110, 138, 20, 32);
    expect(l.chart.w).toBe(110 * 32);
    expect(l.chart.h).toBe(138 * 32);
    expect(l.chart.y).toBeGreaterThan(l.title.y);
    expect(l.legend.y).toBeGreaterThan(l.chart.y + l.chart.h);
    expect(l.footer.y).toBeGreaterThan(l.legend.y);
    expect(l.height).toBeGreaterThan(l.footer.y);
  });

  it('fits everything inside the sheet width', () => {
    for (const [cols, rows, n] of [[110, 138, 20], [20, 30, 60], [354, 496, 60]]) {
      const l = sheetLayout(cols, rows, n, pickCellPx(cols, rows));
      expect(l.chart.x + l.chart.w).toBeLessThanOrEqual(l.width);
      expect(l.legend.x + l.legend.nCols * l.legend.colW).toBeLessThanOrEqual(l.width);
      expect(l.legend.nCols * l.legend.perCol).toBeGreaterThanOrEqual(n);
      expect(Number.isInteger(l.width) && Number.isInteger(l.height)).toBe(true);
    }
  });

  it('caps the legend at 4 columns and scales its text with the sheet width', () => {
    const l = sheetLayout(110, 138, 60, 32);
    expect(l.legend.nCols).toBeLessThanOrEqual(4);
    expect(l.legend.unit).toBe(l.textUnit);
    expect(l.textUnit).toBeGreaterThanOrEqual(l.unit);
    expect(l.legend.nCols * l.legend.colW).toBeLessThanOrEqual(l.width - 2 * l.margin);
  });

  it('leaves room for axis numbers above and left of the chart', () => {
    const l = sheetLayout(50, 50, 5, 32);
    expect(l.chart.x - l.gutter).toBeGreaterThanOrEqual(l.margin);
    expect(l.chart.y - l.gutter).toBeGreaterThan(l.title.y);
  });
});

describe('paginate', () => {
  it('covers every stitch exactly once', () => {
    const cols = 213, rows = 283;
    const tiles = paginate(cols, rows);
    const seen = new Uint8Array(cols * rows);
    for (const t of tiles) {
      for (let r = t.row0; r < t.row0 + t.rows; r++) {
        for (let c = t.col0; c < t.col0 + t.cols; c++) seen[r * cols + c]++;
      }
    }
    expect(seen.every((v) => v === 1)).toBe(true);
    expect(tiles).toHaveLength(Math.ceil(cols / PDF.pageCols) * Math.ceil(rows / PDF.pageRows));
  });

  it('starts every tile on a 10-stitch line and orders tiles row by row', () => {
    const tiles = paginate(150, 250);
    for (const t of tiles) {
      expect(t.col0 % 10).toBe(0);
      expect(t.row0 % 10).toBe(0);
    }
    expect(tiles.map((t) => [t.row0, t.col0])).toEqual([
      [0, 0], [0, 70], [0, 140], [100, 0], [100, 70], [100, 140], [200, 0], [200, 70], [200, 140]
    ]);
  });

  it('uses a single tile for a small pattern', () => {
    expect(paginate(55, 83)).toEqual([{ col0: 0, row0: 0, cols: 55, rows: 83 }]);
  });

  it('fits a full tile inside the A4 page', () => {
    const right = PDF.margin + PDF.gutter + PDF.pageCols * PDF.cellPx;
    const bottom = PDF.margin + PDF.headerH + PDF.gutter + PDF.pageRows * PDF.cellPx;
    expect(right).toBeLessThanOrEqual(PDF.pageW - PDF.margin);
    expect(bottom).toBeLessThanOrEqual(PDF.pageH - PDF.margin);
  });
});

describe('axisLabels', () => {
  it('labels every 10th line inside the range, including the start edge', () => {
    expect(axisLabels(0, 35)).toEqual([10, 20, 30]);
    expect(axisLabels(70, 70)).toEqual([70, 80, 90, 100, 110, 120, 130, 140]);
    expect(axisLabels(0, 9)).toEqual([]);
  });
});

describe('PDF legend page', () => {
  it('fits the maximum number of colours on one A4 page', () => {
    const colW = LEGEND_COL_UNITS * PDF.legendUnit;
    const rowH = Math.round(1.5 * PDF.legendUnit);
    const { nCols, perCol } = legendGrid(MAX_COLORS, PDF.pageW - 2 * PDF.margin, colW);
    expect(nCols * colW).toBeLessThanOrEqual(PDF.pageW - 2 * PDF.margin);
    // Legend starts 150 px below the top margin (header + subtitle).
    expect(PDF.margin + 150 + rowH * (perCol + 1)).toBeLessThanOrEqual(PDF.pageH - PDF.margin);
  });
});

describe('legendGrid', () => {
  it('uses as many columns as fit and enough rows for every entry', () => {
    const g = legendGrid(60, 1500, 400);
    expect(g.nCols).toBe(3);
    expect(g.perCol).toBe(20);
  });

  it('respects a column cap', () => {
    expect(legendGrid(60, 5000, 400, 4)).toEqual({ nCols: 4, perCol: 15 });
  });

  it('always has at least one column', () => {
    const g = legendGrid(5, 100, 400);
    expect(g.nCols).toBe(1);
    expect(g.perCol).toBe(5);
  });
});
