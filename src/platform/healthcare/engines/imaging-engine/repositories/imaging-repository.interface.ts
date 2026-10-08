import type { ImagingWorkflowStatus } from '../../../contracts/imaging-engine.contract';

export interface ImagingOrderRecord {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId: string;
  clinicalOrderId: string;
  modalityCode: string;
  bodyRegion: string;
  clinicalIndication?: string;
  withContrast?: boolean;
  dcmStudyUid?: string;
  viewerLink?: string;
  radiologistReport?: string;
  radiologistId?: string;
  verifiedAt?: string;
  status: ImagingWorkflowStatus;
}

export interface IImagingRepository {
  findById(tenantId: string, id: string): Promise<ImagingOrderRecord | null>;
  findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<ImagingOrderRecord[]>;
  save(record: ImagingOrderRecord): Promise<void>;
  recordResult(
    tenantId: string,
    imagingOrderId: string,
    radiologistReport: string,
    radiologistId: string,
    verifiedAt: string
  ): Promise<ImagingOrderRecord>;
}
