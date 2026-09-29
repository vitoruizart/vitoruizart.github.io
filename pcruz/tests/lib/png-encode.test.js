import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { encodePng } from '../../js/lib/png-encode.js';

// Minimal PNG reader for 8-bit RGB images using filter types 0 and 2 only.
function decodePng(buf) {
  expect(Array.from(buf.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let off = 8;
  let width, height;
  const idat = [];
  const types = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf.readUInt32BE(off + 8 + len);
    expect(crc).toBe(zlib.crc32(buf.subarray(off + 4, off + 8 + len)));
    types.push(type);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(Array.from(data.subarray(8))).toEqual([8, 2, 0, 0, 0]);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      pixels[y * stride + x] = filter === 2 ? (v + up) & 255 : v;
    }
  }
  return { width, height, pixels, types };
}

function rgbaSource(width, height, colorAt) {
  return async (y0, h) => {
    const out = new Uint8ClampedArray(width * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = colorAt(x, y0 + y);
        const i = (y * width + x) * 4;
        out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
      }
    }
    return out;
  };
}

describe('encodePng', () => {
  it('produces a valid PNG whose pixels round-trip exactly', async () => {
    const colorAt = (x, y) => [(x * 40) & 255, (y * 70) & 255, (x * y * 13) & 255];
    const blob = await encodePng(5, 4, rgbaSource(5, 4, colorAt), 3);
    expect(blob.type).toBe('image/png');
    const { width, height, pixels, types } = decodePng(Buffer.from(await blob.arrayBuffer()));
    expect([width, height]).toEqual([5, 4]);
    expect(types[0]).toBe('IHDR');
    expect(types[types.length - 1]).toBe('IEND');
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 5; x++) {
        expect(Array.from(pixels.subarray((y * 5 + x) * 3, (y * 5 + x) * 3 + 3))).toEqual(colorAt(x, y));
      }
    }
  });

  it('calls the row source in strips that cover the image exactly once', async () => {
    const calls = [];
    const src = rgbaSource(7, 10, () => [1, 2, 3]);
    await encodePng(7, 10, (y0, h) => { calls.push([y0, h]); return src(y0, h); }, 4);
    expect(calls).toEqual([[0, 4], [4, 4], [8, 2]]);
  });

  it('compresses repeated rows well (chart-like images)', async () => {
    const w = 2000, h = 200;
    const blob = await encodePng(w, h, rgbaSource(w, h, (x) => (x % 32 === 0 ? [0, 0, 0] : [220, 40, 40])), 64);
    expect(blob.size).toBeLessThan(w * h * 3 / 100);
  });

  it('rejects invalid dimensions', async () => {
    await expect(encodePng(0, 10, async () => new Uint8ClampedArray(0))).rejects.toThrow();
  });
});
