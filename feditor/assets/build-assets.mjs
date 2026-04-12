// Procedural asset generator for bundled frames and sample walls.
// Run with: node assets/build-assets.mjs
// Output: assets/frames/*.png + thumbs, assets/rooms/*.jpg + thumbs, index.json files.
//
// Design notes
// ------------
// Frames are 256×256 tileable square strips for the 9-slice renderer.
// To avoid the "stitched" look (each edge extracted from a different y-band
// of a linear gradient), each frame is drawn as FOUR mitered trapezoidal
// strips, like a real picture frame joined at 45° corners. Each strip has
// its own gradient perpendicular to its own edge, all using the SAME color
// profile. Consequences:
//   - every edge (top/right/bottom/left) has identical cross-section color
//   - the middle portion of each edge has no variation along the edge, so
//     tiling in either direction stays visually continuous
//   - 9-slice corners naturally capture the 45° miter joint between two
//     adjacent trapezoids, which looks like a real frame corner
// The central hole is a dark rectangle so the CSS "fill" slice can show
// nothing meaningful through gaps (the painting itself covers it anyway).
//
// Rooms are replaced with 3 neutral "sample wall" scenes: a wall plane with
// a subtle floor strip and soft lighting gradient. They're clean backdrops
// so a painting reads clearly; the user's own uploaded room photos remain
// the primary path.

import sharp from 'sharp';
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';

mkdirSync('assets/frames/thumbs', { recursive: true });
mkdirSync('assets/rooms/thumbs', { recursive: true });

// ---------------- Frames ----------------

const FRAME_SIZE = 256;

const frames = [
  {
    id: 'black-thin',
    name: 'Negro fino',
    sliceWidth: 0.18,
    borderFrac: 0.03,
    svg: blackThinSvg
  },
  {
    id: 'wood-oak',
    name: 'Roble natural',
    sliceWidth: 0.28,
    borderFrac: 0.06,
    svg: woodOakSvg
  },
  {
    id: 'white-painted',
    name: 'Blanco pintado',
    sliceWidth: 0.24,
    borderFrac: 0.05,
    svg: whitePaintedSvg
  },
  {
    id: 'gold-classic',
    name: 'Oro clásico',
    sliceWidth: 0.30,
    borderFrac: 0.07,
    svg: goldClassicSvg
  },
  {
    id: 'wood-walnut',
    name: 'Nogal oscuro',
    sliceWidth: 0.26,
    borderFrac: 0.055,
    svg: woodWalnutSvg
  },
  {
    id: 'gold-aged',
    name: 'Oro envejecido',
    sliceWidth: 0.30,
    borderFrac: 0.07,
    svg: goldAgedSvg
  },
  {
    id: 'canvas-wrap',
    name: 'Lienzo',
    sliceWidth: 0.20,
    borderFrac: 0.035,
    svg: canvasWrapSvg
  }
];

// Mitered-frame generator.
//
// `profile` is an ordered list of colored bands that describe the cross-section
// of one wood piece from outer edge (t=0) to inner edge (t=1). Each band has
// { pos, color } — pos is 0..1 along the cross-section. A linear gradient is
// built from the stops. The profile is applied perpendicular to each side.
//
// The four sides meet at 45° miter joints drawn from the outer corners
// (0,0 / s,0 / s,s / 0,s) to the inner-opening corners (f,f / s-f,f / ...).
function miteredFrameSvg(s, f, profile, { innerFill = '#141414' } = {}) {
  const g = (id, x1, y1, x2, y2) => `
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      ${profile.map(p => `<stop offset="${p.pos}" stop-color="${p.color}"/>`).join('')}
    </linearGradient>`;
  // Each side's gradient goes from the outer edge (pos=0) to the inner edge
  // (pos=1) of that side. Coordinates are in userSpace (absolute).
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
      <defs>
        ${g('topG',    0, 0, 0, f)}
        ${g('botG',    0, s, 0, s - f)}
        ${g('leftG',   0, 0, f, 0)}
        ${g('rightG',  s, 0, s - f, 0)}
      </defs>
      <!-- Inner hole fill -->
      <rect x="${f}" y="${f}" width="${s - 2*f}" height="${s - 2*f}" fill="${innerFill}"/>
      <!-- Four mitered strips -->
      <polygon points="0,0 ${s},0 ${s - f},${f} ${f},${f}" fill="url(#topG)"/>
      <polygon points="${s},0 ${s},${s} ${s - f},${s - f} ${s - f},${f}" fill="url(#rightG)"/>
      <polygon points="0,${s} ${s},${s} ${s - f},${s - f} ${f},${s - f}" fill="url(#botG)"/>
      <polygon points="0,0 ${f},${f} ${f},${s - f} 0,${s}" fill="url(#leftG)"/>
      <!-- Thin miter-line accents (hairlines at the 45° joints) -->
      <line x1="0" y1="0" x2="${f}" y2="${f}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>
      <line x1="${s}" y1="0" x2="${s - f}" y2="${f}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>
      <line x1="${s}" y1="${s}" x2="${s - f}" y2="${s - f}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>
      <line x1="0" y1="${s}" x2="${f}" y2="${s - f}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>
    </svg>`;
}

// Thin matte black: near-flat profile with a faint outer highlight and a
// darker inner lip.
function blackThinSvg(s) {
  return miteredFrameSvg(s, s * 0.18, [
    { pos: 0,    color: '#1e1e1e' },
    { pos: 0.1,  color: '#1a1a1a' },
    { pos: 0.9,  color: '#1a1a1a' },
    { pos: 1,    color: '#0d0d0d' }
  ]);
}

// Natural oak: warm tan, slight bevel (lighter near outer edge, darker near
// inner rabbet).
function woodOakSvg(s) {
  return miteredFrameSvg(s, s * 0.28, [
    { pos: 0,    color: '#b07a40' },
    { pos: 0.1,  color: '#b88548' },
    { pos: 0.5,  color: '#b58146' },
    { pos: 0.88, color: '#a87539' },
    { pos: 1,    color: '#6b4520' }
  ], { innerFill: '#2a1a06' });
}

// White painted: bright face with a soft cream shadow near the inner lip.
function whitePaintedSvg(s) {
  return miteredFrameSvg(s, s * 0.24, [
    { pos: 0,    color: '#f4eee3' },
    { pos: 0.1,  color: '#f9f3e8' },
    { pos: 0.85, color: '#f2ece0' },
    { pos: 1,    color: '#c9c2b3' }
  ], { innerFill: '#d8d2c3' });
}

// Classic gold: highlight near outer edge, deepening to aged antique near
// the inner rabbet.
function goldClassicSvg(s) {
  return miteredFrameSvg(s, s * 0.30, [
    { pos: 0,    color: '#c79a42' },
    { pos: 0.1,  color: '#dfb560' },
    { pos: 0.5,  color: '#d4a74f' },
    { pos: 0.88, color: '#b8873a' },
    { pos: 1,    color: '#7a5820' }
  ], { innerFill: '#6a4a1c' });
}

// Dark walnut: rich brown face with deeper brown toward the inner lip.
function woodWalnutSvg(s) {
  return miteredFrameSvg(s, s * 0.26, [
    { pos: 0,    color: '#4a2e1a' },
    { pos: 0.1,  color: '#5a3a22' },
    { pos: 0.5,  color: '#563620' },
    { pos: 0.88, color: '#40281a' },
    { pos: 1,    color: '#1e120a' }
  ], { innerFill: '#180e06' });
}

// Aged gold: muted ochre face with greenish patina tones, darker inner lip.
function goldAgedSvg(s) {
  return miteredFrameSvg(s, s * 0.30, [
    { pos: 0,    color: '#8e7338' },
    { pos: 0.1,  color: '#a88a48' },
    { pos: 0.45, color: '#9e8240' },
    { pos: 0.7,  color: '#7d6a36' },
    { pos: 0.88, color: '#5c4a24' },
    { pos: 1,    color: '#3a2e14' }
  ], { innerFill: '#2e2410' });
}

// Canvas gallery wrap: thin off-white linen edge, subtle shadow at the inner
// lip where the canvas wraps the stretcher.
function canvasWrapSvg(s) {
  return miteredFrameSvg(s, s * 0.20, [
    { pos: 0,    color: '#e8e0cf' },
    { pos: 0.1,  color: '#efe8d8' },
    { pos: 0.85, color: '#e2dac8' },
    { pos: 1,    color: '#9e9684' }
  ], { innerFill: '#bab3a0' });
}

const frameIndex = [];
for (const f of frames) {
  const svg = Buffer.from(f.svg(FRAME_SIZE));
  const file = `${f.id}.png`;
  await sharp(svg).png().toFile(`assets/frames/${file}`);
  await sharp(svg).resize(120, 120).png().toFile(`assets/frames/thumbs/${f.id}.png`);
  frameIndex.push({
    id: f.id,
    name: f.name,
    file,
    sliceWidth: f.sliceWidth,
    borderFrac: f.borderFrac
  });
  console.log('frame:', f.id);
}
writeFileSync('assets/frames/index.json', JSON.stringify(frameIndex, null, 2) + '\n');

// ---------------- Sample walls ----------------
// Neutral backdrops: wall + floor split with soft vignette. The upload flow
// is the primary path; these are just clean first-run defaults.

const ROOM_W = 1600;
const ROOM_H = 1067;

const walls = [
  {
    id: 'wall-warm-white',
    name: 'Pared blanca cálida',
    wall: '#ece5d6',
    floor: '#8a6e4a',
    skirting: '#c6bba5'
  },
  {
    id: 'wall-cool-grey',
    name: 'Pared gris frío',
    wall: '#cfd4d8',
    floor: '#4a4e54',
    skirting: '#a8adb2'
  },
  {
    id: 'wall-warm-beige',
    name: 'Pared beige',
    wall: '#e1d3bc',
    floor: '#6b4e32',
    skirting: '#bfad90'
  }
];

function wallSvg(c) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ROOM_W}" height="${ROOM_H}">
      <defs>
        <radialGradient id="light" cx="0.5" cy="0.35" r="0.8">
          <stop offset="0" stop-color="white" stop-opacity="0.18"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="black" stop-opacity="0.10"/>
          <stop offset="0.4" stop-color="black" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="black" stop-opacity="0.25"/>
          <stop offset="1" stop-color="black" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Wall -->
      <rect width="${ROOM_W}" height="${ROOM_H * 0.82}" fill="${c.wall}"/>
      <!-- Wall lighting warmth from above -->
      <rect width="${ROOM_W}" height="${ROOM_H * 0.82}" fill="url(#wallGrad)"/>
      <rect width="${ROOM_W}" height="${ROOM_H * 0.82}" fill="url(#light)"/>
      <!-- Skirting board -->
      <rect y="${ROOM_H * 0.80}" width="${ROOM_W}" height="${ROOM_H * 0.02}" fill="${c.skirting}"/>
      <rect y="${ROOM_H * 0.82}" width="${ROOM_W}" height="${ROOM_H * 0.005}" fill="rgba(0,0,0,0.25)"/>
      <!-- Floor -->
      <rect y="${ROOM_H * 0.825}" width="${ROOM_W}" height="${ROOM_H * 0.175}" fill="${c.floor}"/>
      <rect y="${ROOM_H * 0.825}" width="${ROOM_W}" height="${ROOM_H * 0.175}" fill="url(#floorGrad)"/>
    </svg>`;
}

// Delete any lingering old room files so the directory stays clean.
const OLD_ROOM_IDS = ['living-warm', 'bedroom-soft', 'gallery-white', 'studio-modern'];
for (const id of OLD_ROOM_IDS) {
  for (const p of [`assets/rooms/${id}.jpg`, `assets/rooms/thumbs/${id}.jpg`]) {
    if (existsSync(p)) rmSync(p);
  }
}
// Also remove any old frame PNGs not in the current set.
const currentFrameIds = new Set(frames.map(f => f.id));
for (const dir of ['assets/frames', 'assets/frames/thumbs']) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.png')) continue;
    const id = name.replace(/\.png$/, '');
    if (!currentFrameIds.has(id)) rmSync(`${dir}/${name}`);
  }
}

const roomIndex = [];
for (const w of walls) {
  const svg = Buffer.from(wallSvg(w));
  const file = `${w.id}.jpg`;
  await sharp(svg).jpeg({ quality: 86 }).toFile(`assets/rooms/${file}`);
  await sharp(svg).resize(240, 160, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(`assets/rooms/thumbs/${w.id}.jpg`);
  const meta = await sharp(`assets/rooms/${file}`).metadata();
  roomIndex.push({
    id: w.id,
    name: w.name,
    file,
    width: meta.width,
    height: meta.height
  });
  console.log('wall:', w.id);
}
writeFileSync('assets/rooms/index.json', JSON.stringify(roomIndex, null, 2) + '\n');

console.log('done. wrote', frameIndex.length, 'frames and', roomIndex.length, 'walls');
