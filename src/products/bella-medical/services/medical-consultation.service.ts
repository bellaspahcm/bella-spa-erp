/**
 * BELLA MEDICAL CLINIC — V2 OUTPATIENT CONSULTATION PRODUCT SERVICE
 *
 * Orchestrates clinical check-in, SOAP notes, diagnosis recording,
 * and consultation completion flows in full compliance with:
 * - H12 Constitution & Law 3 (Contract-Only dependency injection)
 * - Manifest Single Source of Truth
 * - Non-bypassable Temporal (H9) & Clinical Audit (H11) Governance
 *
 * @module src/products/bella-medical/services/medical-consultation.service
 */

import type { IEncounterEngine } from '../../../platform/healthcare/contracts/encounter-engine.contract';
import type { ITemporalContract } from '../../../platform/healthcare/contracts/temporal-engine.contract';
import type { IClinicalAuditContract } from '../../../platform/healthcare/contracts/clinical-audit.contract';
import { medicalProductManifest } from '../manifest';

export interface StartOutpatientConsultationDTO {
  tenantId: string;
  patientId: string;
  chiefComplaint?: string;
  providerId: string;
  departmentId: string;
  userId: string;
}

export interface SaveSoapAndDiagnosesDTO {
  tenantId: string;
  encounterId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses: Array<{ code: string; display: string; isPrimary: boolean }>;
  userId: string;
}

export interface CompleteConsultationDTO {
  tenantId: string;
  encounterId: string;
  patientId: string;
  userId: string;
}

export class MedicalConsultationProductService {
  constructor(
    private readonly encounterEngine: IEncounterEngine,
    private readonly temporalContract: ITemporalContract,
    private readonly auditContract: IClinicalAuditContract
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
   * Begins a new medical consultation (arrived -> in-progress) and registers it in the temporal ledger
   */
  async startConsultation(dto: StartOutpatientConsultationDTO): Promise<any> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    // 1. Create clinical encounter (Aggregate Root) via public contract
    const createRes = await this.encounterEngine.createEncounter({
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterClass: 'AMB',
      encounterType: 'outpatient',
      chiefComplaint: dto.chiefComplaint,
      admittingProviderId: dto.providerId,
      admittingDepartmentId: dto.departmentId,
      userId: dto.userId,
    });

    if (!createRes.success || !createRes.encounter) {
      throw new Error(`Encounter creation failed: ${createRes.error}`);
    }

    const encounterId = createRes.encounter.id;

    // 2. Transition encounter state: planned -> arrived -> in-progress
    await this.encounterEngine.updateStatus({
      tenantId: dto.tenantId,
      encounterId,
      status: 'arrived',
      userId: dto.userId,
    });

    await this.encounterEngine.updateStatus({
      tenantId: dto.tenantId,
      encounterId,
      status: 'in-progress',
      userId: dto.userId,
    });

    // 3. Record bitemporal timeline snapshot
    await this.temporalContract.recordTemporalEvent({
      tenantId: dto.tenantId,
      encounterId,
      patientId: dto.patientId,
      aggregateType: 'Encounter',
      aggregateId: encounterId,
      eventType: 'CONSULTATION_STARTED',
      validTime: new Date().toISOString(),
      deltaPayload: {
        providerId: dto.providerId,
        departmentId: dto.departmentId,
        chiefComplaint: dto.chiefComplaint,
      },
    });

    return createRes.encounter;
  }

  /**
   * Records SOAP notes updates and validates ICD-10 diagnoses under encounter aggregate boundary
   */
  async saveSoapAndDiagnoses(dto: SaveSoapAndDiagnosesDTO): Promise<void> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    // 1. Register diagnoses sequentially through the Encounter aggregate root
    for (const diagnosis of dto.diagnoses) {
      const diagRes = await this.encounterEngine.addDiagnosis({
        tenantId: dto.tenantId,
        encounterId: dto.encounterId,
        code: diagnosis.code,
        system: 'ICD-10',
        display: diagnosis.display,
        isPrimary: diagnosis.isPrimary,
        userId: dto.userId,
      });

      if (!diagRes.success) {
        throw new Error(`Failed to add diagnosis: ${diagRes.error}`);
      }
    }

    // 2. Record bitemporal state delta in the temporal engine
    await this.temporalContract.recordTemporalEvent({
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: '00000000-0000-0000-0000-000000000000',
      aggregateType: 'Encounter',
      aggregateId: dto.encounterId,
      eventType: 'SOAP_NOTES_RECORDED',
      validTime: new Date().toISOString(),
      deltaPayload: {
        soapNotes: {
          subjective: dto.subjective,
          objective: dto.objective,
          assessment: dto.assessment,
          plan: dto.plan,
        },
      },
    });
  }

  /**
   * Completes a medical consultation, transitions state to finished, and registers clinical audit package
   */
  async completeConsultation(dto: CompleteConsultationDTO): Promise<{ evidencePackageId: string; sha256Fingerprint: string }> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    // 1. Transition state to finished via Kernel Encounter Engine
    const statusRes = await this.encounterEngine.updateStatus({
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      status: 'finished',
      userId: dto.userId,
    });

    if (!statusRes.success) {
      throw new Error(`Encounter completion failed: ${statusRes.error}`);
    }

    // 2. Record bitemporal completion snapshot
    await this.temporalContract.recordTemporalEvent({
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      aggregateType: 'Encounter',
      aggregateId: dto.encounterId,
      eventType: 'CONSULTATION_COMPLETED',
      validTime: new Date().toISOString(),
      deltaPayload: {
        completedBy: dto.userId,
      },
    });

    // 3. Issue H11 Legal Audit Evidence Package
    const auditRes = await this.auditContract.recordAuditEntry({
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      actionType: 'CONSULTATION_COMPLETE_EXECUTE',
      performerId: dto.userId,
      performerRole: 'PHYSICIAN',
      metadata: {
        actionSummary: 'Outpatient consultation completed successfully.',
      },
    });

    if (!auditRes.success || !auditRes.data) {
      throw new Error(`Clinical audit registration failed: ${auditRes.error?.message}`);
    }

    // Retrieve evidence packages if issued
    const evidencePkgRes = await this.auditContract.issueEvidencePackage(dto.tenantId, auditRes.data.id);
    if (!evidencePkgRes.success || !evidencePkgRes.data) {
      throw new Error(`Evidence package issuance failed: ${evidencePkgRes.error?.message}`);
    }

    return {
      evidencePackageId: evidencePkgRes.data.id,
      sha256Fingerprint: evidencePkgRes.data.fingerprint,
    };
  }
}
