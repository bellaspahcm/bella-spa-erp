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

function baseUrl(): string {
  return process.env.E2E_BASE_URL?.trim() || `http://localhost:${process.env.E2E_PORT ?? "3000"}`;
}

async function ensureHqFixture(client: ReturnType<typeof e2eAdminClient>) {
  const hqTenantEmail = "e2e-hospitality-profile-hq@bellaspahcm.test";
  const hqAdminEmail = "e2e-hospitality-profile-admin@bellaspahcm.test";

  const { data: existingTenant, error: existingTenantError } = await client
    .from("tenants")
    .select("id")
    .eq("email", hqTenantEmail)
    .maybeSingle();
  expect(existingTenantError).toBeNull();

  const hqTenantId = existingTenant?.id ?? randomUUID();
  if (!existingTenant) {
    const { error: tenantError } = await client.from("tenants").insert({
      id: hqTenantId,
      name: "E2E Bella HQ Hospitality Profile Fixture",
      email: hqTenantEmail,
      status: "active",
      product_key: "bella_hq",
      enabled_modules: {
        babycare: false,
        beauty_spa: false,
        bella_education: false,
      },
    } satisfies Database["public"]["Tables"]["tenants"]["Insert"]);
    expect(tenantError).toBeNull();
  }

  const { data: existingUser, error: existingUserError } = await client
    .from("users")
    .select("id")
    .eq("email", hqAdminEmail)
    .maybeSingle();
  expect(existingUserError).toBeNull();

  if (existingUser) {
    const { error: updateUserError } = await client
      .from("users")
      .update({
        role: "admin",
        status: "active",
        tenant_id: hqTenantId,
      })
      .eq("id", existingUser.id);
    expect(updateUserError).toBeNull();
  } else {
    const { error: userError } = await client.from("users").insert({
      id: randomUUID(),
      email: hqAdminEmail,
      full_name: "E2E Hospitality Profile HQ Admin",
      role: "admin",
      status: "active",
      tenant_id: hqTenantId,
    } satisfies Database["public"]["Tables"]["users"]["Insert"]);
    expect(userError).toBeNull();
  }

  return { hqAdminEmail };
}

test.describe("Hospitality tenant profile HQ runtime onboarding", () => {
  test("HQ creates a Hospitality tenant with selected profile metadata", async ({ page }) => {
    const client = e2eAdminClient();
    const { hqAdminEmail } = await ensureHqFixture(client);
    const marker = `e2e-hospitality-profile-${Date.now()}`;
    const tenantName = `E2E Hospitality Profile ${marker}`;
    const tenantEmail = `${marker}@tenant.bellaspahcm.test`;
    const adminEmail = `${marker}.admin@tenant.bellaspahcm.test`;
    const adminPassword = "Password123!";
    let createdTenantId: string | null = null;
    let createdAdminUserId: string | null = null;

    try {
      await page.context().addCookies([
        {
          name: "mock_user_email",
          value: hqAdminEmail,
          url: baseUrl(),
          sameSite: "Lax",
        },
      ]);

      const hqResponse = await page.goto("/hq", { waitUntil: "domcontentloaded" });
      expect(hqResponse?.status() ?? 0).toBeLessThan(400);

      await page.getByRole("button", { name: /Đăng ký Chi nhánh|Đăng ký chi nhánh mới/i }).first().click();
      await expect(page.getByRole("heading", { name: "Đăng ký tenant mới" })).toBeVisible();

      await page.getByRole("button", { name: /Hospitality/i }).click();
      await expect(page.getByText("Hospitality profile *")).toBeVisible();
      await page.getByRole("button", { name: /^Homestay\s+Owner-operated/i }).click();
      await page.getByLabel(/Front desk/i).selectOption("self_check_in");
      await page.getByLabel(/Housekeeping/i).selectOption("turnover_only");
      await page.getByLabel(/Maintenance/i).selectOption("owner_approval_required");

      await page.getByPlaceholder("VD: Bella Beauty Spa Quận 7").fill(tenantName);
      await page.getByPlaceholder("0900000000").fill("0901234567");
      await page.getByPlaceholder("Địa chỉ tenant").fill("123 Hospitality Runtime Street");
      await page.getByPlaceholder("branch@company.com").fill(tenantEmail);
      await page.getByPlaceholder("Admin chi nhánh").fill("Hospitality Runtime Admin");
      await page.getByPlaceholder("admin@company.com").fill(adminEmail);
      await page.getByPlaceholder("Tối thiểu 6 ký tự").fill(adminPassword);
      await page.getByRole("button", { name: /Tạo tenant/i }).click();

      const readCreatedTenant = async () => {
        const { data, error } = await client
          .from("tenants")
          .select("id, product_key, enabled_modules, metadata")
          .eq("email", tenantEmail)
          .maybeSingle();
        expect(error).toBeNull();
        return data;
      };

      await expect.poll(async () => {
        return (await readCreatedTenant())?.product_key ?? null;
      }, { timeout: 90_000 }).toBe("bella_hospitality");

      const createdTenant = await readCreatedTenant();
      expect(createdTenant).not.toBeNull();
      if (!createdTenant) {
        throw new Error("HQ onboarding did not create the Hospitality tenant");
      }

      createdTenantId = createdTenant.id;
      expect(createdTenant.product_key).toBe("bella_hospitality");
      expect(createdTenant.enabled_modules).toMatchObject({
        babycare: false,
        beauty_spa: false,
        bella_education: false,
      });
      expect(createdTenant.metadata).toMatchObject({
        hospitality: {
          schemaVersion: 1,
          profileId: "homestay",
          configuration: {
            frontDeskMode: "self_check_in",
            housekeepingCadence: "turnover_only",
            maintenancePriority: "owner_approval_required",
          },
        },
      });

      const { data: branch, error: branchError } = await client
        .from("org_units")
        .select("id, unit_type, name, code")
        .eq("tenant_id", createdTenantId)
        .eq("unit_type", "branch")
        .eq("code", "MAIN")
        .maybeSingle();
      expect(branchError).toBeNull();
      expect(branch).not.toBeNull();
      expect(branch?.name).toBe(tenantName);

      const { data: createdAdmin, error: adminError } = await client
        .from("users")
        .select("id, tenant_id, role")
        .eq("email", adminEmail)
        .maybeSingle();
      expect(adminError).toBeNull();
      expect(createdAdmin).not.toBeNull();
      createdAdminUserId = createdAdmin?.id ?? null;
      expect(createdAdmin?.tenant_id).toBe(createdTenantId);
      expect(createdAdmin?.role).toBe("admin");

      await page.context().clearCookies();
      await page.context().addCookies([
        {
          name: "mock_user_email",
          value: adminEmail,
          url: baseUrl(),
          sameSite: "Lax",
        },
      ]);
      await page.goto("/hq", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Trang này chỉ dành cho quản trị viên Tổng bộ|Unauthorized|Quyền truy cập bị từ chối/i)).toBeVisible({ timeout: 20_000 });
    } finally {
      if (createdAdminUserId) {
        await client.auth.admin.deleteUser(createdAdminUserId);
      }
      if (createdTenantId) {
        await client.from("audit_logs").delete().eq("record_id", createdTenantId);
        await client.from("org_units").delete().eq("tenant_id", createdTenantId);
        await client.from("users").delete().eq("tenant_id", createdTenantId);
        await client.from("tenants").delete().eq("id", createdTenantId);
      }
    }
  });
});
