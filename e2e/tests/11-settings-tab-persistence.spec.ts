import { canAuthenticateAdminPage, expect, test } from "../fixtures/auth";

test.describe("Settings tab persistence", () => {
  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  test("keeps the selected settings tab after a hard refresh", async ({ adminPage }) => {
    await adminPage.goto("/dashboard/settings?tab=salary", { waitUntil: "domcontentloaded" });
    await adminPage.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(adminPage).toHaveURL(/\/dashboard\/settings\?tab=salary/);
    await expect(adminPage.getByText(/cấu hình lương & thưởng|cau hinh luong & thuong/i)).toBeVisible();

    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(adminPage).toHaveURL(/\/dashboard\/settings\?tab=salary/);
    await expect(adminPage.getByText(/cấu hình lương & thưởng|cau hinh luong & thuong/i)).toBeVisible();
  });
});
