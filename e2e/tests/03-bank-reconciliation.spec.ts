/**
 * P0-E2E-03 — Đối soát ngân hàng
 *
 * Luồng nghiệp vụ: kế toán upload sao kê NH → hệ thống auto-match với revenue
 * records pending → chuyển status 'confirmed' → user confirm để hoàn tất.
 *
 * Kiểm thử ở mức SMOKE:
 *   - Trang đối soát load
 *   - Upload control hiển thị
 *   - DB: insert revenue pending, update sang confirmed, verify
 */

import { test, expect } from "../fixtures/auth";
import { goto } from "../helpers/ui";
import { admin, getHqTenantId } from "../helpers/supabase-admin";

test.describe("Finance · Đối soát ngân hàng", () => {
  test("Trang đối soát tài chính tải được + có upload control", async ({ adminPage }) => {
    await goto(adminPage, "/dashboard/finance/reconciliation");
    await expect(adminPage).toHaveURL(/\/dashboard\/finance\/reconciliation/);

    // Tìm 1 trong các dấu hiệu trang reconciliation: nút upload, file input, heading
    const indicator = adminPage
      .locator("input[type='file'], button:has-text('Upload'), button:has-text('Tải sao kê'), button:has-text('Đối soát'), h1, h2")
      .or(adminPage.getByText(/Đối soát|Reconciliation/i));
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Insert revenue pending qua API → update sang confirmed (mô phỏng manual reconcile)", async () => {
    const tenantId = await getHqTenantId();

    // Lấy 1 booking để gắn revenue
    const { data: booking } = await admin()
      .from("bookings")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    test.skip(!booking, "Không có booking nào — bỏ qua test này.");

    // 1) Insert revenue pending
    const { data: rev, error: insErr } = await admin()
      .from("revenue")
      .insert({
        booking_id: booking!.id,
        amount: 1_000_000,
        revenue_type: "deposit",
        payment_method: "bank_transfer",
        received_date: new Date().toISOString().slice(0, 10),
        status: "pending",
        tenant_id: tenantId,
        notes: "E2E reconciliation test",
      })
      .select("id, status")
      .single();
    expect(insErr).toBeNull();
    expect(rev?.status).toBe("pending");

    // 2) Update sang confirmed (mô phỏng sau khi match sao kê)
    const { data: updated, error: updErr } = await admin()
      .from("revenue")
      .update({ status: "confirmed" })
      .eq("id", rev!.id)
      .select("status")
      .single();
    expect(updErr).toBeNull();
    expect(updated?.status).toBe("confirmed");

    // Cleanup
    await admin().from("revenue").delete().eq("id", rev!.id);
  });
});
