import type {
  BootstrapImagingOrderRequest,
  BootstrapImagingOrderResult,
  IImagingEngine,
  RecordImagingResultRequest,
  RecordImagingResultResult,
} from '../../contracts/imaging-engine.contract';
import type { IImagingRepository, ImagingOrderRecord } from './repositories/imaging-repository.interface';

export class ImagingEngineService implements IImagingEngine {
  constructor(private readonly repository: IImagingRepository) {}

  public async bootstrapImagingOrder(
    request: BootstrapImagingOrderRequest
  ): Promise<BootstrapImagingOrderResult> {
    assertRequired(request.tenantId, 'tenantId');
    assertRequired(request.patientId, 'patientId');
    assertRequired(request.encounterId, 'encounterId');
    assertRequired(request.orderId, 'orderId');
    assertRequired(request.modalityCode, 'modalityCode');
    assertRequired(request.bodyRegion, 'bodyRegion');

    const existingList = await this.repository.findByClinicalOrderId(
      request.tenantId,
      request.orderId
    );
    const existing = existingList.find((record) => (
      record.modalityCode === request.modalityCode && record.bodyRegion === request.bodyRegion
    )) ?? existingList[0];

    if (existing) {
      return mapBootstrapResult(existing, true, request.patientId);
    }

    const imagingOrderId = crypto.randomUUID();
    const record: ImagingOrderRecord = {
      id: imagingOrderId,
      tenantId: request.tenantId,
      patientId: request.patientId,
      encounterId: request.encounterId,
      clinicalOrderId: request.orderId,
      modalityCode: request.modalityCode,
      bodyRegion: request.bodyRegion,
      clinicalIndication: request.clinicalIndication,
      withContrast: request.withContrast,
      dcmStudyUid: `1.2.840.113619.2.${Date.now()}`,
      viewerLink: `https://pacs.bella.vn/viewer?study=${imagingOrderId}`,
      status: 'PENDING',
    };

    await this.repository.save(record);

    return mapBootstrapResult(record, false, request.patientId);
  }

  public async recordImagingResult(
    request: RecordImagingResultRequest
  ): Promise<RecordImagingResultResult> {
    assertRequired(request.tenantId, 'tenantId');
    assertRequired(request.imagingOrderId, 'imagingOrderId');
    assertRequired(request.radiologistReport, 'radiologistReport');
    assertRequired(request.radiologistId, 'radiologistId');

    const verifiedAt = request.verifiedAt ?? new Date().toISOString();
    const updated = await this.repository.recordResult(
      request.tenantId,
      request.imagingOrderId,
      request.radiologistReport,
      request.radiologistId,
      verifiedAt
    );

    if (updated.status !== 'VERIFIED') {
      throw new Error(`IMAGING_RESULT_NOT_VERIFIED: ${updated.status}`);
    }

    return {
      tenantId: updated.tenantId,
      imagingOrderId: updated.id,
      status: 'VERIFIED',
      radiologistReport: request.radiologistReport,
      radiologistId: request.radiologistId,
      verifiedAt,
    };
  }
}

function mapBootstrapResult(
  record: ImagingOrderRecord,
  reusedExisting: boolean,
  requestPatientId: string
): BootstrapImagingOrderResult {
  return {
    tenantId: record.tenantId,
    patientId: record.patientId || requestPatientId,
    encounterId: record.encounterId,
    orderId: record.clinicalOrderId,
    imagingOrderId: record.id,
    modalityCode: record.modalityCode,
    bodyRegion: record.bodyRegion,
    status: record.status,
    reusedExisting,
  };
}

function assertRequired(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`IMAGING_RUNTIME_VALIDATION_FAILED: ${field} is required`);
  }
}
