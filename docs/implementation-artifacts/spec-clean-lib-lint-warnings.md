---
title: 'Clean lib lint warnings'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Clean lib lint warnings

## Intent

Problem: Small shared lib files had avoidable lint warnings: unused cookie error bindings in the Supabase server client helper and an `any` parameter in `sanitizeTime`.

Approach: Keep the intentional Supabase cookie write ignore path but use `catch {}` instead of unused bindings, and change `sanitizeTime` input to `unknown` while preserving the existing falsy-value behavior.

## Suggested Review Order

1. [`../../src/lib/supabase-server.ts`](../../src/lib/supabase-server.ts) - Confirm ignored cookie write failures remain intentional and unchanged.
2. [`../../src/lib/utils.ts`](../../src/lib/utils.ts) - Confirm `sanitizeTime` keeps the same parsing behavior with stricter input typing.
3. [`spec-clean-lib-lint-warnings.md`](spec-clean-lib-lint-warnings.md) - Confirm artifact scope and verification.

## Verification

- `npm.cmd run lint -- src/lib/supabase-server.ts src/lib/utils.ts` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
