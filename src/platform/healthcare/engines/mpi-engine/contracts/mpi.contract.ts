/**
 * Healthcare Platform Shared Kernel - Master Patient Index (MPI) Contract
 * 
 * Defines the core patient registry capabilities verified in H1.
 * Patient identity details are mapped directly to the `hc_master_patient_index` DB schema.
 * 
 * @module platform/healthcare/engines/mpi-engine/contracts/mpi.contract
 */

import { EngineContract } from '../../../contracts';

export interface IMPIContract extends EngineContract {
  /**
   * Find a patient by their unique patient ID within a tenant
   */
  findById(tenantId: string, patientId: string): Promise<PatientSummary | null>;

  /**
   * Find a patient by their Medical Record Number (MRN) within a tenant
   */
  findByMRN(tenantId: string, mrn: string): Promise<PatientSummary | null>;

  /**
   * Search patients by name, MRN, or identifiers within a tenant
   */
  search(tenantId: string, query: string): Promise<PatientSummary[]>;
}

/**
 * Patient Summary details mapping to the proven columns in hc_master_patient_index
 */
export interface PatientSummary {
  id: string;             // UUID key in hc_master_patient_index
  tenantId: string;       // Tenant partition
  mrnCode: string;        // Medical Record Number
  fullName: string;       // Patient's full name
  dateOfBirth?: string;   // Date of birth
  gender?: 'male' | 'female' | 'other' | 'unknown';
  nationalId?: string;    // National ID/CCCD
}
