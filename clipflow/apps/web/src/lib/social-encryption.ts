import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SOCIAL_COOKIE_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('SOCIAL_COOKIE_ENCRYPTION_KEY environment variable is not set');
  }

  // Use PBKDF2 to derive a consistent 32-byte key from the environment key
  return crypto.pbkdf2Sync(key, 'social-cookie-salt', 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt cookie data using AES-256-GCM
 */
export function encryptCookie(cookieData: Record<string, unknown>): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const jsonString = JSON.stringify(cookieData);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ]);

    return combined.toString('base64');
  } catch (error) {
    console.error('Failed to encrypt cookie data:', error);
    throw new Error('Failed to encrypt cookie data');
  }
}

/**
 * Decrypt cookie data using AES-256-GCM
 */
export function decryptCookie(encryptedData: string): Record<string, unknown> | null {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = combined.subarray(ENCRYPTED_POSITION);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    console.error('Failed to decrypt cookie data:', error);
    return null;
  }
}

/**
 * Validate encryption key is configured
 */
export function validateEncryptionConfig(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
