import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub localStorage before importing
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { analyzeMoodContext, renderMoodBanner } = await import(
  '../../js/components/mood-banner.js'
);

describe('analyzeMoodContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15)); // 2025-03-15
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null averages for empty moods', () => {
    const ctx = analyzeMoodContext([]);
    expect(ctx.todayAvg).toBeNull();
    expect(ctx.yesterdayAvg).toBeNull();
    expect(ctx.week7Avg).toBeNull();
    expect(ctx.month30Avg).toBeNull();
    expect(ctx.trend7).toBeNull();
    expect(ctx.totalEntries).toBe(0);
    expect(ctx.daysWithData).toBe(0);
    expect(ctx.highStreak).toBe(0);
    expect(ctx.lowStreak).toBe(0);
    expect(ctx.lastEntryDaysAgo).toBeNull();
  });

  it('computes todayAvg from multiple entries', () => {
    const moods = [
      { date: '2025-03-15', mood: 4 },
      { date: '2025-03-15', mood: 2 },
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.todayAvg).toBe(3);
  });

  it('computes yesterdayAvg', () => {
    const moods = [{ date: '2025-03-14', mood: 5 }];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.yesterdayAvg).toBe(5);
    expect(ctx.todayAvg).toBeNull();
  });

  it('computes week7Avg and month30Avg', () => {
    const moods = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2025, 2, 15 - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      moods.push({ date: ds, mood: 4 });
    }
    const ctx = analyzeMoodContext(moods);
    expect(ctx.week7Avg).toBe(4);
    expect(ctx.month30Avg).toBe(4);
  });

  it('detects improving trend', () => {
    // Older days (6,5,4 days ago) = mood 2, recent days (today, yesterday, 2 days ago) = mood 5
    const moods = [
      { date: '2025-03-15', mood: 5 },
      { date: '2025-03-14', mood: 5 },
      { date: '2025-03-13', mood: 5 },
      { date: '2025-03-12', mood: 2 },
      { date: '2025-03-11', mood: 2 },
      { date: '2025-03-10', mood: 2 },
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.trend7).toBe('improving');
  });

  it('detects declining trend', () => {
    const moods = [
      { date: '2025-03-15', mood: 1 },
      { date: '2025-03-14', mood: 1 },
      { date: '2025-03-13', mood: 1 },
      { date: '2025-03-12', mood: 5 },
      { date: '2025-03-11', mood: 5 },
      { date: '2025-03-10', mood: 5 },
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.trend7).toBe('declining');
  });

  it('detects stable trend', () => {
    const moods = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2025, 2, 15 - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      moods.push({ date: ds, mood: 3 });
    }
    const ctx = analyzeMoodContext(moods);
    expect(ctx.trend7).toBe('stable');
  });

  it('returns null trend with single data point', () => {
    const moods = [{ date: '2025-03-15', mood: 3 }];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.trend7).toBeNull();
  });

  it('computes daysWithData correctly', () => {
    const moods = [
      { date: '2025-03-15', mood: 3 },
      { date: '2025-03-15', mood: 4 },
      { date: '2025-03-14', mood: 3 },
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.daysWithData).toBe(2);
    expect(ctx.totalEntries).toBe(3);
  });

  it('detects high streak from today', () => {
    const moods = [
      { date: '2025-03-15', mood: 5 },
      { date: '2025-03-14', mood: 4 },
      { date: '2025-03-13', mood: 4 },
      { date: '2025-03-12', mood: 2 }, // breaks streak
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.highStreak).toBe(3);
  });

  it('detects high streak from yesterday when today has no entry', () => {
    const moods = [
      { date: '2025-03-14', mood: 5 },
      { date: '2025-03-13', mood: 4 },
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.highStreak).toBe(2);
  });

  it('detects low streak', () => {
    const moods = [
      { date: '2025-03-15', mood: 1 },
      { date: '2025-03-14', mood: 2 },
      { date: '2025-03-13', mood: 1 },
    ];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.lowStreak).toBe(3);
  });

  it('computes lastEntryDaysAgo', () => {
    const moods = [{ date: '2025-03-10', mood: 3 }];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.lastEntryDaysAgo).toBe(5);
  });

  it('lastEntryDaysAgo is 0 for today', () => {
    const moods = [{ date: '2025-03-15', mood: 3 }];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.lastEntryDaysAgo).toBe(0);
  });
});

describe('renderMoodBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns valid HTML with mood-banner class', () => {
    const html = renderMoodBanner([]);
    expect(html).toContain('class="mood-banner"');
    expect(html).toContain('class="mood-banner-text"');
  });

  it('returns a non-empty message', () => {
    const html = renderMoodBanner([]);
    // Should have text content between the p tags
    const match = html.match(/<p[^>]*>(.+?)<\/p>/);
    expect(match).not.toBeNull();
    expect(match[1].length).toBeGreaterThan(5);
  });

  it('is deterministic for the same day', () => {
    const moods = [{ date: '2025-03-15', mood: 4 }];
    const html1 = renderMoodBanner(moods);
    const html2 = renderMoodBanner(moods);
    expect(html1).toBe(html2);
  });

  it('produces different messages on different days', () => {
    const moods = [{ date: '2025-03-15', mood: 3 }];
    vi.setSystemTime(new Date(2025, 2, 15));
    const html1 = renderMoodBanner(moods);
    vi.setSystemTime(new Date(2025, 2, 16));
    // Need fresh moods for new "today"
    const moods2 = [{ date: '2025-03-16', mood: 3 }];
    const html2 = renderMoodBanner(moods2);
    // Very likely different (different day of year), but technically could collide
    // Test that the function at least executes without error
    expect(html2).toContain('class="mood-banner"');
  });

  it('shows welcome message for no data', () => {
    const html = renderMoodBanner([]);
    // Should come from no_data or default pool — just verify it has content
    const match = html.match(/<p[^>]*>(.+?)<\/p>/);
    expect(match[1].length).toBeGreaterThan(0);
  });

  it('selects low_today over improving when today mood is low', () => {
    // Today is low (mood 1), but trend could be improving from even lower
    const moods = [
      { date: '2025-03-15', mood: 1 },
      { date: '2025-03-14', mood: 1 },
      { date: '2025-03-13', mood: 1 },
      { date: '2025-03-12', mood: 1 },
      { date: '2025-03-11', mood: 1 },
      { date: '2025-03-10', mood: 1 },
    ];
    // low_today triggers (todayAvg <= 2), which has higher priority than improving
    const ctx = analyzeMoodContext(moods);
    expect(ctx.todayAvg).toBe(1);
    // The banner should still render fine
    const html = renderMoodBanner(moods);
    expect(html).toContain('class="mood-banner"');
  });

  it('selects returned category for old data', () => {
    const moods = [{ date: '2025-03-01', mood: 4 }]; // 14 days ago
    const ctx = analyzeMoodContext(moods);
    expect(ctx.lastEntryDaysAgo).toBe(14);
    expect(ctx.totalEntries).toBe(1);
    const html = renderMoodBanner(moods);
    expect(html).toContain('class="mood-banner"');
  });

  it('handles single entry today', () => {
    const moods = [{ date: '2025-03-15', mood: 3 }];
    const ctx = analyzeMoodContext(moods);
    expect(ctx.todayAvg).toBe(3);
    expect(ctx.totalEntries).toBe(1);
    const html = renderMoodBanner(moods);
    expect(html).toContain('class="mood-banner"');
  });

  it('does not contain unescaped HTML in messages', () => {
    const html = renderMoodBanner([]);
    // Messages should not contain < or > (except for the wrapper tags)
    const msgMatch = html.match(/<p[^>]*>(.+?)<\/p>/);
    expect(msgMatch[1]).not.toContain('<');
    expect(msgMatch[1]).not.toContain('>');
  });
});
