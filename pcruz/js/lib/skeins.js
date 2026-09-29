// A DMC Mouliné skein is 8 m of 6-strand floss.
const SKEIN_LENGTH_MM = 8000;
const STRANDS_PER_SKEIN = 6;
// Tails, starting/ending and travel between areas.
const WASTE_FACTOR = 1.25;

/**
 * Full cross stitches one skein covers. Thread per stitch: two diagonals on
 * the front (2·√2·cell) plus two cell-length runs on the back.
 */
export function stitchesPerSkein(count, strands) {
  const cellMm = 25.4 / count;
  const perStitchMm = (2 * Math.SQRT2 + 2) * cellMm * WASTE_FACTOR;
  const usableMm = (STRANDS_PER_SKEIN / strands) * SKEIN_LENGTH_MM;
  return Math.floor(usableMm / perStitchMm);
}

export function skeinsNeeded(stitches, count, strands) {
  if (stitches <= 0) return 0;
  return Math.ceil(stitches / stitchesPerSkein(count, strands));
}
