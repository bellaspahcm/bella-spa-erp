import { expect, test } from "@playwright/test";

const packageTabs = [
  { name: /Combo Mẹ & Bé/i },
  { name: /Tắm & Massage Bé/i },
  { name: /Phục hồi Sau Sinh/i },
  { name: /Chăm sóc Mẹ Bầu/i },
] as const;

const appErrorPatterns = [
  /application error/i,
  /unhandled runtime error/i,
  /this page could not be found/i,
  /an error occurred in the server components render/i,
];

test.describe("Landing packages public smoke", () => {
  test("package tabs render cards without app-level errors", async ({ page }) => {
    const response = await page.goto("/#services", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(400);

    const services = page.locator("#services");
    await expect(services).toBeVisible();
    await expect(services.getByRole("heading", { name: /Bảng Giá Dịch Vụ/i })).toBeVisible();

    for (const tab of packageTabs) {
      await services.getByRole("button", { name: tab.name }).click();
      await expect(services.locator("h4").first()).toBeVisible();
      await expect.poll(async () => await services.locator("h4").count()).toBeGreaterThan(0);
    }

    const bodyText = await page.locator("body").innerText();
    for (const pattern of appErrorPatterns) {
      expect(bodyText).not.toMatch(pattern);
    }
  });
});
