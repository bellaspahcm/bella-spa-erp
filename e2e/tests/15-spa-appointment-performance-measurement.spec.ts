/**
 * Spa appointment performance measurement.
 *
 * Measures user-perceived latency from click submit/save to UI confirmation for
 * the appointment workflows staff feel directly. This spec seeds and cleans a
 * temporary Beauty tenant only; it must not touch real Babycare operating data.
 */

import type { Browser, Page } from "@playwright/test";
import { expect, getE2eBaseUrl, isLocalE2eBaseUrl, test } from "../fixtures/auth";
import { admin, hasSupabaseAdminEnv } from "../helpers/supabase-admin";
import type { Database } from "../../src/types/database.types";

type InsertedId = { id: string };
type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type Metric = {
  flow: string;
  savedSignalMs: number;
  interactiveMs: number;
  backendPostMs: number | null;
  backgroundMs: number;
  postCount: number;
  postDurationsMs: number[];
};
type BrowserLog = { type: string; text: string };

function getVietnamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getVietnamDateKey(date);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireRow<T>(label: string, query: QueryResult<T>): Promise<T> {
  const { data, error } = await query;
  if (error || !data) throw new Error(`${label} failed: ${error?.message ?? "no row returned"}`);
  return data;
}

function assertUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid UUID for test cleanup: ${value}`);
  }
  return value;
}

async function cleanupTenant(client: ReturnType<typeof admin>, tenantId: string) {
  const safeTenantId = assertUuid(tenantId);
  const { error } = await client.rpc("exec_sql" as never, {
    sql_query: `
      DO $$
      BEGIN
        ALTER TABLE public.timeline_events DISABLE RULE timeline_events_no_delete;
        DELETE FROM public.timeline_events WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.session_reviews WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.invoice_print_logs WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.inventory_logs WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.session_logs WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.bookings WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.customers WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.booking_resources WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.packages WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.users WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.timeline_events WHERE tenant_id = '${safeTenantId}';
        DELETE FROM public.tenants WHERE id = '${safeTenantId}';
        ALTER TABLE public.timeline_events ENABLE RULE timeline_events_no_delete;
      EXCEPTION WHEN OTHERS THEN
        ALTER TABLE public.timeline_events ENABLE RULE timeline_events_no_delete;
        RAISE;
      END $$;
    `,
  } as never);
  if (error) throw new Error(`Performance tenant cleanup failed: ${error.message}`);
}

async function openMockUserPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: getE2eBaseUrl(),
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([{ name: "mock_user_email", value: email, url: getE2eBaseUrl(), sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(45_000);
  return page;
}

async function selectPremiumOption(page: Page, currentText: RegExp | string, optionText: RegExp | string) {
  await page.getByRole("button", { name: currentText }).first().click();
  await page.getByRole("button", { name: optionText }).last().click();
}

async function openSessionDetail(page: Page, customerName: string) {
  await page.getByText(customerName).first().click();
  await expect(page.getByText(/Chi tiết lịch hẹn/i)).toBeVisible({ timeout: 10_000 });
}

async function measureUiSave(
  page: Page,
  flow: string,
  clickSubmit: () => Promise<void>,
  waitUntilSavedSignal: () => Promise<void>,
  waitUntilInteractive: () => Promise<void>,
  browserLogs: BrowserLog[] = [],
): Promise<Metric> {
  const posts: number[] = [];
  const requestStartedAt = new Map<string, number>();
  let requestSequence = 0;
  const requestListener = (request: Parameters<Parameters<Page["on"]>[1]>[0]) => {
    if (request.url().includes("/dashboard/bookings") && request.method() === "POST") {
      requestStartedAt.set(`${requestSequence++}:${request.url()}`, performance.now());
    }
  };
  const responseListener = (response: Parameters<Parameters<Page["on"]>[1]>[0]) => {
    if (response.url().includes("/dashboard/bookings") && response.request().method() === "POST") {
      const matchingEntry = Array.from(requestStartedAt.entries()).find(([, started]) => started <= performance.now());
      if (matchingEntry) {
        posts.push(Math.round(performance.now() - matchingEntry[1]));
        requestStartedAt.delete(matchingEntry[0]);
      }
    }
  };

  page.on("request", requestListener);
  page.on("response", responseListener);
  const startedAt = performance.now();
  await clickSubmit();
  try {
    await waitUntilSavedSignal();
  } catch (error) {
    const visibleText = await page.locator("body").innerText().catch(() => "");
    throw new Error(`${flow} did not show saved UI signal. Browser logs: ${JSON.stringify(browserLogs.slice(-20))}. Visible text:\n${visibleText.slice(0, 4000)}`, {
      cause: error,
    });
  }
  const savedAt = performance.now();
  try {
    await waitUntilInteractive();
  } catch (error) {
    const visibleText = await page.locator("body").innerText().catch(() => "");
    throw new Error(`${flow} did not become interactive after saved signal. Browser logs: ${JSON.stringify(browserLogs.slice(-20))}. Visible text:\n${visibleText.slice(0, 4000)}`, {
      cause: error,
    });
  }
  const interactiveAt = performance.now();
  await page.waitForTimeout(1_500);
  const backgroundDoneAt = performance.now();
  page.off("request", requestListener);
  page.off("response", responseListener);

  const metric = {
    flow,
    savedSignalMs: Math.round(savedAt - startedAt),
    interactiveMs: Math.round(interactiveAt - startedAt),
    backendPostMs: posts.length > 0 ? Math.max(...posts) : null,
    backgroundMs: Math.round(backgroundDoneAt - interactiveAt),
    postCount: posts.length,
    postDurationsMs: posts,
  };
  console.log(`[appointment-perf] ${JSON.stringify(metric)}`);
  return metric;
}

test.describe("Spa appointment performance measurement", () => {
  test.setTimeout(180_000);
  test.skip(!isLocalE2eBaseUrl() || !hasSupabaseAdminEnv(), "Uses localhost mock auth plus Supabase service-role env.");

  test("measures create, edit, assign KTV, and reschedule latency", async ({ browser }) => {
    const client = admin();
    const marker = `E2E-SPA-PERF-${Date.now()}`;
    const today = getVietnamDateKey();
    const tomorrow = addDays(today, 1);
    const adminEmail = `${marker.toLowerCase()}@bellaspa.test`;
    const customerCName = `${marker} Customer C`;
    const metrics: Metric[] = [];
    let tenantId = "";

    try {
      const tenant = await requireRow<InsertedId>("insert tenant", client.from("tenants").insert({
        name: `${marker} Tenant`,
        email: `${marker.toLowerCase()}@tenant.test`,
        status: "active",
        royalty_type: "percentage",
        royalty_rate: 0,
        enabled_modules: { babycare: false, beauty_spa: true },
        brand_theme: { displayName: "E2E Spa Performance", primaryColor: "#0B1F3A" },
      } satisfies Database["public"]["Tables"]["tenants"]["Insert"]).select("id").single());
      tenantId = tenant.id;

      const [adminUser, ktvA, ktvB] = await Promise.all([
        requireRow<InsertedId>("insert admin", client.from("users").insert({ email: adminEmail, full_name: `${marker} Admin`, role: "admin", status: "active", tenant_id: tenant.id } satisfies Database["public"]["Tables"]["users"]["Insert"]).select("id").single()),
        requireRow<InsertedId>("insert ktv A", client.from("users").insert({ email: `${marker.toLowerCase()}.ktv-a@bellaspa.test`, full_name: `${marker} KTV A`, role: "ktv", status: "active", tenant_id: tenant.id } satisfies Database["public"]["Tables"]["users"]["Insert"]).select("id").single()),
        requireRow<InsertedId>("insert ktv B", client.from("users").insert({ email: `${marker.toLowerCase()}.ktv-b@bellaspa.test`, full_name: `${marker} KTV B`, role: "ktv", status: "active", tenant_id: tenant.id } satisfies Database["public"]["Tables"]["users"]["Insert"]).select("id").single()),
      ]);
      expect(adminUser.id).toBeTruthy();
      expect(ktvA.id).toBeTruthy();
      expect(ktvB.id).toBeTruthy();

      const pkg = await requireRow<InsertedId>("insert package", client.from("packages").insert({
        tenant_id: tenant.id,
        name: `${marker} Package`,
        module_key: "beauty_spa",
        service_kind: "treatment_package",
        service_category: "facial",
        full_price: 1500000,
        price: 1500000,
        total_sessions: 5,
        requires_resource: false,
        default_resource_type: "room",
        status: "active",
      } satisfies Database["public"]["Tables"]["packages"]["Insert"]).select("id").single());

      await requireRow<InsertedId>("insert room", client.from("booking_resources").insert({
        tenant_id: tenant.id,
        name: `${marker} Room`,
        resource_type: "room",
        status: "available",
        capacity: 1,
      } satisfies Database["public"]["Tables"]["booking_resources"]["Insert"]).select("id").single());

      const [customerC] = await Promise.all([
        requireRow<InsertedId>("insert customer C", client.from("customers").insert({ tenant_id: tenant.id, phone: `07${String(Date.now()).slice(-8)}`, name_mother: customerCName, status: "active" } satisfies Database["public"]["Tables"]["customers"]["Insert"]).select("id").single()),
      ]);

      const bookingC = await requireRow<InsertedId>("insert booking C", client.from("bookings").insert({ tenant_id: tenant.id, customer_id: customerC.id, package_id: pkg.id, package_name: `${marker} Package`, booking_number: `${marker}-C`, full_price: 1500000, deposit_amount: 300000, total_sessions: 5, completed_sessions: 0, start_date: today, preferred_time: "09:00", assigned_ktv_id: ktvB.id, status: "in_progress" } satisfies Database["public"]["Tables"]["bookings"]["Insert"]).select("id").single());

      const page = await openMockUserPage(browser, adminEmail);
      const browserLogs: BrowserLog[] = [];
      page.on("console", (message) => browserLogs.push({ type: message.type(), text: message.text() }));
      page.on("pageerror", (error) => browserLogs.push({ type: "pageerror", text: error.message }));
      try {
        const response = await page.goto("/dashboard/bookings", { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 0).toBeLessThan(400);

        const ktvBHeader = page.getByText(`${marker} KTV B`).first();
        await expect(ktvBHeader).toBeVisible({ timeout: 30_000 });
        const ktvBBox = await ktvBHeader.boundingBox();
        if (!ktvBBox) throw new Error("KTV B timeline header is not measurable");
        await page.mouse.click(ktvBBox.x + ktvBBox.width / 2, ktvBBox.y + ktvBBox.height + 148 + 74);
        const createModalTitle = page.getByText(/Tạo lịch chăm sóc mới/i);
        await expect(createModalTitle).toBeVisible();
        await selectPremiumOption(page, /Chọn hợp đồng/i, new RegExp(escapeRegExp(customerCName)));
        metrics.push(await measureUiSave(page, "create_appointment", async () => {
          await page.getByRole("button", { name: /Xác nhận lịch hẹn/i }).click();
        }, async () => {
          try {
            await expect(createModalTitle).toBeHidden({ timeout: 30_000 });
          } catch (error) {
            const { data: createdSessions, error: sessionLookupError } = await client
              .from("session_logs")
              .select("id, assigned_date, assigned_time, completed_by_ktv_id, booking_resource_id, status")
              .eq("tenant_id", tenant.id)
              .eq("booking_id", bookingC.id);
            throw new Error(
              `Create modal stayed open. session_logs for booking C: ${JSON.stringify({
                error: sessionLookupError?.message,
                rows: createdSessions,
              })}`,
              { cause: error },
            );
          }
        }, async () => {
          await expect(createModalTitle).toBeHidden({ timeout: 30_000 });
        }, browserLogs));

        await expect(page.getByText(customerCName).first()).toBeVisible({ timeout: 30_000 });
        await openSessionDetail(page, customerCName);
        let detailModalTitle = page.getByText(/Chi tiết lịch hẹn/i);
        await page.getByPlaceholder(/Khách hàng hôm nay thế nào/i).fill(`${marker} measured edit`);
        metrics.push(await measureUiSave(page, "edit_appointment_note", async () => {
          await page.getByRole("button", { name: /Lưu thay đổi/i }).click();
        }, async () => {
          await expect(detailModalTitle).toBeHidden({ timeout: 10_000 });
        }, async () => {
          await expect(detailModalTitle).toBeHidden({ timeout: 10_000 });
        }, browserLogs));

        await openSessionDetail(page, customerCName);
        detailModalTitle = page.getByText(/Chi tiết lịch hẹn/i);
        await selectPremiumOption(page, new RegExp(escapeRegExp(`${marker} KTV B`)), new RegExp(escapeRegExp(`${marker} KTV A`)));
        metrics.push(await measureUiSave(page, "assign_ktv", async () => {
          await page.getByRole("button", { name: /Lưu thay đổi/i }).click();
        }, async () => {
          await expect(detailModalTitle).toBeHidden({ timeout: 10_000 });
        }, async () => {
          await expect(detailModalTitle).toBeHidden({ timeout: 10_000 });
        }, browserLogs));

        await openSessionDetail(page, customerCName);
        detailModalTitle = page.getByText(/Chi tiết lịch hẹn/i);
        await page.locator('input[type="date"]').fill(tomorrow);
        metrics.push(await measureUiSave(page, "reschedule_appointment", async () => {
          await page.getByRole("button", { name: /Lưu thay đổi/i }).click();
        }, async () => {
          await expect(detailModalTitle).toBeHidden({ timeout: 10_000 });
        }, async () => {
          await expect(detailModalTitle).toBeHidden({ timeout: 10_000 });
        }, browserLogs));
      } finally {
        await page.context().close();
      }

      console.log(`[appointment-perf-summary] ${JSON.stringify(metrics)}`);
      for (const metric of metrics) {
        expect(metric.interactiveMs, `${metric.flow} interactive latency`).toBeLessThan(2_000);
      }
    } finally {
      if (tenantId) await cleanupTenant(client, tenantId);
    }
  });
});
