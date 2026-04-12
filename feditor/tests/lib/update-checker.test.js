// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { checkForUpdate } from '../../js/lib/update-checker.js';
import { APP_VERSION } from '../../js/lib/constants.js';

describe('checkForUpdate', () => {
  it('does not call onAvailable when server version matches APP_VERSION', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: APP_VERSION })
    });
    const onAvailable = vi.fn();
    await checkForUpdate({ onAvailable });
    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('calls onAvailable when server version differs from APP_VERSION', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: APP_VERSION + '-next' })
    });
    const onAvailable = vi.fn();
    await checkForUpdate({ onAvailable });
    expect(onAvailable).toHaveBeenCalledWith(APP_VERSION + '-next');
  });

  it('re-fires on every mismatch (stateless) so a blocking modal reappears', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: APP_VERSION + '-next' })
    });
    const onAvailable = vi.fn();
    await checkForUpdate({ onAvailable });
    await checkForUpdate({ onAvailable });
    expect(onAvailable).toHaveBeenCalledTimes(2);
  });

  it('swallows network errors silently', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const onAvailable = vi.fn();
    await expect(checkForUpdate({ onAvailable })).resolves.toBeUndefined();
    expect(onAvailable).not.toHaveBeenCalled();
  });
});
