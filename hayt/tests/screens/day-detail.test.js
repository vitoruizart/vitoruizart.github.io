import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// --- Mock db ---
const mockGetMoodsByDate = vi.fn();
const mockPutMood = vi.fn();
const mockDeleteMood = vi.fn();
const mockAddChangeEntry = vi.fn();
vi.mock('../../js/db.js', () => ({
  getMoodsByDate: (...args) => mockGetMoodsByDate(...args),
  putMood: (...args) => mockPutMood(...args),
  deleteMood: (...args) => mockDeleteMood(...args),
  addChangeEntry: (...args) => mockAddChangeEntry(...args),
}));

// --- Mock toast ---
const mockToast = vi.fn();
vi.mock('../../js/components/toast.js', () => ({
  toast: (...args) => mockToast(...args),
}));

// --- Mock sync ---
vi.mock('../../js/sync.js', () => ({
  getDeviceId: () => 'test-device',
}));

// --- Mock state ---
vi.mock('../../js/state.js', () => ({
  set: vi.fn(),
  get: vi.fn(),
  on: vi.fn(),
}));

// --- Stub globals ---
vi.stubGlobal('window', { ...globalThis, _haytSync: {} });
vi.stubGlobal('location', { hash: '' });
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
  getRandomValues: (arr) => arr,
  subtle: globalThis.crypto?.subtle,
});

const { render } = await import('../../js/screens/day-detail.js');

const SAMPLE_MOODS = [
  { id: 'mood-1', mood: 4, date: '2025-03-15', timestamp: 1000, time: '10:00' },
  { id: 'mood-2', mood: 2, date: '2025-03-15', timestamp: 2000, time: '14:00' },
];

describe('day-detail screen', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    mockGetMoodsByDate.mockReset();
    mockPutMood.mockReset();
    mockDeleteMood.mockReset();
    mockAddChangeEntry.mockReset();
    mockToast.mockReset();
    mockPutMood.mockResolvedValue(undefined);
    mockDeleteMood.mockResolvedValue(undefined);
    mockAddChangeEntry.mockResolvedValue(undefined);
    location.hash = '';
  });

  it('renders mood entries for a date', async () => {
    mockGetMoodsByDate.mockResolvedValue([...SAMPLE_MOODS]);
    await render(container, '2025-03-15');
    const entries = container.querySelectorAll('.day-entry');
    expect(entries.length).toBe(2);
  });

  it('shows empty message when no moods', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');
    const empty = container.querySelector('.day-empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('Sin registros');
  });

  it('shows error toast when delete fails', async () => {
    mockGetMoodsByDate.mockResolvedValue([{ ...SAMPLE_MOODS[0] }]);
    mockDeleteMood.mockRejectedValue(new Error('DB error'));
    await render(container, '2025-03-15');

    const deleteBtn = container.querySelector('.entry-delete');

    // First click: enter confirm state
    deleteBtn.click();
    expect(deleteBtn.classList.contains('confirm')).toBe(true);

    // Second click: attempt delete
    deleteBtn.click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Error al eliminar', 'error');
    });
  });

  it('shows error toast when edit fails', async () => {
    mockGetMoodsByDate.mockResolvedValue([{ ...SAMPLE_MOODS[0] }]);
    mockPutMood.mockRejectedValue(new Error('DB error'));
    await render(container, '2025-03-15');

    // Click edit to show picker
    const editBtn = container.querySelector('.entry-edit');
    editBtn.click();

    // Select a new mood
    const moodBtn = container.querySelector('.edit-picker-inline .mood-btn[data-mood="5"]');
    moodBtn.click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Error al actualizar', 'error');
    });
  });

  it('shows error toast when add mood fails', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    mockPutMood.mockRejectedValue(new Error('DB error'));
    await render(container, '2025-03-15');

    // Click add button
    container.querySelector('#day-add').click();

    // Select a mood in the picker
    const moodBtn = container.querySelector('#mood-picker .mood-btn[data-mood="3"]');
    moodBtn.click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Error al guardar', 'error');
    });
  });

  it('displays note text when mood has a note', async () => {
    mockGetMoodsByDate.mockResolvedValue([
      { ...SAMPLE_MOODS[0], note: 'Feeling good about today' },
    ]);
    await render(container, '2025-03-15');
    const note = container.querySelector('.entry-note');
    expect(note).toBeTruthy();
    expect(note.textContent).toBe('Feeling good about today');
  });

  it('escapes HTML in note text', async () => {
    mockGetMoodsByDate.mockResolvedValue([
      { ...SAMPLE_MOODS[0], note: '<script>alert("xss")</script>' },
    ]);
    await render(container, '2025-03-15');
    const note = container.querySelector('.entry-note');
    expect(note.textContent).toBe('<script>alert("xss")</script>');
    expect(note.innerHTML).not.toContain('<script>');
  });
});
