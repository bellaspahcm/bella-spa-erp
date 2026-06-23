# EAS Build Failure Analysis
**Date:** June 24, 2026 02:30  
**Issue:** Repeated "Install dependencies" phase failures  
**Status:** 🔴 Blocking - Switch to local Gradle build

---

## Failed Builds

| Build ID | Time | Phase Failed | Root Cause |
|----------|------|--------------|------------|
| `166c29c8` | 21:26 - 02:00 | Install dependencies | `@bella/shared` in login.tsx |
| `279a13e3` | ~22:30 | Install dependencies | `@bella/shared` in home.tsx, RoleBadge, contexts, services |
| `cec064b4` | ~02:30 | Install dependencies | Unknown (all @bella/shared removed) |

---

## Root Cause Analysis

### Build #1 & #2: Workspace Dependencies
**Problem:** Mobile app imported utilities from `@bella/shared` monorepo package  
**Why it fails:** EAS Build runs `npm install` in isolation. Workspace packages (`workspace:*`) are not available on npm registry.

**Fix Applied:**
- Created `apps/mobile/src/lib/shared-utils.ts` with all needed utilities
- Replaced all imports from `@bella/shared` to local `shared-utils`
- Verified no remaining `@bella/shared` imports

### Build #3: Unknown Dependency Issue
**Problem:** Still fails at "Install dependencies" phase despite removing all `@bella/shared`  
**Possible causes:**
1. **Transitive dependencies:** Some npm package may depend on unavailable workspace package
2. **Cache issues:** EAS Build may be using stale cache
3. **React Native version mismatch:** Expo 54 uses React Native 0.79.6 (very new)
4. **Sentry package conflicts:** `@sentry/react-native` v6.14 may have peer dependency issues with React 19
5. **npm resolution:** EAS uses npm, but local dev uses npm workspaces with different resolution

**Cannot diagnose further without access to full build logs.**

---

## Decision: Switch to Local Gradle Build

### Why Local Build?
✅ **Full control:** Can see exact error messages  
✅ **Faster iteration:** No queue wait (30-90 min per EAS build)  
✅ **Already prebuilt:** `android/` folder exists from `npx expo prebuild`  
✅ **Works offline:** No dependency on EAS infrastructure  

### Downsides
⚠️ Requires Android SDK installed locally  
⚠️ APK is debug build (larger size, not optimized)  
⚠️ Need to manage signing keys manually for production  

---

## Next Steps

### Option A: Local Gradle Build (Recommended)

1. **Verify Android SDK installed:**
   ```cmd
   where java
   where adb
   ```

2. **Build APK:**
   ```cmd
   cd apps\mobile\android
   .\gradlew assembleRelease
   ```

3. **Output location:**
   ```
   apps\mobile\android\app\build\outputs\apk\release\app-release.apk
   ```

4. **Share with pilot KTVs** via Telegram/Zalo

### Option B: Debug EAS Build (Time-consuming)

1. **Request detailed logs** from Expo dashboard
2. **Check package.json** for any remaining workspace refs
3. **Try clearing EAS cache:** `eas build:configure`
4. **Simplify dependencies:** Remove Sentry temporarily
5. **Downgrade React:** Try React 18 instead of 19

### Option C: Use Expo Go (Quick Test)

1. **Skip building entirely**
2. **Test via Expo Go app** (already attempted, failed due to network)
3. **Only for development, not production pilot**

---

## Recommendation

**Proceed with Option A (Local Gradle Build):**
- ✅ Fastest path to APK
- ✅ Good enough for pilot testing (2-3 KTVs)
- ✅ Can upgrade to EAS Build later for production

**Defer EAS Build debugging until after pilot:**
- Pilot will validate if app works functionally
- If pilot successful, invest time in EAS Build setup
- If pilot fails, EAS Build issues are moot anyway

---

## Lessons Learned

1. **Monorepo + Mobile = Pain:**
   - EAS Build doesn't support workspace dependencies
   - Mobile app must be 100% standalone
   - Inline all shared utilities or publish separate npm package

2. **Test builds early:**
   - Should have attempted EAS Build in Week 1
   - Discovered dependency issues too late

3. **Local build is a valid fallback:**
   - Don't over-invest in cloud build if local works
   - For small pilots, local APK is sufficient

---

## Files Affected

**Created:**
- `apps/mobile/src/lib/shared-utils.ts` (267 lines)

**Modified:**
- `apps/mobile/app/(app)/home.tsx` - Removed `@bella/shared` imports
- `apps/mobile/app/(auth)/login.tsx` - Inlined validators
- `apps/mobile/src/contexts/AuthContext.tsx` - Use local types
- `apps/mobile/src/components/RoleBadge.tsx` - Use local utils
- `apps/mobile/src/hooks/useDashboardStats.ts` - Use local utils
- `apps/mobile/src/services/**/*.ts` (5 files) - Use local utils

**Total:** 11 files changed, ~300 lines added

---

**Next Action:** Attempt local Gradle build  
**Estimated Time:** 10-15 minutes  
**Success Criteria:** APK file generated in `android/app/build/outputs/apk/`
