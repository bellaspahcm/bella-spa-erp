# Mobile Week 1 - Scope Lock Document

**Date**: 2026-06-19  
**Checkpoint**: mobile-week1-checkpoint1  
**Approval Status**: ✅ APPROVED (9.6/10)  
**Risk Assessment**: 🟢 Safe to proceed with Expo scaffold  

---

## Điều kiện 1: Tag Checkpoint ✅

**Tag created**: `mobile-week1-checkpoint1`

**Rollback command**:
```bash
git checkout mobile-week1-checkpoint1
```

**Rollback time**: < 2 minutes

---

## Điều kiện 2: Scope Lock - NO MIGRATION ⚠️

### ✅ ALLOWED in Week 1

- Scaffold `apps/mobile/` với Expo SDK 53
- Tạo mobile Supabase client (AsyncStorage)
- Tạo mobile AuthContext
- Tạo Login screen + Home screen
- Mobile **import từ** `@bella/shared`
- Test mobile app độc lập

### ❌ FORBIDDEN in Week 1

- ❌ **KHÔNG di chuyển** code từ `src/`
- ❌ **KHÔNG migrate** web app imports từ `src/` → `@bella/shared`
- ❌ **KHÔNG thêm** TypeScript Project References vào root
- ❌ **KHÔNG chạm** vào `src/` directory (web app code)
- ❌ **KHÔNG refactor** shared package structure

**Scope boundary**:
```
Week 1 = Expo only
```

**Rationale**:
- Web app production must remain untouched
- Import migration is Week 2 risk (7/10)
- Checkpoint 1 must stay stable

---

## Điều kiện 3: Minimal Expo Scaffold 🎯

### ✅ Week 1 Goals (MINIMAL)

**Goal**: Prove Expo → Supabase → Auth works

**In scope**:
1. ✅ Expo SDK 53 scaffold
2. ✅ Supabase client (AsyncStorage)
3. ✅ AuthContext (4-state flow: loading, unauthenticated, authenticated, error)
4. ✅ Login screen (email/password)
5. ✅ Home screen (show user profile)
6. ✅ Basic navigation (_layout, index, login, home)
7. ✅ Environment variables (.env.example)
8. ✅ `fetchUserProfile()` - port từ `getCurrentUser()`

**Out of scope (deferred)**:
- ❌ Complex navigation (tabs, drawers, nested stacks)
- ❌ Offline queue
- ❌ Push notifications
- ❌ GPS/Location services
- ❌ Camera/Image picker
- ❌ Biometric auth
- ❌ Deep linking
- ❌ Background tasks
- ❌ Analytics/Crash reporting

**Success criteria**:
```
Expo build → Connect Supabase → Login → Show user profile
```

---

## Remaining Risks

### Rủi ro #1: Week 2 Migration (7/10)

**Description**: Import migration từ `src/` → `@bella/shared`

**Mitigation**:
- Tạo investigation artifact trước khi bắt đầu Week 2
- Migration từng module (utils → validators → constants → types → services)
- Verify build + test suite sau mỗi module
- Commit checkpoint sau mỗi module hoàn tất
- Full test suite (162 files) + E2E tests

**Status**: ⏸️ DEFERRED to Week 2

---

### Rủi ro #2: Expo SDK 53 Compatibility (4/10)

**Description**: Package version conflicts

**Likely conflicts**:
- `react-native-safe-area-context`
- `react-native-screens`
- `expo-router`
- `@react-native-async-storage/async-storage`
- `@supabase/supabase-js` (React Native compatibility)

**Mitigation**:
- Use Expo SDK 53 compatible versions
- Check `npx expo install` recommendations
- Verify mobile:typecheck after each package install
- Document version constraints in mobile package.json

**Expected resolution time**: < 4 hours

**Status**: 🟡 MONITORING

---

## Verification Checkpoints

### Checkpoint 1 (CURRENT) ✅

- packages/shared/ setup complete
- Test suite: 17/17 PASSED
- Build: shared:typecheck ✓, next build ✓
- Tag: mobile-week1-checkpoint1

### Checkpoint 2 (NEXT)

**Target**: Expo scaffold complete

**Criteria**:
```bash
# Mobile app builds
npm run mobile:typecheck  # ✓
npm run mobile:dev        # ✓ (Expo dev server starts)

# Web app unchanged
npm run lint              # ✓
npm run build             # ✓
npm run test:critical     # ✓ (17/17 suites)
```

**Tag**: `mobile-week1-checkpoint2`

### Final Checkpoint (Week 1 Complete)

**Target**: Login + Home screen working

**Criteria**:
- Login screen: email/password input, validation, submit
- AuthContext: 4-state flow working
- Supabase auth: sign in working
- Home screen: show user profile (name, email, role, tenant)
- Navigation: index → login → home
- Build: iOS simulator or Android emulator running

**Tag**: `mobile-week1-complete`

---

## Rollback Strategy

### Level 1: Delete Expo app
```bash
rm -rf apps/mobile/
npm install
npm run build  # Verify web app unchanged
```

### Level 2: Revert to Checkpoint 1
```bash
git checkout mobile-week1-checkpoint1
npm install
npm run build
npm run test:critical
```

### Level 3: Nuclear rollback (if packages/shared is broken)
```bash
rm -rf packages/
git checkout package.json package-lock.json tsconfig.json
npm install
npm run build
npm run test:critical
```

**Estimated rollback time**: 2-5 minutes

---

## Stakeholder Approval Summary

**Reviewer assessment**: 9.6/10

| Hạng mục | Điểm |
|----------|------|
| Risk Management | 9.5/10 |
| Production Safety | 10/10 |
| Rollback Strategy | 9.5/10 |
| Migration Strategy | 9/10 |
| Verification Discipline | 9.5/10 |
| Readiness for Expo | 10/10 |

**Overall status**:
- 🟢 Production Safe
- 🟢 Checkpoint Validated
- 🟢 Ready to scaffold Expo
- 🟡 Import migration NOT allowed in Week 1
- 🔴 Week 2 requires separate review

**Approval**: ✅ YES - Proceed with Bước 6-14 (Scaffold Expo)

---

**Document owner**: AI Agent  
**Approved by**: Stakeholder  
**Next review**: After Checkpoint 2 (Expo scaffold complete)  
**Locked scope until**: Week 1 complete or rollback triggered
