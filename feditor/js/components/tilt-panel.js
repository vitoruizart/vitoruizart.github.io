export function mountTiltPanel(container, getValues, onChange) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px; padding:6px 4px; width:100%;">
      <div class="slider-row"><label>Inclinar ↕</label><input type="range" min="-45" max="45" step="1" id="rx"></div>
      <div class="slider-row"><label>Inclinar ↔</label><input type="range" min="-45" max="45" step="1" id="ry"></div>
      <div class="slider-row"><label>Girar ↻</label><input type="range" min="-45" max="45" step="1" id="rz"></div>
    </div>
  `;
  const rx = container.querySelector('#rx');
  const ry = container.querySelector('#ry');
  const rz = container.querySelector('#rz');
  const v = getValues();
  rx.value = v.rotateX;
  ry.value = v.rotateY;
  rz.value = v.rotate;
  rx.addEventListener('input', () => onChange({ rotateX: +rx.value }));
  ry.addEventListener('input', () => onChange({ rotateY: +ry.value }));
  rz.addEventListener('input', () => onChange({ rotate: +rz.value }));
}
