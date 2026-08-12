import type { LabOrder } from '../domain/lab-order.entity';

export class ConcurrencyViolationError extends Error {
  constructor(message: string = 'Version conflict: Record was modified by another transaction') {
    super(message);
    this.name = 'ConcurrencyViolationError';
  }
}

export interface ILaboratoryRepository {
  /**
   * Find laboratory order by ID
   */
  findById(tenantId: string, id: string): Promise<LabOrder | null>;

  /**
   * Find all laboratory orders for a clinical order ID
   */
  findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<LabOrder[]>;

  /**
   * Save (insert or update) LabOrder aggregate in database
   */
  save(labOrder: LabOrder): Promise<void>;
}
