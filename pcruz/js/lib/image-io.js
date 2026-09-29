import { MAX_IMAGE_DIM } from './constants.js';

/**
 * Load a Blob into an ImageBitmap with EXIF orientation applied.
 * Falls back to <img> decoding when createImageBitmap is missing or rejects
 * (some HEIC paths on older Safari).
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
 * Downscale a bitmap so its longest edge ≤ maxDim. Returns a new bitmap
 * (or the original if already small enough).
 */
export async function downscaleBitmap(bitmap, maxDim = MAX_IMAGE_DIM) {
  const { w, h } = naturalSize(bitmap);
  const longest = Math.max(w, h);
  if (longest <= maxDim) return bitmap;
  const ratio = maxDim / longest;
  const tw = Math.round(w * ratio);
  const th = Math.round(h * ratio);
  const canvas = makeCanvas(tw, th);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, tw, th);
  if (canvas.transferToImageBitmap) return canvas.transferToImageBitmap();
  if (typeof createImageBitmap === 'function') return await createImageBitmap(canvas);
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

export function naturalSize(bitmap) {
  return { w: bitmap.naturalWidth || bitmap.width, h: bitmap.naturalHeight || bitmap.height };
}

/**
 * Lossless PNG of a bitmap. The draft stores this working copy rather than
 * the picked file: it carries no EXIF (camera GPS) and is already small
 * enough to decode safely at every launch.
 */
export async function bitmapToPng(bitmap) {
  const { w, h } = naturalSize(bitmap);
  const canvas = makeCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/** RGBA pixels of a whole bitmap. */
export function bitmapPixels(bitmap) {
  const { w, h } = naturalSize(bitmap);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}
