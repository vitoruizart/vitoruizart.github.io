/**
 * Pointer-event-based 1- and 2-finger gesture tracker.
 *
 * Usage:
 *   const g = attachGestures(stageEl, paintingEl, {
 *     onStart: (snapshot) => {},
 *     onMove:  ({ dx, dy, scale, rotate, centroid }, snapshot) => {},
 *     onEnd:   (snapshot) => {}
 *   });
 *
 * Deltas are computed from the gesturestart baseline (NOT incrementally),
 * so the consumer applies them to a snapshot of placement taken at start
 * to avoid drift.
 */
export function attachGestures(targetEl, callbacks) {
  const pointers = new Map();
  let baseline = null; // { centroid, distance, angle, snapshot }

  function onPointerDown(e) {
    if (!e.isPrimary && pointers.size === 0) return;
    targetEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      baseline = makeBaseline();
      callbacks.onStart && callbacks.onStart(baseline);
    } else if (pointers.size === 2) {
      baseline = makeBaseline();
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!baseline) return;
    const cur = sample();
    const delta = computeDelta(baseline, cur);
    callbacks.onMove && callbacks.onMove(delta, baseline);
  }

  function onPointerUpOrCancel(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try { targetEl.releasePointerCapture(e.pointerId); } catch (_) {}
    if (pointers.size === 0) {
      callbacks.onEnd && callbacks.onEnd(baseline);
      baseline = null;
    } else {
      // Re-baseline with remaining pointers + current placement state.
      // Consumer should commit the current placement before this baseline replaces it.
      baseline = makeBaseline();
      callbacks.onRebase && callbacks.onRebase(baseline);
    }
  }

  function sample() {
    const pts = Array.from(pointers.values());
    if (pts.length === 1) {
      return { centroid: pts[0], distance: 0, angle: 0, count: 1 };
    }
    const a = pts[0], b = pts[1];
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
      centroid: { x: cx, y: cy },
      distance: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx) * 180 / Math.PI,
      count: 2
    };
  }

  function makeBaseline() {
    const s = sample();
    return {
      centroid: s.centroid,
      distance: s.distance,
      angle: s.angle,
      count: s.count,
      snapshot: callbacks.snapshot ? callbacks.snapshot() : null
    };
  }

  // Suppress Safari's non-standard 'gesture*' events that hijack two-finger pinch.
  const swallow = (e) => e.preventDefault();

  targetEl.addEventListener('pointerdown', onPointerDown);
  targetEl.addEventListener('pointermove', onPointerMove);
  targetEl.addEventListener('pointerup', onPointerUpOrCancel);
  targetEl.addEventListener('pointercancel', onPointerUpOrCancel);
  targetEl.addEventListener('gesturestart', swallow);
  targetEl.addEventListener('gesturechange', swallow);
  targetEl.addEventListener('gestureend', swallow);

  return function detach() {
    targetEl.removeEventListener('pointerdown', onPointerDown);
    targetEl.removeEventListener('pointermove', onPointerMove);
    targetEl.removeEventListener('pointerup', onPointerUpOrCancel);
    targetEl.removeEventListener('pointercancel', onPointerUpOrCancel);
    targetEl.removeEventListener('gesturestart', swallow);
    targetEl.removeEventListener('gesturechange', swallow);
    targetEl.removeEventListener('gestureend', swallow);
  };
}

export function computeDelta(baseline, cur) {
  const dx = cur.centroid.x - baseline.centroid.x;
  const dy = cur.centroid.y - baseline.centroid.y;
  let scale = 1;
  let rotate = 0;
  if (baseline.count === 2 && cur.count === 2 && baseline.distance > 0) {
    scale = cur.distance / baseline.distance;
    rotate = normalizeAngle(cur.angle - baseline.angle);
  }
  return { dx, dy, scale, rotate, centroid: cur.centroid, count: cur.count };
}

function normalizeAngle(a) {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}
