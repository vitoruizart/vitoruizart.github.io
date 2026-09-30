// The crop is stored resolution-independently as { cx, cy, zoom }:
//   cx, cy — centre of the frame in normalised image coordinates (0..1),
//            kept inside the image so the frame always shows some of it
//   zoom   — 1 = the smallest frame-shaped rect that holds the whole image;
//            above 1 crops into the image, below 1 adds a margin around it
// The frame may extend past the image: that area is left as bare fabric.
// cropRect turns it into a rect in source pixels.

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 10;
// Whole image with a ~5 % white margin on its tightest side.
export const DEFAULT_ZOOM = 0.9;

export function defaultCrop() {
  return { cx: 0.5, cy: 0.5, zoom: DEFAULT_ZOOM };
}

export function cropRect(imgW, imgH, aspect, crop) {
  const { cx, cy, zoom } = normalizeCrop(crop);
  const base = containSize(imgW, imgH, aspect);
  const w = base.w / zoom;
  const h = base.h / zoom;
  return { x: cx * imgW - w / 2, y: cy * imgH - h / 2, w, h };
}

export function normalizeCrop(crop) {
  const d = defaultCrop();
  return {
    cx: clamp(num(crop?.cx, d.cx), 0, 1),
    cy: clamp(num(crop?.cy, d.cy), 0, 1),
    zoom: clamp(num(crop?.zoom, d.zoom), MIN_ZOOM, MAX_ZOOM)
  };
}

/** Frame filled edge to edge by the image (the old "cover" crop). */
export function fillCrop(imgW, imgH, aspect) {
  const base = containSize(imgW, imgH, aspect);
  const coverH = imgW / imgH > aspect ? imgH : imgW / aspect;
  return normalizeCrop({ cx: 0.5, cy: 0.5, zoom: base.h / coverH });
}

/**
 * Resize by dragging one corner while the opposite one stays put. The new
 * corner is the point on the frame's diagonal closest to `pt` (source px),
 * so the aspect stays locked however the finger moves.
 * corner: { sx, sy } — ±1, which corner (−1 = left / top).
 * minH:   smallest allowed frame height in source px (keeps handles apart).
 */
export function resizeCrop(imgW, imgH, aspect, crop, corner, pt, minH = 0) {
  const r = cropRect(imgW, imgH, aspect, crop);
  const { sx, sy } = corner;
  const ax = sx > 0 ? r.x : r.x + r.w;
  const ay = sy > 0 ? r.y : r.y + r.h;
  const base = containSize(imgW, imgH, aspect);
  const along = ((pt.x - ax) * sx * aspect + (pt.y - ay) * sy) / (aspect * aspect + 1);
  const h = clamp(along, Math.max(minH, base.h / MAX_ZOOM), base.h / MIN_ZOOM);
  const w = h * aspect;
  return normalizeCrop({ cx: (ax + (sx * w) / 2) / imgW, cy: (ay + (sy * h) / 2) / imgH, zoom: base.h / h });
}

/**
 * What a touch at `pt` grabs on the on-screen frame rect: the nearest
 * corner within `radius`, else the frame itself (to move it), else nothing.
 */
export function pickHandle(frame, pt, radius) {
  let best = null;
  let bestD = radius;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const d = Math.hypot(pt.x - (sx < 0 ? frame.x : frame.x + frame.w), pt.y - (sy < 0 ? frame.y : frame.y + frame.h));
      if (d <= bestD) { bestD = d; best = { type: 'corner', sx, sy }; }
    }
  }
  if (best) return best;
  const inside = pt.x >= frame.x && pt.x <= frame.x + frame.w && pt.y >= frame.y && pt.y <= frame.y + frame.h;
  return inside ? { type: 'move' } : null;
}

/**
 * Stage transform (source px → CSS px: { s, x, y }) showing both the image
 * and the frame `rect`, `pad` px in from the stage edges so a corner can
 * still be dragged outwards.
 */
export function stageView(imgW, imgH, rect, stageW, stageH, pad) {
  const x0 = Math.min(0, rect.x);
  const y0 = Math.min(0, rect.y);
  const w = Math.max(imgW, rect.x + rect.w) - x0;
  const h = Math.max(imgH, rect.y + rect.h) - y0;
  const s = Math.min(Math.max(1, stageW - 2 * pad) / w, Math.max(1, stageH - 2 * pad) / h);
  return { s, x: (stageW - w * s) / 2 - x0 * s, y: (stageH - h * s) / 2 - y0 * s };
}

function containSize(imgW, imgH, aspect) {
  return imgW / imgH > aspect ? { w: imgW, h: imgW / aspect } : { w: imgH * aspect, h: imgH };
}

function num(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
