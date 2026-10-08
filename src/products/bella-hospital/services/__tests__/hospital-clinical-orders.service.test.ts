/**
 * BELLA HOSPITAL - CLINICAL ORDERS MINIMAL RUNTIME TESTS
 *
 * Proves Hospital consumes Clinical Orders through the public Order Engine
 * contract only.
 */

import type {
  ClinicalOrder,
  CreateOrderResult,
  OrderEngineContract,
} from '../../../../platform/healthcare/contracts/order-engine.contract';
import { HospitalClinicalOrdersProductService } from '../hospital-clinical-orders.service';

type OrderContractSubset = Pick<
  OrderEngineContract,
  'createOrder' | 'approveOrder' | 'getActiveOrders'
>;

describe('HospitalClinicalOrdersProductService', () => {
  const order: ClinicalOrder = {
    id: 'order-1',
    tenantId: 'tenant-1',
    encounterId: 'enc-1',
    orderType: 'MEDICATION',
    orderStatus: 'VALIDATED',
    priority: 'ROUTINE',
    orderedBy: 'doctor-1',
    orderedAt: '2026-10-07T00:00:00.000Z',
    cdsCheckStatus: 'PASSED',
    orderDetails: {
      drugCode: 'MED-PARACETAMOL',
      drugName: 'Paracetamol',
      dose: 500,
      doseUnit: 'mg',
      route: 'PO',
      frequency: 'BID',
      currentMedicationCodes: [],
    },
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
  };

  const createResult: CreateOrderResult = {
    order,
    cdsAlerts: [],
    cdsCheckStatus: 'PASSED',
  };

  let orderContract: jest.Mocked<OrderContractSubset>;
  let service: HospitalClinicalOrdersProductService;

  beforeEach(() => {
    orderContract = {
      createOrder: jest.fn().mockResolvedValue({ success: true, data: createResult }),
      approveOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { ...order, orderStatus: 'APPROVED', approvedBy: 'doctor-1' },
      }),
      getActiveOrders: jest.fn().mockResolvedValue({ success: true, data: [order] }),
    };
    service = new HospitalClinicalOrdersProductService(orderContract);
  });

  it('creates a clinical order through the public Order Engine contract', async () => {
    const result = await service.createClinicalOrder({
      requestId: 'req-1',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderDetails: order.orderDetails,
      notes: 'Give after meal',
      actor: { actorId: 'doctor-1', role: 'doctor' },
    });

    expect(result).toEqual({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      encounterId: 'enc-1',
      orderType: 'MEDICATION',
      orderStatus: 'VALIDATED',
      priority: 'ROUTINE',
      orderedBy: 'doctor-1',
      orderedAt: '2026-10-07T00:00:00.000Z',
      cdsCheckStatus: 'PASSED',
      cdsAlertsCount: 0,
    });
    expect(orderContract.createOrder).toHaveBeenCalledWith({
      requestId: 'req-1',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderedBy: 'doctor-1',
      orderDetails: order.orderDetails,
      notes: 'Give after meal',
    });
  });

  it('approves and reads active orders through the public Order Engine contract', async () => {
    await expect(service.approveClinicalOrder({
      requestId: 'req-approve-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      actor: { actorId: 'doctor-1', role: 'doctor' },
    })).resolves.toMatchObject({
      orderId: 'order-1',
      orderStatus: 'APPROVED',
    });

    await expect(service.getActiveClinicalOrders({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      orderType: 'MEDICATION',
      actor: { actorId: 'nurse-1', role: 'nurse' },
    })).resolves.toHaveLength(1);

    expect(orderContract.approveOrder).toHaveBeenCalledWith({
      requestId: 'req-approve-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      approvedBy: 'doctor-1',
    });
    expect(orderContract.getActiveOrders).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      orderType: 'MEDICATION',
    });
  });

  it('enforces tenant, actor, encounter, and patient boundaries before contract calls', async () => {
    await expect(service.createClinicalOrder({
      requestId: 'req-1',
      tenantId: '',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderDetails: order.orderDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
    })).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    await expect(service.createClinicalOrder({
      requestId: 'req-1',
      tenantId: 'tenant-1',
      encounterId: '',
      patientId: 'pat-1',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderDetails: order.orderDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
    })).rejects.toThrow('CLINICAL_ORDER_VALIDATION_FAILED: encounterId is required');

    await expect(service.createClinicalOrder({
      requestId: 'req-1',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: '',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderDetails: order.orderDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
    })).rejects.toThrow('CLINICAL_ORDER_VALIDATION_FAILED: patientId is required');

    await expect(service.approveClinicalOrder({
      requestId: 'req-approve-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      actor: { actorId: 'nurse-1', role: 'nurse' },
    })).rejects.toThrow('AUTHORIZATION_VIOLATION');

    expect(orderContract.createOrder).not.toHaveBeenCalled();
    expect(orderContract.approveOrder).not.toHaveBeenCalled();
  });

  it('normalizes Order Engine errors without legacy or internal fallbacks', async () => {
    orderContract.createOrder.mockResolvedValueOnce({
      success: false,
      error: {
        code: 'CDS_BLOCKED',
        message: 'Medication order blocked by CDS',
        timestamp: '2026-10-07T00:00:00.000Z',
      },
    });

    await expect(service.createClinicalOrder({
      requestId: 'req-blocked-1',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderDetails: order.orderDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
    })).rejects.toThrow('CDS_BLOCKED: Medication order blocked by CDS');
  });
});
