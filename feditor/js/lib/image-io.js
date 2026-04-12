import { MAX_IMAGE_DIM } from './constants.js';

/**
 * Load a Blob into an ImageBitmap with EXIF orientation applied.
 * Falls back to <img> + canvas decoding when createImageBitmap is missing
 * or rejects (some HEIC paths on older Safari).
 */
export async function loadBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch (_) {
      // fall through
    }
  }
  return await imgFallback(blob);
}

function imgFallback(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Downscale a bitmap so its longest edge ≤ maxDim. Returns a new ImageBitmap
 * (or the original if already small enough).
 */
export async function downscaleBitmap(bitmap, maxDim = MAX_IMAGE_DIM) {
  const w = bitmap.width;
  const h = bitmap.height;
  const longest = Math.max(w, h);
  if (longest <= maxDim) return bitmap;
  const ratio = maxDim / longest;
  const tw = Math.round(w * ratio);
  const th = Math.round(h * ratio);
  const canvas = makeCanvas(tw, th);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, tw, th);
  if (typeof createImageBitmap === 'function' && canvas.transferToImageBitmap) {
    return canvas.transferToImageBitmap();
  }
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(canvas);
  }
  return canvas;
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Re-encode a bitmap-or-canvas to a Blob (JPEG by default).
 */
export async function bitmapToBlob(source, type = 'image/jpeg', quality = 0.92) {
  const w = source.width;
  const h = source.height;
  const canvas = source.getContext ? source : makeCanvas(w, h);
  if (canvas !== source) {
    canvas.getContext('2d').drawImage(source, 0, 0);
  }
  if (canvas.convertToBlob) {
    return await canvas.convertToBlob({ type, quality });
  }
  return await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function naturalSize(bitmap) {
  return { naturalW: bitmap.width || bitmap.naturalWidth, naturalH: bitmap.height || bitmap.naturalHeight };
}
