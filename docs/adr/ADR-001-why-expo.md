# ADR-001: Why Expo for Bella ERP Mobile App

**Status**: ✅ Accepted  
**Date**: 2026-06-19  
**Deciders**: CTO, Tech Lead, Mobile Team  
**Technical Story**: Bella ERP Mobile App - Phase 1 Foundation  

---

## Context and Problem Statement

Bella ERP cần mobile app để phục vụ KTV (nhân viên spa) và quản lý chi nhánh. Có 3 options chính:

1. **React Native with Expo**
2. **React Native CLI (bare workflow)**
3. **Flutter**

Cần quyết định framework nào phù hợp nhất với:
- Timeline: 7 tuần cho MVP
- Team: Frontend team biết React/TypeScript, chưa có mobile experience
- Requirements: iOS + Android, offline support, push notifications
- Constraints: Production ERP system đang chạy (Bella ERP + Beauty Spa)

---

## Decision Drivers

### Must-Have
- ✅ Cross-platform (iOS + Android) từ 1 codebase
- ✅ TypeScript support
- ✅ Code sharing với web app (React/Next.js)
- ✅ Fast iteration cycle (hot reload)
- ✅ Native module support (camera, push notifications, offline)

### Nice-to-Have
- ✅ OTA updates (Over-The-Air) không cần App Store review
- ✅ Managed workflow để team focus vào business logic
- ✅ Built-in tools cho build/deployment
- ✅ Strong community + documentation

### Constraints
- ⏱️ Timeline: 7 tuần (aggressive)
- 👥 Team: React developers, không có Swift/Kotlin experience
- 🏢 Production: Web ERP đang chạy, không được break

---

## Considered Options

### Option 1: React Native with Expo (✅ SELECTED)

**Pros**:
- ✅ **Fastest time-to-market**: Managed workflow, không cần setup Xcode/Android Studio config
- ✅ **Code sharing**: `@bella/shared` package dùng chung với web app
- ✅ **TypeScript first-class**: Expo SDK 53 có excellent TS support
- ✅ **OTA updates**: EAS Update cho phép fix bugs không cần App Store review
- ✅ **Built-in modules**: Camera, notifications, secure storage, AsyncStorage
- ✅ **Team familiarity**: React developers onboard nhanh (< 1 tuần)
- ✅ **expo-router**: File-based routing giống Next.js App Router
- ✅ **Development experience**: Expo Go app cho rapid testing
- ✅ **CI/CD**: EAS Build + EAS Submit tích hợp sẵn

**Cons**:
- ⚠️ Binary size lớn hơn bare React Native (~50MB vs ~30MB)
- ⚠️ Expo SDK 53 TypeScript config issue (đã resolved bằng custom tsconfig)
- ⚠️ Một số native modules cần custom dev clients

**Risk**: 🟡 4/10 (Expo SDK compatibility) → 🟢 0/10 (resolved)

---

### Option 2: React Native CLI (bare workflow)

**Pros**:
- ✅ Full control over native code
- ✅ Smaller binary size
- ✅ Không phụ thuộc Expo ecosystem

**Cons**:
- ❌ **Setup complexity**: Cần config Xcode, Android Studio, native build tools
- ❌ **Time overhead**: +2 tuần cho initial setup + troubleshooting
- ❌ **Team skillset gap**: Cần biết Swift/Kotlin để maintain native modules
- ❌ **No OTA updates**: Mọi bug fix cần App Store review (3-7 days)
- ❌ **Manual CI/CD**: Phải tự setup Fastlane, certificates, provisioning profiles

**Risk**: 🔴 8/10 (Timeline + team skillset)

---

### Option 3: Flutter

**Pros**:
- ✅ Fast rendering (Skia engine)
- ✅ Hot reload excellent
- ✅ Google backing

**Cons**:
- ❌ **Rewrite everything**: Không share code với React/TypeScript web app
- ❌ **Team skillset gap**: Cần học Dart + Flutter framework
- ❌ **Timeline impact**: +4 tuần để team ramp up
- ❌ **No code sharing**: `@bella/shared` package không dùng được
- ❌ **Ecosystem fragmentation**: Supabase client khác, form validation khác, business logic khác

**Risk**: 🔴 9/10 (Timeline + zero code reuse)

---

## Decision Outcome

**Chosen option**: **"React Native with Expo"** (Option 1)

### Rationale

1. **Time-to-Market**: 7 tuần là aggressive timeline. Expo managed workflow giúp team focus vào business logic thay vì native config.

2. **Code Sharing**: `@bella/shared` package (types, validators, utils, permissions) dùng chung với web app → DRY principle, single source of truth.

3. **Team Productivity**: React developers onboard nhanh, không cần học Swift/Kotlin.

4. **OTA Updates**: Critical cho production ERP. Có thể fix bugs within hours, không phải đợi App Store review.

5. **Developer Experience**: Expo Go + hot reload + TypeScript = extremely fast iteration cycle.

6. **Risk Mitigation**: Expo SDK 53 compatibility issue resolved trong 15 minutes với custom tsconfig.

### Success Metrics (After Week 1)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Setup time | < 1 day | 1 day | ✅ |
| TypeScript errors | 0 | 0 | ✅ |
| Code sharing | > 50% | ~60% | ✅ |
| Team onboarding | < 1 week | N/A (Week 1) | ⏳ |
| Build success | 100% | 100% | ✅ |

---

## Positive Consequences

- ✅ **Week 1 complete**: Scaffold Expo app + Auth + Login/Home screens trong 1 ngày
- ✅ **Zero web app impact**: Conservative approach đảm bảo production safety
- ✅ **Code reuse**: `@bella/shared` package với validators, utils, permissions
- ✅ **Fast iteration**: Hot reload + TypeScript = rapid development
- ✅ **Future-proof**: OTA updates cho phép ship features nhanh

---

## Negative Consequences

- ⚠️ **Binary size**: App size ~50MB (acceptable cho ERP use case - không phải consumer app)
- ⚠️ **Expo dependency**: Phụ thuộc Expo ecosystem (mitigation: có thể eject to bare workflow nếu cần)
- ⚠️ **Custom native modules**: Một số modules cần custom dev clients (chưa xảy ra trong Week 1)

---

## Validation (Week 1 Results)

### What Worked Well ✅
1. Expo SDK 53 scaffold trong < 1 giờ
2. AsyncStorage + Supabase Auth integration seamless
3. expo-router file-based routing giống Next.js (team familiar)
4. TypeScript config issue resolved nhanh (custom tsconfig)
5. `@bella/shared` import works perfectly

### What Didn't Work ❌
1. Expo SDK 53's `module: "preserve"` requires TS 5.4+ (project has 5.3.3)
   - **Resolution**: Custom tsconfig without extending `expo/tsconfig.base`
   - **Time**: 15 minutes

---

## Links and References

- [Expo SDK 53 Documentation](https://docs.expo.dev/)
- [expo-router File-based Routing](https://docs.expo.dev/router/introduction/)
- [EAS Update (OTA)](https://docs.expo.dev/eas-update/introduction/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- **Spec Artifact**: `docs/implementation-artifacts/spec-mobile-week1-foundation.md`
- **Investigation**: `docs/implementation-artifacts/investigation-mobile-app-week-1-safety.md`

---

## Approval

**Approved By**: CTO  
**Review Status**: ✅ APPROVED (9.7/10)  
**Date**: 2026-06-19  
**Next Review**: After Week 4 (mid-Phase 1)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-06-19 | 1.0 | Initial decision + Week 1 validation | AI Agent + CTO |
