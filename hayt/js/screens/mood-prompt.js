// "¿Cómo estás?" mood prompt screen
import { MOODS, getPromptCooldownMs } from '../lib/constants.js';
import { toDateStr, toTimeStr } from '../lib/date-utils.js';
import { moodFaceSvg } from '../components/mood-faces.js';
import { putMood, addChangeEntry, getRecentMoods } from '../db.js';
import { toast } from '../components/toast.js';
import { getDeviceId } from '../sync.js';
import * as state from '../state.js';

export async function shouldShowPrompt() {
  const since = Date.now() - getPromptCooldownMs();
  const recent = await getRecentMoods(since);
  return recent.length === 0;
}

export function render(container) {
  let savedMoodRef = null;

  container.innerHTML = `
    <div class="mood-prompt">
      <button class="prompt-close-btn" id="prompt-close" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <h1 class="prompt-title">¿Cómo estás hoy?</h1>
      <div class="mood-grid">
        ${MOODS.map(m => `
          <button class="mood-btn" data-mood="${m.value}" aria-label="${m.label}">
            ${moodFaceSvg(m.value, 80)}
            <span class="mood-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
      <div id="mood-post-save"></div>
    </div>`;

  container.querySelector('#prompt-close').addEventListener('click', () => {
    location.hash = '#calendar';
  });

  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.mood, 10);
      if (savedMoodRef) {
        handleMoodCorrection(container, savedMoodRef, value);
      } else {
        handleMoodSelected(container, value, (mood) => { savedMoodRef = mood; });
      }
    });
  });
}

async function handleMoodSelected(container, moodValue, onSaved) {
  // Disable mood buttons immediately
  container.querySelectorAll('.mood-btn').forEach(b => {
    b.style.opacity = parseInt(b.dataset.mood, 10) === moodValue ? '1' : '0.4';
    b.style.pointerEvents = 'none';
  });

  // Save mood immediately (no note)
  const now = new Date();
  const mood = {
    id: crypto.randomUUID(),
    timestamp: now.getTime(),
    date: toDateStr(now),
    time: toTimeStr(now),
    mood: moodValue,
    deviceId: getDeviceId(),
  };

  try {
    await putMood(mood);
    await addChangeEntry({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      entityType: 'mood',
      entityId: mood.id,
      operation: 'upsert',
      data: { ...mood },
      deviceId: getDeviceId(),
    });
  } catch (err) {
    console.error('Failed to save mood:', err);
    toast('Error al guardar', 'error');
    // Re-enable buttons
    container.querySelectorAll('.mood-btn').forEach(b => {
      b.style.opacity = '1';
      b.style.pointerEvents = '';
    });
    return;
  }

  state.set('syncStatus', 'pending');
  const { syncNow } = window._haytSync ?? {};
  if (syncNow) syncNow();

  // Show post-save UI and re-enable buttons for correction
  showPostSave(container, mood);
  onSaved(mood);

  container.querySelectorAll('.mood-btn').forEach(b => {
    b.style.pointerEvents = '';
  });
}

async function handleMoodCorrection(container, savedMoodRef, newValue) {
  if (savedMoodRef.mood === newValue) return;

  // Reset auto-navigate countdown on correction
  if (container._postSaveTimer) {
    clearInterval(container._postSaveTimer);
    startCalendarCountdown(container);
  }

  // Update highlight immediately
  container.querySelectorAll('.mood-btn').forEach(b => {
    b.style.opacity = parseInt(b.dataset.mood, 10) === newValue ? '1' : '0.4';
    b.style.pointerEvents = 'none';
  });

  // Mutate in-place so existing note handler closures see the change
  savedMoodRef.mood = newValue;

  try {
    await putMood({ ...savedMoodRef });
    await addChangeEntry({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      entityType: 'mood',
      entityId: savedMoodRef.id,
      operation: 'upsert',
      data: { ...savedMoodRef },
      deviceId: getDeviceId(),
    });
  } catch (err) {
    console.error('Failed to update mood:', err);
    toast('Error al actualizar', 'error');
    container.querySelectorAll('.mood-btn').forEach(b => {
      b.style.pointerEvents = '';
    });
    return;
  }

  state.set('syncStatus', 'pending');
  const { syncNow } = window._haytSync ?? {};
  if (syncNow) syncNow();
  toast('Actualizado', 'success', 1500);

  // Re-enable buttons for further corrections
  container.querySelectorAll('.mood-btn').forEach(b => {
    b.style.pointerEvents = '';
  });
}

function showPostSave(container, savedMood) {
  const area = container.querySelector('#mood-post-save');
  area.innerHTML = `
    <p class="mood-saved-msg">Estado de ánimo registrado</p>
    <div class="mood-post-actions">
      <button class="btn-secondary" id="post-go-calendar">Ir al Calendario (5)</button>
      <button class="btn-primary" id="post-add-note">Añadir nota</button>
    </div>`;

  const calBtn = area.querySelector('#post-go-calendar');
  calBtn.addEventListener('click', () => {
    clearInterval(container._postSaveTimer);
    location.hash = '#calendar';
  });

  startCalendarCountdown(container);

  area.querySelector('#post-add-note').addEventListener('click', () => {
    clearInterval(container._postSaveTimer);
    calBtn.textContent = 'Ir al Calendario';
    showNoteField(area, savedMood);
  });
}

function showNoteField(area, savedMood) {
  // Replace action buttons with textarea + save
  const actions = area.querySelector('.mood-post-actions');
  actions.innerHTML = `
    <div class="note-section">
      <textarea class="field-input note-input" id="mood-note"
        placeholder="¿Qué está pasando?" rows="3" maxlength="500"></textarea>
      <button class="btn-primary note-save-btn" id="note-save">Guardar</button>
    </div>`;

  const textarea = actions.querySelector('#mood-note');
  textarea.focus();

  actions.querySelector('#note-save').addEventListener('click', async () => {
    const note = textarea.value.trim();
    if (!note) return;

    const updated = { ...savedMood, note };
    try {
      await putMood(updated);
      await addChangeEntry({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        entityType: 'mood',
        entityId: savedMood.id,
        operation: 'upsert',
        data: { ...updated },
        deviceId: getDeviceId(),
      });
    } catch (err) {
      console.error('Failed to save note:', err);
      toast('Error al guardar nota', 'error');
      return;
    }

    state.set('syncStatus', 'pending');
    const { syncNow } = window._haytSync ?? {};
    if (syncNow) syncNow();
    toast('Nota guardada', 'success', 1500);
    location.hash = '#calendar';
  });
}

function startCalendarCountdown(container) {
  const calBtn = container.querySelector('#post-go-calendar');
  if (!calBtn) return;

  let remaining = 5;
  calBtn.textContent = `Ir al Calendario (${remaining})`;

  container._postSaveTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(container._postSaveTimer);
      location.hash = '#calendar';
    } else {
      calBtn.textContent = `Ir al Calendario (${remaining})`;
    }
  }, 1000);
}
