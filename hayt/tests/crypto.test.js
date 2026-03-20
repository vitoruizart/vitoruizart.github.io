import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSalt, deriveKey, encryptBlob, decryptBlob,
  encryptEntity, decryptEntity,
  createVerifier, checkVerifier,
  cacheEncryptionKey, getCachedEncryptionKey, hasEncryptionKey, clearEncryptionKey,
  getCachedSalt,
} from '../js/crypto.js';

const PASSWORD = 'test-password-123';

async function makeKey(password = PASSWORD) {
  const salt = generateSalt();
  return { key: await deriveKey(password, salt), salt };
}

describe('generateSalt', () => {
  it('returns a base64 string', () => {
    const salt = generateSalt();
    expect(typeof salt).toBe('string');
    expect(salt.length).toBeGreaterThan(0);
  });

  it('generates different salts each call', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toBe(b);
  });
});

describe('deriveKey', () => {
  it('returns a CryptoKey', async () => {
    const salt = generateSalt();
    const key = await deriveKey(PASSWORD, salt);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
  });

  it('same password+salt produces same key', async () => {
    const salt = generateSalt();
    const k1 = await deriveKey(PASSWORD, salt);
    const k2 = await deriveKey(PASSWORD, salt);
    // Can't directly compare CryptoKeys, but both should work for same data
    const plaintext = 'test';
    const encrypted = await encryptBlob(k1, plaintext);
    const decrypted = await decryptBlob(k2, encrypted);
    expect(decrypted).toBe(plaintext);
  });
});

describe('encryptBlob / decryptBlob', () => {
  it('roundtrip preserves plaintext', async () => {
    const { key } = await makeKey();
    const plaintext = 'hello world 🌍';
    const encrypted = await encryptBlob(key, plaintext);
    const decrypted = await decryptBlob(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', async () => {
    const { key } = await makeKey();
    const plaintext = 'same text';
    const a = await encryptBlob(key, plaintext);
    const b = await encryptBlob(key, plaintext);
    expect(a).not.toBe(b);
  });

  it('decryptBlob with wrong key throws', async () => {
    const { key: key1 } = await makeKey('password-1');
    const { key: key2 } = await makeKey('password-2');
    const encrypted = await encryptBlob(key1, 'secret');
    await expect(decryptBlob(key2, encrypted)).rejects.toThrow();
  });

  it('handles empty string', async () => {
    const { key } = await makeKey();
    const encrypted = await encryptBlob(key, '');
    const decrypted = await decryptBlob(key, encrypted);
    expect(decrypted).toBe('');
  });

  it('handles long plaintext', async () => {
    const { key } = await makeKey();
    const plaintext = 'x'.repeat(10000);
    const encrypted = await encryptBlob(key, plaintext);
    const decrypted = await decryptBlob(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });
});

describe('encryptEntity / decryptEntity', () => {
  it('strips mood field and adds _enc', async () => {
    const { key } = await makeKey();
    const entity = { id: 'abc', mood: 4, date: '2025-01-01', timestamp: 1000 };
    const encrypted = await encryptEntity(key, entity);
    expect(encrypted).not.toHaveProperty('mood');
    expect(encrypted).toHaveProperty('_enc');
    expect(encrypted.id).toBe('abc');
    expect(encrypted.date).toBe('2025-01-01');
  });

  it('roundtrip restores original entity', async () => {
    const { key } = await makeKey();
    const entity = { id: 'abc', mood: 4, date: '2025-01-01', timestamp: 1000 };
    const encrypted = await encryptEntity(key, entity);
    const decrypted = await decryptEntity(key, encrypted);
    expect(decrypted).toEqual(entity);
  });

  it('encrypts and decrypts note field alongside mood', async () => {
    const { key } = await makeKey();
    const entity = { id: 'n1', mood: 3, note: 'Feeling okay today', date: '2025-03-20', timestamp: 2000 };
    const encrypted = await encryptEntity(key, entity);
    expect(encrypted).not.toHaveProperty('mood');
    expect(encrypted).not.toHaveProperty('note');
    expect(encrypted).toHaveProperty('_enc');
    const decrypted = await decryptEntity(key, encrypted);
    expect(decrypted).toEqual(entity);
  });

  it('decryptEntity on entity without _enc returns unchanged', async () => {
    const { key } = await makeKey();
    const entity = { id: 'abc', mood: 3, date: '2025-01-01' };
    const result = await decryptEntity(key, entity);
    expect(result).toEqual(entity);
  });

  it('decryptEntity ignores non-string _enc', async () => {
    const { key } = await makeKey();
    const entity = { id: 'abc', _enc: 123 };
    const result = await decryptEntity(key, entity);
    expect(result).toEqual(entity);
  });

  it('decryptEntity rejects with "malformed JSON" for non-JSON encrypted data', async () => {
    const { key } = await makeKey();
    const blob = await encryptBlob(key, 'not valid json {{{');
    const entity = { id: 'abc', _enc: blob };
    await expect(decryptEntity(key, entity)).rejects.toThrow('malformed JSON');
  });
});

describe('createVerifier / checkVerifier', () => {
  it('checkVerifier returns true with correct key', async () => {
    const { key } = await makeKey();
    const verifier = await createVerifier(key);
    const valid = await checkVerifier(key, verifier);
    expect(valid).toBe(true);
  });

  it('checkVerifier returns false with wrong key', async () => {
    const { key: key1 } = await makeKey('pass1');
    const { key: key2 } = await makeKey('pass2');
    const verifier = await createVerifier(key1);
    const valid = await checkVerifier(key2, verifier);
    expect(valid).toBe(false);
  });
});

describe('key caching', () => {
  beforeEach(() => {
    clearEncryptionKey();
  });

  it('hasEncryptionKey returns false initially', () => {
    expect(hasEncryptionKey()).toBe(false);
  });

  it('cacheEncryptionKey stores key and salt', async () => {
    const { key, salt } = await makeKey();
    cacheEncryptionKey(key, salt);
    expect(hasEncryptionKey()).toBe(true);
    expect(getCachedEncryptionKey()).toBe(key);
    expect(getCachedSalt()).toBe(salt);
  });

  it('clearEncryptionKey removes cached key', async () => {
    const { key, salt } = await makeKey();
    cacheEncryptionKey(key, salt);
    clearEncryptionKey();
    expect(hasEncryptionKey()).toBe(false);
    expect(getCachedEncryptionKey()).toBeNull();
    expect(getCachedSalt()).toBeNull();
  });
});
