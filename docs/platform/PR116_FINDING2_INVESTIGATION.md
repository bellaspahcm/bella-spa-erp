# PR #116 Finding #2 Investigation: bootstrap.ts:40

**Status:** 🔴 BLOCKING PR #116 merge
**CI Verified:** NEW=1 persists after #1/#10 fixes @ a6198f9a

## Error

```
src/platform/bootstrap.ts:40: Argument of type 
'SupabaseClient<Record<string, unknown>, "public", "public", never, { PostgrestVersion: "12"; }>' 
is not assignable to parameter of type 
'SupabaseClient<Database, "public", "public", { Tables: { _prisma_migrations: { Row: {...} } }>'
```

## Code Context

**bootstrap.ts:40:**
```typescript
const educationRepo = new SupabaseEducationRepository(options.supabaseClient);
```

**Interface definition (line 16-19):**
```typescript
export interface PlatformBootstrapOptions {
  supabaseClient: SupabaseClient<Record<string, unknown>>;
  contractRegistry?: PlatformContractRegistry;
  eventBus?: MemoryEventBusAdapter;
}
```

**Repository constructor:**
```typescript
// src/platform/education/repositories/supabase-education.repository.ts:17
export class SupabaseEducationRepository extends BaseSupabaseRepositoryPrimitive implements IEducationRepository {
  constructor(private readonly supabase: SupabaseClient<Record<string, unknown>>) {
    super();
  }
```

## Evidence

**Types match exactly:**
- Caller: `SupabaseClient<Record<string, unknown>>`
- Callee: `SupabaseClient<Record<string, unknown>>`

**PR modifications:**
- bootstrap.ts: ❌ NOT modified
- supabase-education.repository.ts: ❌ NOT modified
- Baseline code: ✅ IDENTICAL

**Error persists despite exact type match → Compiler seeing something different**

## Investigation Plan

### 1. Check Database Type Import/Export

**Hypothesis:** Error message mentions `Database` type but constructor uses `Record<string, unknown>`. May indicate:
- Type inference pulling `Database` from somewhere
- Import path resolution changed
- Generated Supabase types changed

**Actions:**
```bash
# Check if Database type imported anywhere
grep -r "import.*Database.*from.*supabase" src/platform/bootstrap.ts
grep -r "import.*Database.*from.*supabase" src/platform/education/

# Check Supabase type generation
ls -la src/types/supabase* 2>/dev/null || echo "No generated types"
git diff de8e756e..HEAD -- src/types/
```

### 2. Check SupabaseClient Generic Inference

**Hypothesis:** @supabase/supabase-js version or type definitions changed

**Actions:**
```bash
# Check package version changes
git diff de8e756e..HEAD -- package.json | grep supabase

# Check if PR modified any Supabase-related types
git diff de8e756e..HEAD --name-only | grep -i supabase
```

### 3. Check Baseline Fingerprint

**Hypothesis:** Error existed in baseline with different fingerprint (message/identity changed)

**Actions:**
```bash
# Extract baseline bootstrap.ts violations
cat .github/ci/baselines/main.json | jq '.scopes["typescript-full"].findings[] | select(.file | contains("bootstrap.ts"))'

# Compare fingerprint components
```

### 4. Check Indirect Dependencies

**Hypothesis:** PR changed type that affects SupabaseClient inference

**Actions:**
```bash
# Check what PR actually modified
git diff --name-only de8e756e..HEAD | grep -E "\.(ts|tsx)$" | head -20

# Look for Database type definition changes
git diff de8e756e..HEAD -- "**/*database*" "**/*supabase*"
```

## Classification Options

### A. INDIRECT_CHANGE
PR modified type definition, import path, or dependency affecting SupabaseClient generic inference
→ **Fix:** Adjust type definition at source

### B. FINGERPRINT_DRIFT  
Error existed in baseline, now detected with different identity
→ **Fix:** May already be in EXISTING, verify fingerprint
→ If truly new identity for old error: Document, may need baseline regeneration policy

### C. FALSE_POSITIVE
Compiler type inference bug, types actually compatible
→ **Fix:** Type assertion with explanation comment

### D. LATENT_BUG
Code always had type unsoundness, now detected by stricter checks
→ **Fix:** Align types properly (change interface or constructor)

## Next Steps

1. ⏳ Execute investigation plan (1-4)
2. ⏳ Classify based on evidence
3. ⏳ Apply appropriate fix (no casts unless FALSE_POSITIVE proven)
4. ⏳ Verify with CI

**Critical:** Do NOT apply type cast until root cause identified and FALSE_POSITIVE proven.

---

**Created:** 2026-09-19
**CI Run:** 35434493634 @ a6198f9a
**Status:** Investigation in progress
