# Debug Scripts

**Purpose:** Reusable scripts for investigating test data and database state during development.

**Status:** ⚠️ NOT part of automated test suite. For manual debugging only.

---

## Available Scripts

### `get-test-tenant.js`
Fetch available test tenants from database.

**Usage:**
```bash
node scripts/debug/get-test-tenant.js
```

**Output:**
```json
{
  "id": "10000000-0000-0000-0000-000000000001",
  "name": "Test Tenant A"
}
```

---

### `get-test-patient.js`
Fetch available test patients (party_type = person) from database.

**Usage:**
```bash
node scripts/debug/get-test-patient.js
```

**Output:**
```json
{
  "id": "20000000-0000-0000-0000-000000000001",
  "party_type": "person",
  "display_name": "Test Patient A"
}
```

---

## Prerequisites

**Environment:**
- `.env.test` must be configured with Supabase credentials
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` required

**Dependencies:**
- `@supabase/supabase-js` (already installed)

---

## Guidelines

1. **Do NOT** commit debug scripts to production builds
2. **Do NOT** use debug scripts in CI/CD pipelines
3. **Do** use debug scripts for local investigation during Gate debugging
4. **Do** update this README when adding new debug scripts

---

**Last Updated:** 2026-08-12  
**Related:** Gate 1C cleanup after 322/322 PASS
