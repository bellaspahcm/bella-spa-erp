#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.BABYCARE_BASELINE_ENV_FILE || '.env.e2e';
const envPath = path.resolve(envFile);
const marker = `babycare-save-baseline-${Date.now()}`;
const outputDir = path.resolve('implementation-artifacts', 'investigations');
const jsonOutput = path.join(outputDir, `${marker}.json`);
const mdOutput = path.join(outputDir, `${marker}.md`);

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (!fs.existsSync(envPath)) {
  fail(`Missing env file: ${envFile}`);
}

if (path.basename(envFile) !== '.env.e2e') {
  fail(`Refusing to run mutation baseline outside .env.e2e. Got: ${envFile}`);
}

const parsed = dotenv.parse(fs.readFileSync(envPath));
const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL;
const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in .env.e2e');
}

const host = new URL(supabaseUrl).host;
if (host !== 'bmnbqbcdbuklhopfbopv.supabase.co') {
  fail(`Unexpected E2E Supabase host: ${host}`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created = {
  tenants: [],
  users: [],
  customers: [],
  packages: [],
  bookings: [],
  sessionLogs: [],
  revenue: [],
  auditLogs: [],
  sessionReviews: [],
  salaryRecords: [],
};

const stepResults = [];

function redactId(id) {
  return typeof id === 'string' ? `${id.slice(0, 8)}...` : id;
}

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function tomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function timed(flow, name, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Number((performance.now() - start).toFixed(2));
    stepResults.push({ flow, name, durationMs, ok: true });
    return result;
  } catch (error) {
    const durationMs = Number((performance.now() - start).toFixed(2));
    const message = error instanceof Error ? error.message : String(error);
    stepResults.push({ flow, name, durationMs, ok: false, error: message });
    throw error;
  }
}

async function timedQuery(flow, name, queryPromise) {
  return timed(flow, name, async () => {
    const result = await queryPromise;
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data;
  });
}

async function insertReturningId(flow, name, table, payload) {
  const row = await timedQuery(
    flow,
    name,
    supabase.from(table).insert(payload).select('id').single()
  );
  return row.id;
}

async function setup() {
  const tenantId = await insertReturningId('setup', 'insert_tenant', 'tenants', {
    name: `${marker} tenant`,
    status: 'active',
    enabled_modules: {
      babycare: true,
      beauty_spa: false,
      payroll: true,
      inventory: true,
    },
    product_key: 'bella_babycare',
  });
  created.tenants.push(tenantId);

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
    description: 'BabyCare save baseline proof package',
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

async function recordAudit(flow, tenantId, changedById, action, tableName, recordId, oldData, newData) {
  const auditId = await insertReturningId(flow, `audit_${tableName}_${action.toLowerCase()}`, 'audit_logs', {
    tenant_id: tenantId,
    changed_by_id: changedById,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData || null,
    new_data: newData || null,
  });
  created.auditLogs.push(auditId);
}

async function createBookingBaseline(ctx) {
  const flow = 'create_booking';
  const startDate = tomorrow();

  await timedQuery(
    flow,
    'package_scope_package_select',
    supabase.from('packages').select('id,tenant_id,module_key,name').eq('id', ctx.packageId).single()
  );
  await timedQuery(
    flow,
    'package_scope_tenant_select',
    supabase.from('tenants').select('enabled_modules').eq('id', ctx.tenantId).single()
  );

  const customer = await timedQuery(
    flow,
    'insert_customer_select',
    supabase.from('customers').insert({
      tenant_id: ctx.tenantId,
      name_mother: `${marker} customer`,
      phone: `07${Math.floor(Math.random() * 90000000 + 10000000)}`,
      name_baby: `${marker} baby`,
      status: 'active',
    }).select('*').single()
  );
  created.customers.push(customer.id);
  await recordAudit(flow, ctx.tenantId, ctx.adminId, 'INSERT', 'customers', customer.id, null, customer);

  await timedQuery(
    flow,
    'find_pending_booking_for_customer',
    supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('tenant_id', ctx.tenantId)
      .in('status', ['deposit_pending', 'lead'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );

  await timedQuery(
    flow,
    'construct_tenant_context',
    supabase.from('tenants').select('*').eq('id', ctx.tenantId).single()
  );

  await timedQuery(
    flow,
    'pricing_package_select',
    supabase
      .from('packages')
      .select('id,tenant_id,module_key,name,description,price,total_sessions,session_multiplier')
      .eq('id', ctx.packageId)
      .single()
  );

  const booking = await timedQuery(
    flow,
    'insert_booking_select',
    supabase.from('bookings').insert({
      tenant_id: ctx.tenantId,
      customer_id: customer.id,
      booking_number: `BBSB-${Date.now()}`,
      package_id: ctx.packageId,
      package_name: `${marker} Goi cham soc me be`,
      status: 'booked',
      full_price: 1200000,
      deposit_amount: 300000,
      total_sessions: 3,
      completed_sessions: 0,
      ktv_commission: 50000,
      discount_percent: 0,
      start_date: startDate,
      assigned_ktv_id: ctx.ktvId,
      preferred_time: '10:00',
      metadata: { marker, source: 'BABYCARE_SAVE_BASELINE' },
    }).select('*').single()
  );
  created.bookings.push(booking.id);
  await recordAudit(flow, ctx.tenantId, ctx.adminId, 'INSERT', 'bookings', booking.id, null, booking);

  await timedQuery(
    flow,
    'accounting_period_probe',
    supabase
      .from('accounting_periods')
      .select('id,status,start_date,end_date')
      .eq('tenant_id', ctx.tenantId)
      .lte('start_date', today())
      .gte('end_date', today())
      .limit(1)
      .maybeSingle()
  );

  const revenue = await timedQuery(
    flow,
    'insert_deposit_revenue',
    supabase.from('revenue').insert({
      tenant_id: ctx.tenantId,
      booking_id: booking.id,
      amount: 300000,
      revenue_type: 'deposit',
      payment_method: 'bank_transfer',
      received_date: today(),
      status: 'confirmed',
      notes: `Baseline deposit ${marker}`,
      business_event_type: 'PACKAGE_SALE',
      accounting_review_status: 'NEEDS_REVIEW',
      accounting_metadata: { marker, booking_id: booking.id },
    }).select('id').single()
  );
  created.revenue.push(revenue.id);

  await timed(flow, 'enqueue_deposit_outbox_rpc', async () => {
    const { data, error } = await supabase.rpc('enqueue_accounting_event', {
      p_tenant_id: ctx.tenantId,
      p_event_type: 'PACKAGE_SALE',
      p_reference_type: 'REVENUE',
      p_reference_id: revenue.id,
      p_payload: {
        marker,
        booking_id: booking.id,
        total_amount: 300000,
        description: `Baseline deposit ${marker}`,
      },
    });
    if (error) throw new Error(error.message);
    return data;
  });

  await timedQuery(
    flow,
    'existing_session_logs_count',
    supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
  );

  await timedQuery(
    flow,
    'package_default_duration_select',
    supabase.from('packages').select('default_duration_minutes').eq('id', ctx.packageId).single()
  );

  const sessions = Array.from({ length: 3 }, (_, index) => ({
    tenant_id: ctx.tenantId,
    booking_id: booking.id,
    session_number: index + 1,
    status: 'scheduled',
    assigned_date: startDate,
    assigned_time: '10:00',
    standard_duration: 60,
    accounting_review_status: 'NEEDS_REVIEW',
    accounting_metadata: { marker },
  }));
  const insertedSessions = await timedQuery(
    flow,
    'insert_initial_session_logs',
    supabase.from('session_logs').insert(sessions).select('id,session_number')
  );
  created.sessionLogs.push(...insertedSessions.map((s) => s.id));

  return { ...ctx, customerId: customer.id, bookingId: booking.id, sessionId: insertedSessions[0].id };
}

async function updateBookingBaseline(ctx) {
  const flow = 'update_booking';
  const oldBooking = await timedQuery(
    flow,
    'fetch_old_booking_for_audit',
    supabase.from('bookings').select('*').eq('id', ctx.bookingId).eq('tenant_id', ctx.tenantId).single()
  );

  await timedQuery(
    flow,
    'construct_tenant_context_for_validation',
    supabase.from('tenants').select('*').eq('id', ctx.tenantId).single()
  );

  await timedQuery(
    flow,
    'fetch_scheduled_sessions_for_conflict',
    supabase
      .from('session_logs')
      .select('id,assigned_date,assigned_time,booking_resource_id')
      .eq('booking_id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'scheduled')
  );

  const updated = await timedQuery(
    flow,
    'update_booking_select',
    supabase
      .from('bookings')
      .update({ preferred_time: '11:00', metadata: { marker, source: 'BABYCARE_SAVE_BASELINE_UPDATE' } })
      .eq('id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single()
  );
  await recordAudit(flow, ctx.tenantId, ctx.adminId, 'UPDATE', 'bookings', ctx.bookingId, oldBooking, {
    preferred_time: '11:00',
  });

  await timedQuery(
    flow,
    'sync_scheduled_session_times',
    supabase
      .from('session_logs')
      .update({ assigned_time: '11:00' })
      .eq('booking_id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'scheduled')
  );

  await timedQuery(
    flow,
    'progress_completed_count',
    supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'completed')
  );

  return { ...ctx, updatedBookingStatus: updated.status };
}

async function completeSessionBaseline(ctx) {
  const flow = 'complete_session';
  const existingLog = await timedQuery(
    flow,
    'fetch_existing_session',
    supabase.from('session_logs').select('*').eq('id', ctx.sessionId).eq('tenant_id', ctx.tenantId).single()
  );
  const booking = await timedQuery(
    flow,
    'fetch_booking_for_completion',
    supabase
      .from('bookings')
      .select('assigned_ktv_id,package_id,status,full_price,discount_percent,total_sessions,customer_id,tenant_id,package_name,ktv_commission,deposit_amount,completed_sessions,is_in_care')
      .eq('id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
      .single()
  );

  const completedDate = today();
  await timedQuery(
    flow,
    'update_session_completed',
    supabase
      .from('session_logs')
      .update({
        status: 'completed',
        completed_date: completedDate,
        completed_by_ktv_id: ctx.ktvId,
        notes: 'Baseline completion',
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
      .eq('tenant_id', ctx.tenantId)
  );

  await timedQuery(
    flow,
    'completion_accounting_period_probe',
    supabase
      .from('accounting_periods')
      .select('id,status,start_date,end_date')
      .eq('tenant_id', ctx.tenantId)
      .lte('start_date', completedDate)
      .gte('end_date', completedDate)
      .limit(1)
      .maybeSingle()
  );

  await timedQuery(
    flow,
    'count_completed_sessions',
    supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', ctx.bookingId)
      .eq('status', 'completed')
  );

  await timedQuery(
    flow,
    'fetch_current_booking_for_progress',
    supabase
      .from('bookings')
      .select('total_sessions,completed_sessions,status,package_name,ktv_commission,assigned_ktv_id,customer_id,tenant_id,full_price,deposit_amount,discount_percent,is_in_care')
      .eq('id', ctx.bookingId)
      .single()
  );

  await timedQuery(
    flow,
    'update_booking_progress',
    supabase
      .from('bookings')
      .update({ completed_sessions: 1, status: 'in_progress', is_in_care: true, last_updated_date: completedDate })
      .eq('id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
  );

  const salary = await timedQuery(
    flow,
    'insert_salary_record_probe',
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
      .single()
  );
  if (salary?.id) created.salaryRecords.push(salary.id);

  const review = await timedQuery(
    flow,
    'insert_session_review_placeholder',
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
      .single()
  );
  created.sessionReviews.push(review.id);

  await timedQuery(
    flow,
    'fetch_revenue_for_session_done_outbox',
    supabase
      .from('revenue')
      .select('amount,status,revenue_type')
      .eq('booking_id', ctx.bookingId)
      .eq('tenant_id', ctx.tenantId)
  );

  await timed(flow, 'enqueue_session_done_outbox_rpc', async () => {
    const { data, error } = await supabase.rpc('enqueue_accounting_event', {
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
        description: `Baseline session done ${existingLog.session_number || 1}/${booking.total_sessions || 3}`,
      },
    });
    if (error) throw new Error(error.message);
    return data;
  });

  return ctx;
}

function summarize() {
  const byFlow = {};
  for (const step of stepResults) {
    byFlow[step.flow] ||= { totalMs: 0, steps: 0, failed: 0, slowest: [] };
    byFlow[step.flow].totalMs = Number((byFlow[step.flow].totalMs + step.durationMs).toFixed(2));
    byFlow[step.flow].steps += 1;
    if (!step.ok) byFlow[step.flow].failed += 1;
    byFlow[step.flow].slowest.push(step);
  }
  for (const flow of Object.values(byFlow)) {
    flow.slowest = flow.slowest.sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
  }
  return byFlow;
}

async function cleanup() {
  const cleanupSteps = [];
  async function clean(name, fn) {
    const start = performance.now();
    try {
      await fn();
      cleanupSteps.push({ name, ok: true, durationMs: Number((performance.now() - start).toFixed(2)) });
    } catch (error) {
      cleanupSteps.push({
        name,
        ok: false,
        durationMs: Number((performance.now() - start).toFixed(2)),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await clean('delete_accounting_outbox_by_tenant', () => supabase.from('accounting_outbox').delete().eq('tenant_id', created.tenants[0] || ''));
  if (created.sessionReviews.length) await clean('delete_session_reviews', () => supabase.from('session_reviews').delete().in('id', created.sessionReviews));
  if (created.sessionLogs.length) await clean('delete_session_logs', () => supabase.from('session_logs').delete().in('id', created.sessionLogs));
  if (created.salaryRecords.length) await clean('delete_salary_records', () => supabase.from('salary_records').delete().in('id', created.salaryRecords));
  if (created.revenue.length) await clean('delete_revenue', () => supabase.from('revenue').delete().in('id', created.revenue));
  if (created.bookings.length) await clean('delete_bookings', () => supabase.from('bookings').delete().in('id', created.bookings));
  if (created.auditLogs.length) await clean('delete_audit_logs', () => supabase.from('audit_logs').delete().in('id', created.auditLogs));
  if (created.packages.length) await clean('delete_packages', () => supabase.from('packages').delete().in('id', created.packages));
  if (created.customers.length) await clean('delete_customers', () => supabase.from('customers').delete().in('id', created.customers));
  if (created.users.length) await clean('delete_users', () => supabase.from('users').delete().in('id', created.users));
  if (created.tenants.length) await clean('delete_tenants', () => supabase.from('tenants').delete().in('id', created.tenants));

  return cleanupSteps;
}

function writeReports(report) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonOutput, JSON.stringify(report, null, 2));

  const lines = [];
  lines.push(`# BABYCARE_SAVE_BASELINE ${marker}`);
  lines.push('');
  lines.push(`Status: ${report.status}`);
  lines.push(`Environment: ${report.environment.envFile} / ${report.environment.host}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Production mutation: FORBIDDEN');
  lines.push('- Runtime code change: NONE');
  lines.push('- Server action total latency: NOT_MEASURED');
  lines.push('- DB critical path baseline: MEASURED');
  lines.push('');
  lines.push('## Flow Summary');
  lines.push('');
  lines.push('| Flow | Steps | Total measured ms | Failed steps |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const [flow, summary] of Object.entries(report.summaryByFlow)) {
    lines.push(`| ${flow} | ${summary.steps} | ${summary.totalMs} | ${summary.failed} |`);
  }
  lines.push('');
  lines.push('## Slowest Steps');
  lines.push('');
  for (const [flow, summary] of Object.entries(report.summaryByFlow)) {
    lines.push(`### ${flow}`);
    for (const step of summary.slowest) {
      lines.push(`- ${step.name}: ${step.durationMs}ms${step.ok ? '' : ` ERROR=${step.error}`}`);
    }
    lines.push('');
  }
  lines.push('## Classification');
  lines.push('');
  lines.push('Root cause remains NOT_PROVEN because this measures DB critical path, not full UI/server action latency.');
  lines.push('Use these timings to decide which exact app-level spans need instrumentation next.');
  lines.push('');
  lines.push('## Cleanup');
  lines.push('');
  lines.push('| Step | Status | ms |');
  lines.push('| --- | --- | ---: |');
  for (const step of report.cleanup) {
    lines.push(`| ${step.name} | ${step.ok ? 'OK' : `FAILED: ${step.error}`} | ${step.durationMs} |`);
  }
  lines.push('');

  fs.writeFileSync(mdOutput, lines.join('\n'));
}

(async () => {
  const report = {
    marker,
    status: 'IN_PROGRESS',
    environment: {
      envFile,
      host,
      safety: 'E2E_ONLY_MUTATION_BASELINE',
    },
    created: {},
    steps: stepResults,
    summaryByFlow: {},
    cleanup: [],
  };

  try {
    const setupContext = await setup();
    const createdContext = await createBookingBaseline(setupContext);
    const updatedContext = await updateBookingBaseline(createdContext);
    await completeSessionBaseline(updatedContext);
    report.status = stepResults.some((step) => !step.ok) ? 'PARTIAL' : 'PASS_DB_CRITICAL_PATH_ONLY';
  } catch (error) {
    report.status = 'PARTIAL_NOT_PROVEN';
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    report.created = {
      tenants: created.tenants.map(redactId),
      users: created.users.map(redactId),
      customers: created.customers.map(redactId),
      packages: created.packages.map(redactId),
      bookings: created.bookings.map(redactId),
      sessionLogs: created.sessionLogs.map(redactId),
      revenue: created.revenue.map(redactId),
      auditLogs: created.auditLogs.map(redactId),
      sessionReviews: created.sessionReviews.map(redactId),
      salaryRecords: created.salaryRecords.map(redactId),
    };
    report.cleanup = await cleanup();
    report.summaryByFlow = summarize();
    writeReports(report);
    console.log(JSON.stringify({
      marker,
      status: report.status,
      environment: report.environment,
      summaryByFlow: report.summaryByFlow,
      cleanup: report.cleanup,
      reports: {
        json: path.relative(process.cwd(), jsonOutput),
        markdown: path.relative(process.cwd(), mdOutput),
      },
      error: report.error,
    }, null, 2));
    if (report.status === 'PARTIAL_NOT_PROVEN') process.exit(1);
  }
})();
