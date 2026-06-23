# 🔧 INTERNAL TESTER GUIDE - BELLA SPA MOBILE

**Target Audience**: Developers, QA team, Internal testers  
**Purpose**: Technical guide for testing mobile app via Expo Go development environment  
**Not for**: End-user KTVs (they should use `HUONG_DAN_CAI_DAT_CHO_KTV.md`)

---

## 🎯 OVERVIEW

This guide covers the technical setup for testing the Bella Spa mobile app using **Expo Go** during development and QA phases.

**Key Differences from End-User Guide**:
- Uses Expo Go (development tool)
- Requires same network as dev server
- Has access to dev tools and hot reload
- Can test unreleased features

---

## 📋 PREREQUISITES

### Required:
- [ ] iPhone (iOS 15+) or Android (10+) device
- [ ] Expo Go app installed
- [ ] Access to development server (IP address or QR code)
- [ ] Test account credentials (provided by dev team)
- [ ] Connected to **same WiFi network** as development server

### Optional:
- [ ] VS Code with React Native tools
- [ ] Access to Supabase dashboard (for debugging)
- [ ] Slack/communication channel for bug reporting

---

## 🍎 SETUP FOR iOS (iPhone/iPad)

### Step 1: Install Expo Go

1. Open **App Store**
2. Search for "**Expo Go**"
3. Tap **"Get"** to install
4. Wait for installation to complete

![App Store - Expo Go](https://via.placeholder.com/400x300/E91E63/FFFFFF?text=App+Store+%3E+Expo+Go)

### Step 2: Connect to Dev Server

#### Method A: Scan QR Code (Recommended)
1. Ensure iPhone is on **same WiFi** as dev machine
2. Dev team will provide QR code (from terminal or Expo Dev Tools)
3. Open **Camera** app (not Expo Go)
4. Point camera at QR code
5. Tap notification **"Open in Expo Go"**

![iOS - QR Code Scan](https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Camera+%3E+Scan+QR)

#### Method B: Manual URL Entry
1. Open **Expo Go** app
2. Tap **"Enter URL manually"**
3. Enter: `exp://192.168.x.x:8081` (get IP from dev team)
4. Tap **"Connect"**

### Step 3: Wait for Bundle to Load
- First load takes **30-60 seconds**
- Screen shows: "Building JavaScript bundle..."
- Once done, login screen appears

---

## 🤖 SETUP FOR ANDROID

### Step 1: Install Expo Go

1. Open **Google Play Store** (CH Play)
2. Search for "**Expo Go**"
3. Tap **"Install"**
4. Wait for installation to complete

![Play Store - Expo Go](https://via.placeholder.com/400x300/E91E63/FFFFFF?text=Play+Store+%3E+Expo+Go)

### Step 2: Connect to Dev Server

#### Method A: Scan QR Code via Expo Go (Recommended)
1. Ensure Android is on **same WiFi** as dev machine
2. Open **Expo Go** app
3. Tap **"Scan QR Code"** button
4. Dev team will provide QR code
5. Scan the QR code

![Android - Expo Go QR Scan](https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Expo+Go+%3E+Scan+QR)

#### Method B: Manual URL Entry
1. Open **Expo Go** app
2. Tap **"Enter URL manually"**
3. Enter: `exp://192.168.x.x:8081` (get IP from dev team)
4. Tap **"Connect"**

### Step 3: Wait for Bundle to Load
- First load takes **30-60 seconds**
- Screen shows: "Building JavaScript bundle..."
- Once done, login screen appears

---

## 🔐 TEST ACCOUNT CREDENTIALS

Use these test accounts for internal testing:

### Admin Account
- **Email**: `admin-test@bellaspa.vn`
- **Password**: `BellaTest2026!`
- **Role**: Admin (sees all sessions)

### KTV Test Accounts
| Email | Password | Role | Full Name | Expected Sessions |
|-------|----------|------|-----------|-------------------|
| `ktv1-test@bellaspa.vn` | `BellaTest2026!` | technician | Nguyễn Thị Hoa | 3 sessions today |
| `ktv2-test@bellaspa.vn` | `BellaTest2026!` | technician | Trần Thị Mai | 3 sessions today |
| `ktv3-test@bellaspa.vn` | `BellaTest2026!` | technician | Lê Thị Lan | 2 sessions today |

**Test Data Generation**: Run `docs/mobile-app/test-data-generator.sql` on staging to create test environment.

---

## 🧪 TESTING WORKFLOW

### 1. Initial Setup Test
- [ ] App loads without crashing
- [ ] Login screen displays correctly
- [ ] Can login with test account
- [ ] Navigates to home screen after login

### 2. Dashboard Test (KTV Account)
- [ ] **Stats Display**: Shows correct numbers (Tổng ca, Hoàn thành, Còn lại)
- [ ] **Today Sessions List**: Shows only assigned sessions (not all spa sessions)
- [ ] **Session Cards**: Display customer name, baby name, package, time
- [ ] **Pull-to-Refresh**: Works and reloads data

### 3. Dashboard Test (Admin Account)
- [ ] **Stats Display**: Shows spa-wide stats (all KTVs combined)
- [ ] **Today Sessions List**: Shows all tenant sessions
- [ ] **Session Cards**: Display KTV name for each session

### 4. Profile Screen Test
- [ ] Displays correct email, full name, role, tenant
- [ ] Role badge shows correct color (Pink for admin, Blue for KTV)
- [ ] Logout button works

### 5. Error Handling Test
- [ ] **No Internet**: Shows error message, has retry button
- [ ] **Invalid Credentials**: Shows clear error message
- [ ] **Server Down**: Graceful degradation, error UI appears
- [ ] **Empty State**: If no sessions, shows empty state message

### 6. Security Test (CRITICAL)
- [ ] **KTV Isolation**: KTV1 cannot see KTV2's sessions
- [ ] **Cross-Tenant**: Cannot access data from different tenant
- [ ] **Auth Required**: Cannot access app without login

---

## 🐛 COMMON DEVELOPMENT ISSUES

### Issue 1: "Could not connect to development server"

**Cause**: Phone and dev machine not on same network

**Fix**:
1. Confirm both devices on **same WiFi network**
2. Turn off **mobile data (4G)** on phone when using WiFi
3. Check dev server is running: `npm run mobile` in terminal
4. Check firewall not blocking port 8081

**Verification**:
```bash
# On dev machine, find local IP
ipconfig (Windows) or ifconfig (Mac/Linux)

# Ping from phone browser
http://192.168.x.x:8081
# Should see Expo dev tools page
```

---

### Issue 2: "Network request failed" when calling API

**Cause**: Supabase client not configured or wrong environment

**Fix**:
1. Check `apps/mobile/.env` file exists with correct Supabase URL and anon key
2. Verify environment variables loaded:
   ```typescript
   console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
   ```
3. Check network inspector in Expo Dev Tools

---

### Issue 3: "Invariant Violation" or TypeScript errors

**Cause**: Dependencies out of sync or cache issue

**Fix**:
```bash
# Clear all caches
cd apps/mobile
rm -rf node_modules
npm install

# Clear Expo cache
npx expo start -c

# Clear Metro bundler cache
npx react-native start --reset-cache
```

---

### Issue 4: Hot Reload not working

**Cause**: Dev tools connection lost

**Fix**:
1. Shake device to open Expo menu
2. Tap **"Reload"**
3. Or force close Expo Go and reopen

**iOS Shake Menu**: Shake device physically
**Android Shake Menu**: Press hardware menu button or shake

---

### Issue 5: White screen after login (no error)

**Cause**: Navigation issue or RLS blocking data

**Fix**:
1. Check console logs in Expo Dev Tools
2. Verify user has correct `tenant_id` and `role` in database
3. Check RLS policies allow user to read data:
   ```sql
   SELECT * FROM session_logs WHERE tenant_id = '<user-tenant-id>';
   ```
4. Check RPC functions exist and are granted to authenticated role

---

## 🔍 DEBUGGING TOOLS

### Expo Dev Tools (Web Interface)
1. Open browser to `http://localhost:19002` (auto-opens when running `npm run mobile`)
2. Features:
   - **Console**: View app logs
   - **Network**: Inspect API calls
   - **Performance**: Monitor render times
   - **Devices**: See connected devices

### React Native Debugger (Advanced)
1. Install: `brew install --cask react-native-debugger` (Mac) or download from GitHub
2. Shake device → **"Debug Remote JS"**
3. Open React Native Debugger (auto-connects)

### Viewing Logs
```bash
# View all logs
npx expo start --android # or --ios

# Filter by priority
npx react-native log-android | grep "ERROR"
npx react-native log-ios | grep "ERROR"
```

---

## 📊 TESTING CHECKLIST

Use this checklist for each test session:

### Before Testing
- [ ] Dev server running (`npm run mobile`)
- [ ] Database has test data (`test-data-generator.sql` executed)
- [ ] Expo Go installed and updated
- [ ] Phone on same WiFi as dev machine

### During Testing
- [ ] Test all user roles (admin, KTV1, KTV2, KTV3)
- [ ] Test happy paths (normal usage)
- [ ] Test error paths (no internet, wrong credentials)
- [ ] Test edge cases (no sessions, long names, special characters)
- [ ] Test on both iOS and Android if possible

### After Testing
- [ ] Document bugs with screenshots
- [ ] Report to dev team via Slack/GitHub Issues
- [ ] Clear test data if needed (cleanup script in `test-data-generator.sql`)

---

## 🚨 CRITICAL BUGS TO REPORT IMMEDIATELY

If you encounter any of these, **stop testing** and report immediately:

1. **Security Breach**: KTV can see other KTV's sessions
2. **Data Loss**: Sessions/customers disappearing
3. **Auth Bypass**: Can access app without login
4. **Crash Loop**: App crashes immediately on open
5. **Wrong Data**: Showing data from different tenant

**Reporting Format**:
```markdown
**Bug Title**: [CRITICAL] KTV can see other KTV sessions

**Steps to Reproduce**:
1. Login as ktv1-test@bellaspa.vn
2. Navigate to home screen
3. See sessions assigned to ktv2-test@bellaspa.vn

**Expected**: Should only see own sessions
**Actual**: Sees all spa sessions

**Environment**:
- Device: iPhone 13, iOS 16.5
- App Version: 1.0 (Pilot Phase)
- Expo SDK: 53.0.0

**Screenshots**: [attach]
```

---

## 🔄 HOT RELOAD & DEVELOPMENT

### Automatic Refresh (Fast Refresh)
- Save file in VS Code → App reloads automatically
- Preserves component state (doesn't reset navigation)
- Fast (1-2 seconds)

### Manual Reload
- Shake device → **"Reload"**
- Or force close Expo Go and reopen (slower, full reset)

### Disabling Fast Refresh (for testing)
1. Shake device
2. Toggle **"Enable Fast Refresh"** OFF
3. Now must manually reload after changes

---

## 📦 SWITCHING BETWEEN ENVIRONMENTS

### Staging vs Production
Edit `apps/mobile/.env`:

```env
# Staging
EXPO_PUBLIC_SUPABASE_URL=https://staging.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key

# Production
EXPO_PUBLIC_SUPABASE_URL=https://prod.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
```

**⚠️ Always verify which environment you're testing against!**

---

## 🎓 BEST PRACTICES FOR TESTERS

### DO:
- ✅ Test on both iOS and Android
- ✅ Test with slow network (simulate 3G in dev tools)
- ✅ Test offline behavior (turn off WiFi)
- ✅ Document steps to reproduce bugs
- ✅ Include screenshots/screen recordings
- ✅ Test with real-world data volumes (100+ sessions)

### DON'T:
- ❌ Test on production database
- ❌ Use real customer data for testing
- ❌ Share test account credentials publicly
- ❌ Skip testing error cases
- ❌ Assume "works on my device" = "works everywhere"

---

## 🔗 RELATED DOCUMENTS

For end-user documentation (KTVs):
- `HUONG_DAN_CAI_DAT_CHO_KTV.md` - Installation guide (no Expo Go)
- `THE_THAM_KHAO_NHANH_KTV.md` - Quick reference card

For deployment:
- `RPC_DEPLOYMENT_GUIDE.md` - Deploy RPCs to production
- `DEVICE_TESTING_CHECKLIST.md` - Real device testing procedures
- `PRODUCTION_PILOT_GUIDE.md` - Pilot program with real KTVs

For development:
- `RPC_PRODUCTION_REVIEW.md` - Security & performance review
- `test-data-generator.sql` - Generate test data

---

## 📞 SUPPORT CONTACTS

**Dev Team Lead**: _____________  
**QA Manager**: _____________  
**Slack Channel**: #bella-mobile-app  
**GitHub Issues**: https://github.com/bellaspahcm/bella-spa-erp/issues

---

**Happy Testing! 🧪**

---

*Internal Tester Guide for Bella Spa Mobile App*  
*Version 1.0 - Created: 2026-06-22*  
*For development and QA use only - Not for end users*
