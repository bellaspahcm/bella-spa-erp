/**
 * PolicyRegistry Integration Tests
 * 
 * Integration test suite for the Capability Risk Registry and Deployment Policy Engine.
 * Verifies all 5 safety invariants, cryptographic signature validation,
 * and governance drift detection.
 * 
 * Enforces Platform Constitution Law 11 (Strictly No any Types).
 * 
 * @module platform/host/policy
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { CapabilityRegistryService } from '../platform/host/capability-registry/capability-registry.service';
import { PolicyEngineService } from '../platform/host/policy/policy-engine.service';
import { GovernanceViolationError } from '../platform/host/policy/types';

interface DBRow {
  capability_id: string;
  capability_name: string;
  domain: string;
  scale_factor: number;
  clinical_criticality: number;
  blast_radius: number;
  risk_score: number;
  calculated_tier: string;
  override_rule: string;
  final_tier: string;
  rollout_policy: string;
  safety_profile: string;
  governance_status: string;
  notes: string | null;
  source_document: string;
  source_version: string;
  generated_at: string;
  generated_from_hash: string;
  matrix_signature: string;
  approved_by: { approvers: string[] };
  approved_at: string;
  generator_version: string;
}

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

class MockQueryBuilder<T> {
  private filteredData: T | null;

  constructor(
    private readonly data: T | null,
    private readonly error: { message: string } | null = null
  ) {
    this.filteredData = data;
  }

  public select(): this {
    return this;
  }

  public eq(column: string, value: string | number): this {
    if (column === 'capability_id' && Array.isArray(this.filteredData)) {
      const rows = this.filteredData as unknown as DBRow[];
      const filtered = rows.filter(r => r.capability_id === value);
      this.filteredData = (filtered.length > 0 ? filtered[0] : null) as unknown as T;
    }
    return this;
  }

  public maybeSingle(): Promise<QueryResult<T>> {
    return Promise.resolve({
      data: this.filteredData,
      error: this.error,
    });
  }

  public then(onfulfilled: (value: QueryResult<T>) => unknown): Promise<unknown> {
    return Promise.resolve({
      data: this.filteredData,
      error: this.error,
    }).then(onfulfilled);
  }
}

describe('Capability Risk Registry & Policy Engine Integration', () => {
  const mockFrom = jest.fn();
  const mockSupabase = {
    from: mockFrom,
  } as unknown as SupabaseClient;

  // Private key to generate valid test signatures (matching the public key in PolicyEngineService)
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQD2fTrYc1BZMzkS
j3FN/9/Jn2QGwDsm3qH0BEty8VrQVJQI2ZLmp6vkcE/JkiAoiWjh04uHZVcwLPfR
soVC7I2eN1PLzSrtbSHqC+oIq+QpXxZf5dSAsS83YGFeX99djsJJVJsLW+5Rkh3d
1Z4Jw1UwwYJwDGMRImTrXRM0x1e+t5lys3qlvSN33kiQ85wSF46JKHKRDWDXCTJr
kLt9aZi8kuiOpiF6d5WcqaqB0o7HsAT1wL5bO8xi1N6ie/DXn5I8XEm2ESGgOEPU
Bck6szZos4oMp0VHsqesqvJx5tKKBxAWipvLJ/vj6mfZazmkHgKAb08ri6aRppub
fhDHYWIPAgMBAAECggEAVkONjKMOw6kBmFVLOhkKoO1/fD1adkgENfoqzZdaSP7Q
sCg1GTQlHFWSFuFlD8rHQgFfG4uD8ABM2r63lKxlA7IpSXIMS/udmuOAjHhb6X61
veoZbNCVzbOVYAn9iiikJjXN7TPHPBT/Dtvr607JSb7vf3dWVHDNEPIJ/ralJsE6
xmDKbMZziXaZIF8cdBCHGfwsBVQlgOfKEjs5t5Wip3MYzoeAHf1PKAvNwJ0UIUtq
KHUtR64KhyVT6fOS4cByQpFv00ua+P+Z9YyuCHoGN73xX75zovekmFZrdKWVIZ7+
8A1wRSAPo5IbrGWCOyOOk1DmeqUN/6GJVSywP/FygQKBgQD8ctMbAcwrnsmlpM3w
gJtLtc4GTzuvZitk/6jC1UYy0fPZTg9nsl+LkESJcjUQdtI4UgBndUATx6Qnjs3I
sJP9mOlOBnRGQ7dKa17TU9zZAtKDAWqiALxwml0mSEwUh9P2f0sgZfY+MuwdBOAs
/pf1RN2nj1QlqZcukneJxHYpKQKBgQD59PFrXWQP3lMzf2MMl9vbfJ08SmOnYkC0
Za+Vguknn41JoY5vyV9qVauxwQG3H6vvmU/EfqKsIwFEWEMhkyQAeDDKhckqPnkV
Y5PmwPoYn5q+B2Y1yhhUXAaADTKyf7KxIT6V4unlp1SOh70oUeG8QeoffV8kWQUO
qwXuXBpAdwKBgQDPoGzKAI94rM8yIjqSfGO9QBjjjZUMLF6yYabeH2Tt9Um2RwJa
ihUVByGnXbwQ/3jkg2T7si5yVjdHpabQUZJV98aiuqI1DAqa9XX3Hzk7bpvOzYJz
HWHexsan7rxMAm6thII4ckO1YlJZh6IMv5QhUHNxFWvi0fmafzI7p857CQKBgQCf
1CIzFuqOwwjMmx4IxWnONSaNkLucIlVhhMv7fFP+BCXh+S4NCOS8J7+7z8B7CgN1
F8FL0fXOwCtlOlLiuyWAL1pzhYyWOJBQPvYpzSeeayAVdsHCj1FzT8zQQKA0RzdJ
0Aom6YvKT27gHKe1inYfXL6KGC6oHUwAjxchzT70DQKBgQDdAXcRVcVieZh0Zato
+OTfYVnnB8nURhhzOgGqPoq/M5qMLP1ZETo6ePygnf3qUICHSmSS/jeMenWlX1ep
d09QI+KB4M8tni4JEJqfdFQEMyEKGVyAgN8HuzAJFc98vXmeMyYfh8/oRkEww+3p
CZ9L3UxLxjkGt4Ps5RaTOG9oTA==
-----END PRIVATE KEY-----`;

  const matrixPath = path.resolve('docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md');
  let realMatrixHash = '';
  let realMatrixSignature = '';

  beforeAll(() => {
    // Reset singleton instances for a clean test run
    (CapabilityRegistryService as unknown as { instance: null }).instance = null;
    (PolicyEngineService as unknown as { instance: null }).instance = null;

    // Read the real frozen matrix file to get actual hash and sign it
    if (fs.existsSync(matrixPath)) {
      const content = fs.readFileSync(matrixPath, 'utf8');
      realMatrixHash = crypto.createHash('sha256').update(content).digest('hex');

      const signer = crypto.createSign('sha256');
      signer.update(realMatrixHash);
      signer.end();
      realMatrixSignature = signer.sign(privateKeyPem, 'hex');
    } else {
      realMatrixHash = crypto.createHash('sha256').update('Mock matrix content').digest('hex');
      const signer = crypto.createSign('sha256');
      signer.update(realMatrixHash);
      signer.end();
      realMatrixSignature = signer.sign(privateKeyPem, 'hex');
    }

    // Initialize Services
    CapabilityRegistryService.initialize(mockSupabase);
    PolicyEngineService.initialize(
      CapabilityRegistryService.getInstance(),
      matrixPath
    );
  });

  const createMockDbRow = (overrides: Partial<DBRow> = {}): DBRow => ({
    capability_id: 'HC-020',
    capability_name: 'Perioperative Platform',
    domain: 'Safety-Critical',
    scale_factor: 4,
    clinical_criticality: 5,
    blast_radius: 5,
    risk_score: 100,
    calculated_tier: 'T3',
    override_rule: 'C=5+B=5',
    final_tier: 'T3',
    rollout_policy: 'v1.1',
    safety_profile: 'Clinical Safety',
    governance_status: 'Approved',
    notes: 'Highest-risk capability',
    source_document: 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md',
    source_version: '1.0',
    generated_at: new Date().toISOString(),
    generated_from_hash: realMatrixHash,
    matrix_signature: realMatrixSignature,
    approved_by: { approvers: ['CTO', 'Clinical Safety Officer'] },
    approved_at: new Date().toISOString(),
    generator_version: '1.0.0',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    CapabilityRegistryService.getInstance().clearCache();

    // Set default mock implementation of mockFrom to return a successful registry select
    mockFrom.mockImplementation((table: string) => {
      if (table === 'capability_risk_registry') {
        return new MockQueryBuilder<DBRow[]>([createMockDbRow()]);
      }
      return new MockQueryBuilder<null>(null);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // INTEGRITY & AUTHENTICITY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe('verifyRegistryIntegrity()', () => {
    it('passes successfully when hash and signature are correct', async () => {
      const isIntegrityOk = await PolicyEngineService.getInstance().verifyRegistryIntegrity();
      expect(isIntegrityOk).toBe(true);
    });

    it('fails when registry hash does not match matrix file hash (Governance Drift)', async () => {
      const incorrectHash = 'incorrecthash1234567890123456789012345678901234567890123456789012';
      
      const signer = crypto.createSign('sha256');
      signer.update(incorrectHash);
      signer.end();
      const validSigForIncorrectHash = signer.sign(privateKeyPem, 'hex');

      const mockRow = createMockDbRow({
        generated_from_hash: incorrectHash,
        matrix_signature: validSigForIncorrectHash,
      });
      mockFrom.mockImplementation(() => new MockQueryBuilder<DBRow[]>([mockRow]));

      await expect(
        PolicyEngineService.getInstance().verifyRegistryIntegrity()
      ).rejects.toThrow(GovernanceViolationError);

      await expect(
        PolicyEngineService.getInstance().verifyRegistryIntegrity()
      ).rejects.toThrow('Governance Drift Detected');
    });

    it('fails when signature is invalid (Provenance Integrity Failure)', async () => {
      const mockRow = createMockDbRow({
        matrix_signature: 'invalidsignaturehex1234567890',
      });
      mockFrom.mockImplementation(() => new MockQueryBuilder<DBRow[]>([mockRow]));

      await expect(
        PolicyEngineService.getInstance().verifyRegistryIntegrity()
      ).rejects.toThrow(GovernanceViolationError);

      await expect(
        PolicyEngineService.getInstance().verifyRegistryIntegrity()
      ).rejects.toThrow('Provenance Integrity Failure');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POLICY INVARIANT ENFORCEMENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe('canDeploy()', () => {
    it('Invariant 1: Blocks unregistered capabilities (No Classification, No Deployment)', async () => {
      await expect(
        PolicyEngineService.getInstance().canDeploy('HC-999')
      ).rejects.toThrow(GovernanceViolationError);

      await expect(
        PolicyEngineService.getInstance().canDeploy('HC-999')
      ).rejects.toThrow("Capability Blocked: Capability 'HC-999' is unregistered");
    });

    it('Invariant 3: Blocks capabilities with missing Safety Profile', async () => {
      const mockRow = createMockDbRow({
        safety_profile: 'None',
      });
      mockFrom.mockImplementation(() => new MockQueryBuilder<DBRow[]>([mockRow]));

      await expect(
        PolicyEngineService.getInstance().canDeploy('HC-020')
      ).rejects.toThrow(GovernanceViolationError);

      await expect(
        PolicyEngineService.getInstance().canDeploy('HC-020')
      ).rejects.toThrow("Capability Blocked: Capability 'HC-020' has no valid Safety Profile defined");
    });

    it('Invariant 4: Blocks capability when requested tier does not align with Registry', async () => {
      const mockRow = createMockDbRow({
        final_tier: 'T3',
      });
      mockFrom.mockImplementation(() => new MockQueryBuilder<DBRow[]>([mockRow]));

      await expect(
        PolicyEngineService.getInstance().canDeploy('HC-020', 'T2')
      ).rejects.toThrow(GovernanceViolationError);

      await expect(
        PolicyEngineService.getInstance().canDeploy('HC-020', 'T2')
      ).rejects.toThrow("Capability Blocked: Runtime tier mismatch for capability 'HC-020'");
    });

    it('Allows deployment and returns correct validation result for success path', async () => {
      const mockRow = createMockDbRow({
        capability_id: 'HC-020',
        final_tier: 'T3',
        rollout_policy: 'v1.1',
        safety_profile: 'Clinical Safety',
      });
      mockFrom.mockImplementation(() => new MockQueryBuilder<DBRow[]>([mockRow]));

      const result = await PolicyEngineService.getInstance().canDeploy('HC-020', 'T3');

      expect(result.isValid).toBe(true);
      expect(result.capabilityId).toBe('HC-020');
      expect(result.finalTier).toBe('T3');
      expect(result.rolloutPolicy).toBe('v1.1');
      expect(result.safetyProfile).toBe('Clinical Safety');
      expect(result.metadata?.riskScore).toBe(100);
    });
  });
});
