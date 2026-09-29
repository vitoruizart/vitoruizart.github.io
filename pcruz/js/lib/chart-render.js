import { textColorFor } from './color.js';
import { axisLabels } from './layout.js';
import { skeinsNeeded } from './skeins.js';

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const CENTER_MARK = '#c0392b';

/**
 * Draw a rectangular region of the pattern with its grid and axis numbers.
 *
 * region: { col0, row0, cols, rows } in stitches (defaults to the whole chart)
 * x, y:   top-left pixel of the region's first cell
 * yMin/yMax: only rows intersecting this pixel band are drawn — the PNG is
 *            rendered in strips and must not redraw the whole chart for each.
 * labelPx: font size for the axis numbers; gutter: space reserved for them.
 */
export function drawChart(ctx, pattern, {
  x, y, cellPx, labelPx, gutter,
  col0 = 0, row0 = 0, cols = pattern.cols, rows = pattern.rows,
  yMin = -Infinity, yMax = Infinity
}) {
  const { palette, indices } = pattern;
  const rStart = Math.max(0, Math.floor((yMin - y) / cellPx));
  const rEnd = Math.min(rows, Math.ceil((yMax - y) / cellPx));

  if (rEnd > rStart) {
    // Cell fills, merging same-colour runs along each row.
    for (let r = rStart; r < rEnd; r++) {
      const base = (row0 + r) * pattern.cols + col0;
      let c = 0;
      while (c < cols) {
        const idx = indices[base + c];
        let end = c + 1;
        while (end < cols && indices[base + end] === idx) end++;
        ctx.fillStyle = palette[idx].hex;
        ctx.fillRect(x + c * cellPx, y + r * cellPx, (end - c) * cellPx, cellPx);
        c = end;
      }
    }

    // Symbols.
    const inks = palette.map((e) => textColorFor(e.rgb));
    ctx.font = `600 ${Math.round(cellPx * 0.66)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = rStart; r < rEnd; r++) {
      const base = (row0 + r) * pattern.cols + col0;
      const cy = y + r * cellPx + cellPx / 2 + cellPx * 0.03;
      for (let c = 0; c < cols; c++) {
        const idx = indices[base + c];
        ctx.fillStyle = inks[idx];
        ctx.fillText(palette[idx].symbol, x + c * cellPx + cellPx / 2, cy);
      }
    }

    drawGrid(ctx, { x, y, cellPx, col0, row0, cols, rStart, rEnd });
  }

  // Outer border.
  const bold = Math.max(2, Math.round(cellPx / 8));
  ctx.strokeStyle = '#000';
  ctx.lineWidth = bold;
  ctx.strokeRect(x, y, cols * cellPx, rows * cellPx);

  drawAxes(ctx, pattern, { x, y, cellPx, labelPx, gutter, col0, row0, cols, rows });
}

function drawGrid(ctx, { x, y, cellPx, col0, row0, cols, rStart, rEnd }) {
  const thin = Math.max(1, Math.round(cellPx / 20));
  const bold = Math.max(2, Math.round(cellPx / 8));
  const top = y + rStart * cellPx;
  const bottom = y + rEnd * cellPx;
  const left = x;
  const right = x + cols * cellPx;

  const lines = (isBold) => {
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      if (((col0 + c) % 10 === 0) !== isBold) continue;
      const px = x + c * cellPx;
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
    }
    for (let r = rStart; r <= rEnd; r++) {
      if (((row0 + r) % 10 === 0) !== isBold) continue;
      const py = y + r * cellPx;
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
    }
    ctx.stroke();
  };

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = thin;
  lines(false);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = bold;
  lines(true);
}

function drawAxes(ctx, pattern, { x, y, cellPx, labelPx, gutter, col0, row0, cols, rows }) {
  ctx.fillStyle = '#222';
  ctx.font = `${labelPx}px ${FONT}`;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const b of axisLabels(col0, cols)) {
    ctx.fillText(String(b), x + (b - col0) * cellPx, y - gutter * 0.3);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const b of axisLabels(row0, rows)) {
    ctx.fillText(String(b), x - gutter * 0.2, y + (b - row0) * cellPx);
  }

  // Centre arrows: stitchers start from the middle of the fabric.
  const size = gutter * 0.28;
  ctx.fillStyle = CENTER_MARK;
  const cCol = pattern.cols / 2;
  if (cCol >= col0 && cCol <= col0 + cols) {
    const cx = x + (cCol - col0) * cellPx;
    const tip = y - 3;
    ctx.beginPath();
    ctx.moveTo(cx, tip);
    ctx.lineTo(cx - size, tip - size * 1.4);
    ctx.lineTo(cx + size, tip - size * 1.4);
    ctx.fill();
  }
  const cRow = pattern.rows / 2;
  if (cRow >= row0 && cRow <= row0 + rows) {
    const cy = y + (cRow - row0) * cellPx;
    const tip = x - 3;
    ctx.beginPath();
    ctx.moveTo(tip, cy);
    ctx.lineTo(tip - size * 1.4, cy - size);
    ctx.lineTo(tip - size * 1.4, cy + size);
    ctx.fill();
  }
}

/**
 * Legend table: symbol swatch, DMC code, name, stitches, skeins.
 * Entries flow top-to-bottom, then into the next column.
 */
export function drawLegend(ctx, palette, { x, y, unit, colW, rowH, nCols, perCol, count, strands }) {
  const font = Math.round(unit * 0.6);
  const cols = {
    swatch: 0,
    code: 1.7 * unit,
    name: 4.4 * unit,
    stitches: 15.4 * unit,
    skeins: 17.3 * unit
  };
  ctx.textBaseline = 'middle';

  for (let col = 0; col < nCols; col++) {
    const cx = x + col * colW;
    const hy = y + rowH / 2;
    ctx.fillStyle = '#555';
    ctx.font = `600 ${Math.round(font * 0.85)}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('DMC', cx + cols.code, hy);
    ctx.fillText('Nombre', cx + cols.name, hy);
    ctx.textAlign = 'right';
    ctx.fillText('Puntos', cx + cols.stitches, hy);
    ctx.fillText('Mad.', cx + cols.skeins, hy);
  }

  palette.forEach((e, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const cx = x + col * colW;
    const top = y + (row + 1) * rowH;
    const mid = top + rowH / 2;
    const sw = Math.round(rowH * 0.78);

    ctx.fillStyle = e.hex;
    ctx.fillRect(cx, mid - sw / 2, sw * 1.25, sw);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, mid - sw / 2 + 0.5, sw * 1.25 - 1, sw - 1);
    ctx.fillStyle = textColorFor(e.rgb);
    ctx.font = `600 ${Math.round(sw * 0.72)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(e.symbol, cx + (sw * 1.25) / 2, mid + sw * 0.03);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.font = `700 ${font}px ${FONT}`;
    ctx.fillText(e.code, cx + cols.code, mid);
    ctx.font = `${font}px ${FONT}`;
    ctx.fillText(fitText(ctx, e.name, cols.stitches - cols.name - 2.6 * unit), cx + cols.name, mid);
    ctx.textAlign = 'right';
    ctx.fillText(e.count.toLocaleString('es-ES'), cx + cols.stitches, mid);
    ctx.fillText(String(skeinsNeeded(e.count, count, strands)), cx + cols.skeins, mid);
  });
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
