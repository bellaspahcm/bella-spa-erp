export interface ClinicalOrderSnapshot {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  orderType: string;
  status: string;
  priority: string;
  // Specific panel / items requested, stored in Kernel details column
  panelCode?: string;
  testItems?: Array<{
    testCode: string;
    testName: string;
  }>;
}

export interface IClinicalOrderReader {
  /**
   * Fetch clinical order data without leaking its domain objects
   */
  getOrderSnapshot(tenantId: string, orderId: string): Promise<ClinicalOrderSnapshot | null>;
}
