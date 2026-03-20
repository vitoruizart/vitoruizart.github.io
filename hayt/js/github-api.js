// GitHub API — ported from gtd25/src/sync/github-api.ts
// Provides getFile, putFile, testConnection for syncing to a private repo.

export class RateLimitError extends Error {
  constructor(resetAtMs) {
    super('GitHub API rate limit exceeded');
    this.name = 'RateLimitError';
    this.resetAtMs = resetAtMs;
  }
}

async function githubFetch(pat, repo, path, options, signal, keepalive) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const fetchSignal = keepalive
    ? undefined
    : signal
      ? AbortSignal.any([AbortSignal.timeout(15_000), signal])
      : AbortSignal.timeout(15_000);

  const resp = await fetch(url, {
    ...options,
    cache: 'no-store',
    signal: fetchSignal,
    keepalive,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (resp.status === 403) {
    const remaining = resp.headers.get('X-RateLimit-Remaining');
    const resetHeader = resp.headers.get('X-RateLimit-Reset');
    if (remaining === '0' && resetHeader) {
      throw new RateLimitError(parseInt(resetHeader, 10) * 1000);
    }
  }

  return resp;
}

function utf8ToBase64(str) {
  return btoa(
    Array.from(new TextEncoder().encode(str), b => String.fromCharCode(b)).join(''),
  );
}

function base64ToUtf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function testConnection(pat, repo) {
  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json' },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function getFile(pat, repo, path, signal) {
  const resp = await githubFetch(pat, repo, path, undefined, signal);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);

  const json = await resp.json();
  if (!json || typeof json.content !== 'string' || typeof json.sha !== 'string') {
    throw new Error(`Malformed GitHub response for ${path}: missing content or sha`);
  }

  let data;
  try {
    data = base64ToUtf8(json.content);
  } catch (err) {
    throw new Error(`Failed to decode base64 content for ${path}: ${err?.message ?? err}`);
  }
  return { data, sha: json.sha };
}

export async function putFile(pat, repo, path, content, sha, signal, options) {
  const body = {
    message: `hayt sync: ${path}`,
    content: utf8ToBase64(content),
  };
  if (sha) body.sha = sha;

  const resp = await githubFetch(pat, repo, path, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, signal, options?.keepalive);

  if (resp.status === 409) throw new Error('CONFLICT');
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);

  const json = await resp.json();
  return json.content.sha;
}
