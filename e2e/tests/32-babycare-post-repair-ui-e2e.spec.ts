/**
 * BabyCare post-repair browser evidence.
 *
 * Read-only regression for the Timeline KTV / Month Calendar contract repair:
 * DB says 2026-10-06 has 3 sessions and all 3 bookings have assigned KTV.
 * Browser must not collapse the broader loaded calendar range into today's KPIs.
 */

import { type Page } from "@playwright/test";
import { admin, getHqTenantId } from "../helpers/supabase-admin";
import { canAuthenticateAdminPage, expect, test } from "../fixtures/auth";

const BABYCARE_AUDIT_DATE = "2026-10-06";

type SessionLogEvidence = {
  id: string;
  booking_id: string;
  assigned_date: string;
  assigned_time: string | null;
  status: string | null;
};

type BookingEvidence = {
  id: string;
  booking_number: string | null;
  customer_id: string | null;
  assigned_ktv_id: string | null;
  package_id: string | null;
  package_name: string | null;
};

type CustomerEvidence = {
  id: string;
  name_mother: string | null;
  phone: string | null;
};

type PackageEvidence = {
  id: string;
  name: string | null;
};

type UserEvidence = {
  id: string;
  full_name: string | null;
};

type BabyCareRecordEvidence = {
  session: SessionLogEvidence;
  booking: BookingEvidence;
  customer: CustomerEvidence | null;
  package: PackageEvidence | null;
  ktv: UserEvidence | null;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim();
}

function escapedNormalizedPattern(value: string): RegExp {
  return new RegExp(normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

async function getBodyText(page: Page): Promise<string> {
  return normalizeText(await page.locator("body").innerText({ timeout: 10_000 }));
}

async function waitForBodyMatch(page: Page, pattern: RegExp, message: string): Promise<void> {
  await expect.poll(
    async () => getBodyText(page),
    { message, timeout: 45_000 },
  ).toMatch(pattern);
}

async function getBabyCareRecordEvidence(): Promise<BabyCareRecordEvidence> {
  const tenantId = await getHqTenantId();

  const { data: sessionData, error: sessionError } = await admin()
    .from("session_logs")
    .select("id, booking_id, assigned_date, assigned_time, status")
    .eq("tenant_id", tenantId)
    .eq("assigned_date", BABYCARE_AUDIT_DATE)
    .order("assigned_time", { ascending: true });

  if (sessionError || !sessionData) {
    throw new Error(`BabyCare session evidence query failed: ${sessionError?.message ?? "no rows"}`);
  }

  const sessions = sessionData as SessionLogEvidence[];
  expect(sessions, "DB truth: BabyCare 2026-10-06 session_logs").toHaveLength(3);

  const bookingIds = [...new Set(sessions.map((session) => session.booking_id).filter(Boolean))];
  const { data: bookingData, error: bookingError } = await admin()
    .from("bookings")
    .select("id, booking_number, customer_id, assigned_ktv_id, package_id, package_name")
    .eq("tenant_id", tenantId)
    .in("id", bookingIds);

  if (bookingError || !bookingData) {
    throw new Error(`BabyCare booking evidence query failed: ${bookingError?.message ?? "no rows"}`);
  }

  const bookings = bookingData as BookingEvidence[];
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const missingBookingCount = sessions.filter((session) => !bookingsById.has(session.booking_id)).length;
  expect(missingBookingCount, "Every 2026-10-06 session must keep booking linkage").toBe(0);

  const unassignedCount = sessions.filter((session) => !bookingsById.get(session.booking_id)?.assigned_ktv_id).length;
  expect(unassignedCount, "DB truth: all BabyCare sessions for 2026-10-06 are assigned").toBe(0);

  const firstSession = sessions[0];
  const firstBooking = bookingsById.get(firstSession.booking_id);
  if (!firstBooking) {
    throw new Error(`Missing booking for BabyCare session ${firstSession.id}`);
  }

  const [customerResult, packageResult, ktvResult] = await Promise.all([
    firstBooking.customer_id
      ? admin().from("customers").select("id, name_mother, phone").eq("id", firstBooking.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    firstBooking.package_id
      ? admin().from("packages").select("id, name").eq("id", firstBooking.package_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    firstBooking.assigned_ktv_id
      ? admin().from("users").select("id, full_name").eq("id", firstBooking.assigned_ktv_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (customerResult.error) throw new Error(`Customer evidence query failed: ${customerResult.error.message}`);
  if (packageResult.error) throw new Error(`Package evidence query failed: ${packageResult.error.message}`);
  if (ktvResult.error) throw new Error(`KTV evidence query failed: ${ktvResult.error.message}`);

  return {
    session: firstSession,
    booking: firstBooking,
    customer: customerResult.data as CustomerEvidence | null,
    package: packageResult.data as PackageEvidence | null,
    ktv: ktvResult.data as UserEvidence | null,
  };
}

test.describe("BabyCare post-repair browser chain", () => {
  test.skip(
    !canAuthenticateAdminPage(),
    "Requires BabyCare E2E auth via localhost Supabase admin env or explicit E2E credentials.",
  );

  test("Customer -> Booking -> Timeline KTV -> Month Calendar read back BabyCare DB truth", async ({ adminPage }) => {
    const evidence = await getBabyCareRecordEvidence();
    const customerLabel = evidence.customer?.name_mother || evidence.customer?.phone || "Khách hàng";
    const packageLabel = evidence.package?.name || evidence.booking.package_name || "Liệu trình";
    const ktvLabel = evidence.ktv?.full_name || "";

    await adminPage.goto(`/dashboard/customers/${evidence.booking.customer_id}`, { waitUntil: "domcontentloaded" });
    await expect(adminPage).toHaveURL(/\/dashboard\/customers\//);
    await waitForBodyMatch(
      adminPage,
      escapedNormalizedPattern(customerLabel),
      "Customer detail must render the selected BabyCare record",
    );

    await adminPage.goto("/dashboard/bookings", { waitUntil: "domcontentloaded" });
    await expect(adminPage).toHaveURL(/\/dashboard\/bookings/);
    await waitForBodyMatch(adminPage, /Lich hen/i, "BabyCare bookings page must render schedule shell");
    await waitForBodyMatch(
      adminPage,
      /3\s+Tong lich hom nay/i,
      "Timeline KTV total must count selected date only, not the loaded 92-row range",
    );
    await waitForBodyMatch(
      adminPage,
      /0\s+Chua phan cong/i,
      "Timeline KTV unassigned must read bookings.assigned_ktv_id",
    );

    const timelineText = await getBodyText(adminPage);
    expect(timelineText, "Timeline must not show the old 92 total/unassigned regression").not.toMatch(
      /92\s+(Tong lich hom nay|Chua phan cong|lich can xu ly|Lich)/i,
    );
    expect(timelineText).toMatch(escapedNormalizedPattern(packageLabel));
    if (ktvLabel) {
      expect(timelineText).toMatch(escapedNormalizedPattern(ktvLabel));
    }

    const searchBox = adminPage.locator('input[placeholder*="Tìm"]').first();
    await searchBox.fill(customerLabel);
    await waitForBodyMatch(
      adminPage,
      escapedNormalizedPattern(customerLabel),
      "Booking search must retain the same customer record",
    );
    await searchBox.fill("");

    await adminPage.getByRole("button", { name: /Lịch tháng/i }).click();
    await waitForBodyMatch(
      adminPage,
      /3 lich hen .* Da phan cong du/i,
      "Month Calendar selected day must show 3 appointments and 0 unassigned",
    );
    await waitForBodyMatch(
      adminPage,
      /Tong lich hen\s+3/i,
      "Month Calendar daily summary must count selected day only",
    );

    const monthText = await getBodyText(adminPage);
    expect(monthText, "Month Calendar must not show the old 92 selected-day regression").not.toMatch(
      /92\s+(lich hen|Tong lich hen|Chua phan cong)/i,
    );
  });
});
