/**
 * P0-E2E-05 — Chốt & duyệt lương tháng
 *
 * Luồng nghiệp vụ: cuối tháng, HR/kế toán mở Bảng lương → chạy đối soát AI →
 * review từng KTV → duyệt → xuất Excel → chuyển khoản → đánh dấu "Đã trả".
 *
 * Kiểm thử ở mức SMOKE:
 *   - Trang Bảng lương load
 *   - Trang Đối soát lương AI load
 *   - DB: insert salary_records draft → transition sang approved → paid
 */

import { test, expect } from "../fixtures/auth";
import { goto } from "../helpers/ui";
import { admin, getHqTenantId, getAnyKtv } from "../helpers/supabase-admin";

test.describe("HR · Chốt & duyệt lương", () => {
  test("Trang Bảng lương load", async ({ adminPage }) => {
    await goto(adminPage, "/dashboard/salary");
    await expect(adminPage).toHaveURL(/\/dashboard\/salary/);

    const indicator = adminPage
      .locator("table, [data-testid='salary-table'], h1, h2")
      .or(adminPage.getByText(/Bảng lương|Salary|Lương|Hoa hồng/i));
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Trang Đối soát Lương AI accessible", async ({ adminPage }) => {
    const resp = await adminPage.goto("/dashboard/ai-copilot/salary-reconciliation", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 0).toBeLessThan(500);
  });

  test("DB: salary_record state machine (draft → pending_approval → approved → paid)", async () => {
    const tenantId = await getHqTenantId();
    const ktv = await getAnyKtv();
    test.skip(!ktv, "Không có KTV nào — bỏ qua test này.");

    const monthYear = "2030-01-01"; // tháng test không đụng dữ liệu thật

    // 1) Insert draft
    const { data: rec, error: insErr } = await admin()
      .from("salary_records")
      .insert({
        ktv_id: ktv!.id,
        month_year: monthYear,
        base_salary: 5_000_000,
        service_percentage_bonus: 3_000_000,
        kpi_bonus: 500_000,
        violations_deduction: 0,
        total_salary: 8_500_000,
        status: "draft",
        tenant_id: tenantId,
      })
      .select("id, status")
      .single();
    expect(insErr).toBeNull();
    expect(rec?.status).toBe("draft");

    // 2) → pending_approval
    const r2 = await admin()
      .from("salary_records")
      .update({ status: "pending_approval" })
      .eq("id", rec!.id)
      .select("status")
      .single();
    expect(r2.error).toBeNull();
    expect((r2.data as { status: string } | null)?.status).toBe("pending_approval");

    // 3) → approved
    const r3 = await admin()
      .from("salary_records")
      .update({ status: "approved" })
      .eq("id", rec!.id)
      .select("status")
      .single();
    expect(r3.error).toBeNull();
    expect((r3.data as { status: string } | null)?.status).toBe("approved");

    // 4) → paid (kèm paid_date + paid_method)
    const r4 = await admin()
      .from("salary_records")
      .update({
        status: "paid",
        paid_date: new Date().toISOString().slice(0, 10),
        paid_method: "bank_transfer",
      })
      .eq("id", rec!.id)
      .select("status, paid_date, paid_method")
      .single();
    expect(r4.error).toBeNull();
    const paidRow = r4.data as { status: string; paid_method: string } | null;
    expect(paidRow?.status).toBe("paid");
    expect(paidRow?.paid_method).toBe("bank_transfer");

    // Cleanup
    await admin().from("salary_records").delete().eq("id", rec!.id);
  });

  test("DB: tenant có cấu hình salary_config (bonus 5★, KPI target)", async () => {
    const tenantId = await getHqTenantId();
    const { data, error } = await admin()
      .from("tenants")
      .select("salary_config")
      .eq("id", tenantId)
      .single();
    expect(error).toBeNull();
    // salary_config có thể null nếu chưa setup — chỉ verify shape
    if (data?.salary_config) {
      expect(typeof data.salary_config).toBe("object");
    }
  });
});
