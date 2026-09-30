import { makeCanvas } from './image-io.js';
import { encodePng } from './png-encode.js';
import { buildPdf } from './pdf-writer.js';
import { deflate } from './zlib.js';
import { drawChart, drawLegend, FONT } from './chart-render.js';
import { sheetLayout, pickCellPx, paginate, legendGrid, PDF, LEGEND_COL_UNITS } from './layout.js';
import { skeinsNeeded } from './skeins.js';
import { FABRIC } from './constants.js';

// Rendering strips/pages is synchronous canvas work; yielding between them
// lets the progress text repaint.
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));
const fmtInt = (n) => n.toLocaleString('es-ES');

/**
 * Totals shown on screen, on the sheet and in the PDF.
 * meta: { frameLabel, orientationLabel, fabricLabel, count, strands }
 */
export function patternSummary(pattern, meta) {
  // Bare-fabric margin cells have no palette entry, so they are not counted.
  const stitches = pattern.palette.reduce((sum, e) => sum + e.count, 0);
  const skeins = pattern.palette.reduce((sum, e) => sum + skeinsNeeded(e.count, meta.count, meta.strands), 0);
  return { stitches, skeins, colors: pattern.palette.length };
}

export function summaryLine(pattern, meta) {
  const s = patternSummary(pattern, meta);
  return `Marco ${meta.frameLabel} cm · ${meta.fabricLabel} (${meta.strands} hebras) · ` +
    `${pattern.cols} × ${pattern.rows} puntos · ${s.colors} colores DMC · ${s.skeins} madejas`;
}

export function rgbaToRgb(rgba) {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let s = 0, d = 0; s < rgba.length; s += 4, d += 3) {
    rgb[d] = rgba[s];
    rgb[d + 1] = rgba[s + 1];
    rgb[d + 2] = rgba[s + 2];
  }
  return rgb;
}

/** Whole chart + legend on one lossless PNG, rendered in strips. */
export async function renderSheetPng(pattern, meta, onProgress) {
  const cellPx = pickCellPx(pattern.cols, pattern.rows);
  const L = sheetLayout(pattern.cols, pattern.rows, pattern.palette.length, cellPx);
  // ~4 MP per strip stays far below every browser's canvas limit.
  const stripH = Math.max(1, Math.min(512, Math.floor(4_000_000 / L.width)));
  const canvas = makeCanvas(L.width, stripH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const blob = await encodePng(L.width, L.height, async (y0, h) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, L.width, stripH);
    ctx.setTransform(1, 0, 0, 1, 0, -y0);
    drawSheet(ctx, pattern, meta, L, y0, y0 + h);
    const pixels = ctx.getImageData(0, 0, L.width, h).data;
    if (onProgress) onProgress((y0 + h) / L.height);
    await nextTick();
    return pixels;
  }, stripH);
  return { blob, width: L.width, height: L.height };
}

function drawSheet(ctx, pattern, meta, L, yMin, yMax) {
  const { unit, textUnit } = L;
  if (yMin < L.chart.y) {
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${Math.round(textUnit * 1.1)}px ${FONT}`;
    ctx.fillText('Patrón de punto de cruz', L.title.x, L.title.y + textUnit * 1.1);
    ctx.fillStyle = '#444';
    ctx.font = `${Math.round(textUnit * 0.62)}px ${FONT}`;
    ctx.fillText(summaryLine(pattern, meta), L.title.x, L.title.y + textUnit * 2.2);
  }
  drawChart(ctx, pattern, {
    x: L.chart.x, y: L.chart.y, cellPx: L.cellPx,
    labelPx: Math.round(unit * 0.55), gutter: L.gutter, yMin, yMax
  });
  if (yMax > L.legend.y) {
    drawLegend(ctx, pattern.palette, { ...L.legend, count: meta.count, strands: meta.strands });
  }
  if (yMax > L.footer.y) {
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(textUnit * 0.5)}px ${FONT}`;
    ctx.fillText(FOOTER, L.footer.x, L.footer.y + textUnit / 2);
  }
}

const FOOTER = '1 cuadro = 1 punto de cruz · Líneas gruesas cada 10 puntos · ' +
  'Flechas rojas: centro del diseño · Madejas DMC de 8 m (estimación) · Colores de pantalla aproximados';

/** A4 PDF: summary + page map, legend, then 70×100-stitch chart pages. */
export async function renderPdf(pattern, meta, onProgress) {
  const tiles = paginate(pattern.cols, pattern.rows);
  const total = tiles.length + 2;
  const canvas = makeCanvas(PDF.pageW, PDF.pageH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pages = [];

  const addPage = async (draw) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PDF.pageW, PDF.pageH);
    draw(ctx, pages.length + 1);
    const rgb = rgbaToRgb(ctx.getImageData(0, 0, PDF.pageW, PDF.pageH).data);
    const data = await deflate(rgb);
    pages.push({ widthPt: PDF.widthPt, heightPt: PDF.heightPt, image: { width: PDF.pageW, height: PDF.pageH, data } });
    if (onProgress) onProgress(pages.length, total);
    await nextTick();
  };

  await addPage((c, n) => drawSummaryPage(c, pattern, meta, tiles, n, total));
  await addPage((c, n) => drawLegendPage(c, pattern, meta, n, total));
  for (const tile of tiles) {
    await addPage((c, n) => drawTilePage(c, pattern, tile, n, total));
  }
  return { blob: buildPdf(pages), pages: total };
}

function pageHeader(ctx, title, pageNo, total, right) {
  const y = PDF.margin + 44;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(title, PDF.margin, y);
  ctx.textAlign = 'right';
  ctx.font = `28px ${FONT}`;
  ctx.fillStyle = '#444';
  ctx.fillText(right ? `${right} · Página ${pageNo} de ${total}` : `Página ${pageNo} de ${total}`, PDF.pageW - PDF.margin, y);
}

function drawSummaryPage(ctx, pattern, meta, tiles, pageNo, total) {
  pageHeader(ctx, 'Patrón de punto de cruz', pageNo, total);
  const s = patternSummary(pattern, meta);
  const lines = [
    `Marco: ${meta.frameLabel} cm (${meta.orientationLabel})`,
    `Tela: ${meta.fabricLabel} · ${meta.strands} hebras`,
    `Tamaño del patrón: ${pattern.cols} × ${pattern.rows} puntos (${fmtInt(s.stitches)} cuadritos a bordar)`,
    `Colores DMC: ${s.colors} · Madejas estimadas: ${s.skeins}`
  ];
  ctx.textAlign = 'left';
  ctx.fillStyle = '#222';
  ctx.font = `32px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, PDF.margin, PDF.margin + 130 + i * 48));

  // Colour preview of the whole design with the page grid on top.
  const top = PDF.margin + 360;
  const availW = PDF.pageW - 2 * PDF.margin;
  const availH = PDF.pageH - top - PDF.margin - 90;
  const scale = Math.min(availW / pattern.cols, availH / pattern.rows);
  const w = pattern.cols * scale;
  const h = pattern.rows * scale;
  const left = PDF.margin + (availW - w) / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(previewCanvas(pattern), left, top, w, h);
  ctx.imageSmoothingEnabled = true;

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 34px ${FONT}`;
  tiles.forEach((t, i) => {
    const tx = left + t.col0 * scale;
    const ty = top + t.row0 * scale;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(tx, ty, t.cols * scale, t.rows * scale);
    if (tiles.length > 1) {
      const label = `p. ${i + 3}`;
      const lw = ctx.measureText(label).width + 20;
      const cx = tx + (t.cols * scale) / 2;
      const cy = ty + (t.rows * scale) / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(cx - lw / 2, cy - 26, lw, 52);
      ctx.fillStyle = '#000';
      ctx.fillText(label, cx, cy + 2);
    }
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#444';
  ctx.font = `26px ${FONT}`;
  const pagesText = total > 3 ? `páginas 3 a ${total}` : 'página 3';
  ctx.fillText(`Leyenda en la página 2 · Patrón en ${pagesText}${tiles.length > 1 ? ' (cada recuadro es una página)' : ''}.`,
    PDF.margin, top + h + 50);
  ctx.fillText(FOOTER_SHORT, PDF.margin, top + h + 90);
}

const FOOTER_SHORT = 'Líneas gruesas cada 10 puntos · Flechas rojas: centro del diseño · Colores DMC aproximados';

function drawLegendPage(ctx, pattern, meta, pageNo, total) {
  pageHeader(ctx, 'Leyenda de colores DMC', pageNo, total);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#444';
  ctx.font = `28px ${FONT}`;
  ctx.fillText(`${meta.fabricLabel} · ${meta.strands} hebras · Madejas DMC de 8 m (estimación)`, PDF.margin, PDF.margin + 110);

  const unit = PDF.legendUnit;
  const colW = LEGEND_COL_UNITS * unit;
  const rowH = Math.round(1.5 * unit);
  const { nCols, perCol } = legendGrid(pattern.palette.length, PDF.pageW - 2 * PDF.margin, colW);
  drawLegend(ctx, pattern.palette, {
    x: PDF.margin, y: PDF.margin + 150, unit, colW, rowH, nCols, perCol,
    count: meta.count, strands: meta.strands
  });
}

function drawTilePage(ctx, pattern, tile, pageNo, total) {
  const range = `Columnas ${tile.col0 + 1}–${tile.col0 + tile.cols} · Filas ${tile.row0 + 1}–${tile.row0 + tile.rows}`;
  pageHeader(ctx, 'Patrón', pageNo, total, range);
  drawChart(ctx, pattern, {
    x: PDF.margin + PDF.gutter,
    y: PDF.margin + PDF.headerH + PDF.gutter,
    cellPx: PDF.cellPx,
    labelPx: 22,
    gutter: PDF.gutter,
    ...tile
  });
}

/** One pixel per stitch, in thread colours; bare fabric is white. */
export function previewCanvas(pattern) {
  const canvas = makeCanvas(pattern.cols, pattern.rows);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(pattern.cols, pattern.rows);
  const rgbs = pattern.palette.map((e) => e.rgb);
  for (let i = 0; i < pattern.indices.length; i++) {
    const idx = pattern.indices[i];
    const [r, g, b] = idx === FABRIC ? [255, 255, 255] : rgbs[idx];
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
