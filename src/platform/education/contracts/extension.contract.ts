/**
 * Education OS — Approved Extension Contract Interface
 */

export interface CalculateTuitionInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly baseTuitionFee: number;
}

export interface CalculateTuitionOutput {
  readonly finalTuitionFee: number;
  readonly isCorporateFunded: boolean;
  readonly corporateClientPartyId?: string;
}

export interface IEducationEnrollmentExtensionContract {
  /**
   * Calculates custom tuition fees dynamically.
   * Resolves only via public contracts; no direct DB or internal repository access allowed.
   */
  calculateTuition(input: CalculateTuitionInput): Promise<CalculateTuitionOutput>;
}
