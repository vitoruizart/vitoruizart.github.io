import { getState, patchUi, patchPlacement, setPlacement, resetPlacement } from '../state.js';
import { toCssTransform, paintingPreviewSize, clampPlacement } from '../lib/transform.js';
import { attachGestures } from '../lib/gestures.js';
import { mountTiltPanel } from '../components/tilt-panel.js';
import { showToast } from '../components/toast.js';

let detachGestures = null;
let stageObserver = null;
let stageW = 0;
let stageH = 0;
let frameUrl = null;

export function mountEdit(root) {
  const state = getState();
  if (!state.painting || !state.room) {
    patchUi({ screen: 'pick-painting' });
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <div class="editor-stage" id="stage">
        <img class="editor-room" id="room" alt="">
        <div class="editor-painting" id="painting">
          <img id="painting-img" alt="">
        </div>
      </div>
      <div class="editor-topbar">
        <button id="back">‹</button>
        <div class="spacer"></div>
        <button id="reset">Reset</button>
        <button id="export-btn">Compartir</button>
      </div>
      <div class="editor-tray">
        <div class="tray-tabs">
          <button class="tray-tab active" data-tab="frame">Marco</button>
          <button class="tray-tab" data-tab="size">Tamaño</button>
          <button class="tray-tab" data-tab="tilt">Inclinar</button>
          <button class="tray-tab" data-tab="room">Habitación</button>
        </div>
        <div class="tray-content" id="tray"></div>
      </div>
    </div>
  `;

  const stage = root.querySelector('#stage');
  const roomImg = root.querySelector('#room');
  const paintingEl = root.querySelector('#painting');
  const paintingImg = root.querySelector('#painting-img');
  const tray = root.querySelector('#tray');

  // Set room background.
  roomImg.src = blobUrlOrCached(state.room.blob, 'roomUrl', state.room.id);

  // Set painting source.
  paintingImg.src = blobUrlOrCached(state.painting.blob, 'paintingUrl', 'cur');

  // Apply frame border via CSS border-image.
  applyFrameToElement(paintingEl, state.frame);

  // Top bar handlers.
  root.querySelector('#back').addEventListener('click', () => patchUi({ screen: 'pick-room' }));
  root.querySelector('#reset').addEventListener('click', () => {
    resetPlacement();
    showToast('Reiniciado');
  });
  root.querySelector('#export-btn').addEventListener('click', () => patchUi({ screen: 'export' }));

  // Tab switching.
  const tabs = root.querySelectorAll('.tray-tab');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.toggle('active', x === t));
    renderTray(tray, t.dataset.tab);
  }));
  renderTray(tray, 'frame');

  // Track stage size to compute live transforms.
  measureAndApply();
  if (window.ResizeObserver) {
    stageObserver = new ResizeObserver(measureAndApply);
    stageObserver.observe(stage);
  } else {
    window.addEventListener('resize', measureAndApply);
  }

  function measureAndApply() {
    const r = stage.getBoundingClientRect();
    stageW = r.width;
    stageH = r.height;
    applyTransform();
  }

  function applyTransform() {
    const s = getState();
    const sz = paintingPreviewSize(s.placement, stageW, stageH, s.painting);
    paintingEl.style.width = sz.w + 'px';
    paintingEl.style.height = sz.h + 'px';
    paintingEl.style.transform = toCssTransform(s.placement, stageW, stageH);
    if (s.frame) {
      const borderPx = (s.frame.borderFrac || 0.06) * Math.min(sz.w, sz.h);
      paintingEl.style.borderWidth = borderPx + 'px';
    } else {
      paintingEl.style.borderWidth = '0';
    }
  }

  // Gestures.
  let snapshot = null;
  detachGestures = attachGestures(stage, {
    snapshot: () => ({ ...getState().placement }),
    onStart: (b) => { snapshot = b.snapshot; },
    onMove: ({ dx, dy, scale, rotate }, b) => {
      const snap = b.snapshot;
      const tx = snap.tx + dx / Math.max(stageW, 1);
      const ty = snap.ty + dy / Math.max(stageH, 1);
      const next = clampPlacement({
        ...snap,
        tx, ty,
        scale: snap.scale * scale,
        rotate: snap.rotate + rotate
      });
      setPlacement(next);
      applyTransform();
    },
    onEnd: () => { snapshot = null; },
    onRebase: () => { /* keep going from current state */ }
  });

  // Subscribe to state changes for tilt-panel-driven updates.
  // (The state.subscribe in app.js triggers a remount on screen change only.)
  const off = subscribeLight(applyTransform);

  // Cleanup hook (we lose this on screen swap; root.innerHTML wipes DOM).
  // Stash on root so app.js could call it; for now rely on GC.
  root._cleanup = () => {
    if (detachGestures) detachGestures();
    if (stageObserver) stageObserver.disconnect();
    off();
  };
}

function applyFrameToElement(el, frame) {
  if (frameUrl) { URL.revokeObjectURL(frameUrl); frameUrl = null; }
  if (!frame || !frame.stripBlob) {
    el.classList.remove('framed');
    el.style.borderImageSource = '';
    el.style.borderWidth = '0';
    return;
  }
  frameUrl = URL.createObjectURL(frame.stripBlob);
  el.classList.add('framed');
  el.style.borderImageSource = `url(${frameUrl})`;
  // border-image-slice in pixels of the source image, derived from the frame's
  // sliceWidth (fraction of source's shorter edge).
  const slicePct = Math.round((frame.sliceWidth || 0.25) * 100);
  el.style.borderImageSlice = `${slicePct}% fill`;
}

const cache = new Map();
function blobUrlOrCached(blob, kind, id) {
  const key = kind + ':' + id;
  if (cache.has(key)) return cache.get(key);
  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  return url;
}

function renderTray(tray, tab) {
  tray.innerHTML = '';
  const s = getState();
  if (tab === 'frame') {
    tray.classList.remove('column');
    addControl(tray, 'Borde', 'range', { min: 0, max: 0.18, step: 0.005, value: (s.frame?.borderFrac ?? 0.06) }, (v) => {
      if (!s.frame) return;
      s.frame.borderFrac = +v;
      // re-apply on stage
      const ev = new Event('frame-border-change');
      document.getElementById('stage').dispatchEvent(ev);
      patchPlacement({}); // trigger re-render by emit
    });
    addBtn(tray, 'Cambiar marco', () => patchUi({ screen: 'pick-frame' }));
  } else if (tab === 'size') {
    tray.classList.remove('column');
    addControl(tray, 'Tamaño', 'range', { min: 0.1, max: 1, step: 0.01, value: s.placement.scale }, (v) => {
      patchPlacement({ scale: +v });
    });
  } else if (tab === 'tilt') {
    tray.classList.add('column');
    mountTiltPanel(tray, () => getState().placement, (patch) => patchPlacement(patch));
  } else if (tab === 'room') {
    tray.classList.remove('column');
    addBtn(tray, 'Cambiar habitación', () => patchUi({ screen: 'pick-room' }));
    addBtn(tray, 'Cambiar cuadro', () => patchUi({ screen: 'pick-painting' }));
  }
}

function addControl(host, label, type, attrs, onInput) {
  const wrap = document.createElement('div');
  wrap.className = 'slider-row';
  wrap.style.minWidth = '240px';
  wrap.innerHTML = `<label>${label}</label><input type="${type}">`;
  const input = wrap.querySelector('input');
  for (const k in attrs) input.setAttribute(k, attrs[k]);
  input.addEventListener('input', () => onInput(input.value));
  host.appendChild(wrap);
}

function addBtn(host, label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.flex = '0 0 auto';
  b.addEventListener('click', fn);
  host.appendChild(b);
}

// Lightweight subscribe that doesn't trigger app.js's screen-swap render.
import { subscribe } from '../state.js';
function subscribeLight(fn) {
  return subscribe(fn);
}
