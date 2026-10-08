/**
 * Healthcare Service Locator - Laboratory wiring proof
 *
 * Proves the public laboratory-engine resolution path returns the existing
 * Laboratory contract backed by the repository dependency the engine requires.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { ILaboratoryEngine } from '../contracts/laboratory-engine.contract';
import type { EventBus } from '../engines/order-engine/contracts/event-bus.interface';
import type { OrderApprovedEvent, OrderEvent } from '../engines/order-engine/events/order-events';
import type { ILaboratoryRepository } from '../engines/laboratory-engine/repositories/laboratory-repository.interface';
import type { IClinicalOrderReader } from '../engines/laboratory-engine/contracts/clinical-order-reader.interface';

type LaboratoryRepositoryConstructorInput = SupabaseClient<Database>;

const mockRepositoryInstances: Array<{ supabase: LaboratoryRepositoryConstructorInput }> = [];
const mockLaboratoryConstructorRepositories: unknown[] = [];

function createLaboratoryContract(): ILaboratoryEngine {
  return {
    collectSpecimen: jest.fn(),
    receiveSpecimen: jest.fn(),
    startProcessing: jest.fn(),
    recordResult: jest.fn(),
    verifyResult: jest.fn(),
    acknowledgeCritical: jest.fn(),
  } as ILaboratoryEngine;
}

jest.mock('../engines/laboratory-engine/repositories/supabase-laboratory.repository', () => ({
  SupabaseLaboratoryRepository: jest.fn().mockImplementation((supabase: LaboratoryRepositoryConstructorInput) => {
    const repository = { supabase };
    mockRepositoryInstances.push(repository);
    return repository;
  }),
}));

jest.mock('../engines/laboratory-engine', () => ({
  LaboratoryEngineService: jest.fn().mockImplementation((repository: unknown) => {
    mockLaboratoryConstructorRepositories.push(repository);
    return createLaboratoryContract();
  }),
}));

describe('Healthcare service locator Laboratory wiring', () => {
  const supabase = {} as unknown as SupabaseClient<Database>;

  beforeEach(async () => {
    const { clearServiceCache } = await import('../service-locator');
    clearServiceCache();
    mockRepositoryInstances.length = 0;
    mockLaboratoryConstructorRepositories.length = 0;
  });

  it('resolves laboratory-engine through the public Laboratory contract', async () => {
    const { getHealthcareService, isServiceCached } = await import('../service-locator');
    const laboratoryEngine = getHealthcareService<ILaboratoryEngine>('laboratory-engine', supabase);

    expect(typeof laboratoryEngine.collectSpecimen).toBe('function');
    expect(typeof laboratoryEngine.verifyResult).toBe('function');
    expect(mockRepositoryInstances).toHaveLength(1);
    expect(mockRepositoryInstances[0].supabase).toBe(supabase);
    expect(mockLaboratoryConstructorRepositories).toEqual([mockRepositoryInstances[0]]);
    expect(isServiceCached('laboratory-engine')).toBe(true);
  });

  it('reuses the cached laboratory service instance', async () => {
    const { getHealthcareService } = await import('../service-locator');
    const first = getHealthcareService<ILaboratoryEngine>('laboratory-engine', supabase);
    const second = getHealthcareService<ILaboratoryEngine>('laboratory-engine', supabase);

    expect(second).toBe(first);
    expect(mockRepositoryInstances).toHaveLength(1);
    expect(mockLaboratoryConstructorRepositories).toHaveLength(1);
  });

  it('exposes Laboratory as a registered public Healthcare contract', async () => {
    const contracts = await import('../contracts');

    expect(contracts.LABORATORY_ENGINE_CONTRACT.name).toBe('laboratory-engine');
    expect(contracts.HEALTHCARE_ENGINE_CONTRACTS.map((contract) => contract.name)).toContain('laboratory-engine');
  });
});

describe('Laboratory order subscriber LAB value alignment', () => {
  it('accepts the canonical LAB order type from the Order contract', async () => {
    const { LabOrderApprovedSubscriber } = await import('../engines/laboratory-engine/events/order-approved-subscriber');
    let approvedHandler: ((event: OrderEvent) => Promise<void>) | undefined;

    const eventBus: EventBus = {
      publish: jest.fn(),
      publishBatch: jest.fn(),
      subscribe: jest.fn((eventType: string, handler: (event: OrderEvent) => Promise<void>) => {
        if (eventType === 'OrderApproved') {
          approvedHandler = handler;
        }
      }),
    };

    const savedOrders: Array<{
      tenantId: string;
      encounterId: string;
      patientId: string;
      clinicalOrderId: string;
      testCode: string;
    }> = [];

    const repository: ILaboratoryRepository = {
      findById: jest.fn(),
      findByClinicalOrderId: jest.fn(async () => []),
      save: jest.fn(async (labOrder) => {
        savedOrders.push({
          tenantId: labOrder.tenantId,
          encounterId: labOrder.encounterId,
          patientId: labOrder.patientId,
          clinicalOrderId: labOrder.clinicalOrderId,
          testCode: labOrder.testCode,
        });
      }),
    };

    const reader: IClinicalOrderReader = {
      getOrderSnapshot: jest.fn(async () => ({
        id: 'order-lab-1',
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        patientId: 'patient-1',
        orderType: 'LAB',
        status: 'APPROVED',
        priority: 'ROUTINE',
        testItems: [{ testCode: 'CBC', testName: 'Complete Blood Count' }],
      })),
    };

    new LabOrderApprovedSubscriber(eventBus, repository, reader);

    const event: OrderApprovedEvent = {
      eventType: 'OrderApproved',
      eventId: 'event-1',
      eventVersion: '1.0.0',
      occurredAt: new Date('2026-10-07T00:00:00.000Z'),
      tenantId: 'tenant-1',
      aggregateId: 'order-lab-1',
      aggregateType: 'ClinicalOrder',
      aggregateVersion: 2,
      payload: {
        orderId: 'order-lab-1',
        encounterId: 'enc-1',
        patientId: 'patient-1',
        approvedBy: 'doctor-1',
        approvedAt: new Date('2026-10-07T00:00:00.000Z'),
        previousStatus: 'VALIDATED',
        newStatus: 'APPROVED',
        previousVersion: 1,
        newVersion: 2,
      },
    };

    await approvedHandler?.(event);

    expect(savedOrders).toEqual([
      {
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        patientId: 'patient-1',
        clinicalOrderId: 'order-lab-1',
        testCode: 'CBC',
      },
    ]);
  });
});
