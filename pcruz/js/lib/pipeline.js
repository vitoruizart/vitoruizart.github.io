import { findFrame, findFabric, frameDims, stitchGrid } from './frames.js';
import { cropRect } from './crop.js';
import { resampleArea, fabricMask, stitchedCells } from './resample.js';
import { buildPattern } from './quantize.js';
import { bitmapPixels } from './image-io.js';

// The photo's pixels and the per-stitch colours are the slow parts; both are
// cached so moving the colour slider only re-runs the quantizer.
let pixelsCache = { bitmap: null, pixels: null };
let cellsCache = { key: null, cells: null, fabric: null };
let patternCache = { key: null, pattern: null };

export function gridFor(state) {
  return stitchGrid(findFrame(state.frameId), state.count, state.orientation);
}

/** Crop aspect = the stitch grid's, so stitches stay square. */
export function aspectFor(state) {
  const { cols, rows } = gridFor(state);
  return cols / rows;
}

export function metaFor(state) {
  const frame = findFrame(state.frameId);
  const fabric = findFabric(state.count);
  const { wCm, hCm } = frameDims(frame, state.orientation);
  let orientationLabel = state.orientation === 'landscape' ? 'horizontal' : 'vertical';
  if (frame.w === frame.h) orientationLabel = 'cuadrado';
  return {
    frameLabel: `${fmtCm(wCm)} × ${fmtCm(hCm)}`,
    orientationLabel,
    fabricLabel: fabric.label,
    count: fabric.count,
    strands: fabric.strands
  };
}

export function fmtCm(v) {
  return String(v).replace('.', ',');
}

/**
 * Stitches the design will have with the current framing: one per cell over
 * the photo (the white margin is bare fabric). Geometry only, so it is cheap
 * enough to run for every frame size before the pattern exists.
 */
export function stitchCount(state) {
  const { image } = state;
  const { cols, rows } = gridFor(state);
  const rect = cropRect(image.w, image.h, cols / rows, state.crop);
  return stitchedCells(image.w, image.h, rect, cols, rows);
}

/** Whole hours to stitch `stitches` cuadritos at `perHour` an hour. */
export function hoursToStitch(stitches, perHour) {
  return Math.ceil(stitches / perHour);
}

export function fmtHours(hours) {
  return `≈ ${hours.toLocaleString('es-ES')} ${hours === 1 ? 'hora' : 'horas'}`;
}

export function computePattern(state) {
  const { image } = state;
  const { cols, rows } = gridFor(state);
  const rect = cropRect(image.w, image.h, cols / rows, state.crop);

  if (pixelsCache.bitmap !== image.bitmap) {
    pixelsCache = { bitmap: image.bitmap, pixels: bitmapPixels(image.bitmap) };
    cellsCache = { key: null, cells: null, fabric: null };
    patternCache = { key: null, pattern: null };
  }
  const cellsKey = [cols, rows, rect.x, rect.y, rect.w, rect.h].join('|');
  if (cellsCache.key !== cellsKey) {
    cellsCache = {
      key: cellsKey,
      cells: resampleArea(pixelsCache.pixels, rect, cols, rows),
      fabric: fabricMask(image.w, image.h, rect, cols, rows)
    };
  }
  const patternKey = cellsKey + '|' + state.maxColors;
  if (patternCache.key !== patternKey) {
    patternCache = {
      key: patternKey,
      pattern: buildPattern(cellsCache.cells, cols, rows, state.maxColors, { fabric: cellsCache.fabric })
    };
  }
  return patternCache.pattern;
}
