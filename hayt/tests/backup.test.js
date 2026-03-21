import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// --- Mock github-api ---
const mockGetFile = vi.fn();
const mockPutFile = vi.fn();
let mockRateLimit = Infinity;
vi.mock('../js/github-api.js', () => ({
  getFile: (...args) => mockGetFile(...args),
  putFile: (...args) => mockPutFile(...args),
  getRateLimitRemaining: () => mockRateLimit,
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

// --- Spy on state ---
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

const { maybeCreateBackups } = await import('../js/sync.js');
const db = await import('../js/db.js');
const crypto = await import('../js/crypto.js');

const creds = { pat: 'ghp_test', repo: 'user/repo', password: 'test-pass' };

async function setupKey() {
  const salt = crypto.generateSalt();
  const key = await crypto.deriveKey('test-pass', salt);
  crypto.cacheEncryptionKey(key, salt);
  return key;
}

async function seedMoods(count = 2) {
  for (let i = 0; i < count; i++) {
    await db.putMood({
      id: `mood-${i}`,
      mood: 3,
      date: '2026-03-21',
      timestamp: Date.now() + i,
      time: '10:00',
      deviceId: 'dev-1',
    });
  }
}

describe('maybeCreateBackups', () => {
  beforeEach(async () => {
    mockGetFile.mockReset();
    mockPutFile.mockReset();
    mockRateLimit = Infinity;
    lsStore.clear();
    crypto.clearEncryptionKey();

    // Clear IndexedDB stores
    const allMoods = await db.getAllMoods();
    for (const m of allMoods) await db.deleteMood(m.id);
    try { await db.setMeta('backups', undefined); } catch { /* ok */ }
  });

  it('creates all three backups when meta is empty (first run)', async () => {
    const key = await setupKey();
    await seedMoods();
    mockGetFile.mockResolvedValue(null); // no existing backup files
    mockPutFile.mockResolvedValue('sha-new');

    await maybeCreateBackups(creds, key, undefined);

    // 3 getFile + 3 putFile calls
    expect(mockGetFile).toHaveBeenCalledTimes(3);
    expect(mockPutFile).toHaveBeenCalledTimes(3);

    // Verify file names
    const putPaths = mockPutFile.mock.calls.map(c => c[2]);
    expect(putPaths).toContain('hayt-backup-weekly.json');
    expect(putPaths).toContain('hayt-backup-monthly.json');
    expect(putPaths).toContain('hayt-backup-yearly.json');

    // Verify backup data format
    const data = JSON.parse(mockPutFile.mock.calls[0][3]);
    expect(data.syncVersion).toBe(1);
    expect(data.encryptionSalt).toBeDefined();
    expect(data.encryptionVerifier).toBeDefined();
    expect(data.moods).toHaveLength(2);
    expect(data.backupTimestamp).toBeDefined();
    expect(data.backupPeriod).toBeDefined();

    // Moods should be encrypted (have _enc, no plaintext mood)
    expect(data.moods[0]._enc).toBeDefined();
    expect(data.moods[0].mood).toBeUndefined();

    // Meta should be updated
    const meta = await db.getMeta('backups');
    expect(meta.lastWeekly).toBeDefined();
    expect(meta.lastMonthly).toBeDefined();
    expect(meta.lastYearly).toBeDefined();
  });

  it('makes no API calls when all periods match', async () => {
    const key = await setupKey();
    await seedMoods();

    // Pre-set meta to current periods
    const { getISOWeekString, getMonthString, getYearString } = await import('../js/lib/date-utils.js');
    const now = new Date();
    await db.setMeta('backups', {
      lastWeekly: getISOWeekString(now),
      lastMonthly: getMonthString(now),
      lastYearly: getYearString(now),
    });

    await maybeCreateBackups(creds, key, undefined);

    expect(mockGetFile).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it('only writes the backup for the changed period', async () => {
    const key = await setupKey();
    await seedMoods();

    const { getISOWeekString, getYearString } = await import('../js/lib/date-utils.js');
    const now = new Date();
    await db.setMeta('backups', {
      lastWeekly: getISOWeekString(now),
      lastMonthly: '2026-01', // different month — triggers monthly backup
      lastYearly: getYearString(now),
    });

    mockGetFile.mockResolvedValue(null);
    mockPutFile.mockResolvedValue('sha-new');

    await maybeCreateBackups(creds, key, undefined);

    expect(mockPutFile).toHaveBeenCalledTimes(1);
    expect(mockPutFile.mock.calls[0][2]).toBe('hayt-backup-monthly.json');
  });

  it('skips all backups when rate limit is below threshold', async () => {
    const key = await setupKey();
    await seedMoods();
    mockRateLimit = 5;

    await maybeCreateBackups(creds, key, undefined);

    expect(mockGetFile).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it('skips all backups when no moods exist', async () => {
    const key = await setupKey();
    // No moods seeded

    await maybeCreateBackups(creds, key, undefined);

    expect(mockGetFile).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it('continues other backups when one fails', async () => {
    const key = await setupKey();
    await seedMoods();

    mockGetFile.mockResolvedValue(null);
    // Weekly fails, monthly and yearly succeed
    mockPutFile
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('sha-monthly')
      .mockResolvedValueOnce('sha-yearly');

    await maybeCreateBackups(creds, key, undefined);

    expect(mockPutFile).toHaveBeenCalledTimes(3);

    // Only monthly and yearly should be in meta
    const meta = await db.getMeta('backups');
    expect(meta.lastWeekly).toBeUndefined();
    expect(meta.lastMonthly).toBeDefined();
    expect(meta.lastYearly).toBeDefined();
  });

  it('passes existing SHA when backup file already exists', async () => {
    const key = await setupKey();
    await seedMoods();

    mockGetFile.mockResolvedValue({ data: '{}', sha: 'existing-sha' });
    mockPutFile.mockResolvedValue('sha-new');

    await maybeCreateBackups(creds, key, undefined);

    // All putFile calls should use the existing SHA
    for (const call of mockPutFile.mock.calls) {
      expect(call[4]).toBe('existing-sha');
    }
  });

  it('passes null SHA when backup file does not exist', async () => {
    const key = await setupKey();
    await seedMoods();

    mockGetFile.mockResolvedValue(null);
    mockPutFile.mockResolvedValue('sha-new');

    await maybeCreateBackups(creds, key, undefined);

    for (const call of mockPutFile.mock.calls) {
      expect(call[4]).toBeUndefined();
    }
  });
});
