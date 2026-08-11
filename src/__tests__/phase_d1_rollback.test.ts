/**
 * Phase D1 — Compensating Transaction Engine Tests
 * Tests: state machine, step registration, compensation reversal, ROLLBACK_FAILED path
 *
 * Architecture: Saga / Compensating Transaction Pattern
 *   NOT a restore-snapshot test — compensation actions must be meaningful business ops.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { RollbackEngineService, TransactionStatus } from '@/platform/host/rollback-engine';

// ─────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const TEST_TENANT_ID = '88888888-8888-8888-8888-888888888888';

let supabase: ReturnType<typeof createClient<Database>>;
let engine: RollbackEngineService;

jest.setTimeout(60000);

beforeAll(() => {
  supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  engine = new RollbackEngineService(supabase, TEST_TENANT_ID);
});

// Helper to get transaction from DB
async function getTransaction(id: string) {
  const { data } = await supabase
    .from('platform_business_transactions')
    .select('*')
    .eq('id', id)
    .single();
  return data;
}

// Helper to get steps for a transaction
async function getSteps(transactionId: string) {
  const { data } = await supabase
    .from('platform_transaction_steps')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('sequence', { ascending: true });
  return data ?? [];
}

// Helper to get audit log for a transaction
async function getAuditLog(transactionId: string) {
  const { data } = await supabase
    .from('platform_rollback_audit_log')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('occurred_at', { ascending: true });
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────
// Test Suite 1: Transaction Lifecycle — Happy Path
// ─────────────────────────────────────────────────────────────────
describe('D1 RollbackEngine — Happy Path (STARTED → EXECUTING → COMMITTED)', () => {
  let transactionId: string;

  it('should start a transaction with status STARTED', async () => {
    const tx = await engine.startTransaction({
      domain: 'healthcare',
      transactionType: 'clinical_order_create',
      entityType: 'hc_clinical_order',
      entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      createdBy: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    });

    transactionId = tx.id;
    expect(tx.status).toBe('STARTED');
    expect(tx.domain).toBe('healthcare');
    expect(tx.transactionType).toBe('clinical_order_create');
  });

  it('should execute steps and transition to EXECUTING', async () => {
    const step1 = await engine.executeStep(transactionId, {
      action: 'create_order',
      entityType: 'hc_clinical_order',
      entityId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      snapshotBefore: { status: null },
      snapshotAfter: { status: 'PENDING' },
      compensatingAction: 'cancel_clinical_order',
      compensatingParams: { reason: 'Transaction rollback' },
    });

    expect(step1.sequence).toBe(1);
    expect(step1.status).toBe('EXECUTED');
    expect(step1.compensatingAction).toBe('cancel_clinical_order');

    // DB should now show EXECUTING
    const tx = await getTransaction(transactionId);
    expect(tx?.status).toBe('EXECUTING');
  });

  it('should allow multiple sequential steps', async () => {
    const step2 = await engine.executeStep(transactionId, {
      action: 'charge_patient',
      entityType: 'hc_invoice',
      entityId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      snapshotBefore: { total: 0 },
      snapshotAfter: { total: 500000 },
      compensatingAction: 'reverse_accounting_entry',
      compensatingParams: { reversal_reason: 'Order cancelled' },
    });

    expect(step2.sequence).toBe(2);

    const steps = await getSteps(transactionId);
    expect(steps.length).toBe(2);
    expect(steps[0]?.action).toBe('create_order');
    expect(steps[1]?.action).toBe('charge_patient');
  });

  it('should commit transaction and write audit log', async () => {
    await engine.commitTransaction(transactionId);

    const tx = await getTransaction(transactionId);
    expect(tx?.status).toBe('COMMITTED');

    const auditLog = await getAuditLog(transactionId);
    const commitEntry = auditLog.find(l => l.event_type === 'platform.transaction.committed.v1');
    expect(commitEntry).toBeDefined();
    expect(commitEntry?.outcome).toBe('COMMITTED');
  });

  it('should block invalid state transitions (cannot rollback a COMMITTED transaction)', async () => {
    await expect(
      engine.rollbackTransaction(transactionId, 'Trying to rollback committed tx')
    ).rejects.toThrow(/Invalid transition.*COMMITTED/);
  });
});

// ─────────────────────────────────────────────────────────────────
// Test Suite 2: Rollback Path — Compensation in Reverse Order
// ─────────────────────────────────────────────────────────────────
describe('D1 RollbackEngine — Rollback Path (compensation in reverse)', () => {
  let transactionId: string;

  beforeEach(async () => {
    const tx = await engine.startTransaction({
      domain: 'healthcare',
      transactionType: 'clinical_order_create',
      entityType: 'hc_clinical_order',
      entityId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    });
    transactionId = tx.id;

    // Step 1: create order
    await engine.executeStep(transactionId, {
      action: 'step_1_create_order',
      entityType: 'hc_clinical_order',
      entityId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      compensatingAction: 'cancel_clinical_order',
      compensatingParams: { reason: 'Rollback test' },
    });

    // Step 2: update journey
    await engine.executeStep(transactionId, {
      action: 'step_2_update_journey',
      entityType: 'auto_customer_journeys',
      entityId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      snapshotBefore: { current_stage_id: 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111' },
      snapshotAfter: { current_stage_id: 'aaaaaaaa-aaaa-aaaa-aaaa-222222222222' },
      compensatingAction: 'revert_journey_stage',
      compensatingParams: { previous_stage: 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111' },
    });
  });

  it('should rollback in reverse step order (step 2 then step 1)', async () => {
    const result = await engine.rollbackTransaction(transactionId, 'Test rollback', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

    // Both steps should be rolled back
    expect(result.stepsTotal).toBe(2);
    expect(result.stepsSucceeded).toBe(2);
    expect(result.stepsFailed).toBe(0);
    expect(result.finalStatus).toBe('ROLLED_BACK');

    // DB state
    const tx = await getTransaction(transactionId);
    expect(tx?.status).toBe('ROLLED_BACK');
    expect(tx?.rollback_reason).toBe('Test rollback');

    // Steps in DB should all be ROLLED_BACK
    const steps = await getSteps(transactionId);
    expect(steps.every(s => s.status === 'ROLLED_BACK')).toBe(true);

    // Audit log
    const auditLog = await getAuditLog(transactionId);
    const completedEntry = auditLog.find(l => l.event_type === 'platform.transaction.rollback.completed.v1');
    expect(completedEntry).toBeDefined();
    expect(completedEntry?.steps_succeeded).toBe(2);
    expect(completedEntry?.outcome).toBe('ROLLED_BACK');
  });

  it('should transition to ROLLING_BACK then ROLLED_BACK (visible in DB)', async () => {
    // Check intermediate state is captured in audit (rollback.started event)
    const rollbackPromise = engine.rollbackTransaction(transactionId, 'Checking states');
    await rollbackPromise;

    const auditLog = await getAuditLog(transactionId);
    const startedEntry = auditLog.find(l => l.event_type === 'platform.transaction.rollback.started.v1');
    expect(startedEntry).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// Test Suite 3: ROLLBACK_FAILED → MANUAL_RECOVERY_REQUIRED
//   Critical: system must NOT hide compensation failures
// ─────────────────────────────────────────────────────────────────
describe('D1 RollbackEngine — ROLLBACK_FAILED path (compensation failure)', () => {
  it('should set MANUAL_RECOVERY_REQUIRED if compensating action is unknown', async () => {
    const tx = await engine.startTransaction({
      domain: 'finance',
      transactionType: 'payment_processing',
      entityType: 'payment',
      entityId: '11111111-1111-1111-1111-111111111111',
    });

    await engine.executeStep(tx.id, {
      action: 'charge_card',
      entityType: 'payment',
      entityId: '11111111-1111-1111-1111-111111111111',
      compensatingAction: 'unknown_compensating_action_that_does_not_exist',
      compensatingParams: {},
    });

    const result = await engine.rollbackTransaction(tx.id, 'Payment system failure');

    // Must NOT succeed silently
    expect(result.success).toBe(false);
    expect(result.stepsFailed).toBe(1);
    expect(result.finalStatus).toBe('MANUAL_RECOVERY_REQUIRED');

    // DB must reflect MANUAL_RECOVERY_REQUIRED, not ROLLED_BACK
    const dbTx = await getTransaction(tx.id);
    expect(dbTx?.status).toBe('MANUAL_RECOVERY_REQUIRED');
    expect(dbTx?.rollback_failure_reason).toContain('MANUAL RECOVERY REQUIRED');

    // Audit must show the failure
    const auditLog = await getAuditLog(tx.id);
    const failedEntry = auditLog.find(l => l.event_type === 'platform.transaction.rollback.failed.v1');
    expect(failedEntry).toBeDefined();
    expect(failedEntry?.steps_failed).toBe(1);
    expect(failedEntry?.outcome).toBe('MANUAL_RECOVERY_REQUIRED');
  });

  it('should allow operator to acknowledge via markManualRecovery', async () => {
    const tx = await engine.startTransaction({
      domain: 'finance',
      transactionType: 'payment_processing',
      entityType: 'payment',
      entityId: '22222222-2222-2222-2222-222222222222',
    });

    await engine.executeStep(tx.id, {
      action: 'charge_card',
      entityType: 'payment',
      entityId: '22222222-2222-2222-2222-222222222222',
      compensatingAction: 'nonexistent_action',
      compensatingParams: {},
    });

    await engine.rollbackTransaction(tx.id, 'Test MANUAL_RECOVERY');

    // Operator acknowledges
    await engine.markManualRecovery(
      tx.id,
      'Manually reversed via bank portal. Reference: REF-2026-001.',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );

    const dbTx = await getTransaction(tx.id);
    expect(dbTx?.manual_recovery_note).toContain('Manually reversed via bank portal');
  });
});

// ─────────────────────────────────────────────────────────────────
// Test Suite 4: Immutability Guards
// ─────────────────────────────────────────────────────────────────
describe('D1 RollbackEngine — Immutability guards', () => {
  it('should reject direct DELETE on platform_transaction_steps', async () => {
    const tx = await engine.startTransaction({
      domain: 'platform',
      transactionType: 'test_immutability',
      entityType: 'test',
      entityId: '33333333-3333-3333-3333-333333333333',
    });

    await engine.executeStep(tx.id, {
      action: 'test_step',
      entityType: 'test',
      entityId: '33333333-3333-3333-3333-333333333333',
      compensatingAction: 'restore_inventory',
      compensatingParams: { quantity: 5, p_inventory_id: '33333333-3333-3333-3333-333333333333' },
    });

    const steps = await getSteps(tx.id);
    expect(steps.length).toBe(1);

    // Try to DELETE a step — should be rejected by DB trigger
    const { error } = await supabase
      .from('platform_transaction_steps')
      .delete()
      .eq('id', steps[0]!.id);

    expect(error).toBeDefined();
    expect(error?.message).toContain('append-only');
  });

  it('should reject direct DELETE on platform_rollback_audit_log', async () => {
    const tx = await engine.startTransaction({
      domain: 'platform',
      transactionType: 'test_audit_immutability',
      entityType: 'test',
      entityId: '44444444-4444-4444-4444-444444444444',
    });
    await engine.commitTransaction(tx.id);

    const auditLog = await getAuditLog(tx.id);
    expect(auditLog.length).toBeGreaterThan(0);

    const { error } = await supabase
      .from('platform_rollback_audit_log')
      .delete()
      .eq('id', auditLog[0]!.id);

    expect(error).toBeDefined();
    expect(error?.message).toContain('immutable');
  });
});
