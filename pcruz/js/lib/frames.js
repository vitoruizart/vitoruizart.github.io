// Standard photo-frame sizes (cm), stored portrait (w ≤ h). The pattern
// fills the frame's full nominal size. `name` is only set for paper sizes.
export const FRAMES = [
  { id: '10x15', w: 10, h: 15 },
  { id: '13x18', w: 13, h: 18 },
  { id: '15x20', w: 15, h: 20 },
  { id: '18x24', w: 18, h: 24 },
  { id: '20x20', w: 20, h: 20 },
  { id: '20x25', w: 20, h: 25 },
  { id: '20x30', w: 20, h: 30 },
  { id: 'a4', w: 21, h: 29.7, name: 'A4' },
  { id: '24x30', w: 24, h: 30 },
  { id: '30x30', w: 30, h: 30 },
  { id: '30x40', w: 30, h: 40 },
  { id: 'a3', w: 29.7, h: 42, name: 'A3' },
  { id: '30x45', w: 30, h: 45 },
  { id: '40x40', w: 40, h: 40 },
  { id: '40x50', w: 40, h: 50 },
  { id: '40x60', w: 40, h: 60 },
  { id: '50x70', w: 50, h: 70 }
];

// Aida counts = stitches per inch. `strands` is the usual number of floss
// strands (out of 6) for full coverage on that count.
export const FABRICS = [
  { count: 11, label: 'Aida 11', strands: 3 },
  { count: 14, label: 'Aida 14', strands: 2 },
  { count: 16, label: 'Aida 16', strands: 2 },
  { count: 18, label: 'Aida 18', strands: 2 }
];

export const DEFAULT_FRAME_ID = '20x25';
export const DEFAULT_COUNT = 14;

const CM_PER_INCH = 2.54;

export function findFrame(id) {
  return FRAMES.find((f) => f.id === id) || null;
}

export function findFabric(count) {
  return FABRICS.find((f) => f.count === count) || null;
}

export function frameDims(frame, orientation) {
  return orientation === 'landscape'
    ? { wCm: frame.h, hCm: frame.w }
    : { wCm: frame.w, hCm: frame.h };
}

export function stitchGrid(frame, count, orientation) {
  const { wCm, hCm } = frameDims(frame, orientation);
  return {
    cols: Math.max(1, Math.round((wCm / CM_PER_INCH) * count)),
    rows: Math.max(1, Math.round((hCm / CM_PER_INCH) * count))
  };
}

export function autoOrientation(imgW, imgH) {
  return imgW > imgH ? 'landscape' : 'portrait';
}
