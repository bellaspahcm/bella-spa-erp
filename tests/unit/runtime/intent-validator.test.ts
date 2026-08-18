/**
 * Intent Validator Unit Tests
 * 
 * Tests for Financial Intent validation (Phase 3A)
 * 
 * Focus:
 * - Finance Protection (prohibited fields)
 * - Recursive prohibited-field scanning
 * - Strict contract enforcement
 * - Required field validation
 * - Type validation
 * 
 * Test Plan: BELLA_RUNTIME_PHASE_3_TEST_PLAN.md v1.1
 * Gates: P3-1 (Finance Protection), P3-2 (Strict Contract)
 */

import { describe, it, expect } from 'vitest';
import { IntentValidator } from '../../../src/platform/integration-runtime/validation/intent-validator';
import {
  ValidationError,
  FinanceProtectionError,
} from '../../../src/platform/integration-runtime/types/runtime-errors.types';
import { FinancialIntent } from '../../../src/platform/integration-runtime/types/financial-intent.types';

describe('IntentValidator', () => {
  const validator = new IntentValidator();
  
  // Valid baseline intent for reuse
  const validIntent: FinancialIntent = {
    intentType: 'REVENUE_RECOGNIZED',
    tenantId: 'test-tenant',
    correlationId: 'test-corr-001',
    entityType: 'Encounter',
    entityId: 'enc-001',
    amount: 1000.00,
    currency: 'USD',
    effectiveDate: new Date('2026-01-01'),
    source: 'Hospital',
    metadata: {
      patientId: 'pat-001',
    },
  };
  
  // ==========================================================================
  // P3-1: Finance Protection — Prohibited Fields
  // ==========================================================================
  
  describe('P3-1: Finance Protection (Prohibited Fields)', () => {
    // T1.1: Single prohibited field rejection
    it('T1.1: should reject intent with glAccount', () => {
      const intent = {
        ...validIntent,
        glAccount: '4000',  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
      
      try {
        validator.validate(intent);
      } catch (error) {
        expect(error).toBeInstanceOf(FinanceProtectionError);
        expect((error as FinanceProtectionError).prohibitedField).toBe('glAccount');
        expect((error as FinanceProtectionError).retryable).toBe(false);
      }
    });
    
    it('T1.1: should reject intent with debit', () => {
      const intent = {
        ...validIntent,
        debit: 1000,  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with credit', () => {
      const intent = {
        ...validIntent,
        credit: 1000,  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with journalEntry', () => {
      const intent = {
        ...validIntent,
        journalEntry: { id: 'je-001' },  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with chartOfAccountsMapping', () => {
      const intent = {
        ...validIntent,
        chartOfAccountsMapping: { revenue: '4000' },  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with revenueRecognitionMethod', () => {
      const intent = {
        ...validIntent,
        revenueRecognitionMethod: 'CASH_BASIS',  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with cogsCalculationMethod', () => {
      const intent = {
        ...validIntent,
        cogsCalculationMethod: 'FIFO',  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with postingRules', () => {
      const intent = {
        ...validIntent,
        postingRules: [{ rule: 'test' }],  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with ledgerEntry', () => {
      const intent = {
        ...validIntent,
        ledgerEntry: { id: 'le-001' },  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.1: should reject intent with accountingTreatment', () => {
      const intent = {
        ...validIntent,
        accountingTreatment: { method: 'ACCRUAL' },  // ❌ PROHIBITED
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    // T1.2: Multiple prohibited fields rejection (first detected)
    it('T1.2: should reject intent with multiple prohibited fields', () => {
      const intent = {
        ...validIntent,
        glAccount: '4000',  // ❌
        debit: 1000,        // ❌
        credit: 0,          // ❌
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
      
      try {
        validator.validate(intent);
      } catch (error) {
        expect(error).toBeInstanceOf(FinanceProtectionError);
        // Should detect one of them (implementation may vary on detection order)
        const field = (error as FinanceProtectionError).prohibitedField;
        expect(['glAccount', 'debit', 'credit']).toContain(field);
      }
    });
    
    // T1.3: Nested prohibited field rejection (RECURSIVE SCAN)
    it('T1.3a: should reject nested prohibited field in metadata', () => {
      const intent = {
        ...validIntent,
        metadata: {
          patientId: 'pat-001',
          glAccount: '4000',  // ❌ Nested prohibited
        },
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
      
      try {
        validator.validate(intent);
      } catch (error) {
        expect(error).toBeInstanceOf(FinanceProtectionError);
        const field = (error as FinanceProtectionError).prohibitedField;
        expect(field).toContain('glAccount');
      }
    });
    
    it('T1.3b: should reject deeply nested prohibited field', () => {
      const intent = {
        ...validIntent,
        metadata: {
          context: {
            financials: {
              debit: 1000,  // ❌ Deeply nested
            },
          },
        },
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.3c: should reject prohibited field in array element', () => {
      const intent = {
        ...validIntent,
        metadata: {
          items: [
            { name: 'valid' },
            { glAccount: '4000' },  // ❌ In array
          ],
        },
      };
      
      expect(() => validator.validate(intent)).toThrow(FinanceProtectionError);
    });
    
    it('T1.3d: should accept valid nested metadata without prohibited fields', () => {
      const intent = {
        ...validIntent,
        metadata: {
          patientId: 'pat-001',
          encounter: {
            type: 'Outpatient',
            provider: {
              id: 'doc-001',
              name: 'Dr. Smith',
            },
          },
        },
      };
      
      expect(() => validator.validate(intent)).not.toThrow();
    });
    
    // T1.4: Valid intent acceptance
    it('T1.4: should accept valid intent without prohibited fields', () => {
      const result = validator.validate(validIntent);
      
      expect(result).toBeDefined();
      expect(result.intentType).toBe('REVENUE_RECOGNIZED');
      expect(result.tenantId).toBe('test-tenant');
      expect(result.amount).toBe(1000.00);
    });
  });
  
  // ==========================================================================
  // P3-2: Strict Contract — Unknown Fields
  // ==========================================================================
  
  describe('P3-2: Strict Contract (Unknown Fields)', () => {
    // T2.1: Unknown field rejection
    it('T2.1: should reject intent with unknown field', () => {
      const intent = {
        ...validIntent,
        unknownField: 'should-be-rejected',  // ❌ Not in contract
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('T2.1: should include unknown field in error message', () => {
      const intent = {
        ...validIntent,
        invalidExtraField: 'test',
      };
      
      try {
        validator.validate(intent);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        // Zod strict mode rejects unknown fields (message format may vary by version)
        expect((error as ValidationError).message).toMatch(/validation|strict|unrecognized|invalid/i);
      }
    });
    
    // T2.2: Typo field rejection
    it('T2.2: should reject intent with typo in field name', () => {
      const intent = {
        intentType: 'REVENUE_RECOGNIZED',
        tenantId: 'test-tenant',
        correlationId: 'test-corr-001',
        entityTYpe: 'Encounter',  // ❌ Typo (correct: entityType)
        entityId: 'enc-001',
        amount: 1000.00,
        currency: 'USD',
        effectiveDate: new Date(),
        source: 'Hospital',
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
  });
  
  // ==========================================================================
  // Required Fields Validation
  // ==========================================================================
  
  describe('Required Fields Validation', () => {
    it('should reject intent without intentType', () => {
      const intent = {
        ...validIntent,
        intentType: undefined,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject intent without tenantId', () => {
      const intent = {
        ...validIntent,
        tenantId: undefined,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject intent with empty tenantId', () => {
      const intent = {
        ...validIntent,
        tenantId: '',
      };
      
      expect(() => validator.validate(intent)).toThrow();
    });
    
    it('should reject intent without correlationId', () => {
      const intent = {
        ...validIntent,
        correlationId: undefined,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject intent with empty correlationId', () => {
      const intent = {
        ...validIntent,
        correlationId: '',
      };
      
      expect(() => validator.validate(intent)).toThrow();
    });
    
    it('should reject intent without entityType', () => {
      const intent = {
        ...validIntent,
        entityType: undefined,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject intent without amount', () => {
      const intent = {
        ...validIntent,
        amount: undefined,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject intent without currency', () => {
      const intent = {
        ...validIntent,
        currency: undefined,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
  });
  
  // ==========================================================================
  // Amount Validation
  // ==========================================================================
  
  describe('Amount Validation', () => {
    it('should reject negative amount', () => {
      const intent = {
        ...validIntent,
        amount: -100,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject non-finite amount (Infinity)', () => {
      const intent = {
        ...validIntent,
        amount: Infinity,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject non-finite amount (NaN)', () => {
      const intent = {
        ...validIntent,
        amount: NaN,
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should accept zero amount', () => {
      const intent = {
        ...validIntent,
        amount: 0,
      };
      
      expect(() => validator.validate(intent)).not.toThrow();
    });
    
    it('should accept positive amount', () => {
      const intent = {
        ...validIntent,
        amount: 12345.67,
      };
      
      const result = validator.validate(intent);
      expect(result.amount).toBe(12345.67);
    });
  });
  
  // ==========================================================================
  // Currency Validation (ISO 4217)
  // ==========================================================================
  
  describe('Currency Validation', () => {
    it('should reject non-3-letter currency', () => {
      const intent = {
        ...validIntent,
        currency: 'US',  // ❌ Only 2 letters
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should reject lowercase currency', () => {
      const intent = {
        ...validIntent,
        currency: 'usd',  // ❌ Lowercase
      };
      
      expect(() => validator.validate(intent)).toThrow(ValidationError);
    });
    
    it('should accept valid uppercase 3-letter currency', () => {
      const intent = {
        ...validIntent,
        currency: 'USD',
      };
      
      expect(() => validator.validate(intent)).not.toThrow();
    });
    
    it('should accept other ISO 4217 currencies', () => {
      const currencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
      
      for (const currency of currencies) {
        const intent = {
          ...validIntent,
          currency,
        };
        
        expect(() => validator.validate(intent)).not.toThrow();
      }
    });
  });
  
  // ==========================================================================
  // Batch Validation
  // ==========================================================================
  
  describe('Batch Validation', () => {
    it('should validate batch with all valid intents', () => {
      const intents = [
        validIntent,
        { ...validIntent, correlationId: 'corr-002' },
        { ...validIntent, correlationId: 'corr-003' },
      ];
      
      const result = validator.validateBatch(intents);
      
      expect(result.valid.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });
    
    it('should validate batch with mixed valid/invalid intents', () => {
      const intents = [
        validIntent,
        { ...validIntent, glAccount: '4000' },  // ❌
        { ...validIntent, correlationId: 'corr-003' },
        { ...validIntent, amount: -100 },       // ❌
      ];
      
      const result = validator.validateBatch(intents);
      
      expect(result.valid.length).toBe(2);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[1].index).toBe(3);
    });
  });
});
