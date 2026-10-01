/**
 * Admission Engine Public Contract Re-Export
 *
 * Keeps Product -> Public Contract -> Kernel imports stable while the canonical
 * Admission Engine contract remains owned by the Admission Engine package.
 *
 * @module platform/healthcare/contracts/admission-engine.contract
 */

export type {
  AdmissionEngineContract,
  AdmissionDTO,
  CreateAdmissionRequest,
  DischargeAdmissionRequest,
} from '../engines/admission-engine/contracts/admission-engine.contract';
