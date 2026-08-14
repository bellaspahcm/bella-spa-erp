/**
 * Bella AI Platform — KMS Secret Manager
 *
 * Implements Secret Isolation Law. Tacks encryption and decryption behind a KMS-based
 * key-derivation boundary (each tenant derives unique key dynamically, no plain text exposure).
 *
 * @module platform/security/kms-secret-manager
 */

import crypto from 'crypto';

export interface IKmsSecretManagerContract {
  encryptPayload(tenantId: string, keyName: string, plaintext: string): Promise<string>;
  decryptPayload(tenantId: string, keyName: string, ciphertext: string): Promise<string>;
}

export class KmsSecretManager implements IKmsSecretManagerContract {
  // A simulated master KMS key. In production, this would reside in an external KMS provider (AWS KMS, GCP KMS).
  private static masterKmsKey = 'BELLA-PLATFORM-SUPREME-MASTER-KMS-SECRET-KEY-2026';

  /**
   * Derives a tenant-specific, cryptographically secure 256-bit key in-memory.
   * This isolates encryption keys so Tenant A's derived key can never decrypt Tenant B's secrets.
   */
  private deriveTenantKey(tenantId: string, keyName: string): Buffer {
    const salt = crypto.createHash('sha256').update(`${tenantId}-${keyName}`).digest();
    return crypto.scryptSync(KmsSecretManager.masterKmsKey, salt, 32);
  }

  public async encryptPayload(tenantId: string, keyName: string, plaintext: string): Promise<string> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required.');
    if (!plaintext) throw new Error('Invalid secret content.');

    const tenantKey = this.deriveTenantKey(tenantId, keyName);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', tenantKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return format: iv:ciphertext
    return `${iv.toString('hex')}:${encrypted}`;
  }

  public async decryptPayload(tenantId: string, keyName: string, ciphertext: string): Promise<string> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required.');
    if (!ciphertext) throw new Error('Invalid ciphertext.');

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 2) {
        throw new Error('CORRUPTED_SECRET: Ciphertext payload format is invalid.');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];

      const tenantKey = this.deriveTenantKey(tenantId, keyName);

      const decipher = crypto.createDecipheriv('aes-256-cbc', tenantKey, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      // Throw generic secure message (Secret Isolation Law: do not leak key details or plain text values on error)
      throw new Error('SECRET_DECRYPTION_FAILED: Decryption failed. Context mismatch or corrupted payload.');
    }
  }
}
