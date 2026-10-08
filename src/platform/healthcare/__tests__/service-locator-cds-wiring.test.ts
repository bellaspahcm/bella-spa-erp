/**
 * Healthcare Service Locator - CDS wiring proof
 *
 * Proves the public order-engine resolution path injects the existing CDS
 * decision dependency for medication orders.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CdsCheckResult, CdsEngineContract } from '../contracts/cds-engine.contract';
import type {
  ClinicalOrder,
  CreateOrderRequest,
  CreateOrderResult,
  OrderEngineContract,
} from '../contracts/order-engine.contract';
import type { EngineResponse } from '../shared-kernel/types';
import type { Database } from '@/types/database.types';

interface MockDecisionRequest {
  tenantId: string;
  encounterId: string;
  patientId: string;
  actionContext: Record<string, unknown>;
}

interface MockDecisionContract {
  evaluate(request: MockDecisionRequest): Promise<EngineResponse<CdsCheckResult>>;
}

const mockCdsEvaluate = jest.fn<Promise<EngineResponse<CdsCheckResult>>, [MockDecisionRequest]>();
const mockOrderDecisionContracts: Array<MockDecisionContract | undefined> = [];

function createOrderRecord(request: CreateOrderRequest): ClinicalOrder {
  return {
    id: 'order-1',
    tenantId: request.tenantId,
    encounterId: request.encounterId,
    orderType: request.orderType,
    orderStatus: 'VALIDATED',
    priority: request.priority,
    orderedBy: request.orderedBy,
    orderedAt: '2026-10-07T00:00:00.000Z',
    cdsCheckStatus: request.orderType === 'MEDICATION' ? 'PASSED' : undefined,
    orderDetails: request.orderDetails,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
  };
}

jest.mock('../engines/cds-engine', () => ({
  CdsEngineService: jest.fn().mockImplementation(() => ({
    engineName: 'cds-engine',
    engineVersion: 'test',
    evaluate: mockCdsEvaluate,
    checkDrugInteractions: jest.fn(),
    checkAllergyContraindications: jest.fn(),
    checkProtocolAdherence: jest.fn(),
    generateCdsSummary: jest.fn(),
    recordAllergy: jest.fn(),
    getPatientAllergies: jest.fn(),
    healthCheck: jest.fn(),
  })),
}));

jest.mock('../engines/order-engine', () => ({
  OrderEngineService: jest.fn().mockImplementation((
    _supabase: SupabaseClient<Database>,
    decisionContract?: MockDecisionContract
  ) => {
    mockOrderDecisionContracts.push(decisionContract);

    return {
      engineName: 'order-engine',
      engineVersion: 'test',
      createOrder: jest.fn(async (
        request: CreateOrderRequest
      ): Promise<EngineResponse<CreateOrderResult>> => {
        if (request.orderType === 'MEDICATION') {
          if (!decisionContract) {
            return {
              success: false,
              error: {
                code: 'CDS_CONTRACT_MISSING',
                message: 'Decision Contract is required for MEDICATION orders',
                timestamp: '2026-10-07T00:00:00.000Z',
              },
            };
          }

          const decision = await decisionContract.evaluate({
            tenantId: request.tenantId,
            encounterId: request.encounterId,
            patientId: request.patientId ?? '',
            actionContext: {
              proposedDrugCode: 'MED-PARACETAMOL',
              actionType: 'PRESCRIBE',
            },
          });

          if (!decision.success || !decision.data) {
            return {
              success: false,
              error: {
                code: 'CDS_CHECK_FAILED',
                message: 'CDS evaluation failed',
                timestamp: '2026-10-07T00:00:00.000Z',
              },
            };
          }
        }

        return {
          success: true,
          data: {
            order: createOrderRecord(request),
            cdsAlerts: [],
            cdsCheckStatus: 'PASSED',
          },
        };
      }),
      approveOrder: jest.fn(),
      discontinueOrder: jest.fn(),
      getActiveOrders: jest.fn(),
      overrideCdsWarning: jest.fn(),
      healthCheck: jest.fn(),
    };
  }),
}));

describe('Healthcare service locator CDS wiring', () => {
  const supabase = {} as unknown as SupabaseClient<Database>;

  beforeEach(async () => {
    const { clearServiceCache } = await import('../service-locator');
    clearServiceCache();
    mockOrderDecisionContracts.length = 0;
    mockCdsEvaluate.mockReset();
    mockCdsEvaluate.mockResolvedValue({
      success: true,
      data: {
        passed: true,
        hardBlocked: false,
        alerts: [],
        calculationId: 'cds-1',
        knowledgeBaseVersion: 'kb-1',
        policyVersion: 'policy-1',
        evaluatedAt: '2026-10-07T00:00:00.000Z',
      },
    });
  });

  it('injects CDS decision dependency into the order-engine path', async () => {
    const { getHealthcareService } = await import('../service-locator');
    const orderEngine = getHealthcareService<OrderEngineContract>('order-engine', supabase);

    const result = await orderEngine.createOrder({
      requestId: 'req-med-1',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderedBy: 'doctor-1',
      orderDetails: {
        drugCode: 'MED-PARACETAMOL',
        drugName: 'Paracetamol',
        dose: 500,
        doseUnit: 'mg',
        route: 'PO',
        frequency: 'BID',
        currentMedicationCodes: [],
      },
    });

    expect(mockOrderDecisionContracts[0]).toBeDefined();
    expect(mockCdsEvaluate).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
    }));
    expect(result.success).toBe(true);
    expect(result.error?.code).not.toBe('CDS_CONTRACT_MISSING');
  });

  it('does not force CDS evaluation for non-medication orders', async () => {
    const { getHealthcareService } = await import('../service-locator');
    const orderEngine = getHealthcareService<OrderEngineContract>('order-engine', supabase);

    const result = await orderEngine.createOrder({
      requestId: 'req-lab-1',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      orderType: 'LAB',
      priority: 'ROUTINE',
      orderedBy: 'doctor-1',
      orderDetails: {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      },
    });

    expect(mockOrderDecisionContracts[0]).toBeDefined();
    expect(mockCdsEvaluate).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('reuses the cached CDS service when resolving order-engine after cds-engine', async () => {
    const { getHealthcareService } = await import('../service-locator');
    const cdsEngine = getHealthcareService<CdsEngineContract>('cds-engine', supabase);

    getHealthcareService<OrderEngineContract>('order-engine', supabase);

    expect(mockOrderDecisionContracts[0]).toBe(cdsEngine);
  });
});
