import type { LabOrder } from '../engines/laboratory-engine/domain/lab-order.entity';

export interface ILaboratoryEngine {
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
