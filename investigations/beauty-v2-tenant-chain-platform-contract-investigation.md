# Investigation: Beauty V2 Tenant Chain Platform Contract

## Hand-off Brief

1. **What happened.** User requested a static audit of the existing Platform Org Unit Contract for Beauty V2 tenant-side Chain Management; HQ Tenant Provisioning is explicitly out of scope.
2. **Where the case stands.** Concluded for static audit; org_units and user_org_unit_access are sufficient as DB primitives, but Beauty lacks tenant-side chain UI/API and a proven staff-assignment workflow.
3. **What's needed next.** Implement Beauty-specific UI/API that consumes Platform contract, then prove Company -> Branch -> Staff -> Access with Real DB E2E.

## Case Info

| Field            | Value |
| ---------------- | ----- |
| Ticket           | N/A |
| Date opened      | 2026-10-06 |
| Status           | Concluded |
| System           | Windows/PowerShell worktree audit |
| Evidence sources | Source code, SQL migrations, static search |

## Problem Statement

Audit Beauty V2 Tenant Chain Management Platform Contract without modifying code, without inspecting or modifying HQ Tenant Provisioning, without creating Beauty-specific chain tables, and without running the app. Determine whether existing org_units, org_relationships, people_directory, user_org_unit_access, and org-unit services are sufficient to implement Company -> Branch -> Staff -> Branch Access.

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| src/platform/org-unit/index.ts | Available | Public org-unit contract and declared non-goals. |
| src/platform/org-unit/org-unit.engine.ts | Available | Lifecycle/query implementation and user-access TODO. |
| src/platform/org-unit/org-unit.repository.ts | Available | Supabase repository for org_units. |
| supabase/migrations/20260801030000_foundation_org_people_schema.sql | Available | org_units, org_relationships, people_directory, people_profiles schema. |
| supabase/migrations/20260914_create_user_org_unit_access_projection.sql | Available | Projection derives user access from people_directory, org_relationships, org_units, and users.role. |
| RLS policies for org foundation | Available | Tenant read and admin-scoped write policies exist for org_units, org_relationships, people_directory, people_profiles. |
| Beauty branch-aware consumers | Available | Attendance/commission/payroll have partial branch-aware consumers and branch_id FKs/indexes. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Org unit lifecycle and hierarchy sufficiency | High | Done | Company/Region/Branch can be represented by org_units. |
| 2 | Person and staff assignment contract | High | Done | DB model exists; reusable write service is partial/unsafe for relationship tenant_id. |
| 3 | Branch access projection and RLS coverage | High | Done | Projection exists; org foundation RLS exists; Beauty runtime DB enforcement remains partial. |
| 4 | Existing product consumers | Medium | Done | Beauty consumers are partial; Haircut has stronger DB policy example. |
| 5 | Minimal implementation plan | High | Done | No Platform table fork; Beauty UI/API first, then runtime/E2E. |

## Timeline of Events

| Time | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| 2026-10-06 | Static audit started in isolated worktree. | user request + worktree state | Confirmed |

## Confirmed Findings

### Finding 1: org_units already supports the canonical chain hierarchy.

**Evidence:** `src/platform/org-unit/index.ts:1-13`, `src/platform/org-unit/index.ts:35-43`, `supabase/migrations/20260801030000_foundation_org_people_schema.sql:25-55`

**Detail:** The Platform Org Unit Contract is explicitly generic for all verticals and supports Company, Region, Branch, Department, and Team. The database table stores tenant_id, unit_type, name, code, parent_id, is_active, metadata, and unique tenant/code.

### Finding 2: org-unit lifecycle/query API is present for Company/Branch CRUD.

**Evidence:** `src/platform/org-unit/index.ts:151-224`, `src/platform/org-unit/org-unit.engine.ts:47-167`, `src/platform/org-unit/org-unit.repository.ts:81-239`

**Detail:** The contract exposes create/update/archive/get/list/children/hierarchy operations, and the implementation validates parent tenant scope and code uniqueness.

### Finding 3: membership and permission checks are intentionally outside the org-unit contract.

**Evidence:** `src/platform/org-unit/index.ts:127-132`, `src/platform/org-unit/org-unit.engine.ts:228-248`, `src/platform/org-unit/__tests__/org-unit.engine.test.ts:371-398`

**Detail:** The contract says membership management is deferred to org_relationships and permission checks to IAM Matrix. `getUserAccessibleUnits()` currently returns all active units in the tenant, and tests assert that behavior.

### Finding 4: user_org_unit_access is the canonical derived branch/org access projection.

**Evidence:** `supabase/migrations/20260914_create_user_org_unit_access_projection.sql:17-119`

**Detail:** The view derives access from Auth User -> Person -> Org Relationship -> Org Unit and expands access to descendants. Admin/super_admin users receive all active org units in their tenant.

### Finding 5: org foundation RLS exists for tenant read and admin write.

**Evidence:** `supabase/migrations/20260914_repair_platform_org_people_rls.sql:10-176`

**Detail:** RLS is enabled on org_units, org_relationships, people_directory, and people_profiles. Authenticated users can read tenant-scoped rows; admin/super_admin can write tenant rows.

### Finding 6: Foundation People and Organization providers are partial for Staff -> Branch assignment.

**Evidence:** `src/foundation/people/SupabasePeopleProvider.ts:180-218`, `src/foundation/organization/SupabaseOrgProvider.ts:380-399`, `src/foundation/contracts/services.ts:209-236`

**Detail:** People can be registered and relationships can be inserted, but OrgRelationship type lacks tenantId while SupabaseOrgProvider tries to read tenantId through a cast and defaults to an empty string. This is not a safe reusable assignment command for Beauty Chain Management as-is.

### Finding 7: Beauty has partial branch-aware runtime consumers, not chain management.

**Evidence:** `src/services/beauty-branch-context.ts:95-178`, `supabase/migrations/20261004010000_add_branch_id_to_attendance.sql:1-43`, `supabase/migrations/20261004020000_add_branch_id_to_salary_records.sql:1-41`, `supabase/migrations/20261004030000_add_branch_id_to_commission_sources.sql:1-90`

**Detail:** Beauty can resolve a single staff branch from people_directory/org_relationships and writes branch_id to some operational records. This proves partial runtime consumption, not tenant-side Company/Branch/Staff management.

### Finding 8: Real DB Beauty branch tests seed Platform rows directly.

**Evidence:** `src/__tests__/beauty-v2-attendance-branch-real-db.test.ts:181-228`, `src/__tests__/beauty-v2-attendance-branch-real-db.test.ts:245-302`, `src/__tests__/beauty-v2-commission-branch-real-db.test.ts:458-630`

**Detail:** Tests manually insert org_units, people_directory, and org_relationships, then verify branch-aware attendance/commission behavior. They do not prove tenant owner UI/API creates or manages the chain.

### Finding 9: Haircut shows a stronger DB enforcement pattern through user_org_unit_access.

**Evidence:** `supabase/migrations/20261005090000_haircut_branch_chain_adoption.sql:87-164`, `src/core/services/order/haircut-branch-context.ts:70-136`

**Detail:** Haircut has a product-specific branch access function and restrictive policies tied to user_org_unit_access, plus service-level branch context resolution. This is a reusable pattern, not direct proof for Beauty V2.

## Deduced Conclusions

### Deduction 1: Platform schema is sufficient for the data model; Beauty should not create chain tables.

**Based on:** Findings 1, 4, and 5.

**Reasoning:** org_units models company/region/branch, org_relationships models person-to-unit membership, people_directory maps users to persons, and user_org_unit_access derives branch access.

**Conclusion:** Beauty V2 should consume Platform primitives and add product UX/API/policy, not create beauty_chain or beauty_branch tables.

### Deduction 2: Existing contract is not fully READY_TO_IMPLEMENT without a small staff-assignment API decision.

**Based on:** Findings 3 and 6.

**Reasoning:** The DB primitives exist, but the safe public/service-level command for creating Person -> Branch relationships is not cleanly proven. A Beauty API could write directly under admin RLS, but that would weaken the “consume contract” boundary unless intentionally wrapped.

**Conclusion:** Minimal hardening should be at the service/API boundary for staff assignment, not a new DB model.

### Deduction 3: Beauty V2 runtime integration remains partial.

**Based on:** Findings 7, 8, and 9.

**Reasoning:** Beauty branch-aware writes exist in selected modules, but DB-level branch authorization comparable to Haircut is not broadly proven for Beauty V2 operational tables.

**Conclusion:** PR 3 still needs branch context and Real DB E2E before claiming BEAUTY_V2_TENANT_CHAIN = PROVEN.

## Hypothesized Paths

### Hypothesis 1: Platform org unit lifecycle is enough for Company and Branch, but staff/access management is not fully wrapped by a public Platform service.

**Status:** Confirmed

**Theory:** org_units can represent company/region/branch, while people_directory/org_relationships/user_org_unit_access may require direct SQL or product-specific wrappers unless an existing service already covers it.

**Supporting indicators:** org-unit contract explicitly excludes membership management and permission checks.

**Would confirm:** No reusable service/API exists for person -> branch assignment and access grants.

**Would refute:** Existing public service/API provides staff person creation, org_relationship assignment, and access projection usage.

**Resolution:** Confirmed by org-unit non-goals, getUserAccessibleUnits TODO, and SupabaseOrgProvider.createRelationship tenant_id handling.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Full RLS/projection read | Determines whether branch access can be enforced without platform changes. | Inspect user_org_unit_access and RLS migrations. |
| Existing person/relationship service map | Determines whether PR 2 needs only Beauty API/UI or a small shared service. | Completed; service layer is partial. |
| Beauty runtime consumer map | Determines PR 3 runtime scope. | Completed; runtime is partial. |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Error origin | N/A; exploration audit. |
| Trigger | User requested contract sufficiency audit before code implementation. |
| Condition | Beauty V2 Tenant Chain Management remains NOT_PROVEN. |
| Related files | src/platform/org-unit/*, supabase/migrations/*org*, src/foundation/*, src/services/beauty-branch-context.ts |

## Conclusion

**Confidence:** Medium

The existing Platform DB contract is sufficient for the canonical chain data model: Company/Region/Branch in org_units, Staff/Person in people_directory, Staff -> Branch in org_relationships, and derived Branch Access in user_org_unit_access. However, the reusable service/API layer for staff assignment is partial, and Beauty V2 tenant-side UI/API plus full runtime DB enforcement remain NOT_PROVEN. Decision: NOT_PROVEN for complete chain capability, but READY_TO_IMPLEMENT for a minimal Beauty Chain Management PR that consumes Platform primitives and includes a small staff-assignment boundary hardening.

## Recommended Next Steps

### Fix direction

Do not change HQ and do not create Beauty-specific chain tables. Implement a Beauty tenant-side Chain Management service/API/UI over Platform org_units and a deliberate staff-assignment command that writes people_directory/org_relationships safely.

### Diagnostic

Verify PR 2 with service/unit tests for create company, create branch, create person if needed, assign staff to branch, and read user_org_unit_access. Verify PR 3 with Real DB E2E for branch-scoped Beauty runtime.

## Reproduction Plan

For implementation verification: create tenant -> create company -> create branch A/B -> create staff/person -> assign staff to branch A -> resolve user_org_unit_access -> perform Beauty runtime write with branch A -> deny branch B -> DB read-back.

## Side Findings

- English Center branch CRUD wraps Platform orgUnitEngine for branch lifecycle, but teacher branch assignment uses product-specific english_center_teacher_branches rather than the shared people/org_relationship access model.
