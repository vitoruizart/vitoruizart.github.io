import { getState, patchUi } from '../state.js';
import { previewCanvas } from '../lib/exporters.js';
import { attachGestures } from '../lib/gestures.js';
import { fitView, clampView, viewLimits, transformView, drawChartView } from '../lib/chart-view.js';

const PAD = 12;

export function mountPreview(root) {
  const s = getState();
  if (!s.image || !s.pattern) {
    patchUi({ screen: s.image ? 'pattern' : 'pick-image' });
    return;
  }
  const { pattern } = s;
  const { cols, rows } = pattern;

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back">‹ Patrón</button>
        <h1>Vista previa</h1>
        <button class="action" id="fit">Ver todo</button>
      </div>
      <div class="viewer-stage" id="stage"><canvas id="cv"></canvas></div>
      <div class="screen-footer">
        <div class="viewer-hint">Pellizca para ampliar y ver los símbolos de cada punto</div>
        <button class="primary" id="next">Descargar PNG o PDF</button>
      </div>
    </div>
  `;

  const stage = root.querySelector('#stage');
  const canvas = root.querySelector('#cv');
  const ctx = canvas.getContext('2d');
  const colours = previewCanvas(pattern);
  let vw = 0;
  let vh = 0;
  let view = null;
  let frame = 0;

  const update = (next) => {
    view = clampView(next, cols, rows, vw, vh, PAD);
    if (!frame) frame = requestAnimationFrame(draw);
  };

  function draw() {
    frame = 0;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
    }
    drawChartView(ctx, pattern, colours, view, vw, vh, dpr);
  }

  /** Zoom factor that keeps the view inside its limits. */
  const allowedFactor = (from, factor) => {
    const { min, max } = viewLimits(cols, rows, vw, vh, PAD);
    return Math.min(max, Math.max(min, from.s * factor)) / from.s;
  };

  const local = (p) => {
    const r = stage.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  };

  const detach = attachGestures(stage, {
    snapshot: () => view,
    onMove: (delta, base) => {
      const from = base.snapshot;
      if (!from) return;
      update(transformView(from, allowedFactor(from, delta.scale), local(base.centroid), local(delta.centroid)));
    }
  });

  const onWheel = (e) => {
    e.preventDefault();
    if (!view) return;
    const p = local({ x: e.clientX, y: e.clientY });
    update(transformView(view, allowedFactor(view, Math.exp(-e.deltaY * 0.0015)), p, p));
  };
  stage.addEventListener('wheel', onWheel, { passive: false });

  root.querySelector('#fit').addEventListener('click', () => {
    if (vw && vh) update(fitView(cols, rows, vw, vh, PAD));
  });
  root.querySelector('.back').addEventListener('click', () => patchUi({ screen: 'pattern' }));
  root.querySelector('#next').addEventListener('click', () => patchUi({ screen: 'export' }));

  const ro = new ResizeObserver(() => {
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    if (!vw || !vh) return;
    update(view || fitView(cols, rows, vw, vh, PAD));
  });
  ro.observe(stage);

  root._cleanup = () => {
    detach();
    ro.disconnect();
    cancelAnimationFrame(frame);
  };
}
