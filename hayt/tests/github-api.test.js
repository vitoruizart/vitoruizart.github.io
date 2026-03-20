import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testConnection, getFile, putFile, RateLimitError } from '../js/github-api.js';

const PAT = 'ghp_testtoken';
const REPO = 'user/repo';

function mockFetch(response) {
  return vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)));
}

function makeResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: {
      get: (name) => headers[name] ?? null,
    },
  };
}

// Encode string to base64 matching the GitHub API format
function utf8ToBase64(str) {
  return btoa(
    Array.from(new TextEncoder().encode(str), b => String.fromCharCode(b)).join(''),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('testConnection', () => {
  it('returns true on 200', async () => {
    mockFetch(makeResponse(200, {}));
    const result = await testConnection(PAT, REPO);
    expect(result).toBe(true);
  });

  it('returns false on 404', async () => {
    mockFetch(makeResponse(404, {}));
    const result = await testConnection(PAT, REPO);
    expect(result).toBe(false);
  });

  it('returns false on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    const result = await testConnection(PAT, REPO);
    expect(result).toBe(false);
  });
});

describe('getFile', () => {
  it('returns data and sha on 200', async () => {
    const content = '{"test": true}';
    mockFetch(makeResponse(200, {
      content: utf8ToBase64(content),
      sha: 'abc123',
    }));
    const result = await getFile(PAT, REPO, 'test.json');
    expect(result.data).toBe(content);
    expect(result.sha).toBe('abc123');
  });

  it('returns null on 404', async () => {
    mockFetch(makeResponse(404, {}));
    const result = await getFile(PAT, REPO, 'missing.json');
    expect(result).toBeNull();
  });

  it('retries once on 5xx then throws if still failing', async () => {
    const mockFetchFn = vi.fn(() => Promise.resolve(makeResponse(500, {})));
    vi.stubGlobal('fetch', mockFetchFn);
    await expect(getFile(PAT, REPO, 'test.json')).rejects.toThrow('GitHub API error: 500');
    expect(mockFetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries once on 5xx and succeeds on second attempt', async () => {
    const content = '{"ok":true}';
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeResponse(502, {}));
      return Promise.resolve(makeResponse(200, { content: utf8ToBase64(content), sha: 'abc' }));
    }));
    const result = await getFile(PAT, REPO, 'test.json');
    expect(result.data).toBe(content);
    expect(callCount).toBe(2);
  });

  it('throws on malformed response (missing content)', async () => {
    mockFetch(makeResponse(200, { sha: 'abc' }));
    await expect(getFile(PAT, REPO, 'test.json')).rejects.toThrow('Malformed GitHub response');
  });

  it('throws on malformed response (missing sha)', async () => {
    mockFetch(makeResponse(200, { content: utf8ToBase64('x') }));
    await expect(getFile(PAT, REPO, 'test.json')).rejects.toThrow('Malformed GitHub response');
  });

  it('throws RateLimitError on 403 with rate limit headers', async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60;
    mockFetch(makeResponse(403, {}, {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetTime),
    }));
    await expect(getFile(PAT, REPO, 'test.json')).rejects.toThrow(RateLimitError);
  });
});

describe('putFile', () => {
  it('returns new sha on success', async () => {
    mockFetch(makeResponse(200, { content: { sha: 'new-sha' } }));
    const sha = await putFile(PAT, REPO, 'test.json', '{}', 'old-sha');
    expect(sha).toBe('new-sha');
  });

  it('throws CONFLICT on 409', async () => {
    mockFetch(makeResponse(409, {}));
    await expect(putFile(PAT, REPO, 'test.json', '{}', 'old-sha')).rejects.toThrow('CONFLICT');
  });

  it('throws on other errors after retry', async () => {
    const mockFetchFn = vi.fn(() => Promise.resolve(makeResponse(500, {})));
    vi.stubGlobal('fetch', mockFetchFn);
    await expect(putFile(PAT, REPO, 'test.json', '{}', 'old-sha')).rejects.toThrow('GitHub API error: 500');
    expect(mockFetchFn).toHaveBeenCalledTimes(2); // original + 1 retry
  });

  it('sends correct body structure', async () => {
    const mockFetchFn = vi.fn(() => Promise.resolve(makeResponse(200, { content: { sha: 's' } })));
    vi.stubGlobal('fetch', mockFetchFn);
    await putFile(PAT, REPO, 'test.json', '{"data":1}', 'sha-old');

    const call = mockFetchFn.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.message).toContain('hayt sync');
    expect(body.sha).toBe('sha-old');
    expect(typeof body.content).toBe('string');
  });

  it('sends Authorization header', async () => {
    const mockFetchFn = vi.fn(() => Promise.resolve(makeResponse(200, { content: { sha: 's' } })));
    vi.stubGlobal('fetch', mockFetchFn);
    await putFile(PAT, REPO, 'test.json', '{}');

    const call = mockFetchFn.mock.calls[0];
    expect(call[1].headers.Authorization).toBe(`Bearer ${PAT}`);
  });
});

describe('RateLimitError', () => {
  it('has correct name and properties', () => {
    const err = new RateLimitError(1000);
    expect(err.name).toBe('RateLimitError');
    expect(err.resetAtMs).toBe(1000);
    expect(err).toBeInstanceOf(Error);
  });
});
