import { STORAGE_PREFIX } from './constants.js';

const KEY = STORAGE_PREFIX + 'version';

/**
 * Poll version.json (bypassing SW cache) and prompt for reload if a newer
 * version is detected.
 */
export async function checkForUpdate({ onAvailable } = {}) {
  try {
    const res = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      localStorage.setItem(KEY, version);
      return;
    }
    if (stored !== version) {
      localStorage.setItem(KEY, version);
      if (onAvailable) onAvailable(version);
    }
  } catch {
    // Offline or transient — ignore.
  }
}
