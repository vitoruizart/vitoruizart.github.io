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
