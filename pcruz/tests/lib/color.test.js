import { describe, it, expect } from 'vitest';
import { rgbToLab, deltaE2000, textColorFor } from '../../js/lib/color.js';

describe('rgbToLab', () => {
  it('maps white to L=100 and neutral a/b', () => {
    const [L, a, b] = rgbToLab([255, 255, 255]);
    expect(L).toBeCloseTo(100, 2);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it('maps black to L=0', () => {
    expect(rgbToLab([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('matches reference values for pure red (D65)', () => {
    const [L, a, b] = rgbToLab([255, 0, 0]);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('keeps greys neutral', () => {
    const [L, a, b] = rgbToLab([128, 128, 128]);
    expect(L).toBeCloseTo(53.59, 1);
    expect(Math.abs(a)).toBeLessThan(0.01);
    expect(Math.abs(b)).toBeLessThan(0.01);
  });
});

describe('deltaE2000', () => {
  // Test pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference
  // formula: implementation notes, supplementary test data".
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[50, 2.5, 0], [58, 24, 15], 19.4535],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0]
  ];

  it.each(pairs)('ΔE00(%j, %j) = %f', (lab1, lab2, expected) => {
    expect(deltaE2000(lab1, lab2)).toBeCloseTo(expected, 4);
  });

  it('is symmetric and zero for identical colours', () => {
    const a = [40, 10, -20];
    const b = [60, -5, 30];
    expect(deltaE2000(a, a)).toBe(0);
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 10);
  });
});

describe('textColorFor', () => {
  it('uses black on light backgrounds and white on dark ones', () => {
    expect(textColorFor([255, 255, 255])).toBe('#000');
    expect(textColorFor([255, 226, 226])).toBe('#000');
    expect(textColorFor([0, 0, 0])).toBe('#fff');
    expect(textColorFor([70, 5, 45])).toBe('#fff');
  });
});
