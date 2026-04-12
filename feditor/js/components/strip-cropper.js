import { loadBitmap, makeCanvas, bitmapToBlob } from '../lib/image-io.js';

/**
 * Modal cropper for user-uploaded frame photos.
 * User drags a rectangle over the source image to select a strip; the strip
 * is treated by frame-render.js as a tileable edge texture (square output).
 *
 * Returns a Promise that resolves to:
 *   { stripBlob: Blob, stripBitmap: ImageBitmap, sliceWidth: number, borderFrac: number }
 * or null if the user cancels.
 */
export async function openStripCropper(sourceBlob) {
  const bitmap = await loadBitmap(sourceBlob);
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div style="width:100%; height:100%; display:flex; flex-direction:column; padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);">
        <div style="display:flex; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.6);">
          <button class="ghost" id="cancel">Cancelar</button>
          <div style="flex:1; text-align:center; font-size:14px;">Recorta un trozo del marco</div>
          <button class="primary" id="apply">Aplicar</button>
        </div>
        <div style="flex:1; position:relative; overflow:hidden; touch-action:none;" id="stage">
          <canvas id="img" style="position:absolute; left:0; top:0;"></canvas>
          <div id="rect" style="position:absolute; border:2px solid var(--accent); box-shadow:0 0 0 9999px rgba(0,0,0,0.5);"></div>
          <div id="hTL" class="cropper-handle" style="left:0;top:0;"></div>
          <div id="hBR" class="cropper-handle" style="right:0;bottom:0;"></div>
        </div>
        <div style="padding:10px 16px; background:var(--bg-elev);">
          <div class="slider-row">
            <label>Borde</label>
            <input type="range" min="0.15" max="0.45" step="0.01" value="0.25" id="slice">
            <span id="sliceVal" style="width:36px; text-align:right; color:var(--text-muted); font-size:12px;">25%</span>
          </div>
        </div>
      </div>
    `;

    // Inject handle styles once.
    if (!document.getElementById('cropper-handle-style')) {
      const st = document.createElement('style');
      st.id = 'cropper-handle-style';
      st.textContent = `.cropper-handle { position:absolute; width:28px; height:28px; background:var(--accent); border-radius:50%; transform:translate(-50%,-50%); touch-action:none; }
      #hBR { transform:translate(50%,50%); }`;
      document.head.appendChild(st);
    }

    document.body.appendChild(overlay);

    const stage = overlay.querySelector('#stage');
    const canvas = overlay.querySelector('#img');
    const rectEl = overlay.querySelector('#rect');
    const hTL = overlay.querySelector('#hTL');
    const hBR = overlay.querySelector('#hBR');
    const slice = overlay.querySelector('#slice');
    const sliceVal = overlay.querySelector('#sliceVal');

    // Layout: fit image into stage with letterboxing.
    let imgX = 0, imgY = 0, imgW = 0, imgH = 0;
    let rect = { x: 0.30, y: 0.30, w: 0.40, h: 0.20 }; // normalized to image rect

    function layout() {
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const ar = bitmap.width / bitmap.height;
      if (sw / sh > ar) { imgH = sh; imgW = sh * ar; }
      else { imgW = sw; imgH = sw / ar; }
      imgX = (sw - imgW) / 2;
      imgY = (sh - imgH) / 2;
      canvas.width = imgW;
      canvas.height = imgH;
      canvas.style.left = imgX + 'px';
      canvas.style.top = imgY + 'px';
      canvas.style.width = imgW + 'px';
      canvas.style.height = imgH + 'px';
      canvas.getContext('2d').drawImage(bitmap, 0, 0, imgW, imgH);
      drawRect();
    }

    function drawRect() {
      const x = imgX + rect.x * imgW;
      const y = imgY + rect.y * imgH;
      const w = rect.w * imgW;
      const h = rect.h * imgH;
      rectEl.style.left = x + 'px';
      rectEl.style.top = y + 'px';
      rectEl.style.width = w + 'px';
      rectEl.style.height = h + 'px';
      hTL.style.left = x + 'px'; hTL.style.top = y + 'px';
      hBR.style.left = (x + w) + 'px'; hBR.style.top = (y + h) + 'px';
    }

    layout();
    window.addEventListener('resize', layout);

    // Drag rect body.
    let dragMode = null; // 'move' | 'tl' | 'br'
    let dragStart = null;

    function pointToNorm(e) {
      return {
        nx: clamp01((e.clientX - imgX) / imgW),
        ny: clamp01((e.clientY - imgY) / imgH)
      };
    }

    function onPointerDown(e, mode) {
      dragMode = mode;
      dragStart = { ...rect, ...pointToNorm(e), pid: e.pointerId };
      e.target.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragMode || dragStart.pid !== e.pointerId) return;
      const cur = pointToNorm(e);
      if (dragMode === 'move') {
        const dx = cur.nx - dragStart.nx;
        const dy = cur.ny - dragStart.ny;
        rect.x = clamp(dragStart.x + dx, 0, 1 - rect.w);
        rect.y = clamp(dragStart.y + dy, 0, 1 - rect.h);
      } else if (dragMode === 'tl') {
        const nx = clamp(cur.nx, 0, dragStart.x + dragStart.w - 0.05);
        const ny = clamp(cur.ny, 0, dragStart.y + dragStart.h - 0.05);
        rect.x = nx;
        rect.y = ny;
        rect.w = dragStart.x + dragStart.w - nx;
        rect.h = dragStart.y + dragStart.h - ny;
      } else if (dragMode === 'br') {
        const nx = clamp(cur.nx, dragStart.x + 0.05, 1);
        const ny = clamp(cur.ny, dragStart.y + 0.05, 1);
        rect.w = nx - dragStart.x;
        rect.h = ny - dragStart.y;
      }
      drawRect();
    }

    function onPointerUp(e) {
      if (dragMode && dragStart && dragStart.pid === e.pointerId) {
        try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      dragMode = null;
      dragStart = null;
    }

    rectEl.addEventListener('pointerdown', (e) => onPointerDown(e, 'move'));
    hTL.addEventListener('pointerdown', (e) => onPointerDown(e, 'tl'));
    hBR.addEventListener('pointerdown', (e) => onPointerDown(e, 'br'));
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    slice.addEventListener('input', () => {
      sliceVal.textContent = Math.round(+slice.value * 100) + '%';
    });

    overlay.querySelector('#cancel').addEventListener('click', () => cleanup(null));
    overlay.querySelector('#apply').addEventListener('click', async () => {
      try {
        const result = await buildStrip();
        cleanup(result);
      } catch (err) {
        console.error(err);
        cleanup(null);
      }
    });

    async function buildStrip() {
      // Source crop rect in bitmap pixels.
      let sx = rect.x * bitmap.width;
      let sy = rect.y * bitmap.height;
      let sw = rect.w * bitmap.width;
      let sh = rect.h * bitmap.height;

      // Interpret the crop: short axis = frame cross-section (outer→inner);
      // long axis = along the edge. Rotate the source if the crop is portrait
      // so downstream code always sees a horizontal strip.
      const portrait = sh > sw;

      // Auto-trim: if the user's rect extends past the actual frame edges into
      // wall/background, those rows get tiled perpendicularly and show up as
      // pale stripes running through the frame. Analyze the cross-section and
      // trim outermost rows whose color deviates strongly from the interior.
      const trim = detectFrameEdges(bitmap, { sx, sy, sw, sh }, portrait);
      if (portrait) {
        sx = sx + sw * trim.start;
        sw = sw * (trim.end - trim.start);
      } else {
        sy = sy + sh * trim.start;
        sh = sh * (trim.end - trim.start);
      }

      const shortSrc = portrait ? sw : sh;
      const longSrc  = portrait ? sh : sw;

      const sliceFrac = +slice.value;
      // Pick an output size that preserves source detail at the chosen slice
      // fraction: keep the strip's height at ≥ shortSrc so there's no upscaling.
      // Cap at 1024 to keep the PNG small.
      const SIZE = Math.min(1024, Math.max(512, Math.round(shortSrc / sliceFrac)));
      const f = Math.round(SIZE * sliceFrac);

      // Prescale the crop into a (SIZE × f) strip. Tile along the length with
      // alternating mirror flips so the seam between tiles is invisible.
      const stripCanvas = makeCanvas(SIZE, f);
      const sctx = stripCanvas.getContext('2d');
      sctx.imageSmoothingQuality = 'high';
      const tileW = Math.max(1, Math.round(longSrc * (f / shortSrc)));
      let drawn = 0, mirror = false;
      while (drawn < SIZE) {
        const take = Math.min(tileW, SIZE - drawn);
        sctx.save();
        if (mirror) {
          sctx.translate(drawn + take, 0);
          sctx.scale(-1, 1);
        } else {
          sctx.translate(drawn, 0);
        }
        if (portrait) {
          // Rotate the source so its long axis runs horizontally.
          sctx.rotate(-Math.PI / 2);
          sctx.translate(-f, 0);
          sctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, f, take);
        } else {
          sctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, take, f);
        }
        sctx.restore();
        drawn += take;
        mirror = !mirror;
      }

      // Assemble the final 9-slice texture as four mitered trapezoids. Each
      // side is the same prescaled strip rotated so its outer edge (y=0 of the
      // strip) lies on the outer edge of that side. Clipping to the trapezoid
      // produces clean 45° miter joints at every corner.
      const c = makeCanvas(SIZE, SIZE);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      drawMiteredSide(ctx, stripCanvas, f, SIZE, 'top');
      drawMiteredSide(ctx, stripCanvas, f, SIZE, 'right');
      drawMiteredSide(ctx, stripCanvas, f, SIZE, 'bottom');
      drawMiteredSide(ctx, stripCanvas, f, SIZE, 'left');

      // Subtle hairline at each miter joint — matches the bundled-frame look.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, SIZE / 400);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(f, f);
      ctx.moveTo(SIZE, 0); ctx.lineTo(SIZE - f, f);
      ctx.moveTo(SIZE, SIZE); ctx.lineTo(SIZE - f, SIZE - f);
      ctx.moveTo(0, SIZE); ctx.lineTo(f, SIZE - f);
      ctx.stroke();

      const stripBlob = await bitmapToBlob(c, 'image/png');
      const stripBitmap = await loadBitmap(stripBlob);
      return {
        stripBlob,
        stripBitmap,
        sliceWidth: sliceFrac,
        borderFrac: 0.06
      };
    }

    function cleanup(result) {
      window.removeEventListener('resize', layout);
      overlay.remove();
      resolve(result);
    }
  });
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function clamp01(v) { return clamp(v, 0, 1); }

// Analyze the short-axis cross-section of the crop and return a
// { start, end } fraction indicating the range that belongs to the frame
// (between 0 and 1). Trims outermost rows whose color is clearly different
// from the interior of the strip — those rows are wall/background that
// leaked into the user's selection.
function detectFrameEdges(bitmap, { sx, sy, sw, sh }, portrait) {
  const SHORT = 64, LONG = 16;
  const W = portrait ? LONG : SHORT;
  const H = portrait ? SHORT : LONG;
  let data;
  try {
    const sample = makeCanvas(W, H);
    const sctx = sample.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, W, H);
    data = sctx.getImageData(0, 0, W, H).data;
  } catch (_) {
    // Some browsers taint canvases for cross-origin images; if getImageData
    // fails, skip trimming rather than crashing.
    return { start: 0, end: 1 };
  }

  // Per short-axis row: mean RGB across the long axis.
  const means = new Array(SHORT);
  for (let i = 0; i < SHORT; i++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < LONG; j++) {
      const x = portrait ? j : i;
      const y = portrait ? i : j;
      const idx = (y * W + x) * 4;
      r += data[idx]; g += data[idx + 1]; b += data[idx + 2];
    }
    means[i] = [r / LONG, g / LONG, b / LONG];
  }

  // Reference color: median of middle 50% (robust to the frame having a
  // gradient/bevel — the median of the center band is still inside the frame).
  const mid = means.slice(Math.floor(SHORT * 0.25), Math.floor(SHORT * 0.75));
  const ref = [0, 1, 2].map(c => median(mid.map(m => m[c])));
  const distRef = (m) => Math.hypot(m[0] - ref[0], m[1] - ref[1], m[2] - ref[2]);

  // Threshold: well above the typical variance inside the frame (max center
  // distance × 2.5), with a floor of 35 so near-flat frames still have slack.
  const midMax = Math.max(...mid.map(distRef));
  const threshold = Math.max(35, midMax * 2.5);

  let startCut = 0;
  while (startCut < SHORT && distRef(means[startCut]) > threshold) startCut++;
  let endCut = 0;
  while (endCut < SHORT && distRef(means[SHORT - 1 - endCut]) > threshold) endCut++;

  // Safety cap: never trim more than 40% from either side.
  const maxCut = Math.floor(SHORT * 0.4);
  startCut = Math.min(startCut, maxCut);
  endCut = Math.min(endCut, maxCut);

  return {
    start: startCut / SHORT,
    end: (SHORT - endCut) / SHORT
  };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Draw one mitered side of the 9-slice texture by clipping to the side's
// trapezoid and filling it with the prescaled strip rotated so y=0 of the
// strip aligns with the outer edge of that side.
function drawMiteredSide(ctx, strip, f, SIZE, side) {
  ctx.save();
  ctx.beginPath();
  if (side === 'top') {
    ctx.moveTo(0, 0); ctx.lineTo(SIZE, 0);
    ctx.lineTo(SIZE - f, f); ctx.lineTo(f, f);
  } else if (side === 'right') {
    ctx.moveTo(SIZE, 0); ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(SIZE - f, SIZE - f); ctx.lineTo(SIZE - f, f);
  } else if (side === 'bottom') {
    ctx.moveTo(0, SIZE); ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(SIZE - f, SIZE - f); ctx.lineTo(f, SIZE - f);
  } else {
    ctx.moveTo(0, 0); ctx.lineTo(f, f);
    ctx.lineTo(f, SIZE - f); ctx.lineTo(0, SIZE);
  }
  ctx.closePath();
  ctx.clip();
  if (side === 'top') {
    ctx.drawImage(strip, 0, 0);
  } else if (side === 'right') {
    ctx.translate(SIZE, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(strip, 0, 0);
  } else if (side === 'bottom') {
    ctx.translate(SIZE, SIZE);
    ctx.rotate(Math.PI);
    ctx.drawImage(strip, 0, 0);
  } else {
    ctx.translate(0, SIZE);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(strip, 0, 0);
  }
  ctx.restore();
}
