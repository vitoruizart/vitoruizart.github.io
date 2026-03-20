// Settings screen — PAT, repo, encryption password, sync controls
import { testConnection } from '../github-api.js';
import { clearEncryptionKey } from '../crypto.js';
import { toast } from '../components/toast.js';
import { startSync, stopSync, syncNow } from '../sync.js';

export function render(container) {
  const pat = localStorage.getItem('hayt-pat') ?? '';
  const repo = localStorage.getItem('hayt-repo') ?? '';
  const password = localStorage.getItem('hayt-password') ?? '';

  container.innerHTML = `
    <div class="settings-view">
      <div class="settings-header">
        <button class="back-btn" id="settings-back" aria-label="Volver">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 class="settings-title">Ajustes</h2>
      </div>

      <div class="settings-section">
        <h3 class="section-title">Sincronización</h3>

        <label class="field-label" for="s-pat">GitHub Token (PAT)</label>
        <input type="password" id="s-pat" class="field-input" value="${escapeAttr(pat)}"
          placeholder="ghp_..." autocomplete="off" spellcheck="false">

        <label class="field-label" for="s-repo">Repositorio</label>
        <input type="text" id="s-repo" class="field-input" value="${escapeAttr(repo)}"
          placeholder="usuario/repositorio" autocomplete="off" spellcheck="false">

        <label class="field-label" for="s-password">Contraseña de encriptación</label>
        <input type="password" id="s-password" class="field-input" value="${escapeAttr(password)}"
          placeholder="Contraseña segura" autocomplete="off">

        <div class="settings-actions">
          <button class="btn-secondary" id="s-test">Probar conexión</button>
          <button class="btn-primary" id="s-save">Guardar</button>
        </div>

        <div class="settings-actions">
          <button class="btn-secondary" id="s-sync-now">Sincronizar ahora</button>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="section-title">Información</h3>
        <p class="settings-info">Los datos se guardan localmente y se sincronizan encriptados a tu repositorio de GitHub.</p>
        <p class="settings-info settings-version">hayt v1.0</p>
      </div>
    </div>`;

  // Back
  container.querySelector('#settings-back').addEventListener('click', () => {
    location.hash = '#calendar';
  });

  // Test connection
  container.querySelector('#s-test').addEventListener('click', async () => {
    const patVal = container.querySelector('#s-pat').value.trim();
    const repoVal = container.querySelector('#s-repo').value.trim();
    if (!patVal || !repoVal) {
      toast('Completa token y repositorio', 'error');
      return;
    }
    toast('Probando conexión...', 'info', 2000);
    const ok = await testConnection(patVal, repoVal);
    toast(ok ? 'Conexión exitosa' : 'Error de conexión', ok ? 'success' : 'error');
  });

  // Save
  container.querySelector('#s-save').addEventListener('click', () => {
    const patVal = container.querySelector('#s-pat').value.trim();
    const repoVal = container.querySelector('#s-repo').value.trim();
    const passVal = container.querySelector('#s-password').value;

    if (patVal) localStorage.setItem('hayt-pat', patVal);
    else localStorage.removeItem('hayt-pat');

    if (repoVal) localStorage.setItem('hayt-repo', repoVal);
    else localStorage.removeItem('hayt-repo');

    if (passVal) localStorage.setItem('hayt-password', passVal);
    else localStorage.removeItem('hayt-password');

    // Clear cached key when password changes
    clearEncryptionKey();

    toast('Guardado', 'success', 1500);

    // Start sync if credentials are complete
    if (patVal && repoVal && passVal) {
      stopSync();
      startSync();
    }
  });

  // Sync now
  container.querySelector('#s-sync-now').addEventListener('click', () => {
    syncNow(true);
  });
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
