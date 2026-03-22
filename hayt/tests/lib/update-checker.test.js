import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub browser globals before importing
const lsStore = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => lsStore.get(k) ?? null,
  setItem: (k, v) => lsStore.set(k, v),
  removeItem: (k) => lsStore.delete(k),
});
vi.stubGlobal('caches', {
  keys: () => Promise.resolve([]),
  delete: () => Promise.resolve(true),
});
const swActivated = {
  state: 'activated',
  addEventListener: () => {},
  removeEventListener: () => {},
};
vi.stubGlobal('navigator', {
  serviceWorker: {
    getRegistration: () => Promise.resolve(null),
    register: () => Promise.resolve({ installing: null, waiting: null, active: swActivated }),
  },
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  lsStore.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const { checkForUpdate, startUpdatePolling } = await import('../../js/lib/update-checker.js');
const { APP_VERSION } = await import('../../js/lib/constants.js');

describe('checkForUpdate', () => {
  it('returns false when version matches', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: APP_VERSION }),
    });
    const result = await checkForUpdate();
    expect(result).toBe(false);
    expect(document.querySelector('.update-overlay')).toBeNull();
  });

  it('returns true and shows overlay when version differs', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'NEW_VERSION' }),
    });
    const result = await checkForUpdate();
    expect(result).toBe(true);
    expect(document.querySelector('.update-overlay')).not.toBeNull();
  });

  it('returns false on network error', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await checkForUpdate();
    expect(result).toBe(false);
  });

  it('returns false on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const result = await checkForUpdate();
    expect(result).toBe(false);
  });

  it('fetches version.json with cache bypass', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: APP_VERSION }),
    });
    await checkForUpdate();
    expect(fetchMock).toHaveBeenCalledWith('/hayt/version.json', { cache: 'no-store' });
  });

  it('does not create duplicate overlays', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'NEW_VERSION' }),
    });
    await checkForUpdate();
    await checkForUpdate();
    const overlays = document.querySelectorAll('.update-overlay');
    expect(overlays.length).toBe(1);
  });

  it('overlay contains update button', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'NEW_VERSION' }),
    });
    await checkForUpdate();
    const btn = document.querySelector('.update-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Actualizar');
  });

  it('update button clears caches, unregisters SW, and stores applied version', async () => {
    const unregisterFn = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: () => Promise.resolve({ unregister: unregisterFn }),
        register: () => Promise.resolve({ installing: null, waiting: null, active: swActivated }),
      },
    });
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['hayt-v3']),
      delete: vi.fn(() => Promise.resolve(true)),
    });
    // Prevent actual reload
    const reloadFn = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadFn },
      writable: true,
      configurable: true,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'NEW_VERSION' }),
    });
    await checkForUpdate();
    const btn = document.querySelector('.update-btn');
    await btn.click();
    // Allow microtasks to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(caches.delete).toHaveBeenCalledWith('hayt-v3');
    expect(unregisterFn).toHaveBeenCalled();
    expect(lsStore.get('hayt-applied-version')).toBe('NEW_VERSION');
  });

  it('skips overlay when version matches hayt-applied-version', async () => {
    lsStore.set('hayt-applied-version', 'NEW_VERSION');
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'NEW_VERSION' }),
    });
    const result = await checkForUpdate();
    expect(result).toBe(false);
    expect(document.querySelector('.update-overlay')).toBeNull();
  });

  it('clears hayt-applied-version when APP_VERSION catches up', async () => {
    lsStore.set('hayt-applied-version', APP_VERSION);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: APP_VERSION }),
    });
    await checkForUpdate();
    expect(lsStore.has('hayt-applied-version')).toBe(false);
  });
});

describe('background update check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: APP_VERSION }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forces update check when returning from 30+ min background', async () => {
    startUpdatePolling();
    // Clear fetch calls from initial check
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockClear();

    // Simulate going to background
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Advance 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);

    // Simulate returning to foreground
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('does not force check when returning from short background', async () => {
    startUpdatePolling();
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockClear();

    // Simulate going to background
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Advance only 5 minutes (within debounce window from startup)
    vi.advanceTimersByTime(5 * 60 * 1000);

    // Simulate returning to foreground
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(0);
    // Should be debounced (only 5 min since startup check)
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
