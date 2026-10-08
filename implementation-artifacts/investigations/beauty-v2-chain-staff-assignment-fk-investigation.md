# Investigation: Beauty V2 Chain Staff Assignment FK Failure

## Hand-off Brief

1. **What happened.** Assigning staff in Beauty V2 Chain Management can fail with `people_directory_user_id_fkey` because the selected `public.users.id` may not exist in `auth.users`.
2. **Where the case stands.** Status: Concluded. The failure is not primarily "user not in branch"; it occurs before branch relationship creation while linking the user into `people_directory`.
3. **What's needed next.** Repair demo/user provisioning or filter/guard Chain Management assignable users so only Auth-backed users are linkable to `people_directory`.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-10-08 |
| Status | Concluded |
| System | BELLA SPA ERP, Beauty V2 Chain Management, Supabase |
| Evidence sources | User screenshot, source code, migrations, live Supabase read-only checks |

## Problem Statement

User reported that assigning staff to a branch in Chain Management fails and asked whether the selected user might not belong to the branch.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Screenshot | Available | Toast shows FK violation on `people_directory`, constraint `people_directory_user_id_fkey`. |
| `src/app/dashboard/beauty-spa-v2/chain/beauty-chain-management-client.tsx` | Available | Submit flow calls `linkBeautyStaffPerson` before `assignBeautyStaffToBranch`. |
| `src/services/beauty-chain-actions.ts` | Available | Snapshot lists assignable staff from `public.users`; `ensureStaffPerson` inserts into `people_directory` with `user_id = public.users.id`. |
| `supabase/migrations/20260801030000_foundation_org_people_schema.sql` | Available | `people_directory.user_id` references `auth.users(id)`, not `public.users(id)`. |
| Live Supabase check | Available | In Beauty demo tenant, 4 of 6 non-customer public staff lack matching Auth users. |

## Confirmed Findings

### Finding 1: The failing FK belongs to `people_directory.user_id -> auth.users.id`

**Evidence:** `supabase/migrations/20260801030000_foundation_org_people_schema.sql:133-139`

**Detail:** `people_directory.user_id` is optional, but when non-null it must reference `auth.users(id)`.

### Finding 2: Chain UI links a staff person before creating branch membership

**Evidence:** `src/app/dashboard/beauty-spa-v2/chain/beauty-chain-management-client.tsx:117-124`

**Detail:** The submit handler first calls `linkBeautyStaffPerson({ userId })`, then calls `assignBeautyStaffToBranch`.

### Finding 3: The link path inserts a `people_directory` row using the selected `public.users.id`

**Evidence:** `src/services/beauty-chain-actions.ts:386-399`

**Detail:** If no existing person row exists, `ensureStaffPerson` inserts `user_id: params.user.id`.

### Finding 4: Assignable staff are loaded from `public.users`

**Evidence:** `src/services/beauty-chain-actions.ts:220-225`

**Detail:** Snapshot staff options are all non-customer rows in `public.users` for the tenant. The query does not prove that the ids also exist in `auth.users`.

### Finding 5: The demo seed creates only the admin Auth user, then inserts KTV/accountant rows directly in `public.users`

**Evidence:** `scripts/beauty-demo-tenant.cjs:462-481`, `scripts/beauty-demo-tenant.cjs:528-565`

**Detail:** `ensureDemoAuthUser` handles the demo admin Auth account; KTV/accountant staff rows are later inserted into `public.users` without Auth user creation.

### Finding 6: Live tenant data contains orphan public staff

**Evidence:** Live read-only Supabase check on 2026-10-08.

**Detail:** Tenant `94e179de-4ab3-4807-8f7d-58a196e75e15` has 6 non-customer `public.users`; 4 do not have matching Auth ids. The admin row visible in the screenshot has Auth, but the KTV/accountant demo options do not.

## Deduced Conclusions

### Deduction 1: The user's branch-membership hypothesis is not the root failure for this toast

**Based on:** Findings 1-3.

**Reasoning:** Branch membership is inserted into `org_relationships` after the People Directory link succeeds. The observed error is thrown by `people_directory` while trying to create that link.

**Conclusion:** A user not yet assigned to the branch is expected at this point; the actual blocker is that the selected user id is not valid for the `people_directory.user_id` FK.

### Deduction 2: Chain Management currently mixes public profile identity with Auth identity

**Based on:** Findings 1, 3, 4, and 6.

**Reasoning:** The UI/action treats `public.users.id` as linkable to People Directory, but the DB requires that value to exist in `auth.users`.

**Conclusion:** The assignable list can include users that the insert contract cannot accept.

## Hypothesized Paths

### Hypothesis 1: Selecting one of the orphan KTV/accountant users reproduces the screenshot error

**Status:** Confirmed by live data plus FK contract; not mutatively reproduced.

**Theory:** `people_directory.insert({ user_id: orphan_public_user_id })` violates `people_directory_user_id_fkey`.

**Supporting indicators:** The exact FK named in the screenshot matches the schema and four dropdown-eligible staff lack Auth rows.

**Would confirm:** A non-mutating dry-run is not available through PostgREST; a transaction rollback SQL repro could confirm if needed.

**Would refute:** Finding that the selected user has matching `auth.users` and the FK error was raised by a different row.

**Resolution:** Confirmed to diagnostic confidence without mutation.

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | `src/services/beauty-chain-actions.ts:395-401`, `people_directory.insert` |
| Trigger | Chain UI submit calls `linkBeautyStaffPerson` before branch assignment |
| Condition | Selected `public.users.id` has no matching `auth.users.id` |
| Related files | `src/app/dashboard/beauty-spa-v2/chain/beauty-chain-management-client.tsx`, `scripts/beauty-demo-tenant.cjs`, `supabase/migrations/20260801030000_foundation_org_people_schema.sql` |

## Conclusion

**Confidence:** High

Root cause is stale/incomplete identity provisioning for Chain Management assignable staff: the UI lists `public.users` rows, but People Directory requires `user_id` to reference `auth.users`. Demo KTV/accountant staff were created as public profile rows only, so assigning them attempts to insert invalid `people_directory.user_id` and fails before any branch-access relationship is created.

## Recommended Next Steps

### Fix direction

Choose one identity policy and enforce it consistently:

1. Provision Auth users for staff accounts that should be assignable as employees, especially demo KTV/accountant rows.
2. Or filter/label Chain Management dropdown rows that are not Auth-backed and block them with a domain error before `people_directory.insert`.
3. Add a guard/test around `linkBeautyStaffPerson` so a missing Auth identity returns a user-facing error instead of leaking a DB FK message.

### Diagnostic

For any future occurrence, capture the selected `userId` and run a read-only check against `public.users`, `auth.users`, and `people_directory` for that id.

## Reproduction Plan

1. Open Beauty V2 Chain Management for tenant `94e179de-4ab3-4807-8f7d-58a196e75e15`.
2. Select a staff row such as `ktv.beauty.94e179de.1@bellaspa.test` or `accountant.beauty.94e179de@bellaspa.test`.
3. Click `Gán vào chi nhánh`.
4. Expected failure: `insert or update on table "people_directory" violates foreign key constraint "people_directory_user_id_fkey"`.

## Side Findings

- The already-listed admin in the screenshot has a matching Auth user but no `people_directory` row yet, so it shows `Needs link`; assigning this specific admin should not fail for the FK reason.
