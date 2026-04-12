import { getState, patchUi } from '../state.js';
import { composeFinal } from '../lib/export-canvas.js';
import { showToast } from '../components/toast.js';

export async function mountExport(root) {
  const s = getState();
  if (!s.painting || !s.room) {
    patchUi({ screen: 'pick-painting' });
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Editar</button>
        <h1>Compartir</h1>
        <div style="min-width:44px"></div>
      </div>
      <div class="screen-body" style="display:flex; flex-direction:column; align-items:center; gap:16px; padding-top:24px;">
        <div id="preview" style="width:100%; max-width:480px; aspect-ratio:1; background:var(--bg-elev); border-radius:var(--radius); overflow:hidden; display:flex; align-items:center; justify-content:center;">
          <div class="spinner"></div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:320px;">
          <button class="primary" id="share" disabled>Compartir / Guardar</button>
          <button id="download" disabled>Descargar imagen</button>
          <button class="ghost" id="back2">Seguir editando</button>
        </div>
      </div>
    </div>
  `;

  const preview = root.querySelector('#preview');
  const shareBtn = root.querySelector('#share');
  const dlBtn = root.querySelector('#download');
  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'edit' }));
  root.querySelector('#back2').addEventListener('click', () => patchUi({ screen: 'edit' }));

  let blob = null;
  try {
    blob = await composeFinal({
      room: s.room,
      painting: s.painting,
      frame: s.frame ? { stripBitmap: s.frame.stripBitmap, sliceWidth: s.frame.sliceWidth } : null,
      placement: s.placement,
      frameBorderFrac: s.frame ? (s.frame.borderFrac || 0.06) : 0,
      paintingBlob: s.painting.blob,
      roomBlob: s.room.blob
    });
    const url = URL.createObjectURL(blob);
    preview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:contain; background:#000;">`;
    shareBtn.disabled = false;
    dlBtn.disabled = false;

    dlBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `feditor-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    shareBtn.addEventListener('click', async () => {
      const file = new File([blob], `feditor-${Date.now()}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Mi cuadro en la habitación' });
        } catch (err) {
          if (err.name !== 'AbortError') showToast('No se pudo compartir');
        }
      } else {
        dlBtn.click();
      }
    });
  } catch (err) {
    console.error(err);
    preview.innerHTML = '<div style="padding:24px; color:var(--danger); text-align:center;">Error al generar la imagen</div>';
  }
}
