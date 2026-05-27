/**
 * P0-E2E-04 — Đóng kỳ kế toán
 *
 * Luồng nghiệp vụ: cuối tháng, kế toán đảm bảo:
 *   - Outbox không còn PENDING/FAILED
 *   - Trial Balance cân (Nợ = Có)
 *   - Đóng kỳ → status 'CLOSED' → không thể sửa JE nữa
 *
 * Kiểm thử ở mức SMOKE:
 *   - Trang kế toán/periods load
 *   - DB: kiểm tra accounting_periods tồn tại + can transition OPEN → CLOSED
 */

import { test, expect } from "../fixtures/auth";
import { goto } from "../helpers/ui";
import { admin, getHqTenantId } from "../helpers/supabase-admin";

test.describe("Accounting · Đóng kỳ kế toán", () => {
  test("Trang kế toán sổ cái load", async ({ adminPage }) => {
    await goto(adminPage, "/dashboard/accounting");
    await expect(adminPage).toHaveURL(/\/dashboard\/accounting/);

    // Tìm dấu hiệu accounting module
    const indicator = adminPage
      .locator("[data-testid='accounting-nav'], h1, h2")
      .or(adminPage.getByText(/Kế toán|Sổ cái|Chart of Accounts|Journal|Periods/i));
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Trang quản lý kỳ kế toán load", async ({ adminPage }) => {
    const resp = await adminPage.goto("/dashboard/accounting/periods", { waitUntil: "domcontentloaded" });
    // Route có thể không tồn tại trong vài deployment — chấp nhận 200/404 nhưng KHÔNG 500
    expect(resp?.status() ?? 0).toBeLessThan(500);
  });

  test("Outbox endpoint accessible (queue cho accounting events)", async ({ adminPage }) => {
    const resp = await adminPage.goto("/dashboard/accounting/outbox", { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 0).toBeLessThan(500);
  });

  test("DB: accounting_periods tồn tại + OPEN → CLOSED transition (test row tạo tạm)", async () => {
    const tenantId = await getHqTenantId();

    // Tạo period tạm (tránh đụng period thật)
    const testName = `E2E-PERIOD-${Date.now()}`;
    const startDate = "2030-01-01";
    const endDate = "2030-01-31";

    const { data: inserted, error: insErr } = await admin()
      .from("accounting_periods")
      .insert({
        tenant_id: tenantId,
        name: testName,
        start_date: startDate,
        end_date: endDate,
        status: "OPEN",
      })
      .select("id, status")
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.status).toBe("OPEN");

    // Transition OPEN → CLOSED
    const { data: closed, error: updErr } = await admin()
      .from("accounting_periods")
      .update({ status: "CLOSED" })
      .eq("id", inserted!.id)
      .select("status")
      .single();
    expect(updErr).toBeNull();
    expect(closed?.status).toBe("CLOSED");

    // Cleanup
    await admin().from("accounting_periods").delete().eq("id", inserted!.id);
  });

  test("DB: COA (accounting_accounts) tồn tại cho HQ tenant", async () => {
    const tenantId = await getHqTenantId();
    const { count, error } = await admin()
      .from("accounting_accounts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    expect(error).toBeNull();
    // COA seed có ít nhất ~20 TK chuẩn TT200 (111, 112, 131, 511, 6322, ...)
    expect(count ?? 0).toBeGreaterThan(10);
  });
});
