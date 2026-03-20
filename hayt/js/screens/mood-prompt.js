// "¿Cómo estás?" mood prompt screen
import { MOODS, getPromptCooldownMs } from '../lib/constants.js';
import { toDateStr, toTimeStr } from '../lib/date-utils.js';
import { moodFaceSvg } from '../components/mood-faces.js';
import { putMood, addChangeEntry, getRecentMoods } from '../db.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';

export async function shouldShowPrompt() {
  const since = Date.now() - getPromptCooldownMs();
  const recent = await getRecentMoods(since);
  return recent.length === 0;
}

export function render(container) {
  container.innerHTML = `
    <div class="mood-prompt">
      <h1 class="prompt-title">¿Cómo estás?</h1>
      <div class="mood-grid">
        ${MOODS.map(m => `
          <button class="mood-btn" data-mood="${m.value}" aria-label="${m.label}">
            ${moodFaceSvg(m.value, 80)}
            <span class="mood-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
    </div>`;

  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => recordMood(parseInt(btn.dataset.mood, 10)));
  });
}

async function recordMood(value) {
  const now = new Date();
  const mood = {
    id: crypto.randomUUID(),
    timestamp: now.getTime(),
    date: toDateStr(now),
    time: toTimeStr(now),
    mood: value,
    deviceId: getDeviceId(),
  };

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

  state.set('syncStatus', 'pending');
  toast('Guardado', 'success', 1500);

  // Trigger sync
  const { syncNow } = window._haytSync ?? {};
  if (syncNow) syncNow();

  // Navigate to calendar
  location.hash = '#calendar';
}

function getDeviceId() {
  let id = localStorage.getItem('hayt-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('hayt-device-id', id);
  }
  return id;
}

export { getDeviceId };
