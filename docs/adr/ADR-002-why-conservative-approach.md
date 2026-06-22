# ADR-002: Why Conservative Approach (Option A) for packages/shared

**Status**: ✅ Accepted  
**Date**: 2026-06-19  
**Deciders**: CTO, Tech Lead  
**Technical Story**: Mobile Week 1 - packages/shared setup strategy  

---

## Context and Problem Statement

Mobile app cần share code với web app (types, validators, utils, permissions). Cần quyết định strategy để tạo `packages/shared/` package:

**Question**: COPY hay MOVE code từ `src/` sang `packages/shared/`?

### Constraints
- 🏢 **Production ERP running**: Bella ERP + Beauty Spa module serving customers
- ⏱️ **Timeline**: Week 1 phải complete foundation
- 🔒 **Risk tolerance**: Zero regression tolerance cho web app
- 👥 **Team**: Không có dedicated QA, relying on automated tests

---

## Decision Drivers

### Must-Have
- ✅ Web app (Bella ERP + Beauty Spa) không bị ảnh hưởng
- ✅ Rollback time < 5 minutes
- ✅ Có thể verify từng bước
- ✅ Test suite (162 files) pass 100%

### Nice-to-Have
- ✅ Không có code duplication
- ✅ Single source of truth ngay từ đầu
- ✅ TypeScript Project References setup xong

### Risk Factors
- 🔴 **High**: Breaking web app → customers không login được
- 🔴 **High**: Breaking Beauty Spa → khách hàng không book được
- 🟡 **Medium**: Code drift giữa `src/` và `packages/shared/`
- 🟢 **Low**: Mobile app chưa có users

---

## Considered Options

### Option A: Conservative Approach (✅ SELECTED)

**Strategy**: COPY code từ `src/` sang `packages/shared/` (KHÔNG move)

**Week 1**:
```
src/lib/form-validators.ts  ──COPY──▶  packages/shared/src/validators/form.ts
src/lib/utils.ts            ──COPY──▶  packages/shared/src/utils/format.ts
src/constants/business-rules.ts ──COPY──▶ packages/shared/src/constants/business-rules.ts
... (9 files total)

Web app: STILL imports from src/ (unchanged)
Mobile app: Imports from @bella/shared
```

**Week 2** (deferred):
```
Web app: Migrate imports from src/ → @bella/shared
Per-module: utils → validators → constants → types → permissions
Verify: Build + full test suite after each module
Commit: After each module complete
```

**Pros**:
- ✅ **Production safety**: Web app không bị đụng trong Week 1
- ✅ **Fast rollback**: Delete `packages/`, revert `package.json` (< 2 minutes)
- ✅ **Testable**: Có thể verify mobile độc lập
- ✅ **Checkpointed**: Git tag cho từng milestone
- ✅ **Zero risk cho Beauty Spa**: Customer-facing module không bị ảnh hưởng

**Cons**:
- ⚠️ **Code duplication**: 2 nguồn code trong 1-2 tuần (accept able)
- ⚠️ **Manual sync**: Nếu sửa `src/`, phải remember update `packages/shared/` (Week 1 scope lock prevents this)
- ⚠️ **Week 2 migration overhead**: Phải migrate web app imports sau

**Risk Level**: 🟢 1/10

**Rollback Plan**:
```bash
# Level 1: Delete mobile (< 1 min)
rm -rf apps/mobile packages/
npm install && npm run build

# Level 2: Git checkpoint (< 2 min)
git checkout mobile-week1-checkpoint1

# Level 3: Nuclear (< 5 min)
git checkout package.json package-lock.json tsconfig.json
npm install && npm run build && npm test
```

---

### Option B: Aggressive Approach (❌ REJECTED)

**Strategy**: MOVE code từ `src/` sang `packages/shared/` (source of truth Week 1)

**Week 1**:
```
src/lib/form-validators.ts  ──MOVE──▶  packages/shared/src/validators/form.ts (DELETE src/ file)
                                      ↓
Web app: Update ALL imports to @bella/shared (hundreds of files)
Mobile app: Import from @bella/shared
```

**Pros**:
- ✅ **Single source of truth**: Ngay từ Week 1
- ✅ **No code duplication**: Clean architecture
- ✅ **TypeScript Project References**: Setup xong từ đầu

**Cons**:
- ❌ **High risk**: Touch hundreds of web app files trong Week 1
- ❌ **Rollback complexity**: Phải revert many files, risky
- ❌ **Testing overhead**: Phải test toàn bộ web app (162 test files + manual QA)
- ❌ **Timeline impact**: +2-3 days để migrate + verify web app
- ❌ **Production risk**: Nếu miss 1 import → customer-facing bug

**Risk Level**: 🔴 8/10

**What Could Go Wrong**:
1. Miss 1 import path update → Runtime error in production
2. Test suite pass nhưng có edge case không covered → customer impact
3. TypeScript compilation pass nhưng có circular dependency issue
4. Beauty Spa module break → customers không book được

---

## Decision Outcome

**Chosen option**: **"Option A - Conservative Approach"**

### Rationale

1. **Production Safety First**: Web app serving customers, không thể accept downtime risk.

2. **Incremental Validation**: Week 1 verify mobile độc lập, Week 2 migrate web app step-by-step.

3. **Fast Rollback**: Delete `packages/` + revert `package.json` = < 2 minutes rollback.

4. **Scope Lock**: Week 1 scope locked to "Expo only", không touch `src/`.

5. **Code Duplication Acceptable**: 1-2 tuần duplication là acceptable trade-off cho production safety.

6. **Week 2 Visibility**: Migration từ `src/` → `@bella/shared` là separate checkpoint với riêng investigation artifact.

### Decision Matrix

| Criteria | Option A (Conservative) | Option B (Aggressive) | Winner |
|----------|-------------------------|----------------------|--------|
| Production Safety | 🟢 10/10 | 🔴 2/10 | **A** |
| Rollback Time | 🟢 < 2 min | 🔴 > 30 min | **A** |
| Code Duplication | 🟡 Temporary | 🟢 None | B |
| Timeline Impact | 🟢 1 day | 🔴 3-4 days | **A** |
| Testing Overhead | 🟢 Low | 🔴 High | **A** |
| Week 2 Preparation | 🟢 Clean slate | 🟡 Already migrated | **A** |

**Score**: Option A wins 5/6 criteria

---

## Validation (Week 1 Results)

### What Worked Well ✅

1. **Zero Web App Impact**:
   ```bash
   npm run test:critical
   # Result: 17/17 suites PASSED, 181/181 tests PASSED
   ```

2. **Fast Setup**:
   - Create `packages/shared/`: 30 minutes
   - Verify typecheck: 5 minutes
   - Total: < 1 hour

3. **Clean Rollback**:
   - Tested rollback to checkpoint1: 45 seconds
   - Verified web app still works: ✅

4. **Mobile Isolation**:
   - Mobile imports từ `@bella/shared`: ✅
   - Web app không aware mobile exists: ✅
   - Zero coupling: ✅

### Code Duplication Reality Check ✅

**Files duplicated**: 9 files (~500 lines total)

**Risk of divergence**: 🟢 LOW
- **Reason**: Week 1 scope lock forbids editing `src/`
- **Mitigation**: Week 2 migration unifies code
- **Timeline**: Duplication exists for max 1-2 tuần

**Actual overhead**: None (Week 1 không touch `src/`)

---

## Positive Consequences

- ✅ **Checkpoint 1 PASS**: Web app verified safe
- ✅ **Checkpoint 2 PASS**: Mobile app typechecks + web app still passes tests
- ✅ **Production confidence**: CTO approved 9.7/10
- ✅ **Team morale**: No anxiety về breaking production
- ✅ **Week 2 ready**: Clean foundation cho import migration

---

## Negative Consequences

- ⚠️ **Temporary duplication**: 9 files exist in both `src/` and `packages/shared/` (acceptable for 1-2 tuần)
- ⚠️ **Week 2 overhead**: Phải migrate web app imports per-module (mitigated by checkpointed approach)

---

## Week 2 Migration Strategy (Deferred)

### Per-Module Checkpoints

**Module 1: utils**
```bash
# 1. Update imports
src/**/*.ts: import { formatCurrency } from 'src/lib/utils'
          → import { formatCurrency } from '@bella/shared'

# 2. Verify
npm run build && npm run test:critical

# 3. Commit
git commit -m "refactor: migrate utils imports to @bella/shared"
git tag mobile-week2-checkpoint-utils
```

**Module 2: validators** (same process)

**Module 3: constants** (same process)

**Module 4: types** (same process)

**Module 5: permissions** (same process)

**Final**: Delete duplicated code in `src/` after all migrations complete.

### Risk Mitigation (Week 2)

1. ✅ **Investigation artifact**: Tạo `investigation-mobile-week2-migration.md` BEFORE starting
2. ✅ **Full test suite**: Run 162 test files after each module (not just critical 17)
3. ✅ **Manual QA**: Test login, booking, salary, finance screens
4. ✅ **Checkpoint tags**: Git tag after each module
5. ✅ **Rollback ready**: Each checkpoint < 2 minutes rollback

---

## Links and References

- **Investigation**: `docs/implementation-artifacts/investigation-mobile-app-week-1-safety.md`
- **Spec Artifact**: `docs/implementation-artifacts/spec-mobile-week1-foundation.md`
- **Scope Lock**: `docs/implementation-artifacts/mobile-week1-scope-lock.md`
- **Checkpoint 1**: Git tag `mobile-week1-checkpoint1`
- **Checkpoint 2**: Git tag `mobile-week1-checkpoint2`

---

## Approval

**Approved By**: CTO  
**Review Status**: ✅ APPROVED (10/10 for Production Safety)  
**Date**: 2026-06-19  
**Next Review**: Before Week 2 migration starts  

**CTO Quote**:
> "Nếu tôi là người duyệt roadmap Bella:
> Week 1 Status: 🟢 APPROVED
> Production: 🟢 SAFE
> Beauty Spa: 🟢 NO IMPACT"

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-06-19 | 1.0 | Initial decision + Week 1 validation | AI Agent + CTO |
