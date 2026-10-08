/**
 * BELLA HOSPITAL - BILLING/FINANCE MINIMAL RUNTIME TESTS
 *
 * Proves Hospital hands patient charges and payments to Finance OS through the
 * existing Hospital finance adapter boundary without account-code logic.
 */

import fs from 'fs';
import path from 'path';
import type {
  HospitalFinanceAdapter,
  PatientPaymentReceivedParams,
  PatientServiceCompletedParams,
} from '../../../../platform/healthcare/finance-integration/hospital-finance-adapter';
import type { FinanceOutboxWriteResult } from '../../../../platform/integration-hub/finance-outbox-writer';
import { HospitalBillingFinanceProductService } from '../hospital-billing-finance.service';

type HospitalFinanceContract = Pick<
  HospitalFinanceAdapter,
  'publishPatientServiceCompleted' | 'publishPatientPaymentReceived'
>;

class CapturingHospitalFinanceAdapter implements HospitalFinanceContract {
  public serviceCompletedCalls: PatientServiceCompletedParams[] = [];
  public paymentReceivedCalls: PatientPaymentReceivedParams[] = [];

  async publishPatientServiceCompleted(
    params: PatientServiceCompletedParams
  ): Promise<FinanceOutboxWriteResult> {
    this.serviceCompletedCalls.push(params);
    return {
      outboxId: 'outbox-service-1',
      eventId: 'event-service-1',
      idempotencyKey: params.idempotencyKey ?? 'generated-service-key',
    };
  }

  async publishPatientPaymentReceived(
    params: PatientPaymentReceivedParams
  ): Promise<FinanceOutboxWriteResult> {
    this.paymentReceivedCalls.push(params);
    return {
      outboxId: 'outbox-payment-1',
      eventId: 'event-payment-1',
      idempotencyKey: params.idempotencyKey ?? 'generated-payment-key',
    };
  }
}

describe('HospitalBillingFinanceProductService', () => {
  let financeAdapter: CapturingHospitalFinanceAdapter;
  let service: HospitalBillingFinanceProductService;

  beforeEach(() => {
    financeAdapter = new CapturingHospitalFinanceAdapter();
    service = new HospitalBillingFinanceProductService(financeAdapter);
  });

  it('publishes patient service charge to Finance outbox through HospitalFinanceAdapter', async () => {
    const result = await service.recognizePatientServiceCharge({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      serviceId: 'lab-result-1',
      amount: '500000',
      currency: 'VND',
      serviceType: 'LAB',
      serviceCode: 'CBC',
      providerId: 'doctor-1',
      quantity: 1,
      idempotencyKey: 'tenant-1-charge-lab-result-1',
      correlationId: 'corr-1',
    });

    expect(financeAdapter.serviceCompletedCalls).toHaveLength(1);
    expect(financeAdapter.serviceCompletedCalls[0]).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      patientType: 'INPATIENT',
      encounterId: 'encounter-1',
      encounterType: 'ADMISSION',
      serviceId: 'lab-result-1',
      serviceType: 'LAB',
      serviceCode: 'CBC',
      amount: '500000',
      currency: 'VND',
      idempotencyKey: 'tenant-1-charge-lab-result-1',
    });
    expect(result).toEqual({
      tenantId: 'tenant-1',
      eventType: 'PATIENT_SERVICE_COMPLETED',
      outboxId: 'outbox-service-1',
      eventId: 'event-service-1',
      idempotencyKey: 'tenant-1-charge-lab-result-1',
      downstream: {
        financeOutbox: 'PROVEN',
        ledger: 'FINANCE_OS_DOWNSTREAM_NOT_PROVEN',
        reconciliation: 'FINANCE_OS_DOWNSTREAM_NOT_PROVEN',
        realDbRls: 'NOT_PROVEN',
      },
    });
  });

  it('publishes patient payment to Finance outbox through HospitalFinanceAdapter', async () => {
    const result = await service.recordPatientPayment({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      billId: 'bill-1',
      amount: '500000',
      currency: 'VND',
      idempotencyKey: 'tenant-1-payment-bill-1',
      correlationId: 'corr-2',
    });

    expect(financeAdapter.paymentReceivedCalls).toHaveLength(1);
    expect(financeAdapter.paymentReceivedCalls[0]).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      patientType: 'INPATIENT',
      billId: 'bill-1',
      amount: '500000',
      currency: 'VND',
      idempotencyKey: 'tenant-1-payment-bill-1',
    });
    expect(result.eventType).toBe('PATIENT_PAYMENT_RECEIVED');
    expect(result.downstream.financeOutbox).toBe('PROVEN');
    expect(result.downstream.ledger).toBe('FINANCE_OS_DOWNSTREAM_NOT_PROVEN');
  });

  it('rejects missing tenant before publishing finance event', async () => {
    await expect(service.recordPatientPayment({
      tenantId: ' ',
      patientId: 'patient-1',
      billId: 'bill-1',
      amount: '500000',
      currency: 'VND',
      idempotencyKey: 'tenant-1-payment-bill-1',
    })).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    expect(financeAdapter.paymentReceivedCalls).toHaveLength(0);
  });

  it('does not contain account-code, debit/credit, ledger, or direct persistence logic in Hospital service', () => {
    const sourcePath = path.join(
      process.cwd(),
      'src/products/bella-hospital/services/hospital-billing-finance.service.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain('HospitalFinanceAdapter');
    expect(source).toContain('publishPatientServiceCompleted');
    expect(source).toContain('publishPatientPaymentReceived');
    expect(source).not.toContain('account_code');
    expect(source).not.toContain('debit_amount');
    expect(source).not.toContain('credit_amount');
    expect(source).not.toContain('accounting_entries');
    expect(source).not.toContain('finance_outbox_events');
    expect(source).not.toContain('.from(');
  });
});
