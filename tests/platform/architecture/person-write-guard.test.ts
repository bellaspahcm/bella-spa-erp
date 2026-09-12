/**
 * Person Write Guard - Adversarial Tests
 * 
 * Proves R5.1B enforcement:
 * - BLOCK: New Education production code
 * - BLOCK: New Product code
 * - ALLOW: Legacy test fixtures (temporary)
 * - ALLOW: Remediation scripts
 */

import { PersonWriteGuard, ArchitectureViolation } from '@/platform/architecture/guards/person-write-guard';

describe('PersonWriteGuard - R5.1B Enforcement', () => {
  describe('BLOCK: Education production code', () => {
    test('blocks Person write in Education service', () => {
      const productionPath = 'src/platform/education/student/student.service.ts';
      
      expect(() => PersonWriteGuard.validate(productionPath, 'create'))
        .toThrow(ArchitectureViolation);
      
      expect(() => PersonWriteGuard.validate(productionPath, 'create'))
        .toThrow(/Person write.*prohibited.*Education production/);
    });

    test('blocks Person write in Education contract', () => {
      const productionPath = 'src/platform/education/contracts/enrollment.contract.impl.ts';
      
      expect(() => PersonWriteGuard.validate(productionPath, 'update'))
        .toThrow(ArchitectureViolation);
    });
  });

  describe('BLOCK: New Product code', () => {
    test('blocks Person write in Bella Spa product', () => {
      const productPath = 'src/products/bella-spa/services/spa-customer.service.ts';
      
      expect(() => PersonWriteGuard.validate(productPath, 'create'))
        .toThrow(ArchitectureViolation);
      
      expect(() => PersonWriteGuard.validate(productPath, 'create'))
        .toThrow(/Person write.*prohibited.*Product code/);
    });

    test('blocks Person write in Bella Preschool product', () => {
      const productPath = 'src/products/bella-preschool/student/student.service.ts';
      
      expect(() => PersonWriteGuard.validate(productPath, 'delete'))
        .toThrow(ArchitectureViolation);
    });
  });

  describe('ALLOW: Legacy test fixtures (temporary)', () => {
    test('allows Person write in Education test (__tests__)', () => {
      const testPath = 'src/platform/education/student/__tests__/student.integration.test.ts';
      
      expect(() => PersonWriteGuard.validate(testPath, 'create'))
        .not.toThrow();
    });

    test('allows Person write in test file (.test.ts)', () => {
      const testPath = 'src/platform/education/enrollment.test.ts';
      
      expect(() => PersonWriteGuard.validate(testPath, 'update'))
        .not.toThrow();
    });

    test('allows Person write in tests directory', () => {
      const testPath = 'tests/integration/education/student-flow.test.ts';
      
      expect(() => PersonWriteGuard.validate(testPath, 'create'))
        .not.toThrow();
    });
  });

  describe('ALLOW: Remediation scripts', () => {
    test('allows Person write in remediation script', () => {
      const remediationPath = 'scripts/remediation/r2-party-backfill.ts';
      
      expect(() => PersonWriteGuard.validate(remediationPath, 'create'))
        .not.toThrow();
    });

    test('allows Person write in tests/remediation', () => {
      const remediationPath = 'tests/remediation/r3-integration.test.ts';
      
      expect(() => PersonWriteGuard.validate(remediationPath, 'update'))
        .not.toThrow();
    });
  });

  describe('ALLOW: Non-Education/Product domains (legacy)', () => {
    test('allows Person write in Host platform (not Education)', () => {
      const hostPath = 'src/platform/host/user/user.service.ts';
      
      expect(() => PersonWriteGuard.validate(hostPath, 'create'))
        .not.toThrow();
    });

    test('allows Person write in Core platform', () => {
      const corePath = 'src/platform/core/identity/identity.service.ts';
      
      expect(() => PersonWriteGuard.validate(corePath, 'update'))
        .not.toThrow();
    });
  });
});
