import { createDeflater } from './zlib.js';

/**
 * Streaming PNG encoder (8-bit RGB, no alpha).
 *
 * Canvas can't hold the whole chart on mobile (iOS caps a canvas at ~16.7 MP),
 * so the caller renders horizontal strips and hands us their RGBA pixels; we
 * compress them as they come. Each compressed chunk becomes its own IDAT
 * chunk — decoders concatenate consecutive IDATs.
 *
 * Rows use the PNG "Up" filter: chart rows repeat for a whole cell height, so
 * an identical row turns into zeros and compresses to almost nothing (plain
 * deflate can't see the repeat once a row is wider than its 32 KB window).
 *
 * getRows(y0, h) → RGBA bytes for rows [y0, y0 + h), width*h*4 long.
 */
export async function encodePng(width, height, getRows, stripHeight = 256) {
  if (!(width > 0 && height > 0)) throw new Error('invalid PNG dimensions');
  const stride = width * 3;
  const deflater = createDeflater();
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);

  for (let y0 = 0; y0 < height; y0 += stripHeight) {
    const h = Math.min(stripHeight, height - y0);
    const rgba = await getRows(y0, h);
    const out = new Uint8Array(h * (stride + 1));
    for (let y = 0; y < h; y++) {
      const src = y * width * 4;
      for (let x = 0, s = src; x < stride; x += 3, s += 4) {
        cur[x] = rgba[s];
        cur[x + 1] = rgba[s + 1];
        cur[x + 2] = rgba[s + 2];
      }
      const o = y * (stride + 1);
      out[o] = 2; // filter: Up
      for (let x = 0; x < stride; x++) out[o + 1 + x] = (cur[x] - prev[x]) & 255;
      [prev, cur] = [cur, prev];
    }
    await deflater.write(out);
  }
  const compressed = await deflater.finish();

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8); // bit depth 8, colour type RGB, deflate, filter set 0, no interlace

  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunk('IHDR', ihdr)];
  for (const c of compressed) parts.push(...chunk('IDAT', c));
  parts.push(...chunk('IEND', new Uint8Array(0)));
  return new Blob(parts, { type: 'image/png' });
}

function chunk(type, data) {
  const head = new Uint8Array(8);
  const view = new DataView(head.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) head[4 + i] = type.charCodeAt(i);
  let crc = crc32Update(0xffffffff, head, 4, 8);
  crc = crc32Update(crc, data, 0, data.length);
  const tail = new Uint8Array(4);
  new DataView(tail.buffer).setUint32(0, (crc ^ 0xffffffff) >>> 0);
  return [head, data, tail];
}

let crcTable = null;

function crc32Update(crc, bytes, start, end) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = crc;
  for (let i = start; i < end; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c >>> 0;
}
