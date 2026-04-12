/**
 * Render a 9-slice frame around an inner rect on a 2D canvas context.
 *
 * frame: { stripBitmap, sliceWidth, borderPx }
 *   - stripBitmap: ImageBitmap of the frame edge texture (rectangular strip)
 *   - sliceWidth:  fraction (0..0.5) of the strip's shorter edge to use as the slice
 *   - borderPx:    thickness of the frame on the rendered output, in canvas pixels
 *
 * inner: { x, y, w, h } — the painting rect; the frame surrounds it and extends outward.
 *
 * The strip is treated as an edge texture: we extract its center band and tile
 * it along the four edges (mirror-tiled to look seamless), then place a corner
 * crop at each of the four corners.
 */

export function drawFrame(ctx, frame, inner) {
  const { stripBitmap, borderPx } = frame;
  if (!stripBitmap || borderPx <= 0) return;

  const sw = stripBitmap.width;
  const sh = stripBitmap.height;
  const sliceFrac = clamp01(frame.sliceWidth || 0.25);
  const sliceShort = Math.min(sw, sh);
  const slice = Math.max(2, Math.round(sliceShort * sliceFrac));

  const ox = inner.x - borderPx;
  const oy = inner.y - borderPx;
  const ow = inner.w + 2 * borderPx;
  const oh = inner.h + 2 * borderPx;

  // Top edge: tile horizontally between corners.
  drawHorizontalEdge(ctx, stripBitmap, slice,
    ox + borderPx, oy,
    inner.w, borderPx, 'top');

  // Bottom edge.
  drawHorizontalEdge(ctx, stripBitmap, slice,
    ox + borderPx, oy + oh - borderPx,
    inner.w, borderPx, 'bottom');

  // Left edge.
  drawVerticalEdge(ctx, stripBitmap, slice,
    ox, oy + borderPx,
    borderPx, inner.h, 'left');

  // Right edge.
  drawVerticalEdge(ctx, stripBitmap, slice,
    ox + ow - borderPx, oy + borderPx,
    borderPx, inner.h, 'right');

  // Corners: use a square crop from the strip end, drawn at each corner.
  drawCorner(ctx, stripBitmap, slice, ox, oy, borderPx);
  drawCorner(ctx, stripBitmap, slice, ox + ow - borderPx, oy, borderPx);
  drawCorner(ctx, stripBitmap, slice, ox, oy + oh - borderPx, borderPx);
  drawCorner(ctx, stripBitmap, slice, ox + ow - borderPx, oy + oh - borderPx, borderPx);
}

function drawHorizontalEdge(ctx, strip, slice, dx, dy, dw, dh, side) {
  // Source: the middle horizontal band of the strip (avoid corners).
  const sw = strip.width;
  const sh = strip.height;
  const srcY = side === 'bottom' ? sh - slice : 0;
  const srcH = slice;
  const srcW = Math.max(1, sw - 2 * slice);
  const srcX = slice;

  const tilePxOnTarget = dh; // edge thickness drives the natural tile height
  const scaleY = tilePxOnTarget / srcH;
  const tileW = srcW * scaleY;
  let drawn = 0;
  while (drawn < dw) {
    const remain = dw - drawn;
    const useW = Math.min(tileW, remain);
    const useSrcW = useW / scaleY;
    ctx.drawImage(strip, srcX, srcY, useSrcW, srcH,
      dx + drawn, dy, useW, dh);
    drawn += useW;
  }
}

function drawVerticalEdge(ctx, strip, slice, dx, dy, dw, dh, side) {
  const sw = strip.width;
  const sh = strip.height;
  const srcX = side === 'right' ? sw - slice : 0;
  const srcW = slice;
  const srcH = Math.max(1, sh - 2 * slice);
  const srcY = slice;

  const tilePxOnTarget = dw;
  const scaleX = tilePxOnTarget / srcW;
  const tileH = srcH * scaleX;
  let drawn = 0;
  while (drawn < dh) {
    const remain = dh - drawn;
    const useH = Math.min(tileH, remain);
    const useSrcH = useH / scaleX;
    ctx.drawImage(strip, srcX, srcY, srcW, useSrcH,
      dx, dy + drawn, dw, useH);
    drawn += useH;
  }
}

function drawCorner(ctx, strip, slice, dx, dy, size) {
  ctx.drawImage(strip, 0, 0, slice, slice, dx, dy, size, size);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
