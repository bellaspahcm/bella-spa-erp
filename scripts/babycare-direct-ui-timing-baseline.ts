#!/usr/bin/env npx tsx

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import { chromium, type Page, type Request } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

type NetworkTiming = {
  url: string;
  method: string;
  durationMs: number;
  status?: number;
  nextAction?: string;
  failed?: string;
};

type StepTiming = {
  name: string;
  durationMs: number;
  ok: boolean;
  error?: string;
};

const envFile = process.env.BABYCARE_BASELINE_ENV_FILE || '.env.e2e';
const envPath = path.resolve(envFile);
const marker = `babycare-direct-ui-baseline-${Date.now()}`;
const port = Number(process.env.BABYCARE_UI_BASELINE_PORT || 3217);
const baseUrl = `http://localhost:${port}`;
const outputDir = path.resolve('implementation-artifacts', 'investigations');
const jsonOutput = path.join(outputDir, `${marker}.json`);
const mdOutput = path.join(outputDir, `${marker}.md`);

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

if (!fs.existsSync(envPath)) fail(`Missing env file: ${envFile}`);
if (path.basename(envFile) !== '.env.e2e') {
  fail(`Refusing to run UI mutation baseline outside .env.e2e. Got: ${envFile}`);
}

const parsed = dotenv.parse(fs.readFileSync(envPath));
const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL;
const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_SECRET_KEY;
const anonKey = parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY in .env.e2e');
}

const host = new URL(supabaseUrl).host;
if (host !== 'bmnbqbcdbuklhopfbopv.supabase.co') {
  fail(`Unexpected E2E Supabase host: ${host}`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created = {
  tenants: [] as string[],
  users: [] as string[],
  packages: [] as string[],
  customers: [] as string[],
  bookings: [] as string[],
  sessionLogs: [] as string[],
  revenue: [] as string[],
  auditLogs: [] as string[],
  sessionReviews: [] as string[],
  salaryRecords: [] as string[],
};

const steps: StepTiming[] = [];
const networkTimings: NetworkTiming[] = [];
const requestStarts = new Map<Request, number>();

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function timed<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    steps.push({ name, durationMs: Number((performance.now() - start).toFixed(2)), ok: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ name, durationMs: Number((performance.now() - start).toFixed(2)), ok: false, error: message });
    throw error;
  }
}

async function query<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function insertId(table: string, payload: Record<string, unknown>) {
  const row = await query<{ id: string }>(supabase.from(table).insert(payload).select('id').single());
  return row.id;
}

async function setupProofTenant() {
  const allowedRoles = ['admin', 'super_admin', 'admin_staff', 'hr', 'accountant'];
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id,email,role,status,full_name,tenant_id')
    .eq('status', 'active')
    .in('role', allowedRoles)
    .limit(1000);
  if (usersError) throw new Error(usersError.message);

  const tenantIds = [...new Set((users || []).map((user) => user.tenant_id).filter(Boolean))];
  if (tenantIds.length === 0) {
    throw new Error('No active E2E users with package-read roles found for direct UI baseline');
  }

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

  if (!preferred) {
    throw new Error('No active E2E BabyCare tenant with package-read role found for direct UI baseline');
  }

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
  if (!ktv) {
    throw new Error(`No active KTV found in reusable E2E BabyCare tenant ${tenant.id}`);
  }

  const packageName = `${marker} Goi cham soc me be`;
  const packageId = await insertId('packages', {
    tenant_id: tenant.id,
    name: packageName,
    description: 'BabyCare direct UI timing proof package',
    price: 1200000,
    total_sessions: 3,
    session_multiplier: 1,
    status: 'active',
    module_key: 'babycare',
    default_duration_minutes: 60,
  });
  created.packages.push(packageId);

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    authUserId: user.id,
    authEmail: user.email,
    authRole: user.role,
    ktvId: ktv.id,
    ktvName: ktv.full_name || ktv.email,
    packageId,
    packageName,
    proofTenantMode: 'REUSE_EXISTING_E2E_BABYCARE_BASELINE_TENANT',
  };
}

function waitForServerReady(timeoutMs = 180_000) {
  const start = performance.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      const req = http.get(baseUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (performance.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for dev server at ${baseUrl}`));
          return;
        }
        setTimeout(check, 1000);
      });
      req.setTimeout(5000, () => {
        req.destroy();
      });
    };
    check();
  });
}

function startDevServer() {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm run dev -- --port ${port}`]
    : ['run', 'dev', '--', '--port', String(port)];
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      ...parsed,
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_SECRET_KEY: serviceRoleKey,
      SUPABASE_URL: supabaseUrl,
      E2E_ENV_FILE: envPath,
      E2E_BASE_URL: baseUrl,
      E2E_PORT: String(port),
    })
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value]),
  );
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const text = String(chunk);
    if (/error|failed|ready|local/i.test(text)) process.stdout.write(`[next] ${text}`);
  });
  child.stderr.on('data', (chunk) => {
    const text = String(chunk);
    if (/error|failed|ready|local|warn/i.test(text)) process.stderr.write(`[next] ${text}`);
  });

  return child;
}

function wireNetworkTiming(page: Page) {
  page.on('request', (request) => {
    requestStarts.set(request, performance.now());
  });
  page.on('requestfinished', async (request) => {
    const start = requestStarts.get(request);
    if (start === undefined) return;
    requestStarts.delete(request);
    const method = request.method();
    if (method !== 'POST') return;
    const response = await request.response().catch(() => null);
    networkTimings.push({
      url: request.url(),
      method,
      status: response?.status(),
      nextAction: request.headers()['next-action'],
      durationMs: Number((performance.now() - start).toFixed(2)),
    });
  });
  page.on('requestfailed', (request) => {
    const start = requestStarts.get(request);
    if (start === undefined) return;
    requestStarts.delete(request);
    if (request.method() !== 'POST') return;
    networkTimings.push({
      url: request.url(),
      method: request.method(),
      nextAction: request.headers()['next-action'],
      durationMs: Number((performance.now() - start).toFixed(2)),
      failed: request.failure()?.errorText,
    });
  });
}

async function clickPremiumOption(page: Page, labelText: string, optionText: string) {
  const label = page.getByText(labelText, { exact: false }).first();
  const section = label.locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]');
  await section.locator('button[type="button"]').first().click();
  await page.getByRole('button', { name: optionText }).first().click();
}

async function fillInputByLabel(page: Page, labelText: string, value: string) {
  const section = page.locator('div[class*="space-y-2"]').filter({ hasText: labelText }).first();
  await section.locator('input').first().fill(value);
}

function pushUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value);
  }
}

async function runUiBaseline(proof: Awaited<ReturnType<typeof setupProofTenant>>) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([
    {
      name: 'mock_user_email',
      value: proof.authEmail,
      url: baseUrl,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(60_000);
  wireNetworkTiming(page);

  const customerName = `${marker} UI customer`;
  const customerPhone = `07${Math.floor(Math.random() * 90000000 + 10000000)}`;

  try {
    await timed('browser_goto_dashboard', async () => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      const createButton = page.getByRole('button', { name: /Tạo Booking/i });
      try {
        await createButton.waitFor({ state: 'visible', timeout: 30_000 });
      } catch (error) {
        const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
        throw new Error(`Dashboard create button not visible. url=${page.url()} body=${bodyText.slice(0, 800)}`);
      }
    });

    await timed('open_booking_modal', async () => {
      await page.getByRole('button', { name: /Tạo Booking/i }).click();
      await page.getByText('Chọn khách hàng').waitFor({ state: 'visible' });
    });

    await timed('fill_customer_step', async () => {
      await page.getByRole('button', { name: /Khách mới/i }).click();
      await page.getByPlaceholder(/Nhập.*tên|VD:/i).first().fill(customerName);
      await page.getByPlaceholder(/Nhập số điện thoại/i).fill(customerPhone);
      await page.getByPlaceholder(/Nhập địa chỉ/i).fill('Proof staging address');
      await page.getByRole('button', { name: /Tiếp tục/i }).click();
      await page.getByText('Thông tin lịch hẹn').waitFor({ state: 'visible' });
    });

    await timed('fill_booking_step', async () => {
      const packageOption = page.getByText(proof.packageName, { exact: false }).first();
      try {
        await packageOption.waitFor({ state: 'visible', timeout: 45_000 });
      } catch (error) {
        const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
        throw new Error(`Proof package not visible in BookingModal. package=${proof.packageName} body=${bodyText.slice(0, 1200)}`);
      }
      await packageOption.click();
      await clickPremiumOption(page, 'Kỹ thuật viên phụ trách', proof.ktvName);
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const date = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      await page.locator('input[type="date"]').fill(date);
      await page.locator('input[type="time"]').fill('10:00');
      await fillInputByLabel(page, 'Tiền đặt cọc bổ sung', '300000');
    });

    const beforeSubmit = performance.now();
    await timed('submit_create_booking_until_success_visible_and_business_rows', async () => {
      await page.getByRole('button', { name: /Xác nhận tạo/i }).click();
      const successToast = page.getByText(/Tạo lịch hẹn thành công/i).first();
      const deadline = Date.now() + 45_000;
      let successVisible = false;
      while (Date.now() < deadline) {
        if (!successVisible) {
          successVisible = await successToast.isVisible().catch(() => false);
        }
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', proof.tenantId)
          .eq('phone', customerPhone)
          .maybeSingle();
        if (customer?.id) {
          created.customers.push(customer.id);
          const { data: booking } = await supabase
            .from('bookings')
            .select('id')
            .eq('tenant_id', proof.tenantId)
            .eq('customer_id', customer.id)
            .maybeSingle();
          if (booking?.id) {
            pushUnique(created.bookings, [booking.id]);
            const { data: sessions } = await supabase
              .from('session_logs')
              .select('id')
              .eq('tenant_id', proof.tenantId)
              .eq('booking_id', booking.id);
            pushUnique(created.sessionLogs, (sessions || []).map((item) => item.id as string));
            const { data: revenue } = await supabase
              .from('revenue')
              .select('id')
              .eq('tenant_id', proof.tenantId)
              .eq('booking_id', booking.id);
            pushUnique(created.revenue, (revenue || []).map((item) => item.id as string));
            if (successVisible && created.sessionLogs.length > 0 && created.revenue.length > 0) {
              return;
            }
          }
        }
        await page.waitForTimeout(500);
      }
      throw new Error(
        `Timed out waiting for UI-created booking success and business rows. successVisible=${successVisible} bookings=${created.bookings.length} sessions=${created.sessionLogs.length} revenue=${created.revenue.length}`,
      );
    });

    return {
      browserSubmitToSaveCompleteMs: Number((performance.now() - beforeSubmit).toFixed(2)),
      customerPhone,
      customerName,
      proofTenantMode: proof.proofTenantMode,
      proofTenantId: proof.tenantId,
      proofTenantName: proof.tenantName,
      proofAuthRole: proof.authRole,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

async function captureCreatedSideEffects() {
  const outboxReferenceIds = uniqueIds([
    ...created.revenue,
    ...created.bookings,
    ...created.sessionLogs,
    ...created.salaryRecords,
  ]);
  if (outboxReferenceIds.length > 0) {
    await timed('cleanup_delete_accounting_outbox_by_reference_ids', async () => {
      const { error } = await supabase.from('accounting_outbox').delete().in('reference_id', outboxReferenceIds);
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }
}

async function cleanup() {
  await captureCreatedSideEffects().catch(() => undefined);
  const cleanupSteps: Array<[string, string[], () => PromiseLike<{ error: { message: string } | null }>]> = [
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
    await timed(`cleanup_${name}`, async () => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }
  for (const userId of created.users) {
    await timed(`cleanup_delete_user_${userId.slice(0, 8)}`, async () => {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }
  for (const tenantId of created.tenants) {
    await timed(`cleanup_delete_tenant_${tenantId.slice(0, 8)}`, async () => {
      const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
      if (error) throw new Error(error.message);
    }).catch(() => undefined);
  }
}

function writeReports(status: string, cleanupStatus: string, uiResult: Record<string, unknown> | null) {
  fs.mkdirSync(outputDir, { recursive: true });
  const nextActionPosts = networkTimings.filter((item) => item.nextAction);
  const submitLatencyStatus = uiResult ? 'MEASURED' : 'NOT_MEASURED';
  const preSubmitNextActionStatus = nextActionPosts.length > 0 ? 'PRE_SUBMIT_MEASURED' : 'NOT_MEASURED';
  const runtimeContractContext = process.env.BABYCARE_UI_BASELINE_RUNTIME_CONTEXT
    || 'PACKAGE_MODULE_KEY_CONTRACT_FIX_APPLIED';
  const performanceCodeChangeContext = process.env.BABYCARE_UI_BASELINE_PERFORMANCE_CONTEXT
    || 'SKIP_PENDING_LOOKUP_FOR_NEW_CUSTOMER_APPLIED';
  const submitLatencyMs = uiResult?.browserSubmitToSaveCompleteMs
    ?? uiResult?.browserSubmitToDbVisibleMs
    ?? 'NOT_MEASURED';
  const payload = {
    marker,
    status,
    cleanupStatus,
    environment: { envFile, host, baseUrl, safety: 'E2E_ONLY_UI_MUTATION_BASELINE' },
    scope: {
      productionMutation: 'FORBIDDEN',
      runtimeContractContext,
      performanceCodeChanges: performanceCodeChangeContext,
      browserSubmitLatency: submitLatencyStatus,
      directNextDevServer: preSubmitNextActionStatus,
      directExportedServerAction: 'NOT_MEASURED',
    },
    uiResult,
    nextActionPosts,
    networkTimings,
    steps,
  };
  fs.writeFileSync(jsonOutput, JSON.stringify(payload, null, 2));

  const lines = [
    `# DIRECT_NEXT_OR_UI_TIMING_BASELINE ${marker}`,
    '',
    `Status: ${status}`,
    `Cleanup: ${cleanupStatus}`,
    `Environment: ${envFile} / ${host} / ${baseUrl}`,
    '',
    '## Scope',
    '',
    '- Production mutation: FORBIDDEN',
    `- Runtime contract context: ${runtimeContractContext}`,
    `- Performance code change: ${performanceCodeChangeContext}`,
    `- Browser submit latency: ${submitLatencyStatus}`,
    `- Direct Next dev-server path: ${preSubmitNextActionStatus}`,
    '- Direct exported server action: NOT_MEASURED',
    '',
    '## UI Result',
    '',
    `- Browser submit to save-complete business rows: ${submitLatencyMs}ms`,
    '',
    '## Next Action POSTs',
    '',
    '| URL | Status | Next-Action | ms |',
    '| --- | ---: | --- | ---: |',
    ...nextActionPosts.map((item) => `| ${item.url.replace(baseUrl, '')} | ${item.status ?? ''} | ${item.nextAction || ''} | ${item.durationMs} |`),
    '',
    '## Step Timings',
    '',
    '| Step | ms | Status |',
    '| --- | ---: | --- |',
    ...steps.map((item) => `| ${item.name} | ${item.durationMs} | ${item.ok ? 'OK' : `FAIL: ${item.error}`} |`),
    '',
    '## Classification',
    '',
    'Root cause remains NOT_PROVEN unless this UI timing is compared with the DB/action-wrapper baselines and repeated enough to rule out dev-server cold start/noise.',
    '',
  ];
  fs.writeFileSync(mdOutput, lines.join('\n'));
}

async function main() {
  let devServer: ChildProcessWithoutNullStreams | null = null;
  let status = 'PASS_UI_BASELINE';
  let cleanupStatus = 'NOT_RUN';
  let uiResult: Record<string, unknown> | null = null;

  try {
    const proof = await timed('setup_proof_tenant', setupProofTenant);
    devServer = startDevServer();
    await timed('wait_for_dev_server', waitForServerReady);
    uiResult = await timed('run_browser_create_booking_flow', () => runUiBaseline(proof));
  } catch (error) {
    status = 'PARTIAL_NOT_PROVEN';
    console.error(error instanceof Error ? error.stack : error);
  } finally {
    if (devServer) {
      if (process.platform === 'win32' && devServer.pid) {
        spawn('taskkill', ['/pid', String(devServer.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        devServer.kill();
      }
    }
    await cleanup();
    cleanupStatus = steps.some((item) => item.name.startsWith('cleanup_') && !item.ok) ? 'PARTIAL' : 'PASS';
    writeReports(status, cleanupStatus, uiResult);
    console.log(JSON.stringify({
      marker,
      status,
      cleanupStatus,
      reports: { json: jsonOutput, markdown: mdOutput },
      uiResult,
      nextActionPosts: networkTimings.filter((item) => item.nextAction),
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
