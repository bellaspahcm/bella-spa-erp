/**
 * UI helpers cho E2E — wrap các thao tác lặp đi lặp lại (sidebar, toast, modal, etc).
 */

import type { Page, Locator } from "@playwright/test";

/** Navigate via sidebar link (matches label text). */
export async function nav(page: Page, label: string | RegExp): Promise<void> {
  // Sidebar may be hidden on mobile — ensure desktop viewport from config.
  const link = page.locator("aside a, aside [role='link']").filter({ hasText: label }).first();
  await link.click();
  // Allow route transition
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Direct route navigation (faster than sidebar click). */
export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Wait for a toast notification by text — Bella uses sonner. */
export async function expectToast(page: Page, text: string | RegExp, timeout = 8_000): Promise<void> {
  const toast = page.locator("[data-sonner-toast], .toast, [role='status']").filter({ hasText: text });
  await toast.first().waitFor({ state: "visible", timeout });
}

/** Click button by accessible name (more stable than CSS selectors). */
export async function clickButton(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole("button", { name }).first().click();
}

/** Fill input by label text. */
export async function fillByLabel(page: Page, label: string | RegExp, value: string): Promise<void> {
  const inp = page.getByLabel(label).first();
  await inp.fill(value);
}

/** Wait for any of multiple selectors to appear — returns the locator. */
export async function waitForAny(page: Page, selectors: string[], timeout = 10_000): Promise<Locator> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
        return loc;
      }
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`None of selectors became visible within ${timeout}ms: ${selectors.join(", ")}`);
}

/** Confirm dialog OK button (system confirm) — set page.on once at test start. */
export async function autoAcceptDialogs(page: Page): Promise<void> {
  page.on("dialog", (d) => d.accept().catch(() => {}));
}

/** Format Vietnamese currency for input comparison. */
export function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}
