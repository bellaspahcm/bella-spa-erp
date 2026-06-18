# Import Paths Reference - Bella ERP

**Last Updated**: 2026-06-18  
**Purpose**: Prevent incorrect import path errors during development

---

## ⚠️ CRITICAL: Correct Import Paths

### Supabase Server Client

**CORRECT PATH** ✅:
```typescript
import { createClient } from '@/lib/supabase-server';
```

**INCORRECT PATH** ❌ (DO NOT USE):
```typescript
import { createClient } from '@/lib/supabase/server'; // ❌ WRONG! This path does not exist
```

**File Location**: `src/lib/supabase-server.ts`

**Why This Error Happens**:
- Some Next.js/Supabase tutorials use `@/lib/supabase/server`
- Our codebase uses `@/lib/supabase-server.ts` (single file, not folder)
- TypeScript may not catch this during local development
- Vercel build WILL fail with "Module not found" error

---

## ✅ Verified Import Paths

### Core Libraries

| Import | Correct Path | File Location |
|--------|-------------|---------------|
| Supabase Server | `@/lib/supabase-server` | `src/lib/supabase-server.ts` |
| Supabase Client | `@/lib/supabase-client` | `src/lib/supabase-client.ts` |
| API Gateway Types | `@/types/api-gateway` | `src/types/api-gateway.ts` |
| Database Types | `@/types/database.types` | `src/types/database.types.ts` |
| Supabase Admin | `@/lib/supabase-admin-env` | `src/lib/supabase-admin-env.ts` |

### API Gateway Middleware

| Import | Correct Path | File Location |
|--------|-------------|---------------|
| API Key Middleware | `@/lib/middleware/api-key.middleware` | `src/lib/middleware/api-key.middleware.ts` |
| Sandbox Middleware | `@/lib/middleware/sandbox.middleware` | `src/lib/middleware/sandbox.middleware.ts` |
| Rate Limit Middleware | `@/lib/middleware/rate-limit.middleware` | `src/lib/middleware/rate-limit.middleware.ts` |
| Validation Middleware | `@/lib/middleware/validation.middleware` | `src/lib/middleware/validation.middleware.ts` |

### API Response Helpers

| Import | Correct Path | File Location |
|--------|-------------|---------------|
| Response Builders | `@/lib/api/response` | `src/lib/api/response.ts` |
| Validation Schemas | `@/lib/validation/api-schemas` | `src/lib/validation/api-schemas.ts` |

### Services

| Import | Correct Path | File Location |
|--------|-------------|---------------|
| Partner Service | `@/services/api-gateway/partner.service` | `src/services/api-gateway/partner.service.ts` |
| User Actions | `@/services/user-actions` | `src/services/user-actions.ts` |
| Audit Actions | `@/services/audit-actions` | `src/services/audit-actions.ts` |

---

## 🔍 How to Find Correct Path

### Method 1: Check File Existence
```bash
# Check if file exists
ls src/lib/supabase-server.ts     # ✅ Exists
ls src/lib/supabase/server.ts     # ❌ Does not exist
```

### Method 2: Use File Search
```bash
# Find the actual file
find src -name "supabase-server.ts"
# Result: src/lib/supabase-server.ts
```

### Method 3: Check tsconfig.json
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Path resolution: `@/lib/supabase-server` → `./src/lib/supabase-server.ts`

---

## 🚨 Common Mistakes to Avoid

### 1. Copying from External Tutorials
❌ **DON'T**:
```typescript
// From Supabase docs (doesn't match our structure)
import { createClient } from '@/lib/supabase/server'
```

✅ **DO**:
```typescript
// Check our actual file structure first
import { createClient } from '@/lib/supabase-server'
```

### 2. Auto-Import Suggestions
- VS Code may suggest incorrect paths from external packages
- Always verify the path matches our file structure
- Use "Go to Definition" (F12) to verify

### 3. New File Creation
When creating new files:
1. Check if similar files exist
2. Follow existing naming conventions
3. Use single files (`file.ts`) not folders (`file/index.ts`) unless needed
4. Update this reference document

---

## 📝 Historical Errors (Lessons Learned)

### Error #1: Supabase Import Path (2026-06-18)
**Commit**: `6bd377ca`  
**Files Affected**: 9 files in API Gateway  
**Root Cause**: Used `@/lib/supabase/server` instead of `@/lib/supabase-server`  
**Impact**: Vercel build failed (Module not found)  
**Resolution**: Search & replace all occurrences  

**Files Fixed**:
- `src/__tests__/api-key-middleware.test.ts`
- `src/app/api/admin/partners/[id]/logs/route.ts`
- `src/app/api/admin/partners/[id]/regenerate-key/route.ts`
- `src/app/api/admin/partners/[id]/route.ts`
- `src/app/api/admin/partners/[id]/scopes/route.ts`
- `src/app/api/admin/partners/[id]/usage/route.ts`
- `src/app/api/admin/partners/route.ts`
- `src/app/api/admin/partners/stats/route.ts`
- `src/lib/middleware/api-key.middleware.ts`

---

### Error #2: Missing Database Types for New Tables (2026-06-18)
**Commit**: `4d504899`  
**Files Affected**: `src/app/api/admin/partners/[id]/logs/route.ts`  
**Root Cause**: Created `api_request_logs` table in migration but didn't regenerate TypeScript types  
**Impact**: TypeScript errors when trying to access the table, temptation to use `any` or `@ts-ignore`  
**Resolution**: Temporarily disabled endpoint with 501 response until types are regenerated

**Problem**:
```typescript
// ❌ Table exists in DB but not in types
type APIRequestLog = Database['public']['Tables']['api_request_logs']['Row'];
//                                                  ^^^^^^^^^^^^^^^^^^
// TypeScript error: Property 'api_request_logs' does not exist
```

**Wrong Solutions (NEVER DO THIS)**:
```typescript
// ❌ Using 'any' type
const typedSupabase = supabase as any;

// ❌ Using @ts-ignore
// @ts-ignore
const { data } = await supabase.from('api_request_logs').select('*');
```

**Correct Solution**:
```typescript
// ✅ Return 501 until types are regenerated
export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Endpoint temporarily disabled',
        details: 'Database types need regeneration. Run: npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts',
      },
    },
    { status: 501 }
  );
  
  /* Full implementation commented out - uncomment after regenerating types */
}
```

**How to Fix Permanently**:
1. Run migration: `npx supabase migration up`
2. Regenerate types: `npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts`
3. Verify table exists in `src/types/database.types.ts`
4. Uncomment implementation in route file
5. Remove 501 response

**Prevention**:
- Always regenerate types after running migrations that add/modify tables
- Add type regeneration to CI/CD pipeline
- Document new tables in migration files

---

## 🛠️ Verification Checklist

Before pushing to Vercel:

- [ ] Run local TypeScript check: `npm run type-check` or `tsc --noEmit`
- [ ] Search for incorrect paths: `grep -r "@/lib/supabase/server" src/`
- [ ] Verify imports resolve: Use VS Code "Go to Definition" (F12)
- [ ] Test build locally: `npm run build`

---

## 📚 Related Documentation

- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)
- [Next.js Module Resolution](https://nextjs.org/docs/advanced-features/module-path-aliases)
- [Bella ERP Architecture](../architecture/README.md)

---

## 🔄 Keeping This Document Updated

**When to Update**:
- Adding new core library files
- Refactoring file structure
- After fixing import-related build errors
- Creating new shared modules

**How to Update**:
1. Add entry to relevant table
2. Document any new patterns
3. Update "Historical Errors" with lessons learned
4. Commit with: `docs: Update import paths reference`

---

**Last Verified**: 2026-06-18  
**Maintainer**: AI Agent / Development Team  
**Status**: ✅ Active
