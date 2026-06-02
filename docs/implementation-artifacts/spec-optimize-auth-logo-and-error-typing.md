---
title: 'Optimize auth logo and error typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Optimize auth logo and error typing

## Intent

Problem: Auth login/signup pages still used raw logo `<img>` tags, login imported an unused icon, and signup used `catch (err: any)` for submit failures.

Approach: Replace the auth logo elements with `next/image` using intrinsic dimensions, remove the unused login icon import, and convert signup error handling to `unknown` with a small message extractor.

## Suggested Review Order

1. [`../../src/app/(auth)/login/page.tsx`](../../src/app/(auth)/login/page.tsx) - Verify logo rendering size and removed unused import.
2. [`../../src/app/(auth)/signup/page.tsx`](../../src/app/(auth)/signup/page.tsx) - Verify logo rendering size and unknown error handling.
3. [`spec-optimize-auth-logo-and-error-typing.md`](spec-optimize-auth-logo-and-error-typing.md) - Confirm artifact scope and verification.

## Review Notes

Adversarial review finding handled: `next/image` non-fill usage needs intrinsic dimensions, so login uses `96x96` and signup uses `64x64`, matching the existing `h-24` and `h-16` visual sizing.

Deferred: None.

Rejected: No behavior-changing auth issue found; login and signup flows remain unchanged.

## Verification

- `npm.cmd run lint -- 'src/app/(auth)/login/page.tsx' 'src/app/(auth)/signup/page.tsx'` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
