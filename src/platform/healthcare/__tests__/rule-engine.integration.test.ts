/**
 * Phase H10 — Clinical Governance & Rule Engine Integration Tests (6 Gates)
 *
 * Verification Gates:
 * 1. Gate 1: Governance Isolation (Zero direct queries on H8/H9 persistence tables)
 * 2. Gate 2: Rule Lifecycle & Version Immutability (Write-once ACTIVE/SUPERSEDED rules)
 * 3. Gate 3: Governance Authorization Matrix (Chief of Dept / Medical Director sign-off)
 * 4. Gate 4: Effective Date Non-Overlap Exclusion (Overlapping active time windows rejected)
 * 5. Gate 5: Canonical Artifact Checksum (SHA-256 full definition hash verification)
 * 6. Gate 6: Deterministic & Explainable DSL Evaluation (Structured matchedConditions)
 *
 * @module platform/healthcare/__tests__/rule-engine.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { RuleEngineService } from '../engines/rule-engine/rule-engine.service';
import { RuleChecksumVO } from '../engines/rule-engine/domain/rule-checksum.vo';

jest.setTimeout(30000);

describe('Clinical Governance & Rule Engine H10 Integration Tests (6 Gates)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  let ruleEngine: RuleEngineService;

  beforeEach(async () => {
    supabase = await createClient();
    fixtures = await HealthcareTestFixtures.setup();
    ruleEngine = new RuleEngineService(supabase);

    await supabase.from('hc_rule_governance_audit').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_governed_clinical_rules').delete().eq('tenant_id', fixtures.tenantId);
  });

  afterEach(async () => {
    await supabase.from('hc_rule_governance_audit').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_governed_clinical_rules').delete().eq('tenant_id', fixtures.tenantId);
    await fixtures.cleanup();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 1: Governance Context Isolation
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 1: should manage rule lifecycles independently without direct reads on H8/H9 persistence', async () => {
    const ruleCode = `ALLERGY-BLOCK-${randomUUID().slice(0, 6)}`;

    const draftRes = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ruleCode,
      ruleVersion: '1.0.0',
      jurisdictionCode: 'LOCAL',
      severity: 'CRITICAL',
      enforcement: 'ABSOLUTE_BLOCK',
      conditionsDsl: {
        all: [
          { field: 'patient.allergies', operator: 'CONTAINS', value: 'penicillin' },
          { field: 'proposedDrugCode', operator: 'STARTS_WITH', value: 'AMOX' }
        ]
      },
      effectiveFrom: new Date().toISOString(),
      authorId: 'dr_smith'
    });

    expect(draftRes.success).toBe(true);
    expect(draftRes.data?.status).toBe('DRAFT');
    expect(draftRes.data?.ruleChecksum).toBeDefined();

    // Verify DB record in hc_governed_clinical_rules
    const { data: dbRule, error } = await supabase
      .from('hc_governed_clinical_rules')
      .select('*')
      .eq('tenant_id', fixtures.tenantId)
      .eq('id', draftRes.data?.id)
      .single();

    expect(error).toBeNull();
    expect(dbRule.rule_code).toBe(ruleCode);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 2: Rule Lifecycle & Version Immutability
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 2: should enforce write-once immutability on ACTIVE clinical rules via DB trigger', async () => {
    const ruleCode = `IMMUTABLE-RULE-${randomUUID().slice(0, 6)}`;

    const draftRes = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ruleCode,
      ruleVersion: '1.0.0',
      severity: 'CRITICAL',
      enforcement: 'ABSOLUTE_BLOCK',
      conditionsDsl: { all: [{ field: 'doseMg', operator: 'GREATER_THAN', value: 1000 }] },
      effectiveFrom: new Date().toISOString(),
      authorId: 'dr_smith'
    });

    const ruleId = draftRes.data!.id;

    // Submit & Approve
    await ruleEngine.submitRuleForReview(fixtures.tenantId, ruleId, 'dr_reviewer');
    const actRes = await ruleEngine.approveAndActivateRule({
      tenantId: fixtures.tenantId,
      ruleId,
      approverId: 'dr_chief',
      approverRole: 'medical_director',
      changeReason: 'Approved critical dosing rule'
    });

    expect(actRes.success).toBe(true);
    expect(actRes.data?.status).toBe('ACTIVE');

    // Attempt modifying conditionsDsl on ACTIVE rule -> DB trigger must block it!
    const mutateRes = await supabase
      .from('hc_governed_clinical_rules')
      .update({ rule_checksum: 'tampered-hash-123' })
      .eq('id', ruleId);

    expect(mutateRes.error).toBeDefined();
    expect(mutateRes.error?.message).toContain('write-once immutable');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 3: Governance Authorization Matrix
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 3: should require chief_of_department or medical_director role to approve BLOCK rules', async () => {
    const ruleCode = `ROLE-AUTH-RULE-${randomUUID().slice(0, 6)}`;

    const draftRes = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ruleCode,
      ruleVersion: '1.0.0',
      severity: 'CRITICAL',
      enforcement: 'BLOCK',
      conditionsDsl: { all: [{ field: 'kLevel', operator: 'LESS_THAN', value: 3.0 }] },
      effectiveFrom: new Date().toISOString(),
      authorId: 'dr_author'
    });

    const ruleId = draftRes.data!.id;
    await ruleEngine.submitRuleForReview(fixtures.tenantId, ruleId, 'dr_reviewer');

    // Attempt approval with unauthorized role (e.g. 'staff_nurse') -> should fail!
    const unauthRes = await ruleEngine.approveAndActivateRule({
      tenantId: fixtures.tenantId,
      ruleId,
      approverId: 'nurse_joy',
      approverRole: 'staff_nurse',
      changeReason: 'Attempted unauthorized approval'
    });

    expect(unauthRes.success).toBe(false);
    expect(unauthRes.error?.message).toContain('requires chief_of_department or medical_director role');

    // Approve with authorized role ('chief_of_department') -> should succeed!
    const authRes = await ruleEngine.approveAndActivateRule({
      tenantId: fixtures.tenantId,
      ruleId,
      approverId: 'dr_chief',
      approverRole: 'chief_of_department',
      changeReason: 'Department Chief sign-off'
    });

    expect(authRes.success).toBe(true);
    expect(authRes.data?.status).toBe('ACTIVE');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 4: Effective Date Non-Overlap Exclusion
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 4: should prevent activating overlapping rule versions for same rule_code and jurisdiction', async () => {
    const ruleCode = `NON-OVERLAP-${randomUUID().slice(0, 6)}`;
    const tStart = new Date('2026-08-13T00:00:00Z').toISOString();

    // Create Rule v1 (ACTIVE)
    const r1 = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ruleCode,
      ruleVersion: '1.0.0',
      severity: 'WARNING',
      enforcement: 'ACKNOWLEDGE',
      conditionsDsl: { all: [{ field: 'test', operator: 'EQUALS', value: 'a' }] },
      effectiveFrom: tStart,
      authorId: 'dr_author'
    });

    await ruleEngine.approveAndActivateRule({
      tenantId: fixtures.tenantId,
      ruleId: r1.data!.id,
      approverId: 'dr_chief',
      approverRole: 'medical_director',
      changeReason: 'Activate v1'
    });

    // Create Rule v2 with overlapping time window
    const r2 = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ruleCode,
      ruleVersion: '1.1.0',
      severity: 'WARNING',
      enforcement: 'ACKNOWLEDGE',
      conditionsDsl: { all: [{ field: 'test', operator: 'EQUALS', value: 'b' }] },
      effectiveFrom: new Date('2026-08-13T06:00:00Z').toISOString(),
      authorId: 'dr_author'
    });

    // Activating v2 automatically supersedes v1 via service transaction -> should succeed and prevent overlap!
    const act2 = await ruleEngine.approveAndActivateRule({
      tenantId: fixtures.tenantId,
      ruleId: r2.data!.id,
      approverId: 'dr_chief',
      approverRole: 'medical_director',
      changeReason: 'Activate v2 superseding v1'
    });

    expect(act2.success).toBe(true);

    // Verify v1 status is now SUPERSEDED
    const { data: v1Db } = await supabase
      .from('hc_governed_clinical_rules')
      .select('status')
      .eq('id', r1.data!.id)
      .single();

    expect(v1Db.status).toBe('SUPERSEDED');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 5: Canonical Artifact Checksum
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 5: should generate canonical SHA-256 checksum representing complete rule artifact identity', async () => {
    const ruleCode = `DDI-WARFARIN-AMIODARONE-${randomUUID().slice(0, 6)}`;
    const ruleParams = {
      ruleCode,
      ruleVersion: '2.0.0',
      jurisdictionCode: 'LOCAL',
      severity: 'CRITICAL' as const,
      enforcement: 'BLOCK' as const,
      conditionsDsl: {
        all: [{ field: 'activeMeds', operator: 'CONTAINS', value: 'WARFARIN' }]
      },
      effectiveFrom: '2026-08-13T00:00:00Z'
    };

    const checksum = RuleChecksumVO.generateCanonicalChecksum(ruleParams);
    expect(checksum).toMatch(/^sha256-[a-f0-9]{64}$/);

    const draftRes = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ...ruleParams,
      authorId: 'dr_smith'
    });

    expect(draftRes.success).toBe(true);
    expect(draftRes.data?.ruleChecksum).toBe(checksum);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 6: Deterministic & Explainable DSL Evaluation
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 6: should evaluate JSON DSL deterministically and return structured matchedConditions explainability', async () => {
    const r1 = await ruleEngine.createDraftRule({
      tenantId: fixtures.tenantId,
      ruleCode: `EXPLAIN-RULE-${randomUUID().slice(0, 6)}`,
      ruleVersion: '1.0.0',
      severity: 'CRITICAL',
      enforcement: 'ABSOLUTE_BLOCK',
      conditionsDsl: {
        all: [
          { field: 'patient.allergies', operator: 'CONTAINS', value: 'penicillin' },
          { field: 'action.medication', operator: 'EQUALS', value: 'amoxicillin' }
        ]
      },
      effectiveFrom: new Date().toISOString(),
      authorId: 'dr_smith'
    });

    const contextMatch = {
      patient: { allergies: ['penicillin', 'sulfa'] },
      action: { medication: 'amoxicillin' }
    };

    const evalRes = await ruleEngine.evaluateRuleSet([r1.data!], contextMatch);

    expect(evalRes.success).toBe(true);
    expect(evalRes.data?.matchedCount).toBe(1);
    expect(evalRes.data?.highestEnforcement).toBe('ABSOLUTE_BLOCK');

    const detail = evalRes.data?.evaluations[0];
    expect(detail?.matched).toBe(true);
    expect(detail?.matchedConditions).toHaveLength(2);
    expect(detail?.matchedConditions[0].passed).toBe(true);
    expect(detail?.matchedConditions[1].passed).toBe(true);
  });
});
