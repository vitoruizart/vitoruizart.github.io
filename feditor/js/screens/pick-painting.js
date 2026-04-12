import { setState, patchUi } from '../state.js';
import { loadBitmap, downscaleBitmap, naturalSize } from '../lib/image-io.js';
import { showToast } from '../components/toast.js';

export function mountPickPainting(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <div class="back" style="min-width:44px"></div>
        <h1>Elige tu cuadro</h1>
        <div style="min-width:44px"></div>
      </div>
      <div class="screen-body">
        <div class="empty-state">
          <h2>Empieza por una foto</h2>
          <p>Elige una foto de tu cuadro desde la galería o haz una nueva con la cámara.</p>
          <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:280px;">
            <button class="primary" id="from-library">Elegir de la galería</button>
            <button id="from-camera">Hacer foto</button>
          </div>
        </div>
        <input id="file-library" type="file" accept="image/*" hidden>
        <input id="file-camera" type="file" accept="image/*" capture="environment" hidden>
      </div>
    </div>
  `;

  const lib = root.querySelector('#file-library');
  const cam = root.querySelector('#file-camera');
  root.querySelector('#from-library').addEventListener('click', () => lib.click());
  root.querySelector('#from-camera').addEventListener('click', () => cam.click());
  lib.addEventListener('change', (e) => handleFile(e.target.files[0]));
  cam.addEventListener('change', (e) => handleFile(e.target.files[0]));
}

async function handleFile(file) {
  if (!file) return;
  try {
    const bitmap = await loadBitmap(file);
    const scaled = await downscaleBitmap(bitmap);
    const { naturalW, naturalH } = naturalSize(scaled);
    setState({ painting: { blob: file, bitmap: scaled, naturalW, naturalH } });
    patchUi({ screen: 'pick-frame' });
  } catch (err) {
    showToast('No se pudo cargar la imagen');
    console.error(err);
  }
}
