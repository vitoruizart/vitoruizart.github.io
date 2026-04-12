import { describe, it, expect } from 'vitest';
import {
  paintingRect, toCssTransform, paintingPreviewSize, clampPlacement,
  projectCorners, PERSPECTIVE_PX
} from '../../js/lib/transform.js';

const room = { naturalW: 1000, naturalH: 800 };
const painting = { naturalW: 400, naturalH: 300 };

describe('paintingRect', () => {
  it('places painting at center when tx/ty=0.5 and sizes by min(roomW, roomH)', () => {
    const r = paintingRect({ tx: 0.5, ty: 0.5, scale: 0.25, rotate: 0, rotateX: 0, rotateY: 0 }, room, painting);
    expect(r.cx).toBe(500);
    expect(r.cy).toBe(400);
    expect(r.w).toBe(0.25 * 800); // min side is 800
    expect(r.h).toBeCloseTo(r.w * (300 / 400), 5);
  });
});

describe('toCssTransform', () => {
  it('emits centered transform at default placement', () => {
    const t = toCssTransform({ tx: 0.5, ty: 0.5, scale: 0.3, rotate: 0, rotateX: 0, rotateY: 0 }, 400, 600);
    expect(t).toContain('translate3d(0.00px, 0.00px, 0)');
    expect(t).toContain('translate(-50%, -50%)');
    expect(t).toContain(`perspective(${PERSPECTIVE_PX}px)`);
    expect(t).toContain('rotateZ(0.00deg)');
  });

  it('translates relative to stage size', () => {
    const t = toCssTransform({ tx: 0.75, ty: 0.25, scale: 0.3, rotate: 30, rotateX: 0, rotateY: 0 }, 400, 600);
    expect(t).toContain('translate3d(100.00px, -150.00px, 0)');
    expect(t).toContain('rotateZ(30.00deg)');
  });
});

describe('paintingPreviewSize', () => {
  it('returns scaled width and aspect-correct height', () => {
    const sz = paintingPreviewSize({ scale: 0.5 }, 400, 600, painting);
    expect(sz.w).toBe(200);
    expect(sz.h).toBe(150);
  });
});

describe('clampPlacement', () => {
  it('clamps tx/ty to [0,1]', () => {
    const c = clampPlacement({ tx: 1.5, ty: -0.2, scale: 0.3, rotate: 0, rotateX: 0, rotateY: 0 });
    expect(c.tx).toBe(1);
    expect(c.ty).toBe(0);
  });
  it('wraps rotate to (-180, 180]', () => {
    const c = clampPlacement({ tx: 0.5, ty: 0.5, scale: 0.3, rotate: 540, rotateX: 0, rotateY: 0 });
    expect(c.rotate).toBeGreaterThan(-180);
    expect(c.rotate).toBeLessThanOrEqual(180);
  });
  it('clamps perspective tilts to ±60', () => {
    const c = clampPlacement({ tx: 0.5, ty: 0.5, scale: 0.3, rotate: 0, rotateX: 100, rotateY: -90 });
    expect(c.rotateX).toBe(60);
    expect(c.rotateY).toBe(-60);
  });
});

describe('projectCorners', () => {
  it('returns axis-aligned rect at zero rotation', () => {
    const c = projectCorners({ tx: 0.5, ty: 0.5, scale: 0.25, rotate: 0, rotateX: 0, rotateY: 0 }, room, painting);
    expect(c).toHaveLength(4);
    const [tl, tr, br, bl] = c;
    expect(tl.x).toBeCloseTo(tr.x - 200, 3);
    expect(tl.y).toBeCloseTo(bl.y - 150, 3);
    expect(br.x).toBeCloseTo(tr.x, 3);
    expect(br.y).toBeCloseTo(bl.y, 3);
  });

  it('rotateZ=90 swaps width and height in the projection', () => {
    const c = projectCorners({ tx: 0.5, ty: 0.5, scale: 0.25, rotate: 90, rotateX: 0, rotateY: 0 }, room, painting);
    const xs = c.map(p => p.x);
    const ys = c.map(p => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    // Original was 200x150; rotated 90° should be 150x200.
    expect(w).toBeCloseTo(150, 3);
    expect(h).toBeCloseTo(200, 3);
  });
});
