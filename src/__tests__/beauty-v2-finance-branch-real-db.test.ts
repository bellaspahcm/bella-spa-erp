import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

import { GET as runAccountingWorker } from '@/app/api/cron/accounting-worker/route';
import { confirmTransaction } from '@/core/services/finance/transaction-mutations';
import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database, Json } from '@/types/database.types';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

const mockCreateDevelopmentBypassClient = jest.fn();
const mockResolveTenantId = jest.fn();
const mockAssertLegacyFinanceWriteAllowed = jest.fn();
const mockMisaSend = jest.fn();

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: (...args: unknown[]) => mockCreateDevelopmentBypassClient(...args),
}));

jest.mock('../core/services/finance/shared', () => ({
  resolveTenantId: () => mockResolveTenantId(),
}));

jest.mock('@/core/services/accounting/mode', () => ({
  assertLegacyFinanceWriteAllowed: (...args: unknown[]) => mockAssertLegacyFinanceWriteAllowed(...args),
}));

jest.mock('@/plugins/outbound/misa/adapter', () => ({
  MisaOutboundAdapter: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => mockMisaSend(...args),
  })),
}));

jest.setTimeout(180_000);

type SeedClient = SupabaseClient<Database>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

const hasRealSupabaseAdminEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
};

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

function resolveProjectRefFromEnv(): string {
  const explicitRef = process.env.SUPABASE_PROJECT_REF;
  if (explicitRef && PROJECT_REF_PATTERN.test(explicitRef)) {
    return explicitRef;
  }

  const adminUrl = getSupabaseAdminUrl();
  const projectRef = new URL(adminUrl).hostname.split('.')[0];
  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error(`Unable to resolve Supabase project ref from ${adminUrl}`);
  }

  return projectRef;
}

function runSupabaseSql(label: string, sql: string) {
  const projectRef = resolveProjectRefFromEnv();
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  const supabaseArgs = ['db', 'query', '--linked', '--project-ref', projectRef, normalizedSql];
  const command = process.platform === 'win32' ? 'cmd.exe' : 'supabase';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'supabase', ...supabaseArgs]
    : supabaseArgs;
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 130_000,
  });

  if (result.error || result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(`${label} failed: ${result.error?.message || stdout || stderr || 'unknown supabase CLI failure'}`);
  }
}

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return value;
}

function quoteUuid(value: string, label: string) {
  return `'${requireUuid(value, label)}'`;
}

function accountingPayload(value: unknown): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Accounting outbox payload is not an object');
  }

  return value as Record<string, Json | undefined>;
}

describeWithRealSupabase('Beauty V2 Finance SALARY_PAID branch Real DB proof', () => {
  const marker = `beauty-v2-finance-branch-${Date.now()}`;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const companyId = randomUUID();
  const regionId = randomUUID();
  const branchAId = randomUUID();
  const otherCompanyId = randomUUID();
  const otherTenantBranchId = randomUUID();
  const adminUserId = randomUUID();
  const ktvUserId = randomUUID();
  const nullBranchKtvId = randomUUID();
  const otherTenantKtvId = randomUUID();
  const salaryId = randomUUID();
  const nullBranchSalaryId = randomUUID();
  const otherTenantSalaryId = randomUUID();
  const expenseId = randomUUID();
  const nullBranchExpenseId = randomUUID();
  const crossTenantExpenseId = randomUUID();
  const account334Id = randomUUID();
  const account112Id = randomUUID();
  let supabase: SeedClient;
  let cleaned = false;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthYear = `${today.slice(0, 7)}-01`;

  async function cleanupStep(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error(`${label} failed: ${error.message}`);
  }

  async function cleanup() {
    const tenantSql = [tenantId, otherTenantId]
      .map((id, index) => quoteUuid(id, `tenant cleanup id ${index}`))
      .join(', ');
    const userSql = [adminUserId, ktvUserId, nullBranchKtvId, otherTenantKtvId]
      .map((id, index) => quoteUuid(id, `user cleanup id ${index}`))
      .join(', ');
    const orgUnitSql = [branchAId, regionId, companyId, otherTenantBranchId, otherCompanyId]
      .map((id, index) => quoteUuid(id, `org cleanup id ${index}`))
      .join(', ');
    const salarySql = [salaryId, nullBranchSalaryId, otherTenantSalaryId]
      .map((id, index) => quoteUuid(id, `salary cleanup id ${index}`))
      .join(', ');
    const expenseSql = [expenseId, nullBranchExpenseId, crossTenantExpenseId]
      .map((id, index) => quoteUuid(id, `expense cleanup id ${index}`))
      .join(', ');

    runSupabaseSql('current finance proof SQL cleanup', `
      SET statement_timeout = '120s';
      DELETE FROM public.accounting_worker_runs
      WHERE tenant_ids::text LIKE '%${requireUuid(tenantId, 'tenant worker cleanup id')}%'
         OR tenant_ids::text LIKE '%${requireUuid(otherTenantId, 'other tenant worker cleanup id')}%'
         OR details::text LIKE '%${requireUuid(salaryId, 'salary worker cleanup id')}%'
         OR details::text LIKE '%${requireUuid(nullBranchSalaryId, 'null salary worker cleanup id')}%'
         OR details::text LIKE '%${requireUuid(otherTenantSalaryId, 'other salary worker cleanup id')}%';

      DELETE FROM public.accounting_outbox
      WHERE tenant_id IN (${tenantSql})
         OR reference_id IN (${salarySql});

      DELETE FROM public.audit_logs
      WHERE tenant_id IN (${tenantSql})
         OR record_id IN (
          SELECT id FROM public.journal_entries
          WHERE tenant_id IN (${tenantSql})
             OR reference_id IN (${salarySql})
         );

      UPDATE public.journal_entries
      SET status = 'CANCELED'
      WHERE status = 'POSTED'
        AND (
          tenant_id IN (${tenantSql})
          OR reference_id IN (${salarySql})
        );

      BEGIN;
      ALTER TABLE public.journal_lines DISABLE TRIGGER trg_check_journal_line_modify;
      DELETE FROM public.journal_lines
      WHERE entry_id IN (
        SELECT id FROM public.journal_entries
        WHERE tenant_id IN (${tenantSql})
           OR reference_id IN (${salarySql})
      );
      ALTER TABLE public.journal_lines ENABLE TRIGGER trg_check_journal_line_modify;
      COMMIT;

      DELETE FROM public.journal_entries
      WHERE tenant_id IN (${tenantSql})
         OR reference_id IN (${salarySql});

      DELETE FROM public.expenses
      WHERE tenant_id IN (${tenantSql})
         OR id IN (${expenseSql});

      DELETE FROM public.salary_records
      WHERE tenant_id IN (${tenantSql})
         OR id IN (${salarySql});

      DELETE FROM public.accounting_accounts
      WHERE tenant_id IN (${tenantSql})
         OR id IN (${quoteUuid(account334Id, 'account 334 cleanup id')}, ${quoteUuid(account112Id, 'account 112 cleanup id')});

      DELETE FROM public.accounting_periods
      WHERE tenant_id IN (${tenantSql});

      DELETE FROM public.users
      WHERE id IN (${userSql});

      DELETE FROM public.org_units
      WHERE id IN (${orgUnitSql});

      DELETE FROM public.tenants
      WHERE id IN (${tenantSql});
    `);

    cleaned = true;
  }

  async function assertNoOutboxOrJournalFor(referenceId: string) {
    const outboxRows = await supabase
      .from('accounting_outbox')
      .select('id')
      .eq('reference_id', referenceId);
    expect(outboxRows.error).toBeNull();
    expect(outboxRows.data).toEqual([]);

    const journalRows = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_id', referenceId);
    expect(journalRows.error).toBeNull();
    expect(journalRows.data).toEqual([]);
  }

  async function assertCurrentProofResidualsZero() {
    const outboxRows = await supabase
      .from('accounting_outbox')
      .select('id')
      .in('reference_id', [salaryId, nullBranchSalaryId, otherTenantSalaryId]);
    expect(outboxRows.error).toBeNull();
    expect(outboxRows.data).toEqual([]);

    const journalRows = await supabase
      .from('journal_entries')
      .select('id')
      .in('reference_id', [salaryId, nullBranchSalaryId, otherTenantSalaryId]);
    expect(journalRows.error).toBeNull();
    expect(journalRows.data).toEqual([]);

    const expenseRows = await supabase
      .from('expenses')
      .select('id')
      .in('id', [expenseId, nullBranchExpenseId, crossTenantExpenseId]);
    expect(expenseRows.error).toBeNull();
    expect(expenseRows.data).toEqual([]);

    const salaryRows = await supabase
      .from('salary_records')
      .select('id')
      .in('id', [salaryId, nullBranchSalaryId, otherTenantSalaryId]);
    expect(salaryRows.error).toBeNull();
    expect(salaryRows.data).toEqual([]);

    const accountRows = await supabase
      .from('accounting_accounts')
      .select('id')
      .in('id', [account334Id, account112Id]);
    expect(accountRows.error).toBeNull();
    expect(accountRows.data).toEqual([]);

    const userRows = await supabase
      .from('users')
      .select('id')
      .in('id', [adminUserId, ktvUserId, nullBranchKtvId, otherTenantKtvId]);
    expect(userRows.error).toBeNull();
    expect(userRows.data).toEqual([]);

    const orgRows = await supabase
      .from('org_units')
      .select('id')
      .in('id', [companyId, regionId, branchAId, otherCompanyId, otherTenantBranchId]);
    expect(orgRows.error).toBeNull();
    expect(orgRows.data).toEqual([]);

    const tenantRows = await supabase
      .from('tenants')
      .select('id')
      .in('id', [tenantId, otherTenantId]);
    expect(tenantRows.error).toBeNull();
    expect(tenantRows.data).toEqual([]);
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    mockCreateDevelopmentBypassClient.mockResolvedValue(supabase);
    mockResolveTenantId.mockResolvedValue(tenantId);
    mockAssertLegacyFinanceWriteAllowed.mockResolvedValue(undefined);
    mockMisaSend.mockResolvedValue({ success: true });

    await cleanupStep('tenant insert', supabase.from('tenants').insert([
      {
        id: tenantId,
        name: `${marker} tenant`,
        status: 'active',
        product_key: 'beauty_spa_v2',
        enabled_modules: { beauty_spa: true, payroll: true, finance: true },
      },
      {
        id: otherTenantId,
        name: `${marker} other tenant`,
        status: 'active',
        product_key: 'beauty_spa_v2',
        enabled_modules: { beauty_spa: true, payroll: true, finance: true },
      },
    ]));

    await cleanupStep('org units insert', supabase.from('org_units').insert([
      {
        id: companyId,
        tenant_id: tenantId,
        unit_type: 'company',
        name: `${marker} company`,
        is_active: true,
      },
      {
        id: regionId,
        tenant_id: tenantId,
        unit_type: 'region',
        name: `${marker} region`,
        parent_id: companyId,
        is_active: true,
      },
      {
        id: branchAId,
        tenant_id: tenantId,
        unit_type: 'branch',
        name: `${marker} branch A`,
        parent_id: regionId,
        is_active: true,
      },
      {
        id: otherCompanyId,
        tenant_id: otherTenantId,
        unit_type: 'company',
        name: `${marker} other company`,
        is_active: true,
      },
      {
        id: otherTenantBranchId,
        tenant_id: otherTenantId,
        unit_type: 'branch',
        name: `${marker} other branch`,
        parent_id: otherCompanyId,
        is_active: true,
      },
    ]));

    await cleanupStep('users insert', supabase.from('users').insert([
      {
        id: adminUserId,
        tenant_id: tenantId,
        email: `${marker}-admin@example.test`,
        full_name: 'Beauty Finance Branch Proof Admin',
        role: 'admin',
        status: 'active',
        position_tier: 'junior',
      },
      {
        id: ktvUserId,
        tenant_id: tenantId,
        email: `${marker}-ktv@example.test`,
        full_name: 'Beauty Finance Branch Proof KTV',
        role: 'ktv',
        status: 'active',
        position_tier: 'junior',
      },
      {
        id: nullBranchKtvId,
        tenant_id: tenantId,
        email: `${marker}-null-branch@example.test`,
        full_name: 'Beauty Finance Null Branch KTV',
        role: 'ktv',
        status: 'active',
        position_tier: 'junior',
      },
      {
        id: otherTenantKtvId,
        tenant_id: otherTenantId,
        email: `${marker}-other-tenant@example.test`,
        full_name: 'Beauty Finance Other Tenant KTV',
        role: 'ktv',
        status: 'active',
        position_tier: 'junior',
      },
    ]));

    await cleanupStep('accounts insert', supabase.from('accounting_accounts').insert([
      {
        id: account334Id,
        tenant_id: tenantId,
        account_code: '334',
        account_name: `${marker} payroll payable`,
        account_type: 'LIABILITY',
        is_active: true,
      },
      {
        id: account112Id,
        tenant_id: tenantId,
        account_code: '112',
        account_name: `${marker} bank`,
        account_type: 'ASSET',
        is_active: true,
      },
    ]));

    await cleanupStep('salary records insert', supabase.from('salary_records').insert([
      {
        id: salaryId,
        tenant_id: tenantId,
        ktv_id: ktvUserId,
        month_year: monthYear,
        branch_id: branchAId,
        status: 'draft',
        total_salary: 7000000,
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 1000000,
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: {},
      },
      {
        id: nullBranchSalaryId,
        tenant_id: tenantId,
        ktv_id: nullBranchKtvId,
        month_year: monthYear,
        branch_id: null,
        status: 'draft',
        total_salary: 5000000,
        total_sessions: 8,
        base_salary: 5000000,
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: {},
      },
      {
        id: otherTenantSalaryId,
        tenant_id: otherTenantId,
        ktv_id: otherTenantKtvId,
        month_year: monthYear,
        branch_id: otherTenantBranchId,
        status: 'draft',
        total_salary: 4500000,
        total_sessions: 6,
        base_salary: 4500000,
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: {},
      },
    ]));

    await cleanupStep('expenses insert', supabase.from('expenses').insert([
      {
        id: expenseId,
        tenant_id: tenantId,
        category: 'salary',
        amount: 7000000,
        description: `[salary_record_id:${salaryId}] [ktv_id:${ktvUserId}] ${marker} salary payment`,
        status: 'submitted',
        expense_date: today,
        submitted_by_id: adminUserId,
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: {},
      },
      {
        id: nullBranchExpenseId,
        tenant_id: tenantId,
        category: 'salary',
        amount: 5000000,
        description: `[salary_record_id:${nullBranchSalaryId}] [ktv_id:${nullBranchKtvId}] ${marker} null branch salary payment`,
        status: 'submitted',
        expense_date: today,
        submitted_by_id: adminUserId,
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: {},
      },
      {
        id: crossTenantExpenseId,
        tenant_id: tenantId,
        category: 'salary',
        amount: 4500000,
        description: `[salary_record_id:${otherTenantSalaryId}] [ktv_id:${otherTenantKtvId}] ${marker} cross tenant salary payment`,
        status: 'submitted',
        expense_date: today,
        submitted_by_id: adminUserId,
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: {},
      },
    ]));
  });

  afterAll(async () => {
    if (!cleaned) {
      await cleanup();
    }
  });

  it('propagates salary_records.branch_id through SALARY_PAID outbox into journal lines', async () => {
    await expect(confirmTransaction(expenseId, 'expense')).resolves.toEqual({ success: true });

    const salaryReadback = await supabase
      .from('salary_records')
      .select('id, status, paid_method, branch_id')
      .eq('id', salaryId)
      .single();
    expect(salaryReadback.error).toBeNull();
    expect(salaryReadback.data).toMatchObject({
      id: salaryId,
      status: 'paid',
      paid_method: 'bank_transfer',
      branch_id: branchAId,
    });

    const outboxReadback = await supabase
      .from('accounting_outbox')
      .select('id, tenant_id, event_type, reference_type, reference_id, payload, status, journal_entry_id')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'SALARY_PAID')
      .eq('reference_id', salaryId)
      .single();
    expect(outboxReadback.error).toBeNull();
    expect(outboxReadback.data).toMatchObject({
      tenant_id: tenantId,
      event_type: 'SALARY_PAID',
      reference_type: 'SALARY_RECORD',
      reference_id: salaryId,
      status: 'PENDING',
      journal_entry_id: null,
    });
    expect(accountingPayload(outboxReadback.data?.payload).branchId).toBe(branchAId);

    const priorSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = `${marker}-cron-secret`;
    try {
      const response = await runAccountingWorker(new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }));
      expect(response.status).toBe(200);
      const body = await response.json() as { success?: boolean; processed?: number };
      expect(body.success).toBe(true);
      expect(Number(body.processed ?? 0)).toBeGreaterThanOrEqual(1);
    } finally {
      if (priorSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = priorSecret;
      }
    }

    const completedOutbox = await supabase
      .from('accounting_outbox')
      .select('id, status, journal_entry_id, payload')
      .eq('id', outboxReadback.data!.id)
      .single();
    expect(completedOutbox.error).toBeNull();
    expect(completedOutbox.data?.status).toBe('COMPLETED');
    expect(completedOutbox.data?.journal_entry_id).toEqual(expect.stringMatching(UUID_PATTERN));
    expect(accountingPayload(completedOutbox.data?.payload).branchId).toBe(branchAId);

    const journalEntry = await supabase
      .from('journal_entries')
      .select('id, tenant_id, reference_type, reference_id, status')
      .eq('id', completedOutbox.data!.journal_entry_id!)
      .single();
    expect(journalEntry.error).toBeNull();
    expect(journalEntry.data).toMatchObject({
      tenant_id: tenantId,
      reference_type: 'SALARY_PAYMENT',
      reference_id: salaryId,
      status: 'POSTED',
    });

    const journalLines = await supabase
      .from('journal_lines')
      .select('entry_id, account_id, debit_amount, credit_amount, branch_id, ktv_id')
      .eq('entry_id', completedOutbox.data!.journal_entry_id!);
    expect(journalLines.error).toBeNull();
    expect(journalLines.data).toHaveLength(2);
    expect(journalLines.data?.every((line) => line.branch_id === branchAId)).toBe(true);
    expect(journalLines.data?.every((line) => line.ktv_id === ktvUserId)).toBe(true);
    expect(journalLines.data?.map((line) => Number(line.debit_amount)).sort((a, b) => a - b)).toEqual([0, 7000000]);
    expect(journalLines.data?.map((line) => Number(line.credit_amount)).sort((a, b) => a - b)).toEqual([0, 7000000]);
  });

  it('rejects NULL branch and cross-tenant salary references before Finance side-effects', async () => {
    await expect(confirmTransaction(nullBranchExpenseId, 'expense')).rejects.toThrow(
      `Salary record ${nullBranchSalaryId} is missing branch_id for SALARY_PAID.`,
    );
    await assertNoOutboxOrJournalFor(nullBranchSalaryId);

    const nullBranchExpense = await supabase
      .from('expenses')
      .select('id, status')
      .eq('id', nullBranchExpenseId)
      .single();
    expect(nullBranchExpense.error).toBeNull();
    expect(nullBranchExpense.data).toMatchObject({
      id: nullBranchExpenseId,
      status: 'submitted',
    });

    const nullBranchSalary = await supabase
      .from('salary_records')
      .select('id, status, branch_id')
      .eq('id', nullBranchSalaryId)
      .single();
    expect(nullBranchSalary.error).toBeNull();
    expect(nullBranchSalary.data).toMatchObject({
      id: nullBranchSalaryId,
      status: 'draft',
      branch_id: null,
    });

    await expect(confirmTransaction(crossTenantExpenseId, 'expense')).rejects.toThrow();
    await assertNoOutboxOrJournalFor(otherTenantSalaryId);

    const crossTenantExpense = await supabase
      .from('expenses')
      .select('id, status')
      .eq('id', crossTenantExpenseId)
      .single();
    expect(crossTenantExpense.error).toBeNull();
    expect(crossTenantExpense.data).toMatchObject({
      id: crossTenantExpenseId,
      status: 'submitted',
    });

    const otherSalary = await supabase
      .from('salary_records')
      .select('id, tenant_id, status, branch_id')
      .eq('id', otherTenantSalaryId)
      .single();
    expect(otherSalary.error).toBeNull();
    expect(otherSalary.data).toMatchObject({
      id: otherTenantSalaryId,
      tenant_id: otherTenantId,
      status: 'draft',
      branch_id: otherTenantBranchId,
    });
  });

  it('cleans up current Finance proof rows with zero residual', async () => {
    await cleanup();
    await assertCurrentProofResidualsZero();
  });
});
