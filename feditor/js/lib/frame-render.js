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

  // Edges overlap 0.5 px into the neighbouring corners on both ends. The
  // corners are drawn *after* the edges so they override the overlap; this
  // prevents sub-pixel antialiasing gaps on warped outputs without changing
  // the visible geometry.
  const OVER = 0.5;

  // Top edge: tile horizontally between corners.
  drawHorizontalEdge(ctx, stripBitmap, slice,
    ox + borderPx - OVER, oy,
    inner.w + 2 * OVER, borderPx, 'top');

  // Bottom edge.
  drawHorizontalEdge(ctx, stripBitmap, slice,
    ox + borderPx - OVER, oy + oh - borderPx,
    inner.w + 2 * OVER, borderPx, 'bottom');

  // Left edge.
  drawVerticalEdge(ctx, stripBitmap, slice,
    ox, oy + borderPx - OVER,
    borderPx, inner.h + 2 * OVER, 'left');

  // Right edge.
  drawVerticalEdge(ctx, stripBitmap, slice,
    ox + ow - borderPx, oy + borderPx - OVER,
    borderPx, inner.h + 2 * OVER, 'right');

  // Corners: pull each destination corner from its matching source corner
  // so the miter orientation lines up with the adjacent edge.
  drawCorner(ctx, stripBitmap, 0,          0,          slice, ox,                 oy,                 borderPx);
  drawCorner(ctx, stripBitmap, sw - slice, 0,          slice, ox + ow - borderPx, oy,                 borderPx);
  drawCorner(ctx, stripBitmap, 0,          sh - slice, slice, ox,                 oy + oh - borderPx, borderPx);
  drawCorner(ctx, stripBitmap, sw - slice, sh - slice, slice, ox + ow - borderPx, oy + oh - borderPx, borderPx);
}

function drawHorizontalEdge(ctx, strip, slice, dx, dy, dw, dh, side) {
  // Source: the middle horizontal band of the strip (avoid corners).
  const sw = strip.width;
  const sh = strip.height;
  const srcY = side === 'bottom' ? sh - slice : 0;
  const srcH = slice;
  const srcW = Math.max(1, sw - 2 * slice);
  const srcX = slice;

  // Match CSS `border-image-repeat: round`: pick an integer tile count that
  // fits the edge most closely, then stretch each tile to fit exactly. This
  // avoids a partial tail tile that would alpha-blend with the background.
  const scaleY = dh / srcH;
  const naturalTileW = srcW * scaleY;
  const count = Math.max(1, Math.round(dw / naturalTileW));
  const tileW = dw / count;
  for (let i = 0; i < count; i++) {
    ctx.drawImage(strip, srcX, srcY, srcW, srcH,
      dx + i * tileW, dy, tileW, dh);
  }
}

function drawVerticalEdge(ctx, strip, slice, dx, dy, dw, dh, side) {
  const sw = strip.width;
  const sh = strip.height;
  const srcX = side === 'right' ? sw - slice : 0;
  const srcW = slice;
  const srcH = Math.max(1, sh - 2 * slice);
  const srcY = slice;

  const scaleX = dw / srcW;
  const naturalTileH = srcH * scaleX;
  const count = Math.max(1, Math.round(dh / naturalTileH));
  const tileH = dh / count;
  for (let i = 0; i < count; i++) {
    ctx.drawImage(strip, srcX, srcY, srcW, srcH,
      dx, dy + i * tileH, dw, tileH);
  }
}

function drawCorner(ctx, strip, srcX, srcY, slice, dx, dy, size) {
  ctx.drawImage(strip, srcX, srcY, slice, slice, dx, dy, size, size);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
