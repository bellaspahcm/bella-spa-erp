/**
 * Transfusion Verifier Authorization Policy
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

export interface VerifierInfo {
  readonly id: string;
  readonly role: string;
  readonly isActive: boolean;
}

export interface ITransfusionVerifierAuthorizationPolicy {
  authorizeVerifiers(verifierA: VerifierInfo, verifierB: VerifierInfo): boolean;
}

export class TransfusionVerifierAuthorizationPolicy implements ITransfusionVerifierAuthorizationPolicy {
  private readonly clinicalRoles = new Set([
    'nurse',
    'doctor',
    'physician',
    'practitioner',
    'admin',
    'admin_staff',
    'ktv',
    'ktv_lead',
  ]);

  authorizeVerifiers(verifierA: VerifierInfo, verifierB: VerifierInfo): boolean {
    if (!verifierA.isActive || !verifierB.isActive) {
      return false;
    }

    if (verifierA.id === verifierB.id) {
      return false;
    }

    const roleA = verifierA.role.toLowerCase();
    const roleB = verifierB.role.toLowerCase();

    return this.clinicalRoles.has(roleA) && this.clinicalRoles.has(roleB);
  }
}
