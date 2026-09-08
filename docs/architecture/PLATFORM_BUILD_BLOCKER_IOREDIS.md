# Platform Build Blocker — ioredis/Turbopack Resolution

**Status:** 🔴 OPEN  
**Severity:** Platform-wide production build failure  
**Scope:** Unrelated to Bella Preschool P3.1  
**Created:** 2026-09-07

---

## Symptom

Production build fails with:

```
Error: Failed to load external module ioredis-23a6225d3f8c0bff: Error: Cannot find module 'ioredis-23a6225d3f8c0bff'
```

**Affected routes:**
- `/api/admin/partners/[id]/activity`
- `/api/admin/partners/[id]/activity/export`
- `/api/admin/partners/[id]/key-lifecycle`
- `/api/admin/partners/[id]/logs`
- `/api/intelligence/admin/clear-cache`
- `/api/intelligence/executive/customer-metrics`

**Source:** `src/services/intelligence/cache/index.ts`

---

## Evidence

**Dependency verification:**
```bash
npm list ioredis
# bella-spa-erp@0.1.0
# └── ioredis@5.11.1
```

✅ `ioredis@5.11.1` installed

**Build attempts:**
1. Initial build: FAIL (ioredis module not found)
2. Cache clear + rebuild: FAIL (same error)

**TypeScript check:**
```bash
npm run type-check
# Timeout >120s (separate issue, similar to Logistics HOTSPOT)
```

---

## Root Cause Hypothesis

**Turbopack external module resolution failure** for `ioredis`.

Turbopack generates mangled module ID `ioredis-23a6225d3f8c0bff` but fails to resolve it at runtime.

**Related config:**
```ts
// next.config.ts
experimental: {
  turbo: { ... } // ⚠️ Invalid experimental key warning
}
```

---

## Impact Assessment

**Blocked:**
- ❌ Production build (`npm run build`)
- ❌ Full Platform build verification

**NOT blocked:**
- ✅ Dev server (`npm run dev`)
- ✅ Runtime verification (uses different bundler)
- ✅ P3.1 behavioral testing

**Scope isolation:**
- Intelligence services affected (`src/services/intelligence/`)
- Preschool product unaffected (no intelligence dependency)

---

## Remediation Options

### Option A: Fix Turbopack config
- Investigate `next.config.ts` experimental.turbo settings
- Add ioredis to external/serverComponentsExternalPackages
- Verify Turbopack compatibility with ioredis native bindings

### Option B: Disable Turbopack temporarily
- Use webpack for production builds
- Test if issue persists

### Option C: Upgrade Next.js/Turbopack
- Check if later version resolves module resolution
- Verify breaking changes

### Option D: Investigate ioredis import pattern
- Check if dynamic imports cause resolution issue
- Review `src/services/intelligence/cache/index.ts` import strategy

---

## Decision

**DEFER investigation until P3.1 runtime verification complete.**

Rationale:
- Unrelated to Preschool implementation
- P3.1 can verify behavior via dev mode
- Mixing build infrastructure fix with P3.1 behavioral verification conflates two failure domains

**Next:** Revisit after P3.1 behavioral evidence collected.

---

## Related Issues

- TypeScript check timeout (>120s) — similar to Logistics HOTSPOT
- Turbopack experimental config warning

---

**Owner:** Platform Infrastructure  
**Tracking:** docs/architecture/PLATFORM_BUILD_BLOCKER_IOREDIS.md
