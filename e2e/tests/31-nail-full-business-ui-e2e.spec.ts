import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Database } from "../../src/types/database.types";

type E2eClient = ReturnType<typeof e2eAdminClient>;

function loadEnvFile(filePath: string): void {
  const fs = require("node:fs") as typeof import("node:fs");
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const rawValue = match[2].trim();
    const value = (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    )
      ? rawValue.slice(1, -1)
      : rawValue;
    process.env[match[1]] = value;
  }
}

function e2eAdminClient() {
  loadEnvFile(process.env.E2E_ENV_FILE || ".env.e2e");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing E2E Supabase URL or service-role key");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function todayInVietnam(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function currentMonthStartInVietnam(): string {
  return `${todayInVietnam().slice(0, 7)}-01`;
}

function localDateTimeInVietnam(date: string, time: string): string {
  return `${date}T${time}`;
}

async function packageIdByName(client: E2eClient, tenantId: string, packageName: string) {
  const { data, error } = await client
    .from("packages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", packageName)
    .maybeSingle();
  expect(error).toBeNull();
  return data?.id ?? null;
}

async function customerIdByName(client: E2eClient, tenantId: string, customerName: string) {
  const { data, error } = await client
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name_mother", customerName)
    .maybeSingle();
  expect(error).toBeNull();
  return data?.id ?? null;
}

async function bookingByCustomerAndPackage(
  client: E2eClient,
  tenantId: string,
  customerId: string,
  packageId: string,
) {
  const { data, error } = await client
    .from("bookings")
    .select("id, completed_sessions, status, total_sessions, full_price")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("package_id", packageId)
    .maybeSingle();
  expect(error).toBeNull();
  return data ?? null;
}

async function latestSessionForBooking(client: E2eClient, tenantId: string, bookingId: string) {
  const { data, error } = await client
    .from("session_logs")
    .select("id, status, notes, completed_by_ktv_id")
    .eq("tenant_id", tenantId)
    .eq("booking_id", bookingId)
    .order("session_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  expect(error).toBeNull();
  return data ?? null;
}

async function salaryStatusForKtv(client: E2eClient, tenantId: string, ktvId: string) {
  const { data, error } = await client
    .from("salary_records")
    .select("id, status, total_sessions, service_commission, total_salary")
    .eq("tenant_id", tenantId)
    .eq("ktv_id", ktvId)
    .eq("month_year", currentMonthStartInVietnam())
    .maybeSingle();
  expect(error).toBeNull();
  return data ?? null;
}

test.describe("Bella Nail full business UI E2E", () => {
  test("completes Nail service, payment, payroll, and finance through existing operator UI", async ({ page }) => {
    test.setTimeout(240_000);

    const client = e2eAdminClient();
    const marker = `e2e-nail-ui-${Date.now()}`;
    const tenantId = randomUUID();
    const adminId = randomUUID();
    const ktvId = randomUUID();
    const email = `${marker}@bellaspahcm.test`;
    const staffName = `Nail KTV ${marker}`;
    const packageName = `Nail BIAB Journey ${marker}`;
    const customerName = `Nail Guest ${marker}`;
    const paymentNote = `Nail UI payment ${marker}`;
    const today = todayInVietnam();

    try {
      const { error: tenantError } = await client.from("tenants").insert({
        id: tenantId,
        name: `E2E Nail UI Tenant ${marker}`,
        status: "active",
        product_key: "bella_nail",
        enabled_modules: { beauty_spa: true, babycare: false, payroll: true, finance: true },
        brand_theme: { displayName: "Bella Nail" },
        salary_config: {
          bonus_5_star: 50000,
          bonus_4_5_star: 30000,
          bonus_4_star: 10000,
          kpi_target_sessions: 30,
          kpi_bonus_amount: 1000000,
          penalty_late_per_day: 50000,
          penalty_absent_per_day: 200000,
        },
        commission_config: {
          position_multipliers: { junior: 1, senior: 1.2, lead: 1.5 },
          seniority_bonus_rates: {
            "0_to_1_year": 0,
            "1_to_3_years": 0.05,
            "3_to_5_years": 0.1,
            "5_plus_years": 0.15,
          },
        },
      } satisfies Database["public"]["Tables"]["tenants"]["Insert"]);
      expect(tenantError).toBeNull();

      const { error: userError } = await client.from("users").insert([
        {
          id: adminId,
          email,
          full_name: "E2E Nail UI Admin",
          role: "admin",
          status: "active",
          tenant_id: tenantId,
          position_tier: "lead",
        },
        {
          id: ktvId,
          email: `${marker}.ktv@bellaspahcm.test`,
          full_name: staffName,
          role: "ktv",
          status: "active",
          tenant_id: tenantId,
          base_salary: 7000000,
          position_tier: "senior",
          hire_date: currentMonthStartInVietnam(),
        },
      ] satisfies Database["public"]["Tables"]["users"]["Insert"][]);
      expect(userError).toBeNull();

      await page.context().addCookies([
        {
          name: "mock_user_email",
          value: email,
          url: "http://localhost:3000",
          sameSite: "Lax",
        },
      ]);

      await page.goto("/dashboard/services", { waitUntil: "domcontentloaded" });
      await page.getByTestId("services-add-button").click();
      await expect(page.getByTestId("service-modal")).toBeVisible();
      await page.getByTestId("service-name-input").fill(packageName);
      await page.getByTestId("service-price-input").fill("680000");
      await page.getByTestId("service-duration-input").fill("90");
      await page.getByTestId("service-sessions-input").fill("2");
      await page.getByTestId("service-commission-input").fill("80000");
      await page.getByTestId("service-category-input").fill("nail");
      await page.getByTestId("service-submit-button").click();

      await expect.poll(() => packageIdByName(client, tenantId, packageName), {
        timeout: 30_000,
      }).not.toBeNull();
      const packageId = await packageIdByName(client, tenantId, packageName);
      expect(packageId).toBeTruthy();
      if (!packageId) throw new Error("Package was not created through Services UI");

      await page.goto("/dashboard/customers", { waitUntil: "domcontentloaded" });
      await page.getByTestId("customer-add-button").click();
      await page.getByTestId("customer-name-input").fill(customerName);
      await page.getByTestId("customer-phone-input").fill(`090${Date.now().toString().slice(-7)}`);
      await page.getByTestId("customer-secondary-name-input").fill("Nail care profile");
      await page.getByTestId("customer-address-input").fill("123 Nail Street, HCMC");
      await page.getByTestId("customer-submit-button").click();

      await expect.poll(() => customerIdByName(client, tenantId, customerName), {
        timeout: 30_000,
      }).not.toBeNull();
      const customerId = await customerIdByName(client, tenantId, customerName);
      expect(customerId).toBeTruthy();
      if (!customerId) throw new Error("Customer was not created through Customers UI");

      const customerRow = page.getByTestId("customer-row").filter({ hasText: customerName }).first();
      await expect(customerRow).toBeVisible({ timeout: 30_000 });
      await customerRow.getByTestId("customer-detail-button").click();
      await page.getByTestId("customer-open-booking-button").click();

      const bookingModal = page.getByTestId("booking-modal");
      await expect(bookingModal).toBeVisible({ timeout: 30_000 });
      await bookingModal.getByTestId("booking-package-option").filter({ hasText: packageName }).click();
      await bookingModal.getByRole("button", { name: /Chưa phân công/ }).click();
      await page.getByRole("button", { name: staffName }).click();
      await bookingModal.getByTestId("booking-start-date-input").fill(today);
      await bookingModal.getByTestId("booking-time-input").fill("09:00");
      await bookingModal.getByTestId("booking-total-sessions-input").fill("2");
      await bookingModal.getByTestId("booking-deposit-input").fill("0");
      await bookingModal.getByTestId("booking-submit-button").click();

      await expect.poll(async () => {
        if (!customerId || !packageId) return null;
        return bookingByCustomerAndPackage(client, tenantId, customerId, packageId);
      }, { timeout: 45_000 }).not.toBeNull();
      const booking = await bookingByCustomerAndPackage(client, tenantId, customerId, packageId);
      expect(booking?.id).toBeTruthy();
      if (!booking?.id) throw new Error("Booking was not created through Booking UI");

      await page.goto("/dashboard/salary", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Chấm Công Thực Tế/ }).click();
      const attendanceRow = page.getByTestId("attendance-summary-row").filter({ hasText: staffName }).first();
      await expect(attendanceRow).toBeVisible({ timeout: 30_000 });
      await attendanceRow.getByTestId("attendance-open-calendar-button").click();
      await page.locator(`[data-testid="attendance-day-button"][data-date="${today}"]`).click();
      await page.getByTestId("attendance-checkin-input").fill(localDateTimeInVietnam(today, "08:45"));
      await page.getByTestId("attendance-checkout-input").fill(localDateTimeInVietnam(today, "18:00"));
      await page.getByTestId("attendance-save-button").click();

      await expect.poll(async () => {
        const { data, error } = await client
          .from("attendance")
          .select("id, status")
          .eq("tenant_id", tenantId)
          .eq("ktv_id", ktvId)
          .eq("date", today)
          .maybeSingle();
        expect(error).toBeNull();
        return data?.status ?? null;
      }, { timeout: 30_000 }).toBe("present");

      await page.goto("/dashboard/sessions", { waitUntil: "domcontentloaded" });
      const sessionCard = page.getByTestId("session-card").filter({ hasText: customerName }).first();
      await expect(sessionCard).toBeVisible({ timeout: 30_000 });
      await sessionCard.getByTestId("session-quick-note-input").fill(`Completed by UI ${marker}`);
      await sessionCard.getByTestId("session-complete-button").click();

      await expect.poll(async () => {
        if (!booking?.id) return null;
        const session = await latestSessionForBooking(client, tenantId, booking.id);
        return session?.status ?? null;
      }, { timeout: 45_000 }).toBe("completed");

      await expect.poll(async () => {
        const refreshed = await bookingByCustomerAndPackage(client, tenantId, customerId, packageId);
        return refreshed?.completed_sessions ?? null;
      }, { timeout: 30_000 }).toBe(1);

      await page.goto(`/dashboard/customers/${customerId}`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("booking-pay-remaining-button").click();
      await page.getByTestId("payment-method-cash").click();
      await page.getByTestId("payment-receipt-url-input").fill(`https://example.test/${marker}.jpg`);
      await page.getByTestId("payment-notes-input").fill(paymentNote);
      await page.getByTestId("payment-submit-button").click();

      await expect.poll(async () => {
        const { data, error } = await client
          .from("revenue")
          .select("id, amount, status, notes")
          .eq("tenant_id", tenantId)
          .eq("booking_id", booking.id)
          .ilike("notes", `%${paymentNote}%`)
          .maybeSingle();
        expect(error).toBeNull();
        return data?.status ?? null;
      }, { timeout: 45_000 }).toBe("confirmed");

      await page.goto("/dashboard/salary", { waitUntil: "domcontentloaded" });
      const matrixRow = page.getByTestId("salary-matrix-row").filter({ hasText: staffName }).first();
      await expect(matrixRow).toBeVisible({ timeout: 45_000 });
      await matrixRow.getByTestId("salary-publish-one-button").click();
      await expect.poll(async () => (await salaryStatusForKtv(client, tenantId, ktvId))?.status ?? null, {
        timeout: 45_000,
      }).toMatch(/published|pending_approval/);

      await page.getByTestId("salary-matrix-row").filter({ hasText: staffName }).first().getByTestId("salary-confirm-one-button").click();
      await page.getByTestId("salary-confirm-modal-submit").click();
      await expect.poll(async () => (await salaryStatusForKtv(client, tenantId, ktvId))?.status ?? null, {
        timeout: 45_000,
      }).toBe("confirmed");

      await page.getByTestId("salary-matrix-row").filter({ hasText: staffName }).first().getByTestId("salary-finalize-one-button").click();
      await page.getByTestId("salary-confirm-modal-submit").click();
      await expect.poll(async () => (await salaryStatusForKtv(client, tenantId, ktvId))?.status ?? null, {
        timeout: 45_000,
      }).toBe("finalized");

      await expect.poll(async () => {
        const { data, error } = await client
          .from("expenses")
          .select("id, description")
          .eq("tenant_id", tenantId)
          .eq("category", "salary")
          .ilike("description", `%${staffName}%`)
          .maybeSingle();
        expect(error).toBeNull();
        return data?.description ?? null;
      }, { timeout: 45_000 }).toContain(staffName);

      await page.goto("/dashboard/finance", { waitUntil: "domcontentloaded" });
      const revenueRow = page.getByTestId("finance-transaction-row").filter({ hasText: paymentNote }).first();
      await expect(revenueRow).toBeVisible({ timeout: 45_000 });
      await expect(revenueRow.getByTestId("finance-transaction-amount")).toContainText(/\+680[,.]000/);
      await expect(revenueRow.getByTestId("finance-transaction-status")).toContainText("Đã xác nhận");

      const payrollExpenseRow = page.getByTestId("finance-transaction-row").filter({ hasText: staffName }).first();
      await expect(payrollExpenseRow).toBeVisible({ timeout: 45_000 });
      page.once("dialog", (dialog) => void dialog.accept());
      await payrollExpenseRow.getByRole("button", { name: /Duyệt thu chi/ }).click();
      await expect.poll(async () => {
        const { data, error } = await client
          .from("expenses")
          .select("status")
          .eq("tenant_id", tenantId)
          .eq("category", "salary")
          .ilike("description", `%${staffName}%`)
          .maybeSingle();
        expect(error).toBeNull();
        return data?.status ?? null;
      }, { timeout: 45_000 }).toMatch(/approved|paid/);
      await expect(payrollExpenseRow.getByTestId("finance-transaction-status")).toContainText("Đã xác nhận");
    } finally {
      await client.from("expenses").delete().eq("tenant_id", tenantId);
      await client.from("salary_records").delete().eq("tenant_id", tenantId);
      await client.from("attendance").delete().eq("tenant_id", tenantId);
      await client.from("revenue").delete().eq("tenant_id", tenantId);
      await client.from("session_logs").delete().eq("tenant_id", tenantId);
      await client.from("bookings").delete().eq("tenant_id", tenantId);
      await client.from("customers").delete().eq("tenant_id", tenantId);
      await client.from("packages").delete().eq("tenant_id", tenantId);
      await client.from("users").delete().eq("tenant_id", tenantId);
      await client.from("tenants").delete().eq("id", tenantId);
    }
  });
});
