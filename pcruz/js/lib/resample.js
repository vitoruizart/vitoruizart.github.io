/**
 * Area-average a region of an RGBA image into outW×outH cells (one per
 * stitch). Every source pixel contributes in proportion to how much of it
 * falls inside the cell, so the result is correct for both down- and
 * up-sampling and for fractional crop rects.
 *
 * src:  { width, height, data: RGBA bytes } (an ImageData or look-alike)
 * rect: { x, y, w, h } in source pixels
 * Returns Uint8Array of outW*outH*3 RGB bytes. Transparency is composited
 * over white. The rect may extend past the image: a cell that straddles the
 * edge averages only the pixels it covers, and a cell wholly outside takes
 * the nearest pixel (fabricMask marks those cells as unstitched anyway).
 */
export function resampleArea(src, rect, outW, outH) {
  const xSpans = spans(rect.x, rect.w, outW, src.width);
  const ySpans = spans(rect.y, rect.h, outH, src.height);
  const { data, width } = src;
  const out = new Uint8Array(outW * outH * 3);

  for (let cy = 0; cy < outH; cy++) {
    const ys = ySpans[cy];
    for (let cx = 0; cx < outW; cx++) {
      const xs = xSpans[cx];
      let r = 0, g = 0, b = 0, total = 0;
      for (let j = 0; j < ys.length; j += 2) {
        const rowOff = ys[j] * width;
        const wy = ys[j + 1];
        for (let i = 0; i < xs.length; i += 2) {
          const w = wy * xs[i + 1];
          const p = (rowOff + xs[i]) * 4;
          const a = data[p + 3] / 255;
          r += w * (data[p] * a + 255 * (1 - a));
          g += w * (data[p + 1] * a + 255 * (1 - a));
          b += w * (data[p + 2] * a + 255 * (1 - a));
          total += w;
        }
      }
      const o = (cy * outW + cx) * 3;
      out[o] = Math.round(r / total);
      out[o + 1] = Math.round(g / total);
      out[o + 2] = Math.round(b / total);
    }
  }
  return out;
}

/**
 * 1 for every cell whose centre falls outside the image: the frame extends
 * past the photo there and the stitcher leaves bare fabric. Deciding by the
 * centre keeps the photo's edge crisp instead of a row of half-blended cells.
 */
export function fabricMask(imgW, imgH, rect, outW, outH) {
  const inX = centresInside(rect.x, rect.w, outW, imgW);
  const inY = centresInside(rect.y, rect.h, outH, imgH);
  const mask = new Uint8Array(outW * outH);
  for (let cy = 0; cy < outH; cy++) {
    for (let cx = 0; cx < outW; cx++) {
      if (!inX[cx] || !inY[cy]) mask[cy * outW + cx] = 1;
    }
  }
  return mask;
}

/** How many cells fabricMask leaves stitched, without building the mask. */
export function stitchedCells(imgW, imgH, rect, outW, outH) {
  const count = (flags) => flags.reduce((n, f) => n + f, 0);
  return count(centresInside(rect.x, rect.w, outW, imgW)) * count(centresInside(rect.y, rect.h, outH, imgH));
}

// Per cell along one axis: 1 if its centre lies on the image.
function centresInside(start, length, count, limit) {
  const flags = new Uint8Array(count);
  for (let c = 0; c < count; c++) {
    const p = start + ((c + 0.5) * length) / count;
    flags[c] = p >= 0 && p < limit ? 1 : 0;
  }
  return flags;
}

// For each output cell along one axis: flat [pixelIndex, weight, ...] list
// of the source pixels it overlaps.
function spans(start, length, count, limit) {
  const step = length / count;
  const result = new Array(count);
  for (let c = 0; c < count; c++) {
    const a = start + c * step;
    const b = a + step;
    const list = [];
    const first = Math.max(0, Math.floor(a));
    const last = Math.min(limit - 1, Math.ceil(b) - 1);
    for (let p = first; p <= last; p++) {
      const w = Math.min(b, p + 1) - Math.max(a, p);
      if (w > 1e-9) list.push(p, w);
    }
    // Cell outside the image (or on its border through float noise): fall
    // back to the nearest pixel.
    if (list.length === 0) list.push(Math.min(limit - 1, Math.max(0, Math.floor(a))), 1);
    result[c] = list;
  }
  return result;
}
