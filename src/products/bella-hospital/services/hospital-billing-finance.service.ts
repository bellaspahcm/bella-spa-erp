/**
 * BELLA HOSPITAL - BILLING/FINANCE GO-LIVE PRODUCT SERVICE
 *
 * Minimal Hospital runtime orchestration for patient service charge and payment
 * handoff to Finance OS through the existing HospitalFinanceAdapter.
 *
 * Hospital does not resolve accounting policy, debit/credit entries, ledger
 * accounts, or reconciliation state. Those remain Finance OS responsibilities.
 *
 * @module src/products/bella-hospital/services/hospital-billing-finance.service
 */

import type {
  HospitalFinanceAdapter,
  PatientPaymentReceivedParams,
  PatientServiceCompletedParams,
} from '../../../platform/healthcare/finance-integration/hospital-finance-adapter';
import type { FinanceOutboxWriteResult } from '../../../platform/integration-hub/finance-outbox-writer';

type HospitalFinanceContract = Pick<
  HospitalFinanceAdapter,
  'publishPatientServiceCompleted' | 'publishPatientPaymentReceived'
>;

export interface HospitalServiceChargeDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  serviceId: string;
  amount: string;
  currency: string;
  serviceType: NonNullable<PatientServiceCompletedParams['serviceType']>;
  serviceCode?: string;
  providerId?: string;
  quantity?: number;
  idempotencyKey: string;
  correlationId?: string;
}

export interface HospitalPatientPaymentDTO {
  tenantId: string;
  patientId: string;
  billId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  correlationId?: string;
}

export interface HospitalFinanceRuntimeDTO {
  tenantId: string;
  eventType: 'PATIENT_SERVICE_COMPLETED' | 'PATIENT_PAYMENT_RECEIVED';
  outboxId: string;
  eventId: string;
  idempotencyKey: string;
  downstream: {
    financeOutbox: 'PROVEN';
    ledger: 'FINANCE_OS_DOWNSTREAM_NOT_PROVEN';
    reconciliation: 'FINANCE_OS_DOWNSTREAM_NOT_PROVEN';
    realDbRls: 'NOT_PROVEN';
  };
}

export class HospitalBillingFinanceProductService {
  constructor(private readonly financeContract: HospitalFinanceContract) {}

  async recognizePatientServiceCharge(dto: HospitalServiceChargeDTO): Promise<HospitalFinanceRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.serviceId, 'serviceId');
    assertRequired(dto.amount, 'amount');
    assertRequired(dto.currency, 'currency');
    assertRequired(dto.idempotencyKey, 'idempotencyKey');

    const result = await this.financeContract.publishPatientServiceCompleted({
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      patientType: 'INPATIENT',
      encounterId: dto.encounterId,
      encounterType: 'ADMISSION',
      providerId: dto.providerId,
      serviceId: dto.serviceId,
      serviceType: dto.serviceType,
      serviceCode: dto.serviceCode,
      quantity: dto.quantity,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
      correlationId: dto.correlationId,
    });

    return mapFinanceOutboxResult(dto.tenantId, 'PATIENT_SERVICE_COMPLETED', result);
  }

  async recordPatientPayment(dto: HospitalPatientPaymentDTO): Promise<HospitalFinanceRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.billId, 'billId');
    assertRequired(dto.amount, 'amount');
    assertRequired(dto.currency, 'currency');
    assertRequired(dto.idempotencyKey, 'idempotencyKey');

    const result = await this.financeContract.publishPatientPaymentReceived({
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      patientType: 'INPATIENT',
      billId: dto.billId,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
      correlationId: dto.correlationId,
    });

    return mapFinanceOutboxResult(dto.tenantId, 'PATIENT_PAYMENT_RECEIVED', result);
  }
}

function assertTenant(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
  }
}

function assertRequired(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`HOSPITAL_FINANCE_RUNTIME_VALIDATION_FAILED: ${field} is required`);
  }
}

function mapFinanceOutboxResult(
  tenantId: string,
  eventType: HospitalFinanceRuntimeDTO['eventType'],
  result: FinanceOutboxWriteResult
): HospitalFinanceRuntimeDTO {
  return {
    tenantId,
    eventType,
    outboxId: result.outboxId,
    eventId: result.eventId,
    idempotencyKey: result.idempotencyKey,
    downstream: {
      financeOutbox: 'PROVEN',
      ledger: 'FINANCE_OS_DOWNSTREAM_NOT_PROVEN',
      reconciliation: 'FINANCE_OS_DOWNSTREAM_NOT_PROVEN',
      realDbRls: 'NOT_PROVEN',
    },
  };
}
