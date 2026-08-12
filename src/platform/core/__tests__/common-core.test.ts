/**
 * Common Core Unit Tests
 * 
 * Validates that all domain-agnostic primitives in src/platform/core operate in isolation with zero external dependencies.
 */

import {
  MemoryEventBusAdapter,
  CoreContractRegistry,
  DefaultTenantContextPrimitive,
  ExceptionMapper,
  UniqueConstraintViolationError,
  OptimisticLockError,
  IdempotentExecutionHandler,
  AuditTrailPrimitive,
} from '../index';

describe('Common Core Primitives - Isolation Unit Tests', () => {
  // 1. Event Bus Port
  describe('EventBusPort & MemoryEventBusAdapter', () => {
    it('should publish and receive domain events cleanly', async () => {
      const bus = new MemoryEventBusAdapter();
      const received: any[] = [];

      bus.subscribe('test.event.v1', async (evt) => {
        received.push(evt);
      });

      await bus.publish({
        eventId: 'evt-100',
        eventType: 'test.event.v1',
        eventVersion: 'v1',
        tenantId: 'tenant-1',
        aggregateId: 'agg-1',
        aggregateType: 'test',
        occurredAt: new Date().toISOString(),
        payload: { message: 'hello core' },
      });

      expect(received).toHaveLength(1);
      expect(received[0].payload.message).toBe('hello core');
    });
  });

  // 2. Platform Contract Registry
  describe('PlatformContractRegistry', () => {
    it('should register and resolve contracts by name', () => {
      const registry = new CoreContractRegistry();
      const dummyService = { execute: () => 'ok' };

      registry.registerContract('dummy-contract', dummyService, { version: '1.0.0' });

      expect(registry.hasContract('dummy-contract')).toBe(true);
      const resolved = registry.getContract<typeof dummyService>('dummy-contract');
      expect(resolved.execute()).toBe('ok');
    });
  });

  // 3. Tenant Context Primitive
  describe('TenantContextPrimitive', () => {
    it('should manage tenant context scoping accurately', async () => {
      const tenantPrimitive = new DefaultTenantContextPrimitive();
      expect(tenantPrimitive.getTenantId()).toBeUndefined();

      await tenantPrimitive.runInTenantContext({ tenantId: 'tenant-abc' }, async () => {
        expect(tenantPrimitive.getTenantId()).toBe('tenant-abc');
        expect(tenantPrimitive.requireTenantId()).toBe('tenant-abc');
      });

      expect(tenantPrimitive.getTenantId()).toBeUndefined();
    });
  });

  // 4. Exception Mapper & Concurrency Primitives
  describe('ExceptionMapper', () => {
    it('should map Postgres error 23505 to UniqueConstraintViolationError', () => {
      const err = ExceptionMapper.mapDatabaseError({ code: '23505', message: 'duplicate key' });
      expect(err).toBeInstanceOf(UniqueConstraintViolationError);
    });

    it('should throw OptimisticLockError when affectedRows === 0', () => {
      expect(() => {
        ExceptionMapper.checkOptimisticLock(0, 1, 'entity-123');
      }).toThrow(OptimisticLockError);
    });
  });

  // 5. Idempotent Execution Handler
  describe('IdempotentExecutionHandler', () => {
    it('should intercept duplicate operations with generalized IdempotencyKey', async () => {
      const handler = new IdempotentExecutionHandler();
      const key = { tenantId: 'tenant-1', operation: 'TEST_OP', businessKey: 'req-999' };

      let callCount = 0;
      const op = async () => {
        callCount++;
        return { result: 'success' };
      };

      const res1 = await handler.execute(key, op);
      expect(res1.isDuplicate).toBe(false);
      expect(res1.data.result).toBe('success');

      const res2 = await handler.execute(key, op);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.data.result).toBe('success');
      expect(callCount).toBe(1);
    });
  });

  // 6. Audit Trail Primitive
  describe('AuditTrailPrimitive', () => {
    it('should stamp technical audit fields correctly', () => {
      const audit = AuditTrailPrimitive.createAuditFields({ tenantId: 't-1', userId: 'u-1' });
      expect(audit.tenantId).toBe('t-1');
      expect(audit.createdBy).toBe('u-1');
      expect(audit.updatedBy).toBe('u-1');
      expect(audit.createdAt).toBeDefined();
    });
  });
});
