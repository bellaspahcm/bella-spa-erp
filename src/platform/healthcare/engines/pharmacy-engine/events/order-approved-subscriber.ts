import type { EventBus } from '../../order-engine/contracts/event-bus.interface';
import type { OrderApprovedEvent } from '../../order-engine/events/order-events';
import type { IPharmacyRepository } from '../repositories/pharmacy-repository.interface';
import type { IClinicalOrderReader } from '../contracts/clinical-order-reader.interface';
import { Prescription } from '../domain/prescription.entity';
import { UniqueConstraintViolationError } from '../repositories/pharmacy-repository.interface';

export class OrderApprovedSubscriber {
  constructor(
    private readonly eventBus: EventBus,
    private readonly pharmacyRepository: IPharmacyRepository,
    private readonly clinicalOrderReader: IClinicalOrderReader
  ) {
    this.register();
  }

  private register(): void {
    this.eventBus.subscribe('OrderApproved', async (event) => {
      // Cast the event to OrderApprovedEvent safely
      if (event.eventType !== 'OrderApproved') {
        return;
      }
      
      await this.handle(event as OrderApprovedEvent);
    });
  }

  private async handle(event: OrderApprovedEvent): Promise<void> {
    const { tenantId, aggregateId: orderId } = event;
    const { approvedBy, encounterId, patientId } = event.payload;

    try {
      // 1. Fetch clinical order details using the decoupled reader contract
      const snapshot = await this.clinicalOrderReader.getOrderSnapshot(tenantId, orderId);
      if (!snapshot) {
        console.warn(`[OrderApprovedSubscriber] Order snapshot not found for orderId ${orderId} in tenant ${tenantId}. Ignoring.`);
        return;
      }

      // 2. Filter out non-medication orders (Directive 3)
      if (snapshot.orderType !== 'MEDICATION') {
        return;
      }

      // 3. Application-level idempotency check: check if prescription already exists for this order
      const existing = await this.pharmacyRepository.findPrescriptionByClinicalOrderId(tenantId, orderId);
      if (existing) {
        console.info(`[OrderApprovedSubscriber] Prescription already exists for order ${orderId}. Idempotent exit.`);
        return;
      }

      // 4. Map and construct Prescription domain aggregate root
      const prescription = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId: patientId,
        doctorPartyId: approvedBy,
        clinicalOrderId: orderId,
        drugs: [
          {
            code: snapshot.drugCode,
            name: snapshot.drugName,
            dose: `${snapshot.dose} ${snapshot.doseUnit}`,
            frequency: snapshot.frequency,
            durationDays: snapshot.durationDays,
          },
        ],
        createdBy: approvedBy,
      });

      // 5. Persist to database (unique constraint on clinical_order_id handles concurrency race conditions)
      await this.pharmacyRepository.savePrescription(prescription);

      console.info(`[OrderApprovedSubscriber] Successfully bootstrapped prescription ${prescription.id} from approved order ${orderId}.`);
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        // Concurrency race condition: database UNIQUE constraint caught a parallel insert.
        // Handled as idempotent success.
        console.warn(`[OrderApprovedSubscriber] Unique constraint triggered for orderId ${orderId}. Handled idempotently.`);
        return;
      }
      
      // Let other database / system errors bubble up
      console.error(`[OrderApprovedSubscriber] Error processing OrderApproved event for order ${orderId}:`, error);
      throw error;
    }
  }
}
