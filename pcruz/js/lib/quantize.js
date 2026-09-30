import { DMC_COLORS } from './dmc.js';
import { rgbToLab, deltaE2000 } from './color.js';
import { SYMBOLS } from './symbols.js';
import { FABRIC } from './constants.js';

// k-means trains on at most this many cells; every cell is still mapped.
const MAX_SAMPLES = 20000;
const MAX_ITERATIONS = 20;

let dmcLabs = null;

/**
 * Turn per-stitch RGB colours into a DMC pattern with at most maxColors
 * threads:
 *   1. k-means (k-means++ seeded, deterministic) in CIELAB picks 2×maxColors
 *      representative colours. Over-clustering matters: neighbouring
 *      clusters often land on the same DMC thread and collapse.
 *   2. Each representative becomes its closest DMC thread by ΔE2000.
 *   3. If more than maxColors threads remain, the cheapest ones are merged
 *      away (see mergeThreads).
 *   4. Every stitch takes the closest of the surviving threads.
 *
 * cells:  Uint8Array RGB, cols*rows*3.
 * fabric: optional Uint8Array(cols*rows), 1 = bare fabric (not stitched,
 *         ignored when picking colours, index FABRIC).
 * Returns { cols, rows, palette: [{ code, name, hex, rgb, symbol, count }],
 *           indices: Uint16Array(cols*rows) into palette, or FABRIC }.
 * Palette is sorted by stitch count (most used first).
 */
export function buildPattern(cells, cols, rows, maxColors, { seed = 1, fabric = null } = {}) {
  const n = cols * rows;
  const labCache = new Map();
  const labs = new Float64Array(n * 3);
  // RGB packed into 24 bits, or -1 for a fabric cell.
  const keys = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (fabric && fabric[i]) { keys[i] = -1; continue; }
    const key = (cells[i * 3] << 16) | (cells[i * 3 + 1] << 8) | cells[i * 3 + 2];
    keys[i] = key;
    let lab = labCache.get(key);
    if (!lab) {
      lab = rgbToLab([cells[i * 3], cells[i * 3 + 1], cells[i * 3 + 2]]);
      labCache.set(key, lab);
    }
    labs[i * 3] = lab[0];
    labs[i * 3 + 1] = lab[1];
    labs[i * 3 + 2] = lab[2];
  }

  const centroids = labCache.size <= maxColors
    ? Array.from(labCache.values())
    : kMeans(samplePoints(labs, keys), Math.min(maxColors * 2, labCache.size), seed);

  let threads = [...new Set(centroids.map(nearestDmc))];
  let { raw, counts } = assignCells(threads, keys, labs);
  if (threads.length > maxColors) {
    threads = mergeThreads(threads, counts, maxColors);
    ({ raw, counts } = assignCells(threads, keys, labs));
  }

  const order = threads
    .map((_, i) => i)
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a] || DMC_COLORS[threads[a]].code.localeCompare(DMC_COLORS[threads[b]].code));
  const remap = new Uint16Array(threads.length);
  order.forEach((oldIdx, newIdx) => { remap[oldIdx] = newIdx; });

  const palette = order.map((oldIdx, newIdx) => {
    const dmc = DMC_COLORS[threads[oldIdx]];
    return { code: dmc.code, name: dmc.name, hex: dmc.hex, rgb: dmc.rgb, symbol: SYMBOLS[newIdx], count: counts[oldIdx] };
  });
  const indices = new Uint16Array(n);
  for (let i = 0; i < n; i++) indices[i] = raw[i] === FABRIC ? FABRIC : remap[raw[i]];

  return { cols, rows, palette, indices };
}

// Nearest thread per cell; each distinct cell colour is resolved once.
function assignCells(threads, keys, labs) {
  const threadLabs = threads.map((t) => getDmcLabs()[t]);
  const cache = new Map();
  const raw = new Uint16Array(keys.length);
  const counts = new Array(threads.length).fill(0);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] < 0) { raw[i] = FABRIC; continue; }
    let t = cache.get(keys[i]);
    if (t === undefined) {
      t = nearestIndex(labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2], threadLabs);
      cache.set(keys[i], t);
    }
    raw[i] = t;
    counts[t]++;
  }
  return { raw, counts };
}

/**
 * Merge threads pairwise until `target` remain, always taking the pair with
 * the smallest Ward cost: w_a·w_b / (w_a + w_b) · ΔE2000². That is the least
 * added colour error, and the squared distance keeps a rare but very
 * different colour (eyes, lips) while near-duplicates merge first. The
 * heavier thread of the pair survives.
 */
function mergeThreads(threads, counts, target) {
  const all = getDmcLabs();
  const m = threads.length;
  const dist2 = threads.map((a) => threads.map((b) => deltaE2000(all[a], all[b]) ** 2));
  const alive = new Array(m).fill(true);
  const weight = counts.slice();
  for (let remaining = m; remaining > target; remaining--) {
    let a = -1;
    let b = -1;
    let best = Infinity;
    for (let i = 0; i < m; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < m; j++) {
        if (!alive[j]) continue;
        const sum = weight[i] + weight[j];
        const cost = sum === 0 ? 0 : (weight[i] * weight[j] / sum) * dist2[i][j];
        if (cost < best) { best = cost; a = i; b = j; }
      }
    }
    const [victim, into] = weight[a] >= weight[b] ? [b, a] : [a, b];
    alive[victim] = false;
    weight[into] += weight[victim];
  }
  return threads.filter((_, i) => alive[i]);
}

function getDmcLabs() {
  if (!dmcLabs) dmcLabs = DMC_COLORS.map((c) => rgbToLab(c.rgb));
  return dmcLabs;
}

function nearestDmc(lab) {
  const all = getDmcLabs();
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < all.length; i++) {
    const d = deltaE2000(lab, all[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function nearestIndex(L, a, b, list) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const dL = L - c[0], da = a - c[1], db = b - c[2];
    const d = dL * dL + da * da + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Every step-th stitched cell, so a mostly-fabric grid still yields samples.
function samplePoints(labs, keys) {
  let stitched = 0;
  for (const k of keys) if (k >= 0) stitched++;
  const step = Math.max(1, Math.floor(stitched / MAX_SAMPLES));
  const points = [];
  for (let i = 0, j = 0; i < keys.length; i++) {
    if (keys[i] < 0) continue;
    if (j++ % step === 0) points.push([labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]]);
  }
  return points;
}

function kMeans(points, k, seed) {
  const rand = mulberry32(seed);
  const centroids = initPlusPlus(points, k, rand);
  const assign = new Int32Array(points.length).fill(-1);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const c = nearestIndex(p[0], p[1], p[2], centroids);
      if (c !== assign[i]) { assign[i] = c; changed++; }
    }
    if (changed === 0) break;
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]];
      s[0] += points[i][0]; s[1] += points[i][1]; s[2] += points[i][2]; s[3]++;
    }
    // An empty cluster keeps its previous centroid.
    sums.forEach((s, c) => {
      if (s[3] > 0) centroids[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centroids;
}

function initPlusPlus(points, k, rand) {
  const centroids = [points[Math.floor(rand() * points.length)]];
  const dist = points.map((p) => sqDist(p, centroids[0]));
  while (centroids.length < k) {
    let total = 0;
    for (const d of dist) total += d;
    if (total === 0) break; // fewer distinct colours than k
    let r = rand() * total;
    let pick = 0;
    while (pick < points.length - 1 && r >= dist[pick]) { r -= dist[pick]; pick++; }
    const c = points[pick];
    centroids.push(c);
    for (let i = 0; i < points.length; i++) dist[i] = Math.min(dist[i], sqDist(points[i], c));
  }
  return centroids;
}

function sqDist(p, q) {
  const a = p[0] - q[0], b = p[1] - q[1], c = p[2] - q[2];
  return a * a + b * b + c * c;
}

// Small seeded PRNG so the same photo always gives the same pattern.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
