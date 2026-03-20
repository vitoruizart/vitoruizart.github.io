import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub browser globals before importing
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
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
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const { checkForUpdate } = await import('../../js/lib/update-checker.js');
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

  it('update button unregisters old SW and re-registers fresh one', async () => {
    const unregisterFn = vi.fn(() => Promise.resolve());
    const registerFn = vi.fn(() =>
      Promise.resolve({ installing: null, waiting: null, active: swActivated }),
    );
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: () => Promise.resolve({ unregister: unregisterFn }),
        register: registerFn,
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
    expect(registerFn).toHaveBeenCalledWith('sw.js');
  });
});
