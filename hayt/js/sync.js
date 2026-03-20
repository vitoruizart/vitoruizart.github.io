// Sync engine — snapshot + changelog, compaction, keepalive flush
// Ported from gtd25 sync-engine.ts + change-log.ts, simplified for single entity type

import { getFile, putFile, RateLimitError, getRateLimitRemaining } from './github-api.js';
import {
  deriveKey, generateSalt, encryptEntity, decryptEntity,
  createVerifier, checkVerifier,
  hasEncryptionKey, getCachedEncryptionKey, cacheEncryptionKey, getCachedSalt,
} from './crypto.js';
import {
  getAllMoods, putMood, deleteMood as dbDeleteMood,
  addChangeEntry, getAllChangeEntries, clearChangeEntries,
  getMeta, setMeta,
} from './db.js';
import { SNAPSHOT_FILE, CHANGELOG_FILE, SYNC_VERSION, COMPACTION_THRESHOLD, POLL_INTERVAL_MS } from './lib/constants.js';
import { toast } from './components/toast.js';
import * as state from './state.js';

const MAX_RETRIES = 3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidMood(obj) {
  return obj
    && typeof obj === 'object'
    && typeof obj.id === 'string'
    && typeof obj.timestamp === 'number'
    && typeof obj.date === 'string' && DATE_RE.test(obj.date)
    && typeof obj.mood === 'number' && obj.mood >= 1 && obj.mood <= 5;
}

// Sync lock
let syncRunning = false;

// Cached state for keepalive flush
let cachedChangelogSha;
let cachedRemoteEntries = [];
let cachedCreds = null;
let cachedChangelogTimestamp = 0;

// Scheduler
let pollTimer = null;

function getCredentials() {
  const pat = localStorage.getItem('hayt-pat');
  const repo = localStorage.getItem('hayt-repo');
  const password = localStorage.getItem('hayt-password');
  if (!pat || !repo || !password) return null;
  return { pat, repo, password };
}

export function getDeviceId() {
  let id = localStorage.getItem('hayt-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('hayt-device-id', id);
  }
  return id;
}

async function resolveEncryptionKey(remoteSalt) {
  const creds = getCredentials();
  if (!creds?.password) return null;

  if (hasEncryptionKey()) {
    const cs = getCachedSalt();
    if (remoteSalt && cs === remoteSalt) return getCachedEncryptionKey();
    if (!remoteSalt) return getCachedEncryptionKey();
  }

  const salt = remoteSalt || getCachedSalt() || generateSalt();
  const key = await deriveKey(creds.password, salt);
  cacheEncryptionKey(key, salt);
  return key;
}

export function safeParseJson(raw, label) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    console.warn(`Failed to parse ${label}:`, err);
    return { ok: false };
  }
}

// --- Core sync ---

export async function syncNow(manual = false) {
  if (syncRunning) return;
  const creds = getCredentials();
  if (!creds) return;
  if (!navigator.onLine) return;

  syncRunning = true;
  state.set('syncStatus', 'syncing');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    cachedCreds = creds;
    const deviceId = getDeviceId();
    const signal = controller.signal;

    // Fetch remote files in parallel
    const [remoteSnapshotFile, remoteChangelogFile] = await Promise.all([
      getFile(creds.pat, creds.repo, SNAPSHOT_FILE, signal),
      getFile(creds.pat, creds.repo, CHANGELOG_FILE, signal),
    ]);

    // Resolve encryption key
    const remoteSalt = remoteSnapshotFile
      ? safeParseJson(remoteSnapshotFile.data, 'snapshot')?.value?.encryptionSalt
      : null;
    const encKey = await resolveEncryptionKey(remoteSalt);
    if (!encKey) {
      state.set('syncStatus', 'error');
      if (manual) toast('Contraseña de encriptación requerida', 'error');
      return;
    }

    // Parse remote data
    let remoteEntries = [];
    let changelogSha = remoteChangelogFile?.sha;
    if (remoteChangelogFile) {
      const parsed = safeParseJson(remoteChangelogFile.data, 'changelog');
      if (parsed.ok) remoteEntries = parsed.value;
    }

    let snapshotData = null;
    let snapshotSha = remoteSnapshotFile?.sha;
    if (remoteSnapshotFile) {
      const parsed = safeParseJson(remoteSnapshotFile.data, 'snapshot');
      if (parsed.ok) {
        snapshotData = parsed.value;
        // Verify encryption
        if (snapshotData.encryptionVerifier) {
          const valid = await checkVerifier(encKey, snapshotData.encryptionVerifier);
          if (!valid) {
            state.set('syncStatus', 'error');
            toast('Contraseña incorrecta', 'error');
            return;
          }
        }
      }
    }

    // --- PULL: apply remote entries from other devices ---
    const foreignEntries = [];
    for (const entry of remoteEntries) {
      if (entry.deviceId !== deviceId) {
        try {
          const decrypted = await decryptEntity(encKey, entry.data ?? {});
          foreignEntries.push({ ...entry, data: decrypted });
        } catch {
          console.warn('Failed to decrypt remote entry, skipping');
        }
      }
    }

    // Also reconcile from snapshot (catches compaction gaps)
    if (snapshotData?.moods) {
      const localMoods = new Map((await getAllMoods()).map(m => [m.id, m]));
      for (const remoteMood of snapshotData.moods) {
        try {
          const decrypted = await decryptEntity(encKey, remoteMood);
          if (!isValidMood(decrypted)) continue;
          if (!localMoods.has(decrypted.id)) {
            await putMood(decrypted);
          } else {
            const local = localMoods.get(decrypted.id);
            if (decrypted.timestamp > local.timestamp) {
              await putMood(decrypted);
            }
          }
        } catch {
          console.warn('Failed to decrypt snapshot mood, skipping');
        }
      }
    }

    // Apply foreign changelog entries
    if (foreignEntries.length > 0) {
      const localMoodsMap = new Map((await getAllMoods()).map(m => [m.id, m]));
      for (const entry of foreignEntries) {
        if (entry.operation === 'delete') {
          await dbDeleteMood(entry.entityId);
        } else if (entry.data) {
          if (!isValidMood(entry.data)) continue;
          const localMood = localMoodsMap.get(entry.entityId);
          if (!localMood || entry.timestamp > localMood.timestamp) {
            await putMood(entry.data);
            localMoodsMap.set(entry.data.id, entry.data);
          }
        }
      }
    }

    // --- PUSH: encrypt and append local changes ---
    const localEntries = await getAllChangeEntries();
    if (localEntries.length > 0) {
      const encryptedEntries = [];
      for (const entry of localEntries) {
        if (entry.data) {
          const encrypted = await encryptEntity(encKey, entry.data);
          encryptedEntries.push({ ...entry, data: encrypted });
        } else {
          encryptedEntries.push(entry);
        }
      }

      // Push changelog with retry on conflict
      let pushed = false;
      for (let attempt = 0; attempt < MAX_RETRIES && !pushed; attempt++) {
        const payload = [...remoteEntries, ...encryptedEntries];
        try {
          const newSha = await putFile(
            creds.pat, creds.repo, CHANGELOG_FILE,
            JSON.stringify(payload),
            changelogSha, signal,
          );
          changelogSha = newSha;
          pushed = true;
        } catch (err) {
          if (err.message === 'CONFLICT' && attempt < MAX_RETRIES - 1) {
            // Re-fetch remote entries and retry
            const fresh = await getFile(creds.pat, creds.repo, CHANGELOG_FILE, signal);
            if (fresh) {
              const parsed = safeParseJson(fresh.data, 'changelog retry');
              remoteEntries = parsed.ok ? parsed.value : [];
              changelogSha = fresh.sha;
            }
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          } else {
            throw err;
          }
        }
      }

      if (pushed) await clearChangeEntries();
    }

    // Cache for keepalive
    cachedChangelogSha = changelogSha;
    cachedRemoteEntries = [...remoteEntries, ...(localEntries.length > 0 ? localEntries : [])];
    cachedChangelogTimestamp = Date.now();

    // --- COMPACTION: merge changelog into snapshot ---
    const totalEntries = remoteEntries.length + localEntries.length;
    if (totalEntries >= COMPACTION_THRESHOLD) {
      await compact(creds, encKey, snapshotSha, changelogSha, signal);
    }

    // Update sync metadata
    const syncTime = Date.now();
    await setMeta('sync', { lastSyncAt: syncTime });
    state.set('lastSyncAt', syncTime);
    state.set('syncStatus', 'idle');
    state.set('syncError', null);
    state.set('moodsUpdated', Date.now());
    if (manual) toast('Sincronizado', 'success', 1500);

    // Warn on low rate limit
    const remaining = getRateLimitRemaining();
    if (remaining < 5) {
      toast(`API: quedan ${remaining} peticiones`, 'error', 5000);
      // Restart poll with extended interval
      stopPoll();
      startPoll();
    } else if (remaining < 10) {
      stopPoll();
      startPoll();
    }

  } catch (err) {
    console.error('Sync error:', err);
    state.set('syncStatus', 'error');
    state.set('syncError', err.message);
    if (manual) toast(`Error: ${err.message}`, 'error');
    if (err instanceof RateLimitError) {
      const waitSec = Math.ceil((err.resetAtMs - Date.now()) / 1000);
      toast(`Límite de API. Espera ${waitSec}s`, 'error', 5000);
    }
  } finally {
    clearTimeout(timeoutId);
    syncRunning = false;
  }
}

async function compact(creds, encKey, snapshotSha, changelogSha, signal) {
  try {
    const allMoods = await getAllMoods();
    const salt = getCachedSalt() || generateSalt();

    const encryptedMoods = await Promise.all(
      allMoods.map(m => encryptEntity(encKey, m)),
    );

    const snapshot = {
      syncVersion: SYNC_VERSION,
      encryptionSalt: salt,
      encryptionVerifier: await createVerifier(encKey),
      moods: encryptedMoods,
    };

    // Clear changelog FIRST — if snapshot write fails, data is safe in local
    // IndexedDB and will be re-pushed. Changelog entries are idempotent (upsert by ID).
    const newChangelogSha = await putFile(creds.pat, creds.repo, CHANGELOG_FILE, '[]', changelogSha, signal);
    await putFile(creds.pat, creds.repo, SNAPSHOT_FILE, JSON.stringify(snapshot), snapshotSha, signal);

    cachedRemoteEntries = [];
    cachedChangelogSha = newChangelogSha;
  } catch (err) {
    console.warn('Compaction failed (non-critical):', err);
  }
}

// --- Keepalive flush for iOS Safari ---
async function flushOnHide() {
  if (!cachedCreds || !cachedChangelogSha || !hasEncryptionKey()) return;
  if (Date.now() - cachedChangelogTimestamp > 60_000) return;

  try {
    const pending = await getAllChangeEntries();
    if (pending.length === 0) return;
    const encKey = getCachedEncryptionKey();
    const encrypted = [];
    for (const entry of pending) {
      if (entry.data) {
        encrypted.push({ ...entry, data: await encryptEntity(encKey, entry.data) });
      } else {
        encrypted.push(entry);
      }
    }
    const updatedChangelog = [...cachedRemoteEntries, ...encrypted];
    putFile(cachedCreds.pat, cachedCreds.repo, CHANGELOG_FILE,
      JSON.stringify(updatedChangelog), cachedChangelogSha, undefined, { keepalive: true })
      .catch(() => {}); // Best-effort — data is safe in IndexedDB
  } catch {
    // Best-effort — data is safe in local IndexedDB
  }
}

// --- Scheduler ---

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopPoll();
    flushOnHide();
  } else {
    syncNow();
    startPoll();
  }
}

export function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') syncNow();
  }, getPollInterval());
}

function getPollInterval() {
  const remaining = getRateLimitRemaining();
  if (remaining < 10) return 5 * 60 * 1000; // 5 min when rate limit is low
  return POLL_INTERVAL_MS;
}

export function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export function startSync() {
  const creds = getCredentials();
  if (!creds) return;

  syncNow();
  startPoll();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', () => syncNow());
}

export function stopSync() {
  stopPoll();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

// Expose for nav button
window._haytSync = { syncNow };
