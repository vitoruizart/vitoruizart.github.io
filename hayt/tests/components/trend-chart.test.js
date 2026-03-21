import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub localStorage before importing
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { renderTrendChart } = await import('../../js/components/trend-chart.js');

describe('renderTrendChart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15)); // 2025-03-15
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns HTML string with trend-chart class', () => {
    const html = renderTrendChart([]);
    expect(html).toContain('class="trend-chart"');
  });

  it('contains SVG element', () => {
    const html = renderTrendChart([]);
    expect(html).toContain('<svg');
    expect(html).toContain('</svg>');
  });

  it('has no dots for empty moods', () => {
    const html = renderTrendChart([]);
    expect(html).not.toContain('<circle');
  });

  it('creates dots for mood data points', () => {
    const moods = [
      { date: '2025-03-14', mood: 3 },
      { date: '2025-03-15', mood: 4 },
    ];
    const html = renderTrendChart(moods);
    // Should have 2 data dots
    const dots = html.match(/<circle /g) ?? [];
    expect(dots.length).toBe(2);
  });

  it('creates no polyline with single data point', () => {
    const moods = [{ date: '2025-03-15', mood: 3 }];
    const html = renderTrendChart(moods);
    expect(html).not.toContain('<polyline');
  });

  it('creates polyline with multiple data points', () => {
    const moods = [
      { date: '2025-03-14', mood: 3 },
      { date: '2025-03-15', mood: 4 },
    ];
    const html = renderTrendChart(moods);
    expect(html).toContain('<polyline');
  });

  it('uses mood icons instead of numbers on Y-axis', () => {
    const html = renderTrendChart([]);
    expect(html).toContain('href="icons/mood-5.png"');
    expect(html).toContain('href="icons/mood-3.png"');
    expect(html).toContain('href="icons/mood-1.png"');
    // Should not have numeric text labels
    expect(html).not.toMatch(/text-anchor="end"[^>]*>\d<\/text>/);
  });

  it('ignores moods outside 30-day window', () => {
    const moods = [
      { date: '2024-01-01', mood: 5 }, // way outside
      { date: '2025-03-15', mood: 3 }, // inside
    ];
    const html = renderTrendChart(moods);
    const dots = html.match(/<circle /g) ?? [];
    expect(dots.length).toBe(1);
  });
});
