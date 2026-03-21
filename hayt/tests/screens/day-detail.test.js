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

  it('shows "Añadir nota" button after adding a mood', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    // Click add button
    container.querySelector('#day-add').click();

    // Select a mood
    const moodBtn = container.querySelector('#mood-picker .mood-btn[data-mood="4"]');
    moodBtn.click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

  });

  it('typing a note and saving updates the mood record after add', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    // Click add button
    container.querySelector('#day-add').click();

    // Select a mood
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    // Click "Añadir nota"
    container.querySelector('#post-add-note').click();

    const textarea = container.querySelector('#day-mood-note');
    expect(textarea).toBeTruthy();

    textarea.value = 'Great day at work';
    // Mock getMoodsByDate for re-render after note save
    mockGetMoodsByDate.mockResolvedValue([]);
    container.querySelector('#day-note-save').click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Nota guardada', 'success', 1500);
    });

    expect(mockPutMood).toHaveBeenCalledTimes(2);
    const updatedMood = mockPutMood.mock.calls[1][0];
    expect(updatedMood.note).toBe('Great day at work');
  });

  it('shows "Añadir nota" button after editing a mood', async () => {
    mockGetMoodsByDate.mockResolvedValue([{ ...SAMPLE_MOODS[0] }]);
    await render(container, '2025-03-15');

    // Click edit to show picker
    container.querySelector('.entry-edit').click();

    // Select a new mood value
    container.querySelector('.edit-picker-inline .mood-btn[data-mood="5"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

  });

  it('typing a note and saving updates the mood record after edit', async () => {
    mockGetMoodsByDate.mockResolvedValue([{ ...SAMPLE_MOODS[0] }]);
    await render(container, '2025-03-15');

    // Click edit to show picker
    container.querySelector('.entry-edit').click();

    // Select a new mood
    container.querySelector('.edit-picker-inline .mood-btn[data-mood="5"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    // Click "Añadir nota"
    container.querySelector('#post-add-note').click();

    const textarea = container.querySelector('#day-mood-note');
    textarea.value = 'Mood improved after lunch';
    container.querySelector('#day-note-save').click();

    await vi.waitFor(() => {
      // putMood called twice: once for edit, once for note
      expect(mockPutMood).toHaveBeenCalledTimes(2);
    });

    const updatedMood = mockPutMood.mock.calls[1][0];
    expect(updatedMood.note).toBe('Mood improved after lunch');
    expect(updatedMood.mood).toBe(5);
  });

  it('shows new entry in list after adding a mood', async () => {
    mockGetMoodsByDate.mockResolvedValueOnce([]); // initial render
    await render(container, '2025-03-15');
    expect(container.querySelectorAll('.day-entry').length).toBe(0);

    // After add, refreshEntries will re-fetch — return the new entry
    mockGetMoodsByDate.mockResolvedValue([
      { id: 'new-mood', mood: 3, date: '2025-03-15', timestamp: 5000, time: '15:00' },
    ]);

    container.querySelector('#day-add').click();
    container.querySelector('#mood-picker .mood-btn[data-mood="3"]').click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('.day-entry').length).toBe(1);
    });
  });

  it('shows "Listo" button alongside "Añadir nota" after adding a mood', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    container.querySelector('#day-add').click();
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
      expect(container.querySelector('#post-done')).toBeTruthy();
      expect(container.querySelector('#post-done').textContent).toBe('Listo (5)');
    });
  });

  it('clicking "Listo" hides the add picker', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    container.querySelector('#day-add').click();
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-done')).toBeTruthy();
    });

    container.querySelector('#post-done').click();
    expect(container.querySelector('#mood-picker').classList.contains('hidden')).toBe(true);
  });

  it('hides #day-add when add picker opens, re-shows after dismiss', async () => {
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    const addBtn = container.querySelector('#day-add');
    expect(addBtn.classList.contains('hidden')).toBe(false);

    addBtn.click();
    expect(addBtn.classList.contains('hidden')).toBe(true);
    expect(container.querySelector('#mood-picker').classList.contains('hidden')).toBe(false);

    // Select a mood, then dismiss via "Listo"
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('#post-done')).toBeTruthy();
    });
    container.querySelector('#post-done').click();
    expect(addBtn.classList.contains('hidden')).toBe(false);
  });

  it('hides #day-add when editing the last entry, keeps visible for non-last', async () => {
    mockGetMoodsByDate.mockResolvedValue([...SAMPLE_MOODS]);
    await render(container, '2025-03-15');

    const addBtn = container.querySelector('#day-add');
    const editBtns = container.querySelectorAll('.entry-edit');

    // Edit first entry (not last) — add button stays visible
    editBtns[0].click();
    expect(addBtn.classList.contains('hidden')).toBe(false);

    // Close it
    editBtns[0].click();

    // Edit last entry — add button hidden
    editBtns[1].click();
    expect(addBtn.classList.contains('hidden')).toBe(true);

    // Toggle off — add button re-shown
    editBtns[1].click();
    expect(addBtn.classList.contains('hidden')).toBe(false);
  });

  it('Done button counts down from 5 and auto-dismisses at 0', async () => {
    vi.useFakeTimers();
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    container.querySelector('#day-add').click();
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-done')).toBeTruthy();
    });

    const doneBtn = container.querySelector('#post-done');
    expect(doneBtn.textContent).toBe('Listo (5)');

    await vi.advanceTimersByTimeAsync(1000);
    expect(doneBtn.textContent).toBe('Listo (4)');

    await vi.advanceTimersByTimeAsync(1000);
    expect(doneBtn.textContent).toBe('Listo (3)');

    await vi.advanceTimersByTimeAsync(3000);
    // Should have auto-dismissed
    expect(container.querySelector('#mood-picker').classList.contains('hidden')).toBe(true);
    expect(container.querySelector('#day-add').classList.contains('hidden')).toBe(false);

    vi.useRealTimers();
  });

  it('clicking "Añadir nota" cancels the countdown', async () => {
    vi.useFakeTimers();
    mockGetMoodsByDate.mockResolvedValue([]);
    await render(container, '2025-03-15');

    container.querySelector('#day-add').click();
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    container.querySelector('#post-add-note').click();

    // Advance past 5 seconds — picker should still be open (countdown cancelled)
    await vi.advanceTimersByTimeAsync(6000);
    expect(container.querySelector('#mood-picker').classList.contains('hidden')).toBe(false);
    expect(container.querySelector('#day-mood-note')).toBeTruthy();

    vi.useRealTimers();
  });

  it('after saving a note, entry is visible and picker is hidden', async () => {
    mockGetMoodsByDate.mockResolvedValueOnce([]); // initial render
    await render(container, '2025-03-15');

    // After add + note save, refreshEntries returns the entry with note
    mockGetMoodsByDate.mockResolvedValue([
      { id: 'noted-mood', mood: 4, date: '2025-03-15', timestamp: 6000, time: '16:00', note: 'Test note' },
    ]);

    container.querySelector('#day-add').click();
    container.querySelector('#mood-picker .mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    container.querySelector('#post-add-note').click();
    const textarea = container.querySelector('#day-mood-note');
    textarea.value = 'Test note';
    container.querySelector('#day-note-save').click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Nota guardada', 'success', 1500);
    });

    expect(container.querySelectorAll('.day-entry').length).toBe(1);
    expect(container.querySelector('.entry-note').textContent).toBe('Test note');
    expect(container.querySelector('#mood-picker').classList.contains('hidden')).toBe(true);
  });
});
