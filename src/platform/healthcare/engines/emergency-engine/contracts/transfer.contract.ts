/**
 * Transfer Contract Interface
 *
 * Provides contract for external/inter-department transfer requests initiated by Disposition.
 * Emergency Disposition decides TRANSFER, and orchestrates via this contract
 * without owning the transfer destination lifecycle.
 *
 * @module platform/healthcare/engines/emergency-engine/contracts
 */

export interface InitiateTransferRequest {
  tenantId: string;
  encounterId: string;
  patientId: string;
  receivingFacilityName: string;
  transferReason: string;
  transportMode: string;
  receivingPhysicianName?: string;
  initiatedBy: string;
}

export interface InitiateTransferResponse {
  transferId: string;
  status: 'INITIATED';
  initiatedAt: string;
}

export interface ITransferContract {
  initiateTransfer(request: InitiateTransferRequest): Promise<InitiateTransferResponse>;
}
