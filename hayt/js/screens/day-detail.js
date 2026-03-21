// Day detail view — list moods, edit, delete, add
import { MOODS } from '../lib/constants.js';
import { parseDate, toDateStr, toTimeStr } from '../lib/date-utils.js';
import { getMood as getMoodDef } from '../lib/constants.js';
import { moodFaceSvg } from '../components/mood-faces.js';
import { getMoodsByDate, putMood, deleteMood as dbDeleteMood, addChangeEntry } from '../db.js';
import { toast } from '../components/toast.js';
import { getDeviceId } from '../sync.js';
import * as state from '../state.js';

export async function render(container, dateStr) {
  const entries = await getMoodsByDate(dateStr);
  entries.sort((a, b) => a.timestamp - b.timestamp);

  const dateObj = parseDate(dateStr);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const title = `${dayNames[dateObj.getDay()]} ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]}`;
  const isToday = dateStr === toDateStr(new Date());
  const pickerTitle = isToday
    ? '¿Cómo estás hoy?'
    : `¿Cómo estabas el ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]}?`;

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
        <h3 class="picker-title">${pickerTitle}</h3>
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

  attachEntryHandlers(container, dateStr, entries);

  // Add mood
  const moodGridHtml = `
    <h3 class="picker-title">${pickerTitle}</h3>
    <div class="mood-grid mood-grid-small">
      ${MOODS.map(m => `
        <button class="mood-btn mood-btn-small" data-mood="${m.value}">
          ${moodFaceSvg(m.value, 56)}
          <span class="mood-label">${m.label}</span>
        </button>
      `).join('')}
    </div>`;
  container.querySelector('#day-add').addEventListener('click', () => {
    // Close any open inline edit picker
    const editPicker = container.querySelector('.edit-picker-inline');
    if (editPicker) {
      editPicker.remove();
      container.querySelector('#day-add').classList.remove('hidden');
    }
    const picker = container.querySelector('#mood-picker');
    const addBtn = container.querySelector('#day-add');
    picker.classList.remove('hidden');
    addBtn.classList.add('hidden');
    picker.innerHTML = moodGridHtml;
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    picker.querySelectorAll('.mood-btn').forEach(mbtn => {
      mbtn.onclick = () => addMoodForDay(container, dateStr, parseInt(mbtn.dataset.mood, 10));
    });
  });
}

function attachEntryHandlers(container, dateStr, entries) {
  container.querySelectorAll('.entry-delete').forEach(btn => {
    let confirmTimeout = null;
    btn.addEventListener('click', async () => {
      if (!btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.innerHTML = '¿Eliminar?';
        confirmTimeout = setTimeout(() => {
          btn.classList.remove('confirm');
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
        }, 3000);
        return;
      }
      clearTimeout(confirmTimeout);
      const id = btn.dataset.id;
      try {
        await dbDeleteMood(id);
        await addChangeEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          entityType: 'mood',
          entityId: id,
          operation: 'delete',
          deviceId: getDeviceId(),
        });
      } catch (err) {
        console.error('Failed to delete mood:', err);
        toast('Error al eliminar', 'error');
        return;
      }
      state.set('syncStatus', 'pending');
      state.set('moodsUpdated', Date.now());
      const { syncNow } = window._haytSync ?? {};
      if (syncNow) syncNow();
      toast('Eliminado', 'success', 1500);
      render(container, dateStr);
    });
  });

  container.querySelectorAll('.entry-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showEditPicker(container, dateStr, id, entries.find(e => e.id === id));
    });
  });
}

async function refreshEntries(container, dateStr) {
  const entries = await getMoodsByDate(dateStr);
  entries.sort((a, b) => a.timestamp - b.timestamp);
  const entriesEl = container.querySelector('#day-entries');
  entriesEl.innerHTML = entries.length === 0
    ? '<p class="day-empty">Sin registros este día</p>'
    : entries.map(e => renderEntry(e)).join('');
  attachEntryHandlers(container, dateStr, entries);
  return entries;
}

function renderEntry(entry) {
  const mood = getMoodDef(entry.mood);
  const noteHtml = entry.note
    ? `<span class="entry-note"><svg class="entry-note-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${escapeHtml(entry.note)}</span>`
    : '';
  return `<div class="day-entry" style="border-left-color:${mood.color}">
    <div class="entry-face">${moodFaceSvg(entry.mood, 40)}</div>
    <div class="entry-info">
      <span class="entry-label">${mood.label}</span>
      <span class="entry-time">${entry.time}</span>
      ${noteHtml}
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

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showEditPicker(container, dateStr, entryId, entry) {
  // Hide the add picker if open
  container.querySelector('#mood-picker').classList.add('hidden');

  // Toggle off if same entry clicked again
  const existing = container.querySelector('.edit-picker-inline');
  if (existing && existing.dataset.entryId === entryId) {
    existing.remove();
    container.querySelector('#day-add').classList.remove('hidden');
    return;
  }
  if (existing) existing.remove();

  // Find the entry DOM element and insert picker right after it
  const entryEl = container.querySelector(`.entry-edit[data-id="${entryId}"]`).closest('.day-entry');
  const picker = document.createElement('div');
  picker.className = 'edit-picker-inline';
  picker.dataset.entryId = entryId;
  picker.innerHTML = `
    <div class="mood-grid mood-grid-small">
      ${MOODS.map(m => `
        <button class="mood-btn mood-btn-small" data-mood="${m.value}">
          ${moodFaceSvg(m.value, 56)}
          <span class="mood-label">${m.label}</span>
        </button>
      `).join('')}
    </div>`;
  entryEl.after(picker);
  picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Hide add button when editing the last entry
  const allEntries = container.querySelectorAll('#day-entries .day-entry');
  if (entryEl === allEntries[allEntries.length - 1]) {
    container.querySelector('#day-add').classList.add('hidden');
  }

  picker.querySelectorAll('.mood-btn').forEach(mbtn => {
    mbtn.onclick = () => editMood(container, dateStr, entryId, entry, parseInt(mbtn.dataset.mood, 10));
  });
}

async function editMood(container, dateStr, entryId, entry, newValue) {
  const updated = { ...entry, mood: newValue };
  try {
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
  } catch (err) {
    console.error('Failed to update mood:', err);
    toast('Error al actualizar', 'error');
    return;
  }
  state.set('syncStatus', 'pending');
  state.set('moodsUpdated', Date.now());
  const { syncNow } = window._haytSync ?? {};
  if (syncNow) syncNow();
  toast('Actualizado', 'success', 1500);

  await refreshEntries(container, dateStr);

  // Show inline note step below the edited entry
  const entryEl = container.querySelector(`.entry-edit[data-id="${entryId}"]`)?.closest('.day-entry');
  if (entryEl) {
    const postSaveEl = document.createElement('div');
    postSaveEl.className = 'edit-picker-inline';
    postSaveEl.dataset.entryId = entryId;
    entryEl.after(postSaveEl);
    showInlineNoteStep(postSaveEl, container, dateStr, updated);
  }
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
  state.set('moodsUpdated', Date.now());
  const { syncNow: syncFn } = window._haytSync ?? {};
  if (syncFn) syncFn();
  toast('Guardado', 'success', 1500);

  await refreshEntries(container, dateStr);

  // Show note step in the add picker area
  const picker = container.querySelector('#mood-picker');
  showInlineNoteStep(picker, container, dateStr, mood);
}

function showInlineNoteStep(targetEl, container, dateStr, savedMood) {
  targetEl.innerHTML = `
    <div class="mood-post-actions">
      <button class="btn-primary" id="post-add-note">Añadir nota</button>
      <button class="btn-secondary" id="post-done">Listo (5)</button>
    </div>`;

  const addBtn = container.querySelector('#day-add');
  const doneBtn = targetEl.querySelector('#post-done');
  let remaining = 5;

  const dismiss = () => {
    clearInterval(countdownId);
    addBtn.classList.remove('hidden');
    if (targetEl.id === 'mood-picker') {
      targetEl.classList.add('hidden');
    } else {
      targetEl.remove();
    }
  };

  const countdownId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      dismiss();
    } else {
      doneBtn.textContent = `Listo (${remaining})`;
    }
  }, 1000);

  doneBtn.addEventListener('click', dismiss);

  targetEl.querySelector('#post-add-note').addEventListener('click', () => {
    clearInterval(countdownId);
    const actions = targetEl.querySelector('.mood-post-actions');
    actions.innerHTML = `
      <div class="note-section">
        <textarea class="field-input note-input" id="day-mood-note"
          placeholder="¿Qué está pasando?" rows="3" maxlength="500"></textarea>
        <button class="btn-primary note-save-btn" id="day-note-save">Guardar</button>
      </div>`;

    const textarea = actions.querySelector('#day-mood-note');
    textarea.focus();

    actions.querySelector('#day-note-save').addEventListener('click', async () => {
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
      state.set('moodsUpdated', Date.now());
      const { syncNow } = window._haytSync ?? {};
      if (syncNow) syncNow();
      toast('Nota guardada', 'success', 1500);
      await refreshEntries(container, dateStr);
      addBtn.classList.remove('hidden');
      if (targetEl.id === 'mood-picker') {
        targetEl.classList.add('hidden');
      } else {
        targetEl.remove();
      }
    });
  });
}
