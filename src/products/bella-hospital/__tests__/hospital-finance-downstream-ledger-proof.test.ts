/**
 * BELLA HOSPITAL - FINANCE DOWNSTREAM LEDGER PROOF
 *
 * Proves Hospital finance events can flow through Finance OS semantic,
 * intent, COA, and ledger-posting instruction generation without Hospital
 * embedding account-code or debit/credit logic.
 */

import { FinanceEventHandler } from '../../../platform/finance/finance-event-handler';
import type {
  AccountMapping,
  FinanceKernelClient,
  FinanceTransaction,
  PolicyContext,
  PolicyContextResolver,
  PostingInstruction,
} from '../../../platform/finance/finance-event-handler';
import { DefaultSemanticResolver } from '../../../platform/finance/resolvers/semantic-resolver.service';
import { DefaultIntentGenerator } from '../../../platform/finance/resolvers/intent-generator.service';
import { DefaultCOAResolver } from '../../../platform/finance/resolvers/coa-resolver.service';
import { InMemoryIdempotencyStore } from '../../../platform/finance/resolvers/idempotency-store.service';
import type { FinanceEventEnvelope } from '../../../platform/integration-hub/finance-event-contract.types';

class FixedPolicyContextResolver implements PolicyContextResolver {
  async resolve(): Promise<PolicyContext> {
    return {
      version: 'v1.0',
      regime: 'TEST_REGIME',
      recognition_rules: {},
    };
  }
}

class CapturingFinanceKernelClient implements FinanceKernelClient {
  public instructions: PostingInstruction[] = [];

  async persist(instruction: PostingInstruction): Promise<FinanceTransaction> {
    this.instructions.push(instruction);

    return {
      transaction_id: `tx-${this.instructions.length}`,
      status: 'COMMITTED',
    };
  }
}

function createHandler(kernelClient: CapturingFinanceKernelClient): FinanceEventHandler {
  return new FinanceEventHandler(
    new DefaultSemanticResolver(),
    new DefaultIntentGenerator(),
    new FixedPolicyContextResolver(),
    new DefaultCOAResolver(),
    kernelClient,
    new InMemoryIdempotencyStore()
  );
}

function patientServiceCompletedEnvelope(): FinanceEventEnvelope {
  return {
    event_id: 'event-service-1',
    event_type: 'PATIENT_SERVICE_COMPLETED',
    idempotency_key: 'tenant-1-service-lab-1',
    occurred_at: '2026-10-07T01:00:00.000Z',
    created_at: '2026-10-07T01:00:01.000Z',
    tenant_id: 'tenant-1',
    source_system: 'HOSPITAL_OS',
    source_version: '1.0.0',
    correlation_id: 'corr-service-1',
    amount: '500000',
    currency: 'VND',
    business_context: {
      patient: { patient_id: 'patient-1', patient_type: 'INPATIENT' },
      encounter: {
        encounter_id: 'encounter-1',
        encounter_type: 'ADMISSION',
        encounter_date: '2026-10-07T00:00:00.000Z',
      },
      service: {
        service_id: 'lab-result-1',
        service_type: 'LAB',
        service_code: 'CBC',
        quantity: 1,
      },
    },
    business_references: [
      { entity_type: 'encounter', entity_id: 'encounter-1' },
      { entity_type: 'service', entity_id: 'lab-result-1', parent_id: 'encounter-1' },
    ],
  };
}

function patientPaymentReceivedEnvelope(): FinanceEventEnvelope {
  return {
    event_id: 'event-payment-1',
    event_type: 'PATIENT_PAYMENT_RECEIVED',
    idempotency_key: 'tenant-1-payment-bill-1',
    occurred_at: '2026-10-07T02:00:00.000Z',
    created_at: '2026-10-07T02:00:01.000Z',
    tenant_id: 'tenant-1',
    source_system: 'HOSPITAL_OS',
    source_version: '1.0.0',
    correlation_id: 'corr-payment-1',
    amount: '500000',
    currency: 'VND',
    business_context: {
      patient: { patient_id: 'patient-1', patient_type: 'INPATIENT' },
      billing: {
        bill_id: 'bill-1',
        bill_date: '2026-10-07T02:00:00.000Z',
        payer_type: 'PATIENT',
      },
    },
    business_references: [
      { entity_type: 'bill', entity_id: 'bill-1' },
      { entity_type: 'patient', entity_id: 'patient-1' },
    ],
  };
}

function instructionIntents(instruction: PostingInstruction): string[] {
  return instruction.metadata?.accounting_intents?.map((intent) => intent.intent_type) ?? [];
}

function instructionMappings(instruction: PostingInstruction): AccountMapping[] {
  return instruction.metadata?.account_mappings ?? [];
}

describe('Hospital Finance downstream ledger proof', () => {
  it('turns PATIENT_SERVICE_COMPLETED into balanced revenue and receivable posting instruction', async () => {
    const kernelClient = new CapturingFinanceKernelClient();
    const handler = createHandler(kernelClient);

    const result = await handler.handle(patientServiceCompletedEnvelope());

    expect(result).toMatchObject({
      status: 'CREATED',
      transaction_id: 'tx-1',
      metadata: {
        semantic: 'PATIENT_SERVICE_REVENUE',
        intents: ['RECOGNIZE_RECEIVABLE', 'RECOGNIZE_REVENUE'],
      },
    });
    expect(kernelClient.instructions).toHaveLength(1);
    expect(kernelClient.instructions[0].entries).toEqual([
      {
        account_id: '1311',
        debit: '500000',
        credit: '0',
        description: 'Recognize receivable: LAB',
      },
      {
        account_id: '4111',
        debit: '0',
        credit: '500000',
        description: 'Recognize revenue: LAB',
      },
    ]);
    expect(instructionIntents(kernelClient.instructions[0])).toEqual([
      'RECOGNIZE_RECEIVABLE',
      'RECOGNIZE_REVENUE',
    ]);
    expect(instructionMappings(kernelClient.instructions[0]).map((mapping) => mapping.account_code)).toEqual([
      '1311',
      '4111',
    ]);
  });

  it('turns PATIENT_PAYMENT_RECEIVED into balanced cash and receivable settlement posting instruction', async () => {
    const kernelClient = new CapturingFinanceKernelClient();
    const handler = createHandler(kernelClient);

    const result = await handler.handle(patientPaymentReceivedEnvelope());

    expect(result).toMatchObject({
      status: 'CREATED',
      transaction_id: 'tx-1',
      metadata: {
        semantic: 'CASH_RECEIPT',
        intents: ['RECOGNIZE_CASH', 'SETTLE_RECEIVABLE'],
      },
    });
    expect(kernelClient.instructions).toHaveLength(1);
    expect(kernelClient.instructions[0].entries).toEqual([
      {
        account_id: '1111',
        debit: '500000',
        credit: '0',
        description: 'Recognize cash receipt',
      },
      {
        account_id: '1311',
        debit: '0',
        credit: '500000',
        description: 'Settle accounts receivable',
      },
    ]);
    expect(instructionIntents(kernelClient.instructions[0])).toEqual([
      'RECOGNIZE_CASH',
      'SETTLE_RECEIVABLE',
    ]);
  });

  it('keeps duplicate Hospital finance events idempotent at Finance OS handler boundary', async () => {
    const kernelClient = new CapturingFinanceKernelClient();
    const handler = createHandler(kernelClient);
    const envelope = patientPaymentReceivedEnvelope();

    const first = await handler.handle(envelope);
    const second = await handler.handle({
      ...envelope,
      event_id: 'event-payment-duplicate',
    });

    expect(first.status).toBe('CREATED');
    expect(second).toMatchObject({
      event_id: 'event-payment-duplicate',
      idempotency_key: 'tenant-1-payment-bill-1',
      status: 'ALREADY_PROCESSED',
      transaction_id: 'tx-1',
    });
    expect(kernelClient.instructions).toHaveLength(1);
  });
});
