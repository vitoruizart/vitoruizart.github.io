import { PNG_PIXEL_BUDGET, MIN_CELL_PX, MAX_CELL_PX } from './constants.js';

// Legend column width, in text units (swatch + code + name + counts).
export const LEGEND_COL_UNITS = 18;
// Wide sheets get bigger text rather than a long, one-row legend.
const LEGEND_MAX_COLS = 4;

// PDF: A4 portrait rendered at 200 dpi. 20 px per stitch = 2.54 mm, the
// classic 10-squares-per-inch printed chart. A 70×100 tile plus its axis
// numbers fits inside 10 mm margins.
export const PDF = {
  pageW: 1654,
  pageH: 2339,
  widthPt: 595.28,
  heightPt: 841.89,
  margin: 79,
  headerH: 90,
  gutter: 40,
  cellPx: 20,
  pageCols: 70,
  pageRows: 100,
  legendUnit: 40
};

/** Pixels per stitch for the single-sheet PNG. */
export function pickCellPx(cols, rows) {
  const px = Math.floor(Math.sqrt(PNG_PIXEL_BUDGET / (cols * rows)));
  return Math.min(MAX_CELL_PX, Math.max(MIN_CELL_PX, px));
}

/**
 * Geometry of the single-sheet PNG: title, chart with axis numbers, legend
 * and footer, top to bottom. `unit` sizes margins and axis numbers (never
 * below 24 px); `textUnit` sizes title, legend and footer and grows with
 * the sheet width so they stay in proportion to a big chart.
 */
export function sheetLayout(cols, rows, paletteSize, cellPx) {
  const unit = Math.max(cellPx, 24);
  const margin = 2 * unit;
  const gutter = 2 * unit;
  const chartW = cols * cellPx;
  const chartH = rows * cellPx;
  const width = Math.ceil(margin * 2 + Math.max(gutter + chartW, LEGEND_COL_UNITS * unit, 30 * unit));
  const availW = width - 2 * margin;
  const textUnit = Math.max(unit, Math.floor(availW / (LEGEND_MAX_COLS * LEGEND_COL_UNITS)));

  const chart = { x: margin + gutter, y: margin + 3 * textUnit + gutter, w: chartW, h: chartH };
  const colW = LEGEND_COL_UNITS * textUnit;
  const rowH = Math.round(1.5 * textUnit);
  const { nCols, perCol } = legendGrid(paletteSize, availW, colW, LEGEND_MAX_COLS);
  const legend = { x: margin, y: chart.y + chartH + 2 * unit, unit: textUnit, colW, rowH, nCols, perCol };
  const footer = { x: margin, y: legend.y + rowH * (perCol + 1) + textUnit };
  const height = Math.ceil(footer.y + textUnit + margin);

  return { width, height, unit, textUnit, cellPx, margin, gutter, title: { x: margin, y: margin }, chart, legend, footer };
}

/** Columns × rows for n legend entries in the available width. */
export function legendGrid(n, availW, colW, maxCols = Infinity) {
  const nCols = Math.max(1, Math.min(n, maxCols, Math.floor(availW / colW)));
  return { nCols, perCol: Math.max(1, Math.ceil(n / nCols)) };
}

/** Split the chart into PDF page tiles, row by row. */
export function paginate(cols, rows, perCols = PDF.pageCols, perRows = PDF.pageRows) {
  const tiles = [];
  for (let row0 = 0; row0 < rows; row0 += perRows) {
    for (let col0 = 0; col0 < cols; col0 += perCols) {
      tiles.push({ col0, row0, cols: Math.min(perCols, cols - col0), rows: Math.min(perRows, rows - row0) });
    }
  }
  return tiles;
}

/** Grid-line indices (multiples of 10) within [start, start + count]. */
export function axisLabels(start, count) {
  const labels = [];
  for (let b = Math.ceil(start / 10) * 10; b <= start + count; b += 10) {
    if (b > 0) labels.push(b);
  }
  return labels;
}
