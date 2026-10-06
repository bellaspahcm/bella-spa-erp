/**
 * Service-role Supabase client cho E2E test setup/teardown.
 * KHÔNG BAO GIỜ import file này vào production code — chỉ dùng trong e2e/.
 *
 * Cần biến môi trường trong .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= (hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY= legacy)
 *   SUPABASE_SECRET_KEY= (hoặc SUPABASE_SERVICE_ROLE_KEY= legacy)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

let _admin: SupabaseClient | null = null;
let _envLoaded = false;
let _e2eTenantIdPromise: Promise<string> | null = null;
let _adminUserPromise: Promise<{ id: string; email: string }> | null = null;

type FilterValue = string | number | boolean | null;

function getSupabasePublicKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function getSupabaseAdminKey(): string {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]?.trim()) continue;

    const rawValue = match[2].trim();
    const unquotedValue = (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    )
      ? rawValue.slice(1, -1)
      : rawValue;

    process.env[match[1]] = unquotedValue;
  }
}

function candidateEnvFiles(): string[] {
  const candidates = [
    process.env.E2E_ENV_FILE,
    join(tmpdir(), "bella-spa-e2e.env"),
    resolve(process.cwd(), ".env.local"),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => resolve(filePath)))];
}

export function loadE2eEnv(): void {
  if (_envLoaded) return;

  for (const filePath of candidateEnvFiles()) {
    loadEnvFile(filePath);
  }
  _envLoaded = true;
}

export function hasSupabaseAdminEnv(): boolean {
  loadE2eEnv();
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    getSupabasePublicKey() &&
    getSupabaseAdminKey(),
  );
}

export function admin(): SupabaseClient {
  loadE2eEnv();
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseAdminKey();
  if (!url || !key) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY trong .env.local — E2E test cần để seed/teardown data.",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

function getTargetProductKey(): string {
  return process.env.E2E_TENANT_PRODUCT_KEY?.trim() || process.env.E2E_PRODUCT_KEY?.trim() || "bella_babycare";
}

function getTargetTenantId(): string {
  return process.env.E2E_TENANT_ID?.trim() || "";
}

function getTargetTenantName(): string {
  return process.env.E2E_TENANT_NAME?.trim() || "";
}

function getMockAdminEmail(): string {
  return process.env.E2E_MOCK_ADMIN_EMAIL?.trim() || process.env.E2E_ADMIN_MOCK_EMAIL?.trim() || "";
}

/** Get E2E tenant id. Defaults to BabyCare for local post-repair browser smoke. */
export async function getHqTenantId(): Promise<string> {
  if (_e2eTenantIdPromise) return _e2eTenantIdPromise;

  _e2eTenantIdPromise = (async () => {
    const explicitTenantId = getTargetTenantId();
    if (explicitTenantId) return explicitTenantId;

    const targetTenantName = getTargetTenantName();
    if (targetTenantName) {
      const { data, error } = await admin()
        .from("tenants")
        .select("id")
        .eq("name", targetTenantName)
        .limit(2);
      if (error || !data || data.length !== 1) {
        throw new Error(
          `Không xác định được E2E tenant name='${targetTenantName}' — ${error?.message ?? `${data?.length ?? 0} rows`}`,
        );
      }
      return data[0].id as string;
    }

    const productKey = getTargetProductKey();
    const { data, error } = await admin()
      .from("tenants")
      .select("id")
      .eq("product_key", productKey)
      .limit(2);
    if (error || !data || data.length !== 1) {
      throw new Error(
        `Không xác định được E2E tenant product_key='${productKey}' — ${error?.message ?? `${data?.length ?? 0} rows`}. Set E2E_TENANT_ID để chọn rõ tenant.`,
      );
    }
    return data[0].id as string;
  })();

  return _e2eTenantIdPromise;
}

/** Get an admin user id for the target E2E tenant. */
export async function getAnyAdminUser(): Promise<{ id: string; email: string }> {
  if (_adminUserPromise) return _adminUserPromise;

  _adminUserPromise = (async () => {
    const mockAdminEmail = getMockAdminEmail();
    if (mockAdminEmail) {
      const { data, error } = await admin()
        .from("users")
        .select("id, email")
        .eq("email", mockAdminEmail)
        .limit(1)
        .single();
      if (error || !data) {
        throw new Error(`Không có E2E mock admin email='${mockAdminEmail}' — ${error?.message ?? "no row"}`);
      }
      return { id: data.id, email: data.email as string };
    }

    const tenantId = await getHqTenantId();
    const { data, error } = await admin()
      .from("users")
      .select("id, email")
      .eq("tenant_id", tenantId)
      .eq("role", "admin")
      .limit(1)
      .single();
    if (error || !data) {
      throw new Error(`Không có user role=admin nào trong E2E tenant ${tenantId} — ${error?.message ?? "no row"}`);
    }
    return { id: data.id, email: data.email as string };
  })();

  return _adminUserPromise;
}

/** Get any KTV user id (for assigning bookings/sessions in tests). */
export async function getAnyKtv(): Promise<{ id: string; email: string } | null> {
  const tenantId = await getHqTenantId();
  const { data } = await admin()
    .from("users")
    .select("id, email")
    .eq("tenant_id", tenantId)
    .in("role", ["ktv", "ktv_lead"])
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, email: data.email as string } : null;
}

/** Get any active package for the HQ tenant. */
export async function getAnyPackage(): Promise<{ id: string; name: string; price: number } | null> {
  const tenantId = await getHqTenantId();
  const { data } = await admin()
    .from("packages")
    .select("id, name, price")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  return data
    ? { id: data.id as string, name: data.name as string, price: Number(data.price) }
    : null;
}

/**
 * Insert a temporary customer row for the current test run.
 * Returns the new customer id — caller is responsible for cleanup if needed.
 */
export async function createTestCustomer(opts: {
  phone?: string;
  nameMother?: string;
  tenantId?: string;
}): Promise<{ id: string; phone: string }> {
  const tenantId = opts.tenantId ?? (await getHqTenantId());
  const phone = opts.phone ?? `09${Date.now().toString().slice(-8)}`;
  const nameMother = opts.nameMother ?? `E2E Test Customer ${Date.now()}`;
  const { data, error } = await admin()
    .from("customers")
    .insert({ phone, name_mother: nameMother, tenant_id: tenantId, status: "active" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Insert customer failed: ${error?.message}`);
  return { id: data.id as string, phone };
}

/** Hard delete a customer (cleanup) — use sparingly. */
export async function deleteTestCustomer(id: string): Promise<void> {
  await admin().from("customers").delete().eq("id", id);
}

/** Count rows in a table — useful for assertions before/after. */
export async function countRows(table: string, filter?: Record<string, FilterValue>): Promise<number> {
  let q = admin().from(table).select("*", { count: "exact", head: true });
  if (filter) {
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  }
  const { count, error } = await q;
  if (error) throw new Error(`Count failed on ${table}: ${error.message}`);
  return count ?? 0;
}

/** Wait until a row appears matching the filter, or timeout. */
export async function waitForRow(
  table: string,
  filter: Record<string, FilterValue>,
  timeoutMs = 10_000,
): Promise<Record<string, unknown> | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let q = admin().from(table).select("*").limit(1);
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data } = await q.maybeSingle();
    if (data) return data as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
