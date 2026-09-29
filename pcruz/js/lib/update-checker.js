import { APP_VERSION } from './constants.js';

/**
 * Poll version.json (bypassing the SW cache) and, if the server reports a
 * version different from the one the running code was built with, invoke
 * onAvailable. The comparison is stateless — every call that sees a
 * mismatch fires the callback, so callers that need a blocking modal can
 * rely on it re-appearing if it is ever dismissed.
 */
export async function checkForUpdate({ onAvailable } = {}) {
  try {
    const res = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    if (version && version !== APP_VERSION) {
      if (onAvailable) onAvailable(version);
    }
  } catch {
    // Offline or transient — ignore.
  }
}
