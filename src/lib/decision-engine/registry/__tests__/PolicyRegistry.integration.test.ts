/**
 * PolicyRegistry Integration Tests
 * 
 * Tests PolicyRegistry with real database (not mocked).
 * Tests full lifecycle flows: register → publish → deprecate → archive
 * 
 * Prerequisites:
 * - NEXT_PUBLIC_SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable (for testing)
 * - Database schema deployed
 * 
 * Run with: npm test -- PolicyRegistry.integration.test.ts
 * 
 * Note: These tests use service role key to bypass RLS policies
 */

import { PolicyRegistry } from '../PolicyRegistry';
import {
  PolicyNotFoundError,
  InvalidStatusTransitionError,
  GovernanceValidationError,
} from '../types';
import {
  createTestClient,
  cleanupTestData,
  wait,
  generateTestPolicyId,
  createMockPolicyInput,
} from './test-helpers';

// Mock the Supabase server client to use test client
jest.mock('@/lib/supabase-server', () => {
  const { createTestClient } = require('./test-helpers');
  return {
    createClient: jest.fn(async () => createTestClient()),
  };
});

describe('PolicyRegistry - Integration Tests', () => {
  const testUserId = 'test-user-integration';
  let supabase: ReturnType<typeof createTestClient>;
  let testPolicyId: string;

  beforeAll(async () => {
    // Get test Supabase client (bypasses Next.js cookies)
    supabase = createTestClient();

    // Clean up any existing test data
    await cleanupTestData(supabase);
  });

  afterEach(async () => {
    // Clean up after each test
    if (testPolicyId) {
      await supabase
        .from('policy_registry')
        .delete()
        .eq('policy_id', testPolicyId);

      await supabase
        .from('policy_history')
        .delete()
        .eq('policy_id', testPolicyId);
    }
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData(supabase);
  });

  // ==========================================================================
  // LIFECYCLE: Register → Publish → Deprecate
  // ==========================================================================

  describe('Full Lifecycle Flow', () => {
    it('should complete full policy lifecycle: register → publish → deprecate', async () => {
      testPolicyId = generateTestPolicyId('lifecycle');

      // STEP 1: Register a new policy (draft)
      const registerInput = createMockPolicyInput(testPolicyId, '1.0.0');

      const registered = await PolicyRegistry.register(registerInput, testUserId);

      expect(registered).toBeDefined();
      expect(registered.policyId).toBe(testPolicyId);
      expect(registered.version).toBe('1.0.0');
      expect(registered.status).toBe('draft');
      expect(registered.isActive).toBe(false);

      // Verify in database
      const { data: dbPolicy } = await supabase
        .from('policy_registry')
        .select('*')
        .eq('policy_id', testPolicyId)
        .eq('version', '1.0.0')
        .single();

      expect(dbPolicy).toBeDefined();
      expect(dbPolicy.status).toBe('draft');
      expect(dbPolicy.created_by).toBe(testUserId);

      // Verify audit trail
      const { data: auditLogs } = await supabase
        .from('policy_history')
        .select('*')
        .eq('policy_id', testPolicyId)
        .order('created_at', { ascending: false });

      expect(auditLogs).toBeDefined();
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('created');

      // STEP 2: Publish the policy (draft → active)
      const published = await PolicyRegistry.publish(
        testPolicyId,
        '1.0.0',
        testUserId,
        'Initial release'
      );

      expect(published.status).toBe('active');
      expect(published.isActive).toBe(true);
      expect(published.publishedAt).toBeDefined();
      expect(published.publishedBy).toBe(testUserId);

      // Verify in database
      const { data: dbPublished } = await supabase
        .from('policy_registry')
        .select('*')
        .eq('policy_id', testPolicyId)
        .eq('version', '1.0.0')
        .single();

      expect(dbPublished.status).toBe('active');
      expect(dbPublished.is_active).toBe(true);

      // Verify publish audit
      const { data: publishAudit } = await supabase
        .from('policy_history')
        .select('*')
        .eq('policy_id', testPolicyId)
        .eq('action', 'published')
        .single();

      expect(publishAudit).toBeDefined();
      expect(publishAudit.reason).toBe('Initial release');

      // STEP 3: Deprecate the policy (active → deprecated)
      const deprecated = await PolicyRegistry.deprecate(
        testPolicyId,
        '1.0.0',
        testUserId,
        'Policy outdated - replaced by v2.0.0'
      );

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.isActive).toBe(false);
      expect(deprecated.deprecatedAt).toBeDefined();

      // Verify in database
      const { data: dbDeprecated } = await supabase
        .from('policy_registry')
        .select('*')
        .eq('policy_id', testPolicyId)
        .eq('version', '1.0.0')
        .single();

      expect(dbDeprecated.status).toBe('deprecated');
      expect(dbDeprecated.is_active).toBe(false);

      // Verify deprecate audit
      const { data: deprecateAudit } = await supabase
        .from('policy_history')
        .select('*')
        .eq('policy_id', testPolicyId)
        .eq('action', 'deprecated')
        .single();

      expect(deprecateAudit).toBeDefined();
      expect(deprecateAudit.reason).toBe('Policy outdated - replaced by v2.0.0');
    }, 30000); // 30s timeout for database operations
  });

  // ==========================================================================
  // VERSIONING: Multiple Versions
  // ==========================================================================

  describe('Policy Versioning', () => {
    it('should handle multiple versions with only one active', async () => {
      testPolicyId = generateTestPolicyId('versioning');

      // Register v1.0.0
      const v1Input = createMockPolicyInput(testPolicyId, '1.0.0');
      await PolicyRegistry.register(v1Input, testUserId);
      await PolicyRegistry.publish(testPolicyId, '1.0.0', testUserId, 'v1 release');

      // Register v2.0.0
      const v2Input = createMockPolicyInput(testPolicyId, '2.0.0');
      await PolicyRegistry.register(v2Input, testUserId);
      await PolicyRegistry.publish(testPolicyId, '2.0.0', testUserId, 'v2 release');

      // Verify v1 is now inactive
      const v1After = await PolicyRegistry.get(testPolicyId, '1.0.0');
      expect(v1After.isActive).toBe(false);

      // Verify v2 is active
      const v2After = await PolicyRegistry.get(testPolicyId, '2.0.0');
      expect(v2After.isActive).toBe(true);

      // Verify get() without version returns active (v2)
      const active = await PolicyRegistry.get(testPolicyId);
      expect(active.version).toBe('2.0.0');
      expect(active.isActive).toBe(true);

      // Verify database constraint (only one active)
      const { data: allVersions } = await supabase
        .from('policy_registry')
        .select('*')
        .eq('policy_id', testPolicyId)
        .order('version', { ascending: true });

      expect(allVersions.length).toBe(2);
      const activeCount = allVersions.filter((p: any) => p.is_active).length;
      expect(activeCount).toBe(1);
    }, 30000);

    it('should allow reactivation of deprecated version', async () => {
      testPolicyId = generateTestPolicyId('reactivate');

      const input = createMockPolicyInput(testPolicyId, '1.0.0');

      // Register and publish
      await PolicyRegistry.register(input, testUserId);
      await PolicyRegistry.publish(testPolicyId, '1.0.0', testUserId);

      // Deprecate
      await PolicyRegistry.deprecate(testPolicyId, '1.0.0', testUserId, 'Testing reactivation flow');

      // Reactivate
      const reactivated = await PolicyRegistry.activate(testPolicyId, '1.0.0', testUserId);

      expect(reactivated.status).toBe('active');
      expect(reactivated.isActive).toBe(true);

      // Verify audit trail has 'restored' action
      const { data: restoreAudit } = await supabase
        .from('policy_history')
        .select('*')
        .eq('policy_id', testPolicyId)
        .eq('action', 'restored')
        .single();

      expect(restoreAudit).toBeDefined();
    }, 30000);
  });

  // ==========================================================================
  // STATISTICS: Decision Recording
  // ==========================================================================

  describe('Decision Statistics', () => {
    it('should track decision statistics accurately', async () => {
      testPolicyId = generateTestPolicyId('stats');

      const input = createMockPolicyInput(testPolicyId, '1.0.0');

      await PolicyRegistry.register(input, testUserId);
      await PolicyRegistry.publish(testPolicyId, '1.0.0', testUserId);

      // Record multiple decisions
      await PolicyRegistry.recordDecision(testPolicyId, '1.0.0', 'approve', 0.95);
      await PolicyRegistry.recordDecision(testPolicyId, '1.0.0', 'approve', 0.88);
      await PolicyRegistry.recordDecision(testPolicyId, '1.0.0', 'reject', 0.75);

      // Wait for statistics to update (async)
      await wait(2000);

      // Verify statistics
      const stats = await PolicyRegistry.getStatistics(testPolicyId, '1.0.0');

      expect(stats).toBeDefined();
      expect(stats!.totalDecisions).toBe(3);
      expect(stats!.totalApprovals).toBe(2);
      expect(stats!.totalRejections).toBe(1);
      expect(stats!.approvalRate).toBeCloseTo(66.67, 1);
      expect(stats!.avgConfidence).toBeDefined();
      expect(stats!.lastDecisionAt).toBeDefined();

      // Verify in database
      const { data: dbPolicy } = await supabase
        .from('policy_registry')
        .select('config')
        .eq('policy_id', testPolicyId)
        .eq('version', '1.0.0')
        .single();

      expect(dbPolicy.config.total_decisions).toBe(3);
      expect(dbPolicy.config.total_approvals).toBe(2);
      expect(dbPolicy.config.total_rejections).toBe(1);
    }, 30000);
  });

  // ==========================================================================
  // GOVERNANCE: Validation
  // ==========================================================================

  describe('Governance Validation', () => {
    it('should reject publish without required governance fields', async () => {
      testPolicyId = generateTestPolicyId('governance');

      const inputWithoutOwner = createMockPolicyInput(testPolicyId, '1.0.0');
      // Remove required governance fields
      delete (inputWithoutOwner as any).businessOwner;
      delete (inputWithoutOwner as any).businessOwnerEmail;

      await PolicyRegistry.register(inputWithoutOwner, testUserId);

      // Should fail to publish
      await expect(
        PolicyRegistry.publish(testPolicyId, '1.0.0', testUserId)
      ).rejects.toThrow(GovernanceValidationError);
    }, 30000);

    it('should pass governance check with all required fields', async () => {
      testPolicyId = generateTestPolicyId('gov-pass');

      const validInput = createMockPolicyInput(testPolicyId, '1.0.0');

      await PolicyRegistry.register(validInput, testUserId);

      const governanceCheck = await PolicyRegistry.checkGovernance(testPolicyId, '1.0.0');

      expect(governanceCheck.passed).toBe(true);
      expect(governanceCheck.errors).toHaveLength(0);

      // Should publish successfully
      const published = await PolicyRegistry.publish(testPolicyId, '1.0.0', testUserId);
      expect(published.status).toBe('active');
    }, 30000);

    it('should reject expired policy', async () => {
      testPolicyId = generateTestPolicyId('expired');

      const expiredInput = createMockPolicyInput(testPolicyId, '1.0.0');
      expiredInput.effectiveDate = '2025-01-01';
      (expiredInput as any).expireDate = '2025-12-31'; // Past date

      await PolicyRegistry.register(expiredInput, testUserId);

      // Should fail governance check
      const governanceCheck = await PolicyRegistry.checkGovernance(testPolicyId, '1.0.0');

      expect(governanceCheck.passed).toBe(false);
      expect(governanceCheck.errors.some((err) => err.includes('expired'))).toBe(true);

      // Should fail to publish
      await expect(
        PolicyRegistry.publish(testPolicyId, '1.0.0', testUserId)
      ).rejects.toThrow();
    }, 30000);
  });

  // ==========================================================================
  // QUERY: List and Filter
  // ==========================================================================

  describe('Query Operations', () => {
    it('should list policies with filters', async () => {
      const policyIds: string[] = [];

      // Create multiple test policies
      for (let i = 0; i < 3; i++) {
        const policyId = generateTestPolicyId(`list-${i}`);
        policyIds.push(policyId);

        const input = createMockPolicyInput(policyId, '1.0.0');
        await PolicyRegistry.register(input, testUserId);

        // Publish first 2
        if (i < 2) {
          await PolicyRegistry.publish(policyId, '1.0.0', testUserId);
        }
      }

      // Query all test policies
      const allResult = await PolicyRegistry.list({
        limit: 10,
      });

      const testPolicies = allResult.policies.filter((p) =>
        policyIds.includes(p.policyId)
      );
      expect(testPolicies.length).toBe(3);

      // Query active only
      const activeResult = await PolicyRegistry.list({
        status: 'active',
        limit: 10,
      });

      const activeTestPolicies = activeResult.policies.filter((p) =>
        policyIds.includes(p.policyId)
      );
      expect(activeTestPolicies.length).toBe(2);

      // Query draft only
      const draftResult = await PolicyRegistry.list({
        status: 'draft',
        limit: 10,
      });

      const draftTestPolicies = draftResult.policies.filter((p) =>
        policyIds.includes(p.policyId)
      );
      expect(draftTestPolicies.length).toBe(1);

      // Cleanup
      for (const policyId of policyIds) {
        await supabase
          .from('policy_registry')
          .delete()
          .eq('policy_id', policyId);

        await supabase
          .from('policy_history')
          .delete()
          .eq('policy_id', policyId);
      }
    }, 30000);

    it('should check policy existence', async () => {
      testPolicyId = generateTestPolicyId('exists');

      // Should not exist initially
      const existsBefore = await PolicyRegistry.exists(testPolicyId, '1.0.0');
      expect(existsBefore).toBe(false);

      // Register
      const input = createMockPolicyInput(testPolicyId, '1.0.0');
      await PolicyRegistry.register(input, testUserId);

      // Should exist now
      const existsAfter = await PolicyRegistry.exists(testPolicyId, '1.0.0');
      expect(existsAfter).toBe(true);
    }, 30000);
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('Error Handling', () => {
    it('should throw PolicyNotFoundError for non-existent policy', async () => {
      await expect(
        PolicyRegistry.get('non-existent-policy', '1.0.0')
      ).rejects.toThrow(PolicyNotFoundError);
    }, 30000);

    it('should throw for invalid status transition', async () => {
      testPolicyId = generateTestPolicyId('invalid-transition');

      const input = createMockPolicyInput(testPolicyId, '1.0.0');
      await PolicyRegistry.register(input, testUserId);

      // Cannot deprecate a draft policy (must be active first)
      await expect(
        PolicyRegistry.deprecate(testPolicyId, '1.0.0', testUserId, 'Invalid transition attempt')
      ).rejects.toThrow(InvalidStatusTransitionError);
    }, 30000);
  });
});
