/**
 * Encryption utilities for sensitive data (Plaid access tokens)
 * Uses AES-256-GCM for authenticated encryption
 * 
 * IMPORTANT: In production, use a proper key management service (KMS)
 * like AWS KMS, Google Cloud KMS, or HashiCorp Vault
 */

import crypto from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Derive encryption key from master key and salt
 */
function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data (Plaid access tokens)
 * @param {string} text - Plaintext to encrypt
 * @param {string} masterKey - Master encryption key (from environment variable)
 * @returns {string} Encrypted string in format: salt:iv:tag:encryptedData (all base64)
 */
export function encrypt(text, masterKey) {
  if (!masterKey) {
    throw new Error('Encryption key not configured. Set ENCRYPTION_KEY in environment variables.');
  }

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from master key and salt
  const key = deriveKey(masterKey, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Return: salt:iv:tag:encryptedData (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted string in format: salt:iv:tag:encryptedData
 * @param {string} masterKey - Master encryption key (from environment variable)
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedData, masterKey) {
  if (!masterKey) {
    throw new Error('Encryption key not configured. Set ENCRYPTION_KEY in environment variables.');
  }

  // Split encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltBase64, ivBase64, tagBase64, encrypted] = parts;

  // Decode from base64
  const salt = Buffer.from(saltBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');

  // Derive key
  const key = deriveKey(masterKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a string is encrypted (has the expected format)
 * @param {string} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
export function isEncrypted(data) {
  const parts = data.split(':');
  return parts.length === 4 && parts.every(part => {
    try {
      Buffer.from(part, 'base64');
      return true;
    } catch {
      return false;
    }
  });
}

