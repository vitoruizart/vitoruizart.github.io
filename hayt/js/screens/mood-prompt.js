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
  container.innerHTML = `
    <div class="mood-prompt">
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

  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.mood, 10);
      handleMoodSelected(container, value);
    });
  });
}

async function handleMoodSelected(container, moodValue) {
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

  // Show post-save UI
  showPostSave(container, mood);
}

function showPostSave(container, savedMood) {
  const area = container.querySelector('#mood-post-save');
  area.innerHTML = `
    <p class="mood-saved-msg">Estado de ánimo registrado</p>
    <div class="mood-post-actions">
      <button class="btn-secondary" id="post-go-calendar">Ir al Calendario</button>
      <button class="btn-primary" id="post-add-note">Añadir nota</button>
    </div>`;

  area.querySelector('#post-go-calendar').addEventListener('click', () => {
    location.hash = '#calendar';
  });

  area.querySelector('#post-add-note').addEventListener('click', () => {
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
