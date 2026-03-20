import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub localStorage before importing
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { computeInsights, renderMoodInsights } = await import(
  '../../js/components/mood-insights.js'
);

// Helper: generate a date string N days before a reference date
function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Helper: generate mood entries for consecutive days going back from "today"
function daysBack(n) {
  const d = new Date(2025, 2, 15); // matches fake timer
  d.setDate(d.getDate() - n);
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

describe('computeInsights', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15)); // 2025-03-15 (Saturday)
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array for no data', () => {
    expect(computeInsights([])).toEqual([]);
  });

  // --- Recording streak ---

  it('shows streak when 2 consecutive days', () => {
    const moods = [
      { date: '2025-03-15', mood: 3 },
      { date: '2025-03-14', mood: 3 },
    ];
    const insights = computeInsights(moods);
    const streak = insights.find(i => i.type === 'streak');
    expect(streak).toBeDefined();
    expect(streak.text).toContain('2 días seguidos');
  });

  it('does not show streak for single day', () => {
    const moods = [{ date: '2025-03-15', mood: 3 }];
    const insights = computeInsights(moods);
    const streak = insights.find(i => i.type === 'streak');
    expect(streak).toBeUndefined();
  });

  it('gap breaks streak', () => {
    const moods = [
      { date: '2025-03-15', mood: 3 },
      // gap on 2025-03-14
      { date: '2025-03-13', mood: 3 },
    ];
    const insights = computeInsights(moods);
    const streak = insights.find(i => i.type === 'streak');
    expect(streak).toBeUndefined();
  });

  it('starts streak from yesterday when today is empty', () => {
    const moods = [
      { date: '2025-03-14', mood: 3 },
      { date: '2025-03-13', mood: 3 },
      { date: '2025-03-12', mood: 3 },
    ];
    const insights = computeInsights(moods);
    const streak = insights.find(i => i.type === 'streak');
    expect(streak).toBeDefined();
    expect(streak.text).toContain('3 días seguidos');
  });

  // --- Best day of week ---

  it('does not show best day with < 3 weeks of data', () => {
    // Data spanning only 2 weeks
    const moods = [];
    for (let i = 0; i < 14; i++) {
      moods.push({ date: daysBack(i), mood: 4 });
    }
    const insights = computeInsights(moods);
    const bestDay = insights.find(i => i.type === 'bestDay');
    expect(bestDay).toBeUndefined();
  });

  it('shows best day with sufficient data across 3+ weeks', () => {
    // Generate data across 4 weeks (28 days) with Fridays having higher mood
    const moods = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(2025, 2, 15 - i);
      const date = dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const isFriday = d.getDay() === 5;
      moods.push({ date, mood: isFriday ? 5 : 2 });
    }
    const insights = computeInsights(moods);
    const bestDay = insights.find(i => i.type === 'bestDay');
    expect(bestDay).toBeDefined();
    expect(bestDay.text).toContain('viernes');
  });

  // --- 30-day average ---

  it('does not show average with < 5 days of data', () => {
    const moods = [];
    for (let i = 0; i < 4; i++) {
      moods.push({ date: daysBack(i), mood: 3 });
    }
    const insights = computeInsights(moods);
    const avg = insights.find(i => i.type === 'average');
    expect(avg).toBeUndefined();
  });

  it('shows correct average with ≥ 5 days', () => {
    const moods = [];
    for (let i = 0; i < 5; i++) {
      moods.push({ date: daysBack(i), mood: 4 });
    }
    const insights = computeInsights(moods);
    const avg = insights.find(i => i.type === 'average');
    expect(avg).toBeDefined();
    expect(avg.text).toContain('4.0');
  });

  // --- Improving trend ---

  it('shows improving when week-over-week improvement > 0.3', () => {
    const moods = [];
    // Current week (days 0-6): mood 4
    for (let i = 0; i < 7; i++) {
      moods.push({ date: daysBack(i), mood: 4 });
    }
    // Previous week (days 7-13): mood 2
    for (let i = 7; i < 14; i++) {
      moods.push({ date: daysBack(i), mood: 2 });
    }
    const insights = computeInsights(moods);
    const improving = insights.find(i => i.type === 'improving');
    expect(improving).toBeDefined();
    expect(improving.text).toContain('mejorado');
  });

  it('does not show improving when improvement ≤ 0.3', () => {
    const moods = [];
    for (let i = 0; i < 7; i++) {
      moods.push({ date: daysBack(i), mood: 3 });
    }
    for (let i = 7; i < 14; i++) {
      moods.push({ date: daysBack(i), mood: 3 });
    }
    const insights = computeInsights(moods);
    const improving = insights.find(i => i.type === 'improving');
    expect(improving).toBeUndefined();
  });

  it('does not show improving on decline', () => {
    const moods = [];
    for (let i = 0; i < 7; i++) {
      moods.push({ date: daysBack(i), mood: 2 });
    }
    for (let i = 7; i < 14; i++) {
      moods.push({ date: daysBack(i), mood: 5 });
    }
    const insights = computeInsights(moods);
    const improving = insights.find(i => i.type === 'improving');
    expect(improving).toBeUndefined();
  });

  // --- Total milestone ---

  it('shows milestone at 10 entries', () => {
    const moods = [];
    for (let i = 0; i < 10; i++) {
      moods.push({ date: daysBack(i), mood: 3 });
    }
    const insights = computeInsights(moods);
    const milestone = insights.find(i => i.type === 'milestone');
    expect(milestone).toBeDefined();
    expect(milestone.text).toContain('10 registros');
  });

  it('does not show milestone at 9 entries', () => {
    const moods = [];
    for (let i = 0; i < 9; i++) {
      moods.push({ date: daysBack(i), mood: 3 });
    }
    const insights = computeInsights(moods);
    const milestone = insights.find(i => i.type === 'milestone');
    expect(milestone).toBeUndefined();
  });

  it('higher tiers have different text', () => {
    const moods100 = [];
    for (let i = 0; i < 100; i++) {
      moods100.push({ date: daysBack(i % 30), mood: 3 });
    }
    const insights100 = computeInsights(moods100);
    const m100 = insights100.find(i => i.type === 'milestone');
    expect(m100.text).toContain('Increíble compromiso');

    const moods50 = [];
    for (let i = 0; i < 50; i++) {
      moods50.push({ date: daysBack(i % 30), mood: 3 });
    }
    const insights50 = computeInsights(moods50);
    const m50 = insights50.find(i => i.type === 'milestone');
    expect(m50.text).toContain('hábito');
  });

  // --- Happy days ratio ---

  it('shows happy days when ratio ≥ 40% and ≥ 10 days with data', () => {
    const moods = [];
    // 10 days, 5 with mood 4+ (50% ratio)
    for (let i = 0; i < 10; i++) {
      moods.push({ date: daysBack(i), mood: i < 5 ? 5 : 2 });
    }
    const insights = computeInsights(moods);
    const happy = insights.find(i => i.type === 'happyDays');
    expect(happy).toBeDefined();
    expect(happy.text).toContain('5 de tus últimos 10 días fueron buenos');
  });

  it('does not show happy days when ratio < 40%', () => {
    const moods = [];
    // 10 days, 3 with mood 4+ (30% ratio)
    for (let i = 0; i < 10; i++) {
      moods.push({ date: daysBack(i), mood: i < 3 ? 5 : 2 });
    }
    const insights = computeInsights(moods);
    const happy = insights.find(i => i.type === 'happyDays');
    expect(happy).toBeUndefined();
  });

  it('does not show happy days with < 10 days of data', () => {
    const moods = [];
    for (let i = 0; i < 9; i++) {
      moods.push({ date: daysBack(i), mood: 5 });
    }
    const insights = computeInsights(moods);
    const happy = insights.find(i => i.type === 'happyDays');
    expect(happy).toBeUndefined();
  });

  // --- Multiple insights ---

  it('returns multiple insights simultaneously when thresholds met', () => {
    const moods = [];
    // 14 consecutive days: current week mood 5, prev week mood 2
    for (let i = 0; i < 7; i++) {
      moods.push({ date: daysBack(i), mood: 5 });
    }
    for (let i = 7; i < 14; i++) {
      moods.push({ date: daysBack(i), mood: 2 });
    }
    const insights = computeInsights(moods);
    const types = insights.map(i => i.type);
    // Should have streak (14 consecutive), average (14 days > 5), improving, milestone (14 entries)
    expect(types).toContain('streak');
    expect(types).toContain('improving');
    expect(types).toContain('milestone');
    expect(types).toContain('average');
  });
});

describe('renderMoodInsights', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for no data', () => {
    expect(renderMoodInsights([])).toBe('');
  });

  it('returns empty string when no insights qualify', () => {
    // Single entry — below all thresholds
    const moods = [{ date: '2025-03-15', mood: 3 }];
    expect(renderMoodInsights(moods)).toBe('');
  });

  it('returns HTML with insights-section and insight-card', () => {
    const moods = [];
    for (let i = 0; i < 10; i++) {
      moods.push({ date: daysBack(i), mood: 4 });
    }
    const html = renderMoodInsights(moods);
    expect(html).toContain('class="insights-section"');
    expect(html).toContain('class="insight-card"');
    expect(html).toContain('class="insight-icon"');
    expect(html).toContain('class="insight-text"');
  });

  it('contains SVG icons in rendered output', () => {
    const moods = [];
    for (let i = 0; i < 10; i++) {
      moods.push({ date: daysBack(i), mood: 4 });
    }
    const html = renderMoodInsights(moods);
    expect(html).toContain('<svg');
  });
});
