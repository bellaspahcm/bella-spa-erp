import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Database } from "../../src/types/database.types";

function loadEnvFile(filePath: string): void {
  const fs = require("node:fs") as typeof import("node:fs");
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const rawValue = match[2].trim();
    const value = (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    )
      ? rawValue.slice(1, -1)
      : rawValue;
    process.env[match[1]] = value;
  }
}

function e2eAdminClient() {
  loadEnvFile(process.env.E2E_ENV_FILE || ".env.e2e");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing E2E Supabase URL or service-role key");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe("Bella Nail Product RC UI", () => {
  test("executes the three Nail RC browser journeys", async ({ page }) => {
    const client = e2eAdminClient();
    const tenantId = randomUUID();
    const userId = randomUUID();
    const marker = `e2e-nail-ui-${Date.now()}`;
    const email = `${marker}@bellaspahcm.test`;

    try {
      const { error: tenantError } = await client.from("tenants").insert({
        id: tenantId,
        name: `E2E Nail UI Tenant ${marker}`,
        status: "active",
        enabled_modules: { beauty_spa: true, babycare: false },
        brand_theme: { displayName: "Bella Nail" },
      } satisfies Database["public"]["Tables"]["tenants"]["Insert"]);
      expect(tenantError).toBeNull();

      const { error: userError } = await client.from("users").insert({
        id: userId,
        email,
        full_name: "E2E Nail UI Admin",
        role: "admin",
        status: "active",
        tenant_id: tenantId,
      } satisfies Database["public"]["Tables"]["users"]["Insert"]);
      expect(userError).toBeNull();

      await page.context().addCookies([
        {
          name: "mock_user_email",
          value: email,
          url: "http://localhost:3000",
          sameSite: "Lax",
        },
      ]);

      const response = await page.goto("/dashboard/nail", { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0).toBeLessThan(400);

      await expect(page.getByRole("heading", { name: "Bella Nail Operations" })).toBeVisible();
      await expect(page.getByTestId("nail-rc-status")).toContainText("READY");

      await page.getByTestId("run-nail-booking").click();
      await expect(page.getByTestId("run-nail-booking-status")).toContainText("PASS");
      await expect(page.getByTestId("nail-evidence-allocations")).toContainText("2");
      await expect(page.getByTestId("nail-evidence-outcome")).toContainText("Rose Gold");

      await page.getByTestId("run-nail-waitlist").click();
      await expect(page.getByTestId("run-nail-waitlist-status")).toContainText("PASS");
      await expect(page.getByTestId("nail-evidence-waitlist")).toContainText("PROMOTED");

      await page.getByTestId("run-nail-reassignment").click();
      await expect(page.getByTestId("run-nail-reassignment-status")).toContainText("PASS");
      await expect(page.getByTestId("nail-evidence-history")).toContainText("1");
      await expect(page.getByTestId("nail-evidence-performer")).toContainText("tech-ha");
      await expect(page.getByTestId("nail-rc-status")).toContainText("PASS");
    } finally {
      await client.from("users").delete().eq("id", userId);
      await client.from("tenants").delete().eq("id", tenantId);
    }
  });
});
