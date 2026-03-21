import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// --- Mock github-api ---
const mockGetFile = vi.fn();
const mockPutFile = vi.fn();
vi.mock('../js/github-api.js', () => ({
  getFile: (...args) => mockGetFile(...args),
  putFile: (...args) => mockPutFile(...args),
  getRateLimitRemaining: () => Infinity,
  RateLimitError: class extends Error {
    constructor(resetAtMs) {
      super('rate limit');
      this.name = 'RateLimitError';
      this.resetAtMs = resetAtMs;
    }
  },
}));

// --- Mock toast ---
vi.mock('../js/components/toast.js', () => ({
  toast: vi.fn(),
}));

// --- Mock state ---
vi.mock('../js/state.js', () => ({
  get: vi.fn(),
  set: vi.fn(),
  on: vi.fn(),
  update: vi.fn(),
}));

// --- localStorage stub ---
const lsStore = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => lsStore.get(k) ?? null,
  setItem: (k, v) => lsStore.set(k, v),
  removeItem: (k) => lsStore.delete(k),
  clear: () => lsStore.clear(),
});

vi.stubGlobal('navigator', { get onLine() { return true; } });
vi.stubGlobal('window', globalThis);

const { startSync, stopSync } = await import('../js/sync.js');

function setCredentials() {
  lsStore.set('hayt-pat', 'ghp_test');
  lsStore.set('hayt-repo', 'user/repo');
  lsStore.set('hayt-password', 'test-pass');
}

describe('sync lifecycle', () => {
  let addedListeners;
  let removedListeners;
  const origAdd = window.addEventListener;
  const origRemove = window.removeEventListener;

  beforeEach(() => {
    lsStore.clear();
    addedListeners = [];
    removedListeners = [];

    window.addEventListener = vi.fn((...args) => {
      addedListeners.push({ type: args[0], fn: args[1] });
    });
    window.removeEventListener = vi.fn((...args) => {
      removedListeners.push({ type: args[0], fn: args[1] });
    });
  });

  afterEach(() => {
    window.addEventListener = origAdd;
    window.removeEventListener = origRemove;
    stopSync();
  });

  it('stopSync removes the online listener added by startSync', () => {
    setCredentials();
    // Mock getFile to avoid actual sync work (it will be called by startSync -> syncNow)
    mockGetFile.mockResolvedValue(null);

    startSync();

    const onlineAdded = addedListeners.filter(l => l.type === 'online');
    expect(onlineAdded.length).toBe(1);

    stopSync();

    const onlineRemoved = removedListeners.filter(l => l.type === 'online');
    expect(onlineRemoved.length).toBe(1);
    // Same function reference must be used for add and remove
    expect(onlineRemoved[0].fn).toBe(onlineAdded[0].fn);
  });

  it('stopSync does not throw when startSync was not called', () => {
    // stopSync always calls removeEventListener (no-op if listener wasn't added)
    expect(() => stopSync()).not.toThrow();
  });
});
