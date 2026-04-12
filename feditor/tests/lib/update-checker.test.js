// @vitest-environment happy-dom
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { checkForUpdate } from '../../js/lib/update-checker.js';

beforeEach(() => {
  localStorage.clear();
});

describe('checkForUpdate', () => {
  it('first run records the version without calling onAvailable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' })
    });
    const onAvailable = vi.fn();
    await checkForUpdate({ onAvailable });
    expect(onAvailable).not.toHaveBeenCalled();
    expect(localStorage.getItem('feditor:version')).toBe('1.0.0');
  });

  it('calls onAvailable when version changes', async () => {
    localStorage.setItem('feditor:version', '1.0.0');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.1' })
    });
    const onAvailable = vi.fn();
    await checkForUpdate({ onAvailable });
    expect(onAvailable).toHaveBeenCalledWith('1.0.1');
    expect(localStorage.getItem('feditor:version')).toBe('1.0.1');
  });

  it('does not call onAvailable when version unchanged', async () => {
    localStorage.setItem('feditor:version', '1.0.0');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' })
    });
    const onAvailable = vi.fn();
    await checkForUpdate({ onAvailable });
    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('swallows network errors silently', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const onAvailable = vi.fn();
    await expect(checkForUpdate({ onAvailable })).resolves.toBeUndefined();
    expect(onAvailable).not.toHaveBeenCalled();
  });
});
