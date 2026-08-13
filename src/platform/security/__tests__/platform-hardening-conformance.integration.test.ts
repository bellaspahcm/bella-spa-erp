/**
 * BELLA PLATFORM — SECURITY CONFORMANCE INTEGRATION TESTS
 *
 * Verifies security laws under Phase 7:
 * - Law 2: KMS isolation (Tenant A cannot decrypt Tenant B secrets, dynamic context validation)
 * - Law 4: Cryptographic Ledger verification (robustly tests 6 audit tampering attacks)
 * - Law 5: Performance tracing & observability metrics collection
 *
 * @module src/platform/security/__tests__/platform-hardening-conformance.integration.test
 */

import { CryptographicAuditLedger, AuditBlock } from '../audit-ledger';
import { KmsSecretManager } from '../kms-secret-manager';
import { TelemetryTracer } from '../telemetry-tracer';

describe('BELLA PLATFORM V2 — SECURITY CONFORMANCE INTEGRATION TESTS', () => {
  let ledger: CryptographicAuditLedger;
  let kms: KmsSecretManager;

  const TENANT_A = 'tenant-hardening-a';
  const TENANT_B = 'tenant-hardening-b';

  beforeEach(() => {
    ledger = new CryptographicAuditLedger();
    kms = new KmsSecretManager();
    CryptographicAuditLedger.clearLedgers();
    TelemetryTracer.reset();
  });

  // --- Law 2: KMS Isolation Tests ---
  describe('KMS Secret & Credential Isolation (Law 2)', () => {
    test('Tenant A can decrypt its own encrypted credentials successfully', async () => {
      const plaintext = 'smtp-password-secure-1234';
      const keyName = 'smtp_credentials';
      
      const cipherText = await kms.encryptPayload(TENANT_A, keyName, plaintext);
      const decrypted = await kms.decryptPayload(TENANT_A, keyName, cipherText);
      expect(decrypted).toBe(plaintext);
    });

    test('Tenant B attempting to decrypt Tenant A payload throws DECRYPTION_FAILED', async () => {
      const plaintext = 'db-connection-secret-token';
      const keyName = 'db_token';

      const cipherText = await kms.encryptPayload(TENANT_A, keyName, plaintext);
      
      // Decrypt using TENANT_B context must fail
      await expect(
        kms.decryptPayload(TENANT_B, keyName, cipherText)
      ).rejects.toThrow('SECRET_DECRYPTION_FAILED');
    });

    test('Access decryption with a mismatched keyName throws DECRYPTION_FAILED', async () => {
      const plaintext = 'payment-gateway-api-key';
      const cipherText = await kms.encryptPayload(TENANT_A, 'stripe_key', plaintext);

      // Decrypting with wrong key name
      await expect(
        kms.decryptPayload(TENANT_A, 'paypal_key', cipherText)
      ).rejects.toThrow('SECRET_DECRYPTION_FAILED');
    });
  });

  // --- Law 4: Cryptographic Ledger & 6 Tampering Attacks ---
  describe('Cryptographic Ledger & Tampering Vulnerabilities (Law 4)', () => {
    let blocks: AuditBlock[];

    beforeEach(async () => {
      // Append three valid transactions representing standard accounting ledger postings
      await ledger.appendAuditBlock(TENANT_A, 'Enrolled student 1001 in Course CS101');
      await ledger.appendAuditBlock(TENANT_A, 'Billed student 1001 tuition fees');
      await ledger.appendAuditBlock(TENANT_A, 'Received payment of 5,000,000 VND');

      // Resolve blocks inside ledger mapping
      const result = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(result.valid).toBe(true);
    });

    test('Attack 1: Modifying a historical block payload breaks the chain', async () => {
      // Modifies the payload of block sequence 2
      CryptographicAuditLedger.corruptBlock(TENANT_A, 2, 'Rogue payload injection: credit user 1,000,000,000 VND');

      const integrity = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(integrity.valid).toBe(false);
      expect(integrity.corruptedSequence).toBe(3);
    });

    test('Attack 2: Deleting a block breaks sequence continuity', async () => {
      // Fetch private ledger blocks directly and simulate deletion of block 2
      const rawLedgersMap = (CryptographicAuditLedger as any).ledgers;
      const tenantBlocks = rawLedgersMap.get(TENANT_A) as AuditBlock[];
      
      // Remove middle block (index 1)
      tenantBlocks.splice(1, 1);

      const integrity = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(integrity.valid).toBe(false);
      expect(integrity.corruptedSequence).toBe(3); // Sequence link broke at sequence 3
    });

    test('Attack 3: Injecting a fake block breaks sequence and hash chain', async () => {
      const rawLedgersMap = (CryptographicAuditLedger as any).ledgers;
      const tenantBlocks = rawLedgersMap.get(TENANT_A) as AuditBlock[];

      // Insert a rogue record in the middle
      const fakeBlock: AuditBlock = {
        sequence: 2,
        tenantId: TENANT_A,
        payload: 'Injected fake transaction',
        previousHash: tenantBlocks[0].currentHash,
        currentHash: 'ROUGE-HASH-000000000000000000000000000'
      };
      tenantBlocks.splice(1, 0, fakeBlock);

      const integrity = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(integrity.valid).toBe(false);
    });

    test('Attack 4: Reordering historical blocks breaks hash chain integrity', async () => {
      const rawLedgersMap = (CryptographicAuditLedger as any).ledgers;
      const tenantBlocks = rawLedgersMap.get(TENANT_A) as AuditBlock[];

      // Swap blocks 1 and 2 (indices 0 and 1)
      const temp = tenantBlocks[0];
      tenantBlocks[0] = tenantBlocks[1];
      tenantBlocks[1] = temp;

      const integrity = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(integrity.valid).toBe(false);
    });

    test('Attack 5: Altering tenantId of a block breaks validation', async () => {
      const rawLedgersMap = (CryptographicAuditLedger as any).ledgers;
      const tenantBlocks = rawLedgersMap.get(TENANT_A) as AuditBlock[];

      // Spoof tenantId of block index 1 to Tenant B
      (tenantBlocks[1] as any).tenantId = TENANT_B;

      const integrity = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(integrity.valid).toBe(false);
    });

    test('Attack 6: Changing the payload directly breaks calculated hash validation', async () => {
      const rawLedgersMap = (CryptographicAuditLedger as any).ledgers;
      const tenantBlocks = rawLedgersMap.get(TENANT_A) as AuditBlock[];

      // Directly manipulate string value in memory without updating the hash link
      (tenantBlocks[2] as any).payload = 'Altered text';

      const integrity = await ledger.verifyLedgerIntegrity(TENANT_A);
      expect(integrity.valid).toBe(false);
    });
  });

  // --- Law 5: Performance Tracing and Observability Traces ---
  describe('Performance Tracing & Observability Tracing (Law 5)', () => {
    test('Executing core actions records trace blocks correctly', async () => {
      const result = await TelemetryTracer.trace(
        TENANT_A,
        'education',
        'calculate_tuition_fees',
        async (traceId) => {
          TelemetryTracer.incrementQueryCount(traceId);
          TelemetryTracer.incrementQueryCount(traceId);
          return { fee: 5000000 };
        }
      );

      expect(result.fee).toBe(5000000);

      const traces = TelemetryTracer.getTraces();
      expect(traces.length).toBe(1);
      
      const trace = traces[0];
      expect(trace.tenantId).toBe(TENANT_A);
      expect(trace.vertical).toBe('education');
      expect(trace.operation).toBe('calculate_tuition_fees');
      expect(trace.queryCount).toBe(2);
      expect(trace.success).toBe(true);
      expect(trace.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
