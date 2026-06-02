---
title: 'Type landing package data'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Type landing package data

## Intent

Problem: Landing page package/category rendering still used loose `any` types and unstable object dependencies, leaving ESLint hook warnings and weaker compile-time coverage around service package data.

Approach: Model landing package categories with explicit `LandingCategoryKey`, `LandingCategories`, and Supabase `packages` row types; memoize the default category catalog; clone category data without mutating shared objects; remove unused icon imports and untyped package/benefit maps.

## Suggested Review Order

1. [`../../src/app/page.tsx`](../../src/app/page.tsx) - Check the landing package type model, default catalog memoization, Supabase package mapping, and rendered card loops.
2. [`spec-type-landing-packages.md`](spec-type-landing-packages.md) - Confirm this artifact matches the implemented scope and verification.

## Review Notes

Adversarial review finding handled: `Record<string, LandingCategory>` was too broad, so it was tightened to `Record<LandingCategoryKey, LandingCategory>` with explicit clone coverage for all four landing tabs.

Deferred: Existing `@next/next/no-img-element` warnings remain at two landing image locations; they are unrelated to the package typing refactor and should be handled in a separate image optimization pass.

Rejected: No behavior-changing issue found in the package typing diff after lint, Jest, and TypeScript verification.

## Verification

- `npm.cmd run lint -- src/app/page.tsx src/__tests__/public-promotions-ui.test.ts src/lib/promotions.ts` passed with two pre-existing `<img>` warnings in `src/app/page.tsx`.
- `npm.cmd test -- src/__tests__/public-promotions-ui.test.ts --runInBand` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
