import { getState, patchUi } from '../state.js';
import { metaFor } from '../lib/pipeline.js';
import { renderSheetPng, renderPdf } from '../lib/exporters.js';
import { showToast } from '../components/toast.js';

class Cancelled extends Error {}

export function mountExport(root) {
  const s = getState();
  if (!s.image || !s.pattern) {
    patchUi({ screen: s.image ? 'pattern' : 'pick-image' });
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Patrón</button>
        <h1>Descargar</h1>
        <div class="spacer"></div>
      </div>
      <div class="screen-body padded-bottom">
        <div class="file-card">
          <div class="file-title">Imagen PNG</div>
          <div class="file-desc">Todo el patrón con símbolos y la leyenda en una sola imagen de alta resolución, para verla con zoom.</div>
          <div class="file-status" id="png-status">Preparando…</div>
          <div class="file-actions">
            <button class="primary" id="png-share" disabled>Compartir</button>
            <button id="png-dl" disabled>Descargar</button>
          </div>
        </div>
        <div class="file-card">
          <div class="file-title">PDF para imprimir (A4)</div>
          <div class="file-desc">Resumen con mapa de páginas, leyenda de hilos DMC y el patrón repartido en hojas A4 de 70 × 100 puntos.</div>
          <div class="file-status" id="pdf-status">En espera…</div>
          <div class="file-actions">
            <button class="primary" id="pdf-share" disabled>Compartir</button>
            <button id="pdf-dl" disabled>Descargar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const meta = metaFor(s);
  const baseName = `pcruz-${s.frameId}-aida${s.count}-${s.pattern.palette.length}col`;
  const urls = [];
  let alive = true;
  const check = () => { if (!alive) throw new Cancelled(); };

  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'pattern' }));
  root._cleanup = () => {
    alive = false;
    for (const u of urls) URL.revokeObjectURL(u);
  };

  const pngStatus = root.querySelector('#png-status');
  const pdfStatus = root.querySelector('#pdf-status');

  (async () => {
    try {
      const png = await renderSheetPng(s.pattern, meta, (f) => {
        check();
        pngStatus.textContent = `Generando… ${Math.round(f * 100)} %`;
      });
      check();
      pngStatus.textContent = `${png.width.toLocaleString('es-ES')} × ${png.height.toLocaleString('es-ES')} px · ${fmtSize(png.blob.size)}`;
      enable(root, 'png', png.blob, `${baseName}.png`, urls);
    } catch (err) {
      if (err instanceof Cancelled) return;
      console.error(err);
      fail(pngStatus);
    }

    try {
      pdfStatus.textContent = 'Generando…';
      const pdf = await renderPdf(s.pattern, meta, (done, total) => {
        check();
        pdfStatus.textContent = `Generando… página ${done} de ${total}`;
      });
      check();
      pdfStatus.textContent = `${pdf.pages} páginas · ${fmtSize(pdf.blob.size)}`;
      enable(root, 'pdf', pdf.blob, `${baseName}.pdf`, urls);
    } catch (err) {
      if (err instanceof Cancelled) return;
      console.error(err);
      fail(pdfStatus);
    }
  })();
}

function enable(root, kind, blob, filename, urls) {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  const dl = root.querySelector(`#${kind}-dl`);
  const share = root.querySelector(`#${kind}-share`);

  dl.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  share.addEventListener('click', async () => {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Patrón de punto de cruz' });
      } catch (err) {
        if (err.name !== 'AbortError') showToast('No se pudo compartir');
      }
    } else {
      dl.click();
    }
  });
  dl.disabled = false;
  share.disabled = false;
}

function fail(el) {
  el.textContent = 'Error al generar el archivo';
  el.classList.add('error');
}

function fmtSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
