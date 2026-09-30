import { getState, subscribe, setState, patchUi } from './state.js';
import { mountPickImage } from './screens/pick-image.js';
import { mountSetup } from './screens/setup.js';
import { mountCrop } from './screens/crop.js';
import { mountPattern } from './screens/pattern.js';
import { mountPreview } from './screens/preview.js';
import { mountExport } from './screens/export.js';
import { loadDraft, scheduleDraftSave, clearDraft, sanitizeSettings, isRestorableDraft } from './lib/drafts.js';
import { loadBitmap, downscaleBitmap, naturalSize } from './lib/image-io.js';
import { maybeShowInstallHint } from './lib/install-hint.js';
import { checkForUpdate } from './lib/update-checker.js';
import { showUpdateModal } from './components/update-modal.js';

const root = document.getElementById('app');
let currentScreen = null;

const screens = {
  'pick-image': mountPickImage,
  'setup': mountSetup,
  'crop': mountCrop,
  'pattern': mountPattern,
  'preview': mountPreview,
  'export': mountExport
};

function render() {
  const { ui } = getState();
  if (ui.screen === currentScreen) return;
  // Cleanup previous screen if it registered a hook.
  if (root._cleanup) { try { root._cleanup(); } catch (_) {} root._cleanup = null; }
  currentScreen = ui.screen;
  root.innerHTML = '';
  const mount = screens[ui.screen];
  if (mount) mount(root);
}

subscribe(render);
subscribe((s) => {
  if (s.image) scheduleDraftSave(s);
});

(async function boot() {
  const draft = await loadDraft();
  if (isRestorableDraft(draft)) {
    // Build the full patch before touching state. If anything fails (corrupt
    // blob, unsupported format) the store stays untouched and we fall back
    // to a clean start instead of a half-populated state.
    try {
      const bitmap = await downscaleBitmap(await loadBitmap(draft.imageBlob));
      const { w, h } = naturalSize(bitmap);
      if (!w || !h) throw new Error('empty image');
      setState({ image: { blob: draft.imageBlob, bitmap, w, h }, ...sanitizeSettings(draft) });
      patchUi({ screen: 'pattern' });
    } catch {
      // Draft is unusable — drop it so we don't re-attempt on every boot.
      try { await clearDraft(); } catch (_) {}
      render();
    }
  } else {
    render();
  }
  maybeShowInstallHint();
  checkForUpdate({ onAvailable: () => showUpdateModal() });
})();

// Installed PWAs resume from the home-screen icon without reloading, so
// re-check for updates whenever the app regains focus.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForUpdate({ onAvailable: () => showUpdateModal() });
  }
});
