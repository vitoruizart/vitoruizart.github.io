export function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const PAT_RE = /^(ghp_|github_pat_)/;
export const REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function isValidPat(pat) {
  return PAT_RE.test(pat);
}

export function isValidRepo(repo) {
  return REPO_RE.test(repo);
}
