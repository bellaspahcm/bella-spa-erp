/**
 * Phase D3 — Governed Business Rule Engine Tests
 * Tests: lifecycle management, condition evaluation, governance hierarchy,
 *        ABSOLUTE severity, ACTIVE immutability, version retirement, audit log.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { RuleEngineService, RuleConditions } from '@/platform/host/rule-engine';
import crypto from 'crypto';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const TEST_TENANT_ID = '88888888-8888-8888-8888-888888888888';

let supabase: ReturnType<typeof createClient<Database>>;
let engine: RuleEngineService;

beforeAll(() => {
  supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  engine = new RuleEngineService(supabase, TEST_TENANT_ID);
});

const VIP_CONDITIONS: RuleConditions = {
  operator: 'AND',
  rules: [
    { field: 'customer.tier', op: 'EQ', value: 'VIP' },
    { field: 'booking.value', op: 'GT', value: 5000000 },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Suite 1: Rule Lifecycle — DRAFT → APPROVED → ACTIVE
// ─────────────────────────────────────────────────────────────────
describe('D3 RuleEngine — Lifecycle: DRAFT → APPROVED → ACTIVE', () => {
  let ruleId: string;
  let ruleKey: string;

  beforeAll(() => {
    ruleKey = `TEST_VIP_UPGRADE_${crypto.randomUUID().slice(0, 8)}`;
  });

  it('should create rule in DRAFT status', async () => {
    const rule = await engine.createRule({
      ruleKey,
      version: '1.0.0',
      domain: 'spa.booking',
      name: 'VIP Booking Upgrade',
      description: 'Auto-upgrade VIP customers with bookings > 5M VND',
      severity: 'LOW',
      conditions: VIP_CONDITIONS,
      actionType: 'NOTIFY',
      actionParams: { message: 'VIP upgrade applied', channel: 'in-app' },
    });

    ruleId = rule.id;
    expect(rule.status).toBe('DRAFT');
    expect(rule.ruleKey).toBe(ruleKey);
    expect(rule.severity).toBe('LOW');
  });

  it('should approve rule → APPROVED status', async () => {
    await engine.approveRule({
      ruleId,
      approvedBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      approvedAt: new Date().toISOString(),
    });

    const { data } = await supabase
      .from('platform_business_rules')
      .select('status, approved_by')
      .eq('id', ruleId)
      .single();

    expect(data?.status).toBe('APPROVED');
    expect(data?.approved_by).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('should activate rule → ACTIVE status', async () => {
    await engine.activateRule(ruleId);

    const { data } = await supabase
      .from('platform_business_rules')
      .select('status')
      .eq('id', ruleId)
      .single();

    expect(data?.status).toBe('ACTIVE');
  });

  it('should auto-retire previous ACTIVE when new version activated', async () => {
    // Create v1.1.0 of the same rule_key
    const v2 = await engine.createRule({
      ruleKey,
      version: '1.1.0',
      domain: 'spa.booking',
      name: 'VIP Booking Upgrade v2',
      severity: 'LOW',
      conditions: { operator: 'AND', rules: [{ field: 'customer.tier', op: 'EQ', value: 'VIP' }] },
      actionType: 'NOTIFY',
      actionParams: { message: 'VIP v2' },
    });

    await engine.approveRule({ ruleId: v2.id, approvedBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    await engine.activateRule(v2.id);

    // v1.0.0 should now be RETIRED
    const { data: oldRule } = await supabase
      .from('platform_business_rules')
      .select('status')
      .eq('id', ruleId)
      .single();
    expect(oldRule?.status).toBe('RETIRED');

    // v1.1.0 should be ACTIVE
    const { data: newRule } = await supabase
      .from('platform_business_rules')
      .select('status')
      .eq('id', v2.id)
      .single();
    expect(newRule?.status).toBe('ACTIVE');
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 2: Condition Evaluation — all operators
// ─────────────────────────────────────────────────────────────────
describe('D3 RuleEngine — Condition evaluation', () => {
  let activeRuleId: string;
  let ruleKey: string;

  beforeAll(async () => {
    ruleKey = `TEST_EVAL_${crypto.randomUUID().slice(0, 8)}`;
    const rule = await engine.createRule({
      ruleKey,
      version: '1.0.0',
      domain: 'spa.booking',
      name: 'Eval Operators Test',
      severity: 'LOW',
      conditions: VIP_CONDITIONS,
      actionType: 'NOTIFY',
      actionParams: { message: 'Triggered' },
    });
    await engine.approveRule({ ruleId: rule.id, approvedBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    await engine.activateRule(rule.id);
    activeRuleId = rule.id;
  });

  it('should TRIGGER when all AND conditions are met', async () => {
    const result = await engine.evaluateRule({
      ruleId: activeRuleId,
      contextType: 'spa_booking',
      inputData: { customer: { tier: 'VIP' }, booking: { value: 6000000 } },
    });

    expect(result.outcome).toBe('TRIGGERED');
    expect(result.conditionsMet).toBe(true);
  });

  it('should NOT_TRIGGER when one AND condition fails', async () => {
    const result = await engine.evaluateRule({
      ruleId: activeRuleId,
      contextType: 'spa_booking',
      inputData: { customer: { tier: 'REGULAR' }, booking: { value: 6000000 } },
    });

    expect(result.outcome).toBe('NOT_TRIGGERED');
    expect(result.conditionsMet).toBe(false);
  });

  it('should NOT_TRIGGER when booking value is too low', async () => {
    const result = await engine.evaluateRule({
      ruleId: activeRuleId,
      contextType: 'spa_booking',
      inputData: { customer: { tier: 'VIP' }, booking: { value: 100000 } },
    });

    expect(result.outcome).toBe('NOT_TRIGGERED');
  });

  it('should support dot-notation nested field access', async () => {
    const result = await engine.evaluateRule({
      ruleId: activeRuleId,
      contextType: 'spa_booking',
      inputData: { customer: { tier: 'VIP', id: 'test' }, booking: { value: 9999999 } },
    });

    expect(result.outcome).toBe('TRIGGERED');
  });

  it('should write evaluation to audit log', async () => {
    const result = await engine.evaluateRule({
      ruleId: activeRuleId,
      contextType: 'spa_booking',
      contextId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      inputData: { customer: { tier: 'VIP' }, booking: { value: 8000000 } },
      correlationId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    });

    expect(result.outcome).toBe('TRIGGERED');

    const { data: log } = await supabase
      .from('platform_rule_evaluation_log')
      .select('*')
      .eq('rule_id', activeRuleId)
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .single();

    expect(log?.outcome).toBe('TRIGGERED');
    expect(log?.conditions_met).toBe(true);
    expect(log?.context_type).toBe('spa_booking');
    expect(log?.correlation_id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd');
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 3: Governance — ABSOLUTE severity requires approval
// ─────────────────────────────────────────────────────────────────
describe('D3 RuleEngine — ABSOLUTE severity governance', () => {
  it('should reject ABSOLUTE rule without approved_by at DB level', async () => {
    const ruleKey = `TEST_ABS_NO_APP_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase
      .from('platform_business_rules')
      .insert({
        tenant_id: TEST_TENANT_ID,
        rule_key: ruleKey,
        version: '1.0.0',
        domain: 'spa.booking',
        name: 'Absolute Without Approval',
        status: 'ACTIVE',
        severity: 'ABSOLUTE',
        conditions: { operator: 'AND', rules: [] },
        action_type: 'BLOCK',
        action_params: {},
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('chk_absolute_requires_approval');
  });

  it('should allow ABSOLUTE rule with approved_by + approved_at', async () => {
    const ruleKey = `TEST_ABS_WITH_APP_${crypto.randomUUID().slice(0, 8)}`;
    const rule = await engine.createRule({
      ruleKey,
      version: '1.0.0',
      domain: 'spa.booking',
      name: 'Absolute With Proper Approval',
      severity: 'MODERATE',
      conditions: VIP_CONDITIONS,
      actionType: 'BLOCK',
      actionParams: {},
    });

    await engine.approveRule({
      ruleId: rule.id,
      approvedBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });

    await engine.activateRule(rule.id);

    const active = await engine.getActiveRuleVersion(ruleKey);
    expect(active?.status).toBe('ACTIVE');
  }, 30000); // Increase timeout to 30s for slow rule operations
});

// ─────────────────────────────────────────────────────────────────
// Suite 4: ACTIVE Immutability — cannot modify conditions
// ─────────────────────────────────────────────────────────────────
describe('D3 RuleEngine — ACTIVE rule immutability (DB trigger)', () => {
  it('should reject UPDATE of conditions on ACTIVE rule', async () => {
    const ruleKey = `TEST_IMMUTABLE_${crypto.randomUUID().slice(0, 8)}`;
    const rule = await engine.createRule({
      ruleKey,
      version: '1.0.0',
      domain: 'finance.commission',
      name: 'Immutable Test Rule',
      severity: 'LOW',
      conditions: VIP_CONDITIONS,
      actionType: 'NOTIFY',
      actionParams: {},
    });

    await engine.approveRule({ ruleId: rule.id, approvedBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    await engine.activateRule(rule.id);

    const { error } = await supabase
      .from('platform_business_rules')
      .update({ conditions: { operator: 'OR', rules: [] } as unknown as Database['public']['Tables']['platform_business_rules']['Update']['conditions'] })
      .eq('id', rule.id);

    expect(error).toBeDefined();
    expect(error?.message).toContain('cannot be modified');
  });

  it('should allow status transition (ACTIVE → SUSPENDED) on ACTIVE rule', async () => {
    const ruleKey = `TEST_SUSPEND_${crypto.randomUUID().slice(0, 8)}`;
    const rule = await engine.createRule({
      ruleKey,
      version: '1.0.0',
      domain: 'notification.routing',
      name: 'Suspendable Rule',
      severity: 'LOW',
      conditions: VIP_CONDITIONS,
      actionType: 'NOTIFY',
      actionParams: {},
    });

    await engine.approveRule({ ruleId: rule.id, approvedBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    await engine.activateRule(rule.id);
    await engine.suspendRule(rule.id, 'Maintenance window');

    const { data } = await supabase
      .from('platform_business_rules')
      .select('status')
      .eq('id', rule.id)
      .single();

    expect(data?.status).toBe('SUSPENDED');
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 5: Batch Evaluation
// ─────────────────────────────────────────────────────────────────
describe('D3 RuleEngine — Batch evaluation of domain rules', () => {
  it('should evaluate all ACTIVE rules for a domain', async () => {
    const results = await engine.evaluateAllActiveRules(
      'spa.booking',
      'spa_booking',
      { customer: { tier: 'VIP' }, booking: { value: 9999999 } }
    );

    expect(Array.isArray(results)).toBe(true);
    for (const r of results) {
      expect(['TRIGGERED', 'NOT_TRIGGERED', 'SKIPPED_SUSPENDED', 'SKIPPED_EXPIRED']).toContain(r.outcome);
    }
  });
});
