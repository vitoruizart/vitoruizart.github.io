import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toDateStr, toTimeStr, parseDate,
  getDaysInMonth, getFirstDayOfWeek, formatMonthYear, daysAgo,
  getISOWeekString, getMonthString, getYearString,
} from '../../js/lib/date-utils.js';

describe('toDateStr', () => {
  it('formats date with zero-padding', () => {
    expect(toDateStr(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('formats double-digit month and day', () => {
    expect(toDateStr(new Date(2025, 11, 25))).toBe('2025-12-25');
  });

  it('defaults to current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15));
    expect(toDateStr()).toBe('2025-03-15');
    vi.useRealTimers();
  });
});

describe('toTimeStr', () => {
  it('formats time with zero-padding', () => {
    expect(toTimeStr(new Date(2025, 0, 1, 8, 5))).toBe('08:05');
  });

  it('formats midnight', () => {
    expect(toTimeStr(new Date(2025, 0, 1, 0, 0))).toBe('00:00');
  });

  it('defaults to current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1, 14, 30));
    expect(toTimeStr()).toBe('14:30');
    vi.useRealTimers();
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD string', () => {
    const d = parseDate('2025-03-15');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it('parses first day of year', () => {
    const d = parseDate('2025-01-01');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe('getDaysInMonth', () => {
  it('returns 31 for January', () => {
    expect(getDaysInMonth(2025, 0)).toBe(31);
  });

  it('returns 28 for February in non-leap year', () => {
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it('returns 29 for February in leap year', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it('returns 30 for April', () => {
    expect(getDaysInMonth(2025, 3)).toBe(30);
  });
});

describe('getFirstDayOfWeek', () => {
  it('returns Monday=0 based index', () => {
    // 2025-01-01 is Wednesday → index 2
    expect(getFirstDayOfWeek(2025, 0)).toBe(2);
  });

  it('returns 6 when first day is Sunday', () => {
    // 2025-06-01 is Sunday
    expect(getFirstDayOfWeek(2025, 5)).toBe(6);
  });

  it('returns 0 when first day is Monday', () => {
    // 2025-09-01 is Monday
    expect(getFirstDayOfWeek(2025, 8)).toBe(0);
  });
});

describe('formatMonthYear', () => {
  it('formats Spanish month names', () => {
    expect(formatMonthYear(2025, 0)).toBe('Enero 2025');
    expect(formatMonthYear(2025, 11)).toBe('Diciembre 2025');
  });

  it('formats middle months', () => {
    expect(formatMonthYear(2025, 5)).toBe('Junio 2025');
    expect(formatMonthYear(2025, 8)).toBe('Septiembre 2025');
  });
});

describe('daysAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15)); // 2025-03-15
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today for 0 days ago', () => {
    expect(daysAgo(0)).toBe('2025-03-15');
  });

  it('returns yesterday for 1 day ago', () => {
    expect(daysAgo(1)).toBe('2025-03-14');
  });

  it('crosses month boundary', () => {
    expect(daysAgo(15)).toBe('2025-02-28');
  });
});

describe('getISOWeekString', () => {
  it('returns correct ISO week for a mid-year date', () => {
    expect(getISOWeekString(new Date(2026, 2, 21))).toBe('2026-W12');
  });

  it('returns week 01 for early January when it falls in the current year', () => {
    // 2026-01-05 is a Monday → ISO week 2 of 2026
    expect(getISOWeekString(new Date(2026, 0, 5))).toBe('2026-W02');
  });

  it('handles Jan 1 that belongs to previous year ISO week', () => {
    // 2027-01-01 is a Friday → ISO week 53 of 2026
    expect(getISOWeekString(new Date(2027, 0, 1))).toBe('2026-W53');
  });

  it('handles Dec 31 that belongs to next year ISO week', () => {
    // 2025-12-29 is Monday → ISO week 1 of 2026
    expect(getISOWeekString(new Date(2025, 11, 29))).toBe('2026-W01');
  });

  it('pads single-digit week numbers', () => {
    expect(getISOWeekString(new Date(2026, 0, 1))).toBe('2026-W01');
  });

  it('defaults to current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(getISOWeekString()).toBe('2026-W25');
    vi.useRealTimers();
  });
});

describe('getMonthString', () => {
  it('returns YYYY-MM format', () => {
    expect(getMonthString(new Date(2026, 2, 21))).toBe('2026-03');
  });

  it('pads single-digit months', () => {
    expect(getMonthString(new Date(2026, 0, 1))).toBe('2026-01');
  });

  it('handles December', () => {
    expect(getMonthString(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('defaults to current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(getMonthString()).toBe('2026-06');
    vi.useRealTimers();
  });
});

describe('getYearString', () => {
  it('returns 4-digit year', () => {
    expect(getYearString(new Date(2026, 2, 21))).toBe('2026');
  });

  it('defaults to current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(getYearString()).toBe('2026');
    vi.useRealTimers();
  });
});
