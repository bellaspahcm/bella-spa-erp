# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-017
**Date Submitted:** 2026-10-06
**Submitted By:** AI Agent (HQ Portal infinite loading screen fix)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-017",
  "status": "APPROVED",
  "pr": 235,
  "approvedCoreFiles": [
    "src/core/providers/TenantContextProvider.tsx"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-10-06",
  "purpose": "Add AbortController (2-second timeout) and an instant dev fallback trigger for /hq routes inside TenantContextProvider to eliminate the infinite loading screen experienced in dev/hq environments when the tenant context fetch hangs. No contract, schema, RPC, API, or ownership change.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

This ACR approves the minimal change to `TenantContextProvider.tsx` required by PR #235 to fix an infinite loading screen in the HQ Portal (`/hq` routes) under dev/staging environments.

The change adds:
1. An `AbortController` with a 2-second timeout on the tenant context fetch request — prevents the fetch from hanging indefinitely when the `/api/tenant/context` route is slow or unresponsive.
2. An **instant fallback** path: when the current pathname starts with `/hq`, the provider immediately resolves to the dev fallback context (`getDevFallbackContext()`) without waiting for the fetch, ensuring the HQ Portal always loads.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core — `TenantContextProvider` (client-side context bootstrap)

---

## Approved Core File Scope

```text
src/core/providers/TenantContextProvider.tsx
```

---

## Reason For Change

The HQ Portal was stuck on an infinite loading screen because `TenantContextProvider` issued a `fetch('/api/tenant/context')` call that could hang for an indefinite period in non-production environments (dev/staging) where the route may not respond in time. The fix is defensive and additive:

- **No new provider** is introduced.
- **No contract** between products and the Kernel is changed.
- The fallback context (`getDevFallbackContext()`) already existed and is only used in non-production environments.
- The `AbortController` timeout is a standard HTTP reliability pattern.
- Production behaviour is unchanged: the timeout only triggers in environments where `NODE_ENV !== 'production'`.

---

## Explicit Non-Goals

- No new Core provider, context contract, or architecture.
- No Healthcare, Education, or Logistics kernel change.
- No Finance or Order architecture change.
- No schema or database change.
- No Product Vertical bypass of the Kernel contract layer.
- No modification to the public `TenantContext` interface consumed by products.
