/**
 * Tenant isolation smoke for Bella HQ dashboard.
 *
 * Seeds a temporary non-HQ Beauty tenant with unique marker data, then verifies
 * the Bella HQ admin dashboard does not render that marker on high-risk pages.
 */

import type { Browser, Page, ViewportSize } from "@playwright/test";
import { canAuthenticateAdminPage, expect, getE2eBaseUrl, isLocalE2eBaseUrl, test } from "../fixtures/auth";
import { admin, hasSupabaseAdminEnv } from "../helpers/supabase-admin";
import type { Database } from "../../src/types/database.types";

type InsertedId = { id: string };
type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

const routes = [
  { name: "customers", path: "/dashboard/customers", content: /khach hang|customer/i },
  { name: "bookings", path: "/dashboard/bookings", content: /lich hen|booking/i },
  { name: "sessions", path: "/dashboard/sessions", content: /the lieu trinh|lieu trinh|lo trinh|sessions/i },
  { name: "finance", path: "/dashboard/finance", content: /tai chinh|finance/i },
  { name: "inventory", path: "/dashboard/inventory", content: /kho|inventory/i },
];

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function routeRegex(path: string) {
  return new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function isModuleEnabled(source: unknown, moduleKey: "babycare" | "beauty_spa") {
  if (Array.isArray(source)) return source.includes(moduleKey);
  if (source && typeof source === "object") {
    return (source as Record<string, unknown>)[moduleKey] === true;
  }
  return false;
}

async function requireRow<T>(label: string, query: QueryResult<T>): Promise<T> {
  const { data, error } = await query;
  if (error || !data) {
    throw new Error(`${label} failed: ${error?.message ?? "no row returned"}`);
  }
  return data;
}

async function openMockUserPage(
  browser: Browser,
  email: string,
  viewport: ViewportSize = { width: 1440, height: 900 },
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: getE2eBaseUrl(),
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport,
  });
  await context.addCookies([
    {
      name: "mock_user_email",
      value: email,
      url: getE2eBaseUrl(),
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(45_000);
  return page;
}

async function assertRouteDoesNotLeak(
  page: Page,
  path: string,
  expectedContent: RegExp,
  forbiddenMarkers: string[],
) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} must not return HTTP errors`).toBeLessThan(400);
  await expect(page, `${path} should stay on route`).toHaveURL(routeRegex(path));

  const body = page.locator("body");
  await expect
    .poll(
      async () => normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => "")),
      { message: `${path} should render expected content`, timeout: 25_000 },
    )
    .toMatch(expectedContent);
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

  const bodyText = normalizeVietnamese(await body.innerText({ timeout: 10_000 }));
  for (const marker of forbiddenMarkers) {
    expect(bodyText, `${path} must not show "${marker}"`).not.toContain(normalizeVietnamese(marker));
  }
}

async function sampleVisibleTextDuring(page: Page, action: () => Promise<void>): Promise<string> {
  const samples: string[] = [];
  let stopped = false;
  const sampler = (async () => {
    while (!stopped) {
      samples.push(await page.locator("body").innerText({ timeout: 500 }).catch(() => ""));
      await page.waitForTimeout(100).catch(() => {});
    }
  })();

  try {
    await action();
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(500);
  } finally {
    stopped = true;
    await sampler.catch(() => {});
  }

  return normalizeVietnamese(samples.join("\n"));
}

async function assertHardRefreshDoesNotFlashForbidden(
  page: Page,
  path: string,
  expectedContent: RegExp,
  forbiddenMarkers: string[],
) {
  await assertRouteDoesNotLeak(page, path, expectedContent, forbiddenMarkers);

  const sampledText = await sampleVisibleTextDuring(page, async () => {
    const response = await page.reload({ waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0, `${path} reload must not return HTTP errors`).toBeLessThan(400);
  });

  await expect
    .poll(
      async () => normalizeVietnamese(await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")),
      { message: `${path} should render expected content after hard refresh`, timeout: 25_000 },
    )
    .toMatch(expectedContent);

  for (const marker of forbiddenMarkers) {
    expect(sampledText, `${path} hard refresh must not flash "${marker}"`).not.toContain(normalizeVietnamese(marker));
  }
}

async function cleanupTenantData(tenantId: string | null, ids: {
  customerId?: string;
  bookingId?: string;
  sessionLogId?: string;
  revenueId?: string;
  inventoryItemId?: string;
  inventoryLogId?: string;
}) {
  if (!tenantId) return;
  const client = admin();
  const errors: string[] = [];

  const cleanupSteps: Array<[string, QueryResult<unknown>]> = [
    ids.inventoryLogId
      ? ["inventory log", client.from("inventory_logs").delete().eq("id", ids.inventoryLogId)]
      : ["inventory log", Promise.resolve({ data: null, error: null })],
    ids.inventoryItemId
      ? ["inventory item", client.from("inventory_items").delete().eq("id", ids.inventoryItemId)]
      : ["inventory item", Promise.resolve({ data: null, error: null })],
    ids.revenueId
      ? ["revenue", client.from("revenue").delete().eq("id", ids.revenueId)]
      : ["revenue", Promise.resolve({ data: null, error: null })],
    ids.sessionLogId
      ? ["session log", client.from("session_logs").delete().eq("id", ids.sessionLogId)]
      : ["session log", Promise.resolve({ data: null, error: null })],
    ids.bookingId
      ? ["booking", client.from("bookings").delete().eq("id", ids.bookingId)]
      : ["booking", Promise.resolve({ data: null, error: null })],
    ids.customerId
      ? ["customer", client.from("customers").delete().eq("id", ids.customerId)]
      : ["customer", Promise.resolve({ data: null, error: null })],
    ["tenant", client.from("tenants").delete().eq("id", tenantId)],
  ];

  for (const [label, query] of cleanupSteps) {
    const { error } = await query;
    if (error) errors.push(`${label}: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(`Tenant isolation smoke cleanup failed: ${errors.join("; ")}`);
  }
}

test.describe("Bella HQ tenant isolation smoke", () => {
  test.setTimeout(120_000);

  test.skip(
    !canAuthenticateAdminPage() || !hasSupabaseAdminEnv(),
    "Requires E2E admin auth plus Supabase service-role env for seed/cleanup.",
  );

  test("Bella admin dashboard does not render records from a Beauty tenant", async ({ adminPage }) => {
    const client = admin();
    const marker = `E2E-BEAUTY-ISOLATION-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    let tenantId: string | null = null;
    const ids: Parameters<typeof cleanupTenantData>[1] = {};
    let testError: unknown = null;

    try {
      const tenantPayload = {
        name: `${marker} Tenant`,
        status: "active",
        royalty_type: "percentage",
        royalty_rate: 0,
        enabled_modules: { babycare: false, beauty_spa: true },
      } satisfies Database["public"]["Tables"]["tenants"]["Insert"];
      const tenant = await requireRow<InsertedId>(
        "insert tenant",
        client.from("tenants").insert(tenantPayload).select("id").single(),
      );
      tenantId = tenant.id;

      const customerPayload = {
        tenant_id: tenantId,
        name_mother: `${marker} Customer`,
        name_baby: `${marker} Profile`,
        phone: `09${String(Date.now()).slice(-8)}`,
        status: "active",
        gender_baby: "female",
      } satisfies Database["public"]["Tables"]["customers"]["Insert"];
      const customer = await requireRow<InsertedId>(
        "insert customer",
        client.from("customers").insert(customerPayload).select("id").single(),
      );
      ids.customerId = customer.id;

      const bookingPayload = {
        tenant_id: tenantId,
        customer_id: customer.id,
        booking_number: `${marker}-BOOKING`,
        package_name: `${marker} Facial Package`,
        full_price: 1200000,
        deposit_amount: 200000,
        total_sessions: 3,
        completed_sessions: 0,
        start_date: today,
        preferred_time: "09:00",
        status: "in_progress",
      } satisfies Database["public"]["Tables"]["bookings"]["Insert"];
      const booking = await requireRow<InsertedId>(
        "insert booking",
        client.from("bookings").insert(bookingPayload).select("id").single(),
      );
      ids.bookingId = booking.id;

      const sessionPayload = {
        tenant_id: tenantId,
        booking_id: booking.id,
        session_number: 1,
        assigned_date: today,
        assigned_time: "09:00",
        status: "scheduled",
        notes: `${marker} Session Note`,
      } satisfies Database["public"]["Tables"]["session_logs"]["Insert"];
      const sessionLog = await requireRow<InsertedId>(
        "insert session log",
        client.from("session_logs").insert(sessionPayload).select("id").single(),
      );
      ids.sessionLogId = sessionLog.id;

      const revenuePayload = {
        tenant_id: tenantId,
        booking_id: booking.id,
        amount: 200000,
        revenue_type: "deposit",
        payment_method: "bank_transfer",
        received_date: today,
        status: "confirmed",
        notes: `${marker} Revenue`,
      } satisfies Database["public"]["Tables"]["revenue"]["Insert"];
      const revenue = await requireRow<InsertedId>(
        "insert revenue",
        client.from("revenue").insert(revenuePayload).select("id").single(),
      );
      ids.revenueId = revenue.id;

      const inventoryItemPayload = {
        tenant_id: tenantId,
        name: `${marker} Serum`,
        sku: `${marker}-SKU`,
        unit: "chai",
        stock_level: 8,
        min_stock_level: 1,
        price_per_unit: 100000,
        category: "Beauty",
      } satisfies Database["public"]["Tables"]["inventory_items"]["Insert"];
      const inventoryItem = await requireRow<InsertedId>(
        "insert inventory item",
        client.from("inventory_items").insert(inventoryItemPayload).select("id").single(),
      );
      ids.inventoryItemId = inventoryItem.id;

      const inventoryLogPayload = {
        tenant_id: tenantId,
        item_id: inventoryItem.id,
        change_amount: 8,
        reason: "restock",
        notes: `${marker} Inventory Log`,
      } satisfies Database["public"]["Tables"]["inventory_logs"]["Insert"];
      const inventoryLog = await requireRow<InsertedId>(
        "insert inventory log",
        client.from("inventory_logs").insert(inventoryLogPayload).select("id").single(),
      );
      ids.inventoryLogId = inventoryLog.id;

      for (const route of routes) {
        const response = await adminPage.goto(route.path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 0, `${route.name} must not return HTTP errors`).toBeLessThan(400);
        await expect(adminPage, `${route.name} should stay on route`).toHaveURL(routeRegex(route.path));

        const body = adminPage.locator("body");
        await expect
          .poll(
            async () => normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => "")),
            { message: `${route.name} should render expected content`, timeout: 20_000 },
          )
          .toMatch(route.content);
        await adminPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

        const bodyText = await body.innerText({ timeout: 8_000 });
        expect(bodyText, `${route.name} must not show external Beauty tenant marker`).not.toContain(marker);
      }
    } catch (error) {
      testError = error;
    }

    try {
      await cleanupTenantData(tenantId, ids);
    } catch (cleanupError) {
      if (testError) {
        throw new Error(`${String(testError)}; cleanup also failed: ${String(cleanupError)}`);
      }
      throw cleanupError;
    }

    if (testError) throw testError;
  });

  test("Bella and Beauty branch admins only render their own tenant records", async ({ browser }) => {
    test.skip(
      !isLocalE2eBaseUrl() || !hasSupabaseAdminEnv(),
      "Dual-tenant UI smoke uses localhost-only mock_user_email auth plus Supabase service-role env.",
    );

    const bellaAdminEmail = "admin@bellaspa.vn";
    const beautyAdminEmail = "admin.beauty.demo@bellaspa.test";
    const bellaForbidden = [
      "Khách Beauty Demo",
      "Beauty Demo",
      "Facial Cấp Ẩm Chuyên Sâu Demo",
      "Triệt Lông Diode Demo",
      "Gói Đầu Dưỡng Sinh Demo",
      "BEAUTY_DEMO_FRANCHISE_TEST",
    ];
    const beautyForbidden = [
      "Bella Spa",
      "Quản lý hồ sơ mẹ và bé",
      "Mẹ Leo",
      "Mẹ Tiên",
      "Bé Lu",
      "Tắm Bé Chuẩn Y Khoa Tại Nhà",
      "Gói Thông Tắc Tia Sữa",
    ];
    const branchRoutes = [
      { path: "/dashboard", content: /dashboard|sap toi|tong quan/i },
      { path: "/dashboard/customers", content: /khach hang/i },
      { path: "/dashboard/sessions", content: /the lieu trinh|lieu trinh|sessions/i },
      { path: "/dashboard/finance", content: /tai chinh|giao dich/i },
    ];

    const client = admin();
    const { data: bellaUser, error: bellaUserError } = await client
      .from("users")
      .select("id, tenant_id")
      .eq("email", bellaAdminEmail)
      .single();
    if (bellaUserError || !bellaUser) {
      throw new Error(`Missing Bella admin smoke user: ${bellaUserError?.message ?? "no row"}`);
    }

    const { data: beautyUser, error: beautyUserError } = await client
      .from("users")
      .select("id, tenant_id")
      .eq("email", beautyAdminEmail)
      .single();
    if (beautyUserError || !beautyUser) {
      throw new Error(`Missing Beauty admin smoke user: ${beautyUserError?.message ?? "no row"}`);
    }

    expect(bellaUser.tenant_id, "Bella and Beauty admins must belong to different tenants").not.toBe(beautyUser.tenant_id);

    const bellaPage = await openMockUserPage(browser, bellaAdminEmail);
    try {
      for (const route of branchRoutes) {
        await assertRouteDoesNotLeak(bellaPage, route.path, route.content, bellaForbidden);
      }
      await assertHardRefreshDoesNotFlashForbidden(
        bellaPage,
        "/dashboard/customers",
        /khach hang/i,
        bellaForbidden,
      );
    } finally {
      await bellaPage.context().close();
    }

    const beautyPage = await openMockUserPage(browser, beautyAdminEmail);
    try {
      for (const route of branchRoutes) {
        await assertRouteDoesNotLeak(beautyPage, route.path, route.content, beautyForbidden);
      }
      await assertHardRefreshDoesNotFlashForbidden(
        beautyPage,
        "/dashboard/customers",
        /khach hang/i,
        beautyForbidden,
      );
    } finally {
      await beautyPage.context().close();
    }
  });

  test("Beauty demo checkout smoke keeps Bella tenant isolated", async ({ browser }) => {
    test.skip(
      !isLocalE2eBaseUrl() || !hasSupabaseAdminEnv(),
      "Beauty operational smoke uses localhost-only mock_user_email auth plus Supabase service-role env.",
    );

    const client = admin();
    const marker = `E2E-BEAUTY-OP-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const bellaAdminEmail = "admin@bellaspa.vn";
    const beautyAdminEmail = "admin.beauty.demo@bellaspa.test";
    const ids = {
      packageIds: [] as string[],
      customerIds: [] as string[],
      bookingIds: [] as string[],
      sessionLogIds: [] as string[],
      revenueIds: [] as string[],
    };
    let beautyTenantId: string | null = null;
    let testError: unknown = null;

    async function cleanupCreatedRows() {
      const cleanupSteps: Array<[string, QueryResult<unknown>]> = [
        ids.revenueIds.length
          ? ["revenue", client.from("revenue").delete().in("id", ids.revenueIds)]
          : ["revenue", Promise.resolve({ data: null, error: null })],
        ids.sessionLogIds.length
          ? ["session logs", client.from("session_logs").delete().in("id", ids.sessionLogIds)]
          : ["session logs", Promise.resolve({ data: null, error: null })],
        ids.bookingIds.length
          ? ["bookings", client.from("bookings").delete().in("id", ids.bookingIds)]
          : ["bookings", Promise.resolve({ data: null, error: null })],
        ids.customerIds.length
          ? ["customers", client.from("customers").delete().in("id", ids.customerIds)]
          : ["customers", Promise.resolve({ data: null, error: null })],
        ids.packageIds.length
          ? ["packages", client.from("packages").delete().in("id", ids.packageIds)]
          : ["packages", Promise.resolve({ data: null, error: null })],
      ];

      const errors: string[] = [];
      for (const [label, query] of cleanupSteps) {
        const { error } = await query;
        if (error) errors.push(`${label}: ${error.message}`);
      }
      if (errors.length > 0) {
        throw new Error(`Beauty operational smoke cleanup failed: ${errors.join("; ")}`);
      }
    }

    async function countMarkedRows(table: "packages" | "customers" | "bookings" | "session_logs" | "revenue", column: string) {
      if (!beautyTenantId) return 0;
      const { count, error } = await client
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", beautyTenantId)
        .ilike(column, `%${marker}%`);
      if (error) throw new Error(`count ${table} failed: ${error.message}`);
      return count ?? 0;
    }

    try {
      const beautyTenant = await requireRow<Pick<
        Database["public"]["Tables"]["tenants"]["Row"],
        "id" | "name" | "enabled_modules"
      >>(
        "select Beauty demo tenant",
        client
          .from("tenants")
          .select("id, name, enabled_modules")
          .eq("email", "beauty-demo-branch@bellaspa.test")
          .single(),
      );
      beautyTenantId = beautyTenant.id;
      expect(isModuleEnabled(beautyTenant.enabled_modules, "beauty_spa")).toBe(true);
      expect(isModuleEnabled(beautyTenant.enabled_modules, "babycare")).toBe(false);

      const beautyAdmin = await requireRow<Pick<Database["public"]["Tables"]["users"]["Row"], "id" | "tenant_id">>(
        "select Beauty demo admin",
        client
          .from("users")
          .select("id, tenant_id")
          .eq("tenant_id", beautyTenant.id)
          .eq("email", beautyAdminEmail)
          .single(),
      );
      const bellaAdmin = await requireRow<Pick<Database["public"]["Tables"]["users"]["Row"], "id" | "tenant_id">>(
        "select Bella admin",
        client
          .from("users")
          .select("id, tenant_id")
          .eq("email", bellaAdminEmail)
          .single(),
      );
      expect(bellaAdmin.tenant_id).not.toBe(beautyAdmin.tenant_id);

      const beautyKtv = await requireRow<Pick<Database["public"]["Tables"]["users"]["Row"], "id">>(
        "select Beauty demo KTV",
        client
          .from("users")
          .select("id")
          .eq("tenant_id", beautyTenant.id)
          .ilike("full_name", "%KTV Demo%")
          .limit(1)
          .single(),
      );

      const packageName = `Facial Smoke ${marker}`;
      const customerName = `Khach Smoke ${marker}`;

      const packagePayload = {
        tenant_id: beautyTenant.id,
        name: packageName,
        description: `${marker}: temporary Beauty Spa smoke package`,
        details: ["Smoke facial session"],
        full_price: 1500000,
        price: 1200000,
        duration: "75 minutes/session",
        total_sessions: 3,
        ktv_commission: 120000,
        status: "active",
        module_key: "beauty_spa",
        service_kind: "treatment_package",
        service_category: "facial",
        default_duration_minutes: 75,
        requires_resource: true,
        default_resource_type: "bed",
        before_after_required: true,
        session_multiplier: 1,
        allowed_franchise_override: true,
      } satisfies Database["public"]["Tables"]["packages"]["Insert"];
      const insertedPackage = await requireRow<InsertedId>(
        "insert Beauty package",
        client.from("packages").insert(packagePayload).select("id").single(),
      );
      ids.packageIds.push(insertedPackage.id);

      const customerPayload = {
        tenant_id: beautyTenant.id,
        name_mother: customerName,
        name_baby: "Beauty Profile Smoke",
        gender_baby: "female",
        phone: `09${String(Date.now()).slice(-8)}`,
        address: "Quan 1, TP HCM",
        status: "active",
        notes: `${marker}: temporary Beauty smoke customer`,
      } satisfies Database["public"]["Tables"]["customers"]["Insert"];
      const insertedCustomer = await requireRow<InsertedId>(
        "insert Beauty customer",
        client.from("customers").insert(customerPayload).select("id").single(),
      );
      ids.customerIds.push(insertedCustomer.id);

      const bookingPayload = {
        tenant_id: beautyTenant.id,
        customer_id: insertedCustomer.id,
        package_id: insertedPackage.id,
        package_name: packageName,
        booking_number: `${marker}-001`,
        status: "in_progress",
        deposit_amount: 300000,
        full_price: 1500000,
        discount_percent: 20,
        start_date: today,
        end_date: today,
        total_sessions: 3,
        completed_sessions: 0,
        contract_signed: true,
        preferred_time: "10:00",
        assigned_ktv_id: beautyKtv.id,
      } satisfies Database["public"]["Tables"]["bookings"]["Insert"];
      const insertedBooking = await requireRow<InsertedId>(
        "insert Beauty booking",
        client.from("bookings").insert(bookingPayload).select("id").single(),
      );
      ids.bookingIds.push(insertedBooking.id);

      const sessionPayload = {
        tenant_id: beautyTenant.id,
        booking_id: insertedBooking.id,
        session_number: 1,
        assigned_date: today,
        assigned_time: "10:00",
        completed_by_ktv_id: beautyKtv.id,
        status: "scheduled",
        notes: marker,
        standard_duration: 75,
      } satisfies Database["public"]["Tables"]["session_logs"]["Insert"];
      const insertedSession = await requireRow<InsertedId>(
        "insert Beauty session log",
        client.from("session_logs").insert(sessionPayload).select("id").single(),
      );
      ids.sessionLogIds.push(insertedSession.id);

      const depositPayload = {
        tenant_id: beautyTenant.id,
        booking_id: insertedBooking.id,
        amount: 300000,
        revenue_type: "deposit",
        payment_method: "bank_transfer",
        received_date: today,
        recorded_by_id: beautyAdmin.id,
        status: "confirmed",
        business_event_type: "CUSTOMER_DEPOSIT",
        accounting_review_status: "AUTO_POSTED",
        notes: marker,
      } satisfies Database["public"]["Tables"]["revenue"]["Insert"];
      const insertedDeposit = await requireRow<InsertedId>(
        "insert Beauty deposit",
        client.from("revenue").insert(depositPayload).select("id").single(),
      );
      ids.revenueIds.push(insertedDeposit.id);

      const beautyPage = await openMockUserPage(browser, beautyAdminEmail, { width: 390, height: 844 });
      try {
        await beautyPage.goto("/dashboard/customers", { waitUntil: "domcontentloaded" });
        await beautyPage.locator("input").first().fill(marker);
        await expect
          .poll(
            async () => normalizeVietnamese(await beautyPage.locator("body").innerText({ timeout: 5_000 }).catch(() => "")),
            { message: "Beauty customer UI should render the temporary customer", timeout: 25_000 },
          )
          .toContain(normalizeVietnamese(marker));
        const beautyCustomerText = normalizeVietnamese(await beautyPage.locator("body").innerText());
        expect(beautyCustomerText).not.toContain(normalizeVietnamese("Quản lý hồ sơ mẹ và bé"));
        expect(beautyCustomerText).not.toContain(normalizeVietnamese("Bella Spa KTV"));

        const sessionUpdate = {
          status: "completed",
          completed_date: today,
          actual_duration: 75,
          rating: 5,
          rating_comment: `${marker}: smoke checkout ok`,
          business_event_type: "SESSION_COMPLETED",
          accounting_review_status: "AUTO_POSTED",
        } satisfies Database["public"]["Tables"]["session_logs"]["Update"];
        await requireRow<InsertedId>(
          "complete Beauty session",
          client.from("session_logs").update(sessionUpdate).eq("id", insertedSession.id).select("id").single(),
        );

        const bookingUpdate = {
          completed_sessions: 1,
          status: "in_progress",
        } satisfies Database["public"]["Tables"]["bookings"]["Update"];
        const progressedBooking = await requireRow<Pick<
          Database["public"]["Tables"]["bookings"]["Row"],
          "tenant_id" | "completed_sessions" | "total_sessions"
        >>(
          "update Beauty booking progress",
          client
            .from("bookings")
            .update(bookingUpdate)
            .eq("id", insertedBooking.id)
            .select("tenant_id, completed_sessions, total_sessions")
            .single(),
        );
        expect(progressedBooking.tenant_id).toBe(beautyTenant.id);
        expect(Number(progressedBooking.completed_sessions)).toBe(1);
        expect(Number(progressedBooking.total_sessions)).toBe(3);

        const finalPaymentPayload = {
          tenant_id: beautyTenant.id,
          booking_id: insertedBooking.id,
          amount: 400000,
          revenue_type: "session_completed",
          payment_method: "cash",
          received_date: today,
          recorded_by_id: beautyAdmin.id,
          status: "confirmed",
          business_event_type: "SESSION_COMPLETED_PAYMENT",
          accounting_review_status: "AUTO_POSTED",
          notes: marker,
        } satisfies Database["public"]["Tables"]["revenue"]["Insert"];
        const insertedFinalPayment = await requireRow<InsertedId>(
          "insert Beauty final payment",
          client.from("revenue").insert(finalPaymentPayload).select("id").single(),
        );
        ids.revenueIds.push(insertedFinalPayment.id);

        const { data: revenueRows, error: revenueSumError } = await client
          .from("revenue")
          .select("amount")
          .eq("tenant_id", beautyTenant.id)
          .eq("booking_id", insertedBooking.id)
          .eq("status", "confirmed");
        if (revenueSumError) throw new Error(`sum Beauty revenue failed: ${revenueSumError.message}`);
        const totalPaid = (revenueRows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
        expect(totalPaid).toBe(700000);

        await beautyPage.goto(`/dashboard/sessions?search=${encodeURIComponent(customerName)}`, { waitUntil: "domcontentloaded" });
        await expect
          .poll(
            async () => normalizeVietnamese(await beautyPage.locator("body").innerText({ timeout: 5_000 }).catch(() => "")),
            { message: "Beauty sessions page should load without tenant errors", timeout: 25_000 },
          )
          .toMatch(/lieu trinh|sessions|dich vu/i);
        const beautySessionsText = normalizeVietnamese(await beautyPage.locator("body").innerText());
        expect(beautySessionsText).not.toMatch(/permission denied|missing tenant scope|khong the tai|failed to load/i);
      } finally {
        await beautyPage.context().close();
      }

      const bellaPage = await openMockUserPage(browser, bellaAdminEmail);
      try {
        for (const path of ["/dashboard/customers", "/dashboard/sessions", "/dashboard/finance"]) {
          await bellaPage.goto(path, { waitUntil: "domcontentloaded" });
          await bellaPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
          const bodyText = normalizeVietnamese(await bellaPage.locator("body").innerText({ timeout: 10_000 }));
          for (const forbidden of [marker, customerName, packageName]) {
            expect(bodyText, `${path} must not show Beauty smoke data`).not.toContain(normalizeVietnamese(forbidden));
          }
        }
      } finally {
        await bellaPage.context().close();
      }
    } catch (error) {
      testError = error;
    }

    try {
      await cleanupCreatedRows();
      const postCleanup = {
        revenue: await countMarkedRows("revenue", "notes"),
        sessionLogs: await countMarkedRows("session_logs", "notes"),
        bookings: await countMarkedRows("bookings", "booking_number"),
        customers: await countMarkedRows("customers", "notes"),
        packages: await countMarkedRows("packages", "name"),
      };
      expect(postCleanup).toEqual({
        revenue: 0,
        sessionLogs: 0,
        bookings: 0,
        customers: 0,
        packages: 0,
      });
    } catch (cleanupError) {
      if (testError) {
        throw new Error(`${String(testError)}; cleanup also failed: ${String(cleanupError)}`);
      }
      throw cleanupError;
    }

    if (testError) throw testError;
  });
});
