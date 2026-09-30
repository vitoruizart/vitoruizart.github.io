import { getState, setState, patchUi } from '../state.js';
import { cropRect, normalizeCrop, defaultCrop, fillCrop, resizeCrop, pickHandle, stageView } from '../lib/crop.js';
import { gridFor, aspectFor, metaFor } from '../lib/pipeline.js';

// Room left around image + frame so a corner can be dragged outwards. The
// view re-fits after every drag, so the next drag can grow the frame further.
const PAD_RATIO = 0.12;
const HANDLE_RADIUS = 28; // touch target around each corner, CSS px
const HANDLE_LEN = 20;
const MIN_FRAME_PX = 64; // shortest on-screen frame side, keeps the corners apart
const ACCENT = '#e2687a';

export function mountCrop(root) {
  const s = getState();
  if (!s.image) {
    patchUi({ screen: 'pick-image' });
    return;
  }

  const { cols, rows } = gridFor(s);
  const aspect = aspectFor(s);
  const meta = metaFor(s);
  const { bitmap, w: imgW, h: imgH } = s.image;

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Marco</button>
        <h1>Encuadre</h1>
        <div class="spacer"></div>
      </div>
      <div class="crop-stage" id="stage"><canvas id="cv"></canvas></div>
      <div class="crop-controls">
        <div class="crop-info">${meta.frameLabel} cm · ${meta.fabricLabel} · ${cols} × ${rows} puntos</div>
        <p class="crop-hint">Arrastra las esquinas para ajustar el marco o su interior para moverlo. Lo que quede en blanco será tela sin bordar.</p>
        <div class="crop-presets">
          <button id="fit">Encajar</button>
          <button id="fill">Rellenar</button>
        </div>
        <button class="primary" id="next">Crear patrón</button>
      </div>
    </div>
  `;

  const stage = root.querySelector('#stage');
  const canvas = root.querySelector('#cv');
  const ctx = canvas.getContext('2d');
  let crop = normalizeCrop(s.crop);
  let view = null; // source px → stage CSS px
  let drag = null;

  const commit = (next) => {
    crop = normalizeCrop(next);
    setState({ crop });
    draw();
  };

  function fitView() {
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    const pad = Math.max(HANDLE_RADIUS, Math.min(cw, ch) * PAD_RATIO);
    view = stageView(imgW, imgH, cropRect(imgW, imgH, aspect, crop), cw, ch, pad);
  }

  function frameOnScreen() {
    const r = cropRect(imgW, imgH, aspect, crop);
    return { x: view.x + r.x * view.s, y: view.y + r.y * view.s, w: r.w * view.s, h: r.h * view.s };
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    if (!view) fitView();
    const f = frameOnScreen();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    // Whatever the photo doesn't cover inside the frame is bare fabric.
    ctx.fillStyle = '#fff';
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, view.x, view.y, imgW * view.s, imgH * view.s);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.fill('evenodd');

    // Faint 10-stitch grid so the user sees how coarse the result will be.
    // Grey, so it shows on both the photo and the white fabric.
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 10; c < cols; c += 10) {
      const x = Math.round(f.x + (c / cols) * f.w) + 0.5;
      ctx.moveTo(x, f.y);
      ctx.lineTo(x, f.y + f.h);
    }
    for (let r = 10; r < rows; r += 10) {
      const y = Math.round(f.y + (r / rows) * f.h) + 0.5;
      ctx.moveTo(f.x, y);
      ctx.lineTo(f.x + f.w, y);
    }
    ctx.stroke();

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    // L-shaped corner handles, just outside the frame line.
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = (sx < 0 ? f.x : f.x + f.w) + sx * 2;
        const y = (sy < 0 ? f.y : f.y + f.h) + sy * 2;
        ctx.moveTo(x - sx * HANDLE_LEN, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y - sy * HANDLE_LEN);
      }
    }
    ctx.stroke();
  }

  const local = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e) => {
    if (drag || !view) return;
    const pt = local(e);
    const f = frameOnScreen();
    const hit = pickHandle(f, pt, HANDLE_RADIUS);
    if (!hit) return;
    stage.setPointerCapture(e.pointerId);
    // Where the grabbed corner sits relative to the finger, so it doesn't
    // jump under the fingertip when the drag starts a few px off.
    const offset = hit.type === 'corner'
      ? { x: (hit.sx < 0 ? f.x : f.x + f.w) - pt.x, y: (hit.sy < 0 ? f.y : f.y + f.h) - pt.y }
      : null;
    drag = { id: e.pointerId, hit, start: pt, offset, crop };
  };

  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const pt = local(e);
    if (drag.hit.type === 'move') {
      commit({
        ...drag.crop,
        cx: drag.crop.cx + (pt.x - drag.start.x) / view.s / imgW,
        cy: drag.crop.cy + (pt.y - drag.start.y) / view.s / imgH
      });
    } else {
      const corner = {
        x: (pt.x + drag.offset.x - view.x) / view.s,
        y: (pt.y + drag.offset.y - view.y) / view.s
      };
      const minH = MIN_FRAME_PX / view.s / Math.min(1, aspect);
      commit(resizeCrop(imgW, imgH, aspect, drag.crop, drag.hit, corner, minH));
    }
  };

  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    fitView();
    draw();
  };

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);

  const preset = (next) => {
    commit(next);
    fitView();
    draw();
  };
  root.querySelector('#fit').addEventListener('click', () => preset(defaultCrop()));
  root.querySelector('#fill').addEventListener('click', () => preset(fillCrop(imgW, imgH, aspect)));
  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'setup' }));
  root.querySelector('#next').addEventListener('click', () => patchUi({ screen: 'pattern' }));

  const ro = new ResizeObserver(() => {
    if (!stage.clientWidth || !stage.clientHeight) return;
    fitView();
    draw();
  });
  ro.observe(stage);
  root._cleanup = () => ro.disconnect();

  commit(crop);
}
