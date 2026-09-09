export type MedicationAuthorizationStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type DoseOccurrenceStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'MISSED';

export interface IMedicationAuthorization {
  id: string;
  tenant_id: string;
  student_id: string;
  medication_name: string;
  authorized_dose: string;
  authorized_by_guardian_id: string;
  authorized_at: Date;
  valid_from: Date;
  valid_until: Date;
  status: MedicationAuthorizationStatus;
}

export interface IMedicationDoseOccurrence {
  id: string;
  tenant_id: string;
  authorization_id: string;
  scheduled_for: Date;
  window_start: Date;
  window_end: Date;
  status: DoseOccurrenceStatus;
}

export interface IAdministerDoseCommand {
  tenantId: string;
  studentId: string;
  doseOccurrenceId: string;
  administeredAt: Date;
  doseGiven: string;
  actorId: string;
  notes?: string;
}

export interface IMedicationSafetyContract {
  /**
   * Safely records medication administration and guarantees protection against double-dosing.
   * Enforces rules:
   * 1. Authorization is ACTIVE
   * 2. Current time within authorization valid_from / valid_until
   * 3. Current time within dose occurrence window
   * 4. Child ID & Tenant ID match
   * 5. No existing COMPLETED administration for this occurrence
   *
   * Relies on DB unique constraint (tenant_id, dose_occurrence_id) WHERE status = 'COMPLETED'
   * for absolute concurrent race protection.
   *
   * @throws MEDICATION_DOUBLE_DOSE_ERROR If another log already completed this dose.
   * @throws MEDICATION_AUTH_INVALID_ERROR If auth is not active or expired.
   * @throws MEDICATION_WINDOW_VIOLATION If attempting to give outside the window.
   */
  administerDose(command: IAdministerDoseCommand): Promise<{ logId: string; status: 'COMPLETED' }>;
}
