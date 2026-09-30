import { getState, setState, patchUi } from '../state.js';
import { FRAMES, FABRICS, findFabric, frameDims, stitchGrid } from '../lib/frames.js';
import { fmtCm, stitchCount, daysToStitch, durationLabel } from '../lib/pipeline.js';
import { loadPace, savePace, MIN_PACE, MAX_PACE, PACE_STEP } from '../lib/pace.js';

export function mountSetup(root) {
  if (!getState().image) {
    patchUi({ screen: 'pick-image' });
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Imagen</button>
        <h1>Marco y tela</h1>
        <div class="spacer"></div>
      </div>
      <div class="screen-body">
        <section class="section">
          <h3>Tela</h3>
          <div class="segmented" id="fabric"></div>
          <p class="hint" id="fabric-hint"></p>
        </section>
        <section class="section">
          <h3>Orientación</h3>
          <div class="segmented" id="orientation">
            <button data-value="portrait">Vertical</button>
            <button data-value="landscape">Horizontal</button>
          </div>
        </section>
        <section class="section">
          <h3>Ritmo de bordado</h3>
          <div class="slider-row">
            <label for="pace">Al día</label>
            <input type="range" id="pace" min="${MIN_PACE}" max="${MAX_PACE}" step="${PACE_STEP}">
            <span class="value" id="pace-val"></span>
          </div>
          <p class="hint">Cuadritos que bordas en un día (cada cuadrito son dos puntadas). Con este ritmo se calculan los días de cada marco.</p>
        </section>
        <section class="section">
          <h3>Tamaño del marco (cm)</h3>
          <div class="frame-grid" id="frames"></div>
          <p class="hint" id="time-hint"></p>
        </section>
      </div>
      <div class="screen-footer">
        <button class="primary" id="next">Continuar</button>
      </div>
    </div>
  `;

  const fabricEl = root.querySelector('#fabric');
  const orientationEl = root.querySelector('#orientation');
  const framesEl = root.querySelector('#frames');
  const hintEl = root.querySelector('#fabric-hint');
  const timeEl = root.querySelector('#time-hint');
  const paceEl = root.querySelector('#pace');
  const paceValEl = root.querySelector('#pace-val');
  let perDay = loadPace();
  paceEl.value = String(perDay);

  fabricEl.innerHTML = FABRICS.map((f) => `<button data-value="${f.count}">${f.label}</button>`).join('');

  const refresh = () => {
    const s = getState();
    for (const b of fabricEl.children) b.classList.toggle('selected', Number(b.dataset.value) === s.count);
    for (const b of orientationEl.children) b.classList.toggle('selected', b.dataset.value === s.orientation);
    const fabric = findFabric(s.count);
    hintEl.textContent = `${fabric.label}: ${fabric.count} puntos por pulgada (${fmtCm((fabric.count / 2.54).toFixed(1))} por cm), ` +
      `se borda con ${fabric.strands} hebras. Aida 14 es la más común; un número mayor da más detalle.`;
    paceValEl.textContent = String(perDay);
    renderFrames(framesEl, s, perDay);
    const stitches = stitchCount(s);
    const days = daysToStitch(stitches, perDay);
    const span = durationLabel(days);
    timeEl.textContent = `Tiempo estimado a ${perDay} cuadritos al día: ${fmtDays(days)}${span ? ` (${span})` : ''} ` +
      `para unos ${stitches.toLocaleString('es-ES')} cuadritos. Cuenta con el encuadre actual; el margen blanco no se borda.`;
  };

  fabricEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { setState({ count: Number(b.dataset.value) }); refresh(); }
  });
  orientationEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { setState({ orientation: b.dataset.value }); refresh(); }
  });
  paceEl.addEventListener('input', () => {
    perDay = Number(paceEl.value);
    savePace(perDay);
    refresh();
  });
  framesEl.addEventListener('click', (e) => {
    const card = e.target.closest('.frame-card');
    if (card) { setState({ frameId: card.dataset.id }); refresh(); }
  });
  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'pick-image' }));
  root.querySelector('#next').addEventListener('click', () => patchUi({ screen: 'crop' }));

  refresh();
}

function renderFrames(container, s, perDay) {
  const maxSide = 48;
  const longest = Math.max(...FRAMES.map((f) => f.h));
  container.innerHTML = FRAMES.map((f) => {
    const { wCm, hCm } = frameDims(f, s.orientation);
    const { cols, rows } = stitchGrid(f, s.count, s.orientation);
    const days = daysToStitch(stitchCount({ ...s, frameId: f.id }), perDay);
    // Shapes share one scale so the cards also show relative size.
    const k = maxSide / longest;
    const w = Math.max(10, Math.round(wCm * k));
    const h = Math.max(10, Math.round(hCm * k));
    return `
      <button class="frame-card${f.id === s.frameId ? ' selected' : ''}" data-id="${f.id}">
        <div class="frame-shape-box"><div class="frame-shape" style="width:${w}px;height:${h}px"></div></div>
        <div class="frame-label">${f.name ? f.name + ' · ' : ''}${fmtCm(wCm)} × ${fmtCm(hCm)}</div>
        <div class="frame-sub">${cols} × ${rows} puntos</div>
        <div class="frame-days">${fmtDays(days)}</div>
      </button>`;
  }).join('');
}

function fmtDays(days) {
  return `≈ ${days.toLocaleString('es-ES')} ${days === 1 ? 'día' : 'días'}`;
}
