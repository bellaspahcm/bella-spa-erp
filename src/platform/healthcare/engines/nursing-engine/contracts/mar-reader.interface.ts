/**
 * MAR Reader Contract Interface for Nursing Engine
 *
 * Allows Nursing Engine to consume Medication Administration Records (MAR)
 * directly from Pharmacy Kernel via contract boundary without direct service coupling (Invariant 3).
 *
 * @module platform/healthcare/engines/nursing-engine/contracts
 */

export interface MARItemSummary {
  id: string;
  tenantId: string;
  encounterId: string;
  admissionId?: string;
  prescriptionItemId: string;
  drugName: string;
  dosage: string;
  route: string;
  scheduledTime: string;
  administeredTime?: string;
  administeredByNurseId?: string;
  status: 'scheduled' | 'administered' | 'missed' | 'refused' | 'cancelled';
  notes?: string;
}

export interface IMARReader {
  getMARRecordsByAdmission(tenantId: string, admissionId: string): Promise<MARItemSummary[]>;
  getMARRecordsByEncounter(tenantId: string, encounterId: string): Promise<MARItemSummary[]>;
}
