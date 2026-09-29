// zlib (RFC 1950) compression via the platform's CompressionStream. 'deflate'
// is the zlib-wrapped format, which is exactly what both PNG IDAT and PDF
// FlateDecode expect.

/** Streaming compressor: write() chunks, then finish() → compressed chunks. */
export function createDeflater() {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  const done = collect(cs.readable);
  return {
    write: (bytes) => writer.write(bytes),
    async finish() {
      await writer.close();
      return done;
    }
  };
}

export async function deflate(bytes) {
  const d = createDeflater();
  d.write(bytes);
  return concat(await d.finish());
}

async function collect(readable) {
  const reader = readable.getReader();
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

export function concat(chunks) {
  let length = 0;
  for (const c of chunks) length += c.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
