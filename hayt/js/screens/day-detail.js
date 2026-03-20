// Day detail view — list moods, edit, delete, add
import { MOODS } from '../lib/constants.js';
import { parseDate, toDateStr, toTimeStr } from '../lib/date-utils.js';
import { getMood as getMoodDef } from '../lib/constants.js';
import { moodFaceSvg } from '../components/mood-faces.js';
import { getMoodsByDate, putMood, deleteMood as dbDeleteMood, addChangeEntry } from '../db.js';
import { toast } from '../components/toast.js';
import { getDeviceId } from './mood-prompt.js';
import * as state from '../state.js';

export async function render(container, dateStr) {
  const entries = await getMoodsByDate(dateStr);
  entries.sort((a, b) => a.timestamp - b.timestamp);

  const dateObj = parseDate(dateStr);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const title = `${dayNames[dateObj.getDay()]} ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]}`;

  container.innerHTML = `
    <div class="day-detail">
      <div class="day-header">
        <button class="back-btn" id="day-back" aria-label="Volver">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 class="day-title">${title}</h2>
      </div>
      <div class="day-entries" id="day-entries">
        ${entries.length === 0
          ? '<p class="day-empty">Sin registros este día</p>'
          : entries.map(e => renderEntry(e)).join('')}
      </div>
      <div class="day-actions">
        <button class="btn-primary" id="day-add">Agregar estado de ánimo</button>
      </div>
      <div class="mood-picker hidden" id="mood-picker">
        <h3 class="picker-title">¿Cómo estabas?</h3>
        <div class="mood-grid mood-grid-small">
          ${MOODS.map(m => `
            <button class="mood-btn mood-btn-small" data-mood="${m.value}">
              ${moodFaceSvg(m.value, 56)}
              <span class="mood-label">${m.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>`;

  // Back button
  container.querySelector('#day-back').addEventListener('click', () => {
    location.hash = '#calendar';
  });

  // Delete handlers
  container.querySelectorAll('.entry-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await dbDeleteMood(id);
      await addChangeEntry({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        entityType: 'mood',
        entityId: id,
        operation: 'delete',
        deviceId: getDeviceId(),
      });
      state.set('syncStatus', 'pending');
      state.set('moodsUpdated', Date.now());
      const { syncNow } = window._haytSync ?? {};
      if (syncNow) syncNow();
      toast('Eliminado', 'success', 1500);
      render(container, dateStr);
    });
  });

  // Edit handlers
  container.querySelectorAll('.entry-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showEditPicker(container, dateStr, id, entries.find(e => e.id === id));
    });
  });

  // Add mood
  container.querySelector('#day-add').addEventListener('click', () => {
    const picker = container.querySelector('#mood-picker');
    picker.classList.toggle('hidden');
    picker.querySelectorAll('.mood-btn').forEach(mbtn => {
      mbtn.onclick = () => addMoodForDay(container, dateStr, parseInt(mbtn.dataset.mood, 10));
    });
  });
}

function renderEntry(entry) {
  const mood = getMoodDef(entry.mood);
  return `<div class="day-entry" style="border-left-color:${mood.color}">
    <div class="entry-face">${moodFaceSvg(entry.mood, 40)}</div>
    <div class="entry-info">
      <span class="entry-label">${mood.label}</span>
      <span class="entry-time">${entry.time}</span>
    </div>
    <div class="entry-actions">
      <button class="entry-edit" data-id="${entry.id}" aria-label="Editar" title="Editar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="entry-delete" data-id="${entry.id}" aria-label="Eliminar" title="Eliminar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
  </div>`;
}

function showEditPicker(container, dateStr, entryId, entry) {
  const picker = container.querySelector('#mood-picker');
  picker.classList.remove('hidden');
  const title = picker.querySelector('.picker-title');
  title.textContent = 'Cambiar estado de ánimo';
  picker.querySelectorAll('.mood-btn').forEach(mbtn => {
    mbtn.onclick = () => editMood(container, dateStr, entryId, entry, parseInt(mbtn.dataset.mood, 10));
  });
}

async function editMood(container, dateStr, entryId, entry, newValue) {
  const updated = { ...entry, mood: newValue };
  await putMood(updated);
  await addChangeEntry({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    entityType: 'mood',
    entityId: entryId,
    operation: 'upsert',
    data: { ...updated },
    deviceId: getDeviceId(),
  });
  state.set('syncStatus', 'pending');
  state.set('moodsUpdated', Date.now());
  const { syncNow } = window._haytSync ?? {};
  if (syncNow) syncNow();
  toast('Actualizado', 'success', 1500);
  render(container, dateStr);
}

async function addMoodForDay(container, dateStr, value) {
  const now = new Date();
  const mood = {
    id: crypto.randomUUID(),
    timestamp: now.getTime(),
    date: dateStr,
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
  state.set('moodsUpdated', Date.now());
  const { syncNow: syncFn } = window._haytSync ?? {};
  if (syncFn) syncFn();
  toast('Guardado', 'success', 1500);
  render(container, dateStr);
}
