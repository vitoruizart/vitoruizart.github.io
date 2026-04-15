import { describe, it, expect } from 'vitest';
import { computeExportUpscale } from '../../js/lib/export-canvas.js';
import { MAX_OUTPUT_UPSCALE, MAX_CANVAS_DIM } from '../../js/lib/constants.js';

describe('computeExportUpscale', () => {
  it('returns 1 when painting already fits its destination at native resolution', () => {
    const u = computeExportUpscale({
      paintingW: 800, paintingH: 600,
      rectW: 1200, rectH: 900,
      roomW: 3000, roomH: 4000
    });
    expect(u).toBe(1);
  });

  it('upscales so the painting destination gets at least its native pixel count', () => {
    // Painting 5000 min side, destination 500 min side -> 10x raw, capped to MAX_OUTPUT_UPSCALE.
    // Room kept small enough that the dimension cap doesn't bind.
    const u = computeExportUpscale({
      paintingW: 5000, paintingH: 7000,
      rectW: 500, rectH: 700,
      roomW: 1200, roomH: 1600
    });
    expect(u).toBe(MAX_OUTPUT_UPSCALE);
  });

  it('caps upscale so the output canvas stays within MAX_CANVAS_DIM per axis', () => {
    // Room at 3000x4000 with MAX_OUTPUT_UPSCALE=4 would give 12000x16000 — over 8192.
    // dimCap = min(8192/3000, 8192/4000) = 2.048, so upscale should clamp there.
    const u = computeExportUpscale({
      paintingW: 20000, paintingH: 20000,
      rectW: 100, rectH: 100,
      roomW: 3000, roomH: 4000
    });
    expect(u * 4000).toBeLessThanOrEqual(MAX_CANVAS_DIM + 1e-6);
    expect(u * 3000).toBeLessThanOrEqual(MAX_CANVAS_DIM + 1e-6);
  });

  it('never downscales below 1 even if the room already exceeds MAX_CANVAS_DIM', () => {
    const u = computeExportUpscale({
      paintingW: 500, paintingH: 500,
      rectW: 400, rectH: 400,
      roomW: 10000, roomH: 10000
    });
    expect(u).toBe(1);
  });

  it('handles degenerate rect dimensions without dividing by zero', () => {
    const u = computeExportUpscale({
      paintingW: 1000, paintingH: 1000,
      rectW: 0, rectH: 0,
      roomW: 2000, roomH: 2000
    });
    expect(Number.isFinite(u)).toBe(true);
    expect(u).toBeGreaterThanOrEqual(1);
  });

  it('picks the correct fractional upscale between 1 and MAX_OUTPUT_UPSCALE', () => {
    // Painting 2000 min side, destination 1000 min side -> 2x raw, under cap.
    const u = computeExportUpscale({
      paintingW: 2000, paintingH: 2000,
      rectW: 1000, rectH: 1000,
      roomW: 2000, roomH: 2000
    });
    expect(u).toBeCloseTo(2, 6);
  });
});
