import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub localStorage before importing modules that use constants.js
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { renderCalendarGrid } = await import('../../js/components/calendar-grid.js');

describe('renderCalendarGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15)); // 2025-03-15
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a DOM element', () => {
    const el = renderCalendarGrid(2025, 2, new Map(), () => {});
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('has 7 header cells', () => {
    const el = renderCalendarGrid(2025, 2, new Map(), () => {});
    const headers = el.querySelectorAll('.cal-header');
    expect(headers).toHaveLength(7);
  });

  it('header cells show day abbreviations', () => {
    const el = renderCalendarGrid(2025, 2, new Map(), () => {});
    const headers = [...el.querySelectorAll('.cal-header')];
    expect(headers.map(h => h.textContent)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  });

  it('creates correct number of day cells for March 2025 (31 days)', () => {
    const el = renderCalendarGrid(2025, 2, new Map(), () => {});
    const dayCells = el.querySelectorAll('.cal-cell[data-date]');
    expect(dayCells).toHaveLength(31);
  });

  it('has empty cells for offset before first day', () => {
    // March 2025 starts on Saturday → offset 5 (Mon-based)
    const el = renderCalendarGrid(2025, 2, new Map(), () => {});
    const emptyCells = el.querySelectorAll('.cal-empty');
    expect(emptyCells).toHaveLength(5);
  });

  it('marks today with cal-today class', () => {
    const el = renderCalendarGrid(2025, 2, new Map(), () => {});
    const today = el.querySelector('.cal-today');
    expect(today).not.toBeNull();
    expect(today.dataset.date).toBe('2025-03-15');
  });

  it('shows mood face for days with entries', () => {
    const moodsByDate = new Map([
      ['2025-03-10', [{ mood: 4 }, { mood: 2 }]],
    ]);
    const el = renderCalendarGrid(2025, 2, moodsByDate, () => {});
    const cell = el.querySelector('[data-date="2025-03-10"]');
    expect(cell.classList.contains('cal-has-mood')).toBe(true);
    expect(cell.innerHTML).toContain('<img');
  });

  it('averages mood values and sets mood background', () => {
    // mood [2, 4] → avg 3 → mood 3 background
    const moodsByDate = new Map([
      ['2025-03-10', [{ mood: 2 }, { mood: 4 }]],
    ]);
    const el = renderCalendarGrid(2025, 2, moodsByDate, () => {});
    const cell = el.querySelector('[data-date="2025-03-10"]');
    expect(cell.getAttribute('style')).toContain('--mood-bg');
  });

  it('shows count badge for multiple entries', () => {
    const moodsByDate = new Map([
      ['2025-03-10', [{ mood: 3 }, { mood: 4 }]],
    ]);
    const el = renderCalendarGrid(2025, 2, moodsByDate, () => {});
    const badge = el.querySelector('[data-date="2025-03-10"] .cal-count');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('2');
  });

  it('onDayClick fires with correct dateStr', () => {
    const onClick = vi.fn();
    const el = renderCalendarGrid(2025, 2, new Map(), onClick);
    const cell = el.querySelector('[data-date="2025-03-10"]');
    cell.click();
    expect(onClick).toHaveBeenCalledWith('2025-03-10');
  });

  it('does not show count badge for single entry', () => {
    const moodsByDate = new Map([
      ['2025-03-10', [{ mood: 5 }]],
    ]);
    const el = renderCalendarGrid(2025, 2, moodsByDate, () => {});
    const badge = el.querySelector('[data-date="2025-03-10"] .cal-count');
    expect(badge).toBeNull();
  });
});
