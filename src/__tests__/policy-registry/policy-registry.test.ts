/**
 * Policy Registry Tests
 * 
 * Tests for the Policy Registry system.
 * 
 * Coverage:
 * - Registration (success, duplicate prevention, force override)
 * - Listing (no filter, domain filter, category filter, tags filter, search)
 * - getPolicy, hasPolicy, unregister
 * - Statistics calculation
 * - Metadata validation
 */

import { PolicyRegistry } from '@/lib/policy-registry/policy-registry';
import type { PolicyMetadata } from '@/lib/policy-registry/types';

// Mock policy classes
class MockRewardPolicy {
  name = 'MockRewardPolicy';
}

class MockPenaltyPolicy {
  name = 'MockPenaltyPolicy';
}

class MockApprovalPolicy {
  name = 'MockApprovalPolicy';
}

describe('PolicyRegistry', () => {
  let registry: PolicyRegistry;
  
  beforeEach(() => {
    // Get fresh instance and clear it
    registry = PolicyRegistry.getInstance();
    registry.clear();
  });
  
  // ═══════════════════════════════════════════════════════════════
  // REGISTRATION TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('register()', () => {
    it('should register a new policy successfully', async () => {
      const policy = new MockRewardPolicy();
      const metadata: Omit<PolicyMetadata, 'createdAt' | 'updatedAt'> = {
        id: 'test-reward-v1',
        name: 'Test Reward Policy',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: ['salary', 'commission'],
        status: 'active',
        owner: 'test-suite',
        decisionType: 'test-reward',
        className: 'MockRewardPolicy',
        description: 'Test reward policy for unit testing',
      };
      
      const id = await registry.register(policy, metadata);
      
      expect(id).toBe('test-reward-v1');
      expect(registry.hasPolicy('test-reward-v1')).toBe(true);
    });
    
    it('should prevent duplicate registration without force flag', async () => {
      const policy = new MockRewardPolicy();
      const metadata: Omit<PolicyMetadata, 'createdAt' | 'updatedAt'> = {
        id: 'test-duplicate',
        name: 'Test Policy',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'MockRewardPolicy',
        description: 'Test',
      };
      
      // First registration should succeed
      await registry.register(policy, metadata);
      
      // Second registration should fail
      await expect(
        registry.register(policy, metadata)
      ).rejects.toThrow("Policy 'test-duplicate' is already registered");
    });
    
    it('should allow override with force flag', async () => {
      const policy1 = new MockRewardPolicy();
      const policy2 = new MockPenaltyPolicy();
      const metadata: Omit<PolicyMetadata, 'createdAt' | 'updatedAt'> = {
        id: 'test-force',
        name: 'Test Policy',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'MockPolicy',
        description: 'Test',
      };
      
      // First registration
      await registry.register(policy1, metadata);
      
      // Override with force
      await registry.register(policy2, { ...metadata, version: '2.0.0' }, { force: true });
      
      const registered = registry.getPolicy('test-force');
      expect(registered?.metadata.version).toBe('2.0.0');
      expect(registered?.policy).toBeInstanceOf(MockPenaltyPolicy);
    });
    
    it('should validate required metadata fields', async () => {
      const policy = new MockRewardPolicy();
      
      // Missing ID
      await expect(
        registry.register(policy, {
          id: '',
          name: 'Test',
          version: '1.0.0',
          domain: 'payroll',
          category: 'reward',
          tags: [],
          status: 'active',
          owner: 'test',
          decisionType: 'test',
          className: 'Test',
          description: 'Test',
        })
      ).rejects.toThrow('Policy ID is required');
      
      // Missing version
      await expect(
        registry.register(policy, {
          id: 'test',
          name: 'Test',
          version: '',
          domain: 'payroll',
          category: 'reward',
          tags: [],
          status: 'active',
          owner: 'test',
          decisionType: 'test',
          className: 'Test',
          description: 'Test',
        })
      ).rejects.toThrow('Policy version is required');
    });
    
    it('should validate version format (semver)', async () => {
      const policy = new MockRewardPolicy();
      
      await expect(
        registry.register(policy, {
          id: 'test',
          name: 'Test',
          version: 'invalid',
          domain: 'payroll',
          category: 'reward',
          tags: [],
          status: 'active',
          owner: 'test',
          decisionType: 'test',
          className: 'Test',
          description: 'Test',
        })
      ).rejects.toThrow('Invalid version format');
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // LISTING & FILTERING TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('listPolicies()', () => {
    beforeEach(async () => {
      // Register test policies
      await registry.register(new MockRewardPolicy(), {
        id: 'payroll-reward-v1',
        name: 'Payroll Reward',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: ['salary', 'commission'],
        status: 'active',
        owner: 'test',
        decisionType: 'payroll-reward',
        className: 'MockRewardPolicy',
        description: 'Rewards employees',
      });
      
      await registry.register(new MockPenaltyPolicy(), {
        id: 'payroll-penalty-v1',
        name: 'Payroll Penalty',
        version: '1.0.0',
        domain: 'payroll',
        category: 'penalty',
        tags: ['salary', 'violation'],
        status: 'active',
        owner: 'test',
        decisionType: 'payroll-penalty',
        className: 'MockPenaltyPolicy',
        description: 'Penalizes violations',
      });
      
      await registry.register(new MockApprovalPolicy(), {
        id: 'booking-approval-v1',
        name: 'Booking Approval',
        version: '1.0.0',
        domain: 'booking',
        category: 'approval',
        tags: ['booking', 'workflow'],
        status: 'active',
        owner: 'test',
        decisionType: 'booking-approval',
        className: 'MockApprovalPolicy',
        description: 'Approves bookings',
      });
      
      await registry.register(new MockRewardPolicy(), {
        id: 'procurement-reward-v1',
        name: 'Procurement Reward',
        version: '1.0.0',
        domain: 'procurement',
        category: 'reward',
        tags: ['procurement', 'efficiency'],
        status: 'experimental',
        owner: 'test',
        decisionType: 'procurement-reward',
        className: 'MockRewardPolicy',
        description: 'Rewards procurement efficiency',
      });
    });
    
    it('should list all policies without filter', () => {
      const policies = registry.listPolicies();
      expect(policies).toHaveLength(4);
    });
    
    it('should filter by domain', () => {
      const payrollPolicies = registry.listPolicies({ domain: 'payroll' });
      expect(payrollPolicies).toHaveLength(2);
      expect(payrollPolicies.every(p => p.metadata.domain === 'payroll')).toBe(true);
    });
    
    it('should filter by category', () => {
      const rewardPolicies = registry.listPolicies({ category: 'reward' });
      expect(rewardPolicies).toHaveLength(2);
      expect(rewardPolicies.every(p => p.metadata.category === 'reward')).toBe(true);
    });
    
    it('should filter by tags (all tags must match)', () => {
      const salaryPolicies = registry.listPolicies({ tags: ['salary'] });
      expect(salaryPolicies).toHaveLength(2);
      
      const commissionPolicies = registry.listPolicies({ tags: ['salary', 'commission'] });
      expect(commissionPolicies).toHaveLength(1);
      expect(commissionPolicies[0].metadata.id).toBe('payroll-reward-v1');
    });
    
    it('should filter by status', () => {
      const activePolicies = registry.listPolicies({ status: 'active' });
      expect(activePolicies).toHaveLength(3);
      
      const experimentalPolicies = registry.listPolicies({ status: 'experimental' });
      expect(experimentalPolicies).toHaveLength(1);
      expect(experimentalPolicies[0].metadata.id).toBe('procurement-reward-v1');
    });
    
    it('should search by name (case-insensitive partial match)', () => {
      const bookingPolicies = registry.listPolicies({ search: 'booking' });
      expect(bookingPolicies).toHaveLength(1);
      expect(bookingPolicies[0].metadata.name).toBe('Booking Approval');
      
      const rewardPolicies = registry.listPolicies({ search: 'reward' });
      expect(rewardPolicies).toHaveLength(2);
    });
    
    it('should combine multiple filters', () => {
      const filtered = registry.listPolicies({
        domain: 'payroll',
        category: 'reward',
        tags: ['commission'],
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].metadata.id).toBe('payroll-reward-v1');
    });
  });
  
  describe('getPoliciesByDomain()', () => {
    it('should be a convenience wrapper for listPolicies({ domain })', async () => {
      await registry.register(new MockRewardPolicy(), {
        id: 'test-1',
        name: 'Test 1',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      await registry.register(new MockRewardPolicy(), {
        id: 'test-2',
        name: 'Test 2',
        version: '1.0.0',
        domain: 'booking',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      const payrollPolicies = registry.getPoliciesByDomain('payroll');
      expect(payrollPolicies).toHaveLength(1);
      expect(payrollPolicies[0].metadata.domain).toBe('payroll');
    });
  });
  
  describe('getPoliciesByCategory()', () => {
    it('should be a convenience wrapper for listPolicies({ category })', async () => {
      await registry.register(new MockRewardPolicy(), {
        id: 'test-1',
        name: 'Test 1',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      await registry.register(new MockPenaltyPolicy(), {
        id: 'test-2',
        name: 'Test 2',
        version: '1.0.0',
        domain: 'payroll',
        category: 'penalty',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      const rewardPolicies = registry.getPoliciesByCategory('reward');
      expect(rewardPolicies).toHaveLength(1);
      expect(rewardPolicies[0].metadata.category).toBe('reward');
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // GET & CHECK TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('getPolicy()', () => {
    it('should return registered policy by ID', async () => {
      const policy = new MockRewardPolicy();
      await registry.register(policy, {
        id: 'test-get',
        name: 'Test',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      const registered = registry.getPolicy('test-get');
      expect(registered).toBeDefined();
      expect(registered?.metadata.id).toBe('test-get');
      expect(registered?.policy).toBeInstanceOf(MockRewardPolicy);
    });
    
    it('should return undefined for non-existent policy', () => {
      const registered = registry.getPolicy('non-existent');
      expect(registered).toBeUndefined();
    });
  });
  
  describe('hasPolicy()', () => {
    it('should return true for registered policy', async () => {
      await registry.register(new MockRewardPolicy(), {
        id: 'test-has',
        name: 'Test',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      expect(registry.hasPolicy('test-has')).toBe(true);
    });
    
    it('should return false for non-existent policy', () => {
      expect(registry.hasPolicy('non-existent')).toBe(false);
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // UNREGISTER TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('unregister()', () => {
    it('should remove registered policy', async () => {
      await registry.register(new MockRewardPolicy(), {
        id: 'test-unregister',
        name: 'Test',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      expect(registry.hasPolicy('test-unregister')).toBe(true);
      
      const result = registry.unregister('test-unregister');
      expect(result).toBe(true);
      expect(registry.hasPolicy('test-unregister')).toBe(false);
    });
    
    it('should return false for non-existent policy', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // STATISTICS TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('getStatistics()', () => {
    it('should calculate statistics correctly', async () => {
      // Register policies
      await registry.register(new MockRewardPolicy(), {
        id: 'payroll-reward-v1',
        name: 'Payroll Reward',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      await registry.register(new MockPenaltyPolicy(), {
        id: 'payroll-penalty-v1',
        name: 'Payroll Penalty',
        version: '1.0.0',
        domain: 'payroll',
        category: 'penalty',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      await registry.register(new MockApprovalPolicy(), {
        id: 'booking-approval-v1',
        name: 'Booking Approval',
        version: '1.0.0',
        domain: 'booking',
        category: 'approval',
        tags: [],
        status: 'experimental',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      await registry.register(new MockRewardPolicy(), {
        id: 'procurement-reward-v1',
        name: 'Procurement Reward',
        version: '1.0.0',
        domain: 'procurement',
        category: 'reward',
        tags: [],
        status: 'deprecated',
        owner: 'test',
        decisionType: 'test',
        className: 'Test',
        description: 'Test',
      });
      
      const stats = registry.getStatistics();
      
      expect(stats.totalPolicies).toBe(4);
      
      expect(stats.byDomain).toEqual({
        payroll: 2,
        booking: 1,
        procurement: 1,
      });
      
      expect(stats.byCategory).toEqual({
        reward: 2,
        penalty: 1,
        approval: 1,
      });
      
      expect(stats.byStatus).toEqual({
        active: 2,
        experimental: 1,
        deprecated: 1,
      });
    });
    
    it('should return zero statistics for empty registry', () => {
      const stats = registry.getStatistics();
      
      expect(stats.totalPolicies).toBe(0);
      expect(stats.byDomain).toEqual({});
      expect(stats.byCategory).toEqual({});
      expect(stats.byStatus).toEqual({
        active: 0,
        experimental: 0,
        deprecated: 0,
      });
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // SINGLETON TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('getInstance()', () => {
    it('should return the same instance', () => {
      const instance1 = PolicyRegistry.getInstance();
      const instance2 = PolicyRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});
