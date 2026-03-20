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

  it('renders note section hidden initially', () => {
    render(container);
    const noteSection = container.querySelector('#note-section');
    expect(noteSection.classList.contains('hidden')).toBe(true);
  });

  it('shows note section after clicking a mood button', () => {
    render(container);
    const btn = container.querySelector('.mood-btn[data-mood="4"]');
    btn.click();
    const noteSection = container.querySelector('#note-section');
    expect(noteSection.classList.contains('hidden')).toBe(false);
  });

  it('shows error toast when putMood fails', async () => {
    mockPutMood.mockRejectedValue(new Error('DB write failed'));
    render(container);

    // Click mood button
    const btn = container.querySelector('.mood-btn[data-mood="3"]');
    btn.click();

    // Click save immediately
    const saveBtn = container.querySelector('#note-save');
    saveBtn.click();

    // Wait for async handler
    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Error al guardar', 'error');
    });

    // Should NOT navigate away
    expect(location.hash).not.toBe('#calendar');
  });

  it('navigates to calendar on successful save', async () => {
    render(container);

    const btn = container.querySelector('.mood-btn[data-mood="5"]');
    btn.click();

    const saveBtn = container.querySelector('#note-save');
    saveBtn.click();

    await vi.waitFor(() => {
      expect(location.hash).toBe('#calendar');
    });

    expect(mockToast).toHaveBeenCalledWith('Guardado', 'success', 1500);
  });
});
