import { setState, patchUi, getState } from '../state.js';
import { loadBitmap, downscaleBitmap } from '../lib/image-io.js';
import { showToast } from '../components/toast.js';
import { getAll, put, del } from '../db.js';

export async function mountPickRoom(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Atrás</button>
        <h1>Elige la habitación</h1>
        <div style="min-width:44px"></div>
      </div>
      <div class="screen-body">
        <div class="thumb-grid" id="grid"></div>
      </div>
      <input id="file-room-lib" type="file" accept="image/*" hidden>
      <input id="file-room-cam" type="file" accept="image/*" capture="environment" hidden>
      <input id="color-room" type="color" value="#f4eee3" hidden>
    </div>
  `;

  root.querySelector('.back').addEventListener('click', () => {
    patchUi({ screen: getState().room ? 'edit' : 'pick-frame' });
  });

  const grid = root.querySelector('#grid');
  await renderGrid(grid, root);

  const handler = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const original = await loadBitmap(file);
      const bm = await downscaleBitmap(original);
      const naturalW = original.width;
      const naturalH = original.height;
      const id = 'room-' + Date.now();
      const name = defaultRoomName();
      // Preserve the original file blob unmodified — no import-time re-encode.
      await put('rooms', { id, name, blob: file, width: naturalW, height: naturalH, createdAt: Date.now() });
      setState({ room: { kind: 'user', id, bitmap: bm, blob: file, naturalW, naturalH } });
      showToast('Habitación guardada');
      patchUi({ screen: 'edit' });
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar la habitación');
    }
  };
  root.querySelector('#file-room-lib').addEventListener('change', handler);
  root.querySelector('#file-room-cam').addEventListener('change', handler);

  const colorInput = root.querySelector('#color-room');
  colorInput.addEventListener('change', () => {
    const color = colorInput.value;
    setState({ room: { kind: 'mat', color, padH: 0.10, padV: 0.10, lockPad: true } });
    patchUi({ screen: 'edit' });
  });
}

async function renderGrid(grid, root) {
  grid.innerHTML = '';
  const bundled = await loadBundled();
  const userRooms = await safeGetAll('rooms');
  grid.appendChild(makeNoBgThumb());
  grid.appendChild(makeSolidColorThumb(root.querySelector('#color-room')));
  for (const r of bundled) grid.appendChild(makeBundledThumb(r));
  grid.appendChild(makeUploadThumb('library', root.querySelector('#file-room-lib')));
  grid.appendChild(makeUploadThumb('camera', root.querySelector('#file-room-cam')));
  for (const r of userRooms) grid.appendChild(makeUserThumb(r, () => renderGrid(grid, root)));
}

async function loadBundled() {
  try {
    const res = await fetch('assets/rooms/index.json');
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function safeGetAll(store) {
  try { return await getAll(store); } catch { return []; }
}

function makeBundledThumb(r) {
  const el = document.createElement('div');
  el.className = 'thumb';
  el.innerHTML = `
    <img src="assets/rooms/thumbs/${r.id}.jpg" alt="${r.name}" loading="lazy">
    <div class="thumb-label">${r.name}</div>
  `;
  el.addEventListener('click', async () => {
    try {
      const res = await fetch('assets/rooms/' + r.file);
      const blob = await res.blob();
      const original = await loadBitmap(blob);
      const bm = await downscaleBitmap(original);
      const naturalW = original.width;
      const naturalH = original.height;
      setState({ room: { kind: 'bundled', id: r.id, bitmap: bm, blob, naturalW, naturalH } });
      patchUi({ screen: 'edit' });
    } catch {
      showToast('No se pudo cargar la habitación');
    }
  });
  return el;
}

function makeUserThumb(r, onChange) {
  const el = document.createElement('div');
  el.className = 'thumb';
  const url = URL.createObjectURL(r.blob);
  el.innerHTML = `
    <img src="${url}" alt="">
    <button class="thumb-delete" aria-label="Eliminar habitación" title="Eliminar">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
    <div class="thumb-label">${escapeHtml(r.name || 'Mía')}</div>
  `;
  el.addEventListener('click', async (e) => {
    if (e.target.closest('.thumb-delete')) return;
    const original = await loadBitmap(r.blob);
    const bm = await downscaleBitmap(original);
    const naturalW = original.width;
    const naturalH = original.height;
    setState({ room: { kind: 'user', id: r.id, bitmap: bm, blob: r.blob, naturalW, naturalH } });
    patchUi({ screen: 'edit' });
  });
  const deleteRoom = async () => {
    if (!confirm('¿Eliminar esta habitación?')) return;
    await del('rooms', r.id);
    URL.revokeObjectURL(url);
    onChange();
  };
  el.querySelector('.thumb-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteRoom();
  });
  attachLongPressDelete(el, deleteRoom);
  return el;
}

function makeNoBgThumb() {
  const el = document.createElement('div');
  el.className = 'thumb no-bg';
  el.innerHTML = `<div class="thumb-label">Sin fondo</div>`;
  el.title = 'Sin fondo — sólo cuadro y marco';
  el.addEventListener('click', () => {
    setState({ room: { kind: 'none' } });
    patchUi({ screen: 'edit' });
  });
  return el;
}

function makeSolidColorThumb(colorInput) {
  const el = document.createElement('div');
  el.className = 'thumb solid';
  el.innerHTML = `<div class="thumb-label">Color sólido</div>`;
  el.title = 'Fondo de color sólido';
  el.addEventListener('click', () => colorInput.click());
  return el;
}

function makeUploadThumb(kind, input) {
  const el = document.createElement('div');
  el.className = 'thumb';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.flexDirection = 'column';
  el.style.color = 'var(--text-muted)';
  el.style.gap = '4px';
  el.style.background = 'var(--bg-elev)';
  el.innerHTML = `<div style="font-size:28px">+</div><div style="font-size:11px">${kind === 'camera' ? 'Cámara' : 'Galería'}</div>`;
  el.addEventListener('click', () => input.click());
  return el;
}

function defaultRoomName() {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const d = new Date();
  return `Habitación ${d.getDate()} ${months[d.getMonth()]}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function attachLongPressDelete(el, onTrigger, ms = 600) {
  let t = null;
  let triggered = false;
  const start = () => {
    triggered = false;
    t = setTimeout(() => {
      triggered = true;
      onTrigger();
    }, ms);
  };
  const cancel = () => {
    if (t) { clearTimeout(t); t = null; }
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', () => { cancel(); });
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // Suppress click after long-press triggered.
  el.addEventListener('click', (e) => { if (triggered) { e.stopPropagation(); e.preventDefault(); triggered = false; } }, true);
}
