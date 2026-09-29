import { getState, setState, patchUi } from '../state.js';
import { cropRect, normalizeCrop, defaultCrop, MAX_ZOOM } from '../lib/crop.js';
import { attachGestures } from '../lib/gestures.js';
import { gridFor, aspectFor, metaFor } from '../lib/pipeline.js';

const PAD = 20;

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
        <button class="action" id="reset">Centrar</button>
      </div>
      <div class="crop-stage" id="stage"><canvas id="cv"></canvas></div>
      <div class="crop-controls">
        <div class="crop-info">${meta.frameLabel} cm · ${meta.fabricLabel} · ${cols} × ${rows} puntos</div>
        <div class="slider-row">
          <label for="zoom">Zoom</label>
          <input type="range" id="zoom" min="1" max="${MAX_ZOOM}" step="0.01">
        </div>
        <button class="primary" id="next">Crear patrón</button>
      </div>
    </div>
  `;

  const stage = root.querySelector('#stage');
  const canvas = root.querySelector('#cv');
  const zoomInput = root.querySelector('#zoom');
  const ctx = canvas.getContext('2d');
  let crop = normalizeCrop(imgW, imgH, aspect, s.crop);
  let win = null;

  const commit = (next) => {
    crop = normalizeCrop(imgW, imgH, aspect, next);
    zoomInput.value = String(crop.zoom);
    setState({ crop });
    draw();
  };

  function layoutWindow() {
    const sw = stage.clientWidth - PAD * 2;
    const sh = stage.clientHeight - PAD * 2;
    let ww = sw;
    let wh = sw / aspect;
    if (wh > sh) { wh = sh; ww = sh * aspect; }
    win = { x: (stage.clientWidth - ww) / 2, y: (stage.clientHeight - wh) / 2, w: ww, h: wh };
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
    layoutWindow();
    const rect = cropRect(imgW, imgH, aspect, crop);
    const scale = win.w / rect.w;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (win.x - rect.x * scale), dpr * (win.y - rect.y * scale));
    ctx.drawImage(bitmap, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.fill('evenodd');

    // Faint 10-stitch grid so the user sees how coarse the result will be.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 10; c < cols; c += 10) {
      const x = Math.round(win.x + (c / cols) * win.w) + 0.5;
      ctx.moveTo(x, win.y);
      ctx.lineTo(x, win.y + win.h);
    }
    for (let r = 10; r < rows; r += 10) {
      const y = Math.round(win.y + (r / rows) * win.h) + 0.5;
      ctx.moveTo(win.x, y);
      ctx.lineTo(win.x + win.w, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(win.x, win.y, win.w, win.h);
  }

  const detach = attachGestures(stage, {
    // Gesture deltas are relative to the gesture start, so keep that crop.
    snapshot: () => {
      const rect = cropRect(imgW, imgH, aspect, crop);
      return { crop: { ...crop }, rect, scale: win ? win.w / rect.w : 1 };
    },
    onMove: (delta, base) => {
      const { rect, scale } = base.snapshot;
      const cx = rect.x + rect.w / 2 - delta.dx / scale;
      const cy = rect.y + rect.h / 2 - delta.dy / scale;
      commit({ cx: cx / imgW, cy: cy / imgH, zoom: base.snapshot.crop.zoom * delta.scale });
    }
  });

  const onWheel = (e) => {
    e.preventDefault();
    commit({ ...crop, zoom: crop.zoom * Math.exp(-e.deltaY * 0.0015) });
  };
  stage.addEventListener('wheel', onWheel, { passive: false });

  zoomInput.addEventListener('input', () => commit({ ...crop, zoom: Number(zoomInput.value) }));
  root.querySelector('#reset').addEventListener('click', () => commit(defaultCrop()));
  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'setup' }));
  root.querySelector('#next').addEventListener('click', () => patchUi({ screen: 'pattern' }));

  const ro = new ResizeObserver(() => draw());
  ro.observe(stage);
  root._cleanup = () => {
    detach();
    ro.disconnect();
  };

  commit(crop);
}
