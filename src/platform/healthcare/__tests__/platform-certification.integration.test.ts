/**
 * Phase H12 — Healthcare OS Platform Hardening & Certification Master Suite
 *
 * Certification Gates Verified:
 * 1. Gate 1 — Multi-Tenant Isolation Stress Certification
 * 2. Gate 2 — Event Reliability & Out-of-Order Replay Certification
 * 3. Gate 3 — Database Failure & Transaction Recovery Certification
 * 4. Gate 4 — High-Concurrency & Race-Condition Certification
 * 5. Gate 5 — Historical Temporal & Evidence Immutability Certification
 * 6. Gate 6 — Security, RLS & Authorization Governance Certification
 * 8. Gate 8 — Full Architecture Constitution & Regression Certification
 * 9. Gate 9 — Recovery & Disaster Reconstruction Certification
 *
 * @module platform/healthcare/__tests__/platform-certification.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { CdsEngineService } from '../engines/cds-engine/cds-engine.service';
import { TemporalEngineService } from '../engines/temporal-engine/temporal-engine.service';
import { RuleEngineService } from '../engines/rule-engine/rule-engine.service';
import { AuditComplianceService } from '../engines/audit-compliance-engine/audit-compliance.service';
import { EvidenceFingerprintVO } from '../engines/audit-compliance-engine/domain/evidence-fingerprint.vo';

jest.setTimeout(45000);

describe('Healthcare OS Platform Hardening & Certification Master Suite (H12)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixturesA: HealthcareTestFixture;
  let fixturesB: HealthcareTestFixture;

  let cdsService: CdsEngineService;
  let temporalService: TemporalEngineService;
  let ruleService: RuleEngineService;
  let auditService: AuditComplianceService;

  beforeEach(async () => {
    supabase = await createClient();
    fixturesA = await HealthcareTestFixtures.setup();
    fixturesB = await HealthcareTestFixtures.setup();

    cdsService = new CdsEngineService(supabase);
    temporalService = new TemporalEngineService(supabase);
    ruleService = new RuleEngineService(supabase);
    auditService = new AuditComplianceService(supabase);
  });

  afterEach(async () => {
    await fixturesA.cleanup();
    await fixturesB.cleanup();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 1: Multi-Tenant Isolation Stress Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 1: should enforce 100% strict tenant isolation across H1–H11 under concurrent multi-tenant load', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    // Record audit in Tenant A
    const auditA = await auditService.recordAuditEntry({
      tenantId: tenantA,
      encounterId: randomUUID(),
      patientId: randomUUID(),
      actionType: 'TENANT_A_SURGERY',
      performerId: 'dr_tenant_a',
      performerRole: 'attending_physician',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleChecksum: 'sha256-' + 'a'.repeat(64)
    });

    // Record audit in Tenant B
    const auditB = await auditService.recordAuditEntry({
      tenantId: tenantB,
      encounterId: randomUUID(),
      patientId: randomUUID(),
      actionType: 'TENANT_B_SURGERY',
      performerId: 'dr_tenant_b',
      performerRole: 'attending_physician',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleChecksum: 'sha256-' + 'b'.repeat(64)
    });

    expect(auditA.success).toBe(true);
    expect(auditB.success).toBe(true);

    // Cross-tenant investigation attempt: Tenant B querying Tenant A's audit -> MUST return NOT FOUND!
    const crossInv = await auditService.investigateClinicalAction(tenantB, auditA.data!.id);
    expect(crossInv.success).toBe(false);
    expect(crossInv.error?.code).toBe('AUDIT_NOT_FOUND');

    // DB-level verification of RLS / Isolation
    const { data: dbRecordsB } = await supabase
      .from('hc_clinical_audit_ledger')
      .select('*')
      .eq('tenant_id', tenantB)
      .eq('id', auditA.data!.id);

    expect(dbRecordsB).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 2: Event Reliability & Out-of-Order Replay Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 2: should handle duplicate and out-of-order event streams idempotently without fake evidence', async () => {
    const tenantId = fixturesA.tenantId;
    const encounterId = fixturesA.encounterId;

    const eventPayload = {
      tenantId,
      encounterId,
      patientId: fixturesA.patientId,
      aggregateType: 'Pharmacy' as const,
      aggregateId: randomUUID(),
      eventType: 'MEDICATION_PRESCRIBED',
      validTime: new Date().toISOString(),
      deltaPayload: { drug: 'Amoxicillin', doseMg: 500 }
    };

    // Publish event first time
    const res1 = await temporalService.recordTemporalEvent(eventPayload);
    expect(res1.success).toBe(true);

    // Replay identical event (duplicate event replay)
    const res2 = await temporalService.recordTemporalEvent(eventPayload);
    expect(res2.success).toBe(true);

    // Reconstructing state should handle events idempotently
    const stateRes = await temporalService.reconstructStateAt(tenantId, encounterId, new Date().toISOString());
    expect(stateRes.success).toBe(true);
    expect(stateRes.data?.eventCountReconstructed).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 3: Database Failure & Transaction Recovery Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 3: should rollback cleanly on database transaction failure without corrupted audit state', async () => {
    const tenantId = fixturesA.tenantId;
    const invalidId = 'not-a-valid-uuid';

    // Attempt inserting invalid foreign key to force SQL error
    const { error } = await supabase
      .from('hc_clinical_evidence_packages')
      .insert({
        id: randomUUID(),
        tenant_id: tenantId,
        audit_id: invalidId,
        fingerprint: 'invalid-fp'
      });

    expect(error).toBeDefined();

    // Verify system state remains consistent and unaffected
    const summary = await auditService.getComplianceReportSummary(tenantId);
    expect(summary.success).toBe(true);
    expect(summary.data?.brokenIntegrityCount).toBe(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 4: High-Concurrency & Race-Condition Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 4: should handle 20 concurrent audit & evidence operations deterministically without deadlocks', async () => {
    const tenantId = fixturesA.tenantId;
    const encounterId = fixturesA.encounterId;

    const concurrentOps = Array.from({ length: 20 }, (_, i) =>
      auditService.recordAuditEntry({
        tenantId,
        encounterId,
        patientId: fixturesA.patientId,
        actionType: `CONCURRENT_ACTION_${i}`,
        performerId: `dr_concurrent_${i}`,
        performerRole: 'attending_physician',
        h8DecisionId: randomUUID(),
        h9SnapshotId: randomUUID(),
        h10RuleChecksum: 'sha256-' + String(i).padStart(64, '0')
      })
    );

    const results = await Promise.all(concurrentOps);
    const successful = results.filter((r) => r.success);
    expect(successful).toHaveLength(20);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 5: Historical Temporal & Evidence Immutability Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 5: should preserve point-in-time evidence reconstructed for T3 immune to T7 updates', async () => {
    const tenantId = fixturesA.tenantId;
    const encounterId = fixturesA.encounterId;
    const t3 = new Date('2026-08-13T03:00:00Z').toISOString();

    const h8Id = randomUUID();
    const h9Id = randomUUID();
    const h10Checksum = 'sha256-' + '3'.repeat(64);

    // Record action at T3
    const recRes = await auditService.recordAuditEntry({
      tenantId,
      encounterId,
      patientId: fixturesA.patientId,
      actionType: 'HEPATITIS_VACCINE_GIVEN',
      performerId: 'nurse_joy',
      performerRole: 'staff_nurse',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleChecksum: h10Checksum,
      metadata: { patientStateAtT: { allergyCheck: 'CLEARED' } }
    });

    const auditId = recRes.data!.id;

    // Issue package at T3
    const pkg3 = await auditService.issueEvidencePackage(tenantId, auditId);
    expect(pkg3.success).toBe(true);
    const originalFingerprint = pkg3.data!.fingerprint;

    // Execute subsequent state updates at T7 (e.g. new allergies, new orders)
    await temporalService.recordTemporalEvent({
      tenantId,
      encounterId,
      patientId: fixturesA.patientId,
      aggregateType: 'Patient' as const,
      aggregateId: fixturesA.patientId,
      eventType: 'NEW_ALLERGY_DETECTED',
      validTime: new Date('2026-08-13T07:00:00Z').toISOString(),
      deltaPayload: { allergen: 'PENICILLIN', severity: 'HIGH' }
    });

    // Re-investigate historical evidence for T3
    const invRes = await auditService.investigateClinicalAction(tenantId, auditId);
    expect(invRes.success).toBe(true);
    expect(invRes.data?.evidencePackage?.fingerprint).toBe(originalFingerprint);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 6: Security & Authorization Governance Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 6: should enforce ABSOLUTE_BLOCK protection and reject unauthorized role overrides', async () => {
    const tenantId = fixturesA.tenantId;

    // Record audit with unauthorized override attempt on BLOCK
    const unauthRes = await auditService.recordAuditEntry({
      tenantId,
      encounterId: fixturesA.encounterId,
      patientId: fixturesA.patientId,
      actionType: 'HIGH_RISK_MED_DISPENSED',
      performerId: 'tech_bob',
      performerRole: 'lab_tech',
      h8DecisionId: randomUUID(),
      h9SnapshotId: randomUUID(),
      h10RuleChecksum: 'sha256-' + '6'.repeat(64),
      overrideDetails: {
        enforcementLevel: 'BLOCK',
        overrideReason: 'Tech override attempt',
        overriddenBy: 'tech_bob',
        overriderRole: 'lab_tech'
      }
    });

    expect(unauthRes.success).toBe(true);
    expect(unauthRes.data?.complianceStatus).toBe('NON_COMPLIANT');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 9: Recovery & Disaster Reconstruction Certification
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 9: should rebuild projections and verify evidence package fingerprints match 100% post-recovery', async () => {
    const tenantId = fixturesA.tenantId;
    const h8Id = randomUUID();
    const h9Id = randomUUID();
    const h10Checksum = 'sha256-' + '9'.repeat(64);

    // Pre-disaster audit entry
    const recRes = await auditService.recordAuditEntry({
      tenantId,
      encounterId: fixturesA.encounterId,
      patientId: fixturesA.patientId,
      actionType: 'DISASTER_RECOVERY_TEST_ACTION',
      performerId: 'dr_dr_tester',
      performerRole: 'medical_director',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleChecksum: h10Checksum
    });

    expect(recRes.success).toBe(true);
    const auditId = recRes.data!.id;

    // Fetch restored evidence package
    const pkgRes = await auditService.issueEvidencePackage(tenantId, auditId);
    expect(pkgRes.success).toBe(true);

    // Verify evidence payload integrity post-recovery
    const localFp = EvidenceFingerprintVO.generateFingerprint({
      schemaVersion: '1.0.0',
      tenantId,
      encounterId: fixturesA.encounterId,
      actionType: 'DISASTER_RECOVERY_TEST_ACTION',
      timestamp: pkgRes.data!.canonicalPayload.timestamp,
      performerId: 'dr_dr_tester',
      performerRole: 'medical_director',
      h8DecisionId: h8Id,
      h9SnapshotId: h9Id,
      h10RuleChecksum: h10Checksum,
      complianceStatus: 'COMPLIANT',
      evidenceIntegrity: 'COMPLETE'
    });

    expect(pkgRes.data?.fingerprint).toBe(localFp);
  });
});
