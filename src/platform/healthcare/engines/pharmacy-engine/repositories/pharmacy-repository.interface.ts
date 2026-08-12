import type { Prescription, MAREntry } from '../domain/prescription.entity';

export class OptimisticLockError extends Error {
  constructor(prescriptionId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Prescription ${prescriptionId} version mismatch: expected ${expectedVersion}, actual ${actualVersion}. Record was modified by another transaction.`
    );
    this.name = 'OptimisticLockError';
  }
}

export class UniqueConstraintViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniqueConstraintViolationError';
  }
}

export interface IPharmacyRepository {
  /**
   * Persist a Prescription aggregate root.
   * If it already exists, updates it enforcing optimistic locking.
   * 
   * @throws {OptimisticLockError} if version mismatch detected
   * @throws {UniqueConstraintViolationError} if unique clinical_order_id constraint is violated
   */
  savePrescription(prescription: Prescription, expectedVersion?: number): Promise<void>;

  /**
   * Retrieve a Prescription by ID. Returns null if not found.
   */
  findPrescriptionById(tenantId: string, id: string): Promise<Prescription | null>;

  /**
   * Retrieve a Prescription by parent Clinical Order ID. Returns null if not found.
   */
  findPrescriptionByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<Prescription | null>;

  /**
   * Persist a Medication Administration Record (MAR) entry.
   */
  saveMAR(mar: MAREntry): Promise<void>;

  /**
   * Retrieve a MAR entry by ID. Returns null if not found.
   */
  findMARById(tenantId: string, id: string): Promise<MAREntry | null>;

  /**
   * Retrieve all MAR entries associated with a specific prescription item.
   */
  findMARByPrescriptionId(tenantId: string, prescriptionId: string): Promise<MAREntry[]>;

  /**
   * Deduct stock for a medication item using optimistic/conditional locks.
   */
  deductStock(tenantId: string, medicationCode: string, quantity: number): Promise<void>;

  /**
   * Set stock level for a medication item.
   */
  setStock(tenantId: string, medicationCode: string, quantity: number): Promise<void>;

  /**
   * Get stock level.
   */
  getStock(tenantId: string, medicationCode: string): Promise<number>;
}
