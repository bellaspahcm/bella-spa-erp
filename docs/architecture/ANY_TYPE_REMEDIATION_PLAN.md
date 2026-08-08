# `any` Type Violations Remediation Plan

**Generated:** 2026-08-08T08:10:56.232Z  
**Total Violations:** 664  
**Estimated Effort:** 34 hours  
**Constitution:** Law 11 (Strictly No `any` Types Allowed)

---

## Summary

| Priority | Count | % of Total |
|----------|-------|------------|
| 🔴 HIGH  | 0 | 0% |
| 🟡 MEDIUM | 0 | 0% |
| 🟢 LOW   | 664 | 100% |

---

## Remediation Strategy

### Phase 1: HIGH Priority (Week 5)
- Fix platform engines (`src/platform/`)
- Fix business rules (`src/lib/business-rules/`)
- Fix core services (`src/services/`)
- **Effort:** ~0 hours

### Phase 2: MEDIUM Priority (Week 6)
- Fix hooks (`src/hooks/`)
- Fix reusable components (`src/components/`)
- **Effort:** ~0 hours

### Phase 3: LOW Priority (Post-Phase 0)
- Fix app pages (`src/app/`)
- Fix module-specific code (`src/modules/`)
- **Effort:** ~34 hours

---

## Common Patterns & Fixes

### Pattern 1: Function Parameters
```typescript
// ❌ BAD
function process(data: any) { ... }

// ✅ GOOD
function process(data: ProcessRequest) { ... }
function process<T>(data: T) { ... }
```

### Pattern 2: API Responses
```typescript
// ❌ BAD
const { data }: any = await fetch(...);

// ✅ GOOD
const { data }: { data: ResponseType } = await fetch(...);
```

### Pattern 3: Event Handlers
```typescript
// ❌ BAD
const handleClick = (e: any) => { ... }

// ✅ GOOD
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
```

### Pattern 4: Generic Collections
```typescript
// ❌ BAD
const items: any[] = [];

// ✅ GOOD
const items: Item[] = [];
const items: Array<Item> = [];
```

---

## Enforcement

### ESLint Rule (Add to .eslintrc.js)
```javascript
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error', // Block new violations
  }
}
```

### Pre-commit Hook
```bash
# .husky/pre-commit
npm run lint -- --max-warnings 0
```

---

## Progress Tracking

- [ ] Phase 1: HIGH priority violations fixed (0 violations)
- [ ] Phase 2: MEDIUM priority violations fixed (0 violations)
- [ ] Phase 3: LOW priority violations fixed (664 violations)
- [ ] ESLint rule enabled
- [ ] Pre-commit hook added
- [ ] Constitution Law 11 compliance: 100%

---

**Next Steps:**
1. Run `node scripts/scan-any-types.js` to regenerate report
2. Start with HIGH priority files (platform engines)
3. Enable ESLint rule after HIGH priority fixed
4. Add pre-commit hook to prevent new violations
