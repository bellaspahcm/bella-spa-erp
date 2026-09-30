import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Database } from "../../src/types/database.types";

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

test.describe("Bella Nail operational UI read-back", () => {
  test("shows Nail booking, revenue, payroll, attendance, and finance state in existing operator UI", async ({ page }) => {
    test.setTimeout(120_000);

    const client = e2eAdminClient();
    const marker = `e2e-nail-full-ui-${Date.now()}`;
    const tenantId = randomUUID();
    const adminId = randomUUID();
    const ktvId = randomUUID();
    const customerId = randomUUID();
    const packageId = randomUUID();
    const bookingId = randomUUID();
    const sessionId = randomUUID();
    const revenueId = randomUUID();
    const salaryId = randomUUID();
    const attendanceId = randomUUID();
    const expenseId = randomUUID();
    const email = `${marker}@bellaspahcm.test`;
    const today = todayInVietnam();
    const nowIso = new Date().toISOString();

    const customerName = `Nail Customer ${marker}`;
    const staffName = `Nail KTV ${marker}`;
    const packageName = `Gel Builder Package ${marker}`;
    const revenueNote = `Nail Revenue ${marker}`;
    const salaryExpenseNote = `Nail payroll payout ${marker}`;

    try {
      const { error: tenantError } = await client.from("tenants").insert({
        id: tenantId,
        name: `E2E Nail Full UI Tenant ${marker}`,
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

      const { error: usersError } = await client.from("users").insert([
        {
          id: adminId,
          email,
          full_name: "E2E Nail Full UI Admin",
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
      expect(usersError).toBeNull();

      const { error: customerError } = await client.from("customers").insert({
        id: customerId,
        name_mother: customerName,
        name_baby: "Manicure Profile",
        phone: "0909000000",
        status: "active",
        tenant_id: tenantId,
      } satisfies Database["public"]["Tables"]["customers"]["Insert"]);
      expect(customerError).toBeNull();

      const { error: packageError } = await client.from("packages").insert({
        id: packageId,
        tenant_id: tenantId,
        name: packageName,
        module_key: "beauty_spa",
        service_category: "nail",
        service_kind: "treatment_package",
        full_price: 680000,
        price: 680000,
        total_sessions: 1,
        default_duration_minutes: 90,
        requires_resource: false,
        before_after_required: false,
        status: "active",
        ktv_commission: 80000,
        session_multiplier: 1,
      } satisfies Database["public"]["Tables"]["packages"]["Insert"]);
      expect(packageError).toBeNull();

      const { error: bookingError } = await client.from("bookings").insert({
        id: bookingId,
        booking_number: `NAIL-${marker}`,
        customer_id: customerId,
        tenant_id: tenantId,
        package_id: packageId,
        package_name: packageName,
        assigned_ktv_id: ktvId,
        status: "completed",
        start_date: today,
        end_date: today,
        preferred_time: "09:00",
        total_sessions: 1,
        completed_sessions: 1,
        full_price: 680000,
        deposit_amount: 680000,
        metadata: { product_key: "bella_nail", marker },
      } satisfies Database["public"]["Tables"]["bookings"]["Insert"]);
      expect(bookingError).toBeNull();

      const { error: sessionError } = await client.from("session_logs").insert({
        id: sessionId,
        tenant_id: tenantId,
        booking_id: bookingId,
        session_number: 1,
        status: "completed",
        assigned_date: today,
        assigned_time: "09:00",
        completed_date: nowIso,
        completed_by_ktv_id: ktvId,
        is_confirmed: true,
        rating: 5,
        actual_duration: 90,
        standard_duration: 90,
        accounting_review_status: "AUTO_POSTED",
        accounting_metadata: { product_key: "bella_nail", marker },
        business_event_type: "NAIL_SERVICE_COMPLETED",
      } satisfies Database["public"]["Tables"]["session_logs"]["Insert"]);
      expect(sessionError).toBeNull();

      const { error: revenueError } = await client.from("revenue").insert({
        id: revenueId,
        tenant_id: tenantId,
        booking_id: bookingId,
        amount: 680000,
        revenue_type: "session_completed",
        payment_method: "cash",
        received_date: today,
        status: "confirmed",
        recorded_by_id: adminId,
        notes: revenueNote,
        accounting_review_status: "AUTO_POSTED",
        accounting_metadata: { product_key: "bella_nail", marker },
        business_event_type: "NAIL_PAYMENT_COLLECTED",
      } satisfies Database["public"]["Tables"]["revenue"]["Insert"]);
      expect(revenueError).toBeNull();

      const { error: attendanceError } = await client.from("attendance").insert({
        id: attendanceId,
        tenant_id: tenantId,
        ktv_id: ktvId,
        date: today,
        status: "present",
        checkin_time: `${today}T08:45:00+07:00`,
        checkout_time: `${today}T18:00:00+07:00`,
      } satisfies Database["public"]["Tables"]["attendance"]["Insert"]);
      expect(attendanceError).toBeNull();

      const { error: salaryError } = await client.from("salary_records").insert({
        id: salaryId,
        tenant_id: tenantId,
        ktv_id: ktvId,
        month_year: currentMonthStartInVietnam(),
        status: "finalized",
        base_salary: 7000000,
        total_sessions: 1,
        session_bonus: 80000,
        rating_bonus: 50000,
        kpi_bonus: 0,
        service_commission: 80000,
        product_sales_commission: 0,
        position_bonus: 0,
        seniority_bonus: 0,
        manual_adjustments: 0,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7210000,
        confirmed_by_admin: true,
        finalized_at: nowIso,
        paid_date: today,
        paid_method: "bank_transfer",
        accounting_review_status: "AUTO_POSTED",
        accounting_metadata: { product_key: "bella_nail", marker },
        business_event_type: "NAIL_PAYROLL_FINALIZED",
      } satisfies Database["public"]["Tables"]["salary_records"]["Insert"]);
      expect(salaryError).toBeNull();

      const { error: expenseError } = await client.from("expenses").insert({
        id: expenseId,
        tenant_id: tenantId,
        category: "salary",
        amount: 7210000,
        description: salaryExpenseNote,
        expense_date: today,
        status: "paid",
        submitted_by_id: adminId,
        approved_by_id: adminId,
        accounting_review_status: "AUTO_POSTED",
        accounting_metadata: { product_key: "bella_nail", marker },
        business_event_type: "NAIL_PAYROLL_PAID",
      } satisfies Database["public"]["Tables"]["expenses"]["Insert"]);
      expect(expenseError).toBeNull();

      await page.context().addCookies([
        {
          name: "mock_user_email",
          value: email,
          url: "http://localhost:3000",
          sameSite: "Lax",
        },
      ]);

      await page.goto("/dashboard/bookings", { waitUntil: "domcontentloaded" });
      const bookingRow = page.getByTestId("booking-session-row").filter({ hasText: customerName }).first();
      await expect(bookingRow).toBeVisible({ timeout: 30_000 });
      await expect(bookingRow.getByTestId("booking-customer-name")).toContainText(customerName);
      await expect(bookingRow.getByTestId("booking-package-name")).toContainText(packageName);
      await expect(bookingRow.getByTestId("booking-session-status")).toContainText(/Xong|Hoàn thành/);

      await page.goto("/dashboard/salary", { waitUntil: "domcontentloaded" });
      const salaryRow = page.getByTestId("salary-row").filter({ hasText: staffName }).first();
      await expect(salaryRow).toBeVisible({ timeout: 30_000 });
      await expect(salaryRow.getByTestId("salary-employee-name")).toContainText(staffName);
      await expect(salaryRow.getByTestId("salary-session-count")).toContainText("1");
      await expect(salaryRow.getByTestId("salary-actual-days")).toContainText("1");
      await expect(salaryRow.getByTestId("salary-service-commission")).toContainText(/80[,.]000/);
      await expect(salaryRow.getByTestId("salary-total")).toContainText(/7[,.]210[,.]000/);
      await expect(salaryRow.getByTestId("salary-status")).toContainText("Đã chốt sổ");

      await page.goto("/dashboard/finance", { waitUntil: "domcontentloaded" });
      const revenueRow = page.getByTestId("finance-transaction-row").filter({ hasText: revenueNote }).first();
      await expect(revenueRow).toBeVisible({ timeout: 30_000 });
      await expect(revenueRow.getByTestId("finance-transaction-category")).toContainText(revenueNote);
      await expect(revenueRow.getByTestId("finance-transaction-details")).toContainText(packageName);
      await expect(revenueRow.getByTestId("finance-transaction-amount")).toContainText(/\+680[,.]000/);
      await expect(revenueRow.getByTestId("finance-transaction-status")).toContainText("Đã xác nhận");

      const payrollExpenseRow = page.getByTestId("finance-transaction-row").filter({ hasText: salaryExpenseNote }).first();
      await expect(payrollExpenseRow).toBeVisible({ timeout: 30_000 });
      await expect(payrollExpenseRow.getByTestId("finance-transaction-category")).toContainText("Lương nhân viên");
      await expect(payrollExpenseRow.getByTestId("finance-transaction-amount")).toContainText(/-7[,.]210[,.]000/);
      await expect(payrollExpenseRow.getByTestId("finance-transaction-status")).toContainText("Đã xác nhận");
    } finally {
      await client.from("expenses").delete().eq("id", expenseId);
      await client.from("salary_records").delete().eq("id", salaryId);
      await client.from("attendance").delete().eq("id", attendanceId);
      await client.from("revenue").delete().eq("id", revenueId);
      await client.from("session_logs").delete().eq("id", sessionId);
      await client.from("bookings").delete().eq("id", bookingId);
      await client.from("packages").delete().eq("id", packageId);
      await client.from("customers").delete().eq("id", customerId);
      await client.from("users").delete().in("id", [adminId, ktvId]);
      await client.from("tenants").delete().eq("id", tenantId);
    }
  });
});
