import { setState, patchUi, getState, defaultPlacement } from '../state.js';
import { loadBitmap } from '../lib/image-io.js';
import { showToast } from '../components/toast.js';
import { getAll, put, del } from '../db.js';
import { openStripCropper } from '../components/strip-cropper.js';
import { clearDraft } from '../lib/drafts.js';
import { attachLongPressDelete } from './pick-room.js';

export async function mountPickFrame(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Atrás</button>
        <h1>Elige el marco</h1>
        <button class="action skip">Sin marco</button>
      </div>
      <div class="screen-body">
        <div class="thumb-grid" id="grid"></div>
        <div style="display:flex; justify-content:center; padding:16px 0 8px;">
          <button class="ghost" id="restart">Empezar de nuevo</button>
        </div>
      </div>
      <input id="file-frame" type="file" accept="image/*" hidden>
    </div>
  `;

  root.querySelector('.back').addEventListener('click', () => {
    patchUi({ screen: getState().room ? 'edit' : 'pick-painting' });
  });
  root.querySelector('.skip').addEventListener('click', () => {
    setState({ frame: null });
    patchUi({ screen: nextScreen() });
  });
  root.querySelector('#restart').addEventListener('click', async () => {
    if (!confirm('¿Descartar el trabajo actual y empezar de cero?')) return;
    await clearDraft();
    setState({ painting: null, frame: null, room: null, placement: defaultPlacement() });
    patchUi({ screen: 'pick-painting' });
  });

  const grid = root.querySelector('#grid');
  await renderGrid(grid, root);

  root.querySelector('#file-frame').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const cropped = await openStripCropper(file);
      if (!cropped) return;
      const id = 'frame-' + Date.now();
      const name = defaultFrameName();
      await put('frames', {
        id, name,
        blob: cropped.stripBlob,
        sliceWidth: cropped.sliceWidth,
        borderFrac: cropped.borderFrac,
        createdAt: Date.now()
      });
      setState({
        frame: {
          kind: 'user',
          id,
          stripBitmap: cropped.stripBitmap,
          stripBlob: cropped.stripBlob,
          sliceWidth: cropped.sliceWidth,
          borderFrac: cropped.borderFrac
        }
      });
      showToast('Marco guardado');
      patchUi({ screen: nextScreen() });
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar el marco');
    }
  });
}

async function renderGrid(grid, root) {
  grid.innerHTML = '';
  const bundled = await loadBundled();
  const userFrames = await safeGetAll('frames');

  for (const f of bundled) grid.appendChild(makeBundledThumb(f));
  grid.appendChild(makeUploadThumb(root.querySelector('#file-frame')));
  for (const f of userFrames) grid.appendChild(makeUserThumb(f, () => renderGrid(grid, root)));
}

async function loadBundled() {
  try {
    const res = await fetch('assets/frames/index.json');
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function safeGetAll(store) {
  try { return await getAll(store); } catch { return []; }
}

function makeBundledThumb(f) {
  const el = document.createElement('div');
  el.className = 'thumb';
  el.innerHTML = `
    <img src="assets/frames/thumbs/${f.id}.png" alt="${f.name}" loading="lazy">
    <div class="thumb-label">${f.name}</div>
  `;
  el.addEventListener('click', async () => {
    try {
      const res = await fetch('assets/frames/' + f.file);
      const blob = await res.blob();
      const stripBitmap = await loadBitmap(blob);
      setState({
        frame: {
          kind: 'bundled',
          id: f.id,
          stripBitmap,
          stripBlob: blob,
          sliceWidth: f.sliceWidth ?? 0.25,
          borderFrac: f.borderFrac ?? 0.06
        }
      });
      patchUi({ screen: nextScreen() });
    } catch {
      showToast('No se pudo cargar el marco');
    }
  });
  return el;
}

function makeUserThumb(f, onChange) {
  const el = document.createElement('div');
  el.className = 'thumb';
  const url = URL.createObjectURL(f.blob);
  el.innerHTML = `
    <img src="${url}" alt="">
    <button class="thumb-delete" aria-label="Eliminar marco" title="Eliminar">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
    <div class="thumb-label">${escapeHtml(f.name || 'Mío')}</div>
  `;
  el.addEventListener('click', async (e) => {
    if (e.target.closest('.thumb-delete')) return;
    const stripBitmap = await loadBitmap(f.blob);
    setState({
      frame: {
        kind: 'user',
        id: f.id,
        stripBitmap,
        stripBlob: f.blob,
        sliceWidth: f.sliceWidth ?? 0.25,
        borderFrac: f.borderFrac ?? 0.06
      }
    });
    patchUi({ screen: 'pick-room' });
  });
  const deleteFrame = async () => {
    if (!confirm('¿Eliminar este marco?')) return;
    await del('frames', f.id);
    URL.revokeObjectURL(url);
    onChange();
  };
  el.querySelector('.thumb-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteFrame();
  });
  attachLongPressDelete(el, deleteFrame);
  return el;
}

function makeUploadThumb(input) {
  const el = document.createElement('div');
  el.className = 'thumb';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.flexDirection = 'column';
  el.style.color = 'var(--text-muted)';
  el.style.gap = '4px';
  el.style.background = 'var(--bg-elev)';
  el.innerHTML = `<div style="font-size:28px">+</div><div style="font-size:11px">Subir</div>`;
  el.title = 'Sube tu marco';
  el.addEventListener('click', () => input.click());
  return el;
}

function nextScreen() {
  // If the user already has a room selected (i.e., they came here from the
  // editor to change the frame), go straight back to the editor. Otherwise
  // continue the first-run flow into room selection.
  return getState().room ? 'edit' : 'pick-room';
}

function defaultFrameName() {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const d = new Date();
  return `Marco ${d.getDate()} ${months[d.getMonth()]}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
