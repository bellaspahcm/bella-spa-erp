/**
 * Integration Tests - Decision Engine Platform
 * 
 * End-to-end tests verifying complete decision evaluation flow.
 * Tests: Engine + Registry + Providers + Types + Events + Logging
 * 
 * ⚠️ DEPRECATED: This test suite uses old decision engine architecture.
 * Will be removed after migration to new provider-based architecture is complete.
 * 
 * See: docs/decision-engine/MIGRATION_GUIDE.md
 */

// Commented out imports - old architecture modules removed
// import { bootstrapForTesting } from '../bootstrap';
// import type { DecisionEngine } from '../core';
// import type { DecisionContext } from '../types';
// import { RuleProvider } from '../providers/RuleProvider';

describe.skip('Decision Engine Platform - Integration (OLD ARCHITECTURE - DEPRECATED)', () => {
  // All test code commented out - deprecated architecture
  // See new provider-based tests in:
  // - src/lib/decision-engine/providers/*/__tests__/*.test.ts
  
  it.skip('placeholder test', () => {
    // Old architecture tests removed
  });
  
  /*
  let engine: DecisionEngine;
  let eventLog: Array<{ type: string; data: any }> = [];

  beforeEach(() => {
    eventLog = [];
    
    // Bootstrap with testing config
    const { engine: testEngine, eventPublisher } = bootstrapForTesting();
    engine = testEngine;

    // Capture events for verification
    const originalPublish = eventPublisher.publish.bind(eventPublisher);
    eventPublisher.publish = async (event: any) => {
      eventLog.push(event);
      return originalPublish(event);
    };
  });

  describe('Simple Rule Evaluation', () => {
    it('should evaluate simple approval rule end-to-end', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          id: 'auto-approve-small-amount',
          description: 'Auto-approve bookings under 5 million VND',
          condition: {
            field: 'amount',
            operator: '<',
            value: 5000000,
          },
          action: {
            approve: true,
            reason: 'Small amount - auto approved',
          },
        },
        data: {
          bookingId: 'BK-001',
          customerId: 'CUST-123',
          amount: 3000000,
          packageType: 'massage',
        },
        user: {
          id: 'user-001',
          role: 'receptionist',
        },
        correlationId: 'test-correlation-001',
      };

      const result = await engine.evaluate(context);

      // Verify result structure
      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.provider).toBe('RuleProvider');
      expect(result.matchedRules).toContain('auto-approve-small-amount');
      expect(result.reason).toContain('matched');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.correlationId).toBe('test-correlation-001');

      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rule).toBeDefined();

      // Verify event was published
      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].type).toBe('decision.evaluated');
      expect(eventLog[0].data.approved).toBe(true);
      expect(eventLog[0].data.provider).toBe('RuleProvider');
    });

    it('should reject when rule condition not met', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: {
            field: 'amount',
            operator: '<',
            value: 5000000,
          },
          action: {
            approve: true,
          },
        },
        data: {
          amount: 10000000, // Above threshold
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('not matched');
    });
  });

  describe('Complex Rule Evaluation', () => {
    it('should evaluate multi-condition AND rule', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'vip-approval',
        ruleType: 'if-then',
        rule: {
          description: 'VIP customers with good history get auto-approval',
          condition: {
            and: [
              { field: 'customer.tier', operator: '==', value: 'vip' },
              { field: 'customer.completedBookings', operator: '>', value: 10 },
              { field: 'amount', operator: '<', value: 20000000 },
            ],
          },
          action: {
            approve: true,
          },
        },
        data: {
          customer: {
            tier: 'vip',
            completedBookings: 15,
            name: 'Nguyễn Thị Mai',
          },
          amount: 15000000,
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should evaluate multi-condition OR rule', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'fast-track-approval',
        ruleType: 'if-then',
        rule: {
          condition: {
            or: [
              { field: 'customer.tier', operator: '==', value: 'vip' },
              { field: 'amount', operator: '<', value: 2000000 },
              { field: 'isRepeatCustomer', operator: '==', value: true },
            ],
          },
          action: {
            approve: true,
          },
        },
        data: {
          customer: { tier: 'regular' },
          amount: 5000000,
          isRepeatCustomer: true, // This makes it pass
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
    });

    it('should evaluate nested logical conditions', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'complex-approval',
        ruleType: 'if-then',
        rule: {
          condition: {
            or: [
              { field: 'amount', operator: '<', value: 2000000 },
              {
                and: [
                  { field: 'customer.tier', operator: '==', value: 'vip' },
                  { field: 'customer.creditLimit', operator: '>', value: 50000000 },
                ],
              },
            ],
          },
          action: {
            approve: true,
          },
        },
        data: {
          amount: 10000000,
          customer: {
            tier: 'vip',
            creditLimit: 100000000,
          },
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
    });
  });

  describe('Real-world Business Scenarios', () => {
    it('should approve beauty spa booking with package discount', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'package-discount-approval',
        ruleType: 'if-then',
        rule: {
          id: 'package-discount-5sessions',
          description: 'Auto-approve 5% discount for packages with 5+ sessions',
          condition: {
            and: [
              { field: 'package.sessionCount', operator: '>=', value: 5 },
              { field: 'discount.percentage', operator: '<=', value: 5 },
            ],
          },
          action: {
            approve: true,
          },
        },
        data: {
          package: {
            id: 'PKG-FACIAL-PREMIUM',
            name: 'Premium Facial Care Package',
            sessionCount: 10,
            totalAmount: 15000000,
          },
          discount: {
            percentage: 5,
            amount: 750000,
          },
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.matchedRules).toContain('package-discount-5sessions');
    });

    it('should approve KTV overtime if within weekly limit', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'attendance',
        decisionType: 'overtime-approval',
        ruleType: 'if-then',
        rule: {
          description: 'Auto-approve overtime if within 8 hours per week',
          condition: {
            and: [
              { field: 'overtime.hoursThisWeek', operator: '<', value: 8 },
              { field: 'ktv.performance.rating', operator: '>=', value: 4.0 },
            ],
          },
          action: {
            approve: true,
          },
        },
        data: {
          ktv: {
            id: 'KTV-012',
            name: 'Trần Thị Hoa',
            performance: {
              rating: 4.5,
              completedSessions: 120,
            },
          },
          overtime: {
            requestedHours: 3,
            hoursThisWeek: 5, // Total will be 8
            date: '2026-06-20',
          },
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
    });

    it('should reject expense claim above delegation limit', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'finance',
        decisionType: 'expense-approval',
        ruleType: 'if-then',
        rule: {
          description: 'Manager can approve expenses up to 10 million VND',
          condition: {
            and: [
              { field: 'expense.amount', operator: '<=', value: 10000000 },
              { field: 'approver.role', operator: '==', value: 'manager' },
              { field: 'expense.category', operator: 'in', value: ['supplies', 'maintenance', 'utilities'] },
            ],
          },
          action: {
            approve: true,
          },
        },
        data: {
          expense: {
            id: 'EXP-2026-001',
            amount: 15000000, // Above limit
            category: 'supplies',
            description: 'Massage oil and towels bulk purchase',
          },
          approver: {
            id: 'MGR-001',
            role: 'manager',
            name: 'Lê Văn Quản',
          },
        },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('not matched');
    });
  });

  describe('Error Handling', () => {
    it('should return fallback result when provider not found', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'unsupported-rule-type',
        rule: {},
        data: {},
      };

      const result = await engine.evaluate(context);

      expect(result.isFallback).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should handle invalid rule structure', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'if-then',
        rule: {
          // Missing condition and action
        },
        data: {},
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing data fields gracefully', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'if-then',
        rule: {
          condition: {
            field: 'nonexistent.field',
            operator: '==',
            value: 'test',
          },
          action: {
            approve: true,
          },
        },
        data: {},
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should evaluate simple rule in under 50ms', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000 },
          action: { approve: true },
        },
        data: { amount: 3000 },
      };

      const result = await engine.evaluate(context);

      expect(result.executionTime).toBeLessThan(50);
    });

    it('should evaluate complex nested rule in under 100ms', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'if-then',
        rule: {
          condition: {
            and: [
              {
                or: [
                  { field: 'a', operator: '>', value: 10 },
                  { field: 'b', operator: '<', value: 5 },
                ],
              },
              {
                or: [
                  { field: 'c', operator: '==', value: 'test' },
                  { field: 'd', operator: '!=', value: 'invalid' },
                ],
              },
              { field: 'e', operator: 'in', value: ['x', 'y', 'z'] },
            ],
          },
          action: { approve: true },
        },
        data: { a: 15, b: 10, c: 'test', d: 'valid', e: 'x' },
      };

      const result = await engine.evaluate(context);

      expect(result.executionTime).toBeLessThan(100);
    });
  });

  describe('Event Publishing', () => {
    it('should publish event with complete context and result', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
        user: {
          id: 'user-001',
          role: 'receptionist',
        },
        correlationId: 'test-123',
      };

      await engine.evaluate(context);

      expect(eventLog).toHaveLength(1);
      const event = eventLog[0];

      expect(event.type).toBe('decision.evaluated');
      expect(event.data.tenantId).toBe('bella-spa-vn');
      expect(event.data.module).toBe('booking');
      expect(event.data.decisionType).toBe('approval');
      expect(event.data.correlationId).toBe('test-123');
      expect(event.data.approved).toBe(true);
      expect(event.data.provider).toBe('RuleProvider');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.userRole).toBe('receptionist');
    });

    it('should publish event for rejected decisions', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000 },
          action: { approve: true },
        },
        data: { amount: 10000 },
      };

      await engine.evaluate(context);

      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].data.approved).toBe(false);
    });
  });

  describe('Multi-tenant Support', () => {
    it('should handle different tenant contexts', async () => {
      const contexts: DecisionContext[] = [
        {
          tenantId: 'bella-spa-hanoi',
          module: 'booking',
          decisionType: 'approval',
          ruleType: 'if-then',
          rule: {
            condition: { field: 'amount', operator: '<', value: 5000000 },
            action: { approve: true },
          },
          data: { amount: 3000000 },
        },
        {
          tenantId: 'bella-spa-saigon',
          module: 'booking',
          decisionType: 'approval',
          ruleType: 'if-then',
          rule: {
            condition: { field: 'amount', operator: '<', value: 5000000 },
            action: { approve: true },
          },
          data: { amount: 3000000 },
        },
      ];

      for (const context of contexts) {
        const result = await engine.evaluate(context);
        expect(result.approved).toBe(true);
      }

      // Verify both tenant events were published
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].data.tenantId).toBe('bella-spa-hanoi');
      expect(eventLog[1].data.tenantId).toBe('bella-spa-saigon');
    });
  });

  describe('Bootstrap Configuration', () => {
    it('should have RuleProvider registered', () => {
      const { registry } = bootstrapForTesting();

      expect(registry.hasProvider('if-then')).toBe(true);
      expect(registry.hasProvider('decision-table')).toBe(true);
      expect(registry.hasProvider('decision-tree')).toBe(true);

      const provider = registry.getProvider('if-then');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('RuleProvider');
    });

    it('should support adding custom providers', () => {
      const { registry } = bootstrapForTesting();

      // Custom provider
      class CustomProvider extends RuleProvider {
        constructor() {
          super();
          this.name = 'CustomProvider';
        }
      }

      registry.register(new CustomProvider(), {
        overrideRuleTypes: ['custom-rule'],
      });

      expect(registry.hasProvider('custom-rule')).toBe(true);
      const provider = registry.getProvider('custom-rule');
      expect(provider?.name).toBe('CustomProvider');
    });
  });
  */
});
