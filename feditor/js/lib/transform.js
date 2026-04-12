/**
 * Geometric source of truth shared by live preview (CSS) and export (canvas).
 *
 * Placement:
 *   tx, ty: normalized 0..1 position of painting center within room rect
 *   scale:  fraction of room shorter edge (e.g. 0.35 -> painting width/height ≈ 35% of min(roomW, roomH))
 *   rotate: degrees, in-plane (Z)
 *   rotateX, rotateY: degrees, perspective tilt
 *
 * The painting's logical width is `scale * min(roomW, roomH)` and its height
 * is derived from the painting bitmap's aspect ratio.
 */

export const PERSPECTIVE_PX = 800;

export function paintingRect(placement, room, painting) {
  const minSide = Math.min(room.naturalW, room.naturalH);
  const w = placement.scale * minSide;
  const aspect = painting.naturalH / painting.naturalW;
  const h = w * aspect;
  const cx = placement.tx * room.naturalW;
  const cy = placement.ty * room.naturalH;
  return { cx, cy, w, h };
}

/**
 * CSS transform string for the painting layer in live preview.
 * The element is positioned absolute at left/top: 50% with width/height set
 * to its (scaled) rendered size; this transform handles translate, rotate,
 * and perspective tilt around the centroid.
 *
 * stageW/stageH are the on-screen room rect dimensions (after object-fit: cover).
 */
export function toCssTransform(placement, stageW, stageH) {
  const px = (placement.tx - 0.5) * stageW;
  const py = (placement.ty - 0.5) * stageH;
  return [
    `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`,
    `translate(-50%, -50%)`,
    `perspective(${PERSPECTIVE_PX}px)`,
    `rotateX(${placement.rotateX.toFixed(2)}deg)`,
    `rotateY(${placement.rotateY.toFixed(2)}deg)`,
    `rotateZ(${placement.rotate.toFixed(2)}deg)`
  ].join(' ');
}

/**
 * Painting size in stage (preview) pixels, to set on the live element.
 */
export function paintingPreviewSize(placement, stageW, stageH, painting) {
  const minSide = Math.min(stageW, stageH);
  const w = placement.scale * minSide;
  const aspect = painting.naturalH / painting.naturalW;
  return { w, h: w * aspect };
}

export function clampPlacement(p) {
  return {
    tx: clamp(p.tx, 0, 1),
    ty: clamp(p.ty, 0, 1),
    scale: clamp(p.scale, 0.05, 1.5),
    rotate: wrapAngle(p.rotate),
    rotateX: clamp(p.rotateX, -60, 60),
    rotateY: clamp(p.rotateY, -60, 60)
  };
}

function wrapAngle(a) {
  let r = a % 360;
  if (r > 180) r -= 360;
  else if (r <= -180) r += 360;
  return r;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Project the painting's 4 corners through the same transform CSS would apply.
 * Used by export-canvas for the quad-warp.
 *
 * Returns 4 points in room-coordinate space: [tl, tr, br, bl].
 */
export function projectCorners(placement, room, painting) {
  const rect = paintingRect(placement, room, painting);
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const corners = [
    { x: -halfW, y: -halfH },
    { x:  halfW, y: -halfH },
    { x:  halfW, y:  halfH },
    { x: -halfW, y:  halfH }
  ];
  const ax = (placement.rotateX * Math.PI) / 180;
  const ay = (placement.rotateY * Math.PI) / 180;
  const az = (placement.rotate * Math.PI) / 180;
  const persp = PERSPECTIVE_PX;
  const cosX = Math.cos(ax), sinX = Math.sin(ax);
  const cosY = Math.cos(ay), sinY = Math.sin(ay);
  const cosZ = Math.cos(az), sinZ = Math.sin(az);

  return corners.map((c) => {
    const x1 = c.x * cosZ - c.y * sinZ;
    const y1 = c.x * sinZ + c.y * cosZ;
    const z1 = 0;
    const x2 = x1 * cosY + z1 * sinY;
    const z2 = -x1 * sinY + z1 * cosY;
    const y3 = y1 * cosX - z2 * sinX;
    const z3 = y1 * sinX + z2 * cosX;
    const f = persp / (persp - z3);
    return {
      x: rect.cx + x2 * f,
      y: rect.cy + y3 * f
    };
  });
}
