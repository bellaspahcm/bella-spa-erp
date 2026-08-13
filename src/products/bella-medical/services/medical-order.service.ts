/**
 * BELLA MEDICAL CLINIC — V2 CLINICAL ORDER PRODUCT SERVICE
 *
 * Orchestrates computerized physician order entries (CPOE) for prescriptions,
 * laboratory tickets, and imaging orders in full compliance with:
 * - H12 Constitution & Law 3 (Contract-Only dependency injection)
 * - Manifest Single Source of Truth
 * - Non-bypassable CDS validation enforced inside Kernel Order Engine
 *
 * @module src/products/bella-medical/services/medical-order.service
 */

import type { OrderEngineContract, CreateOrderRequest } from '../../../platform/healthcare/contracts/order-engine.contract';
import type { ILaboratoryEngine } from '../../../platform/healthcare/contracts/laboratory-engine.contract';
import { medicalProductManifest } from '../manifest';

export interface PrescribeMedicationDTO {
  requestId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  orderedBy: string;
  drugCode: string;
  drugName: string;
  totalDailyDoseMg: number;
  currentMedicationCodes: string[];
  notes?: string;
}

export interface IssueLabOrderDTO {
  requestId: string;
  tenantId: string;
  encounterId: string;
  orderedBy: string;
  testCode: string;
  testName: string;
}

export class MedicalOrderProductService {
  constructor(
    private readonly orderEngine: OrderEngineContract,
    private readonly laboratoryEngine: ILaboratoryEngine
  ) {}

  private assertCapability(capabilityId: string) {
    const capabilities = medicalProductManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  private assertWorkflow(workflowId: string) {
    const workflows = medicalProductManifest.workflows || [];
    if (!workflows.includes(workflowId)) {
      throw new Error(`MANIFEST_VIOLATION: Workflow '${workflowId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Prescribes a medication. CDS checking is executed non-bypassably at the Kernel level.
   */
  async prescribeMedication(dto: PrescribeMedicationDTO): Promise<any> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('prescription_safety_check_flow');
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    const request: CreateOrderRequest = {
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderedBy: dto.orderedBy,
      patientId: dto.patientId,
      orderDetails: {
        drugCode: dto.drugCode,
        drugName: dto.drugName,
        dose: dto.totalDailyDoseMg,
        doseUnit: 'mg',
        route: 'PO',
        frequency: 'QD',
        totalDailyDoseMg: dto.totalDailyDoseMg,
        currentMedicationCodes: dto.currentMedicationCodes,
      },
      notes: dto.notes,
    };

    const res = await this.orderEngine.createOrder(request);

    if (!res.success || !res.data) {
      throw new Error(`Medication prescribing failed: ${res.error?.message || 'Unknown error'}`);
    }

    return res.data;
  }

  /**
   * Issues a laboratory order ticket
   */
  async issueLabOrder(dto: IssueLabOrderDTO): Promise<any> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    const request: CreateOrderRequest = {
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      orderType: 'LAB',
      priority: 'ROUTINE',
      orderedBy: dto.orderedBy,
      orderDetails: {
        testCode: dto.testCode,
        testName: dto.testName,
      },
    };

    const res = await this.orderEngine.createOrder(request);

    if (!res.success || !res.data) {
      throw new Error(`Lab order issuance failed: ${res.error?.message || 'Unknown error'}`);
    }

    return res.data;
  }

  /**
   * Records speciment result and verifies normal/abnormal ranges using Laboratory Engine
   */
  async recordAndVerifyLabResult(
    tenantId: string,
    labOrderId: string,
    value: string,
    unit: string,
    verifiedBy: string
  ): Promise<any> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    // 1. Record specimen test result
    await this.laboratoryEngine.recordResult(tenantId, labOrderId, value, unit);

    // 2. Verify results
    return await this.laboratoryEngine.verifyResult(tenantId, labOrderId, verifiedBy);
  }
}
