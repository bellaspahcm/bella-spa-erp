/**
 * RBC Compatibility Policy
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

export interface ICompatibilityPolicy {
  checkCompatibility(
    recipientAbo: 'A' | 'B' | 'AB' | 'O',
    recipientRh: 'POSITIVE' | 'NEGATIVE',
    donorAbo: 'A' | 'B' | 'AB' | 'O',
    donorRh: 'POSITIVE' | 'NEGATIVE'
  ): boolean;
}

export class RBCCompatibilityPolicy implements ICompatibilityPolicy {
  private readonly rbcMatrix: Record<'A' | 'B' | 'AB' | 'O', ('A' | 'B' | 'AB' | 'O')[]> = {
    'O': ['O'],
    'A': ['A', 'O'],
    'B': ['B', 'O'],
    'AB': ['AB', 'A', 'B', 'O'],
  };

  checkCompatibility(
    recipientAbo: 'A' | 'B' | 'AB' | 'O',
    recipientRh: 'POSITIVE' | 'NEGATIVE',
    donorAbo: 'A' | 'B' | 'AB' | 'O',
    donorRh: 'POSITIVE' | 'NEGATIVE'
  ): boolean {
    const aboCompatible = this.rbcMatrix[recipientAbo]?.includes(donorAbo) ?? false;
    
    // Rh- receives ONLY Rh-, Rh+ receives Rh+ or Rh-
    const rhCompatible = recipientRh === 'POSITIVE' || donorRh === 'NEGATIVE';

    return aboCompatible && rhCompatible;
  }
}
