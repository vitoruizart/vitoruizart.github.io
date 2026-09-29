// The crop is stored resolution-independently as { cx, cy, zoom }:
//   cx, cy — centre of the crop in normalised image coordinates (0..1)
//   zoom   — 1 = the largest rect with the frame's aspect that fits the image
// cropRect turns it into a source-pixel rect, always inside the image.

export const MAX_ZOOM = 6;

export function defaultCrop() {
  return { cx: 0.5, cy: 0.5, zoom: 1 };
}

export function cropRect(imgW, imgH, aspect, crop) {
  let baseW = imgW;
  let baseH = imgW / aspect;
  if (baseH > imgH) {
    baseH = imgH;
    baseW = imgH * aspect;
  }
  const zoom = clamp(num(crop?.zoom, 1), 1, MAX_ZOOM);
  const w = baseW / zoom;
  const h = baseH / zoom;
  const x = clamp(num(crop?.cx, 0.5) * imgW - w / 2, 0, imgW - w);
  const y = clamp(num(crop?.cy, 0.5) * imgH - h / 2, 0, imgH - h);
  return { x, y, w, h };
}

/** Crop whose centre matches the clamped rect, so panning never "sticks". */
export function normalizeCrop(imgW, imgH, aspect, crop) {
  const r = cropRect(imgW, imgH, aspect, crop);
  return {
    cx: (r.x + r.w / 2) / imgW,
    cy: (r.y + r.h / 2) / imgH,
    zoom: clamp(num(crop?.zoom, 1), 1, MAX_ZOOM)
  };
}

function num(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
