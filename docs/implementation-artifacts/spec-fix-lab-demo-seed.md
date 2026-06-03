---
title: 'Fix Lab Demo Seed'
type: 'fix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'edeff36c7549cee63b91be541e725921795f15c5'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/supabase/seed.sql'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The lab Supabase database schema requires `bookings.package_id`, but `supabase/seed.sql` still inserted demo bookings without package linkage. Running the seed failed with a `bookings.package_id` not-null violation, leaving the lab project without reliable demo data.

**Approach:** Make the seed deterministic and schema-aligned. Create the package catalog first, attach each demo booking to a package, and clean demo side-effect rows before reinserting revenue, expenses, salary, KPI, and session logs so the seed can be run repeatedly without duplicate operational rows.

## Boundaries & Constraints

**Always:** Keep this change limited to lab/demo seed data. Preserve the existing tenant, staff, customer, booking, finance, salary, KPI, and session-log coverage. Ensure booking rows always have non-null `package_id` and `package_name`. Ensure package rows include `session_multiplier` values aligned with salary multiplier rules.

**Ask First:** Stop before changing migrations, production schema, RLS policies, Supabase project linkage, Vercel configuration, or application code.

**Never:** Do not write secrets to the repo. Do not point the lab worktree at the production Supabase project. Do not hide SQL execution errors.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Empty lab database | Seed runs after migrations | Creates tenant, 7 users, 3 packages, 20 customers, 20 bookings, 25 revenue rows, 4 expenses, 5 salary records, 5 KPI records, 30 session logs | Any SQL failure aborts the DO block |
| Existing demo bookings | Seed runs again | Reuses/upserts bookings and recreates demo side-effect rows without duplicates | Cleanup happens before reinserting dependent rows |
| Booking package requirement | `bookings.package_id` is `NOT NULL` | Every `BK-2026-%` booking receives a valid package id | Verification checks zero missing package ids |
| Salary multiplier assumptions | Salary/reporting logic joins bookings to packages | Demo packages include 1.0, 1.5, and 2.0 `session_multiplier` values | Package upsert updates stale multiplier values |

</frozen-after-approval>

## Code Map

- `supabase/seed.sql` -- deterministic lab/demo seed data and package-linked bookings.
- `supabase/migrations/20260515010000_the_great_purge.sql` -- migration that makes `bookings.package_id` required.
- `supabase/migrations/20260530030000_add_session_multiplier_to_packages.sql` -- salary multiplier rule that expects package coefficients.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/seed.sql` -- insert/update demo packages before bookings.
- [x] `supabase/seed.sql` -- attach every demo booking to a package with `package_id`, `package_name`, total sessions, and KTV commission.
- [x] `supabase/seed.sql` -- cleanup demo side-effect rows before reinserting revenue, expenses, salary records, KPI records, and session logs.
- [x] Supabase lab -- run seed twice against linked lab project and confirm counts remain stable.

**Acceptance Criteria:**
- Given the lab database has migrations applied, when `supabase/seed.sql` runs, then it completes without `bookings.package_id` errors.
- Given the seed runs twice, when demo counts are queried, then counts stay stable rather than doubling.
- Given demo bookings are queried, when checking package linkage, then zero `BK-2026-%` rows have `package_id IS NULL`.

## Verification

**Commands:**
- `git diff --check` -- passed.
- `npx.cmd supabase db query --linked --file supabase\seed.sql` -- passed.
- `npx.cmd supabase db query --linked --file supabase\seed.sql` -- passed on second run.
- `npx.cmd supabase db query --linked --output json "<demo counts query>"` -- passed; stable counts after second run.

**Verified Counts After Second Seed Run:**
- Demo tenants: 1
- Demo users: 7
- Demo packages: 3
- Demo customers: 20
- Demo bookings: 20
- Bookings missing package: 0
- Demo revenue rows: 25
- Demo expenses: 4
- Demo salary records: 5
- Demo KPI records: 5
- Demo session logs: 30

## Review Notes

- The change is seed-only and does not alter schema, app code, Vercel env, or Supabase linkage.
- SQL failures are not swallowed: the seed runs inside one `DO` block and aborts on any failing statement.
- Demo side-effect cleanup is scoped to the lab/demo tenant and deterministic identifiers (`BK-2026-%`, fixed descriptions, fixed salary/KPI month).
- Multi-agent review was not spawned because the current tool contract only allows sub-agents when the user explicitly requests delegation.

## Suggested Review Order

**Seed Flow**

- Package catalog is created before bookings.
  [`seed.sql:72`](../../supabase/seed.sql#L72)

- Demo side effects are cleaned before reinsertion.
  [`seed.sql:156`](../../supabase/seed.sql#L156)

- Bookings include required package linkage.
  [`seed.sql:202`](../../supabase/seed.sql#L202)

**Verification**

- Artifact records repeatable seed verification and stable counts.
  [`spec-fix-lab-demo-seed.md:58`](./spec-fix-lab-demo-seed.md#L58)
