import { describe, it, expect, vi } from 'vitest';

// Stub localStorage before importing (constants.js reads it at module level)
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { moodFaceSvg, moodFaceSvgSmall } = await import('../../js/components/mood-faces.js');

describe('moodFaceSvg', () => {
  it('returns an img tag', () => {
    const html = moodFaceSvg(3);
    expect(html).toContain('<img');
    expect(html).toContain('src=');
  });

  it('references correct icon file per mood', () => {
    for (const mood of [1, 2, 3, 4, 5]) {
      const html = moodFaceSvg(mood);
      expect(html).toContain(`mood-${mood}.png`);
    }
  });

  it('uses correct alt text from mood label', () => {
    expect(moodFaceSvg(5)).toContain('alt="Feliz"');
    expect(moodFaceSvg(4)).toContain('alt="Contenta"');
    expect(moodFaceSvg(3)).toContain('alt="Ni fu ni fa"');
    expect(moodFaceSvg(2)).toContain('alt="Regular"');
    expect(moodFaceSvg(1)).toContain('alt="Mal"');
  });

  it('defaults to size 100', () => {
    const html = moodFaceSvg(3);
    expect(html).toContain('width="100"');
    expect(html).toContain('height="100"');
  });

  it('respects custom size', () => {
    const html = moodFaceSvg(3, 50);
    expect(html).toContain('width="50"');
    expect(html).toContain('height="50"');
  });

  it('falls back to mood 3 icon for unknown value', () => {
    const unknown = moodFaceSvg(99);
    expect(unknown).toContain('mood-3.png');
    expect(unknown).toContain('alt="Ni fu ni fa"');
  });

  it('includes draggable="false"', () => {
    const html = moodFaceSvg(3);
    expect(html).toContain('draggable="false"');
  });
});

describe('moodFaceSvgSmall', () => {
  it('defaults to size 28', () => {
    const html = moodFaceSvgSmall(4);
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
  });

  it('respects custom size', () => {
    const html = moodFaceSvgSmall(4, 24);
    expect(html).toContain('width="24"');
  });
});
