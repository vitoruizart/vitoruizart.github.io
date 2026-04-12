import { getState, subscribe, setState, patchUi } from './state.js';
import { mountPickPainting } from './screens/pick-painting.js';
import { mountPickFrame } from './screens/pick-frame.js';
import { mountPickRoom } from './screens/pick-room.js';
import { mountEdit } from './screens/edit.js';
import { mountExport } from './screens/export.js';
import { loadDraft, scheduleDraftSave } from './lib/drafts.js';
import { loadBitmap, downscaleBitmap, naturalSize } from './lib/image-io.js';
import { maybeShowInstallHint } from './lib/install-hint.js';
import { checkForUpdate } from './lib/update-checker.js';
import { showToast } from './components/toast.js';

const root = document.getElementById('app');
let currentScreen = null;
let prevScreen = null;

const screens = {
  'pick-painting': mountPickPainting,
  'pick-frame': mountPickFrame,
  'pick-room': mountPickRoom,
  'edit': mountEdit,
  'export': mountExport
};

function render() {
  const { ui } = getState();
  if (ui.screen === currentScreen) return;
  // Cleanup previous screen if it registered a hook.
  if (root._cleanup) { try { root._cleanup(); } catch (_) {} root._cleanup = null; }
  prevScreen = currentScreen;
  currentScreen = ui.screen;
  root.innerHTML = '';
  const mount = screens[ui.screen];
  if (mount) mount(root);
}

subscribe(render);
subscribe((s) => {
  // Persist draft only after the painting is loaded; before that there's nothing useful.
  if (s.painting) scheduleDraftSave(s);
});

(async function boot() {
  const draft = await loadDraft();
  if (draft && draft.paintingBlob) {
    try {
      const bm = await downscaleBitmap(await loadBitmap(draft.paintingBlob));
      const { naturalW, naturalH } = naturalSize(bm);
      setState({
        painting: { blob: draft.paintingBlob, bitmap: bm, naturalW, naturalH },
        placement: draft.placement || getState().placement
      });
      // Painting is restored; frame and room must be re-picked, but the
      // placement (position/scale/rotation/tilt) will carry over to edit.
      patchUi({ screen: 'pick-frame' });
    } catch {
      // Stale draft, ignore.
      render();
    }
  } else {
    render();
  }
  maybeShowInstallHint();
  checkForUpdate({ onAvailable: () => showToast('Nueva versión disponible — recarga para actualizar', 4000) });
})();
