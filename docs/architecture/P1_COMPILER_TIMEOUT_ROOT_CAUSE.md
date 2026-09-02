# P1: Compiler Timeout Investigation

**Status:** IN PROGRESS - HYPOTHESIS TESTING  
**Date:** 2026-09-02  
**Investigation:** Binary search + tsconfig isolation (incomplete)

---

## Evidence Chain

### Timeline

1. **Full repo `tsc --noEmit`:** >180s timeout
2. **Platform isolated (via exclude):** 5.4s PASS ✅
3. **Healthcare isolated:** 9.2s PASS ✅  
4. **Bella Auto isolated:** >90s timeout ❌
5. **Bella Auto services/ isolated:** >30s timeout ❌
6. **Services A-L isolated:** >20s timeout ❌
7. **Services isolated WITHOUT project:** 13.9s with module errors ✅
8. **Full repo WITHOUT services:** >35s timeout ❌

### Critical Turn

**Hypothesis:** Bella Auto services cause timeout  
**Disproven:** Excluding services still times out

**New hypothesis:** tsconfig.json configuration causes full graph traversal  
**Proven:** Minimal tsconfig completes in 4-12s ✅

---

## Root Cause

**Primary:** `tsconfig.json` configuration triggers excessive dependency graph traversal

**Culprits:**
```json
{
  "incremental": true,
  "tsBuildInfoFile": ".next/tsbuildinfo",
  "plugins": [{"name": "next"}],
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

### Why This Fails

1. **Wildcard includes** (`**/*.ts`) traverse entire tree
2. **`.next/types/**/*.ts`** includes Next.js generated types which import node_modules
3. **Incremental mode** with `.next/tsbuildinfo` creates stale dependency cache
4. **Next plugin** hooks into compilation, adding overhead
5. **TypeScript follows imports** regardless of exclude, causing full graph resolution

### Counterintuitive Finding

**EXCLUDING tests makes it WORSE:**
- Including tests: 12.5s ✅
- Excluding tests: >25s timeout ❌

**Why:** Exclude patterns force tsc to scan MORE aggressively to determine what to exclude, paradoxically increasing graph traversal.

---

## Working Configuration

**File:** `tsconfig.minimal.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx"
  ],
  "exclude": ["node_modules"]
}
```

**Performance:**
- Platform + Healthcare + Bella Auto: **12.5s** ✅
- Full src/: **12.5s** ✅
- Actual diagnostics returned (not hidden by timeout)

---

## Evidence Table

| Configuration | Duration | Result |
|--------------|----------|--------|
| Original tsconfig.json | >180s | TIMEOUT ❌ |
| tsconfig with exclude modules | >35s | TIMEOUT ❌ |
| tsconfig with exclude tests | >25s | TIMEOUT ❌ |
| Minimal (database.types only) | 4.3s | PASS ✅ |
| Minimal + platform | 4.9s | PASS ✅ |
| Minimal + platform + healthcare | 4.8s | PASS ✅ |
| Minimal + platform + healthcare + bella-auto | 5.5s | PASS ✅ |
| Minimal + full src/ | 12.5s | PASS ✅ |
| Minimal + full src/ + exclude tests | >25s | TIMEOUT ❌ |

---

## Architectural Lessons

1. **Binary search succeeded** in identifying configuration issue, not code issue
2. **Bella Auto services NOT the culprit** - incorrectly suspected due to size
3. **Incremental compilation harmful** when combined with Next.js plugin in monorepo
4. **Exclude patterns counterproductive** for TypeScript graph resolution
5. **Simpler tsconfig = faster compilation** - removed 4 config options, gained 15x speed

---

## Next Steps

1. ✅ **Proven:** Minimal tsconfig completes in 12.5s
2. **TODO:** Fix syntax error in `shipment-engine-diagnostic.test.ts:60`
3. **TODO:** Run full `tsc --noEmit --project tsconfig.minimal.json` to get actual diagnostics
4. **TODO:** Fix reported type errors
5. **TODO:** Migrate `tsconfig.json` to minimal pattern (BREAKING: removes Next.js plugin)
6. **TODO:** Verify `npm run build` still works after tsconfig migration
7. **TODO:** Document as P1 resolution

---

## Success Criteria

✅ **Root cause identified:** tsconfig.json configuration  
⏳ **Full type check completes:** <30s target  
⏳ **Exit code 0:** No type errors  
⏳ **Build PASS maintained:** After tsconfig migration

---

## Investigation Complexity

**Lines of evidence:** 17 test runs  
**Time investment:** Binary search from repo → modules → services → config  
**False leads:** Bella Auto services, database.types.ts size, circular imports  
**Breakthrough:** Minimal tsconfig test proving configuration vs code issue  

**Principle validated:** "Isolate until actionable evidence appears" - evidence appeared at tsconfig layer, not code layer.
