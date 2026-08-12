/**
 * Clinical Order Reader Contract Interface
 * 
 * Decouples Pharmacy Engine from Order Engine domain/service layers.
 * 
 * @module platform/healthcare/engines/pharmacy-engine/contracts
 */

export interface ClinicalOrderSnapshot {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  orderType: string;
  orderStatus: string;
  drugCode: string;
  drugName: string;
  dose: number;
  doseUnit: string;
  route: string;
  frequency: string;
  durationDays: number;
}

export interface IClinicalOrderReader {
  /**
   * Fetch a read-only snapshot of a Clinical Order directly from persistence.
   * Returns null if not found.
   */
  getOrderSnapshot(tenantId: string, orderId: string): Promise<ClinicalOrderSnapshot | null>;
}
