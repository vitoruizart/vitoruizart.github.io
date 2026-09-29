// sRGB (D65) → CIELAB conversion and the CIEDE2000 colour difference.
// ΔE2000 is the metric that best matches how people perceive "these two
// threads look the same", so it drives the image-colour → DMC matching.

const D65 = [0.95047, 1.0, 1.08883];

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function labF(t) {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / D65[0];
  const y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / D65[1];
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / D65[2];
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  const L = 116 * fy - 16;
  // Clamp float noise so black is exactly [0, 0, 0].
  return [Math.max(0, L), 500 * (fx - fy), 200 * (fy - fz)];
}

const RAD = Math.PI / 180;
const POW25_7 = Math.pow(25, 7);

export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = Math.pow((C1 + C2) / 2, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp /= 2;
    else hbarp = h1p + h2p < 360 ? (hbarp + 360) / 2 : (hbarp - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((hbarp - 30) * RAD)
    + 0.24 * Math.cos(2 * hbarp * RAD)
    + 0.32 * Math.cos((3 * hbarp + 6) * RAD)
    - 0.2 * Math.cos((4 * hbarp - 63) * RAD);
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7));
  const Lm50sq = (Lbarp - 50) * (Lbarp - 50);
  const Sl = 1 + (0.015 * Lm50sq) / Math.sqrt(20 + Lm50sq);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc;

  const tl = dLp / Sl;
  const tc = dCp / Sc;
  const th = dHp / Sh;
  return Math.sqrt(tl * tl + tc * tc + th * th + Rt * tc * th);
}

function hueDeg(b, a) {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / RAD;
  return h < 0 ? h + 360 : h;
}

/** Black or white, whichever reads better on top of the given colour. */
export function textColorFor([r, g, b]) {
  const lum = 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  // Contrast vs black = (lum + 0.05) / 0.05; vs white = 1.05 / (lum + 0.05).
  // They cross at lum ≈ 0.179.
  return lum > 0.179 ? '#000' : '#fff';
}
