// Settings screen — General + Sync tabs
import { testConnection } from '../github-api.js';
import { clearEncryptionKey } from '../crypto.js';
import { toast } from '../components/toast.js';
import { startSync, stopSync, syncNow } from '../sync.js';
import { getAllMoods } from '../db.js';
import { DEFAULT_PROMPT_HOURS, APP_VERSION } from '../lib/constants.js';
import { escapeAttr, isValidPat, isValidRepo } from '../lib/validators.js';
import { checkForUpdate } from '../lib/update-checker.js';

const PROMPT_OPTIONS = [2, 4, 6, 8, 12, 24];

export function render(container) {
  const pat = localStorage.getItem('hayt-pat') ?? '';
  const repo = localStorage.getItem('hayt-repo') ?? '';
  const password = localStorage.getItem('hayt-password') ?? '';
  const promptHours = localStorage.getItem('hayt-prompt-hours') ?? String(DEFAULT_PROMPT_HOURS);

  container.innerHTML = `
    <div class="settings-view">
      <div class="settings-header">
        <button class="back-btn" id="settings-back" aria-label="Volver">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 class="settings-title">Ajustes</h2>
      </div>

      <div class="settings-tabs" role="tablist">
        <button class="settings-tab-btn active" data-tab="general" role="tab" aria-selected="true" aria-controls="tab-general" id="tabbtn-general">General</button>
        <button class="settings-tab-btn" data-tab="sync" role="tab" aria-selected="false" aria-controls="tab-sync" id="tabbtn-sync">Sincronización</button>
      </div>

      <div class="settings-tab" id="tab-general" role="tabpanel" aria-labelledby="tabbtn-general">
        <div class="settings-section">
          <h3 class="section-title">Frecuencia de registro</h3>
          <label class="field-label" for="s-prompt-freq">Preguntar cada</label>
          <select id="s-prompt-freq" class="field-input">
            ${PROMPT_OPTIONS.map(h => `<option value="${h}"${String(h) === promptHours ? ' selected' : ''}>${h} horas</option>`).join('')}
          </select>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Datos</h3>
          <button class="btn-secondary" id="s-export" style="width:100%">Exportar datos (CSV)</button>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Información</h3>
          <p class="settings-info">Los datos se guardan localmente y se sincronizan encriptados a tu repositorio de GitHub.</p>
          <p class="settings-info settings-version">hayt v${escapeAttr(APP_VERSION)}</p>
          <p class="settings-info settings-attribution">Mood icons by <a href="https://www.flaticon.com/authors/justicon" target="_blank" rel="noopener">justicon</a> — <a href="https://www.flaticon.com/" target="_blank" rel="noopener">Flaticon</a></p>
        </div>
      </div>

      <div class="settings-tab hidden" id="tab-sync" role="tabpanel" aria-labelledby="tabbtn-sync">
        <div class="settings-section">
          <h3 class="section-title">GitHub</h3>

          <label class="field-label" for="s-pat">GitHub Token (PAT)</label>
          <div class="field-password-wrap">
            <input type="password" id="s-pat" class="field-input" value="${escapeAttr(pat)}"
              placeholder="ghp_..." autocomplete="off" spellcheck="false">
            <button type="button" class="field-toggle-vis" data-target="s-pat" aria-label="Mostrar/ocultar token">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>

          <label class="field-label" for="s-repo">Repositorio</label>
          <input type="text" id="s-repo" class="field-input" value="${escapeAttr(repo)}"
            placeholder="usuario/repositorio" autocomplete="off" spellcheck="false">

          <label class="field-label" for="s-password">Contraseña de encriptación</label>
          <div class="field-password-wrap">
            <input type="password" id="s-password" class="field-input" value="${escapeAttr(password)}"
              placeholder="Contraseña segura" autocomplete="off">
            <button type="button" class="field-toggle-vis" data-target="s-password" aria-label="Mostrar/ocultar contraseña">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>

          <div class="settings-actions">
            <button class="btn-secondary" id="s-test">Probar conexión</button>
            <button class="btn-primary" id="s-save">Guardar</button>
          </div>

          <div class="settings-actions">
            <button class="btn-secondary" id="s-sync-now">Sincronizar ahora</button>
          </div>
        </div>
      </div>
    </div>`;

  // Password visibility toggles
  container.querySelectorAll('.field-toggle-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = container.querySelector(`#${btn.dataset.target}`);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Tab switching
  container.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.settings-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      container.querySelectorAll('.settings-tab').forEach(t => t.classList.add('hidden'));
      container.querySelector(`#tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });

  // Back
  container.querySelector('#settings-back').addEventListener('click', () => {
    location.hash = '#calendar';
  });

  // Prompt frequency — auto-save on change
  container.querySelector('#s-prompt-freq').addEventListener('change', (e) => {
    localStorage.setItem('hayt-prompt-hours', e.target.value);
    toast(`Frecuencia: cada ${e.target.value}h`, 'success', 1500);
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

    // Validate PAT format
    if (patVal && !isValidPat(patVal)) {
      toast('Token debe empezar con ghp_ o github_pat_', 'error');
      return;
    }

    // Validate repo format
    if (repoVal && !isValidRepo(repoVal)) {
      toast('Formato: usuario/repositorio', 'error');
      return;
    }

    try {
      if (patVal) localStorage.setItem('hayt-pat', patVal);
      else localStorage.removeItem('hayt-pat');

      if (repoVal) localStorage.setItem('hayt-repo', repoVal);
      else localStorage.removeItem('hayt-repo');

      if (passVal) localStorage.setItem('hayt-password', passVal);
      else localStorage.removeItem('hayt-password');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast('Error al guardar ajustes', 'error');
      return;
    }

    // Clear cached key when password changes
    clearEncryptionKey();

    toast('Guardado', 'success', 1500);

    // Start sync if credentials are complete
    if (patVal && repoVal && passVal) {
      stopSync();
      startSync();
    }
  });

  // Sync now + version check
  container.querySelector('#s-sync-now').addEventListener('click', () => {
    syncNow(true);
    checkForUpdate();
  });

  // Export CSV
  container.querySelector('#s-export').addEventListener('click', async () => {
    try {
      const moods = await getAllMoods();
      if (moods.length === 0) {
        toast('No hay datos para exportar', 'info');
        return;
      }
      moods.sort((a, b) => a.timestamp - b.timestamp);
      const csvEscape = (s) => s ? `"${String(s).replace(/"/g, '""')}"` : '';
      const rows = ['date,time,mood,note'];
      for (const m of moods) {
        rows.push(`${m.date},${m.time ?? ''},${m.mood},${csvEscape(m.note ?? '')}`);
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hayt-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Exportado', 'success', 1500);
    } catch (err) {
      console.error('Export failed:', err);
      toast('Error al exportar', 'error');
    }
  });
}
