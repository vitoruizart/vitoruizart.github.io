import { setState, patchUi } from '../state.js';
import { loadBitmap, downscaleBitmap, naturalSize, bitmapToPng } from '../lib/image-io.js';
import { autoOrientation } from '../lib/frames.js';
import { defaultCrop } from '../lib/crop.js';
import { MAX_FILE_BYTES } from '../lib/constants.js';
import { showToast } from '../components/toast.js';

export function mountPickImage(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <div class="spacer"></div>
        <h1>Punto de cruz</h1>
        <div class="spacer"></div>
      </div>
      <div class="screen-body padded-bottom">
        <div class="empty-state">
          <img class="hero" src="icons/icon-192.png" alt="">
          <h2>De imagen a patrón</h2>
          <p>Elige una imagen y la convertimos en un patrón de punto de cruz con hilos DMC, a la medida de tu marco.</p>
          <div class="stack">
            <button class="primary" id="from-library">Elegir imagen</button>
            <button id="from-camera">Hacer foto</button>
          </div>
          <p class="credit">Colores DMC aproximados · Datos de color:
            <a href="https://makebead.com/" target="_blank" rel="noopener noreferrer">MakeBead</a> (CC BY 4.0)</p>
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
  for (const input of [lib, cam]) {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      handleFile(file);
    });
  }
}

async function handleFile(file) {
  if (!file) return;
  // Some platforms report HEIC with an empty type, so only reject when a
  // type is present and clearly not an image.
  if (file.type && !file.type.startsWith('image/')) {
    showToast('Ese archivo no es una imagen');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    showToast('La imagen es demasiado grande (máx. 50 MB)');
    return;
  }
  try {
    const bitmap = await downscaleBitmap(await loadBitmap(file));
    const { w, h } = naturalSize(bitmap);
    if (!w || !h) throw new Error('empty image');
    const blob = await bitmapToPng(bitmap);
    setState({
      image: { blob, bitmap, w, h },
      orientation: autoOrientation(w, h),
      crop: defaultCrop()
    });
    patchUi({ screen: 'setup' });
  } catch (err) {
    console.error(err);
    showToast('No se pudo cargar la imagen');
  }
}
