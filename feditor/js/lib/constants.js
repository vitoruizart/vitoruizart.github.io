export const DB_NAME = 'feditor';
export const DB_VERSION = 1;
export const STORAGE_PREFIX = 'feditor:';
export const MAX_IMAGE_DIM = 2560;
// Photo-mode export caps: the output canvas is upscaled so the painting's
// destination rectangle keeps its native pixel count. Capped to avoid
// pathological sizes and mobile canvas allocation failures.
export const MAX_OUTPUT_UPSCALE = 4;
export const MAX_CANVAS_DIM = 8192;
// Bump this in lockstep with version.json on every deploy. Installed PWAs
// compare it against the server's version.json to decide whether to show the
// blocking update modal.
export const APP_VERSION = '0.1.1';
