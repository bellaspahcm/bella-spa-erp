/**
 * Bella AI Platform — Cryptographic Audit Ledger
 *
 * Implements the Cryptographic Provenance Law. Links audit blocks in a SHA-256
 * chain to detect database tampering.
 *
 * @module platform/security/audit-ledger
 */

import crypto from 'crypto';

export interface AuditBlock {
  readonly sequence: number;
  readonly tenantId: string;
  readonly payload: string;
  readonly previousHash: string;
  readonly currentHash: string;
}

export interface IAuditLedgerContract {
  appendAuditBlock(tenantId: string, payload: string): Promise<AuditBlock>;
  verifyLedgerIntegrity(tenantId: string): Promise<{ valid: boolean; corruptedSequence?: number }>;
}

export class CryptographicAuditLedger implements IAuditLedgerContract {
  // In-memory ledger storage simulation. In production, this maps to an append-only database table.
  private static ledgers: Map<string, AuditBlock[]> = new Map();

  public static clearLedgers(): void {
    this.ledgers.clear();
  }

  // Helper to corrupt the ledger (used exclusively for test validation of the T2 conformance suite)
  public static corruptBlock(tenantId: string, sequence: number, newPayload: string): void {
    const blocks = this.ledgers.get(tenantId);
    if (blocks) {
      const idx = blocks.findIndex(b => b.sequence === sequence);
      if (idx !== -1) {
        const oldBlock = blocks[idx];
        // Recalculate hash of this block to simulate silent DB injection, but don't cascade, breaking the chain.
        const hash = crypto.createHash('sha256')
          .update(`${oldBlock.sequence}-${oldBlock.tenantId}-${newPayload}-${oldBlock.previousHash}`)
          .digest('hex');
        
        blocks[idx] = {
          sequence: oldBlock.sequence,
          tenantId: oldBlock.tenantId,
          payload: newPayload,
          previousHash: oldBlock.previousHash,
          currentHash: hash
        };
      }
    }
  }

  private calculateHash(sequence: number, tenantId: string, payload: string, previousHash: string): string {
    return crypto.createHash('sha256')
      .update(`${sequence}-${tenantId}-${payload}-${previousHash}`)
      .digest('hex');
  }

  public async appendAuditBlock(tenantId: string, payload: string): Promise<AuditBlock> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required.');

    let blocks = CryptographicAuditLedger.ledgers.get(tenantId);
    if (!blocks) {
      blocks = [];
      CryptographicAuditLedger.ledgers.set(tenantId, blocks);
    }

    const sequence = blocks.length + 1;
    const previousHash = sequence === 1 ? 'GENESIS-BLOCK-000000000000000000000' : blocks[blocks.length - 1].currentHash;
    const currentHash = this.calculateHash(sequence, tenantId, payload, previousHash);

    const block: AuditBlock = {
      sequence,
      tenantId,
      payload,
      previousHash,
      currentHash
    };

    blocks.push(block);
    return block;
  }

  public async verifyLedgerIntegrity(tenantId: string): Promise<{ valid: boolean; corruptedSequence?: number }> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required.');

    const blocks = CryptographicAuditLedger.ledgers.get(tenantId);
    if (!blocks || blocks.length === 0) {
      return { valid: true };
    }

    for (let i = 0; i < blocks.length; i++) {
      const current = blocks[i];

      // 1. Verify genesis or previous hash link matches
      if (i === 0) {
        if (current.previousHash !== 'GENESIS-BLOCK-000000000000000000000') {
          return { valid: false, corruptedSequence: current.sequence };
        }
      } else {
        const previous = blocks[i - 1];
        if (current.previousHash !== previous.currentHash) {
          return { valid: false, corruptedSequence: current.sequence };
        }
      }

      // 2. Re-compute hash of payload to check if corrupted in place
      const recomputedHash = this.calculateHash(
        current.sequence,
        current.tenantId,
        current.payload,
        current.previousHash
      );

      if (current.currentHash !== recomputedHash) {
        return { valid: false, corruptedSequence: current.sequence };
      }
    }

    return { valid: true };
  }
}
