export const DB_NAME = 'pcruz';
export const DB_VERSION = 1;
export const STORAGE_PREFIX = 'pcruz:';
// Cache Storage is shared by every app on this origin (feditor, hayt…):
// only ever delete caches with this prefix. Keep in sync with sw.js.
export const CACHE_PREFIX = 'pcruz-';
// Working copy of the photo. The densest grid (50×70 cm on Aida 18) is
// ~354×496 stitches, so this leaves several source pixels per stitch even
// at the maximum crop zoom.
export const MAX_IMAGE_DIM = 2560;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Pattern index of a cell left as bare fabric: the white margin between the
// photo and the frame. It has no palette entry, symbol or stitches.
export const FABRIC = 0xffff;

export const MIN_COLORS = 2;
export const MAX_COLORS = 60;
export const DEFAULT_COLORS = 20;

// Single-sheet PNG: pixels per stitch are picked so the whole image stays
// within the budget, then clamped. 16 px keeps symbols legible when zoomed.
export const PNG_PIXEL_BUDGET = 40_000_000;
export const MIN_CELL_PX = 16;
export const MAX_CELL_PX = 32;

// Bump this in lockstep with version.json on every deploy. Installed PWAs
// compare it against the server's version.json to decide whether to show the
// blocking update modal.
export const APP_VERSION = '0.2.4';
