/**
 * BELLA HOSPITAL — CLINICAL ALERT PRODUCT SERVICE
 *
 * Routes clinical safety alerts and medication orders through H8 CDS Engine
 * in strict compliance with the Healthcare Vertical Coding Constitution:
 * - Product -> Public Contract -> Frozen Kernel H1-H12 (H8 CDS Engine)
 * - Non-bypassable ABSOLUTE_BLOCK Handling (Law 15)
 * - Anti-False-Compliance Invariant (Law 16)
 *
 * @module src/products/bella-hospital/services/hospital-clinical-alert.service
 */

import { ICdsContract, OrderSafetyCheckInputDTO, SafetyEvaluationResultDTO } from '../../../platform/healthcare/contracts/cds-engine.contract';

export interface HospitalOrderSafetyRequestDTO {
  tenantId: string;
  encounterId: string;
  patientId: string;
  clinicianId: string;
  medicationCode: string;
  medicationName: string;
  dosageMg: number;
  route: string;
  knownAllergies?: string[];
  activeMedications?: string[];
}

export interface HospitalOrderSafetyResponseDTO {
  decision: 'APPROVED' | 'REQUIRES_OVERRIDE' | 'ABSOLUTE_BLOCK';
  safetyEvaluation: SafetyEvaluationResultDTO;
  timestamp: string;
}

export class HospitalClinicalAlertProductService {
  constructor(private readonly cdsContract: ICdsContract) {}

  /**
   * Evaluates medication order safety via H8 CDS Public Contract
   */
  async evaluateOrderSafety(request: HospitalOrderSafetyRequestDTO): Promise<HospitalOrderSafetyResponseDTO> {
    if (!request.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!request.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    const cdsInput: OrderSafetyCheckInputDTO = {
      tenantId: request.tenantId,
      encounterId: request.encounterId,
      patientId: request.patientId,
      orderType: 'MEDICATION',
      medicationCode: request.medicationCode,
      dosage: `${request.dosageMg}mg ${request.route}`,
      knownAllergies: request.knownAllergies || [],
      activeMedications: request.activeMedications || []
    };

    const safetyResult = await this.cdsContract.evaluateOrderSafety(cdsInput);

    // Enforce Non-Bypassable ABSOLUTE_BLOCK (Law 15)
    let decision: 'APPROVED' | 'REQUIRES_OVERRIDE' | 'ABSOLUTE_BLOCK' = 'APPROVED';

    if (safetyResult.hasAbsoluteBlock || safetyResult.contraindications.some(c => c.severity === 'FATAL' || c.severity === 'HIGH')) {
      decision = 'ABSOLUTE_BLOCK';
    } else if (safetyResult.warnings.length > 0) {
      decision = 'REQUIRES_OVERRIDE';
    }

    return {
      decision,
      safetyEvaluation: safetyResult,
      timestamp: new Date().toISOString()
    };
  }
}
