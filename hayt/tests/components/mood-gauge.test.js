import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { renderMoodGauge } = await import('../../js/components/mood-gauge.js');

describe('renderMoodGauge', () => {
  it('returns empty-state gauge with "0" when no moods', () => {
    const html = renderMoodGauge([]);
    expect(html).toContain('class="mood-gauge"');
    expect(html).toContain('>0</text>');
    // Gray arc for empty state
    expect(html).toContain('stroke="rgba(255,255,255,0.1)"');
  });

  it('shows correct total count in center', () => {
    const moods = [
      { date: '2025-03-01', mood: 5 },
      { date: '2025-03-02', mood: 3 },
      { date: '2025-03-03', mood: 1 },
    ];
    const html = renderMoodGauge(moods);
    expect(html).toContain('>3</text>');
  });

  it('creates arc segments for each mood value present', () => {
    const moods = [
      { date: '2025-03-01', mood: 5 },
      { date: '2025-03-02', mood: 3 },
      { date: '2025-03-03', mood: 1 },
    ];
    const html = renderMoodGauge(moods);
    // Should have 3 colored path segments (one per mood value present)
    const paths = html.match(/<path /g) ?? [];
    expect(paths.length).toBe(3);
    // Verify mood colors are present
    expect(html).toContain('#F39C12'); // mood 5
    expect(html).toContain('#9B59B6'); // mood 3
    expect(html).toContain('#4a4a4a'); // mood 1
  });

  it('shows correct counts in legend badges', () => {
    const moods = [
      { date: '2025-03-01', mood: 5 },
      { date: '2025-03-02', mood: 5 },
      { date: '2025-03-03', mood: 3 },
    ];
    const html = renderMoodGauge(moods);
    // Extract badge contents — badges are <span class="mood-gauge-badge" ...>N</span>
    const badges = [...html.matchAll(/class="mood-gauge-badge"[^>]*>(\d+)<\/span>/g)];
    // MOODS order: 5, 4, 3, 2, 1
    expect(badges.map(m => m[1])).toEqual(['2', '0', '1', '0', '0']);
  });

  it('handles all moods being the same value (full semi-circle)', () => {
    const moods = [
      { date: '2025-03-01', mood: 4 },
      { date: '2025-03-02', mood: 4 },
      { date: '2025-03-03', mood: 4 },
    ];
    const html = renderMoodGauge(moods);
    // Should have a single arc path (split through midpoint = 2 A commands in one path)
    const paths = html.match(/<path /g) ?? [];
    expect(paths.length).toBe(1);
    expect(html).toContain('#2ECC71'); // mood 4 color
    expect(html).toContain('>3</text>');
  });

  it('renders legend with all 5 mood icons', () => {
    const html = renderMoodGauge([]);
    for (let v = 1; v <= 5; v++) {
      expect(html).toContain(`icons/mood-${v}.png`);
    }
  });
});
