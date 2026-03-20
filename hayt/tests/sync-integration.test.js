import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// --- Mock github-api ---
const mockGetFile = vi.fn();
const mockPutFile = vi.fn();
vi.mock('../js/github-api.js', () => ({
  getFile: (...args) => mockGetFile(...args),
  putFile: (...args) => mockPutFile(...args),
  RateLimitError: class extends Error {
    constructor(resetAtMs) {
      super('rate limit');
      this.name = 'RateLimitError';
      this.resetAtMs = resetAtMs;
    }
  },
}));

// --- Mock toast ---
const mockToast = vi.fn();
vi.mock('../js/components/toast.js', () => ({
  toast: (...args) => mockToast(...args),
}));

// --- Spy on state ---
const stateValues = {};
vi.mock('../js/state.js', () => ({
  get: (k) => stateValues[k],
  set: (k, v) => { stateValues[k] = v; },
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

// --- navigator.onLine ---
let online = true;
vi.stubGlobal('navigator', { get onLine() { return online; } });

// --- Stub window for sync.js module-level window._haytSync ---
vi.stubGlobal('window', globalThis);

// Import after all mocks — use await import() for namespace imports
const { syncNow } = await import('../js/sync.js');
const db = await import('../js/db.js');
const crypto = await import('../js/crypto.js');

function setCredentials() {
  lsStore.set('hayt-pat', 'ghp_test');
  lsStore.set('hayt-repo', 'user/repo');
  lsStore.set('hayt-password', 'test-pass');
}

describe('syncNow integration', () => {
  beforeEach(() => {
    lsStore.clear();
    online = true;
    mockGetFile.mockReset();
    mockPutFile.mockReset();
    mockToast.mockReset();
    Object.keys(stateValues).forEach(k => delete stateValues[k]);
    crypto.clearEncryptionKey();
  });

  it('returns immediately without credentials', async () => {
    await syncNow();
    expect(mockGetFile).not.toHaveBeenCalled();
  });

  it('returns immediately when offline', async () => {
    setCredentials();
    online = false;
    await syncNow();
    expect(mockGetFile).not.toHaveBeenCalled();
  });

  it('sets syncStatus to syncing then idle on success', async () => {
    setCredentials();
    mockGetFile.mockResolvedValue(null); // no remote files
    await syncNow();
    expect(stateValues.syncStatus).toBe('idle');
  });

  it('pulls foreign entries into local DB', async () => {
    setCredentials();

    // Generate encryption key and create encrypted data
    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey('test-pass', salt);

    const entity = { id: 'foreign-1', mood: 4, date: '2025-03-10', timestamp: 5000 };
    const encEntity = await crypto.encryptEntity(key, entity);
    const verifier = await crypto.createVerifier(key);

    // Remote snapshot with the salt and verifier
    const snapshot = {
      syncVersion: 1,
      encryptionSalt: salt,
      encryptionVerifier: verifier,
      moods: [],
    };

    // Remote changelog with one foreign entry
    const changelog = [{
      id: 'ch1',
      deviceId: 'other-device',
      entityId: 'foreign-1',
      timestamp: 5000,
      operation: 'put',
      data: encEntity,
    }];

    mockGetFile.mockImplementation((_pat, _repo, path) => {
      if (path.includes('snapshot')) {
        return { data: JSON.stringify(snapshot), sha: 'snap-sha' };
      }
      if (path.includes('changelog')) {
        return { data: JSON.stringify(changelog), sha: 'cl-sha' };
      }
      return null;
    });

    mockPutFile.mockResolvedValue('new-sha');

    await syncNow();

    // The foreign mood should now be in local DB
    const localMood = await db.getMood('foreign-1');
    expect(localMood).toBeDefined();
    expect(localMood.mood).toBe(4);
  });

  it('pushes local changes with conflict retry', async () => {
    setCredentials();

    // Add a local change entry
    await db.addChangeEntry({
      id: 'local-ch1',
      deviceId: 'my-device',
      entityId: 'mood-1',
      timestamp: 9000,
      operation: 'put',
      data: { id: 'mood-1', mood: 3, date: '2025-03-15', timestamp: 9000 },
    });

    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey('test-pass', salt);
    const verifier = await crypto.createVerifier(key);

    const snapshot = {
      syncVersion: 1,
      encryptionSalt: salt,
      encryptionVerifier: verifier,
      moods: [],
    };

    mockGetFile.mockImplementation((_pat, _repo, path) => {
      if (path.includes('snapshot')) {
        return { data: JSON.stringify(snapshot), sha: 'snap-sha' };
      }
      if (path.includes('changelog')) {
        return { data: '[]', sha: 'cl-sha' };
      }
      return null;
    });

    // First putFile call: CONFLICT, second: success
    let putCallCount = 0;
    mockPutFile.mockImplementation(() => {
      putCallCount++;
      if (putCallCount === 1) {
        throw new Error('CONFLICT');
      }
      return 'new-sha';
    });

    await syncNow();

    // Should have retried
    expect(mockPutFile).toHaveBeenCalledTimes(2);
    expect(stateValues.syncStatus).toBe('idle');
  });

  it('sets error on wrong password', async () => {
    setCredentials();

    const salt = crypto.generateSalt();
    const wrongKey = await crypto.deriveKey('wrong-password', salt);
    const verifier = await crypto.createVerifier(wrongKey);

    const snapshot = {
      syncVersion: 1,
      encryptionSalt: salt,
      encryptionVerifier: verifier,
      moods: [],
    };

    mockGetFile.mockImplementation((_pat, _repo, path) => {
      if (path.includes('snapshot')) {
        return { data: JSON.stringify(snapshot), sha: 'snap-sha' };
      }
      if (path.includes('changelog')) {
        return { data: '[]', sha: 'cl-sha' };
      }
      return null;
    });

    await syncNow(true);

    expect(stateValues.syncStatus).toBe('error');
    expect(mockToast).toHaveBeenCalledWith('Contraseña incorrecta', 'error');
  });
});
