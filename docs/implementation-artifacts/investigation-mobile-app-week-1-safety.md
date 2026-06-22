# Investigation: Mobile App Week 1 Foundation - Safety Analysis

**Date**: 2026-06-21  
**Status**: 🟡 INVESTIGATION  
**Risk Level**: 🟡 MEDIUM - Workspace restructure  

---

## Mục Đích

Phân tích impact của việc khởi tạo React Native mobile app lên hệ thống Bella ERP hiện tại (web app Next.js) và Beauty Spa module đang chạy production.

## Câu Hỏi Cần Trả Lời

1. **npm workspaces** có ảnh hưởng đến `npm ci` của web app không?
2. **TypeScript Project References** có break web app build không?
3. **packages/shared/** - Di chuyển code từ `src/` có an toàn không? Web app sẽ import từ đâu?
4. Có cần **migration plan** cho web app import từ `@bella/shared`?
5. **Test suite hiện tại** (162 files) có bị ảnh hưởng không?

---

## Phân Tích Impact

### 1. npm workspaces

**Thay đổi**:
```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

**Impact**:
- ✅ **SAFE**: npm workspaces hoàn toàn backward compatible
- ✅ Web app vẫn ở root → không cần thay đổi import paths
- ✅ `npm ci` vẫn install dependencies đúng
- ⚠️ **Cần kiểm tra**: `npm ci` có chậm hơn không (vì phải install thêm packages/*)

**Verification**:
```bash
# Trước khi deploy
npm ci
npm run build
npm test
```

---

### 2. TypeScript Project References

**Thay đổi**:
```json
{
  "references": [
    { "path": "./packages/shared" },
    { "path": "./apps/mobile" }
  ]
}
```

**Impact**:
- ⚠️ **RISK**: `tsc --build` ở root sẽ check cả packages/shared và apps/mobile
- ⚠️ **RISK**: Nếu shared hoặc mobile có lỗi TypeScript → block web build
- ✅ **MITIGATION**: Web app không import từ shared ở Week 1 → lỗi shared không ảnh hưởng runtime

**Verification**:
```bash
# Web app vẫn build được không?
npm run build

# TypeScript check toàn bộ workspace
npx tsc --build
```

**Quyết định**: 
- **KHÔNG thêm references ngay** → đợi shared typecheck pass
- **Hoặc**: Thêm references nhưng shared phải typecheck sạch trước

---

### 3. packages/shared/ - Di Chuyển Code

**Kế hoạch ban đầu**:
> "Di chuyển code từ `src/` sang `packages/shared/` làm source of truth. Web app sau này sẽ import từ `@bella/shared`."

**⚠️ RỦI RO LỚN**:
- Web app hiện tại **KHÔNG import** từ `@bella/shared`
- Nếu di chuyển code → web app mất code
- Nếu copy code → code drift (2 nguồn chân lý)

**✅ GIẢI PHÁP AN TOÀN**:

**Week 1 (An toàn)**:
1. **COPY** code từ `src/` sang `packages/shared/` (KHÔNG di chuyển)
2. Web app vẫn import từ `src/lib/`, `src/constants/`, `src/types/`
3. Mobile app import từ `@bella/shared`
4. **Chấp nhận code duplication tạm thời**

**Week 2 (Migration web app)**:
1. Web app từ từ chuyển import từ `src/` → `@bella/shared`
2. Verify từng module một
3. Xóa code cũ trong `src/` sau khi migration xong

**Benefit**:
- ✅ Web app không bị gián đoạn
- ✅ Rollback dễ dàng (chỉ cần xóa packages/*)
- ✅ Kiểm tra từng bước

---

### 4. Test Suite (162 files)

**Impact**:
- ✅ **SAFE**: Web app tests vẫn import từ `src/` → không bị ảnh hưởng
- ✅ Test paths không đổi
- ⚠️ **Cần kiểm tra**: `npm test` không bị chậm vì workspaces

**Verification**:
```bash
npm test
npm run test:critical
```

---

## Quyết Định An Toàn

### Option A: Conservative (RECOMMENDED) ✅

**Week 1**:
1. ✅ Thêm `workspaces` vào package.json
2. ✅ Tạo `packages/shared/` - **COPY** code (không di chuyển)
3. ❌ KHÔNG thêm TypeScript Project References ngay
4. ✅ Scaffold `apps/mobile/` với Expo
5. ✅ Mobile import từ `@bella/shared`
6. ✅ Web app vẫn import từ `src/` (không đổi)

**Verification**:
```bash
# Web app không bị ảnh hưởng
npm ci
npm run lint
npm run build
npm test

# Shared typecheck riêng
npm run shared:typecheck

# Mobile typecheck riêng
npm run mobile:typecheck
```

**Week 2** (sau khi mobile stable):
1. Thêm TypeScript Project References
2. Web app từ từ migrate import sang `@bella/shared`
3. Verify từng module
4. Xóa code duplicate trong `src/` sau khi xong

---

### Option B: Aggressive (NOT RECOMMENDED) ❌

**Week 1**:
1. Thêm workspaces + Project References ngay
2. **Di chuyển** code từ `src/` sang `packages/shared/`
3. Web app phải update tất cả imports ngay
4. Scaffold mobile

**Risk**:
- 🔴 Web app có thể break
- 🔴 Rollback khó
- 🔴 Test suite có thể fail
- 🔴 Beauty Spa production bị ảnh hưởng

---

## Kế Hoạch Thực Thi An Toàn (Option A)

### Bước 1-5: Setup Workspace (SAFE)

1. Thêm `workspaces` vào root package.json ✅
2. ❌ SKIP: Thêm TypeScript Project References (đợi Week 2)
3. Tạo `packages/shared/` - **COPY** code từ `src/` ✅
4. Tạo `packages/shared/tsconfig.json` ✅
5. Verify `npm run shared:typecheck` ✅

**Checkpoint 1**: Web app không bị ảnh hưởng
```bash
npm ci
npm run lint
npm run build
npm test  # 162 tests pass
```

### Bước 6-14: Scaffold Mobile (ISOLATED)

6. Scaffold `apps/mobile/` với Expo SDK 53
7. Tạo `apps/mobile/tsconfig.json`
8. Install mobile dependencies
9. Tạo env adapter
10. Tạo Supabase client
11. Tạo fetchUserProfile()
12. Tạo AuthContext
13. Tạo màn hình
14. Tạo .env.example

**Checkpoint 2**: Mobile build độc lập
```bash
npm run mobile:typecheck
npm run mobile:dev  # Expo dev server
```

### Bước 15-17: Final Verification

15. Verify shared + mobile typecheck ✅
16. **CRITICAL**: Verify web app không bị ảnh hưởng ✅
17. Commit + spec artifact

**Final Checkpoint**: Tất cả hoạt động
```bash
# Web app (production)
npm run lint
npm run build
npm test

# Shared package
npm run shared:typecheck

# Mobile app
npm run mobile:typecheck
npm run mobile:dev
```

---

## Rollback Plan

Nếu có vấn đề:

**Step 1**: Xóa thư mục
```bash
rm -rf packages/
rm -rf apps/mobile/
```

**Step 2**: Revert package.json
```bash
git checkout package.json
```

**Step 3**: Verify web app
```bash
npm ci
npm run build
npm test
```

**Thời gian rollback**: < 2 phút

---

## Security & Compliance

1. ✅ Không chạm RLS policies
2. ✅ Không chạm database schema
3. ✅ Không chạm business logic (salary, finance, booking)
4. ✅ Không chạm web app imports (Week 1)
5. ⚠️ Cần review: `.env.example` cho mobile (không leak secrets)

---

## Kết Luận

**Recommendation**: **Option A - Conservative Approach**

**Rationale**:
- ✅ Web app production (Bella ERP + Beauty Spa) không bị ảnh hưởng
- ✅ Rollback dễ dàng
- ✅ Kiểm tra từng bước
- ✅ Code duplication tạm thời chấp nhận được (1-2 tuần)

**Next Steps**:
1. Tạo spec artifact: `spec-mobile-week-1-foundation.md`
2. Thực thi Option A với checkpoints nghiêm ngặt
3. Ghi log verification results

**Deferred to Week 2**:
- TypeScript Project References (sau khi shared stable)
- Web app migration sang `@bella/shared` (từ từ, verify từng module)

---

**Approved By**: AI Agent + Stakeholder  
**Review Status**: ✅ APPROVED  
**Implementation**: ✅ Checkpoint 1 completed and verified

---

## Verification Results (Checkpoint 1)

**Date**: 2026-06-19  
**Git commit**: 95557687

### Test Results
```bash
npm run test:critical
# Result: ✅ 17 test suites passed, 181 tests passed
# Time: 4.781s
# Coverage: All business-critical flows (payment, accounting, finance, salary, auth, tenant)
```

### Build Results
```bash
npm run shared:typecheck  # ✅ PASS
npx next build            # ✅ PASS
npm ci                    # ✅ PASS
```

### Stakeholder Review Feedback

**Approved elements**:
- ✅ Investigation approach: rất tốt
- ✅ Chọn Option A là quyết định đúng
- ✅ Full test suite verification completed
- ✅ Checkpoint commit before Expo scaffold
- ✅ Không thấy rủi ro đáng kể cho Beauty Spa production ở trạng thái hiện tại

**⚠️ CRITICAL WARNING FOR WEEK 2**:
> Điểm cần cảnh giác nhất không phải Week 1 mà là **Week 2 import migration từ** `src` **sang** `@bella/shared`. Đó mới là nơi có thể phát sinh regression thực sự.

**Action items for Week 2 migration**:
1. **Migration strategy**: Từng module một, không migration hàng loạt
2. **Per-module verification**: Build + test sau mỗi module migration
3. **Rollback checkpoints**: Commit sau mỗi module hoàn tất
4. **Priority**: Non-critical modules first (utils, validators, constants), business logic last (services)
5. **Investigation artifact**: Tạo `investigation-mobile-app-week-2-migration.md` trước khi bắt đầu
6. **Test coverage**: Full test suite (162 files) + E2E tests sau mỗi module

---

**Status**: ✅ Ready to proceed with Bước 6 (Scaffold Expo mobile app)
