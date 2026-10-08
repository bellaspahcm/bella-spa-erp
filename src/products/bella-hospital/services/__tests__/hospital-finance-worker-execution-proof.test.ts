import { randomUUID } from 'crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createFinanceEventHandlerForTesting } from '@/platform/finance/finance-event-handler.factory';
import { HospitalFinanceAdapter } from '@/platform/healthcare/finance-integration/hospital-finance-adapter';
import type { FinanceApiClient } from '@/platform/integration-hub/finance-outbox-worker';
import { processEvent } from '@/platform/integration-hub/finance-outbox-worker';
import { FinanceOutboxWriter } from '@/platform/integration-hub/finance-outbox-writer';
import type { FinanceEventEnvelope } from '@/platform/integration-hub/finance-event-contract.types';
import type { OutboxEvent, OutboxStatus } from '@/platform/integration-hub/types/outbox.types';
import type { Database, Json } from '@/types/database.types';
import { HospitalBillingFinanceProductService } from '../hospital-billing-finance.service';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('uuid', () => ({
  v4: () => randomUUID(),
}));

jest.setTimeout(120_000);

const HEALTHCARE_TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const REQUIRED_ACCOUNT_CODES = [
  { code: '1111', name: 'Cash', type: 'ASSET', normal_balance: 'DEBIT' },
  { code: '1311', name: 'Accounts receivable', type: 'ASSET', normal_balance: 'DEBIT' },
  { code: '4111', name: 'Patient service revenue', type: 'REVENUE', normal_balance: 'CREDIT' },
];

const hasRealSupabaseEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(url && adminKey && !url.includes('mock.supabase.co') && adminKey !== 'mock-service-role-key');
};

const describeWithRealSupabase = hasRealSupabaseEnv() ? describe : describe.skip;

type QueryResult<T> = {
  rowCount: number;
  rows: T[];
};

class SupabaseWorkerStatusPool {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async query<T>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
    const eventId = getStringValue(values[0], 'eventId');

    if (sql.includes('first_attempt_at IS NULL')) {
      const { error } = await this.supabase
        .from('finance_outbox_events')
        .update({ first_attempt_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .is('first_attempt_at', null);

      if (error) {
        throw new Error(`first_attempt_at update failed: ${error.message}`);
      }

      return { rowCount: 1, rows: [] };
    }

    if (sql.includes("status = 'PROCESSED'")) {
      const transactionId = getStringValue(values[1], 'transactionId');
      const { data, error } = await this.supabase
        .from('finance_outbox_events')
        .update({
          status: 'PROCESSED',
          processed_at: new Date().toISOString(),
          transaction_id: transactionId,
        })
        .eq('event_id', eventId)
        .eq('status', 'PROCESSING')
        .select('event_id');

      if (error) {
        throw new Error(`processed update failed: ${error.message}`);
      }

      return { rowCount: data?.length ?? 0, rows: [] };
    }

    throw new Error('Unsupported worker SQL in Hospital finance worker proof.');
  }
}

function getStringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Expected ${field} to be a non-empty string.`);
  }

  return value;
}

function jsonRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected finance outbox payload to be an object.');
  }

  return value as Record<string, unknown>;
}

function asFinanceEnvelope(value: unknown): FinanceEventEnvelope {
  const candidate = value as FinanceEventEnvelope;

  if (
    typeof candidate.event_id !== 'string'
    || typeof candidate.event_type !== 'string'
    || typeof candidate.idempotency_key !== 'string'
    || typeof candidate.tenant_id !== 'string'
  ) {
    throw new Error('Invalid FinanceEventEnvelope in worker payload.');
  }

  return candidate;
}

function toOutboxEvent(row: Database['public']['Tables']['finance_outbox_events']['Row']): OutboxEvent {
  if (!row.event_id) {
    throw new Error('finance_outbox_events.event_id is required for worker processing.');
  }

  return {
    event_id: row.event_id,
    tenant_id: row.tenant_id,
    event_type: row.event_type,
    payload: jsonRecord(row.payload),
    status: row.status as OutboxStatus,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.created_at),
    claimed_by: row.claimed_by,
    claimed_at: row.claimed_at ? new Date(row.claimed_at) : null,
    lease_expires_at: row.lease_expires_at ? new Date(row.lease_expires_at) : null,
    processed_at: row.processed_at ? new Date(row.processed_at) : null,
    retry_count: row.retry_count,
    next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : null,
    max_retry: row.max_retry,
    failure_classification: null,
    last_error: row.last_error,
    last_attempt_at: row.last_attempt_at ? new Date(row.last_attempt_at) : null,
    first_attempt_at: row.first_attempt_at ? new Date(row.first_attempt_at) : null,
    quarantine_reason: row.quarantine_reason,
    quarantined_at: row.quarantined_at ? new Date(row.quarantined_at) : null,
    poison_crash_count: row.poison_crash_count ?? 0,
    replayed_at: row.replayed_at ? new Date(row.replayed_at) : null,
    replayed_by: row.replayed_by,
    idempotency_key: row.idempotency_key,
    transaction_id: row.transaction_id,
  };
}

async function ensureFinanceAccounts(supabase: SupabaseClient<Database>): Promise<void> {
  for (const account of REQUIRED_ACCOUNT_CODES) {
    const { error } = await supabase
      .from('finance_accounts')
      .upsert({
        tenant_id: HEALTHCARE_TEST_TENANT_ID,
        code: account.code,
        name: account.name,
        type: account.type,
        normal_balance: account.normal_balance,
        currency: 'VND',
        is_active: true,
      }, {
        onConflict: 'tenant_id,code',
      });

    if (error) {
      throw new Error(`finance account seed failed: ${error.message}`);
    }
  }
}

async function ensureCurrentOpenAccountingPeriod(supabase: SupabaseClient<Database>): Promise<void> {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  const name = `hospital-finance-worker-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const { error } = await supabase
    .from('finance_accounting_periods')
    .upsert({
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      name,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      status: 'OPEN',
    }, {
      onConflict: 'tenant_id,name',
    });

  if (error) {
    throw new Error(`finance accounting period seed failed: ${error.message}`);
  }
}

async function readOutboxEvent(
  supabase: SupabaseClient<Database>,
  eventId: string
): Promise<Database['public']['Tables']['finance_outbox_events']['Row']> {
  const { data, error } = await supabase
    .from('finance_outbox_events')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error || !data) {
    throw new Error(`finance outbox read failed: ${error?.message}`);
  }

  return data;
}

async function markProcessing(supabase: SupabaseClient<Database>, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('finance_outbox_events')
    .update({
      status: 'PROCESSING',
      claimed_by: 'hospital-finance-worker-proof',
      claimed_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`finance outbox claim setup failed: ${error.message}`);
  }
}

describeWithRealSupabase('Hospital Finance worker execution proof', () => {
  let supabase: SupabaseClient<Database>;
  const createdEventIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];

  beforeEach(async () => {
    supabase = createSupabaseClient<Database>(getSupabaseAdminUrl(), getSupabaseAdminKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    await ensureFinanceAccounts(supabase);
    await ensureCurrentOpenAccountingPeriod(supabase);
  });

  afterEach(async () => {
    if (createdEventIds.length > 0) {
      await supabase.from('finance_outbox_events').delete().in('event_id', createdEventIds);
    }

    if (createdIdempotencyKeys.length > 0) {
      await supabase.from('finance_event_idempotency').delete().in('idempotency_key', createdIdempotencyKeys);
    }
  });

  it('processes Hospital charge and payment outbox events into real ledger rows', async () => {
    const writer = new FinanceOutboxWriter(supabase, {
      sourceSystem: 'HOSPITAL_OS',
      sourceVersion: '1.0.0',
    });
    const adapter = new HospitalFinanceAdapter(supabase, writer);
    const hospitalFinance = new HospitalBillingFinanceProductService(adapter);
    const handler = createFinanceEventHandlerForTesting(supabase);
    const workerDb = new SupabaseWorkerStatusPool(supabase);
    const financeApiClient: FinanceApiClient = {
      async post(endpoint, payload) {
        expect(endpoint).toBe('/transactions');

        const result = await handler.handle(asFinanceEnvelope(payload.payload));

        if (result.status === 'CREATED') {
          return {
            status: 'SUCCESS',
            transaction_id: result.transaction_id,
            http_status: 201,
          };
        }

        if (result.status === 'ALREADY_PROCESSED') {
          return {
            status: 'ALREADY_PROCESSED',
            transaction_id: result.transaction_id,
            http_status: 200,
          };
        }

        return {
          status: 'ERROR',
          error: result.error ?? 'Finance handler failed',
          http_status: 422,
        };
      },
    };
    const correlationId = `hospital-finance-worker-${randomUUID()}`;
    const serviceId = `hospital-service-${randomUUID()}`;
    const billId = `hospital-bill-${randomUUID()}`;
    const serviceKey = `${HEALTHCARE_TEST_TENANT_ID}-service-${serviceId}`;
    const paymentKey = `${HEALTHCARE_TEST_TENANT_ID}-payment-${billId}`;

    const charge = await hospitalFinance.recognizePatientServiceCharge({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: randomUUID(),
      encounterId: randomUUID(),
      serviceId,
      amount: '500000',
      currency: 'VND',
      serviceType: 'LAB',
      serviceCode: 'CBC',
      quantity: 1,
      idempotencyKey: serviceKey,
      correlationId,
    });
    const payment = await hospitalFinance.recordPatientPayment({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: randomUUID(),
      billId,
      amount: '500000',
      currency: 'VND',
      idempotencyKey: paymentKey,
      correlationId,
    });

    createdEventIds.push(charge.eventId, payment.eventId);
    createdIdempotencyKeys.push(serviceKey, paymentKey);

    await markProcessing(supabase, charge.eventId);
    await markProcessing(supabase, payment.eventId);

    await processEvent(toOutboxEvent(await readOutboxEvent(supabase, charge.eventId)), financeApiClient, workerDb);
    await processEvent(toOutboxEvent(await readOutboxEvent(supabase, payment.eventId)), financeApiClient, workerDb);

    const processedEvents = await supabase
      .from('finance_outbox_events')
      .select('event_id, status, transaction_id, processed_at')
      .in('event_id', [charge.eventId, payment.eventId])
      .order('event_id');

    expect(processedEvents.error).toBeNull();
    expect(processedEvents.data).toHaveLength(2);
    expect(processedEvents.data?.map((event) => event.status)).toEqual(['PROCESSED', 'PROCESSED']);
    expect(processedEvents.data?.every((event) => Boolean(event.transaction_id && event.processed_at))).toBe(true);

    const transactionIds = processedEvents.data?.map((event) => getStringValue(event.transaction_id, 'transaction_id')) ?? [];
    const financeTransactions = await supabase
      .from('finance_transactions')
      .select('id, tenant_id, status, source_type, reference_type, description')
      .in('id', transactionIds);

    expect(financeTransactions.error).toBeNull();
    expect(financeTransactions.data).toHaveLength(2);
    expect(financeTransactions.data?.every((entry) => entry.tenant_id === HEALTHCARE_TEST_TENANT_ID)).toBe(true);
    expect(financeTransactions.data?.every((entry) => entry.status === 'POSTED')).toBe(true);
    expect(financeTransactions.data?.every((entry) => entry.source_type === 'FINANCE_EVENT')).toBe(true);
    expect(financeTransactions.data?.every((entry) => entry.reference_type === 'FINANCE_EVENT')).toBe(true);

    const transactionLines = await supabase
      .from('finance_transaction_lines')
      .select('transaction_id, debit_functional_amount, credit_functional_amount')
      .in('transaction_id', transactionIds);

    expect(transactionLines.error).toBeNull();
    expect(transactionLines.data).toHaveLength(4);

    for (const transactionId of transactionIds) {
      const lines = transactionLines.data?.filter((line) => line.transaction_id === transactionId) ?? [];
      const debit = lines.reduce((sum, line) => sum + Number(line.debit_functional_amount ?? 0), 0);
      const credit = lines.reduce((sum, line) => sum + Number(line.credit_functional_amount ?? 0), 0);

      expect(lines).toHaveLength(2);
      expect(debit).toBe(500000);
      expect(credit).toBe(500000);
    }

    const f5ReadBack = await supabase.rpc('finance_journal_entries_as_of', {
      p_tenant_id: HEALTHCARE_TEST_TENANT_ID,
      p_as_of: new Date(Date.now() + 60_000).toISOString(),
      p_contract_version: 'F1_GL:v1',
    });

    expect(f5ReadBack.error).toBeNull();
    expect(f5ReadBack.data?.filter((line) => transactionIds.includes(line.transaction_id))).toHaveLength(4);

    const idempotencyRows = await supabase
      .from('finance_event_idempotency')
      .select('idempotency_key, tenant_id, status, transaction_id')
      .in('idempotency_key', [serviceKey, paymentKey]);

    expect(idempotencyRows.error).toBeNull();
    expect(idempotencyRows.data).toHaveLength(2);
    expect(idempotencyRows.data?.every((row) => row.tenant_id === HEALTHCARE_TEST_TENANT_ID)).toBe(true);
    expect(idempotencyRows.data?.every((row) => row.status === 'COMPLETED')).toBe(true);
  });
});
