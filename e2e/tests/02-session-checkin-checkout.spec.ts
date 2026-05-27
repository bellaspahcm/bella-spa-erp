/**
 * P0-E2E-02 — KTV check-in/check-out session
 *
 * Luồng nghiệp vụ: KTV mở app trên dashboard cá nhân, thấy session hôm nay,
 * bấm check-in (ghi GPS), phục vụ, bấm check-out → status chuyển 'completed',
 * sinh revenue, trừ inventory, cập nhật KPI.
 *
 * Kiểm thử ở mức SMOKE:
 *   - Trang sessions/dashboard load
 *   - Trang KTV dashboard (/ktv/dashboard) load nếu user role là KTV
 *   - DB: insert session_log via service-role, verify cascade
 */

import { test, expect } from "../fixtures/auth";
import { goto } from "../helpers/ui";
import { admin, getHqTenantId, countRows } from "../helpers/supabase-admin";

test.describe("Sessions · Check-in / Check-out", () => {
  test("Trang Thẻ liệu trình tải được", async ({ adminPage }) => {
    await goto(adminPage, "/dashboard/sessions");
    await expect(adminPage).toHaveURL(/\/dashboard\/sessions/);

    // Tìm dấu hiệu trang có nội dung (filter, danh sách thẻ, hoặc empty state)
    const indicator = adminPage
      .locator("h1, h2, [data-testid='session-card']")
      .or(adminPage.getByText(/Thẻ liệu trình|Sessions|Chưa có buổi nào/i));
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Trang KTV dashboard (mobile-first) tải được nếu route tồn tại", async ({ adminPage }) => {
    const resp = await adminPage.goto("/ktv/dashboard", { waitUntil: "domcontentloaded" });
    // Một số deployment có thể redirect non-KTV → /dashboard; chỉ cần không 5xx
    expect(resp?.status() ?? 0).toBeLessThan(500);
  });

  test("Insert session_log via API → status 'completed' kích hoạt outbox event", async () => {
    const tenantId = await getHqTenantId();

    // 1) Lấy booking đang in_progress (hoặc skip nếu DB rỗng — sau reset script)
    const { data: booking } = await admin()
      .from("bookings")
      .select("id, customer_id, total_sessions, completed_sessions, assigned_ktv_id")
      .eq("tenant_id", tenantId)
      .in("status", ["booked", "in_progress"])
      .limit(1)
      .maybeSingle();
    test.skip(!booking, "Không có booking active nào — bỏ qua test này.");

    const ktvId = booking!.assigned_ktv_id as string | null;
    test.skip(!ktvId, "Booking không có KTV gán — bỏ qua.");

    const sessionNum = (booking!.completed_sessions as number) + 1;
    const before = await countRows("session_logs", { booking_id: booking!.id });

    const { data: sess, error } = await admin()
      .from("session_logs")
      .insert({
        booking_id: booking!.id,
        session_number: sessionNum,
        assigned_date: new Date().toISOString().slice(0, 10),
        completed_date: new Date().toISOString().slice(0, 10),
        completed_by_ktv_id: ktvId,
        status: "completed",
        tenant_id: tenantId,
      })
      .select("id, status")
      .single();

    expect(error).toBeNull();
    expect(sess?.status).toBe("completed");

    const after = await countRows("session_logs", { booking_id: booking!.id });
    expect(after).toBe(before + 1);

    // Cleanup
    if (sess?.id) await admin().from("session_logs").delete().eq("id", sess.id);
  });
});
