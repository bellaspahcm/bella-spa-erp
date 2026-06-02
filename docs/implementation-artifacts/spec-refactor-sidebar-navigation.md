---
title: 'Refactor sidebar navigation'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Refactor sidebar navigation

## Intent

Problem: Shared dashboard sidebar had lint warnings for loose `any` menu/user state, synchronous `setState` inside a pathname effect, and raw logo `<img>` elements.

Approach: Add explicit sidebar menu unions and `CurrentUser`/permission typing, close the mobile drawer from navigation click handlers instead of a pathname effect, and replace sidebar logos with `next/image` using intrinsic dimensions.

## Suggested Review Order

1. [`../../src/components/layout/sidebar.tsx`](../../src/components/layout/sidebar.tsx) - Verify typed menu filtering, mobile drawer close behavior, and logo image replacements.
2. [`spec-refactor-sidebar-navigation.md`](spec-refactor-sidebar-navigation.md) - Confirm artifact scope and verification.

## Review Notes

Adversarial review finding handled: removing the pathname effect can only preserve auto-close if all sidebar navigation links close the drawer explicitly, so `handleNavigation` is attached to both dashboard logo and menu item links.

Deferred: None.

Rejected: No behavior-changing menu permission issue found; filtering rules and role fallbacks remain unchanged.

## Verification

- `npm.cmd run lint -- src/components/layout/sidebar.tsx` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
