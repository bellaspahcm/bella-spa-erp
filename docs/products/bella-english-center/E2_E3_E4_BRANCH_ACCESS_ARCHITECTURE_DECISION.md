# E2/E3/E4 Branch Access Architecture Decision

**Date:** 2026-09-14
**Status:** IMPLEMENTED / GOVERNANCE ACCEPTED
**Decision Owner:** Human Architect
**Capability Owner:** Platform Org Unit / Authorization

---

## Decision

Use `org_relationships` as the source of truth for User to Org Unit access.

Create `public.user_org_unit_access` as a Platform-owned projection view for RLS and authorization checks. The projection is derived from:

- `people_directory.user_id` as the Auth User to Person bridge.
- `org_relationships` as the Person to Org Unit relationship graph.
- `org_units.parent_id` for descendant branch/unit expansion.
- `users.role` for tenant admin and super_admin tenant-wide access.

English Center must consume this projection. It must not own or create a separate branch-access table.

---

## Rationale

Branch access is a Platform capability because it must be shared across products. If each product creates its own permission table, branch authorization can drift between English Center, Education, Spa, Real Estate, Healthcare, Finance, and Logistics.

`org_relationships` already owns the organization graph. `user_org_unit_access` is only a derived read model that makes RLS policies simple, testable, and consistent.

---

## RLS Usage

E2/E3/E4 RLS policies must check:

```sql
branch_id IN (
  SELECT org_unit_id
  FROM public.user_org_unit_access
  WHERE user_id = <current user>
    AND tenant_id = <current tenant>
)
```

Tables without a direct `branch_id` must inherit branch scope from their parent product table or assignment table.

---

## Boundaries

Tenant boundary:

- Every row remains constrained by `tenant_id`.
- The projection emits access rows only inside the source tenant.

Branch boundary:

- Direct person-to-unit relationships grant access to that org unit.
- Parent-unit relationships grant access to descendant org units.
- Tenant admins and super_admins receive tenant-wide org unit access.

Ownership boundary:

- Platform owns access resolution.
- English Center owns only product extension data.
- Education Kernel remains frozen.
- Healthcare Kernel remains untouched.

---

## Follow-up Requirement Status

Fulfilled:

- The projection migration applies cleanly.
- E2/E3/E4 RLS policies are repaired.
- Targeted English Center tests pass: 33/33.
- Runtime branch isolation is proven.
- Governance accepts bounded seal with `DEBT-EDU-ARCH-01` and
  `DEBT-MIG-HISTORY-01` recorded as governed debt / accepted risk.

Accepted state:

```text
E2/E3/E4      BOUNDED VERIFIED + SEALED
E5            UNBLOCKED after commit, PR, CI, and main merge
```
