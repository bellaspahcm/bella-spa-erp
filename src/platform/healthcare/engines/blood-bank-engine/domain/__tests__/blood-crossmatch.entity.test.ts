import {
  BloodCrossmatch,
  CrossmatchIncompatibleError,
  InvalidCrossmatchStateTransitionError,
  CrossmatchAlreadyProcessedError,
} from '../blood-crossmatch.entity';
import { RBCCompatibilityPolicy } from '../compatibility-policy';
import { TransfusionVerifierAuthorizationPolicy } from '../verifier-authorization-policy';

describe('BloodCrossmatch Aggregate & Policies Unit Tests', () => {
  const tenantId = 'tenant-123';
  const encounterId = 'encounter-456';
  const bloodUnitId = 'unit-789';

  describe('BloodCrossmatch State Machine & Transitions', () => {
    it('should initialize to REQUESTED state', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      expect(crossmatch.status).toBe('REQUESTED');
    });

    it('should transition to TESTED on compatible result', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      crossmatch.recordResult('COMPATIBLE', 'tech-1');
      
      expect(crossmatch.status).toBe('TESTED');
      expect(crossmatch.crossmatchedBy).toBe('tech-1');
      expect(crossmatch.crossmatchedAt).not.toBeNull();
    });

    it('should transition to INCOMPATIBLE on incompatible result', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      crossmatch.recordResult('INCOMPATIBLE', 'tech-1');
      
      expect(crossmatch.status).toBe('INCOMPATIBLE');
      expect(crossmatch.crossmatchedBy).toBe('tech-1');
    });

    it('should allow normal approval from TESTED', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      crossmatch.recordResult('COMPATIBLE', 'tech-1');
      crossmatch.approve('phys-1');
      
      expect(crossmatch.status).toBe('APPROVED');
      expect(crossmatch.approvedBy).toBe('phys-1');
      expect(crossmatch.approvedAt).not.toBeNull();
    });

    it('should block approval from INCOMPATIBLE without override', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      crossmatch.recordResult('INCOMPATIBLE', 'tech-1');
      
      expect(() => crossmatch.approve('phys-1')).toThrow(CrossmatchIncompatibleError);
    });

    it('should allow approval from INCOMPATIBLE with emergency override', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      crossmatch.recordResult('INCOMPATIBLE', 'tech-1');
      
      const override = {
        authorizedBy: 'phys-1',
        practitionerRole: 'doctor',
        reason: 'Patient in critical hemorrhagic shock',
        timestamp: new Date().toISOString(),
        policyVersion: '1.0',
      };
      
      crossmatch.approve('phys-1', override);
      
      expect(crossmatch.status).toBe('APPROVED');
      expect(crossmatch.emergencyOverride).toEqual(override);
    });

    it('should block skip transitions (e.g. REQUESTED to APPROVED)', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      expect(() => crossmatch.approve('phys-1')).toThrow(InvalidCrossmatchStateTransitionError);
    });

    it('should block transitions once in terminal APPROVED state', () => {
      const crossmatch = new BloodCrossmatch('xm-001', tenantId, encounterId, bloodUnitId);
      crossmatch.recordResult('COMPATIBLE', 'tech-1');
      crossmatch.approve('phys-1');
      
      expect(() => crossmatch.recordResult('COMPATIBLE', 'tech-2')).toThrow(CrossmatchAlreadyProcessedError);
    });
  });

  describe('RBCCompatibilityPolicy Matrix', () => {
    const policy = new RBCCompatibilityPolicy();

    it('should approve compatible ABO match combinations', () => {
      // O receives only O
      expect(policy.checkCompatibility('O', 'POSITIVE', 'O', 'POSITIVE')).toBe(true);
      expect(policy.checkCompatibility('O', 'POSITIVE', 'A', 'POSITIVE')).toBe(false);

      // AB receives A, B, AB, O
      expect(policy.checkCompatibility('AB', 'POSITIVE', 'O', 'POSITIVE')).toBe(true);
      expect(policy.checkCompatibility('AB', 'POSITIVE', 'A', 'POSITIVE')).toBe(true);
      expect(policy.checkCompatibility('AB', 'POSITIVE', 'B', 'POSITIVE')).toBe(true);
      expect(policy.checkCompatibility('AB', 'POSITIVE', 'AB', 'POSITIVE')).toBe(true);
    });

    it('should enforce Rh factor compatibility rules', () => {
      // Rh- receives ONLY Rh-
      expect(policy.checkCompatibility('O', 'NEGATIVE', 'O', 'NEGATIVE')).toBe(true);
      expect(policy.checkCompatibility('O', 'NEGATIVE', 'O', 'POSITIVE')).toBe(false);

      // Rh+ receives Rh+ or Rh-
      expect(policy.checkCompatibility('O', 'POSITIVE', 'O', 'NEGATIVE')).toBe(true);
      expect(policy.checkCompatibility('O', 'POSITIVE', 'O', 'POSITIVE')).toBe(true);
    });
  });

  describe('TransfusionVerifierAuthorizationPolicy', () => {
    const policy = new TransfusionVerifierAuthorizationPolicy();

    it('should authorize distinct active clinical verifiers', () => {
      const verifierA = { id: 'nurse-1', role: 'nurse', isActive: true };
      const verifierB = { id: 'doctor-2', role: 'doctor', isActive: true };
      
      expect(policy.authorizeVerifiers(verifierA, verifierB)).toBe(true);
    });

    it('should reject non-clinical verifiers', () => {
      const verifierA = { id: 'nurse-1', role: 'nurse', isActive: true };
      const verifierB = { id: 'clerk-2', role: 'clerk', isActive: true };
      
      expect(policy.authorizeVerifiers(verifierA, verifierB)).toBe(false);
    });

    it('should reject if verifiers are same person', () => {
      const verifierA = { id: 'nurse-1', role: 'nurse', isActive: true };
      const verifierB = { id: 'nurse-1', role: 'nurse', isActive: true };
      
      expect(policy.authorizeVerifiers(verifierA, verifierB)).toBe(false);
    });

    it('should reject if any verifier is inactive', () => {
      const verifierA = { id: 'nurse-1', role: 'nurse', isActive: false };
      const verifierB = { id: 'doctor-2', role: 'doctor', isActive: true };
      
      expect(policy.authorizeVerifiers(verifierA, verifierB)).toBe(false);
    });
  });
});
