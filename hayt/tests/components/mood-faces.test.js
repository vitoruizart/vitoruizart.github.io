import { describe, it, expect, vi } from 'vitest';

// Stub localStorage before importing (constants.js reads it at module level)
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { moodFaceSvg, moodFaceSvgSmall } = await import('../../js/components/mood-faces.js');

describe('moodFaceSvg', () => {
  it('returns SVG string', () => {
    const svg = moodFaceSvg(3);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('uses correct color for mood 5', () => {
    const svg = moodFaceSvg(5);
    expect(svg).toContain('#F39C12');
  });

  it('uses correct aria-label', () => {
    const svg = moodFaceSvg(5);
    expect(svg).toContain('aria-label="Feliz"');
  });

  it('defaults to size 100', () => {
    const svg = moodFaceSvg(3);
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="100"');
  });

  it('respects custom size', () => {
    const svg = moodFaceSvg(3, 50);
    expect(svg).toContain('width="50"');
    expect(svg).toContain('height="50"');
  });

  it('uses mood 3 face for unknown value', () => {
    const known = moodFaceSvg(3);
    const unknown = moodFaceSvg(99);
    // Both should use the neutral face path (line element for mood 3)
    expect(known).toContain('<line');
    expect(unknown).toContain('<line');
  });

  it('contains outer circle element', () => {
    const svg = moodFaceSvg(1);
    expect(svg).toContain('cx="50" cy="50" r="46"');
  });

  it('outer circle has solid fill', () => {
    const svg = moodFaceSvg(3);
    expect(svg).toContain('fill="currentColor"');
    expect(svg).not.toContain('fill="none" stroke="currentColor" stroke-width="3"');
  });

  it('face features use white color', () => {
    for (const mood of [1, 2, 3, 4, 5]) {
      const svg = moodFaceSvg(mood);
      expect(svg).toContain('#fff');
    }
  });

  it('mood 5 has happy arc eyes and blush marks', () => {
    const svg = moodFaceSvg(5);
    // Arc eyes (path elements for ^_^ shape)
    expect(svg).toContain('stroke="#fff"');
    // Blush marks (low opacity circles)
    expect(svg).toContain('opacity="0.3"');
  });

  it('mood 1 has tear drops and X eyes', () => {
    const svg = moodFaceSvg(1);
    // Tear drops (ellipses with opacity)
    expect(svg).toContain('ellipse');
    expect(svg).toContain('opacity="0.4"');
    // X eyes (crossed lines)
    expect(svg).toContain('<line');
  });
});

describe('moodFaceSvgSmall', () => {
  it('defaults to size 28', () => {
    const svg = moodFaceSvgSmall(4);
    expect(svg).toContain('width="28"');
    expect(svg).toContain('height="28"');
  });

  it('respects custom size', () => {
    const svg = moodFaceSvgSmall(4, 24);
    expect(svg).toContain('width="24"');
  });
});
