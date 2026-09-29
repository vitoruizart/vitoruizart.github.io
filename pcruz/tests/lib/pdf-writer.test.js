import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { buildPdf } from '../../js/lib/pdf-writer.js';

function page(width, height, rgb) {
  const raw = new Uint8Array(width * height * 3);
  for (let i = 0; i < raw.length; i += 3) raw.set(rgb, i);
  return { widthPt: 595.28, heightPt: 841.89, image: { width, height, data: new Uint8Array(zlib.deflateSync(raw)) } };
}

async function build(pages) {
  const blob = buildPdf(pages);
  expect(blob.type).toBe('application/pdf');
  return Buffer.from(await blob.arrayBuffer());
}

describe('buildPdf', () => {
  it('writes a PDF header and trailer', async () => {
    const buf = await build([page(2, 2, [255, 0, 0])]);
    expect(buf.toString('latin1', 0, 8)).toBe('%PDF-1.4');
    expect(buf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('has one page object per input page', async () => {
    const buf = await build([page(2, 2, [255, 0, 0]), page(3, 1, [0, 255, 0]), page(1, 1, [0, 0, 255])]);
    const text = buf.toString('latin1');
    expect(text.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(3);
    expect(text).toContain('/Count 3');
  });

  it('has an xref table whose offsets point at the right objects', async () => {
    const buf = await build([page(2, 2, [1, 2, 3]), page(2, 2, [4, 5, 6])]);
    const text = buf.toString('latin1');
    const startxref = Number(text.match(/startxref\s+(\d+)/)[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const [, first, count] = text.slice(startxref).match(/xref\s+(\d+) (\d+)/);
    expect(Number(first)).toBe(0);
    const entries = text.slice(startxref).split('\n').slice(2, 2 + Number(count));
    entries.slice(1).forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    for (const line of entries) expect(line.length).toBe(19); // 20 bytes with '\n'
  });

  it('embeds each page image as a FlateDecode RGB XObject', async () => {
    const buf = await build([page(3, 2, [10, 20, 30])]);
    const text = buf.toString('latin1');
    expect(text).toMatch(/\/Subtype \/Image \/Width 3 \/Height 2 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/FlateDecode/);
    const imgAt = text.indexOf('/Subtype /Image');
    const m = text.slice(imgAt).match(/\/Length (\d+) >>\nstream\n/);
    const start = imgAt + m.index + m[0].length;
    const data = buf.subarray(start, start + Number(m[1]));
    expect(Array.from(zlib.inflateSync(data))).toEqual([10, 20, 30, 10, 20, 30, 10, 20, 30, 10, 20, 30, 10, 20, 30, 10, 20, 30]);
  });

  it('refuses an empty document', () => {
    expect(() => buildPdf([])).toThrow();
  });
});
