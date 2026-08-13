import type { ILaboratoryEngine } from '../../contracts/laboratory-engine.contract';
import type { ILaboratoryRepository } from './repositories/laboratory-repository.interface';
import type { EventBus } from '../order-engine/contracts/event-bus.interface';
import { LabOrder } from './domain/lab-order.entity';
import { TEST_DEFINITIONS, type TestDefinition } from './domain/test-definition';

import { ConcurrencyViolationError } from './repositories/laboratory-repository.interface';

export class LaboratoryEngineService implements ILaboratoryEngine {
  constructor(
    private readonly repository: ILaboratoryRepository,
    private readonly eventBus: EventBus
  ) {}

  public async collectSpecimen(
    tenantId: string,
    labOrderId: string,
    sampleType: string,
    tubeColor: string
  ): Promise<LabOrder> {
    const labOrder = await this.getLabOrderOrThrow(tenantId, labOrderId);

    labOrder.collectSpecimen(sampleType, tubeColor);

    // Persist aggregate state
    await this.repository.save(labOrder);

    // Event-after-persistence
    await this.eventBus.publish({
      eventType: 'SpecimenCollected',
      tenantId,
      aggregateId: labOrderId,
      payload: {
        labOrderId,
        encounterId: labOrder.encounterId,
        tenantId,
        sampleType,
        tubeColor,
        collectedAt: labOrder.specimen?.collectedAt?.toISOString() || new Date().toISOString(),
      },
    });

    return labOrder;
  }

  public async receiveSpecimen(tenantId: string, labOrderId: string): Promise<LabOrder> {
    const labOrder = await this.getLabOrderOrThrow(tenantId, labOrderId);

    labOrder.receiveSpecimen();

    await this.repository.save(labOrder);

    return labOrder;
  }

  public async startProcessing(tenantId: string, labOrderId: string): Promise<LabOrder> {
    const labOrder = await this.getLabOrderOrThrow(tenantId, labOrderId);

    labOrder.startProcessing();

    await this.repository.save(labOrder);

    return labOrder;
  }

  public async recordResult(
    tenantId: string,
    labOrderId: string,
    value: string,
    unit: string
  ): Promise<LabOrder> {
    const labOrder = await this.getLabOrderOrThrow(tenantId, labOrderId);

    // Fetch dynamic test range definitions policy
    const definition = TEST_DEFINITIONS[labOrder.testCode] || {
      testCode: labOrder.testCode,
      testName: labOrder.testName,
      unit,
      referenceRange: 'Normal',
    };

    labOrder.recordResult(value, unit, definition);

    await this.repository.save(labOrder);

    return labOrder;
  }

  public async verifyResult(
    tenantId: string,
    labOrderId: string,
    verifiedBy: string
  ): Promise<LabOrder> {
    const labOrder = await this.getLabOrderOrThrow(tenantId, labOrderId);

    if (labOrder.status === 'VERIFIED') {
      throw new ConcurrencyViolationError(
        `Optimistic concurrency violation: LabOrder ${labOrderId} has already been verified.`
      );
    }

    // Perform verification transition in domain aggregate
    labOrder.verify(verifiedBy);

    // 1. Persist the updated aggregate state first (Single-Transaction command)
    await this.repository.save(labOrder);

    // 2. Publish domain events ONLY after successful commit (Event-after-persistence rule)
    if (labOrder.result) {
      await this.eventBus.publish({
        eventType: 'ResultVerified',
        tenantId,
        aggregateId: labOrderId,
        payload: {
          labOrderId,
          encounterId: labOrder.encounterId,
          tenantId,
          testCode: labOrder.testCode,
          testName: labOrder.testName,
          value: labOrder.result.value,
          unit: labOrder.result.unit,
          referenceRange: labOrder.result.referenceRange,
          isAbnormal: labOrder.result.isAbnormal,
          isPanicValue: labOrder.result.isPanicValue,
          verifiedBy,
          verifiedAt: labOrder.result.verifiedAt?.toISOString() || new Date().toISOString(),
        },
      });

      // Escalation trigger check (Safety-state escalation)
      if (labOrder.result.isPanicValue && labOrder.escalationRequired) {
        await this.eventBus.publish({
          eventType: 'CriticalResultEscalated',
          tenantId,
          aggregateId: labOrderId,
          payload: {
            labOrderId,
            encounterId: labOrder.encounterId,
            tenantId,
            testCode: labOrder.testCode,
            testName: labOrder.testName,
            value: labOrder.result.value,
            unit: labOrder.result.unit,
            verifiedBy,
            verifiedAt: labOrder.result.verifiedAt?.toISOString() || new Date().toISOString(),
            escalationRequired: true,
          },
        });
      }
    }

    return labOrder;
  }

  public async acknowledgeCritical(
    tenantId: string,
    labOrderId: string,
    acknowledgedBy: string
  ): Promise<LabOrder> {
    const labOrder = await this.getLabOrderOrThrow(tenantId, labOrderId);

    // Safety acknowledgment transition
    labOrder.acknowledgeCritical(acknowledgedBy);

    await this.repository.save(labOrder);

    return labOrder;
  }

  // Helper
  private async getLabOrderOrThrow(tenantId: string, labOrderId: string): Promise<LabOrder> {
    const labOrder = await this.repository.findById(tenantId, labOrderId);
    if (!labOrder) {
      throw new Error(`LabOrder not found: ${labOrderId}`);
    }
    return labOrder;
  }
}
