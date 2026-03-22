import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    // Clear any countdown interval left from tests
    if (container._postSaveTimer) {
      clearInterval(container._postSaveTimer);
    }
    vi.useRealTimers();
  });

  it('renders 5 mood buttons', () => {
    render(container);
    const buttons = container.querySelectorAll('.mood-btn');
    expect(buttons.length).toBe(5);
  });

  it('renders a close button that navigates to calendar', () => {
    render(container);
    const closeBtn = container.querySelector('#prompt-close');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute('aria-label')).toBe('Cerrar');
    closeBtn.click();
    expect(location.hash).toBe('#calendar');
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

  it('auto-navigates to calendar after 5 seconds', async () => {
    vi.useFakeTimers();
    render(container);
    container.querySelector('.mood-btn[data-mood="3"]').click();

    // Flush async work (putMood/addChangeEntry promises) without advancing clock
    await vi.advanceTimersByTimeAsync(0);
    expect(container.querySelector('#post-go-calendar')).toBeTruthy();

    // Button should show countdown
    expect(container.querySelector('#post-go-calendar').textContent).toBe('Ir al Calendario (5)');

    // Advance 3 seconds — countdown should update
    vi.advanceTimersByTime(3000);
    expect(container.querySelector('#post-go-calendar').textContent).toBe('Ir al Calendario (2)');

    // Advance remaining 2 seconds — should navigate
    vi.advanceTimersByTime(2000);
    expect(location.hash).toBe('#calendar');
  });

  it('cancels auto-navigate when adding a note', async () => {
    vi.useFakeTimers();
    render(container);
    container.querySelector('.mood-btn[data-mood="4"]').click();

    await vi.advanceTimersByTimeAsync(0);
    expect(container.querySelector('#post-add-note')).toBeTruthy();

    // Click "Añadir nota" — should cancel timer and remove calendar button from DOM
    container.querySelector('#post-add-note').click();

    // Advance past 5s — should NOT navigate
    vi.advanceTimersByTime(6000);
    expect(location.hash).toBe('');
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

  it('allows correcting mood selection after initial save', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="3"]').click();

    // Wait for full initial save flow (post-save UI appears after onSaved)
    await vi.waitFor(() => {
      expect(container.querySelector('.mood-saved-msg')).toBeTruthy();
    });

    // First save should be mood 3
    expect(mockPutMood.mock.calls[0][0].mood).toBe(3);
    const savedId = mockPutMood.mock.calls[0][0].id;

    // Now correct to mood 5
    container.querySelector('.mood-btn[data-mood="5"]').click();

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Actualizado', 'success', 1500);
    });

    // Second save should reuse same ID but with mood 5
    expect(mockPutMood).toHaveBeenCalledTimes(2);
    const corrected = mockPutMood.mock.calls[1][0];
    expect(corrected.id).toBe(savedId);
    expect(corrected.mood).toBe(5);

    // Highlight should reflect new selection
    const btn5 = container.querySelector('.mood-btn[data-mood="5"]');
    const btn3 = container.querySelector('.mood-btn[data-mood="3"]');
    expect(btn5.style.opacity).toBe('1');
    expect(btn3.style.opacity).toBe('0.4');
  });

  it('does not call putMood when correcting to same mood value', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="3"]').click();

    // Wait for full initial save flow
    await vi.waitFor(() => {
      expect(container.querySelector('.mood-saved-msg')).toBeTruthy();
    });

    // Tap same mood again — should be a no-op
    container.querySelector('.mood-btn[data-mood="3"]').click();

    // Give it a tick to ensure no extra calls
    await new Promise(r => setTimeout(r, 10));
    expect(mockPutMood).toHaveBeenCalledTimes(1);
  });

  it('note save uses corrected mood after correction', async () => {
    render(container);
    container.querySelector('.mood-btn[data-mood="3"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('#post-add-note')).toBeTruthy();
    });

    // Open note field
    container.querySelector('#post-add-note').click();

    // Correct mood to 5
    container.querySelector('.mood-btn[data-mood="5"]').click();

    await vi.waitFor(() => {
      expect(mockPutMood).toHaveBeenCalledTimes(2);
    });

    // Now save the note
    const textarea = container.querySelector('#mood-note');
    textarea.value = 'After correction';
    container.querySelector('#note-save').click();

    await vi.waitFor(() => {
      expect(mockPutMood).toHaveBeenCalledTimes(3);
    });

    // Note save should have mood=5 (corrected), not mood=3
    const noteSave = mockPutMood.mock.calls[2][0];
    expect(noteSave.mood).toBe(5);
    expect(noteSave.note).toBe('After correction');
  });

  it('resets countdown timer when correcting mood', async () => {
    vi.useFakeTimers();
    render(container);
    container.querySelector('.mood-btn[data-mood="3"]').click();

    await vi.advanceTimersByTimeAsync(0);
    expect(container.querySelector('#post-go-calendar').textContent).toBe('Ir al Calendario (5)');

    // Advance 3 seconds
    vi.advanceTimersByTime(3000);
    expect(container.querySelector('#post-go-calendar').textContent).toBe('Ir al Calendario (2)');

    // Correct mood — timer should reset to 5
    container.querySelector('.mood-btn[data-mood="5"]').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(container.querySelector('#post-go-calendar').textContent).toBe('Ir al Calendario (5)');

    // Advance 4 seconds — should still be counting (not navigated)
    vi.advanceTimersByTime(4000);
    expect(location.hash).toBe('');
    expect(container.querySelector('#post-go-calendar').textContent).toBe('Ir al Calendario (1)');

    // 1 more second — now it navigates
    vi.advanceTimersByTime(1000);
    expect(location.hash).toBe('#calendar');
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
