#!/usr/bin/env npx tsx

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

type Category =
  | 'validation'
  | 'service'
  | 'db'
  | 'audit'
  | 'outbox'
  | 'revalidation'
  | 'response'
  | 'wrapper'
  | 'cleanup';

type TimedRecord = {
  flow: string;
  name: string;
  category: Category;
  durationMs: number;
  ok: boolean;
  error?: string;
};

type UiBaseline = {
  marker: string;
  status: string;
  cleanupStatus?: string;
  uiResult?: {
    browserSubmitToSaveCompleteMs?: number;
    browserSubmitToDbVisibleMs?: number;
  };
  nextActionPosts?: Array<{
    url: string;
    method: string;
    status?: number;
    nextAction?: string;
    durationMs: number;
  }>;
};

const envFile = process.env.BABYCARE_BASELINE_ENV_FILE || '.env.e2e';
const envPath = path.resolve(envFile);
const marker = `babycare-correlated-create-booking-trace-${Date.now()}`;
const outputDir = path.resolve('implementation-artifacts', 'investigations');
const jsonOutput = path.join(outputDir, `${marker}.json`);
const mdOutput = path.join(outputDir, `${marker}.md`);

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

if (!fs.existsSync(envPath)) fail(`Missing env file: ${envFile}`);
if (path.basename(envFile) !== '.env.e2e') {
  fail(`Refusing to run correlated trace outside .env.e2e. Got: ${envFile}`);
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
const runtimePerformanceChange = 'SKIP_PENDING_LOOKUP_FOR_NEW_CUSTOMER_APPLIED';

const records: TimedRecord[] = [];
const created = {
  packages: [] as string[],
  customers: [] as string[],
  bookings: [] as string[],
  sessionLogs: [] as string[],
  revenue: [] as string[],
  auditLogs: [] as string[],
};

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function tomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function timed<T>(flow: string, name: string, category: Category, fn: () => Promise<T> | T): Promise<T> {
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

async function timedQuery<T>(
  flow: string,
  name: string,
  category: Category,
  queryPromise: PromiseLike<{ data: T; error: { message: string } | null }>,
) {
  return timed(flow, name, category, async () => {
    const result = await queryPromise;
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
}

function loadLatestUiBaseline(): UiBaseline | null {
  const explicit = process.env.BABYCARE_UI_BASELINE_JSON;
  const files = explicit
    ? [path.resolve(explicit)]
    : fs.readdirSync(outputDir)
      .filter((name) => /^babycare-direct-ui-baseline-\d+\.json$/.test(name))
      .map((name) => path.join(outputDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const parsedBaseline = JSON.parse(fs.readFileSync(file, 'utf8')) as UiBaseline;
    const submitMs = parsedBaseline.uiResult?.browserSubmitToSaveCompleteMs
      ?? parsedBaseline.uiResult?.browserSubmitToDbVisibleMs;
    if (parsedBaseline.status === 'PASS_UI_BASELINE' && typeof submitMs === 'number') {
      return parsedBaseline;
    }
  }
  return null;
}

async function findReusableProofContext() {
  const allowedRoles = ['admin', 'super_admin', 'admin_staff', 'hr', 'accountant'];
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id,email,role,status,full_name,tenant_id')
    .eq('status', 'active')
    .in('role', allowedRoles)
    .limit(1000);
  if (usersError) throw new Error(usersError.message);

  const tenantIds = unique((users || []).map((user) => user.tenant_id as string));
  if (tenantIds.length === 0) throw new Error('No reusable proof users found');

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id,name,status,enabled_modules')
    .eq('status', 'active')
    .in('id', tenantIds);
  if (tenantsError) throw new Error(tenantsError.message);

  const babycareTenants = new Map(
    (tenants || [])
      .filter((tenant) => Boolean((tenant.enabled_modules as Record<string, unknown> | null)?.babycare))
      .map((tenant) => [tenant.id, tenant]),
  );
  const candidates = (users || [])
    .filter((user) => user.tenant_id && babycareTenants.has(user.tenant_id))
    .map((user) => ({ user, tenant: babycareTenants.get(user.tenant_id)! }));
  const preferred = candidates.find((candidate) => candidate.tenant.name === 'babycare-save-baseline-1790914296924 tenant')
    || candidates.find((candidate) => candidate.tenant.name?.startsWith('babycare-save-baseline-'))
    || candidates[0];
  if (!preferred) throw new Error('No reusable BabyCare proof tenant found');

  const { tenant, user } = preferred;
  const { data: ktv, error: ktvError } = await supabase
    .from('users')
    .select('id,email,role,status,full_name')
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .eq('role', 'ktv')
    .limit(1)
    .maybeSingle();
  if (ktvError) throw new Error(ktvError.message);
  if (!ktv) throw new Error(`No KTV found for proof tenant ${tenant.id}`);

  const packageId = await timedQuery<{ id: string }>(
    'setup',
    'insert_trace_package',
    'db',
    supabase
      .from('packages')
      .insert({
        tenant_id: tenant.id,
        name: `${marker} Goi cham soc me be`,
        description: 'BabyCare correlated trace proof package',
        price: 1200000,
        total_sessions: 3,
        session_multiplier: 1,
        status: 'active',
        module_key: 'babycare',
        default_duration_minutes: 60,
      })
      .select('id')
      .single(),
  );
  created.packages.push(packageId.id);

  return {
    tenantId: tenant.id as string,
    tenantName: tenant.name as string,
    adminId: user.id as string,
    adminEmail: user.email as string,
    ktvId: ktv.id as string,
    ktvName: (ktv.full_name || ktv.email) as string,
    packageId: packageId.id,
  };
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

async function runCreateBookingTrace(ctx: Awaited<ReturnType<typeof findReusableProofContext>>) {
  const flow = 'create_booking_correlated_trace';
  const startDate = tomorrow();
  const customerPhone = `07${Math.floor(Math.random() * 90000000 + 10000000)}`;
  let bookingId = '';
  let customerId = '';

  await timed(flow, 'action_equivalent_total', 'wrapper', async () => {
    const { bookingSchema } = await import('../src/lib/validations');
    const { sanitizeTime } = await import('@bella/shared');

    await timed(flow, 'rate_limit_not_measured_request_context', 'validation', () => ({ skipped: true }));

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

    await timedQuery(flow, 'resolve_booking_tenant_probe', 'db', supabase.from('tenants').select('id,status,enabled_modules').eq('id', ctx.tenantId).single());
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
          phone: customerPhone,
          name_baby: `${marker} baby`,
          address: 'Proof staging address',
          status: 'active',
        })
        .select('*')
        .single(),
    );
    customerId = customer.id;
    created.customers.push(customerId);
    await recordAudit(flow, ctx.tenantId, ctx.adminId, 'INSERT', 'customers', customerId, null, customer);

    await timed(flow, 'find_pending_booking_for_customer_skipped_new_customer', 'service', () => null);

    const tenant = await timedQuery<Record<string, unknown>>(flow, 'construct_tenant_context_select', 'db', supabase.from('tenants').select('*').eq('id', ctx.tenantId).single());
    await timed(flow, 'construct_tenant_context_shape', 'service', () => {
      if (!tenant.id) throw new Error('Missing tenant context');
      return {
        tenantId: tenant.id,
        enabledModules: ['spa'],
      };
    });

    const pkg = await timedQuery<{ price: number; name: string; total_sessions: number }>(
      flow,
      'pricing_package_select',
      'db',
      supabase.from('packages').select('price,name,total_sessions').eq('id', ctx.packageId).single(),
    );

    const bookingPayload = await timed(flow, 'build_booking_payload', 'service', () => ({
      booking_number: `BK-${Date.now()}`,
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
      metadata: { marker, source: 'CORRELATED_CREATE_BOOKING_TRACE' },
    }));

    await timed(flow, 'adapter_validation_noop', 'validation', () => ({ success: true }));

    const booking = await timedQuery<{ id: string } & Record<string, unknown>>(
      flow,
      'insert_booking_select',
      'db',
      supabase
        .from('bookings')
        .insert(bookingPayload)
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
      supabase
        .from('accounting_periods')
        .select('id,status,start_date,end_date')
        .eq('tenant_id', ctx.tenantId)
        .lte('start_date', receivedDate)
        .gte('end_date', receivedDate)
        .limit(1)
        .maybeSingle(),
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

    const { safeRevalidatePath } = await import('../src/lib/revalidate');
    await timed(flow, 'safe_revalidate_paths_probe', 'revalidation', async () => {
      const revalPaths = ['/dashboard/bookings', '/dashboard/sessions', '/dashboard/customers', `/dashboard/customers/${customerId}`, '/dashboard', '/dashboard/finance'];
      await Promise.all(revalPaths.map((item) => safeRevalidatePath(item)));
    });

    await timed(flow, 'response_shape', 'response', () => ({ data: { id: bookingId } }));
  });

  return { customerPhone, customerId, bookingId };
}

async function cleanup() {
  const outboxReferenceIds = unique([...created.revenue, ...created.bookings, ...created.sessionLogs]);
  const cleanupSteps: Array<[string, string[], () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['delete_accounting_outbox_by_reference_ids', outboxReferenceIds, () => supabase.from('accounting_outbox').delete().in('reference_id', outboxReferenceIds)],
    ['delete_session_logs', created.sessionLogs, () => supabase.from('session_logs').delete().in('id', created.sessionLogs)],
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
}

async function verifyCleanup(customerPhone?: string) {
  if (!customerPhone) return null;
  const { data: customers, error: customerError } = await supabase.from('customers').select('id').eq('phone', customerPhone);
  if (customerError) throw new Error(customerError.message);
  const customerIds = (customers || []).map((item) => item.id as string);
  const { data: bookings, error: bookingError } = customerIds.length
    ? await supabase.from('bookings').select('id').in('customer_id', customerIds)
    : { data: [], error: null };
  if (bookingError) throw new Error(bookingError.message);
  const bookingIds = (bookings || []).map((item) => item.id as string);
  const { data: revenue, error: revenueError } = bookingIds.length
    ? await supabase.from('revenue').select('id').in('booking_id', bookingIds)
    : { data: [], error: null };
  if (revenueError) throw new Error(revenueError.message);
  const { data: sessions, error: sessionError } = bookingIds.length
    ? await supabase.from('session_logs').select('id').in('booking_id', bookingIds)
    : { data: [], error: null };
  if (sessionError) throw new Error(sessionError.message);
  return {
    customers: customerIds.length,
    bookings: bookingIds.length,
    revenue: (revenue || []).length,
    sessions: (sessions || []).length,
  };
}

function summarize() {
  const traceRecords = records.filter((record) => record.flow === 'create_booking_correlated_trace');
  const summary = {
    actionEquivalentTotalMs: traceRecords.find((record) => record.name === 'action_equivalent_total')?.durationMs || 0,
    dbMs: 0,
    auditMs: 0,
    outboxMs: 0,
    validationMs: 0,
    serviceMs: 0,
    revalidationMs: 0,
    responseMs: 0,
    failed: traceRecords.filter((record) => !record.ok).length,
    slowest: traceRecords
      .filter((record) => record.name !== 'action_equivalent_total')
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10),
  };

  for (const record of traceRecords) {
    if (record.category === 'db') summary.dbMs += record.durationMs;
    if (record.category === 'audit') summary.auditMs += record.durationMs;
    if (record.category === 'outbox') summary.outboxMs += record.durationMs;
    if (record.category === 'validation') summary.validationMs += record.durationMs;
    if (record.category === 'service') summary.serviceMs += record.durationMs;
    if (record.category === 'revalidation') summary.revalidationMs += record.durationMs;
    if (record.category === 'response') summary.responseMs += record.durationMs;
  }

  for (const key of ['actionEquivalentTotalMs', 'dbMs', 'auditMs', 'outboxMs', 'validationMs', 'serviceMs', 'revalidationMs', 'responseMs'] as const) {
    summary[key] = Number(summary[key].toFixed(2));
  }
  return summary;
}

function getDominantCandidate(summary: ReturnType<typeof summarize>) {
  const buckets = [
    { name: 'db', durationMs: summary.dbMs },
    { name: 'audit', durationMs: summary.auditMs },
    { name: 'outbox', durationMs: summary.outboxMs },
    { name: 'validation', durationMs: summary.validationMs },
    { name: 'service', durationMs: summary.serviceMs },
    { name: 'revalidation', durationMs: summary.revalidationMs },
    { name: 'response', durationMs: summary.responseMs },
  ].sort((a, b) => b.durationMs - a.durationMs);
  const top = buckets[0];
  const share = summary.actionEquivalentTotalMs > 0
    ? Number(((top.durationMs / summary.actionEquivalentTotalMs) * 100).toFixed(1))
    : 0;
  return { ...top, sharePct: share };
}

function writeReports(status: string, cleanupStatus: string, uiBaseline: UiBaseline | null, cleanupVerification: Awaited<ReturnType<typeof verifyCleanup>>) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = summarize();
  const dominant = getDominantCandidate(summary);
  const uiSubmitMs = uiBaseline?.uiResult?.browserSubmitToSaveCompleteMs
    ?? uiBaseline?.uiResult?.browserSubmitToDbVisibleMs
    ?? null;
  const likelySubmitPost = uiBaseline?.nextActionPosts?.[uiBaseline.nextActionPosts.length - 1] || null;
  const payload = {
    marker,
    status,
    cleanupStatus,
    environment: { envFile, host, safety: 'E2E_ONLY_CORRELATED_TRACE', runtimePerformanceChange },
    uiBaseline: uiBaseline
      ? {
        marker: uiBaseline.marker,
        status: uiBaseline.status,
        cleanupStatus: uiBaseline.cleanupStatus,
        browserSubmitMs: uiSubmitMs,
        likelySubmitNextActionPost: likelySubmitPost,
        submitPostInference: 'last Next-Action POST in latest direct UI baseline; not cryptographically mapped to function name',
      }
      : null,
    actionEquivalentSummary: summary,
    dominantCandidate: dominant,
    cleanupVerification,
    interpretation: {
      rootCause: 'NOT_PROVEN',
      why: 'This trace correlates latest UI timing with an action-equivalent per-step trace, but does not instrument the exported Next server action internals in the same request.',
      nextAction: 'If optimizing is approved later, prove the dominant bucket in a same-request trace or choose one minimal DB/audit/outbox fix only after evidence.',
    },
    records,
  };
  fs.writeFileSync(jsonOutput, JSON.stringify(payload, null, 2));

  const lines = [
    `# CORRELATED_CREATE_BOOKING_TRACE ${marker}`,
    '',
    `Status: ${status}`,
    `Cleanup: ${cleanupStatus}`,
    `Environment: ${envFile} / ${host}`,
    '',
    '## Scope',
    '',
    '- Production mutation: FORBIDDEN',
    `- Runtime performance code change: ${runtimePerformanceChange}`,
    '- Flow: Create Booking only',
    '- Direct exported Next server action internals: NOT_INSTRUMENTED',
    '',
    '## UI Correlation',
    '',
    `- UI baseline marker: ${uiBaseline?.marker || 'NOT_FOUND'}`,
    `- UI submit -> save-complete business rows: ${uiSubmitMs ?? 'NOT_MEASURED'}ms`,
    `- Likely submit Next-Action POST: ${likelySubmitPost ? `${likelySubmitPost.durationMs}ms (${likelySubmitPost.nextAction || 'no id'})` : 'NOT_AVAILABLE'}`,
    '- Submit POST identification is inferred from latest UI baseline order, not direct symbol mapping.',
    '',
    '## Action-Equivalent Trace Summary',
    '',
    '| Bucket | ms |',
    '| --- | ---: |',
    `| action equivalent total | ${summary.actionEquivalentTotalMs} |`,
    `| db | ${summary.dbMs} |`,
    `| audit | ${summary.auditMs} |`,
    `| outbox | ${summary.outboxMs} |`,
    `| validation | ${summary.validationMs} |`,
    `| service | ${summary.serviceMs} |`,
    `| revalidation | ${summary.revalidationMs} |`,
    `| response | ${summary.responseMs} |`,
    '',
    `Dominant measured bucket: ${dominant.name} (${dominant.durationMs}ms, ${dominant.sharePct}% of action-equivalent total)`,
    '',
    '## Slowest Steps',
    '',
    '| Step | Category | ms |',
    '| --- | --- | ---: |',
    ...summary.slowest.map((step) => `| ${step.name} | ${step.category} | ${step.durationMs} |`),
    '',
    '## Cleanup Verification',
    '',
    cleanupVerification
      ? `customers=${cleanupVerification.customers}, bookings=${cleanupVerification.bookings}, revenue=${cleanupVerification.revenue}, sessions=${cleanupVerification.sessions}`
      : 'NOT_AVAILABLE',
    '',
    '## Classification',
    '',
    'Root cause remains NOT_PROVEN. DB is the dominant measured bucket in the action-equivalent trace only if shown above, but this is not yet a same-request exported Next server-action internal trace.',
    '',
  ];
  fs.writeFileSync(mdOutput, lines.join('\n'));
}

async function main() {
  const uiBaseline = loadLatestUiBaseline();
  let status = 'PASS_CORRELATED_TRACE';
  let cleanupStatus = 'NOT_RUN';
  let customerPhone: string | undefined;
  let cleanupVerification: Awaited<ReturnType<typeof verifyCleanup>> = null;

  try {
    const ctx = await findReusableProofContext();
    const result = await runCreateBookingTrace(ctx);
    customerPhone = result.customerPhone;
  } catch (error) {
    status = 'PARTIAL_NOT_PROVEN';
    console.error(error instanceof Error ? error.stack : error);
  } finally {
    await cleanup();
    cleanupStatus = records.filter((item) => item.flow === 'cleanup' && !item.ok).length ? 'PARTIAL' : 'PASS';
    cleanupVerification = await verifyCleanup(customerPhone).catch(() => null);
    writeReports(status, cleanupStatus, uiBaseline, cleanupVerification);
    console.log(JSON.stringify({
      marker,
      status,
      cleanupStatus,
      reports: { json: jsonOutput, markdown: mdOutput },
      uiBaseline: uiBaseline?.marker,
      summary: summarize(),
      cleanupVerification,
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
