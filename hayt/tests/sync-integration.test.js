import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('clears syncRunning after timeout (no zombie lock)', async () => {
    setCredentials();

    // Make getFile hang forever — the 30s timeout should abort it
    // We override the timeout to be short for testing
    mockGetFile.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new DOMException('AbortError', 'AbortError')), 100);
    }));

    await syncNow();

    // After the sync finishes (with error), syncRunning should be cleared,
    // so a second call should not be blocked
    expect(stateValues.syncStatus).toBe('error');

    // Verify sync is unlocked — we can start another
    mockGetFile.mockResolvedValue(null);
    await syncNow();
    expect(stateValues.syncStatus).toBe('idle');
  });

  it('compaction clears changelog before writing snapshot', async () => {
    setCredentials();

    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey('test-pass', salt);
    const verifier = await crypto.createVerifier(key);

    const snapshot = {
      syncVersion: 1,
      encryptionSalt: salt,
      encryptionVerifier: verifier,
      moods: [],
    };

    // Create 30+ remote entries to trigger compaction
    const remoteEntries = Array.from({ length: 30 }, (_, i) => ({
      id: `ch-${i}`,
      deviceId: 'other-device',
      entityId: `mood-${i}`,
      timestamp: 1000 + i,
      operation: 'upsert',
      data: { id: `mood-${i}`, mood: 3, date: '2025-03-10', timestamp: 1000 + i },
    }));

    mockGetFile.mockImplementation((_pat, _repo, path) => {
      if (path.includes('snapshot')) {
        return { data: JSON.stringify(snapshot), sha: 'snap-sha' };
      }
      if (path.includes('changelog')) {
        return { data: JSON.stringify(remoteEntries), sha: 'cl-sha' };
      }
      return null;
    });

    const putOrder = [];
    mockPutFile.mockImplementation((_pat, _repo, path) => {
      putOrder.push(path);
      return 'new-sha';
    });

    await syncNow();

    // Verify changelog is cleared before snapshot is written
    const changelogIdx = putOrder.lastIndexOf('hayt-changelog.json');
    const snapshotIdx = putOrder.lastIndexOf('hayt-snapshot.json');
    expect(changelogIdx).toBeGreaterThan(-1);
    expect(snapshotIdx).toBeGreaterThan(-1);
    expect(changelogIdx).toBeLessThan(snapshotIdx);
  });

  it('preserves local data when compaction snapshot write fails', async () => {
    setCredentials();

    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey('test-pass', salt);
    const verifier = await crypto.createVerifier(key);

    // Seed local mood
    await db.putMood({ id: 'local-mood-1', mood: 5, date: '2025-03-20', timestamp: 50000 });

    const snapshot = {
      syncVersion: 1,
      encryptionSalt: salt,
      encryptionVerifier: verifier,
      moods: [],
    };

    // 30+ remote entries to trigger compaction
    const remoteEntries = Array.from({ length: 30 }, (_, i) => ({
      id: `comp-ch-${i}`,
      deviceId: 'other-device',
      entityId: `comp-mood-${i}`,
      timestamp: 1000 + i,
      operation: 'upsert',
      data: { id: `comp-mood-${i}`, mood: 3, date: '2025-03-10', timestamp: 1000 + i },
    }));

    mockGetFile.mockImplementation((_pat, _repo, path) => {
      if (path.includes('snapshot')) {
        return { data: JSON.stringify(snapshot), sha: 'snap-sha' };
      }
      if (path.includes('changelog')) {
        return { data: JSON.stringify(remoteEntries), sha: 'cl-sha' };
      }
      return null;
    });

    // Compaction: changelog clear succeeds, snapshot write fails
    let putCount = 0;
    mockPutFile.mockImplementation((_pat, _repo, path) => {
      putCount++;
      if (path.includes('snapshot')) {
        throw new Error('Network error');
      }
      return 'new-sha';
    });

    await syncNow();

    // Local mood should still be intact despite compaction failure
    const localMood = await db.getMood('local-mood-1');
    expect(localMood).toBeDefined();
    expect(localMood.mood).toBe(5);

    // Sync should still complete (compaction is non-critical)
    expect(stateValues.syncStatus).toBe('idle');
  });

  it('preserves changelog entries when push fails after successful pull', async () => {
    setCredentials();

    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey('test-pass', salt);
    const verifier = await crypto.createVerifier(key);

    // Remote has a foreign mood
    const foreignEntity = { id: 'pulled-mood', mood: 2, date: '2025-03-18', timestamp: 4000 };
    const encEntity = await crypto.encryptEntity(key, foreignEntity);

    const snapshot = {
      syncVersion: 1,
      encryptionSalt: salt,
      encryptionVerifier: verifier,
      moods: [],
    };

    const changelog = [{
      id: 'foreign-ch',
      deviceId: 'other-device',
      entityId: 'pulled-mood',
      timestamp: 4000,
      operation: 'upsert',
      data: encEntity,
    }];

    // Local pending change
    await db.addChangeEntry({
      id: 'pending-local',
      deviceId: 'my-device',
      entityId: 'my-mood',
      timestamp: 8000,
      operation: 'upsert',
      data: { id: 'my-mood', mood: 4, date: '2025-03-19', timestamp: 8000 },
    });

    mockGetFile.mockImplementation((_pat, _repo, path) => {
      if (path.includes('snapshot')) {
        return { data: JSON.stringify(snapshot), sha: 'snap-sha' };
      }
      if (path.includes('changelog')) {
        return { data: JSON.stringify(changelog), sha: 'cl-sha' };
      }
      return null;
    });

    // putFile always fails (network error during push)
    mockPutFile.mockRejectedValue(new Error('Network error'));

    await syncNow();

    // Pull should have succeeded — foreign mood is in local DB
    const pulledMood = await db.getMood('pulled-mood');
    expect(pulledMood).toBeDefined();
    expect(pulledMood.mood).toBe(2);

    // Local changelog should be preserved for retry (push failed, so entries not cleared)
    const entries = await db.getAllChangeEntries();
    const pendingIds = entries.map(e => e.id);
    expect(pendingIds).toContain('pending-local');

    // Status should be error
    expect(stateValues.syncStatus).toBe('error');
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
