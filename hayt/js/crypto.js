// Encryption — ported from gtd25/src/sync/crypto.ts
// PBKDF2 600k + AES-256-GCM, per-entity encryption, key caching, verifier

const PBKDF2_ITERATIONS = 600_000;
const VERIFIER_PLAINTEXT = 'hayt-encryption-check';

const SENSITIVE_FIELDS = {
  mood: ['mood'],
};

// --- Key cache ---
let cachedKey = null;
let cachedSalt = null;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  if (cachedKey) {
    idleTimer = setTimeout(() => {
      cachedKey = null;
      cachedSalt = null;
      idleTimer = null;
    }, IDLE_TIMEOUT_MS);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cachedKey) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        cachedKey = null;
        cachedSalt = null;
        idleTimer = null;
      }, 5 * 60 * 1000);
    } else if (document.visibilityState === 'visible') {
      resetIdleTimer();
    }
  });
}

export function clearEncryptionKey() {
  cachedKey = null;
  cachedSalt = null;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

export function hasEncryptionKey() {
  return cachedKey !== null;
}

export function getCachedEncryptionKey() {
  resetIdleTimer();
  return cachedKey;
}

export function cacheEncryptionKey(key, salt) {
  cachedKey = key;
  cachedSalt = salt;
  resetIdleTimer();
}

export function getCachedSalt() {
  return cachedSalt;
}

// --- Primitives ---

export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return uint8ToBase64(bytes);
}

export async function deriveKey(password, saltBase64) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const salt = base64ToUint8(saltBase64);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBlob(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);
  return uint8ToBase64(result);
}

export async function decryptBlob(key, base64Str) {
  const data = base64ToUint8(base64Str);
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

// --- Per-entity encryption ---

export async function encryptEntity(key, entity) {
  const fields = SENSITIVE_FIELDS[entity._type ?? 'mood'] ?? SENSITIVE_FIELDS.mood;
  const sensitiveData = {};
  for (const field of fields) {
    if (field in entity) sensitiveData[field] = entity[field];
  }

  const blob = await encryptBlob(key, JSON.stringify(sensitiveData));

  const result = {};
  for (const [k, v] of Object.entries(entity)) {
    if (!fields.includes(k)) result[k] = v;
  }
  result._enc = blob;
  return result;
}

export async function decryptEntity(key, entity) {
  if (!entity._enc || typeof entity._enc !== 'string') return entity;

  const plaintext = await decryptBlob(key, entity._enc);
  let sensitiveData;
  try {
    sensitiveData = JSON.parse(plaintext);
  } catch {
    throw new Error('decryptEntity: malformed JSON in decrypted data');
  }

  const result = {};
  for (const [k, v] of Object.entries(entity)) {
    if (k !== '_enc') result[k] = v;
  }
  Object.assign(result, sensitiveData);
  return result;
}

// --- Verifier ---

export async function createVerifier(key) {
  return encryptBlob(key, VERIFIER_PLAINTEXT);
}

export async function checkVerifier(key, verifier) {
  try {
    const result = await decryptBlob(key, verifier);
    return result === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

// --- Base64 helpers ---

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
