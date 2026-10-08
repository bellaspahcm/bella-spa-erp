import type { LabOrder } from '../engines/laboratory-engine/domain/lab-order.entity';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface BootstrapLabOrderRequest {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  testCode: string;
  testName: string;
}

export interface BootstrapLabOrderResult {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  labOrderId: string;
  testCode: string;
  testName: string;
  status: LabOrder['status'];
  reusedExisting: boolean;
}

export interface ILaboratoryEngine {
  /**
   * Bootstrap a Laboratory order aggregate from an approved Clinical Order.
   *
   * Idempotent for the same tenant, clinical order, and test code.
   * Products use this public semantic instead of accessing Laboratory
   * repositories or `hc_*` persistence directly.
   */
  bootstrapLabOrder(request: BootstrapLabOrderRequest): Promise<BootstrapLabOrderResult>;

  /**
   * Collect a specimen for a lab order item
   */
  collectSpecimen(
    tenantId: string,
    labOrderId: string,
    sampleType: string,
    tubeColor: string
  ): Promise<LabOrder>;

  /**
   * Receive the collected specimen at the lab
   */
  receiveSpecimen(tenantId: string, labOrderId: string): Promise<LabOrder>;

  /**
   * Start processing/analyzing the specimen
   */
  startProcessing(tenantId: string, labOrderId: string): Promise<LabOrder>;

  /**
   * Record the raw result of a laboratory test
   */
  recordResult(
    tenantId: string,
    labOrderId: string,
    value: string,
    unit: string
  ): Promise<LabOrder>;

  /**
   * Verify the results of a lab order item, assessing normal/abnormal/critical ranges
   */
  verifyResult(
    tenantId: string,
    labOrderId: string,
    verifiedBy: string
  ): Promise<LabOrder>;

  /**
   * Acknowledge a critical/panic result to clear safety escalation state
   */
  acknowledgeCritical(
    tenantId: string,
    labOrderId: string,
    acknowledgedBy: string
  ): Promise<LabOrder>;
}

export const LABORATORY_ENGINE_CONTRACT: ContractMetadata = {
  name: 'laboratory-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Laboratory engine for specimen workflow, result recording, and result verification',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'SpecimenCollected',
      version: '1.0.0',
      summary: 'Published when a laboratory specimen is collected',
      payloadSchema: {
        schemaId: 'specimen-collected-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object', properties: {} },
      },
      publisher: 'laboratory-engine',
      subscribers: ['temporal-engine', 'audit-compliance-engine'],
    },
    {
      eventType: 'ResultVerified',
      version: '1.0.0',
      summary: 'Published when a laboratory result is verified',
      payloadSchema: {
        schemaId: 'lab-result-verified-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object', properties: {} },
      },
      publisher: 'laboratory-engine',
      subscribers: ['temporal-engine', 'audit-compliance-engine', 'billing-engine'],
    },
    {
      eventType: 'CriticalResultEscalated',
      version: '1.0.0',
      summary: 'Published when a verified laboratory result requires critical escalation',
      payloadSchema: {
        schemaId: 'critical-lab-result-escalated-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object', properties: {} },
      },
      publisher: 'laboratory-engine',
      subscribers: ['cds-engine', 'notification-hub', 'audit-compliance-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
