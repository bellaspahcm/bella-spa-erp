/**
 * E7.3 Phase 1 — Rule Contract Tests
 * 
 * Tests for Rule interface, RuleResult types, and helpers.
 */

import { describe, it, expect } from '@jest/globals';
import type { Rule, RuleResult } from '../rule.types';
import { RuleViolationCodes } from '../rule.types';
import { pass, violation, createViolation, createEvidence } from '../rule.helpers';

describe('E7.3 Phase 1 — Rule Contract', () => {
  describe('Rule Interface', () => {
    it('should define Rule<TContext> contract', () => {
      // Arrange: Define a simple rule implementation
      interface TestContext {
        value: number;
      }

      class TestRule implements Rule<TestContext> {
        readonly id = 'TEST_RULE';
        readonly version = '1.0.0';
        readonly description = 'Test rule for contract verification';

        evaluate(context: TestContext): RuleResult {
          const evidence = createEvidence(
            { value: context.value },
            { is_positive: context.value > 0 }
          );

          if (context.value > 0) {
            return pass(this.id, this.version, evidence);
          }

          return violation(
            this.id,
            this.version,
            createViolation('VALUE_NOT_POSITIVE', 'Value must be positive'),
            evidence
          );
        }
      }

      // Act
      const rule = new TestRule();

      // Assert: Rule implements contract
      expect(rule.id).toBe('TEST_RULE');
      expect(rule.version).toBe('1.0.0');
      expect(rule.description).toBeTruthy();
      expect(typeof rule.evaluate).toBe('function');
    });

    it('should enforce readonly properties', () => {
      // Arrange
      interface TestContext {
        value: number;
      }

      class TestRule implements Rule<TestContext> {
        readonly id = 'TEST_RULE';
        readonly version = '1.0.0';
        readonly description = 'Test';

        evaluate(context: TestContext): RuleResult {
          return pass(this.id, this.version, createEvidence({ value: context.value }, {}));
        }
      }

      // Act
      const rule = new TestRule();

      // Assert: TypeScript enforces readonly (compile-time check)
      // @ts-expect-error - Cannot assign to 'id' because it is a read-only property
      rule.id = 'CHANGED';
    });
  });

  describe('RulePass', () => {
    it('should create PASS result with evidence', () => {
      // Arrange
      const ruleId = 'TEST_RULE';
      const version = '1.0.0';
      const evidence = createEvidence({ value: 10 }, { is_valid: true });
      const evaluatedAt = new Date('2026-08-22T10:00:00Z');

      // Act
      const result = pass(ruleId, version, evidence, evaluatedAt);

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.ruleId).toBe(ruleId);
      expect(result.version).toBe(version);
      expect(result.evaluatedAt).toEqual(evaluatedAt);
      expect(result.evidence).toEqual(evidence);
    });

    it('should use current date if evaluatedAt not provided', () => {
      // Arrange
      const before = new Date();
      const evidence = createEvidence({}, {});

      // Act
      const result = pass('TEST', '1.0.0', evidence);

      // Assert
      const after = new Date();
      expect(result.evaluatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.evaluatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('RuleViolation', () => {
    it('should create VIOLATION result with detail and evidence', () => {
      // Arrange
      const ruleId = 'EXPIRY_RULE';
      const version = '1.0.0';
      const violationDetail = createViolation(
        RuleViolationCodes.INVENTORY_EXPIRED,
        'Inventory expired',
        'ERROR',
        {
          field: 'expiry_date',
          actual: '2026-08-20',
          expected: '>= 2026-08-22',
        }
      );
      const evidence = createEvidence(
        { expiry_date: '2026-08-20', evaluation_date: '2026-08-22' },
        { is_expired: true }
      );
      const evaluatedAt = new Date('2026-08-22T10:00:00Z');

      // Act
      const result = violation(ruleId, version, violationDetail, evidence, evaluatedAt);

      // Assert
      expect(result.status).toBe('VIOLATION');
      expect(result.ruleId).toBe(ruleId);
      expect(result.version).toBe(version);
      expect(result.evaluatedAt).toEqual(evaluatedAt);
      expect(result.violation).toEqual(violationDetail);
      expect(result.evidence).toEqual(evidence);
    });

    it('should include typed violation code', () => {
      // Arrange
      const violationDetail = createViolation(
        RuleViolationCodes.INSUFFICIENT_AVAILABLE_QUANTITY,
        'Insufficient quantity'
      );

      // Act & Assert
      expect(violationDetail.code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');
      expect(RuleViolationCodes.INSUFFICIENT_AVAILABLE_QUANTITY).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');
    });
  });

  describe('ViolationDetail', () => {
    it('should create violation with required fields', () => {
      // Act
      const detail = createViolation('TEST_CODE', 'Test message');

      // Assert
      expect(detail.code).toBe('TEST_CODE');
      expect(detail.message).toBe('Test message');
      expect(detail.severity).toBe('ERROR');
    });

    it('should create violation with WARNING severity', () => {
      // Act
      const detail = createViolation('TEST_CODE', 'Test warning', 'WARNING');

      // Assert
      expect(detail.severity).toBe('WARNING');
    });

    it('should include optional fields', () => {
      // Act
      const detail = createViolation('TEST_CODE', 'Test message', 'ERROR', {
        field: 'quantity',
        actual: -5,
        expected: '> 0',
      });

      // Assert
      expect(detail.field).toBe('quantity');
      expect(detail.actual).toBe(-5);
      expect(detail.expected).toBe('> 0');
    });
  });

  describe('RuleEvidence', () => {
    it('should create evidence with input and output', () => {
      // Act
      const evidence = createEvidence(
        { inventory_id: 'INV-001', expiry_date: '2026-08-20' },
        { is_expired: true, days_past_expiry: 2 }
      );

      // Assert
      expect(evidence.input).toEqual({
        inventory_id: 'INV-001',
        expiry_date: '2026-08-20',
      });
      expect(evidence.output).toEqual({
        is_expired: true,
        days_past_expiry: 2,
      });
      expect(evidence.metadata).toBeUndefined();
    });

    it('should include optional metadata', () => {
      // Act
      const evidence = createEvidence(
        { value: 10 },
        { is_valid: true },
        { rule_version: '1.0.0', execution_time_ms: 5 }
      );

      // Assert
      expect(evidence.metadata).toEqual({
        rule_version: '1.0.0',
        execution_time_ms: 5,
      });
    });
  });

  describe('Rule Determinism (Invariant 3)', () => {
    it('should return identical results for same context', () => {
      // Arrange
      interface TestContext {
        value: number;
        evaluationDate: Date;
      }

      class DeterministicRule implements Rule<TestContext> {
        readonly id = 'DETERMINISTIC_RULE';
        readonly version = '1.0.0';
        readonly description = 'Deterministic test rule';

        evaluate(context: TestContext): RuleResult {
          const evidence = createEvidence(
            {
              value: context.value,
              evaluation_date: context.evaluationDate.toISOString(),
            },
            { is_positive: context.value > 0 }
          );

          if (context.value > 0) {
            return pass(this.id, this.version, evidence, context.evaluationDate);
          }

          return violation(
            this.id,
            this.version,
            createViolation('VALUE_NEGATIVE', 'Value must be positive'),
            evidence,
            context.evaluationDate
          );
        }
      }

      const rule = new DeterministicRule();
      const context: TestContext = {
        value: 10,
        evaluationDate: new Date('2026-08-22T10:00:00Z'),
      };

      // Act
      const result1 = rule.evaluate(context);
      const result2 = rule.evaluate(context);

      // Assert: Identical results (determinism)
      expect(result1.status).toBe(result2.status);
      expect(result1.ruleId).toBe(result2.ruleId);
      expect(result1.version).toBe(result2.version);
      expect(result1.evaluatedAt).toEqual(result2.evaluatedAt);
      expect(result1.evidence).toEqual(result2.evidence);
    });
  });

  describe('RuleViolationCodes', () => {
    it('should define generic violation codes', () => {
      // Assert: All expected codes defined
      expect(RuleViolationCodes.INVENTORY_EXPIRED).toBe('INVENTORY_EXPIRED');
      expect(RuleViolationCodes.QUANTITY_MUST_BE_POSITIVE).toBe('QUANTITY_MUST_BE_POSITIVE');
      expect(RuleViolationCodes.INSUFFICIENT_AVAILABLE_QUANTITY).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');
      expect(RuleViolationCodes.INSUFFICIENT_RESERVED_QUANTITY).toBe('INSUFFICIENT_RESERVED_QUANTITY');
      expect(RuleViolationCodes.LOT_NUMBER_REQUIRED).toBe('LOT_NUMBER_REQUIRED');
      expect(RuleViolationCodes.SERIAL_NUMBER_REQUIRED).toBe('SERIAL_NUMBER_REQUIRED');
      expect(RuleViolationCodes.BROKEN_TRACEABILITY_CHAIN).toBe('BROKEN_TRACEABILITY_CHAIN');
      expect(RuleViolationCodes.COMPLIANCE_VIOLATION).toBe('COMPLIANCE_VIOLATION');
    });

    it('should have machine-readable format (uppercase, underscores)', () => {
      // Assert
      Object.values(RuleViolationCodes).forEach(code => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe('Boundary Test: RuleResult is Data, Not Command (Invariant 17)', () => {
    it('should NOT contain workflow command fields', () => {
      // Arrange
      const result = pass('TEST', '1.0.0', createEvidence({}, {}));

      // Assert: No command/action/workflow fields
      expect('command' in result).toBe(false);
      expect('action' in result).toBe(false);
      expect('workflow' in result).toBe(false);
      expect('task' in result).toBe(false);
      expect('notification' in result).toBe(false);
    });

    it('should NOT contain workflow command fields in violation', () => {
      // Arrange
      const result = violation(
        'TEST',
        '1.0.0',
        createViolation('TEST_CODE', 'Test'),
        createEvidence({}, {})
      );

      // Assert: No command/action/workflow fields
      expect('command' in result).toBe(false);
      expect('action' in result).toBe(false);
      expect('workflow' in result).toBe(false);
      expect('quarantine' in result).toBe(false);
      expect('notify' in result).toBe(false);
    });
  });
});
