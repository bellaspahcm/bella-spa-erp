# Database Rules & Schema Standards

**Scope:** Repository-wide  

---

## 1. Additive Migration Policy (Law 4)

Migrations must never break existing tables.

*   ❌ **FORBIDDEN:** `DROP TABLE`, `DROP COLUMN`, `ALTER TABLE ... DROP CONSTRAINT`.
*   ❌ **FORBIDDEN:** Renaming columns or changing data types in a way that breaks existing queries.
*   ✅ **MANDATORY:** Migrations must be **additive only**: `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN`, `CREATE INDEX`, `CREATE POLICY`.

---

## 2. Row Level Security (RLS) & Tenant Isolation (Law 7)

Every table storing tenant-specific data must enable RLS.

*   ✅ **MANDATORY:**
    ```sql
    ALTER TABLE public.your_table_name ENABLE ROW LEVEL SECURITY;
    ```
*   ✅ **MANDATORY:** Establish the tenant isolation policy using `public.get_auth_tenant_id()`:
    ```sql
    CREATE POLICY tenant_isolation_policy ON public.your_table_name
      FOR ALL
      USING (tenant_id = public.get_auth_tenant_id())
      WITH CHECK (tenant_id = public.get_auth_tenant_id());
    ```

---

## 3. Schema Standards

*   **`tenant_id` column:** Must be `UUID NOT NULL`.
*   **Primary Keys:** Every table must have a primary key named `id`, typed `UUID` with default `gen_random_uuid()`.
*   **Timestamps:** Tables must include `created_at` and `updated_at` (default `now()`).

---

## 4. Reference Data (Global Tables)

For global tables containing static data (such as ICD codes, drug lists, registries):

*   RLS must be enabled.
*   `SELECT` is open to all authenticated users (`USING (true)`).
*   Write actions (INSERT/UPDATE/DELETE) are restricted to the `service_role` or platform roles only.
*   Refer to `supabase/migrations/20260826154332_fix_hc_enterprise_registries_rls.sql` for implementation reference.
