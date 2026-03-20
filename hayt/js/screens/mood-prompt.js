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

let autoSaveTimer = null;

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
      <div class="note-section hidden" id="note-section">
        <textarea class="field-input note-input" id="mood-note"
          placeholder="¿Qué está pasando?" rows="3" maxlength="500"></textarea>
        <button class="btn-primary note-save-btn" id="note-save">Guardar</button>
      </div>
    </div>`;

  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.mood, 10);
      showNoteField(container, value);
    });
  });
}

function showNoteField(container, moodValue) {
  // Highlight selected mood button
  container.querySelectorAll('.mood-btn').forEach(b => {
    b.style.opacity = parseInt(b.dataset.mood, 10) === moodValue ? '1' : '0.4';
    b.style.pointerEvents = 'none';
  });

  const noteSection = container.querySelector('#note-section');
  noteSection.classList.remove('hidden');
  noteSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-save after 2s if user doesn't interact with the note field
  autoSaveTimer = setTimeout(() => saveMood(moodValue, ''), 2000);

  const textarea = container.querySelector('#mood-note');
  textarea.addEventListener('input', () => {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
  });

  container.querySelector('#note-save').addEventListener('click', () => {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    saveMood(moodValue, textarea.value.trim());
  });
}

async function saveMood(value, note) {
  // Prevent double-save
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }

  const now = new Date();
  const mood = {
    id: crypto.randomUUID(),
    timestamp: now.getTime(),
    date: toDateStr(now),
    time: toTimeStr(now),
    mood: value,
    deviceId: getDeviceId(),
  };
  if (note) mood.note = note;

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
    return;
  }

  state.set('syncStatus', 'pending');
  toast('Guardado', 'success', 1500);

  // Trigger sync
  const { syncNow } = window._haytSync ?? {};
  if (syncNow) syncNow();

  // Navigate to calendar
  location.hash = '#calendar';
}
