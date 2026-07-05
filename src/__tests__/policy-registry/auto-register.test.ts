/**
 * Auto-Register Tests
 * 
 * Tests for automatic policy registration.
 */

import { PolicyRegistry } from '@/lib/policy-registry/policy-registry';
import { registerAllPolicies, initializeRegistry } from '@/lib/policy-registry/auto-register';

describe('Auto-Register', () => {
  let registry: PolicyRegistry;
  
  beforeEach(() => {
    registry = PolicyRegistry.getInstance();
    registry.clear();
  });
  
  describe('registerAllPolicies()', () => {
    it('should register all 8 existing policies', async () => {
      await registerAllPolicies();
      
      const stats = registry.getStatistics();
      
      expect(stats.totalPolicies).toBe(8);
      
      // Check domain distribution
      expect(stats.byDomain).toEqual({
        payroll: 2,
        booking: 3,
        procurement: 3,
      });
      
      // Check category distribution
      expect(stats.byCategory).toMatchObject({
        reward: 2,
        eligibility: 1,
        recommendation: 1,
        approval: 2,
        validation: 1,
        escalation: 1,
      });
    });
    
    it('should register payroll policies correctly', async () => {
      await registerAllPolicies();
      
      const baseSalary = registry.getPolicy('base-salary-v1');
      expect(baseSalary).toBeDefined();
      expect(baseSalary?.metadata.domain).toBe('payroll');
      expect(baseSalary?.metadata.category).toBe('reward');
      expect(baseSalary?.metadata.decisionType).toBe('base-salary-eligibility');
      
      const compensation = registry.getPolicy('compensation-v1');
      expect(compensation).toBeDefined();
      expect(compensation?.metadata.domain).toBe('payroll');
      expect(compensation?.metadata.category).toBe('reward');
      expect(compensation?.metadata.decisionType).toBe('compensation-eligibility');
    });
    
    it('should register booking policies correctly', async () => {
      await registerAllPolicies();
      
      const eligibility = registry.getPolicy('booking-eligibility-v1');
      expect(eligibility).toBeDefined();
      expect(eligibility?.metadata.domain).toBe('booking');
      expect(eligibility?.metadata.category).toBe('eligibility');
      
      const recommendation = registry.getPolicy('booking-recommendation-v1');
      expect(recommendation).toBeDefined();
      expect(recommendation?.metadata.domain).toBe('booking');
      expect(recommendation?.metadata.category).toBe('recommendation');
      
      const approval = registry.getPolicy('booking-approval-v1');
      expect(approval).toBeDefined();
      expect(approval?.metadata.domain).toBe('booking');
      expect(approval?.metadata.category).toBe('approval');
    });
    
    it('should register procurement policies correctly', async () => {
      await registerAllPolicies();
      
      const validation = registry.getPolicy('procurement-validation-v1');
      expect(validation).toBeDefined();
      expect(validation?.metadata.domain).toBe('procurement');
      expect(validation?.metadata.category).toBe('validation');
      
      const approval = registry.getPolicy('procurement-approval-v1');
      expect(approval).toBeDefined();
      expect(approval?.metadata.domain).toBe('procurement');
      expect(approval?.metadata.category).toBe('approval');
      
      const escalation = registry.getPolicy('procurement-escalation-v1');
      expect(escalation).toBeDefined();
      expect(escalation?.metadata.domain).toBe('procurement');
      expect(escalation?.metadata.category).toBe('escalation');
    });
    
    it('should set all policies to active status', async () => {
      await registerAllPolicies();
      
      const policies = registry.listPolicies();
      
      expect(policies.every(p => p.metadata.status === 'active')).toBe(true);
    });
    
    it('should set owner to bella-core for all policies', async () => {
      await registerAllPolicies();
      
      const policies = registry.listPolicies();
      
      expect(policies.every(p => p.metadata.owner === 'bella-core')).toBe(true);
    });
  });
  
  describe('initializeRegistry()', () => {
    it('should initialize registry on first call', async () => {
      await initializeRegistry();
      
      const stats = registry.getStatistics();
      expect(stats.totalPolicies).toBe(8);
    });
    
    it('should skip registration if already initialized', async () => {
      // First call
      await initializeRegistry();
      const stats1 = registry.getStatistics();
      
      // Second call
      await initializeRegistry();
      const stats2 = registry.getStatistics();
      
      // Should be the same (not doubled)
      expect(stats1.totalPolicies).toBe(stats2.totalPolicies);
      expect(stats2.totalPolicies).toBe(8);
    });
  });
  
  describe('Policy Discovery by Domain', () => {
    it('should allow querying all payroll policies', async () => {
      await registerAllPolicies();
      
      const payrollPolicies = registry.getPoliciesByDomain('payroll');
      
      expect(payrollPolicies).toHaveLength(2);
      expect(payrollPolicies.map(p => p.metadata.id)).toEqual([
        'base-salary-v1',
        'compensation-v1',
      ]);
    });
    
    it('should allow querying all booking policies', async () => {
      await registerAllPolicies();
      
      const bookingPolicies = registry.getPoliciesByDomain('booking');
      
      expect(bookingPolicies).toHaveLength(3);
      expect(bookingPolicies.map(p => p.metadata.id)).toEqual([
        'booking-eligibility-v1',
        'booking-recommendation-v1',
        'booking-approval-v1',
      ]);
    });
    
    it('should allow querying all procurement policies', async () => {
      await registerAllPolicies();
      
      const procurementPolicies = registry.getPoliciesByDomain('procurement');
      
      expect(procurementPolicies).toHaveLength(3);
      expect(procurementPolicies.map(p => p.metadata.id)).toEqual([
        'procurement-validation-v1',
        'procurement-approval-v1',
        'procurement-escalation-v1',
      ]);
    });
  });
  
  describe('Policy Discovery by Category', () => {
    it('should allow querying all reward policies', async () => {
      await registerAllPolicies();
      
      const rewardPolicies = registry.getPoliciesByCategory('reward');
      
      expect(rewardPolicies).toHaveLength(2);
      expect(rewardPolicies.every(p => p.metadata.domain === 'payroll')).toBe(true);
    });
    
    it('should allow querying all approval policies', async () => {
      await registerAllPolicies();
      
      const approvalPolicies = registry.getPoliciesByCategory('approval');
      
      expect(approvalPolicies).toHaveLength(2);
      expect(approvalPolicies.map(p => p.metadata.domain).sort()).toEqual([
        'booking',
        'procurement',
      ]);
    });
  });
  
  describe('Policy Discovery by Tags', () => {
    it('should find policies by salary tag', async () => {
      await registerAllPolicies();
      
      const salaryPolicies = registry.listPolicies({ tags: ['salary'] });
      
      expect(salaryPolicies).toHaveLength(2);
      expect(salaryPolicies.every(p => p.metadata.domain === 'payroll')).toBe(true);
    });
    
    it('should find policies by workflow tag', async () => {
      await registerAllPolicies();
      
      const workflowPolicies = registry.listPolicies({ tags: ['workflow'] });
      
      expect(workflowPolicies).toHaveLength(3);
      expect(workflowPolicies.map(p => p.metadata.domain).sort()).toEqual([
        'booking',
        'procurement',
        'procurement',
      ]);
    });
  });
});
