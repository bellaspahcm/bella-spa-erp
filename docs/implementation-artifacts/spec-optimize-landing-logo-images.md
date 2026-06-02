---
title: 'Optimize landing logo images'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Optimize landing logo images

## Intent

Problem: The landing page still rendered local logo assets with raw `<img>` tags, leaving `@next/next/no-img-element` warnings and missing intrinsic sizing from Next image optimization.

Approach: Import `Image` from `next/image` and replace the two `/logo.png` usages in the header and footer with fixed intrinsic `width`/`height` values while preserving the existing Tailwind sizing and object-fit classes.

## Suggested Review Order

1. [`../../src/app/page.tsx`](../../src/app/page.tsx) - Verify the two logo image replacements keep the same rendered size and remove raw `<img>` usage.
2. [`spec-optimize-landing-logo-images.md`](spec-optimize-landing-logo-images.md) - Confirm this artifact matches the implemented scope and verification.

## Review Notes

Adversarial review finding handled: `next/image` requires intrinsic sizing for non-`fill` local path usage, so the header logo uses `32x32` and footer logo uses `28x28`, matching the existing `w-8 h-8` and `w-7 h-7` classes.

Deferred: None.

Rejected: No behavior-changing issue found; the change is a mechanical replacement of two local logo elements.

## Verification

- `npm.cmd run lint -- src/app/page.tsx` passed with no warnings.
- `npm.cmd test -- src/__tests__/public-promotions-ui.test.ts --runInBand` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
