import { describe, it, expect } from 'vitest';
import { resampleArea, fabricMask } from '../../js/lib/resample.js';

function image(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return { width, height, data };
}

describe('resampleArea', () => {
  it('averages 2×2 blocks when halving', () => {
    // Left column black, right column white → each 2×2 block averages to mid grey.
    const src = image(4, 4, (x) => (x % 2 === 0 ? [0, 0, 0] : [255, 255, 255]));
    const out = resampleArea(src, { x: 0, y: 0, w: 4, h: 4 }, 2, 2);
    expect(Array.from(out)).toEqual([128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128]);
  });

  it('returns exact pixels at 1:1', () => {
    const src = image(2, 1, (x) => (x === 0 ? [10, 20, 30] : [200, 100, 50]));
    const out = resampleArea(src, { x: 0, y: 0, w: 2, h: 1 }, 2, 1);
    expect(Array.from(out)).toEqual([10, 20, 30, 200, 100, 50]);
  });

  it('weights partially covered pixels by overlap area', () => {
    // 3 px wide → 2 cells: cell 0 covers px0 fully and half of px1.
    const src = image(3, 1, (x) => [[0, 0, 0], [90, 90, 90], [255, 255, 255]][x]);
    const out = resampleArea(src, { x: 0, y: 0, w: 3, h: 1 }, 2, 1);
    expect(out[0]).toBe(30); // (0*1 + 90*0.5) / 1.5
    expect(out[3]).toBe(200); // (90*0.5 + 255*1) / 1.5
  });

  it('honours the crop rect offset', () => {
    const src = image(4, 4, (x, y) => (x >= 2 && y >= 2 ? [255, 0, 0] : [0, 0, 255]));
    const out = resampleArea(src, { x: 2, y: 2, w: 2, h: 2 }, 1, 1);
    expect(Array.from(out)).toEqual([255, 0, 0]);
  });

  it('upsamples by repeating source pixels', () => {
    const src = image(1, 1, () => [12, 34, 56]);
    const out = resampleArea(src, { x: 0, y: 0, w: 1, h: 1 }, 3, 2);
    expect(out.length).toBe(18);
    for (let i = 0; i < 18; i += 3) expect([out[i], out[i + 1], out[i + 2]]).toEqual([12, 34, 56]);
  });

  it('composites transparent pixels over white (bare fabric)', () => {
    const src = image(1, 1, () => [0, 0, 0, 0]);
    const out = resampleArea(src, { x: 0, y: 0, w: 1, h: 1 }, 1, 1);
    expect(Array.from(out)).toEqual([255, 255, 255]);
  });
});

describe('fabricMask', () => {
  it('marks nothing when the rect lies inside the image', () => {
    expect(Array.from(fabricMask(100, 100, { x: 10, y: 10, w: 80, h: 80 }, 4, 4)).every((v) => v === 0)).toBe(true);
  });

  it('marks cells whose centre falls outside the image', () => {
    // 100 px image, rect 150 px wide starting at -25 → 6 cells of 25 px; the
    // first and last lie off the image.
    const mask = fabricMask(100, 100, { x: -25, y: 0, w: 150, h: 100 }, 6, 1);
    expect(Array.from(mask)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('decides straddling cells by their centre', () => {
    // Cells 40 px wide from -10: cell 0 spans -10..30 (centre 10, image),
    // cell 2 spans 70..110 (centre 90, image), cell 3 spans 110..150 (fabric).
    const mask = fabricMask(100, 100, { x: -10, y: 0, w: 160, h: 100 }, 4, 1);
    expect(Array.from(mask)).toEqual([0, 0, 0, 1]);
  });

  it('works on both axes', () => {
    const mask = fabricMask(10, 10, { x: -10, y: -10, w: 30, h: 30 }, 3, 3);
    expect(Array.from(mask)).toEqual([1, 1, 1, 1, 0, 1, 1, 1, 1]);
  });
});
