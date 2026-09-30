import { getState, setState, patchUi, defaultSettings } from '../state.js';
import { computePattern, metaFor } from '../lib/pipeline.js';
import { patternSummary, previewCanvas } from '../lib/exporters.js';
import { textColorFor } from '../lib/color.js';
import { skeinsNeeded } from '../lib/skeins.js';
import { clearDraft } from '../lib/drafts.js';
import { MIN_COLORS, MAX_COLORS } from '../lib/constants.js';
import { showToast } from '../components/toast.js';

export function mountPattern(root) {
  if (!getState().image) {
    patchUi({ screen: 'pick-image' });
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Encuadre</button>
        <h1>Patrón</h1>
        <button class="action" id="new">Nuevo</button>
      </div>
      <div class="screen-body">
        <div class="preview-wrap">
          <canvas id="preview" width="1" height="1"></canvas>
          <div class="busy" id="busy"><div class="spinner"></div></div>
        </div>
        <div class="summary" id="summary"></div>
        <div class="slider-row">
          <label for="colors">Colores</label>
          <input type="range" id="colors" min="${MIN_COLORS}" max="${MAX_COLORS}" step="1">
          <span class="value" id="colors-val"></span>
        </div>
        <p class="hint">Número máximo de hilos. Con menos colores el patrón es más sencillo de bordar; con más, más fiel a la imagen.</p>
        <div class="legend-list" id="legend"></div>
      </div>
      <div class="screen-footer">
        <button class="primary" id="export" disabled>Ver patrón y descargar</button>
      </div>
    </div>
  `;

  const preview = root.querySelector('#preview');
  const busy = root.querySelector('#busy');
  const summaryEl = root.querySelector('#summary');
  const legendEl = root.querySelector('#legend');
  const slider = root.querySelector('#colors');
  const sliderVal = root.querySelector('#colors-val');
  const exportBtn = root.querySelector('#export');

  slider.value = String(getState().maxColors);
  sliderVal.textContent = slider.value;

  let timer = null;
  let alive = true;

  const recompute = () => {
    busy.hidden = false;
    exportBtn.disabled = true;
    // Let the spinner paint before the (synchronous) quantizer runs.
    setTimeout(() => {
      if (!alive) return;
      try {
        const s = getState();
        const pattern = computePattern(s);
        setState({ pattern });
        render(pattern, metaFor(s));
        exportBtn.disabled = false;
      } catch (err) {
        console.error(err);
        showToast('No se pudo generar el patrón');
      } finally {
        busy.hidden = true;
      }
    }, 30);
  };

  function render(pattern, meta) {
    preview.width = pattern.cols;
    preview.height = pattern.rows;
    // One canvas pixel per stitch, scaled up by CSS (pixelated) to fit.
    const boxW = preview.parentElement.clientWidth - 24;
    const k = Math.min(boxW / pattern.cols, (window.innerHeight * 0.52) / pattern.rows);
    preview.style.width = `${Math.floor(pattern.cols * k)}px`;
    preview.style.height = `${Math.floor(pattern.rows * k)}px`;
    preview.getContext('2d').drawImage(previewCanvas(pattern), 0, 0);

    const sum = patternSummary(pattern, meta);
    summaryEl.innerHTML = `
      <strong>${pattern.cols} × ${pattern.rows} puntos</strong> · ${meta.frameLabel} cm · ${meta.fabricLabel} (${meta.strands} hebras)<br>
      <strong>${sum.colors} colores DMC</strong> · ${sum.stitches.toLocaleString('es-ES')} puntadas · ~${sum.skeins} madejas
    `;
    legendEl.innerHTML = pattern.palette.map((e) => `
      <div class="legend-row">
        <div class="legend-swatch" style="background:${e.hex};color:${textColorFor(e.rgb)}">${escapeHtml(e.symbol)}</div>
        <div class="legend-code">${escapeHtml(e.code)}</div>
        <div class="legend-name">${escapeHtml(e.name)}</div>
        <div class="legend-count">${e.count.toLocaleString('es-ES')} pts<br>${skeinsNeeded(e.count, meta.count, meta.strands)} mad.</div>
      </div>`).join('');
  }

  slider.addEventListener('input', () => {
    sliderVal.textContent = slider.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      setState({ maxColors: Number(slider.value) });
      recompute();
    }, 250);
  });
  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'crop' }));
  exportBtn.addEventListener('click', () => patchUi({ screen: 'preview' }));
  preview.addEventListener('click', () => {
    if (!exportBtn.disabled) patchUi({ screen: 'preview' });
  });
  root.querySelector('#new').addEventListener('click', async () => {
    if (!confirm('¿Descartar este patrón y empezar con otra imagen?')) return;
    await clearDraft();
    const { frameId, count, maxColors } = getState();
    setState({ image: null, pattern: null, ...defaultSettings(), frameId, count, maxColors });
    patchUi({ screen: 'pick-image' });
  });

  root._cleanup = () => {
    alive = false;
    clearTimeout(timer);
  };

  recompute();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
