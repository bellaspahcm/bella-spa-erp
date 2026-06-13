---
title: 'Student Training Foundation'
type: 'feature'
created: '2026-06-13'
status: 'done'
context:
  - docs/plans/student-training-expansion-plan.html
  - docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The student training expansion plan defines a new learner-facing module for Bella Spa and Beauty Spa, but the app has no safe foundation for training data, student routing, or admin navigation. Implementing the whole plan at once would mix schema, portal, tuition, attendance, and lesson playback in one risky release.

**Approach:** Ship the Phase 1 foundation: add tenant-scoped training schema/RLS, recognize `student_training` as an enabled module, route students away from operational dashboards, and expose a first admin Training shell without client-side tenant-sensitive queries.

## Boundaries & Constraints

**Always:** Training data must be tenant-scoped. Student users must not gain access to operational dashboard, KTV, finance, customer, salary, inventory, booking, or accounting surfaces. Admin-facing Training UI must read no tenant-sensitive tables directly from the browser in this slice.

**Ask First:** Applying migrations to remote Supabase, creating real student accounts, recording tuition payments as revenue/accounting events, or implementing video heartbeat/progress writes beyond schema.

**Never:** Do not write directly to accounting ledgers for tuition. Do not weaken existing Bella/Beauty tenant module isolation or default a non-resolved tenant to Bella/Babycare.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Student route isolation | Logged-in user role is `student` and requests `/dashboard/*` or `/ktv/*` | Redirect to `/student/dashboard` before page render | If unauthenticated, redirect to login for protected student/dashboard/KTV routes |
| Staff route isolation | Logged-in non-student staff requests `/student/*` | Redirect to `/dashboard` or `/ktv/dashboard` based on role | Missing role stays on protected auth flow without granting student access |
| Admin training shell | Admin opens `/dashboard/training` | Sidebar highlights Training and page shows Phase 1 admin workspace | Page must not query training tables from client |

</frozen-after-approval>

## Code Map

- `docs/plans/student-training-expansion-plan.html` -- product plan: schema, RLS, portal/admin routes, phased rollout.
- `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` -- required guardrails for tenant/module/brand/schema/RLS changes.
- `src/lib/business-rules/tenant-modules.ts` -- tenant module registry, defaults, brand parsing.
- `src/lib/business-rules/permissions.ts` -- centralized sidebar access module ids and role denials.
- `src/components/layout/sidebar.tsx` -- dashboard navigation and tenant module runtime parser.
- `src/proxy.ts` -- Next.js 16 proxy auth/session routing.
- `supabase/migrations/*` -- schema/RLS migrations.
- `src/__tests__/platform-rule-engines.test.ts` and `src/__tests__/tenant-isolation-source-guards.test.ts` -- existing guard tests for module and tenant isolation.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260613100000_create_student_training_foundation.sql` -- create 8 training tables with tenant/module checks, indexes, RLS, grants, and helper policies -- foundation for future server actions.
- [x] `src/lib/business-rules/tenant-modules.ts` -- add `student_training` to normalized enabled modules without making it the default business module -- lets tenants enable training as an add-on.
- [x] `src/proxy.ts` -- include `/student/*` in protected matcher and redirect student/staff roles safely -- enforces portal separation before page render.
- [x] `src/components/layout/sidebar.tsx` and `src/lib/business-rules/permissions.ts` -- add Training admin nav and role/module id mapping -- makes admin entry discoverable.
- [x] `src/app/dashboard/training/page.tsx` -- add static Phase 1 admin shell -- no client direct database reads.
- [x] Tests -- update source/rule guards for module normalization, route isolation strings, and no direct client training queries.

**Acceptance Criteria:**
- Given a tenant config with `student_training: true`, when module normalization runs, then the flag is preserved while `babycare`/`beauty_spa` still determine the primary business module.
- Given a student role opens `/dashboard/*`, when proxy evaluates the request, then the code redirects to `/student/dashboard`.
- Given staff opens `/student/*`, when proxy evaluates the request, then the code redirects away from the student portal.
- Given the Training admin shell is rendered, when source guard scans it, then it contains no browser Supabase `.from('students'|'courses'|...)` queries.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/platform-rule-engines.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
