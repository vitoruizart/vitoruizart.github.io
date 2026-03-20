// Mood definitions: value → display metadata
export const MOODS = [
  { value: 5, label: 'Feliz',        color: '#F39C12', bg: 'rgba(243,156,18,0.15)' },
  { value: 4, label: 'Contenta',     color: '#2ECC71', bg: 'rgba(46,204,113,0.15)' },
  { value: 3, label: 'Ni fu ni fa',  color: '#9B59B6', bg: 'rgba(155,89,182,0.15)' },
  { value: 2, label: 'Triste',       color: '#5B9BD5', bg: 'rgba(91,155,213,0.15)' },
  { value: 1, label: 'Hecha polvo',  color: '#4a4a4a', bg: 'rgba(74,74,74,0.15)' },
];

export function getMood(value) {
  return MOODS.find(m => m.value === value) ?? MOODS[2];
}

// Sync
export const SNAPSHOT_FILE = 'hayt-snapshot.json';
export const CHANGELOG_FILE = 'hayt-changelog.json';
export const SYNC_VERSION = 1;
export const COMPACTION_THRESHOLD = 30;
export const POLL_INTERVAL_MS = 60_000;

// Prompt
export const DEFAULT_PROMPT_HOURS = 8;
export const APP_VERSION = '20260320.2143';

export function getPromptCooldownMs() {
  const stored = localStorage.getItem('hayt-prompt-hours');
  const hours = stored ? parseFloat(stored) : DEFAULT_PROMPT_HOURS;
  return (isNaN(hours) || hours <= 0 ? DEFAULT_PROMPT_HOURS : hours) * 60 * 60 * 1000;
}
