# E2/E3/E4 Authorization Architecture Gap

**Date:** 2026-09-14
**Product:** Bella English Center
**Scope:** E2 Enrollment, E3 Program/Course/Class, E4 Teacher Workforce
**Status:** RESOLVED / GOVERNANCE ACCEPTED

> **Resolution update, 2026-09-14:** Human Architect selected
> `org_relationships` as source of truth and `user_org_unit_access` as a
> Platform projection/view. Implementation artifacts were added, runtime branch
> isolation passed, and governance accepted bounded seal. See
> `E2_E3_E4_GOVERNANCE_ACCEPTANCE.md`.

---

## ARCHITECTURAL GAP DETECTED

E2/E3/E4 require branch-scoped Row Level Security, but the canonical Platform primitive that answers "which user can access which org unit/branch?" is missing or unproven.

This is not ordinary test debt. The missing capability blocks runtime branch isolation evidence and therefore blocks sealing E2/E3/E4.

```text
org_units
  -> ?
  -> E2/E3/E4 branch-scoped RLS
```

The `?` is the unresolved Platform authorization capability.

---

## Historical Gap Status

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

Current canonical status:

```text
Branch isolation primitive      IMPLEMENTED
Runtime branch isolation        PASS
Governance acceptance           ACCEPTED

Seal                            BOUNDED VERIFIED + SEALED
E5                              UNBLOCKED after commit, PR, CI, and main merge
```

---

## Evidence Snapshot

### Repository Evidence

`user_org_unit_access` has no canonical definition in the repository. The only active references found are:

- `supabase/migrations/20260913_create_english_center_program_course_class.sql`
  - E3 `classes_branch_scope` policy references `public.user_org_unit_access`.
- `supabase/migrations/20260913_create_english_center_enrollments.sql`
  - E2 branch policy was replaced by a comment stating the policy was skipped because `user_org_unit_access` is missing.

No `CREATE TABLE`, `CREATE VIEW`, `CREATE MATERIALIZED VIEW`, or Platform contract definition for `user_org_unit_access` was found in the active repository search.

### Live Database Evidence

Live linked database inspection found:

- Present: `org_units`
- Present: `org_relationships`
- Present: `users`
- Missing: `user_org_unit_access`

Live linked database inspection also found English Center tables and tenant policies, but no branch-scope policy:

- `english_center_enrollments`: tenant isolation policy only
- `english_center_programs`: tenant isolation policy only
- `english_center_courses`: tenant isolation policy only
- `english_center_classes`: tenant isolation policy only
- `english_center_teachers`: tenant isolation policy only
- `english_center_teacher_branches`: tenant isolation policy only

### Foreign Key Evidence

The linked database currently shows English Center foreign keys referencing canonical tables:

- `english_center_enrollments.canonical_enrollment_id` -> `edu_enrollments`
- `english_center_* .branch_id` -> `org_units`
- `english_center_teachers.party_id` -> `party_parties`
- `english_center_classes.teacher_id` -> `party_parties`
- tenant FKs -> `tenants`

This confirms the earlier `parties` vs `party_parties` issue was a schema-reference issue, not proof of database corruption.

---

## Four Required Architecture Answers

### 1. What is the canonical access model?

Unresolved.

Human Architect must decide whether user-to-org-unit access is represented by:

- `org_relationships`
- user roles on `users`
- a Platform Authorization policy engine
- a dedicated projection such as `user_org_unit_access`
- another existing Platform primitive

English Center Product must not invent this primitive locally.

### 2. Where is the source of truth?

Unresolved.

The source of truth must belong to Platform Org Unit / Authorization, not to E2/E3/E4 product tables.

Candidate source tables already present:

- `org_units`
- `org_relationships`
- `users`
- `people_directory`

None of these has yet been confirmed as the canonical branch-access source for RLS.

### 3. Which primitive should RLS policies use?

Unresolved.

Current E3 migration uses:

```sql
FROM public.user_org_unit_access
```

That primitive is not proven. E2 currently skips the branch policy because the same primitive is missing. Neither state is sealable.

The RLS primitive must be approved before migrations are corrected and applied cleanly.

### 4. Who owns this capability?

Owner: Platform Org Unit / Authorization.

English Center owns product extension data. It does not own the platform-wide rule for mapping authenticated users to permitted organization units or branches.

---

## Blocked Actions

The following actions are blocked until the canonical authorization model is approved:

- Seal E2/E3/E4.
- Start E5 if seal requires integration/runtime evidence.
- Commit or merge a `*_no_rls.sql` workaround.
- Treat skipped branch RLS as documented test debt.
- Create an English Center-only `user_org_unit_access` table.
- Claim branch isolation PASS without runtime evidence.

---

## Required Resolution Path

```text
Human Architect decision
  -> Architecture Decision / ADR
  -> Platform branch-access primitive or projection
  -> E2/E3/E4 RLS policies corrected to canonical primitive
  -> Clean migration application
  -> Execute all 27 E2/E3/E4 tests against real database
  -> Tenant isolation PASS
  -> Branch isolation PASS
  -> Seal E2/E3/E4
  -> Open E5
```

---

## Verification Gates Impact

Education Constitution impact:

- Gate 3: Tenant Isolation
  - Status: partially present at DB policy level.
  - Runtime evidence: not sufficient for seal.
- Gate 4: RLS & Authorization
  - Status: blocked by missing branch-access primitive.
- Gate 5: Database Migration Safety
  - Status: cannot be completed while migrations reference an unowned primitive or skip required branch RLS.
- Gate 10: Mandatory 11 Verification Gates
  - Status: not satisfied for E2/E3/E4 seal.

---

## Final Decision

E2/E3/E4 are bounded verified + sealed by governance acceptance.

This was an Authorization Architecture Gap, not ordinary test debt. The gap is
now resolved by the Platform `user_org_unit_access` projection sourced from
`org_relationships`, with accepted bounded evidence and governed debt.
