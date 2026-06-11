/**
 * Beauty Spa resource booking smoke.
 *
 * Seeds a temporary Beauty tenant, opens the real booking UI as that tenant,
 * then verifies the server guard blocks assigning the same room/resource to
 * two active sessions in the same time slot.
 */

import type { Browser, Page } from "@playwright/test";
import { expect, getE2eBaseUrl, isLocalE2eBaseUrl, test } from "../fixtures/auth";
import { admin, getAnyAdminUser, hasSupabaseAdminEnv } from "../helpers/supabase-admin";
import type { Database } from "../../src/types/database.types";

type InsertedId = { id: string };
type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "D")
    .toLowerCase();
}

async function requireRow<T>(label: string, query: QueryResult<T>): Promise<T> {
  const { data, error } = await query;
  if (error || !data) {
    throw new Error(`${label} failed: ${error?.message ?? "no row returned"}`);
  }
  return data;
}

async function openMockUserPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: getE2eBaseUrl(),
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 900 },
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

test.describe("Beauty Spa resource booking smoke", () => {
  test.setTimeout(120_000);

  test.skip(
    !isLocalE2eBaseUrl() || !hasSupabaseAdminEnv(),
    "Uses localhost-only mock_user_email auth plus Supabase service-role env.",
  );

  test("Beauty booking UI blocks double-booking a room and Bella admin does not see the Beauty marker", async ({ browser }) => {
    const client = admin();
    const marker = `E2E-BEAUTY-RESOURCE-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const adminEmail = `${marker.toLowerCase()}@bellaspa.test`;
    const roomName = `${marker} Room 01`;
    const customerAName = `${marker} Customer A`;
    const customerBName = `${marker} Customer B`;
    const ids = {
      tenantId: "",
      userIds: [] as string[],
      packageIds: [] as string[],
      resourceIds: [] as string[],
      customerIds: [] as string[],
      bookingIds: [] as string[],
      sessionLogIds: [] as string[],
    };
    let testError: unknown = null;

    async function cleanup() {
      const cleanupSteps: Array<[string, QueryResult<unknown>]> = [
        ids.sessionLogIds.length
          ? ["session logs", client.from("session_logs").delete().in("id", ids.sessionLogIds)]
          : ["session logs", Promise.resolve({ data: null, error: null })],
        ids.bookingIds.length
          ? ["bookings", client.from("bookings").delete().in("id", ids.bookingIds)]
          : ["bookings", Promise.resolve({ data: null, error: null })],
        ids.customerIds.length
          ? ["customers", client.from("customers").delete().in("id", ids.customerIds)]
          : ["customers", Promise.resolve({ data: null, error: null })],
        ids.resourceIds.length
          ? ["booking resources", client.from("booking_resources").delete().in("id", ids.resourceIds)]
          : ["booking resources", Promise.resolve({ data: null, error: null })],
        ids.packageIds.length
          ? ["packages", client.from("packages").delete().in("id", ids.packageIds)]
          : ["packages", Promise.resolve({ data: null, error: null })],
        ids.userIds.length
          ? ["users", client.from("users").delete().in("id", ids.userIds)]
          : ["users", Promise.resolve({ data: null, error: null })],
        ids.tenantId
          ? ["tenant", client.from("tenants").delete().eq("id", ids.tenantId)]
          : ["tenant", Promise.resolve({ data: null, error: null })],
      ];

      const errors: string[] = [];
      for (const [label, query] of cleanupSteps) {
        const { error } = await query;
        if (error) errors.push(`${label}: ${error.message}`);
      }
      if (errors.length > 0) {
        throw new Error(`Beauty resource smoke cleanup failed: ${errors.join("; ")}`);
      }
    }

    try {
      const tenant = await requireRow<InsertedId>(
        "insert Beauty tenant",
        client
          .from("tenants")
          .insert({
            name: `${marker} Tenant`,
            email: `${marker.toLowerCase()}@tenant.test`,
            status: "active",
            royalty_type: "percentage",
            royalty_rate: 0,
            enabled_modules: { babycare: false, beauty_spa: true },
            brand_theme: {
              displayName: "E2E Beauty Resource Spa",
              primaryColor: "#0B1F3A",
              accentColor: "#FFD66D",
            },
          } satisfies Database["public"]["Tables"]["tenants"]["Insert"])
          .select("id")
          .single(),
      );
      ids.tenantId = tenant.id;

      const adminUser = await requireRow<InsertedId>(
        "insert Beauty admin user",
        client
          .from("users")
          .insert({
            email: adminEmail,
            full_name: `${marker} Admin`,
            role: "admin",
            status: "active",
            tenant_id: tenant.id,
          } satisfies Database["public"]["Tables"]["users"]["Insert"])
          .select("id")
          .single(),
      );
      ids.userIds.push(adminUser.id);

      const ktvUser = await requireRow<InsertedId>(
        "insert Beauty KTV user",
        client
          .from("users")
          .insert({
            email: `${marker.toLowerCase()}.ktv@bellaspa.test`,
            full_name: `${marker} KTV`,
            role: "ktv",
            status: "active",
            tenant_id: tenant.id,
          } satisfies Database["public"]["Tables"]["users"]["Insert"])
          .select("id")
          .single(),
      );
      ids.userIds.push(ktvUser.id);

      const pkg = await requireRow<InsertedId>(
        "insert Beauty package",
        client
          .from("packages")
          .insert({
            tenant_id: tenant.id,
            name: `${marker} Facial Package`,
            module_key: "beauty_spa",
            service_kind: "treatment_package",
            service_category: "facial",
            full_price: 1500000,
            price: 1500000,
            total_sessions: 3,
            requires_resource: true,
            default_resource_type: "room",
            status: "active",
          } satisfies Database["public"]["Tables"]["packages"]["Insert"])
          .select("id")
          .single(),
      );
      ids.packageIds.push(pkg.id);

      const resource = await requireRow<InsertedId>(
        "insert Beauty room resource",
        client
          .from("booking_resources")
          .insert({
            tenant_id: tenant.id,
            name: roomName,
            resource_type: "room",
            status: "available",
            capacity: 1,
            location_note: "E2E Floor 1",
          } satisfies Database["public"]["Tables"]["booking_resources"]["Insert"])
          .select("id")
          .single(),
      );
      ids.resourceIds.push(resource.id);

      const customers = await Promise.all([
        requireRow<InsertedId>(
          "insert customer A",
          client
            .from("customers")
            .insert({
              tenant_id: tenant.id,
              phone: `09${String(Date.now()).slice(-8)}`,
              name_mother: customerAName,
              name_baby: `${marker} Profile A`,
              address: "E2E District 1",
              status: "active",
            } satisfies Database["public"]["Tables"]["customers"]["Insert"])
            .select("id")
            .single(),
        ),
        requireRow<InsertedId>(
          "insert customer B",
          client
            .from("customers")
            .insert({
              tenant_id: tenant.id,
              phone: `08${String(Date.now()).slice(-8)}`,
              name_mother: customerBName,
              name_baby: `${marker} Profile B`,
              address: "E2E District 3",
              status: "active",
            } satisfies Database["public"]["Tables"]["customers"]["Insert"])
            .select("id")
            .single(),
        ),
      ]);
      ids.customerIds.push(...customers.map((customer) => customer.id));

      const bookings = await Promise.all(customers.map((customer, index) => (
        requireRow<InsertedId>(
          `insert booking ${index + 1}`,
          client
            .from("bookings")
            .insert({
              tenant_id: tenant.id,
              customer_id: customer.id,
              package_id: pkg.id,
              package_name: `${marker} Facial Package`,
              booking_number: `${marker}-BOOK-${index + 1}`,
              full_price: 1500000,
              deposit_amount: 300000,
              total_sessions: 3,
              completed_sessions: 0,
              start_date: today,
              preferred_time: "10:00",
              assigned_ktv_id: ktvUser.id,
              status: "in_progress",
            } satisfies Database["public"]["Tables"]["bookings"]["Insert"])
            .select("id")
            .single(),
        )
      )));
      ids.bookingIds.push(...bookings.map((booking) => booking.id));

      const sessionA = await requireRow<InsertedId>(
        "insert reserved session",
        client
          .from("session_logs")
          .insert({
            tenant_id: tenant.id,
            booking_id: bookings[0].id,
            session_number: 1,
            assigned_date: today,
            assigned_time: "10:00:00",
            completed_by_ktv_id: ktvUser.id,
            booking_resource_id: resource.id,
            status: "scheduled",
          } satisfies Database["public"]["Tables"]["session_logs"]["Insert"])
          .select("id")
          .single(),
      );
      const sessionB = await requireRow<InsertedId>(
        "insert unassigned resource session",
        client
          .from("session_logs")
          .insert({
            tenant_id: tenant.id,
            booking_id: bookings[1].id,
            session_number: 1,
            assigned_date: today,
            assigned_time: "10:00:00",
            completed_by_ktv_id: ktvUser.id,
            status: "scheduled",
          } satisfies Database["public"]["Tables"]["session_logs"]["Insert"])
          .select("id")
          .single(),
      );
      ids.sessionLogIds.push(sessionA.id, sessionB.id);

      const beautyPage = await openMockUserPage(browser, adminEmail);
      try {
        const response = await beautyPage.goto("/dashboard/bookings", { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 0, "Beauty bookings page must not return HTTP errors").toBeLessThan(400);

        const body = beautyPage.locator("body");
        await expect
          .poll(
            async () => normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => "")),
            { message: "Beauty bookings page should render seeded records", timeout: 30_000 },
          )
          .toContain(normalizeVietnamese(customerBName));
        await expect(body).toContainText(roomName, { timeout: 10_000 });

        await beautyPage.getByText(customerBName).first().click();
        await expect(beautyPage.getByText(/Chi tiáº¿t lá»‹ch háº¹n|Chi tiết lịch hẹn/i)).toBeVisible({ timeout: 10_000 });

        await beautyPage
          .getByRole("button", { name: /ChÆ°a gÃ¡n tÃ i nguyÃªn|Chưa gán tài nguyên|Chá»n giÆ°á»ng|Chọn giường/i })
          .first()
          .click();
        await beautyPage.getByRole("button", { name: new RegExp(roomName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
        const saveRequest = beautyPage.waitForResponse(
          (response) => (
            response.url().includes("/dashboard/bookings")
            && response.request().method() === "POST"
          ),
          { timeout: 10_000 },
        );
        await beautyPage.getByRole("button", { name: /LÆ°u thay Ä‘á»•i|Lưu thay đổi/i }).click();
        await saveRequest;
        await expect(beautyPage.getByText(/Chi tiáº¿t lá»‹ch háº¹n|Chi tiết lịch hẹn/i)).toBeVisible({ timeout: 5_000 });

        const { data: blockedSession, error: blockedSessionError } = await client
          .from("session_logs")
          .select("booking_resource_id")
          .eq("id", sessionB.id)
          .single();
        expect(blockedSessionError).toBeNull();
        expect(blockedSession?.booking_resource_id).toBeNull();
      } finally {
        await beautyPage.context().close();
      }

      const bellaAdmin = await getAnyAdminUser();
      const bellaPage = await openMockUserPage(browser, bellaAdmin.email);
      try {
        const response = await bellaPage.goto("/dashboard/bookings", { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 0, "Bella bookings page must not return HTTP errors").toBeLessThan(400);
        await bellaPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
        const bellaText = await bellaPage.locator("body").innerText({ timeout: 10_000 });
        expect(bellaText, "Bella admin must not see Beauty resource smoke customer").not.toContain(customerBName);
        expect(bellaText, "Bella admin must not see Beauty resource smoke room").not.toContain(roomName);
      } finally {
        await bellaPage.context().close();
      }
    } catch (error) {
      testError = error;
    }

    try {
      await cleanup();
    } catch (cleanupError) {
      if (testError) {
        throw new Error(`${String(testError)}; cleanup also failed: ${String(cleanupError)}`);
      }
      throw cleanupError;
    }

    if (testError) throw testError;
  });
});
