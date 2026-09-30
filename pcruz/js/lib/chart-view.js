import { textColorFor } from './color.js';
import { FONT } from './chart-render.js';
import { FABRIC } from './constants.js';

// On-screen chart viewer. It redraws the visible stitches from the pattern
// itself on every pan/zoom instead of scaling a pre-rendered image, so it is
// sharp at any zoom and never allocates a huge bitmap.
//
// A view is { s, x, y }: CSS px per stitch and the viewport position of the
// chart's top-left corner.

export const MAX_VIEW_CELL_PX = 64;
// Below these sizes (CSS px per stitch) the detail would only be noise.
const SYMBOL_MIN_PX = 9;
const GRID_MIN_PX = 5;

/** Whole chart centred inside the viewport, `pad` px from its edges. */
export function fitView(cols, rows, vw, vh, pad) {
  const s = Math.min((vw - 2 * pad) / cols, (vh - 2 * pad) / rows);
  return { s, x: (vw - cols * s) / 2, y: (vh - rows * s) / 2 };
}

export function viewLimits(cols, rows, vw, vh, pad) {
  const min = fitView(cols, rows, vw, vh, pad).s;
  return { min, max: Math.max(min, MAX_VIEW_CELL_PX) };
}

/**
 * Zoom within limits; along each axis the chart is centred when it fits,
 * otherwise it can't be dragged further than `pad` past its edges.
 */
export function clampView(view, cols, rows, vw, vh, pad) {
  const { min, max } = viewLimits(cols, rows, vw, vh, pad);
  const s = clamp(view.s, min, max);
  return { s, x: clampAxis(view.x, cols * s, vw, pad), y: clampAxis(view.y, rows * s, vh, pad) };
}

function clampAxis(pos, size, viewport, pad) {
  if (size + 2 * pad <= viewport) return (viewport - size) / 2;
  return clamp(pos, viewport - pad - size, pad);
}

/** Scale by `factor` so the chart point under `from` ends up under `to`. */
export function transformView(view, factor, from, to) {
  return {
    s: view.s * factor,
    x: to.x - (from.x - view.x) * factor,
    y: to.y - (from.y - view.y) * factor
  };
}

/** Stitch columns [c0, c1) and rows [r0, r1) that intersect the viewport. */
export function visibleRange(view, cols, rows, vw, vh) {
  return {
    c0: clamp(Math.floor(-view.x / view.s), 0, cols),
    c1: clamp(Math.ceil((vw - view.x) / view.s), 0, cols),
    r0: clamp(Math.floor(-view.y / view.s), 0, rows),
    r1: clamp(Math.ceil((vh - view.y) / view.s), 0, rows)
  };
}

/**
 * colours: one pixel per stitch (exporters.previewCanvas), scaled up without
 * smoothing. Grid lines and symbols are added only once the stitches are
 * big enough to read, and only for the visible ones.
 */
export function drawChartView(ctx, pattern, colours, view, vw, vh, dpr) {
  const { cols, rows, palette, indices } = pattern;
  const { s, x, y } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  const { c0, c1, r0, r1 } = visibleRange(view, cols, rows, vw, vh);
  if (c1 <= c0 || r1 <= r0) return;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(colours, c0, r0, c1 - c0, r1 - r0, x + c0 * s, y + r0 * s, (c1 - c0) * s, (r1 - r0) * s);

  if (s >= SYMBOL_MIN_PX) {
    const inks = palette.map((e) => textColorFor(e.rgb));
    ctx.font = `600 ${Math.round(s * 0.66)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = r0; r < r1; r++) {
      const cy = y + (r + 0.5) * s + s * 0.03;
      for (let c = c0; c < c1; c++) {
        const idx = indices[r * cols + c];
        if (idx === FABRIC) continue;
        ctx.fillStyle = inks[idx];
        ctx.fillText(palette[idx].symbol, x + (c + 0.5) * s, cy);
      }
    }
  }

  if (s >= GRID_MIN_PX) {
    const lines = (step) => {
      ctx.beginPath();
      for (let c = Math.ceil(c0 / step) * step; c <= c1; c += step) {
        ctx.moveTo(x + c * s, y + r0 * s);
        ctx.lineTo(x + c * s, y + r1 * s);
      }
      for (let r = Math.ceil(r0 / step) * step; r <= r1; r += step) {
        ctx.moveTo(x + c0 * s, y + r * s);
        ctx.lineTo(x + c1 * s, y + r * s);
      }
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1 / dpr;
    lines(1);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = clamp(s / 10, 1, 4);
    lines(10);
  }

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, cols * s, rows * s);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
