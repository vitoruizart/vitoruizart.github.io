import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock state ---
const stateListeners = {};
vi.mock('../../js/state.js', () => ({
  get: vi.fn((k) => stateListeners._values?.[k]),
  set: vi.fn((k, v) => {
    if (!stateListeners._values) stateListeners._values = {};
    stateListeners._values[k] = v;
  }),
  on: vi.fn((key, fn) => {
    stateListeners[key] = fn;
    fn(stateListeners._values?.[key]); // fire immediately like real impl
    return () => { delete stateListeners[key]; };
  }),
  update: vi.fn(),
}));

// --- Mock toast ---
const mockToast = vi.fn();
vi.mock('../../js/components/toast.js', () => ({
  toast: (...args) => mockToast(...args),
}));

const { renderNav } = await import('../../js/components/nav.js');

describe('nav component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    mockToast.mockReset();
    if (stateListeners._values) {
      Object.keys(stateListeners._values).forEach(k => delete stateListeners._values[k]);
    }
  });

  it('renders nav with sync button and settings button', () => {
    renderNav(container);
    expect(container.querySelector('#nav-sync')).toBeTruthy();
    expect(container.querySelector('#nav-settings')).toBeTruthy();
  });

  it('sync button shows checkmark icon in idle state', () => {
    renderNav(container);
    const btn = container.querySelector('#nav-sync');
    // idle state — should have checkmark path and idle class
    expect(btn.classList.contains('nav-sync-idle')).toBe(true);
    expect(btn.getAttribute('title')).toBe('Sincronizado');
  });

  it('updates sync button icon and class when syncStatus changes', () => {
    renderNav(container);
    const btn = document.getElementById('nav-sync');

    // Simulate syncing
    const listener = stateListeners['syncStatus'];
    expect(listener).toBeTruthy();
    listener('syncing');
    expect(btn.classList.contains('nav-sync-syncing')).toBe(true);
    expect(btn.getAttribute('title')).toBe('Sincronizando…');

    // Simulate error
    listener('error');
    expect(btn.classList.contains('nav-sync-error')).toBe(true);
    expect(btn.classList.contains('nav-sync-syncing')).toBe(false);
    expect(btn.getAttribute('title')).toBe('Error de sincronización');

    // Simulate pending
    listener('pending');
    expect(btn.classList.contains('nav-sync-pending')).toBe(true);
    expect(btn.getAttribute('title')).toBe('Cambios pendientes');

    // Back to idle
    listener('idle');
    expect(btn.classList.contains('nav-sync-idle')).toBe(true);
    expect(btn.getAttribute('title')).toBe('Sincronizado');
  });

  it('renders offline banner hidden when online', () => {
    renderNav(container);
    const banner = container.querySelector('#offline-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toBe('Sin conexión');
    expect(banner.classList.contains('hidden')).toBe(true);
  });

  it('shows offline banner when offline event fires', () => {
    renderNav(container);
    const banner = document.getElementById('offline-banner');

    window.dispatchEvent(new Event('offline'));
    expect(banner.classList.contains('hidden')).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(banner.classList.contains('hidden')).toBe(true);
  });
});
