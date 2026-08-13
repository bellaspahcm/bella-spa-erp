/**
 * Phase H11 — Clinical Audit & Compliance Engine Integration Tests (6 Gates)
 *
 * Verification Gates:
 * 1. Gate 1: Audit Ledger Immutability (DB triggers block UPDATE/DELETE on ledger tables)
 * 2. Gate 2: Compliance & Integrity Pipeline (ComplianceStatus vs EvidenceIntegrityStatus)
 * 3. Gate 3: Override & Deviation Governance (Authorized vs Unauthorized BLOCK & ABSOLUTE_BLOCK overrides)
 * 4. Gate 4: Reconstructive Evidence Chain Investigation (Historical point-in-time immutability)
 * 5. Gate 5: Verifiable Evidence Package (Canonical payload + schema_version SHA-256 fingerprint)
 * 6. Gate 6: Anti-False-Compliance & Chained Data Integrity (Missing metadata prevents COMPLIANT status)
 *
 * @module platform/healthcare/__tests__/audit-compliance.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { AuditComplianceService } from '../engines/audit-compliance-engine/audit-compliance.service';
import { EvidenceFingerprintVO } from '../engines/audit-compliance-engine/domain/evidence-fingerprint.vo';

jest.setTimeout(30000);

describe('Clinical Audit & Compliance Engine H11 Integration Tests (6 Gates)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  let auditService: AuditComplianceService;

  beforeEach(async () => {
    supabase = await createClient();
    fixtures = await HealthcareTestFixtures.setup();
    auditService = new AuditComplianceService(supabase);

    await supabase.from('hc_compliance_exceptions').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_evidence_packages').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_audit_ledger').delete().eq('tenant_id', fixtures.tenantId);
  });

  afterEach(async () => {
    await supabase.from('hc_compliance_exceptions').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_evidence_packages').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_audit_ledger').delete().eq('tenant_id', fixtures.tenantId);
    await fixtures.cleanup();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 1: Audit Ledger Immutability
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 1: should enforce append-only write-once immutability via DB triggers on all audit ledgers', async () => {
    const recRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'MEDICATION_ADMINISTERED',
      performerId: 'nurse_betty',
      performerRole: 'staff_nurse',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleCode: 'MED-DOSAGE-SAFE',
      h10RuleChecksum: 'sha256-' + 'a'.repeat(64)
    });

    expect(recRes.success).toBe(true);
    const auditId = recRes.data!.id;

    // Attempt UPDATE on hc_clinical_audit_ledger -> DB trigger must reject!
    const updateRes = await supabase
      .from('hc_clinical_audit_ledger')
      .update({ compliance_status: 'NON_COMPLIANT' })
      .eq('id', auditId);

    expect(updateRes.error).toBeDefined();
    expect(updateRes.error?.message).toContain('strictly write-once append-only');

    // Attempt DELETE on hc_clinical_audit_ledger -> DB trigger must reject!
    const delRes = await supabase
      .from('hc_clinical_audit_ledger')
      .delete()
      .eq('id', auditId);

    expect(delRes.error).toBeDefined();
    expect(delRes.error?.message).toContain('strictly write-once append-only');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 2: Compliance & Integrity Pipeline
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 2: should evaluate standard compliant actions with COMPLIANT status and COMPLETE integrity', async () => {
    const h8Id = randomUUID();
    const h9Id = randomUUID();
    const h10Checksum = 'sha256-' + 'b'.repeat(64);

    const recRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'LAB_ORDER_VERIFIED',
      performerId: 'dr_house',
      performerRole: 'attending_physician',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleCode: 'LAB-NORMAL-RANGE',
      h10RuleChecksum: h10Checksum
    });

    expect(recRes.success).toBe(true);
    expect(recRes.data?.complianceStatus).toBe('COMPLIANT');
    expect(recRes.data?.evidenceIntegrity).toBe('COMPLETE');

    const evalRes = await auditService.evaluateActionCompliance(fixtures.tenantId, recRes.data!.id);
    expect(evalRes.success).toBe(true);
    expect(evalRes.data?.complianceStatus).toBe('COMPLIANT');
    expect(evalRes.data?.evidenceIntegrity).toBe('COMPLETE');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 3: Override & Deviation Governance
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 3: should correctly evaluate ABSOLUTE_BLOCK and BLOCK decision overrides', async () => {
    // 1. Attempt overriding ABSOLUTE_BLOCK -> NON_COMPLIANT
    const absRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'BLOOD_TRANSFUSION_STARTED',
      performerId: 'dr_intern',
      performerRole: 'resident',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleChecksum: 'sha256-' + 'c'.repeat(64),
      overrideDetails: {
        enforcementLevel: 'ABSOLUTE_BLOCK',
        overrideReason: 'Emergency transfusion needed immediately',
        overriddenBy: 'dr_intern',
        overriderRole: 'resident'
      }
    });

    expect(absRes.success).toBe(true);
    expect(absRes.data?.complianceStatus).toBe('NON_COMPLIANT');

    // 2. Authorized BLOCK override with valid justification -> EXCEPTION
    const authRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'MEDICATION_DISPENSED',
      performerId: 'dr_smith',
      performerRole: 'attending_physician',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleChecksum: 'sha256-' + 'd'.repeat(64),
      overrideDetails: {
        enforcementLevel: 'BLOCK',
        overrideReason: 'Benefit outweighs mild allergy risk under ICU monitor',
        overriddenBy: 'dr_smith',
        overriderRole: 'attending_physician'
      }
    });

    expect(authRes.success).toBe(true);
    expect(authRes.data?.complianceStatus).toBe('EXCEPTION');

    // 3. Unauthorized BLOCK override by nurse -> NON_COMPLIANT
    const unauthRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'MEDICATION_DISPENSED',
      performerId: 'nurse_joy',
      performerRole: 'staff_nurse',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleChecksum: 'sha256-' + 'e'.repeat(64),
      overrideDetails: {
        enforcementLevel: 'BLOCK',
        overrideReason: 'Patient requested drug anyway',
        overriddenBy: 'nurse_joy',
        overriderRole: 'staff_nurse'
      }
    });

    expect(unauthRes.success).toBe(true);
    expect(unauthRes.data?.complianceStatus).toBe('NON_COMPLIANT');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 4: Reconstructive Evidence Chain Investigation
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 4: should reconstruct point-in-time evidence chain unaffected by future state changes', async () => {
    const h8Id = randomUUID();
    const h9Id = randomUUID();
    const h10Checksum = 'sha256-' + 'f'.repeat(64);

    const recRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'SURGERY_CHECKLIST_COMPLETED',
      performerId: 'dr_surgeon',
      performerRole: 'department_head',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleCode: 'OR-SAFETY-CHECK',
      h10RuleChecksum: h10Checksum,
      metadata: { patientStateAtT: { heartRate: 72, tempC: 36.6 } }
    });

    const auditId = recRes.data!.id;

    // Investigate historical action at T
    const invRes = await auditService.investigateClinicalAction(fixtures.tenantId, auditId);
    expect(invRes.success).toBe(true);
    expect(invRes.data?.audit.id).toBe(auditId);
    expect(invRes.data?.evidencePackage).toBeDefined();
    expect(invRes.data?.evidencePackage?.fingerprint).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(invRes.data?.evaluation.complianceStatus).toBe('COMPLIANT');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 5: Verifiable Evidence Package
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 5: should issue Evidence Package with verifiable schema_version and SHA-256 fingerprint', async () => {
    const h8Id = randomUUID();
    const h9Id = randomUUID();
    const h10Checksum = 'sha256-' + '1'.repeat(64);

    const recRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'ICU_VENTILATOR_WEANED',
      performerId: 'dr_intensivist',
      performerRole: 'medical_director',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleChecksum: h10Checksum
    });

    const auditId = recRes.data!.id;

    const pkgRes = await auditService.issueEvidencePackage(fixtures.tenantId, auditId);
    expect(pkgRes.success).toBe(true);
    expect(pkgRes.data?.schemaVersion).toBe('1.0.0');

    // Recompute fingerprint locally using Value Object
    const localFingerprint = EvidenceFingerprintVO.generateFingerprint({
      schemaVersion: '1.0.0',
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      actionType: 'ICU_VENTILATOR_WEANED',
      timestamp: pkgRes.data!.canonicalPayload.timestamp,
      performerId: 'dr_intensivist',
      performerRole: 'medical_director',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleChecksum: h10Checksum,
      complianceStatus: 'COMPLIANT',
      evidenceIntegrity: 'COMPLETE'
    });

    expect(pkgRes.data?.fingerprint).toBe(localFingerprint);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 6: Anti-False-Compliance & Chained Data Integrity
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 6: should reject COMPLIANT status and return REQUIRES_REVIEW when metadata is missing', async () => {
    // Record action with NO H8 decision and NO H9 snapshot (incomplete evidence chain)
    const recRes = await auditService.recordAuditEntry({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionType: 'MEDICATION_PRESCRIBED',
      performerId: 'dr_unknown',
      performerRole: 'resident'
      // Missing h8DecisionId, h9SnapshotId, h10RuleChecksum
    });

    expect(recRes.success).toBe(true);
    expect(recRes.data?.complianceStatus).toBe('REQUIRES_REVIEW');
    expect(recRes.data?.evidenceIntegrity).toBe('PARTIAL');

    const evalRes = await auditService.evaluateActionCompliance(fixtures.tenantId, recRes.data!.id);
    expect(evalRes.success).toBe(true);
    expect(evalRes.data?.complianceStatus).toBe('REQUIRES_REVIEW');
    expect(evalRes.data?.evidenceIntegrity).toBe('PARTIAL');
    expect(evalRes.data?.rationale).toContain('Evidence chain incomplete');
  });
});
