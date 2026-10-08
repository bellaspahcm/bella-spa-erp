import type { ContractMetadata } from '../../host/contract-registry/types';

export type ImagingWorkflowStatus =
  | 'PENDING'
  | 'CAPTURED'
  | 'REPORTED'
  | 'VERIFIED'
  | 'CANCELLED';

export interface BootstrapImagingOrderRequest {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  modalityCode: string;
  bodyRegion: string;
  clinicalIndication?: string;
  withContrast?: boolean;
}

export interface BootstrapImagingOrderResult {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  imagingOrderId: string;
  modalityCode: string;
  bodyRegion: string;
  status: ImagingWorkflowStatus;
  reusedExisting: boolean;
}

export interface RecordImagingResultRequest {
  tenantId: string;
  imagingOrderId: string;
  radiologistReport: string;
  radiologistId: string;
  verifiedAt?: string;
}

export interface RecordImagingResultResult {
  tenantId: string;
  imagingOrderId: string;
  status: 'VERIFIED';
  radiologistReport: string;
  radiologistId: string;
  verifiedAt: string;
}

export interface IImagingEngine {
  /**
   * Bootstrap an Imaging/RIS order from an approved Clinical Order.
   *
   * Idempotent for the same tenant and clinical order. Products use this
   * public semantic instead of accessing RIS repositories or `hc_*`
   * persistence directly.
   */
  bootstrapImagingOrder(request: BootstrapImagingOrderRequest): Promise<BootstrapImagingOrderResult>;

  /**
   * Record and verify the radiology report for an Imaging/RIS order.
   *
   * This public semantic captures the minimal existing RIS result behavior
   * without exposing persistence rows or PACS internals.
   */
  recordImagingResult(request: RecordImagingResultRequest): Promise<RecordImagingResultResult>;
}

export const IMAGING_ENGINE_CONTRACT: ContractMetadata = {
  name: 'imaging-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Imaging/RIS public contract for order bootstrap and verified radiology result semantics',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [],
  metadata: {
    runtimeStatus: 'minimal_runtime_available',
    eventSemantics: 'NO_NEW_EVENT',
    temporalAlignment: 'NOT_PROVEN',
  },
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
