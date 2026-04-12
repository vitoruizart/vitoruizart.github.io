import { getState, patchUi, patchPlacement, setPlacement, patchRoom, resetPlacement, subscribe } from '../state.js';
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

  const kind = state.room.kind;
  const isPhoto = kind === 'bundled' || kind === 'user';
  const isMat = kind === 'mat';
  const isFlat = !isPhoto;

  root.innerHTML = `
    <div class="screen">
      <div class="editor-stage${kind === 'none' ? ' no-bg' : ''}" id="stage">
        ${isPhoto ? '<img class="editor-room" id="room" alt="">' : ''}
        <div class="editor-painting" id="painting">
          <img id="painting-img" alt="">
        </div>
      </div>
      <div class="editor-topbar">
        <button id="back">‹</button>
        <div class="spacer"></div>
        ${isPhoto ? '<button id="reset">Reset</button>' : ''}
        <button id="export-btn">Compartir</button>
      </div>
      <div class="editor-tray">
        <div class="tray-tabs">
          <button class="tray-tab active" data-tab="frame">Marco</button>
          ${isPhoto ? '<button class="tray-tab" data-tab="size">Tamaño</button>' : ''}
          ${isPhoto ? '<button class="tray-tab" data-tab="tilt">Inclinar</button>' : ''}
          ${isMat ? '<button class="tray-tab" data-tab="fondo">Fondo</button>' : ''}
          <button class="tray-tab" data-tab="room">${isPhoto ? 'Habitación' : 'Fondo'}</button>
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

  if (isPhoto) {
    roomImg.src = blobUrlOrCached(state.room.blob, 'roomUrl', state.room.id);
  } else if (isMat) {
    stage.style.backgroundColor = state.room.color;
  }

  paintingImg.src = blobUrlOrCached(state.painting.blob, 'paintingUrl', 'cur');
  applyFrameToElement(paintingEl, state.frame);

  // Top bar handlers.
  root.querySelector('#back').addEventListener('click', () => patchUi({ screen: 'pick-room' }));
  if (isPhoto) {
    root.querySelector('#reset').addEventListener('click', () => {
      resetPlacement();
      showToast('Reiniciado');
    });
  }
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
    applyLayout();
  }

  function applyLayout() {
    const s = getState();
    if (s.room.kind === 'bundled' || s.room.kind === 'user') {
      applyPhotoTransform(paintingEl, s);
    } else {
      applyFlatLayout(stage, paintingEl, s);
    }
  }

  // Gestures: only meaningful for photo backdrops.
  if (isPhoto) {
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
        applyLayout();
      },
      onEnd: () => { snapshot = null; },
      onRebase: () => { /* keep going from current state */ }
    });
  }

  const off = subscribe(applyLayout);

  // Also re-render the Fondo tab when room state changes, so swatch/slider stays in sync.
  // (This is cheap — Fondo DOM is lightweight.)
  root._cleanup = () => {
    if (detachGestures) { detachGestures(); detachGestures = null; }
    if (stageObserver) { stageObserver.disconnect(); stageObserver = null; }
    off();
    // Clear any inline bg so next screen starts clean.
    stage.style.backgroundColor = '';
  };
}

function applyPhotoTransform(paintingEl, s) {
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

function applyFlatLayout(stage, paintingEl, s) {
  const aspect = s.painting.naturalH / s.painting.naturalW;
  const borderFrac = s.frame ? (s.frame.borderFrac || 0.06) : 0;
  const minSideRel = Math.min(1, aspect); // painting shorter side in painting-relative units (paintingW = 1)
  const padH = s.room.kind === 'mat' ? (s.room.padH || 0) : 0;
  const padV = s.room.kind === 'mat' ? (s.room.padV || 0) : 0;
  const padHRel = padH * minSideRel;
  const padVRel = padV * minSideRel;
  const borderRel = borderFrac * minSideRel;

  const totalWRel = 1 + 2 * borderRel + 2 * padHRel;
  const totalHRel = aspect + 2 * borderRel + 2 * padVRel;
  const compositeAR = totalWRel / totalHRel;
  const stageAR = stageW / stageH;

  const fit = 0.92;
  let compW, compH;
  if (stageAR > compositeAR) {
    compH = stageH * fit;
    compW = compH * compositeAR;
  } else {
    compW = stageW * fit;
    compH = compW / compositeAR;
  }

  const rel2px = compW / totalWRel;
  const paintingWpx = rel2px;
  const paintingHpx = aspect * rel2px;
  const borderPx = borderRel * rel2px;

  paintingEl.style.width = paintingWpx + 'px';
  paintingEl.style.height = paintingHpx + 'px';
  paintingEl.style.transform = 'translate(-50%, -50%)';

  if (s.frame) {
    paintingEl.style.borderWidth = borderPx + 'px';
  } else {
    paintingEl.style.borderWidth = '0';
  }

  if (s.room.kind === 'mat') {
    stage.style.backgroundColor = s.room.color;
  } else {
    stage.style.backgroundColor = '';
  }
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
  const kind = s.room?.kind;
  const isPhoto = kind === 'bundled' || kind === 'user';

  if (tab === 'frame') {
    tray.classList.remove('column');
    addControl(tray, 'Borde', 'range', { min: 0, max: 0.18, step: 0.005, value: (s.frame?.borderFrac ?? 0.06) }, (v) => {
      if (!s.frame) return;
      s.frame.borderFrac = +v;
      patchPlacement({});
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
  } else if (tab === 'fondo') {
    renderFondoTab(tray);
  } else if (tab === 'room') {
    tray.classList.remove('column');
    const label = isPhoto ? 'Cambiar habitación' : 'Cambiar fondo';
    addBtn(tray, label, () => patchUi({ screen: 'pick-room' }));
    addBtn(tray, 'Cambiar cuadro', () => patchUi({ screen: 'pick-painting' }));
  }
}

function renderFondoTab(tray) {
  tray.classList.add('column');
  const s = getState();
  if (s.room.kind !== 'mat') return;

  // Color row
  const colorRow = document.createElement('div');
  colorRow.className = 'slider-row';
  colorRow.innerHTML = `<label>Color</label><input type="color">`;
  const colorInput = colorRow.querySelector('input');
  colorInput.style.flex = '0 0 auto';
  colorInput.style.width = '64px';
  colorInput.style.height = '32px';
  colorInput.style.padding = '0';
  colorInput.style.border = 'none';
  colorInput.style.background = 'transparent';
  colorInput.value = s.room.color;
  colorInput.addEventListener('input', () => patchRoom({ color: colorInput.value }));
  tray.appendChild(colorRow);

  // Horizontal padding
  const padHRow = document.createElement('div');
  padHRow.className = 'slider-row';
  padHRow.innerHTML = `<label>Horizontal</label><input type="range" min="0" max="0.5" step="0.01">`;
  const padHInput = padHRow.querySelector('input');
  padHInput.value = s.room.padH;
  tray.appendChild(padHRow);

  // Vertical padding
  const padVRow = document.createElement('div');
  padVRow.className = 'slider-row';
  padVRow.innerHTML = `<label>Vertical</label><input type="range" min="0" max="0.5" step="0.01">`;
  const padVInput = padVRow.querySelector('input');
  padVInput.value = s.room.padV;
  tray.appendChild(padVRow);

  padHInput.addEventListener('input', () => {
    const v = +padHInput.value;
    if (getState().room.lockPad) {
      padVInput.value = v;
      patchRoom({ padH: v, padV: v });
    } else {
      patchRoom({ padH: v });
    }
  });
  padVInput.addEventListener('input', () => {
    const v = +padVInput.value;
    if (getState().room.lockPad) {
      padHInput.value = v;
      patchRoom({ padH: v, padV: v });
    } else {
      patchRoom({ padV: v });
    }
  });

  // Lock checkbox
  const lockRow = document.createElement('label');
  lockRow.className = 'slider-row';
  lockRow.style.cursor = 'pointer';
  lockRow.innerHTML = `<input type="checkbox" style="flex:0 0 auto; width:auto; margin-right:8px;"><span>Igualar los 4 lados</span>`;
  const lockInput = lockRow.querySelector('input');
  lockInput.checked = !!s.room.lockPad;
  lockInput.addEventListener('change', () => {
    const lockPad = lockInput.checked;
    const patch = { lockPad };
    if (lockPad) {
      const v = getState().room.padH;
      patch.padV = v;
      padVInput.value = v;
    }
    patchRoom(patch);
  });
  tray.appendChild(lockRow);
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
