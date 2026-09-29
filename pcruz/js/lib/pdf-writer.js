/**
 * Minimal PDF 1.4 writer: one full-page raster image per page.
 * Each page's pixels are rendered by canvas beforehand, so the PDF needs no
 * fonts — symbols and text are already part of the image.
 *
 * pages: [{ widthPt, heightPt, image: { width, height, data } }]
 *   data — zlib-deflated 8-bit RGB (FlateDecode)
 * Returns a Blob (application/pdf).
 */
export function buildPdf(pages) {
  if (!pages.length) throw new Error('PDF needs at least one page');
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let size = 0;

  const push = (bytes) => { parts.push(bytes); size += bytes.length; };
  const text = (s) => push(enc.encode(s));
  const object = (num, body, stream) => {
    offsets[num] = size;
    text(`${num} 0 obj\n${body}\n`);
    if (stream) {
      text('stream\n');
      push(stream);
      text('\nendstream\n');
    }
    text('endobj\n');
  };

  text('%PDF-1.4\n');
  // Binary comment so transfer tools treat the file as binary.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // Object numbering: 1 catalog, 2 page tree, then 3 objects per page.
  const pageNum = (i) => 3 + i * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pages.map((_, i) => `${pageNum(i)} 0 R`).join(' ');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  pages.forEach((p, i) => {
    const n = pageNum(i);
    const w = fmt(p.widthPt);
    const h = fmt(p.heightPt);
    object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    const content = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    object(n + 1, `<< /Length ${content.length} >>`, content);
    const img = p.image;
    object(n + 2, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.data.length} >>`, img.data);
  });

  const count = 3 + pages.length * 3;
  const xrefStart = size;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  text(xref);
  text(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

function fmt(n) {
  return Number(n.toFixed(2)).toString();
}
