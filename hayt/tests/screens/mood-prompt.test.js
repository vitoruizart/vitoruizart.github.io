import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// --- Mock db ---
const mockPutMood = vi.fn();
const mockAddChangeEntry = vi.fn();
const mockGetRecentMoods = vi.fn();
vi.mock('../../js/db.js', () => ({
  putMood: (...args) => mockPutMood(...args),
  addChangeEntry: (...args) => mockAddChangeEntry(...args),
  getRecentMoods: (...args) => mockGetRecentMoods(...args),
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
  randomUUID: () => 'test-uuid',
  getRandomValues: (arr) => arr,
  subtle: globalThis.crypto?.subtle,
});

const { render } = await import('../../js/screens/mood-prompt.js');

describe('mood-prompt screen', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    mockPutMood.mockReset();
    mockAddChangeEntry.mockReset();
    mockToast.mockReset();
    mockPutMood.mockResolvedValue(undefined);
    mockAddChangeEntry.mockResolvedValue(undefined);
    location.hash = '';
  });

  it('renders 5 mood buttons', () => {
    render(container);
    const buttons = container.querySelectorAll('.mood-btn');
    expect(buttons.length).toBe(5);
  });

  it('clicking mood button immediately calls putMood', async () => {
    render(container);
    const btn = container.querySelector('.mood-btn[data-mood="4"]');
    btn.click();

    await vi.waitFor(() => {
      expect(mockPutMood).toHaveBeenCalledTimes(1);
    });

    const savedMood = mockPutMood.mock.calls[0][0];
    expect(savedMood.mood).toBe(4);
    expect(savedMood.note).toBeUndefined();
  });

  it('shows success message and action buttons after save', async () => {
    render(container);
    const btn = container.querySelector('.mood-btn[data-mood="3"]');
    btn.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.mood-saved-msg')).toBeTruthy();
    });

    expect(container.querySelector('.mood-saved-msg').textContent).toContain('Estado de ánimo registrado');
    expect(container.querySelector('#post-go-calendar')).toBeTruthy();
    expect(container.querySelector('#post-add-note')).toBeTruthy();
  });

  it('"Ir al Calendario" navigates to calendar', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="5"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-go-calendar')).toBeTruthy();
    });

    container.querySelector('#post-go-calendar').click();
    expect(location.hash).toBe('#calendar');
  });

  it('"Añadir nota" reveals textarea', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    container.querySelector('#post-add-note').click();
    expect(container.querySelector('#mood-note')).toBeTruthy();
    expect(container.querySelector('#note-save')).toBeTruthy();
  });

  it('typing a note and clicking Guardar calls putMood again with the note', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    container.querySelector('#post-add-note').click();
    const textarea = container.querySelector('#mood-note');
    textarea.value = 'Feeling great';

    container.querySelector('#note-save').click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Nota guardada', 'success', 1500);
    });

    expect(mockPutMood).toHaveBeenCalledTimes(2);
    const updatedMood = mockPutMood.mock.calls[1][0];
    expect(updatedMood.note).toBe('Feeling great');
    expect(location.hash).toBe('#calendar');
  });

  it('does not save note if textarea is empty', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="4"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    container.querySelector('#post-add-note').click();
    // Leave textarea empty
    container.querySelector('#note-save').click();

    // putMood should only have been called once (the initial mood save)
    expect(mockPutMood).toHaveBeenCalledTimes(1);
  });

  it('shows error toast when putMood fails', async () => {
    mockPutMood.mockRejectedValue(new Error('DB write failed'));
    render(container);

    const btn = container.querySelector('.mood-btn[data-mood="3"]');
    btn.click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Error al guardar', 'error');
    });

    // Should NOT show post-save UI
    expect(container.querySelector('.mood-saved-msg')).toBeFalsy();
    // Should NOT navigate away
    expect(location.hash).not.toBe('#calendar');
  });
});
