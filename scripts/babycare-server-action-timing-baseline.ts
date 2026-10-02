#!/usr/bin/env npx tsx

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

type TimedRecord = {
  flow: string;
  name: string;
  category: 'validation' | 'db' | 'audit' | 'outbox' | 'revalidation' | 'response' | 'wrapper' | 'cleanup';
  durationMs: number;
  ok: boolean;
  error?: string;
};

const envFile = process.env.BABYCARE_BASELINE_ENV_FILE || '.env.e2e';
const envPath = path.resolve(envFile);
const marker = `babycare-server-action-baseline-${Date.now()}`;
const outputDir = path.resolve('implementation-artifacts', 'investigations');
const jsonOutput = path.join(outputDir, `${marker}.json`);
const mdOutput = path.join(outputDir, `${marker}.md`);

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

if (!fs.existsSync(envPath)) fail(`Missing env file: ${envFile}`);
if (path.basename(envFile) !== '.env.e2e') {
  fail(`Refusing to run mutation baseline outside .env.e2e. Got: ${envFile}`);
}

const parsed = dotenv.parse(fs.readFileSync(envPath));
for (const [key, value] of Object.entries(parsed)) {
  process.env[key] ||= value;
}

const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL;
const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in .env.e2e');
}

const host = new URL(supabaseUrl).host;
if (host !== 'bmnbqbcdbuklhopfbopv.supabase.co') {
  fail(`Unexpected E2E Supabase host: ${host}`);
}

process.env.NEXT_PUBLIC_SUPABASE_URL ||= supabaseUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY ||= serviceRoleKey;
process.env.SUPABASE_SECRET_KEY ||= serviceRoleKey;
process.env.SUPABASE_URL ||= supabaseUrl;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const records: TimedRecord[] = [];
const created = {
  tenants: [] as string[],
  users: [] as string[],
  customers: [] as string[],
  packages: [] as string[],
  bookings: [] as string[],
  sessionLogs: [] as string[],
  revenue: [] as string[],
  auditLogs: [] as string[],
  sessionReviews: [] as string[],
  salaryRecords: [] as string[],
};

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function tomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function timed<T>(
  flow: string,
  name: string,
  category: TimedRecord['category'],
  fn: () => Promise<T> | T,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    records.push({ flow, name, category, durationMs: Number((performance.now() - start).toFixed(2)), ok: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    records.push({
      flow,
      name,
      category,
      durationMs: Number((performance.now() - start).toFixed(2)),
      ok: false,
      error: message,
    });
    throw error;
  }
}

async function timedQuery<T>(flow: string, name: string, category: TimedRecord['category'], queryPromise: PromiseLike<{ data: T; error: { message: string } | null }>) {
  return timed(flow, name, category, async () => {
    const result = await queryPromise;
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
}

async function insertReturningId(flow: string, name: string, table: string, payload: Record<string, unknown>) {
  const row = await timedQuery<{ id: string }>(
    flow,
    name,
    'db',
    supabase.from(table).insert(payload).select('id').single(),
  );
  return row.id;
}

async function setup() {
  const tenantId = await insertReturningId('setup', 'insert_tenant', 'tenants', {
    name: `${marker} tenant`,
    status: 'active',
    enabled_modules: { babycare: true, beauty_spa: false, payroll: true, inventory: true },
    product_key: 'bella_babycare',
  });
  created.tenants.push(tenantId);
  process.env.DEFAULT_TENANT_ID = tenantId;

  const adminId = await insertReturningId('setup', 'insert_admin_user', 'users', {
    tenant_id: tenantId,
    email: `${marker}-admin@example.com`,
    full_name: `${marker} Admin`,
    role: 'admin',
    phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
    base_salary: 0,
    status: 'active',
  });
  created.users.push(adminId);

  const ktvId = await insertReturningId('setup', 'insert_ktv_user', 'users', {
    tenant_id: tenantId,
    email: `${marker}-ktv@example.com`,
    full_name: `${marker} KTV`,
    role: 'ktv',
    phone: `08${Math.floor(Math.random() * 90000000 + 10000000)}`,
    base_salary: 6000000,
    status: 'active',
  });
  created.users.push(ktvId);

  const packageId = await insertReturningId('setup', 'insert_package', 'packages', {
    tenant_id: tenantId,
    name: `${marker} Goi cham soc me be`,
    description: 'BabyCare server-action timing proof package',
    price: 1200000,
    total_sessions: 3,
    session_multiplier: 1,
    status: 'active',
    module_key: 'babycare',
    default_duration_minutes: 60,
  });
  created.packages.push(packageId);

  return { tenantId, adminId, ktvId, packageId };
}

async function recordAudit(flow: string, tenantId: string, changedById: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  const audit = await timedQuery<{ id: string }>(
    flow,
    `audit_${tableName}_${action.toLowerCase()}`,
    'audit',
    supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        changed_by_id: changedById,
        action,
        table_name: tableName,
        record_id: recordId,
        old_data: oldData || null,
        new_data: newData || null,
      })
      .select('id')
      .single(),
  );
  created.auditLogs.push(audit.id);
}

async function revalidate(flow: string, paths: string[]) {
  const { safeRevalidatePath } = await import('../src/lib/revalidate');
  await timed(flow, 'safe_revalidate_paths', 'revalidation', async () => {
    await Promise.all(paths.map((item) => safeRevalidatePath(item)));
  });
}

async function createBookingActionWrapper(ctx: Awaited<ReturnType<typeof setup>>) {
  const flow = 'create_booking_action';
  const startDate = tomorrow();
  let bookingId = '';
  let customerId = '';

  await timed(flow, 'server_action_total', 'wrapper', async () => {
    const { bookingSchema } = await import('../src/lib/validations');
    const { sanitizeTime } = await import('@bella/shared');
    const validatedData = await timed(flow, 'validation_booking_schema', 'validation', () => {
      const parsedBooking = bookingSchema.safeParse({
        customer_id: 'new',
        package_id: ctx.packageId,
        full_price: 1200000,
        deposit_amount: 300000,
        total_sessions: 3,
        start_date: startDate,
        assigned_ktv_id: ctx.ktvId,
        ktv_commission: 50000,
        discount_percent: 0,
        preferred_time: '10:00',
        metadata: { marker },
      });
      if (!parsedBooking.success) throw new Error(parsedBooking.error.message);
      parsedBooking.data.preferred_time = sanitizeTime(parsedBooking.data.preferred_time || '') || undefined;
      return parsedBooking.data;
    });

    await timedQuery(flow, 'tenant_resolution_probe', 'db', supabase.from('tenants').select('id,status,enabled_modules').eq('id', ctx.tenantId).single());
    await timedQuery(flow, 'package_scope_package_select', 'db', supabase.from('packages').select('id,tenant_id,module_key,name').eq('id', ctx.packageId).single());
    await timedQuery(flow, 'package_scope_tenant_select', 'db', supabase.from('tenants').select('enabled_modules').eq('id', ctx.tenantId).single());

    const customer = await timedQuery<{ id: string } & Record<string, unknown>>(
      flow,
      'insert_customer_select',
      'db',
      supabase
        .from('customers')
        .insert({
          tenant_id: ctx.tenantId,
          name_mother: `${marker} customer`,
          phone: `07${Math.floor(Math.random() * 90000000 + 10000000)}`,
          name_baby: `${marker} baby`,
          status: 'active',
        })
        .select('*')
        .single(),
    );
    customerId = customer.id;
    created.customers.push(customerId);
    await recordAudit(flow, ctx.tenantId, ctx.adminId, 'INSERT', 'customers', customerId, null, customer);

    await timedQuery(
      flow,
      'find_pending_booking_for_customer',
      'db',
      supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', ctx.tenantId)
        .in('status', ['deposit_pending', 'lead'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    const tenant = await timedQuery<Record<string, unknown>>(flow, 'construct_tenant_context', 'db', supabase.from('tenants').select('*').eq('id', ctx.tenantId).single());
    await timed(flow, 'adapter_validation_noop', 'validation', () => {
      if (!tenant.id) throw new Error('Missing tenant context');
    });

    const pkg = await timedQuery<{ price: number; name: string; total_sessions: number }>(
      flow,
      'pricing_package_select',
      'db',
      supabase.from('packages').select('price,name,total_sessions').eq('id', ctx.packageId).single(),
    );

    const booking = await timedQuery<{ id: string } & Record<string, unknown>>(
      flow,
      'insert_booking_select',
      'db',
      supabase
        .from('bookings')
        .insert({
          booking_number: `SAB-${Date.now()}`,
          customer_id: customerId,
          package_id: ctx.packageId,
          package_name: pkg.name,
          full_price: pkg.price,
          deposit_amount: validatedData.deposit_amount,
          total_sessions: validatedData.total_sessions,
          completed_sessions: 0,
          start_date: validatedData.start_date,
          assigned_ktv_id: ctx.ktvId,
          ktv_commission: validatedData.ktv_commission,
          discount_percent: validatedData.discount_percent,
          preferred_time: validatedData.preferred_time,
          status: 'booked',
          tenant_id: ctx.tenantId,
          metadata: { marker, source: 'SERVER_ACTION_TIMING_BASELINE' },
        })
        .select('*')
        .single(),
    );
    bookingId = booking.id;
    created.bookings.push(bookingId);
    await recordAudit(flow, ctx.tenantId, ctx.adminId, 'INSERT', 'bookings', bookingId, null, booking);

    const receivedDate = today();
    await timedQuery(
      flow,
      'deposit_accounting_period_probe',
      'db',
      supabase.from('accounting_periods').select('id,status,start_date,end_date').eq('tenant_id', ctx.tenantId).lte('start_date', receivedDate).gte('end_date', receivedDate).limit(1).maybeSingle(),
    );

    const revenue = await timedQuery<{ id: string }>(
      flow,
      'insert_deposit_revenue',
      'db',
      supabase
        .from('revenue')
        .insert({
          booking_id: bookingId,
          amount: validatedData.deposit_amount,
          revenue_type: 'deposit',
          payment_method: 'bank_transfer',
          received_date: receivedDate,
          status: 'confirmed',
          notes: `Coc goi ${pkg.name}`,
          tenant_id: ctx.tenantId,
          business_event_type: 'PACKAGE_SALE',
          accounting_review_status: 'NEEDS_REVIEW',
          accounting_metadata: { marker, booking_id: bookingId },
        })
        .select('id')
        .single(),
    );
    created.revenue.push(revenue.id);

    await timed(flow, 'enqueue_deposit_outbox_rpc', 'outbox', async () => {
      const { error } = await supabase.rpc('enqueue_accounting_event', {
        p_tenant_id: ctx.tenantId,
        p_event_type: 'PACKAGE_SALE',
        p_reference_type: 'REVENUE',
        p_reference_id: revenue.id,
        p_payload: { marker, booking_id: bookingId, amount: validatedData.deposit_amount },
      });
      if (error) throw new Error(error.message);
    });

    await timedQuery(flow, 'existing_session_logs_count', 'db', supabase.from('session_logs').select('*', { count: 'exact', head: true }).eq('booking_id', bookingId));
    await timedQuery(flow, 'package_default_duration_select', 'db', supabase.from('packages').select('default_duration_minutes').eq('id', ctx.packageId).single());

    const sessions = Array.from({ length: validatedData.total_sessions }, (_, index) => ({
      tenant_id: ctx.tenantId,
      booking_id: bookingId,
      session_number: index + 1,
      status: 'scheduled',
      assigned_date: startDate,
      assigned_time: validatedData.preferred_time,
      standard_duration: 60,
      accounting_review_status: 'NEEDS_REVIEW',
      accounting_metadata: { marker },
    }));
    const insertedSessions = await timedQuery<{ id: string; session_number: number }[]>(
      flow,
      'insert_initial_session_logs',
      'db',
      supabase.from('session_logs').insert(sessions).select('id,session_number'),
    );
    created.sessionLogs.push(...insertedSessions.map((item) => item.id));

    await revalidate(flow, ['/dashboard/bookings', '/dashboard/sessions', '/dashboard/customers', `/dashboard/customers/${customerId}`, '/dashboard', '/dashboard/finance']);
    await timed(flow, 'response_shape', 'response', () => ({ data: { id: bookingId } }));
  });

  return { ...ctx, customerId, bookingId, sessionId: created.sessionLogs[0] };
}

async function completeSessionActionWrapper(ctx: Awaited<ReturnType<typeof createBookingActionWrapper>>) {
  const flow = 'complete_session_action';

  await timed(flow, 'server_action_total', 'wrapper', async () => {
    const existingLog = await timedQuery<Record<string, unknown>>(
      flow,
      'fetch_existing_session_security_check',
      'db',
      supabase.from('session_logs').select('*').eq('id', ctx.sessionId).eq('tenant_id', ctx.tenantId).single(),
    );
    const booking = await timedQuery<Record<string, unknown>>(
      flow,
      'fetch_booking_for_completion',
      'db',
      supabase
        .from('bookings')
        .select('assigned_ktv_id,package_id,status,full_price,discount_percent,total_sessions,customer_id,tenant_id,package_name,ktv_commission,deposit_amount,completed_sessions,is_in_care')
        .eq('id', ctx.bookingId)
        .eq('tenant_id', ctx.tenantId)
        .single(),
    );
    await timed(flow, 'completion_validation', 'validation', () => {
      if (existingLog.booking_id !== ctx.bookingId) throw new Error('Session booking mismatch');
      if (booking.status === 'cancelled') throw new Error('Booking cancelled');
      if (!booking.assigned_ktv_id) throw new Error('Missing assigned KTV');
    });

    const completedDate = today();
    await timedQuery(
      flow,
      'update_session_completed',
      'db',
      supabase
        .from('session_logs')
        .update({
          status: 'completed',
          completed_date: completedDate,
          completed_by_ktv_id: ctx.ktvId,
          notes: 'Server action baseline completion',
          business_event_type: 'SESSION_DONE',
          accounting_review_status: 'NEEDS_REVIEW',
          accounting_metadata: {
            marker,
            session_log_id: ctx.sessionId,
            booking_id: ctx.bookingId,
            earned_revenue: 400000,
            completed_by_ktv_id: ctx.ktvId,
            completed_date: completedDate,
            status: 'completed',
          },
        })
        .eq('id', ctx.sessionId)
        .eq('tenant_id', ctx.tenantId),
    );

    await timedQuery(flow, 'completion_accounting_period_probe', 'db', supabase.from('accounting_periods').select('id,status,start_date,end_date').eq('tenant_id', ctx.tenantId).lte('start_date', completedDate).gte('end_date', completedDate).limit(1).maybeSingle());
    const completedRows = await timedQuery<{ id: string }[]>(flow, 'count_completed_sessions', 'db', supabase.from('session_logs').select('id').eq('booking_id', ctx.bookingId).eq('tenant_id', ctx.tenantId).eq('status', 'completed'));
    const currentBooking = await timedQuery<Record<string, unknown>>(flow, 'fetch_current_booking_for_progress', 'db', supabase.from('bookings').select('*').eq('id', ctx.bookingId).eq('tenant_id', ctx.tenantId).single());

    await timedQuery(
      flow,
      'update_booking_progress',
      'db',
      supabase
        .from('bookings')
        .update({
          completed_sessions: completedRows.length,
          status: completedRows.length >= Number(currentBooking.total_sessions || 0) ? 'completed' : 'in_progress',
        })
        .eq('id', ctx.bookingId)
        .eq('tenant_id', ctx.tenantId),
    );

    const salary = await timedQuery<{ id: string }>(
      flow,
      'insert_salary_record_probe',
      'db',
      supabase
        .from('salary_records')
        .insert({
          tenant_id: ctx.tenantId,
          ktv_id: ctx.ktvId,
          month_year: `${completedDate.slice(0, 7)}-01`,
          total_sessions: 1,
          session_bonus: 50000,
          total_salary: 6050000,
          status: 'draft',
        })
        .select('id')
        .single(),
    );
    created.salaryRecords.push(salary.id);

    const review = await timedQuery<{ id: string }>(
      flow,
      'insert_session_review_placeholder',
      'db',
      supabase
        .from('session_reviews')
        .insert({
          tenant_id: ctx.tenantId,
          session_log_id: ctx.sessionId,
          reviewer_id: booking.customer_id,
          ktv_id: ctx.ktvId,
          rating: 5,
          note: 'Cho khach hang danh gia',
          status: 'pending_review',
        })
        .select('id')
        .single(),
    );
    created.sessionReviews.push(review.id);

    await timedQuery(flow, 'fetch_revenue_for_session_done_outbox', 'db', supabase.from('revenue').select('amount,status,revenue_type').eq('booking_id', ctx.bookingId).eq('tenant_id', ctx.tenantId));
    await timed(flow, 'enqueue_session_done_outbox_rpc', 'outbox', async () => {
      const { error } = await supabase.rpc('enqueue_accounting_event', {
        p_tenant_id: ctx.tenantId,
        p_event_type: 'SESSION_DONE',
        p_reference_type: 'SESSION_LOG',
        p_reference_id: ctx.sessionId,
        p_payload: {
          marker,
          session_log_id: ctx.sessionId,
          booking_id: ctx.bookingId,
          ktv_id: ctx.ktvId,
          earned_revenue_amount: 400000,
          commission_amount: 50000,
        },
      });
      if (error) throw new Error(error.message);
    });

    await revalidate(flow, ['/dashboard/bookings', '/dashboard/sessions', '/dashboard/customers']);
    await timed(flow, 'response_shape', 'response', () => ({ success: true }));
  });
}

async function cleanup() {
  const cleanupSteps: Array<[string, string[], () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['delete_accounting_outbox_by_tenant', created.tenants, () => supabase.from('accounting_outbox').delete().in('tenant_id', created.tenants)],
    ['delete_session_reviews', created.sessionReviews, () => supabase.from('session_reviews').delete().in('id', created.sessionReviews)],
    ['delete_session_logs', created.sessionLogs, () => supabase.from('session_logs').delete().in('id', created.sessionLogs)],
    ['delete_salary_records', created.salaryRecords, () => supabase.from('salary_records').delete().in('id', created.salaryRecords)],
    ['delete_revenue', created.revenue, () => supabase.from('revenue').delete().in('id', created.revenue)],
    ['delete_bookings', created.bookings, () => supabase.from('bookings').delete().in('id', created.bookings)],
    ['delete_audit_logs', created.auditLogs, () => supabase.from('audit_logs').delete().in('id', created.auditLogs)],
    ['delete_packages', created.packages, () => supabase.from('packages').delete().in('id', created.packages)],
    ['delete_customers', created.customers, () => supabase.from('customers').delete().in('id', created.customers)],
  ];

  for (const [name, ids, fn] of cleanupSteps) {
    if (ids.length === 0) continue;
    await timed('cleanup', name, 'cleanup', async () => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }

  for (const userId of created.users) {
    await timed('cleanup', `delete_user_${userId.slice(0, 8)}`, 'cleanup', async () => {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }

  for (const tenantId of created.tenants) {
    await timed('cleanup', `delete_tenant_${tenantId.slice(0, 8)}`, 'cleanup', async () => {
      const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }
}

function summarize() {
  const summary: Record<string, { serverActionTotalMs: number; dbMs: number; auditMs: number; outboxMs: number; validationMs: number; revalidationMs: number; responseMs: number; failed: number; slowest: TimedRecord[] }> = {};
  for (const record of records) {
    if (record.flow === 'setup' || record.flow === 'cleanup') continue;
    summary[record.flow] ||= {
      serverActionTotalMs: 0,
      dbMs: 0,
      auditMs: 0,
      outboxMs: 0,
      validationMs: 0,
      revalidationMs: 0,
      responseMs: 0,
      failed: 0,
      slowest: [],
    };
    const item = summary[record.flow];
    if (record.name === 'server_action_total') item.serverActionTotalMs += record.durationMs;
    if (record.category === 'db') item.dbMs += record.durationMs;
    if (record.category === 'audit') item.auditMs += record.durationMs;
    if (record.category === 'outbox') item.outboxMs += record.durationMs;
    if (record.category === 'validation') item.validationMs += record.durationMs;
    if (record.category === 'revalidation') item.revalidationMs += record.durationMs;
    if (record.category === 'response') item.responseMs += record.durationMs;
    if (!record.ok) item.failed += 1;
    if (record.name !== 'server_action_total') item.slowest.push(record);
  }
  for (const item of Object.values(summary)) {
    item.slowest = item.slowest.sort((a, b) => b.durationMs - a.durationMs).slice(0, 8);
    for (const key of ['serverActionTotalMs', 'dbMs', 'auditMs', 'outboxMs', 'validationMs', 'revalidationMs', 'responseMs'] as const) {
      item[key] = Number(item[key].toFixed(2));
    }
  }
  return summary;
}

function writeReports(status: string, cleanupStatus: string) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = summarize();
  const payload = {
    marker,
    status,
    cleanupStatus,
    environment: { envFile, host, safety: 'E2E_ONLY_MUTATION_BASELINE' },
    measurementLimits: {
      productionMutation: 'FORBIDDEN',
      runtimeCodeChanges: 'NONE',
      browserUiLatency: 'NOT_MEASURED',
      directExportedServerAction: 'NOT_MEASURED',
      actionWrapper: 'MEASURED',
      note: 'Wrapper mirrors the server action sequence with proof-scoped service-role client; audit is measured as equivalent audit insert because recordAuditLog requires request current-user context.',
    },
    summary,
    records,
  };
  fs.writeFileSync(jsonOutput, JSON.stringify(payload, null, 2));

  const lines = [
    `# SERVER_ACTION_TIMING_BASELINE ${marker}`,
    '',
    `Status: ${status}`,
    `Environment: ${envFile} / ${host}`,
    '',
    '## Scope',
    '',
    '- Production mutation: FORBIDDEN',
    '- Runtime code change: NONE',
    '- Browser/UI latency: NOT_MEASURED',
    '- Direct exported server action: NOT_MEASURED',
    '- Action-path wrapper: MEASURED',
    '',
    '## Flow Summary',
    '',
    '| Flow | Action wrapper ms | DB ms | Audit ms | Outbox ms | Validation ms | Revalidation ms | Failed |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary).map(([flow, item]) => `| ${flow} | ${item.serverActionTotalMs} | ${item.dbMs} | ${item.auditMs} | ${item.outboxMs} | ${item.validationMs} | ${item.revalidationMs} | ${item.failed} |`),
    '',
    '## Slowest Steps',
    '',
    ...Object.entries(summary).flatMap(([flow, item]) => [
      `### ${flow}`,
      ...item.slowest.map((step) => `- ${step.name} [${step.category}]: ${step.durationMs}ms`),
      '',
    ]),
    '## Classification',
    '',
    'Root cause remains NOT_PROVEN. This baseline measures a proof/staging action-path wrapper, not production UI latency or a direct Next server-action invocation.',
    '',
    '## Cleanup',
    '',
    cleanupStatus,
    '',
  ];
  fs.writeFileSync(mdOutput, lines.join('\n'));
}

async function main() {
  let status = 'PASS_ACTION_WRAPPER_ONLY';
  let cleanupStatus = 'NOT_RUN';

  try {
    const ctx = await setup();
    const createCtx = await createBookingActionWrapper(ctx);
    await completeSessionActionWrapper(createCtx);
  } catch (error) {
    status = 'PARTIAL_NOT_PROVEN';
    console.error(error instanceof Error ? error.stack : error);
  } finally {
    await cleanup();
    cleanupStatus = records.filter((item) => item.flow === 'cleanup' && !item.ok).length ? 'PARTIAL' : 'PASS';
    writeReports(status, cleanupStatus);
    console.log(JSON.stringify({ marker, status, cleanupStatus, reports: { json: jsonOutput, markdown: mdOutput }, summary: summarize() }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
