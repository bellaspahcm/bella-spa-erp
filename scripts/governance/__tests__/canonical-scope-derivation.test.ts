/**
 * Factory Canonical Scope Derivation Rule — Test Suite
 * 
 * Tests the deterministic machinery that derives canonical implementation scope
 * from multi-source evidence.
 * 
 * Proven behavior source: E8.1 Education OS autonomous scope derivation
 * 
 * @see docs/architecture/E8_EDUCATION_KERNEL_EVIDENCE.md
 */

import { describe, it, expect } from '@jest/globals';
import { 
  deriveCanonicalScope, 
  type CanonicalEvidence, 
  type ScopeDecision,
  type ScopeDerivationResult 
} from '../canonical-scope-derivation';

describe('Factory Canonical Scope Derivation Rule', () => {
  describe('CONFORM: Complete canonical evidence', () => {
    it('should preserve entity with full evidence chain', () => {
      const evidence: CanonicalEvidence = {
        migration: true,      // Authoritative persistence
        generatedTypes: true, // Authoritative contract
        rls: true,            // Authoritative governance
        domain: true,         // Implementation exists
        tests: true,          // Behavioral evidence
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('CONFORM');
      expect(result.reason).toContain('complete canonical evidence');
    });

    it('should conform when tests are missing but other evidence complete', () => {
      const evidence: CanonicalEvidence = {
        migration: true,
        generatedTypes: true,
        rls: true,
        domain: true,
        tests: false, // Tests can be added later
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('CONFORM');
    });
  });

  describe('RECONSTRUCT: Canonical drift detected', () => {
    it('should reconstruct entity with canonical persistence but missing domain (E8 case)', () => {
      // E8.1 Attendance/Assessment case: canonical DB but domain deleted
      const evidence: CanonicalEvidence = {
        migration: true,      // edu_attendance exists
        generatedTypes: true, // Database['public']['edu_attendance'] exists
        rls: true,            // tenant_isolation policy exists
        domain: false,        // deleted in commit dd0afa2e
        tests: false,
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('RECONSTRUCT');
      expect(result.reason).toContain('canonical drift');
      expect(result.reason).toMatch(/persistence.*domain/i);
    });

    it('should reconstruct when domain exists but RLS missing (governance drift)', () => {
      const evidence: CanonicalEvidence = {
        migration: true,
        generatedTypes: true,
        rls: false, // Governance gap
        domain: true,
        tests: true,
      };

      // This could be BLOCK or RECONSTRUCT depending on policy
      // Implementation must decide based on E8 evidence
      const result = deriveCanonicalScope(evidence);

      expect(['RECONSTRUCT', 'BLOCK']).toContain(result.decision);
    });
  });

  describe('DEFER: Insufficient canonical evidence', () => {
    it('should defer entity with domain but no canonical persistence', () => {
      const evidence: CanonicalEvidence = {
        migration: false,     // No DB table
        generatedTypes: false,
        rls: false,
        domain: true,         // Speculative implementation
        tests: true,
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('DEFER');
      expect(result.reason).toMatch(/no canonical persistence|speculative/i);
    });

    it('should defer when only domain tests exist without persistence', () => {
      const evidence: CanonicalEvidence = {
        migration: false,
        generatedTypes: false,
        rls: false,
        domain: false,
        tests: true, // Tests for non-existent entity
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('DEFER');
    });
  });

  describe('BLOCK: Evidence contradictions', () => {
    it('should block when migration exists but generated types missing (contract drift)', () => {
      const evidence: CanonicalEvidence = {
        migration: true,
        generatedTypes: false, // DRIFT: DB and contract mismatch
        rls: true,
        domain: false,
        tests: false,
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toMatch(/contract.*mismatch|schema.*drift/i);
    });

    it('should block when generated types exist but migration missing', () => {
      const evidence: CanonicalEvidence = {
        migration: false,
        generatedTypes: true, // Orphaned generated type
        rls: false,
        domain: false,
        tests: false,
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toMatch(/migration.*missing|orphaned/i);
    });

    it('should block when RLS missing for canonical table', () => {
      const evidence: CanonicalEvidence = {
        migration: true,
        generatedTypes: true,
        rls: false, // Governance gap
        domain: false,
        tests: false,
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toMatch(/rls.*missing|governance.*gap|tenant.*isolation/i);
    });
  });

  describe('DO_NOT_REVIVE: Historical evidence only', () => {
    it('should not revive deleted historical implementation', () => {
      const evidence: CanonicalEvidence = {
        migration: false,
        generatedTypes: false,
        rls: false,
        domain: false,
        tests: false,
        historical: true, // E.g., commit dd0afa2e deleted repos
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('DO_NOT_REVIVE');
      expect(result.reason).toMatch(/historical|deleted|past/i);
    });

    it('should not revive when only historical tests exist', () => {
      const evidence: CanonicalEvidence = {
        migration: false,
        generatedTypes: false,
        rls: false,
        domain: false,
        tests: false,
        historical: true,
      };

      const result = deriveCanonicalScope(evidence);

      expect(result.decision).toBe('DO_NOT_REVIVE');
    });
  });

  describe('Edge cases', () => {
    it('should handle RLS true but migration false (orphaned policy)', () => {
      const evidence: CanonicalEvidence = {
        migration: false,
        generatedTypes: false,
        rls: true, // Orphaned RLS policy
        domain: false,
        tests: false,
      };

      const result = deriveCanonicalScope(evidence);

      // Could be DEFER or BLOCK depending on implementation
      expect(['DEFER', 'BLOCK']).toContain(result.decision);
    });

    it('should prioritize authoritative evidence over historical', () => {
      const evidence: CanonicalEvidence = {
        migration: true,      // Current canonical
        generatedTypes: true,
        rls: true,
        domain: false,
        tests: false,
        historical: true,     // Historical also exists
      };

      const result = deriveCanonicalScope(evidence);

      // Canonical evidence wins
      expect(result.decision).toBe('RECONSTRUCT');
      expect(result.decision).not.toBe('DO_NOT_REVIVE');
    });
  });

  describe('E8.1 Retrospective Verification', () => {
    it('should derive E8.1 Course scope (preserved)', () => {
      const courseEvidence: CanonicalEvidence = {
        migration: true,
        generatedTypes: true,
        rls: true,
        domain: true,
        tests: true,
      };

      const result = deriveCanonicalScope(courseEvidence);

      expect(result.decision).toBe('CONFORM');
    });

    it('should derive E8.1 Enrollment scope (preserved)', () => {
      const enrollmentEvidence: CanonicalEvidence = {
        migration: true,
        generatedTypes: true,
        rls: true,
        domain: true,
        tests: true,
      };

      const result = deriveCanonicalScope(enrollmentEvidence);

      expect(result.decision).toBe('CONFORM');
    });

    it('should derive E8.1 Attendance scope (reconstructed)', () => {
      const attendanceEvidence: CanonicalEvidence = {
        migration: true,      // edu_attendance migration exists
        generatedTypes: true, // Database['public']['edu_attendance'] exists
        rls: true,            // tenant_isolation policy exists
        domain: false,        // deleted in dd0afa2e
        tests: false,         // no tests initially
      };

      const result = deriveCanonicalScope(attendanceEvidence);

      expect(result.decision).toBe('RECONSTRUCT');
    });

    it('should derive E8.1 Assessment scope (reconstructed)', () => {
      const assessmentEvidence: CanonicalEvidence = {
        migration: true,      // edu_assessments migration exists
        generatedTypes: true, // Database['public']['edu_assessments'] exists
        rls: true,            // tenant_isolation policy exists
        domain: false,        // deleted in dd0afa2e
        tests: false,         // no tests initially
      };

      const result = deriveCanonicalScope(assessmentEvidence);

      expect(result.decision).toBe('RECONSTRUCT');
    });

    it('should NOT build Student entity (no canonical persistence)', () => {
      const studentEvidence: CanonicalEvidence = {
        migration: false,     // No edu_students table
        generatedTypes: false,
        rls: false,
        domain: false,
        tests: false,
      };

      const result = deriveCanonicalScope(studentEvidence);

      expect(result.decision).toBe('DEFER');
      expect(result.decision).not.toBe('RECONSTRUCT');
    });
  });
});
