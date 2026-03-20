import { describe, it, expect } from 'vitest';
import { escapeAttr, isValidPat, isValidRepo, PAT_RE, REPO_RE } from '../../js/lib/validators.js';

describe('escapeAttr', () => {
  it('escapes ampersands', () => {
    expect(escapeAttr('a&b')).toBe('a&amp;b');
  });

  it('escapes double quotes', () => {
    expect(escapeAttr('a"b')).toBe('a&quot;b');
  });

  it('escapes less-than', () => {
    expect(escapeAttr('a<b')).toBe('a&lt;b');
  });

  it('escapes greater-than', () => {
    expect(escapeAttr('a>b')).toBe('a&gt;b');
  });

  it('escapes all special chars at once', () => {
    expect(escapeAttr('"><script>')).toBe('&quot;&gt;&lt;script&gt;');
  });

  it('returns empty string unchanged', () => {
    expect(escapeAttr('')).toBe('');
  });

  it('returns plain string unchanged', () => {
    expect(escapeAttr('hello world')).toBe('hello world');
  });
});

describe('isValidPat', () => {
  it('accepts ghp_ prefix', () => {
    expect(isValidPat('ghp_abc123')).toBe(true);
  });

  it('accepts github_pat_ prefix', () => {
    expect(isValidPat('github_pat_abc123')).toBe(true);
  });

  it('rejects gho_ prefix', () => {
    expect(isValidPat('gho_abc123')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPat('')).toBe(false);
  });

  it('rejects random string', () => {
    expect(isValidPat('some-random-token')).toBe(false);
  });
});

describe('isValidRepo', () => {
  it('accepts user/repo format', () => {
    expect(isValidRepo('user/repo')).toBe(true);
  });

  it('accepts dots and hyphens', () => {
    expect(isValidRepo('my-user.name/my-repo.js')).toBe(true);
  });

  it('accepts underscores', () => {
    expect(isValidRepo('user_name/repo_name')).toBe(true);
  });

  it('rejects triple path', () => {
    expect(isValidRepo('user/repo/extra')).toBe(false);
  });

  it('rejects missing slash', () => {
    expect(isValidRepo('userrepo')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRepo('')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidRepo('user /repo')).toBe(false);
  });
});

describe('regex exports', () => {
  it('PAT_RE is a RegExp', () => {
    expect(PAT_RE).toBeInstanceOf(RegExp);
  });

  it('REPO_RE is a RegExp', () => {
    expect(REPO_RE).toBeInstanceOf(RegExp);
  });
});
