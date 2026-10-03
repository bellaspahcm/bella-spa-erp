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

import type {
  CdsAlert,
  CdsCheckResult,
  CdsEngineContract,
  GenerateCdsSummaryRequest,
} from '../../../platform/healthcare/contracts/cds-engine.contract';
import type { EngineResponse } from '../../../platform/healthcare/shared-kernel/types';

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

export interface SafetyEvaluationResultDTO {
  hasAbsoluteBlock: boolean;
  contraindications: Array<{
    severity: 'FATAL' | 'HIGH';
    message: string;
    sourceAlert: CdsAlert;
  }>;
  warnings: Array<{
    severity: 'WARNING' | 'INFO';
    message: string;
    sourceAlert: CdsAlert;
  }>;
  calculationId: string;
  knowledgeBaseVersion: string;
  policyVersion: string;
}

export class HospitalClinicalAlertProductService {
  constructor(private readonly cdsContract: Pick<CdsEngineContract, 'generateCdsSummary'>) {}

  /**
   * Evaluates medication order safety via H8 CDS Public Contract
   */
  async evaluateOrderSafety(request: HospitalOrderSafetyRequestDTO): Promise<HospitalOrderSafetyResponseDTO> {
    if (!request.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!request.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    const cdsInput: GenerateCdsSummaryRequest = {
      requestId: `hospital-order-safety:${request.tenantId}:${request.encounterId}:${request.medicationCode}`,
      tenantId: request.tenantId,
      encounterId: request.encounterId,
      patientId: request.patientId,
      proposedDrugCode: request.medicationCode,
      currentMedicationCodes: request.activeMedications || [],
      proposedDoseMg: request.dosageMg,
    };

    const safetyResult = mapCdsResult(
      unwrapEngineResponse(await this.cdsContract.generateCdsSummary(cdsInput), 'CDS_SUMMARY_FAILED')
    );

    // Enforce Non-Bypassable ABSOLUTE_BLOCK (Law 15)
    let decision: 'APPROVED' | 'REQUIRES_OVERRIDE' | 'ABSOLUTE_BLOCK' = 'APPROVED';

    if (safetyResult.hasAbsoluteBlock) {
      decision = 'ABSOLUTE_BLOCK';
    } else if (safetyResult.contraindications.length > 0 || safetyResult.warnings.length > 0) {
      decision = 'REQUIRES_OVERRIDE';
    }

    return {
      decision,
      safetyEvaluation: safetyResult,
      timestamp: new Date().toISOString()
    };
  }
}

function mapCdsResult(result: CdsCheckResult): SafetyEvaluationResultDTO {
  const contraindications = result.alerts
    .filter((alert) => alert.enforcement === 'ABSOLUTE_BLOCK' || alert.enforcement === 'BLOCK')
    .map((alert) => ({
      severity: alert.enforcement === 'ABSOLUTE_BLOCK' ? 'FATAL' as const : 'HIGH' as const,
      message: alert.message,
      sourceAlert: alert,
    }));

  const warnings = result.alerts
    .filter((alert) => alert.enforcement === 'ACKNOWLEDGE' || alert.enforcement === 'INFORMATIONAL')
    .map((alert) => ({
      severity: alert.enforcement === 'ACKNOWLEDGE' ? 'WARNING' as const : 'INFO' as const,
      message: alert.message,
      sourceAlert: alert,
    }));

  return {
    hasAbsoluteBlock: result.hardBlocked,
    contraindications,
    warnings,
    calculationId: result.calculationId,
    knowledgeBaseVersion: result.knowledgeBaseVersion,
    policyVersion: result.policyVersion,
  };
}

function unwrapEngineResponse<T>(response: EngineResponse<T>, fallbackCode: string): T {
  if (response.success && response.data) {
    return response.data;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}
