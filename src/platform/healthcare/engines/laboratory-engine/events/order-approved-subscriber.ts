import type { EventBus } from '../../order-engine/contracts/event-bus.interface';
import type { OrderApprovedEvent } from '../../order-engine/events/order-events';
import type { ILaboratoryRepository } from '../repositories/laboratory-repository.interface';
import type { IClinicalOrderReader } from '../contracts/clinical-order-reader.interface';
import { LabOrder } from '../domain/lab-order.entity';
import { randomUUID } from 'crypto';

export class LabOrderApprovedSubscriber {
  constructor(
    private readonly eventBus: EventBus,
    private readonly repository: ILaboratoryRepository,
    private readonly reader: IClinicalOrderReader
  ) {
    this.register();
  }

  private register(): void {
    this.eventBus.subscribe('OrderApproved', async (event) => {
      if (event.eventType !== 'OrderApproved') {
        return;
      }
      await this.handle(event as OrderApprovedEvent);
    });
  }

  private async handle(event: OrderApprovedEvent): Promise<void> {
    const { tenantId, aggregateId: orderId } = event;
    const { encounterId, patientId } = event.payload;

    try {
      // 1. Fetch clinical order using decoupled reader (Gate 4)
      const snapshot = await this.reader.getOrderSnapshot(tenantId, orderId);
      if (!snapshot) {
        return;
      }

      // 2. Only process laboratory orders
      if (snapshot.orderType !== 'laboratory') {
        return;
      }

      const testItems = snapshot.testItems || [
        { testCode: 'K', testName: 'Potassium' } // Default fallback test item if none specified
      ];

      for (const item of testItems) {
        // Check if LabOrder already exists for this test code under this clinical order (idempotency check)
        const existingList = await this.repository.findByClinicalOrderId(tenantId, orderId);
        const duplicate = existingList.find((lo) => lo.testCode === item.testCode);
        if (duplicate) {
          continue;
        }

        // 3. Create LabOrder Aggregate Root
        const labOrder = LabOrder.create({
          id: randomUUID(),
          tenantId,
          encounterId,
          clinicalOrderId: orderId,
          patientId,
          testCode: item.testCode,
          testName: item.testName,
          status: 'ORDERED',
          safetyState: 'NORMAL',
          version: 1,
        });

        // 4. Save to repository (Single Transaction)
        await this.repository.save(labOrder);
      }
    } catch (error) {
      console.error(`[LabOrderApprovedSubscriber] Error handling OrderApproved for order ${orderId}:`, error);
      throw error;
    }
  }
}
