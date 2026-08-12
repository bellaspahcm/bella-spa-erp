import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LaboratoryEngineService } from '../../laboratory-engine.service';
import { LabOrder } from '../../domain/lab-order.entity';
import { LabResult } from '../../domain/lab-result.entity';
import { TEST_DEFINITIONS } from '../../domain/test-definition';
import { ConcurrencyViolationError } from '../../repositories/laboratory-repository.interface';
import { InMemoryEventBus } from '../../../order-engine/contracts/event-bus.interface';
import { randomUUID } from 'crypto';

class MockLabRepository {
  public findById = jest.fn<any>();
  public findByClinicalOrderId = jest.fn<any>();
  public save = jest.fn<any>();
}

describe('LaboratoryEngineService Unit Tests', () => {
  let repository: MockLabRepository;
  let eventBus: InMemoryEventBus;
  let service: LaboratoryEngineService;

  const tenantId = randomUUID();
  const labOrderId = randomUUID();

  beforeEach(() => {
    repository = new MockLabRepository();
    eventBus = new InMemoryEventBus();
    service = new LaboratoryEngineService(repository as any, eventBus);
  });

  it('should successfully record results and verify results, publishing appropriate events', async () => {
    const order = LabOrder.create({
      id: labOrderId,
      tenantId,
      encounterId: randomUUID(),
      clinicalOrderId: randomUUID(),
      patientId: randomUUID(),
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 4,
    });

    repository.findById.mockResolvedValue(order);
    repository.save.mockResolvedValue(undefined);

    // 1. Record Result
    await service.recordResult(tenantId, labOrderId, '4.5', 'mEq/L');
    expect(order.status).toBe('RESULTED');
    expect(repository.save).toHaveBeenCalledTimes(1);

    // 2. Verify Result
    const verifiedOrder = await service.verifyResult(tenantId, labOrderId, 'tech-1');
    expect(verifiedOrder.status).toBe('VERIFIED');
    expect(verifiedOrder.safetyState).toBe('NORMAL');

    // Verify events published
    const events = eventBus.getPublishedEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('ResultVerified');
    expect(events[0].aggregateId).toBe(labOrderId);
  });

  it('should publish CriticalResultEscalated for critical panic results (Gate 5 Case C)', async () => {
    const order = LabOrder.create({
      id: labOrderId,
      tenantId,
      encounterId: randomUUID(),
      clinicalOrderId: randomUUID(),
      patientId: randomUUID(),
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 4,
    });

    repository.findById.mockResolvedValue(order);
    repository.save.mockResolvedValue(undefined);

    // 1. Record critical high result
    await service.recordResult(tenantId, labOrderId, '6.7', 'mEq/L');

    // 2. Verify
    await service.verifyResult(tenantId, labOrderId, 'tech-1');
    expect(order.safetyState).toBe('ESCALATION_REQUIRED');

    // Both ResultVerified and CriticalResultEscalated should be published
    const events = eventBus.getPublishedEvents();
    expect(events.length).toBe(2);
    expect(events[0].eventType).toBe('ResultVerified');
    expect(events[1].eventType).toBe('CriticalResultEscalated');
    expect(events[1].payload.escalationRequired).toBe(true);
  });

  it('should suppress event emission if database save fails (Gate 5 Case B)', async () => {
    const order = LabOrder.create({
      id: labOrderId,
      tenantId,
      encounterId: randomUUID(),
      clinicalOrderId: randomUUID(),
      patientId: randomUUID(),
      testCode: 'K',
      testName: 'Potassium',
      status: 'RESULTED',
      safetyState: 'NORMAL',
      version: 5,
      result: LabResult.create({
        value: '4.5',
        unit: 'mEq/L',
        referenceRange: '3.5 - 5.1 mEq/L',
        assessment: 'NORMAL',
      }),
    });

    repository.findById.mockResolvedValue(order);
    // Simulate DB crash on save
    repository.save.mockRejectedValue(new Error('Database unique constraint or network error'));

    await expect(service.verifyResult(tenantId, labOrderId, 'tech-1')).rejects.toThrow('Database unique constraint or network error');

    // ZERO events should be published (Event-after-persistence rule)
    const events = eventBus.getPublishedEvents();
    expect(events.length).toBe(0);
  });
});
