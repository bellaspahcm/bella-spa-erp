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

async function expectNoAppLevelErrors(page: import("@playwright/test").Page) {
  const bodyText = await page.locator("body").innerText();
  for (const pattern of appErrorPatterns) {
    expect(bodyText).not.toMatch(pattern);
  }
}

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

    await expectNoAppLevelErrors(page);
  });

  test("package CTA prefills the booking service select", async ({ page }) => {
    await page.goto("/#services", { waitUntil: "domcontentloaded" });

    const services = page.locator("#services");
    const firstCard = services.locator("h4").first();
    await expect(firstCard).toBeVisible();
    const packageName = (await firstCard.innerText()).trim();
    expect(packageName.length).toBeGreaterThan(0);

    await services.getByRole("button", { name: /Đặt lịch gói này ngay/i }).first().click();

    const booking = page.locator("#booking");
    await expect(booking).toBeVisible();
    await expect(booking.getByRole("button", { name: new RegExp(packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })).toBeVisible();
    await expectNoAppLevelErrors(page);
  });

  test("booking form blocks empty submissions with required field validation", async ({ page }) => {
    await page.goto("/#booking", { waitUntil: "domcontentloaded" });

    const booking = page.locator("#booking");
    await expect(booking).toBeVisible();
    await booking.getByRole("button", { name: /Gửi thông tin giữ ưu đãi ngay/i }).click();

    await expect.poll(async () => await booking.locator("input:invalid").count()).toBeGreaterThan(0);
    await expectNoAppLevelErrors(page);
  });

  test("package tabs remain usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/#services", { waitUntil: "domcontentloaded" });

    const services = page.locator("#services");
    await expect(services).toBeVisible();

    for (const tab of packageTabs) {
      await services.getByRole("button", { name: tab.name }).click();
      await expect(services.locator("h4").first()).toBeVisible();
      await expect.poll(async () => await services.locator("h4").count()).toBeGreaterThan(0);
    }

    await expectNoAppLevelErrors(page);
  });
});
