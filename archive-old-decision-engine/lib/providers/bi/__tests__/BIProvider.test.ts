/**
 * BIProvider Integration Tests
 * 
 * Tests BIProvider with MockBIClient to verify end-to-end functionality.
 */

import { InMemoryEventPublisher } from '@/lib/events/publishers/InMemoryEventPublisher';
import { NoOpLogger } from '@/lib/logger';
import { DecisionEngine } from '../../../core/DecisionEngine';
import { createProviderRegistry } from '../../../core/DecisionProviderRegistry';
import type { DecisionContext } from '../../../types';
import { BIProvider, createBIProvider } from '../BIProvider';
import { MockBIClient } from '../clients/MockBIClient';
import { aggregation, threshold } from '../QueryBuilder';

describe('BIProvider', () => {
  let client: MockBIClient;
  let provider: BIProvider;

  beforeEach(() => {
    client = new MockBIClient({
      type: 'postgresql',
      database: 'test_db',
    });
  });

  afterEach(async () => {
    if (provider) {
      await provider.close();
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create provider with default config', () => {
      provider = new BIProvider({ client });
      expect(provider.name).toBe('BIProvider');
      expect(provider.supportedRuleTypes).toContain('aggregation');
    });

    it('should create provider with custom config', () => {
      provider = new BIProvider({
        client,
        defaultTimeout: 60000,
        enableCaching: false,
        maxRows: 5000,
      });

      const config = provider.getConfig();
      expect(config.defaultTimeout).toBe(60000);
      expect(config.enableCaching).toBe(false);
      expect(config.maxRows).toBe(5000);
    });

    it('should create via factory function', () => {
      provider = createBIProvider({ client });
      expect(provider).toBeInstanceOf(BIProvider);
    });
  });

  describe('Query Execution - COUNT', () => {
    beforeEach(async () => {
      // Seed mock data
      client.setMockData('bookings', [
        { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
        { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
        { id: 3, customer_id: 123, status: 'pending', amount: 500000 },
        { id: 4, customer_id: 456, status: 'approved', amount: 3000000 },
      ]);

      await client.connect();
      provider = createBIProvider({ client });
    });

    it('should approve when count meets threshold', async () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'loyalty-check',
        ruleType: 'aggregation',
        rule: {
          query: aggregation()
            .table('bookings')
            .count()
            .where('customer_id', 123)
            .where('status', 'approved')
            .build(),
          threshold: threshold().gte(2).build(),
          description: 'Approved bookings count',
        },
        data: { customerId: 123 },
      };

      const result = await provider.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.reason).toContain('2');
      expect(result.reason).toContain('APPROVED');
      expect(result.metadata?.biResult).toBe(2);
    });

    it('should reject when count below threshold', async () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'loyalty-check',
        ruleType: 'aggregation',
        rule: {
          query: aggregation()
            .table('bookings')
            .count()
            .where('customer_id', 456)
            .where('status', 'approved')
            .build(),
          threshold: threshold().gte(5).build(),
        },
        data: { customerId: 456 },
      };

      const result = await provider.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.metadata?.biResult).toBe(1);
    });
  });

  describe('Query Execution - SUM', () => {
    beforeEach(async () => {
      client.setMockData('bookings', [
        { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
        { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
        { id: 3, customer_id: 123, status: 'approved', amount: 3000000 },
      ]);

      await client.connect();
      provider = createBIProvider({ client });
    });

    it('should calculate SUM correctly', async () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'spending-threshold',
        ruleType: 'aggregation',
        rule: {
          query: aggregation()
            .table('bookings')
            .sum('amount')
            .where('customer_id', 123)
            .where('status', 'approved')
            .build(),
          threshold: threshold().gte(5000000).build(),
        },
        data: { customerId: 123 },
      };

      const result = await provider.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.metadata?.biResult).toBe(6000000);
    });
  });

  describe('Query Execution - AVG', () => {
    beforeEach(async () => {
      client.setMockData('bookings', [
        { id: 1, customer_id: 123, amount: 1000000 },
        { id: 2, customer_id: 123, amount: 2000000 },
        { id: 3, customer_id: 123, amount: 3000000 },
      ]);

      await client.connect();
      provider = createBIProvider({ client });
    });

    it('should calculate AVG correctly', async () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'average-check',
        ruleType: 'aggregation',
        rule: {
          query: aggregation()
            .table('bookings')
            .avg('amount')
            .where('customer_id', 123)
            .build(),
          threshold: threshold().gte(1500000).build(),
        },
        data: { customerId: 123 },
      };

      const result = await provider.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.metadata?.biResult).toBe(2000000);
    });
  });

  describe('Threshold Operators', () => {
    beforeEach(async () => {
      client.setMockData('metrics', [{ value: 100 }]);
      await client.connect();
      provider = createBIProvider({ client });
    });

    it('should handle > operator', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('metrics').count().build(),
          threshold: threshold().gt(0).build(),
        },
        data: {},
      };

      const result = await provider.evaluate(context);
      expect(result.approved).toBe(true);
    });

    it('should handle < operator', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('metrics').count().build(),
          threshold: threshold().lt(5).build(),
        },
        data: {},
      };

      const result = await provider.evaluate(context);
      expect(result.approved).toBe(true);
    });

    it('should handle = operator', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('metrics').count().build(),
          threshold: threshold().eq(1).build(),
        },
        data: {},
      };

      const result = await provider.evaluate(context);
      expect(result.approved).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await client.connect();
      provider = createBIProvider({ client });
    });

    it('should handle query execution errors', async () => {
      client.simulateFailure('Database connection lost');

      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('bookings').count().build(),
          threshold: threshold().gte(1).build(),
        },
        data: {},
      };

      const result = await provider.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('BI_QUERY_ERROR');
    });

    it('should handle invalid rule structure', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: { invalid: 'structure' }, // Missing query and threshold
        data: {},
      };

      const result = await provider.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    beforeEach(() => {
      provider = createBIProvider({ client });
    });

    it('should handle supported rule types', () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('test').count().build(),
          threshold: threshold().gte(1).build(),
        },
        data: {},
      };

      expect(provider.canHandle(context)).toBe(true);
    });

    it('should reject unsupported rule types', () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'unsupported-type',
        rule: {},
        data: {},
      };

      expect(provider.canHandle(context)).toBe(false);
    });

    it('should reject invalid rule structure', () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: { invalid: 'rule' },
        data: {},
      };

      expect(provider.canHandle(context)).toBe(false);
    });
  });

  describe('Integration with DecisionEngine', () => {
    let engine: DecisionEngine;

    beforeEach(async () => {
      client.setMockData('bookings', [
        { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
        { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
      ]);

      await client.connect();

      provider = createBIProvider({ client });

      const registry = createProviderRegistry();
      registry.register(provider);

      engine = new DecisionEngine({
        registry,
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });
    });

    it('should work seamlessly with DecisionEngine', async () => {
      const context: DecisionContext = {
        tenantId: 'bella-spa-vn',
        module: 'booking',
        decisionType: 'loyalty-tier',
        ruleType: 'aggregation',
        rule: {
          query: aggregation()
            .table('bookings')
            .count()
            .where('customer_id', 123)
            .where('status', 'approved')
            .build(),
          threshold: threshold().gte(2).build(),
          description: 'VIP customer check',
        },
        data: { customerId: 123 },
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.provider).toBe('BIProvider');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calculation', () => {
    beforeEach(async () => {
      client.setMockData('metrics', [{ value: 100 }]);
      await client.connect();
      provider = createBIProvider({ client });
    });

    it('should have base confidence of 0.9', async () => {
      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('metrics').count().build(),
          threshold: threshold().gte(1).build(),
        },
        data: {},
      };

      const result = await provider.evaluate(context);
      expect(result.confidence).toBe(0.9);
    });

    it('should reduce confidence for slow queries', async () => {
      client.setQueryDelay(15000); // 15 seconds

      const context: DecisionContext = {
        tenantId: 'test',
        module: 'test',
        decisionType: 'test',
        ruleType: 'aggregation',
        rule: {
          query: aggregation().table('metrics').count().build(),
          threshold: threshold().gte(1).build(),
        },
        data: {},
      };

      const result = await provider.evaluate(context);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });
});
