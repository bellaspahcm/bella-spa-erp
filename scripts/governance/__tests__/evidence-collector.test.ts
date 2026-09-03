/**
 * Evidence Collector Tests
 * 
 * Tests repository evidence collection for E9 decision engine.
 * Driven by E8.1 Education OS retrospective requirements.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { collectEvidence, type EvidenceCollectorOptions } from '../evidence-collector';
import type { CanonicalEvidence } from '../canonical-scope-derivation';

describe('Evidence Collector', () => {
  const defaultOptions: EvidenceCollectorOptions = {
    industryScope: 'education',
    migrationsPath: 'supabase/migrations',
    generatedTypesPath: 'src/types/database.types.ts',
    domainBasePath: 'src/platform',
    testBasePath: 'src/platform',
  };

  describe('Migration Evidence', () => {
    it('should detect migration for canonical entity', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence.migration).toBe(true);
    });

    it('should detect migration for edu_enrollments', async () => {
      const evidence = await collectEvidence('Enrollment', defaultOptions);
      expect(evidence.migration).toBe(true);
    });

    it('should detect migration for edu_attendance', async () => {
      const evidence = await collectEvidence('Attendance', defaultOptions);
      expect(evidence.migration).toBe(true);
    });

    it('should detect migration for edu_assessments', async () => {
      const evidence = await collectEvidence('Assessment', defaultOptions);
      expect(evidence.migration).toBe(true);
    });

    it('should return false for non-existent entity', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence.migration).toBe(false);
    });
  });

  describe('Generated Types Evidence', () => {
    it('should detect generated type for Course', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence.generatedTypes).toBe(true);
    });

    it('should detect generated type for Enrollment', async () => {
      const evidence = await collectEvidence('Enrollment', defaultOptions);
      expect(evidence.generatedTypes).toBe(true);
    });

    it('should detect generated type for Attendance', async () => {
      const evidence = await collectEvidence('Attendance', defaultOptions);
      expect(evidence.generatedTypes).toBe(true);
    });

    it('should detect generated type for Assessment', async () => {
      const evidence = await collectEvidence('Assessment', defaultOptions);
      expect(evidence.generatedTypes).toBe(true);
    });

    it('should return false for non-existent type', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence.generatedTypes).toBe(false);
    });
  });

  describe('RLS Evidence', () => {
    it('should detect RLS policy for Course', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence.rls).toBe(true);
    });

    it('should detect RLS policy for Enrollment', async () => {
      const evidence = await collectEvidence('Enrollment', defaultOptions);
      expect(evidence.rls).toBe(true);
    });

    it('should detect RLS policy for Attendance', async () => {
      const evidence = await collectEvidence('Attendance', defaultOptions);
      expect(evidence.rls).toBe(true);
    });

    it('should detect RLS policy for Assessment', async () => {
      const evidence = await collectEvidence('Assessment', defaultOptions);
      expect(evidence.rls).toBe(true);
    });

    it('should return false for entity without RLS', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence.rls).toBe(false);
    });
  });

  describe('Domain Evidence', () => {
    it('should detect existing domain entity for Course', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence.domain).toBe(true);
    });

    it('should detect existing domain entity for Enrollment', async () => {
      const evidence = await collectEvidence('Enrollment', defaultOptions);
      expect(evidence.domain).toBe(true);
    });

    it('should detect existing domain entity for Attendance', async () => {
      const evidence = await collectEvidence('Attendance', defaultOptions);
      expect(evidence.domain).toBe(true);
    });

    it('should detect existing domain entity for Assessment', async () => {
      const evidence = await collectEvidence('Assessment', defaultOptions);
      expect(evidence.domain).toBe(true);
    });

    it('should return false for non-existent domain', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence.domain).toBe(false);
    });
  });

  describe('Test Evidence', () => {
    it('should detect tests for Course', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence.tests).toBe(true);
    });

    it('should detect tests for Enrollment', async () => {
      const evidence = await collectEvidence('Enrollment', defaultOptions);
      expect(evidence.tests).toBe(true);
    });

    it('should detect tests for Attendance', async () => {
      const evidence = await collectEvidence('Attendance', defaultOptions);
      expect(evidence.tests).toBe(true);
    });

    it('should detect tests for Assessment', async () => {
      const evidence = await collectEvidence('Assessment', defaultOptions);
      expect(evidence.tests).toBe(true);
    });

    it('should return false for entity without tests', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence.tests).toBe(false);
    });
  });

  describe('Historical Evidence', () => {
    it('should not detect historical for current entity', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence.historical).toBeUndefined();
    });

    it('should be undefined when not explicitly checked', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence.historical).toBeUndefined();
    });
  });

  describe('Determinism', () => {
    it('should produce identical evidence on repeated calls', async () => {
      const evidence1 = await collectEvidence('Course', defaultOptions);
      const evidence2 = await collectEvidence('Course', defaultOptions);
      expect(evidence1).toEqual(evidence2);
    });
  });

  describe('Scope Awareness', () => {
    it('should only scan education scope when specified', async () => {
      const evidence = await collectEvidence('Course', {
        ...defaultOptions,
        industryScope: 'education',
      });
      expect(evidence.migration).toBe(true);
    });

    it('should not find healthcare entities in education scope', async () => {
      const evidence = await collectEvidence('Patient', {
        ...defaultOptions,
        industryScope: 'education',
      });
      expect(evidence.migration).toBe(false);
      expect(evidence.generatedTypes).toBe(false);
      expect(evidence.domain).toBe(false);
    });
  });

  describe('E8 Retrospective Integration', () => {
    it('should reproduce E8 Course evidence', async () => {
      const evidence = await collectEvidence('Course', defaultOptions);
      expect(evidence).toEqual({
        migration: true,
        generatedTypes: true,
        rls: true,
        domain: true,
        tests: true,
      });
    });

    it('should reproduce E8 Attendance evidence (reconstructed)', async () => {
      const evidence = await collectEvidence('Attendance', defaultOptions);
      expect(evidence).toEqual({
        migration: true,
        generatedTypes: true,
        rls: true,
        domain: true,
        tests: true,
      });
    });

    it('should reproduce E8 Student decision (no evidence)', async () => {
      const evidence = await collectEvidence('Student', defaultOptions);
      expect(evidence).toEqual({
        migration: false,
        generatedTypes: false,
        rls: false,
        domain: false,
        tests: false,
      });
    });
  });

  describe('Missing Evidence Handling', () => {
    it('should explicitly report missing migration', async () => {
      const evidence = await collectEvidence('NonExistentEntity', defaultOptions);
      expect(evidence.migration).toBe(false);
    });

    it('should explicitly report missing types', async () => {
      const evidence = await collectEvidence('NonExistentEntity', defaultOptions);
      expect(evidence.generatedTypes).toBe(false);
    });

    it('should never silently assume true', async () => {
      const evidence = await collectEvidence('NonExistentEntity', defaultOptions);
      expect(Object.values(evidence).every(v => v === false || v === undefined)).toBe(true);
    });
  });
});
