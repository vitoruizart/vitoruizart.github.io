import { paintingRect, projectCorners } from './transform.js';
import { drawFrame } from './frame-render.js';
import { makeCanvas, bitmapToBlob, loadBitmap } from './image-io.js';

/**
 * Compose the final image as a lossless PNG Blob. Branches on room.kind:
 *   - 'none': painting + frame on transparent canvas, no warp.
 *   - 'mat':  painting + frame centered in a solid-color canvas with
 *             configurable horizontal/vertical padding, no warp.
 *   - 'bundled' | 'user': painting + frame warped onto the room photo.
 *
 * Originals (painting and photo room) are re-decoded at native resolution
 * here so that downscaled editor bitmaps don't bottleneck output quality.
 */
export async function composeFinal({ room, painting, frame, placement, frameBorderFrac, paintingBlob, roomBlob }) {
  const kind = room.kind;
  if (kind === 'mat' || kind === 'none') {
    return await composeFlat({ room, frame, frameBorderFrac, paintingBlob });
  }
  return await composePhoto({ painting, frame, placement, frameBorderFrac, paintingBlob, roomBlob });
}

async function composeFlat({ room, frame, frameBorderFrac, paintingBlob }) {
  const paintBitmap = await loadBitmap(paintingBlob);
  const paintW = paintBitmap.width;
  const paintH = paintBitmap.height;
  const minSide = Math.min(paintW, paintH);
  const borderPx = frame && frame.stripBitmap ? Math.round((frameBorderFrac || 0) * minSide) : 0;
  const padHpx = room.kind === 'mat' ? Math.round((room.padH || 0) * minSide) : 0;
  const padVpx = room.kind === 'mat' ? Math.round((room.padV || 0) * minSide) : 0;

  const W = paintW + 2 * borderPx + 2 * padHpx;
  const H = paintH + 2 * borderPx + 2 * padVpx;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  if (room.kind === 'mat') {
    ctx.fillStyle = room.color;
    ctx.fillRect(0, 0, W, H);
  }
  // 'none': leave transparent.

  const px = padHpx + borderPx;
  const py = padVpx + borderPx;
  ctx.drawImage(paintBitmap, px, py, paintW, paintH);

  if (frame && frame.stripBitmap && borderPx > 0) {
    drawFrame(ctx, { ...frame, borderPx }, { x: px, y: py, w: paintW, h: paintH });
  }

  if (paintBitmap.close) paintBitmap.close();
  return await bitmapToBlob(canvas, 'image/png');
}

async function composePhoto({ painting, frame, placement, frameBorderFrac, paintingBlob, roomBlob }) {
  const roomBitmap = await loadBitmap(roomBlob);
  const paintBitmap = await loadBitmap(paintingBlob);
  const roomRef = { bitmap: roomBitmap, naturalW: roomBitmap.width, naturalH: roomBitmap.height };
  const paintingRef = { bitmap: paintBitmap, naturalW: paintBitmap.width, naturalH: paintBitmap.height };

  const W = roomRef.naturalW;
  const H = roomRef.naturalH;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(roomBitmap, 0, 0, W, H);

  const rect = paintingRect(placement, roomRef, paintingRef);
  const borderPx = (frameBorderFrac || 0) * Math.min(rect.w, rect.h);

  const innerW = Math.round(rect.w);
  const innerH = Math.round(rect.h);
  const totW = innerW + Math.round(2 * borderPx);
  const totH = innerH + Math.round(2 * borderPx);
  const inter = makeCanvas(totW, totH);
  const ictx = inter.getContext('2d');
  ictx.imageSmoothingQuality = 'high';
  ictx.drawImage(paintBitmap, Math.round(borderPx), Math.round(borderPx), innerW, innerH);
  if (frame && frame.stripBitmap && borderPx > 0) {
    drawFrame(ictx, { ...frame, borderPx: Math.round(borderPx) },
      { x: Math.round(borderPx), y: Math.round(borderPx), w: innerW, h: innerH });
  }

  const corners = projectCornersWithBorder(placement, roomRef, paintingRef, borderPx);
  warpQuad(ctx, inter, corners);

  if (roomBitmap.close) roomBitmap.close();
  if (paintBitmap.close) paintBitmap.close();
  return await bitmapToBlob(canvas, 'image/png');
}

function projectCornersWithBorder(placement, room, painting, borderPx) {
  const rect = paintingRect(placement, room, painting);
  const expanded = {
    naturalW: room.naturalW,
    naturalH: room.naturalH
  };
  const inflatedPainting = {
    naturalW: painting.naturalW * (1 + (2 * borderPx) / rect.w),
    naturalH: painting.naturalH * (1 + (2 * borderPx) / rect.h)
  };
  const minSide = Math.min(room.naturalW, room.naturalH);
  const newScale = (rect.w + 2 * borderPx) / minSide;
  const adjusted = { ...placement, scale: newScale };
  return projectCorners(adjusted, expanded, inflatedPainting);
}

/**
 * Warp a source canvas/bitmap onto a target ctx as a 4-corner quad by
 * splitting into two affine triangles. Approximate perspective — no per-pixel
 * w-divide — but visually acceptable for moderate tilts.
 */
function warpQuad(ctx, src, dst) {
  const sw = src.width;
  const sh = src.height;
  const srcCorners = [
    { x: 0,  y: 0  },
    { x: sw, y: 0  },
    { x: sw, y: sh },
    { x: 0,  y: sh }
  ];
  drawTriangle(ctx, src,
    srcCorners[0], srcCorners[1], srcCorners[2],
    dst[0], dst[1], dst[2]);
  drawTriangle(ctx, src,
    srcCorners[0], srcCorners[2], srcCorners[3],
    dst[0], dst[2], dst[3]);
}

function drawTriangle(ctx, src, s0, s1, s2, d0, d1, d2) {
  const x1 = s0.x, y1 = s0.y;
  const x2 = s1.x, y2 = s1.y;
  const x3 = s2.x, y3 = s2.y;
  const u1 = d0.x, v1 = d0.y;
  const u2 = d1.x, v2 = d1.y;
  const u3 = d2.x, v3 = d2.y;

  const denom = x1 * (y2 - y3) - x2 * (y1 - y3) + x3 * (y1 - y2);
  if (Math.abs(denom) < 1e-9) return;

  const a = (u1 * (y2 - y3) - u2 * (y1 - y3) + u3 * (y1 - y2)) / denom;
  const c = -(u1 * (x2 - x3) - u2 * (x1 - x3) + u3 * (x1 - x2)) / denom;
  const e = (u1 * (x2 * y3 - x3 * y2) - u2 * (x1 * y3 - x3 * y1) + u3 * (x1 * y2 - x2 * y1)) / denom;
  const b = (v1 * (y2 - y3) - v2 * (y1 - y3) + v3 * (y1 - y2)) / denom;
  const d = -(v1 * (x2 - x3) - v2 * (x1 - x3) + v3 * (x1 - x2)) / denom;
  const f = (v1 * (x2 * y3 - x3 * y2) - v2 * (x1 * y3 - x3 * y1) + v3 * (x1 * y2 - x2 * y1)) / denom;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}
