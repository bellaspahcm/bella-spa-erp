import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const getEncryptionKey = (): Buffer => {
  const rawKey = process.env.DB_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('CRITICAL: DB_ENCRYPTION_KEY environment variable is required but not set.');
  }
  return createHash('sha256').update(rawKey).digest();
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is standard for AES-GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes is the default authentication tag size for AES-GCM

/**
 * Encrypts a plaintext string using AES-256-GCM
 */
export function encrypt(text: string): string {
  if (!text) return '';
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encryptedHex
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption Error]', error);
    throw new Error('Mã hóa dữ liệu thất bại');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string, falls back to plaintext if the string is not encrypted
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  // If the format does not match iv:authTag:encryptedHex, assume it's plaintext
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    return encryptedText;
  }
  
  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid authentication tag length');
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.warn('[Decryption Error] Failed to decrypt, returning raw value as fallback:', error);
    return encryptedText;
  }
}
