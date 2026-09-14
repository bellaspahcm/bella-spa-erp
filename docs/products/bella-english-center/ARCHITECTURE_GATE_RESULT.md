# Bella English Center E2/E3/E4 Branch Access Architecture Gate Result

**Date:** 2026-09-14
**Status:** GOVERNANCE ACCEPTED / BOUNDED SEALED
**Scope:** Resolve E2/E3/E4 branch-access blocker before any E5 work.

---

## 1. Product Manifest

Bella English Center E2/E3/E4 capabilities:

- E2: English Center enrollment extension linked to canonical `edu_enrollments`.
- E3: English Center programs, courses, and classes.
- E4: English Center teacher workforce and branch assignment.

Historical release state before branch-access repair:

```text
Implementation                  MERGED
Canonical FK references         MOSTLY CONFIRMED
Runtime DB shape                PARTIALLY APPLIED
Tenant isolation                PRESENT
Branch isolation primitive      MISSING / UNPROVEN
Runtime branch isolation        NOT VERIFIED

Seal                            NOT ALLOWED
E5                              HOLD
```

Current accepted state:

```text
Branch-access architecture       RESOLVED
Platform projection              IMPLEMENTED
E2/E3/E4 branch-aware RLS        APPLIED
Runtime branch isolation         PASS
Targeted tests                   33/33 PASS
Platform Architecture Guard      PASS
Education violations delta       0
Attribution unknown              0
Governance acceptance            ACCEPTED

Seal                             BOUNDED VERIFIED + SEALED
E5                               UNBLOCKED after commit, PR, CI, and main merge
```

This gate is limited to the missing Platform branch-access primitive and the dependent E2/E3/E4 RLS repair.

---

## 2. Ownership Map

| Data / Capability | Owner | Decision |
| --- | --- | --- |
| `org_units` | Platform Org Unit | Canonical organization and branch graph nodes. |
| `org_relationships` | Platform Org Unit | Source of truth for Person/User to Org Unit relationships. |
| `people_directory.user_id` | Platform People Directory | Canonical Auth User to Person bridge. |
| `users.role` | Platform Authorization / IAM | Tenant admin and super admin role source. |
| `user_org_unit_access` | Platform Authorization projection | Derived read model only; not an English Center product table. |
| `english_center_enrollments` | English Center Product | Product extension data; must consume Platform branch-access primitive. |
| `english_center_programs/courses/classes` | English Center Product | Product catalog and class data; must consume Platform branch-access primitive. |
| `english_center_teachers/teacher_branches` | English Center Product | Product teacher extension and assignments; must consume Platform branch-access primitive. |

---

## 3. Contract Dependency Map

```text
English Center Product
  -> Education OS public contracts
  -> Platform canonical tables:
       edu_enrollments
       party_parties
       org_units
       tenants
  -> Platform Authorization projection:
       user_org_unit_access
  -> Platform source-of-truth tables:
       people_directory
       org_relationships
       users
```

No Education Kernel or Healthcare Kernel files are modified by this gate.

---

## 4. Additive Migration Plan

Add a Platform-owned projection migration:

- Repair tenant-scoped RLS policies on `org_units`, `org_relationships`,
  `people_directory`, and `people_profiles` if the live environment is missing
  the policies required by a `security_invoker` projection.
- Create `public.user_org_unit_access` as a derived view.
- Source direct access from `people_directory` + `org_relationships`.
- Include descendant org units through `org_units.parent_id`.
- Include tenant-wide admin/super_admin rows from `users.role`.
- Grant read access to `authenticated` and `service_role`.

Repair E2/E3/E4 RLS:

- E2 enrollments: restore branch-scope enforcement through `user_org_unit_access`.
- E3 programs/classes: enforce branch scope through `user_org_unit_access`; courses inherit scope from program.
- E4 teacher branches: enforce branch scope through `user_org_unit_access`; teachers inherit scope from teacher branch assignments.

No product-owned authorization table may be created.

---

## 5. 11 Automated Verification Gates Plan

| Gate | Status Before Fix | Required Evidence |
| --- | --- | --- |
| 1. Architecture Compliance | Pending rerun | No frozen Education/Healthcare kernel modification. |
| 2. Contract Boundary | Pending rerun | Product consumes Platform primitive; no direct Kernel bypass. |
| 3. Tenant Isolation | Partial | Runtime Tenant A vs Tenant B DB/API proof. |
| 4. RLS & Authorization | Blocked | Branch A user blocked from Branch B rows. |
| 5. Database Migration Safety | Pending | Additive Platform projection and policy repair only. |
| 6. Event-After-Persistence | Pending | No event behavior changed by this gate. |
| 7. Academic Safety Routing | Pending | No bypass introduced. |
| 8. Temporal Provenance | Pending | No temporal mutation introduced. |
| 9. Rule Governance | Pending | No rule bypass introduced. |
| 10. Audit Evidence Integrity | Pending | No audit degradation introduced. |
| 11. Platform Regression | Pending | `npm run education:verify`; broader gates as required. |

---

## Gate Decision

`ARCHITECTURAL GAP DETECTED` is resolved by the Human Architect direction:

```text
org_relationships = source of truth
user_org_unit_access = Platform projection/view for authorization and RLS
```

E2/E3/E4 are bounded verified + sealed by governance acceptance. The bounded
seal accepts `DEBT-EDU-ARCH-01` and `DEBT-MIG-HISTORY-01` as governed debt /
accepted risk, without claiming full `education:verify` PASS or full
migration-history integrity.
