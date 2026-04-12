import { paintingRect, projectCorners } from './transform.js';
import { drawFrame } from './frame-render.js';
import { makeCanvas, bitmapToBlob } from './image-io.js';

/**
 * Compose the final image at the room's native resolution.
 *
 * room:      { bitmap, naturalW, naturalH }
 * painting:  { bitmap, naturalW, naturalH }
 * frame:     { stripBitmap, sliceWidth, borderPx } — borderPx is FRACTION of painting min-side; we resolve to px here
 * placement: { tx, ty, scale, rotate, rotateX, rotateY }
 *
 * Returns a Blob (JPEG).
 */
export async function composeFinal({ room, painting, frame, placement, frameBorderFrac }) {
  const W = room.naturalW;
  const H = room.naturalH;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(room.bitmap, 0, 0, W, H);

  const rect = paintingRect(placement, room, painting);
  const borderPx = (frameBorderFrac || 0) * Math.min(rect.w, rect.h);

  // Render painting + frame to an intermediate canvas at native painting size + border.
  const innerW = Math.round(rect.w);
  const innerH = Math.round(rect.h);
  const totW = innerW + Math.round(2 * borderPx);
  const totH = innerH + Math.round(2 * borderPx);
  const inter = makeCanvas(totW, totH);
  const ictx = inter.getContext('2d');
  ictx.drawImage(painting.bitmap, Math.round(borderPx), Math.round(borderPx), innerW, innerH);
  if (frame && frame.stripBitmap && borderPx > 0) {
    drawFrame(ictx, { ...frame, borderPx: Math.round(borderPx) },
      { x: Math.round(borderPx), y: Math.round(borderPx), w: innerW, h: innerH });
  }

  // Project the 4 corners of the painting+frame rect via the same math
  // CSS uses, then warp the intermediate onto the room canvas as a quad.
  const corners = projectCornersWithBorder(placement, room, painting, borderPx);
  warpQuad(ctx, inter, corners);

  return await bitmapToBlob(canvas, 'image/jpeg', 0.92);
}

function projectCornersWithBorder(placement, room, painting, borderPx) {
  // Re-derive corners using a slightly enlarged rect to include the frame.
  const rect = paintingRect(placement, room, painting);
  const expanded = {
    naturalW: room.naturalW,
    naturalH: room.naturalH
  };
  const inflatedPainting = {
    naturalW: painting.naturalW * (1 + (2 * borderPx) / rect.w),
    naturalH: painting.naturalH * (1 + (2 * borderPx) / rect.h)
  };
  // Bump scale so paintingRect produces rect.w + 2*border
  const minSide = Math.min(room.naturalW, room.naturalH);
  const newScale = (rect.w + 2 * borderPx) / minSide;
  const adjusted = { ...placement, scale: newScale };
  return projectCorners(adjusted, expanded, inflatedPainting);
}

/**
 * Warp a source canvas/bitmap onto a target ctx as a 4-corner quad,
 * by splitting into two triangles and using affine setTransform per triangle.
 * This is an approximation of true perspective interpolation (no per-pixel
 * w-divide), but visually acceptable for moderate tilts.
 *
 * dst points in order: tl, tr, br, bl.
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
  // Triangle 1: tl, tr, br
  drawTriangle(ctx, src,
    srcCorners[0], srcCorners[1], srcCorners[2],
    dst[0], dst[1], dst[2]);
  // Triangle 2: tl, br, bl
  drawTriangle(ctx, src,
    srcCorners[0], srcCorners[2], srcCorners[3],
    dst[0], dst[2], dst[3]);
}

function drawTriangle(ctx, src, s0, s1, s2, d0, d1, d2) {
  // Solve affine transform mapping s -> d:
  //   [a c e] [sx]   [dx]
  //   [b d f] [sy] = [dy]
  //   [0 0 1] [1 ]   [1 ]
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
