# Pre-Week 4 Execution Checklist
**Mục đích:** Hướng dẫn từng bước để hoàn thành 3 rào cản chính trước khi bắt đầu Week 4  
**Thời gian ước tính:** 2-3 ngày  
**Người thực hiện:** Mobile Development Team + 2-3 KTV pilot users  
**Ngày tạo:** 2026-06-22  

---

## 📋 TỔNG QUAN

**3 Rào cản phải vượt qua:**
1. ✅ Deploy RPC lên production (2 giờ)
2. ✅ Test trên thiết bị thật (4-6 giờ)
3. ✅ Pilot production với KTV thật (2-3 ngày)

**Kết quả mong đợi:**
- RPC hoạt động trên production
- App chạy tốt trên iPhone và Android thật
- KTV stats hiển thị đúng (không lộ dữ liệu của KTV khác)
- Không có crash hoặc màn hình đen
- Realtime updates hoạt động

**Quy tắc vàng:**
- ❌ **KHÔNG** bỏ qua bất kỳ bước nào
- ❌ **KHÔNG** sang Week 4 nếu có 1 test FAIL
- ✅ **CÓ** rollback plan cho mỗi bước
- ✅ **CÓ** screenshot cho mọi bug tìm thấy

---

## 🎯 ĐIỀU KIỆN TIÊN QUYẾT

### Chuẩn bị môi trường

- [ ] **Git repository up-to-date**
  ```bash
  git checkout main
  git pull origin main
  ```
  ✅ Commit mới nhất: `c1474015` (Color contrast fixes)

- [ ] **Supabase CLI installed**
  ```bash
  supabase --version
  ```
  Phiên bản tối thiểu: `1.0.0+`

- [ ] **Access to production Supabase project**
  - Project ID: `[YOUR_PROD_PROJECT_ID]`
  - Database password: `[STORED_SECURELY]`
  - Dashboard: https://supabase.com/dashboard/project/[PROJECT_ID]

- [ ] **Expo CLI installed**
  ```bash
  npx expo --version
  ```

- [ ] **2 thiết bị thật sẵn sàng**
  - [ ] 1 iPhone (iOS 15.0+)
  - [ ] 1 Android Samsung (Android 10+)
  - [ ] Cả 2 đã cài Expo Go app
  - [ ] Cả 2 kết nối cùng WiFi với laptop dev

### Chuẩn bị test accounts

- [ ] **3 test accounts đã tạo trong production**
  - Admin: `admin.test@bellaspa.vn`
  - KTV A: `ktv.a.test@bellaspa.vn`
  - KTV B: `ktv.b.test@bellaspa.vn`

- [ ] **Test data đã có trong production**
  - Ít nhất 5 bookings cho hôm nay
  - Ít nhất 8 sessions phân bổ cho KTV A và KTV B
  - Package data đầy đủ

> 💡 **Tip:** Nếu chưa có test data, chạy script `docs/mobile-app/test-data-generator.sql` trên production

---

## ⏱️ TIMELINE TỔNG QUAN

| Bước | Nhiệm vụ | Thời gian | Người thực hiện |
|------|----------|-----------|-----------------|
| 1 | Deploy RPC to Production | 2 giờ | Dev Team |
| 2 | Device Testing - Setup | 1 giờ | Dev Team |
| 3 | Device Testing - Execution | 4-5 giờ | Dev Team |
| 4 | Bug Fixes (nếu cần) | 2-4 giờ | Dev Team |
| 5 | Production Pilot | 2-3 ngày | Dev Team + KTVs |

**Tổng thời gian:** 2-3 ngày làm việc

---

## 📍 BƯỚC 1: DEPLOY RPC TO PRODUCTION

**Thời gian:** 2 giờ  
**Tài liệu tham khảo:** `RPC_DEPLOYMENT_GUIDE.md`

### 1.1. Pre-deployment Checklist (15 phút)

- [ ] **Backup production database**
  ```bash
  # Tạo backup snapshot trên Supabase Dashboard
  # Settings → Database → Create backup
  ```
  Lưu backup ID: `__________________`

- [ ] **Verify migrations exist locally**
  ```bash
  ls -la supabase/migrations/ | grep -E "20260621_mobile_rpc|20260622_ktv_dashboard_stats"
  ```
  Phải thấy 2 files:
  - `20260621_mobile_rpc.sql` ✅
  - `20260622_ktv_dashboard_stats.sql` ✅

- [ ] **Review migration content**
  ```bash
  cat supabase/migrations/20260621_mobile_rpc.sql
  cat supabase/migrations/20260622_ktv_dashboard_stats.sql
  ```
  Kiểm tra:
  - Không có `DROP TABLE` nguy hiểm
  - Có `OR REPLACE` cho functions
  - Có comment giải thích

### 1.2. Deploy to Staging First (30 phút)

- [ ] **Link to staging project**
  ```bash
  supabase link --project-ref [STAGING_PROJECT_ID]
  ```

- [ ] **Push migrations to staging**
  ```bash
  supabase db push
  ```
  
  **Kết quả mong đợi:**
  ```
  ✔ Applying migration 20260621_mobile_rpc.sql...
  ✔ Applying migration 20260622_ktv_dashboard_stats.sql...
  Finished supabase db push.
  ```

- [ ] **Verify functions created on staging**
  ```sql
  -- Chạy query này trên Supabase Dashboard (Staging)
  SELECT routine_name, routine_type 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats');
  ```
  
  **Kết quả mong đợi:**
  ```
  routine_name                | routine_type
  ---------------------------|-------------
  rpc_mobile_today_sessions  | FUNCTION
  rpc_ktv_dashboard_stats    | FUNCTION
  ```

- [ ] **Test RPCs manually on staging**
  ```sql
  -- Test 1: rpc_mobile_today_sessions
  SELECT * FROM rpc_mobile_today_sessions(
    p_tenant_id := '[TEST_TENANT_ID]',
    p_user_id := '[TEST_USER_ID]',
    p_role := 'ktv',
    p_today := CURRENT_DATE
  );
  
  -- Test 2: rpc_ktv_dashboard_stats
  SELECT * FROM rpc_ktv_dashboard_stats(
    p_tenant_id := '[TEST_TENANT_ID]',
    p_ktv_id := '[TEST_KTV_ID]',
    p_today := CURRENT_DATE
  );
  ```
  
  **Kết quả mong đợi:**
  - Không có error
  - Có data trả về (hoặc empty array nếu không có sessions)
  - Response time < 500ms

### 1.3. Deploy to Production (45 phút)

- [ ] **Link to production project**
  ```bash
  supabase link --project-ref [PROD_PROJECT_ID]
  ```

- [ ] **Double-check you're on production**
  ```bash
  supabase status
  ```
  Xác nhận:
  - Project ID matches production
  - API URL matches production

- [ ] **Push migrations to production**
  ```bash
  supabase db push
  ```
  
  ⚠️ **CRITICAL:** Nếu thấy warning về "destructive changes", DỪNG LẠI và review lại migration.

- [ ] **Verify functions created on production**
  ```sql
  -- Chạy trên Supabase Dashboard (Production)
  SELECT routine_name, routine_type 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats');
  ```

- [ ] **Test RPCs with real production data**
  ```sql
  -- Test với real KTV account
  SELECT * FROM rpc_ktv_dashboard_stats(
    p_tenant_id := '[REAL_TENANT_ID]',
    p_ktv_id := '[REAL_KTV_ID]',
    p_today := CURRENT_DATE
  );
  ```
  
  **Kiểm tra:**
  - Data trả về có ý nghĩa (số sessions, completed count)
  - Không có null violations
  - Response time < 500ms

### 1.4. Monitor for 30 minutes (30 phút)

- [ ] **Check error logs**
  ```
  Supabase Dashboard → Logs → Database
  Filter: Last 30 minutes
  ```
  Tìm errors liên quan đến RPCs mới

- [ ] **Check performance**
  ```
  Supabase Dashboard → Reports → Database
  ```
  Query performance có tăng đột ngột không?

- [ ] **Test from mobile app (local dev)**
  ```bash
  cd apps/mobile
  npx expo start
  ```
  - Mở app trên simulator
  - Login with test account
  - Verify dashboard loads
  - Check Network tab for RPC calls

### 1.5. Rollback Plan (nếu có vấn đề)

**Nếu RPC deploy failed hoặc gây lỗi:**

- [ ] **Option 1: Drop functions**
  ```sql
  DROP FUNCTION IF EXISTS rpc_mobile_today_sessions(uuid, uuid, text, date);
  DROP FUNCTION IF EXISTS rpc_ktv_dashboard_stats(uuid, uuid, date);
  ```

- [ ] **Option 2: Restore from backup**
  ```
  Supabase Dashboard → Settings → Database → Restore from backup
  Select backup ID: [FROM STEP 1.1]
  ```

- [ ] **Notify team**
  - Post in Slack/Telegram: "RPC deployment rolled back, investigating"
  - Do NOT proceed to device testing

---

## 📍 BƯỚC 2: DEVICE TESTING - SETUP

**Thời gian:** 1 giờ  
**Tài liệu tham khảo:** `DEVICE_TESTING_CHECKLIST.md`

### 2.1. Chuẩn bị thiết bị (20 phút)

- [ ] **iPhone Setup**
  - Model: `_________________`
  - iOS Version: `_________________`
  - Expo Go installed: ✅
  - WiFi connected: ✅
  - Same network as laptop: ✅

- [ ] **Android Setup**
  - Model: `_________________`
  - Android Version: `_________________`
  - Expo Go installed: ✅
  - WiFi connected: ✅
  - Same network as laptop: ✅

### 2.2. Chuẩn bị test environment (20 phút)

- [ ] **Start local dev server**
  ```bash
  cd apps/mobile
  npx expo start --clear
  ```
  
  Lưu QR code URL hoặc IP address: `_________________`

- [ ] **Point to production Supabase**
  ```bash
  # Verify .env.local
  cat apps/mobile/.env.local
  ```
  
  Phải có:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://[PROD_PROJECT_ID].supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=[PROD_ANON_KEY]
  ```

- [ ] **Verify production data exists**
  ```sql
  -- Chạy trên production
  SELECT COUNT(*) FROM session_logs WHERE DATE(start_time) = CURRENT_DATE;
  ```
  Phải có ít nhất 5-8 sessions hôm nay

### 2.3. Chuẩn bị test accounts (20 phút)

- [ ] **Admin account**
  - Email: `_________________`
  - Password: `_________________`
  - Tenant ID: `_________________`
  - Expected: Thấy tất cả sessions

- [ ] **KTV A account**
  - Email: `_________________`
  - Password: `_________________`
  - User ID: `_________________`
  - Expected sessions hôm nay: `_____` ca

- [ ] **KTV B account**
  - Email: `_________________`
  - Password: `_________________`
  - User ID: `_________________`
  - Expected sessions hôm nay: `_____` ca

### 2.4. Chuẩ bị test report template (5 phút)

- [ ] **Copy report template**
  ```bash
  cp docs/mobile-app/DEVICE_TESTING_REPORT_TEMPLATE.md docs/mobile-app/DEVICE_TESTING_REPORT_$(date +%Y%m%d).md
  ```

- [ ] **Mở file để điền kết quả**
  File location: `docs/mobile-app/DEVICE_TESTING_REPORT_[DATE].md`

---

## 📍 BƯỚC 3: DEVICE TESTING - EXECUTION

**Thời gian:** 4-5 giờ  
**Tài liệu chi tiết:** `DEVICE_TESTING_SESSION_SCRIPT.md`

### 3.1. iPhone Testing (2-2.5 giờ)

**Test theo thứ tự:**

#### Test 1: Basic Login & Dashboard (30 phút)
- [ ] Scan QR code với Expo Go
- [ ] App loads successfully
- [ ] Login với Admin account
- [ ] Dashboard hiển thị KPI cards
- [ ] Sessions list hiển thị
- [ ] **Screenshot:** `ios_admin_dashboard.png`

#### Test 2: KTV Isolation (30 phút) 🔴 **CRITICAL**
- [ ] Logout Admin
- [ ] Login với KTV A
- [ ] Đếm số sessions hiển thị: `_____`
- [ ] Verify = expected count từ bước 2.3
- [ ] Logout KTV A
- [ ] Login với KTV B
- [ ] Đếm số sessions hiển thị: `_____`
- [ ] Verify = expected count từ bước 2.3
- [ ] **Screenshot:** `ios_ktv_a_sessions.png`, `ios_ktv_b_sessions.png`

#### Test 3: Pull to Refresh (15 phút)
- [ ] Login với KTV A
- [ ] Kéo xuống để refresh
- [ ] Loading indicator xuất hiện
- [ ] Data refresh thành công
- [ ] **Screenshot:** `ios_pull_refresh.png`

#### Test 4: Realtime Updates (30 phút)
- [ ] Mở dashboard trên iPhone (KTV A account)
- [ ] Mở web dashboard trên laptop
- [ ] Tạo session mới gán cho KTV A
- [ ] Quan sát iPhone: Data update trong vòng 5-30 giây
- [ ] **Screenshot:** `ios_realtime_before.png`, `ios_realtime_after.png`

#### Test 5: Offline Behavior (20 phút)
- [ ] Dashboard đã load xong
- [ ] Bật Airplane Mode
- [ ] Verify: Cached data vẫn hiển thị
- [ ] Thử pull-to-refresh → Error message hiển thị
- [ ] Tắt Airplane Mode
- [ ] Pull-to-refresh → Data loads lại
- [ ] **Screenshot:** `ios_offline_cached.png`, `ios_offline_error.png`

#### Test 6: Background Resume (15 phút)
- [ ] Mở dashboard
- [ ] Switch sang app khác (5 phút)
- [ ] Quay lại Bella ERP
- [ ] Verify: App không crash, data vẫn hiển thị
- [ ] Pull-to-refresh works

### 3.2. Android Testing (2-2.5 giờ)

**Lặp lại tất cả 6 tests như iPhone:**

- [ ] Test 1: Basic Login & Dashboard
- [ ] Test 2: KTV Isolation 🔴 **CRITICAL**
- [ ] Test 3: Pull to Refresh
- [ ] Test 4: Realtime Updates
- [ ] Test 5: Offline Behavior
- [ ] Test 6: Background Resume

**Screenshots:**
- [ ] `android_admin_dashboard.png`
- [ ] `android_ktv_a_sessions.png`
- [ ] `android_ktv_b_sessions.png`
- [ ] `android_pull_refresh.png`
- [ ] `android_realtime_before.png`, `android_realtime_after.png`
- [ ] `android_offline_cached.png`, `android_offline_error.png`

### 3.3. Cross-platform Verification (30 phút)

- [ ] **Verify consistent behavior**
  - iPhone và Android có cùng số sessions cho KTV A
  - iPhone và Android có cùng số sessions cho KTV B
  - Realtime updates hoạt động trên cả 2

- [ ] **Verify performance**
  - Dashboard load time < 3 giây trên cả 2
  - Pull-to-refresh < 2 giây trên cả 2
  - Không lag khi scroll

---

## 📍 BƯỚC 4: BUG FIXES (NẾU CẦN)

**Chỉ thực hiện nếu có bugs tìm thấy ở Bước 3**

### 4.1. Bug Classification (15 phút)

**Đánh giá mức độ nghiêm trọng:**

| Severity | Mô tả | Ví dụ | Action |
|----------|-------|-------|--------|
| 🔴 **CRITICAL** | Block pilot | Crash, data leak, KTV thấy sessions của nhau | PHẢI FIX |
| 🟡 **HIGH** | Làm giảm UX | Load chậm (>5s), error không rõ ràng | NÊN FIX |
| 🟢 **LOW** | Cosmetic | Màu sắc, spacing, typo | CÓ THỂ bỏ qua |

- [ ] **List all bugs found**
  ```
  1. [SEVERITY] Bug description
  2. [SEVERITY] Bug description
  3. ...
  ```

### 4.2. Fix Critical Bugs (2-4 giờ)

**CHỈ fix bugs CRITICAL và HIGH. LOW bugs có thể defer.**

- [ ] **Create fix branch**
  ```bash
  git checkout -b fix/pre-week4-device-testing
  ```

- [ ] **Fix bugs one by one**
  - Fix bug #1
  - Test locally
  - Fix bug #2
  - Test locally
  - ...

- [ ] **Commit fixes**
  ```bash
  git add .
  git commit -m "fix(mobile): Device testing bugs - [list bugs]"
  git push origin fix/pre-week4-device-testing
  ```

- [ ] **Re-test on devices**
  - Scan new QR code
  - Verify bug fixed
  - Mark test as PASS

### 4.3. Decision Point: GO or NO-GO?

**Điều kiện để GO (tiếp tục sang Pilot):**
- ✅ 0 CRITICAL bugs
- ✅ ≤ 2 HIGH bugs (và đã fix)
- ✅ KTV isolation test PASS trên cả iPhone và Android
- ✅ Realtime updates hoạt động

**Nếu NO-GO:**
- [ ] Document lý do: `_________________`
- [ ] Estimate thời gian fix: `_____` giờ/ngày
- [ ] **KHÔNG** tiếp tục sang Pilot
- [ ] Schedule lại device testing sau khi fix xong

---

## 📍 BƯỚC 5: PRODUCTION PILOT

**Thời gian:** 2-3 ngày  
**Tài liệu tham khảo:** `PRODUCTION_PILOT_GUIDE.md`

### 5.1. Pilot Setup (1 giờ)

- [ ] **Build production app**
  ```bash
  cd apps/mobile
  eas build --platform ios --profile preview
  eas build --platform android --profile preview
  ```
  
  Lưu build URLs:
  - iOS: `_________________`
  - Android: `_________________`

- [ ] **Recruit pilot users**
  - [ ] 1 Admin: `_________________`
  - [ ] KTV A: `_________________`
  - [ ] KTV B: `_________________`
  
  **Tiêu chí lựa chọn:**
  - Sẵn sàng dùng app hàng ngày
  - Có smartphone (iOS hoặc Android)
  - Có thể báo lỗi qua Zalo/Telegram

- [ ] **Send installation instructions**
  - [ ] Gửi link cài đặt
  - [ ] Gửi `HUONG_DAN_CAI_DAT_CHO_KTV.md` (tiếng Việt)
  - [ ] Gửi `THE_THAM_KHAO_NHANH_KTV.md` (quick reference)

### 5.2. Day 1 Monitoring (ngày đầu tiên)

- [ ] **Morning check (9:00 AM)**
  - [ ] Tất cả pilot users đã cài app thành công?
  - [ ] Tất cả đã login được?
  - [ ] Dashboard loads cho tất cả users?

- [ ] **Midday check (12:00 PM)**
  - [ ] Check Supabase logs: Có errors không?
  - [ ] Check với pilot users: Có vấn đề gì không?
  - [ ] KTV có thấy sessions của hôm nay không?

- [ ] **Evening check (6:00 PM)**
  - [ ] Hỏi feedback ban đầu qua Zalo/Telegram
  - [ ] Có bugs critical nào không?
  - [ ] Note: `_________________`

### 5.3. Day 2-3 Monitoring (ongoing)

- [ ] **Daily checklist**
  - Morning: Check logs
  - Midday: Check with users
  - Evening: Collect feedback

- [ ] **Metrics to track**
  - Login success rate: `_____%`
  - Dashboard load success: `_____%`
  - Crashes reported: `_____`
  - User satisfaction (1-5): `_____`

### 5.4. Pilot Completion (sau 2-3 ngày)

- [ ] **Collect feedback**
  - [ ] Admin feedback: `_________________`
  - [ ] KTV A feedback: `_________________`
  - [ ] KTV B feedback: `_________________`

- [ ] **Check success criteria** (từ `PILOT_SUCCESS_CRITERIA.md`)
  - [ ] Login success > 95%
  - [ ] Crash rate < 1%
  - [ ] Data accuracy = 100%
  - [ ] Dashboard load < 3s
  - [ ] User satisfaction ≥ 4/5

- [ ] **Fill pilot completion report**
  File: `docs/mobile-app/PILOT_COMPLETION_REPORT_[DATE].md`

---

## 🎯 FINAL GO/NO-GO DECISION

### ✅ GO to Week 4 nếu:
- [x] RPCs deployed và hoạt động
- [x] Device testing PASS (0 critical bugs)
- [x] Pilot thành công (≥80% success criteria met)
- [x] KTV stats chính xác
- [x] Không có data leaks

### ❌ NO-GO nếu:
- [ ] Còn bugs critical chưa fix
- [ ] Pilot users không hài lòng (<4/5)
- [ ] KTV stats sai
- [ ] Có security issues

---

## 📊 COMPLETION CHECKLIST

**Sau khi hoàn thành tất cả 5 bước:**

- [ ] **Update WEEK_3_POST_REVIEW_ACTION_PLAN.md**
  ```
  Phase 1: Pre-Week 4 Blockers
  ✅ RPC deployed to production
  ✅ Device testing complete (iPhone + Android)
  ✅ Production pilot complete (2-3 KTVs)
  ✅ All tests passed
  ```

- [ ] **Commit all test reports**
  ```bash
  git add docs/mobile-app/DEVICE_TESTING_REPORT_*.md
  git add docs/mobile-app/PILOT_COMPLETION_REPORT_*.md
  git commit -m "docs(mobile): Complete Pre-Week 4 device testing and pilot"
  git push origin main
  ```

- [ ] **Announce to team**
  ```
  🎉 Pre-Week 4 blockers COMPLETE!
  
  ✅ RPCs live on production
  ✅ Tested on iPhone & Android
  ✅ 2-3 day pilot successful
  ✅ Ready for Week 4 (QR Check-in + GPS)
  ```

---

## 🆘 ROLLBACK & EMERGENCY PROCEDURES

### Nếu gặp vấn đề nghiêm trọng:

**1. RPC Issues:**
```sql
-- Rollback RPCs
DROP FUNCTION IF EXISTS rpc_mobile_today_sessions;
DROP FUNCTION IF EXISTS rpc_ktv_dashboard_stats;

-- Restore from backup
-- (see Bước 1.5)
```

**2. App Crashes:**
```bash
# Revert to previous stable commit
git revert [LAST_GOOD_COMMIT]
git push origin main

# Rebuild app
cd apps/mobile
eas build --platform all
```

**3. Data Leaks (KTV thấy dữ liệu của nhau):**
```
🚨 CRITICAL: STOP PILOT IMMEDIATELY
1. Notify all pilot users to stop using app
2. Investigate RPC logic (assigned_ktv_id filter)
3. Fix and re-deploy
4. Re-test device testing from scratch
```

---

## 📞 CONTACTS & ESCALATION

**Nếu cần hỗ trợ:**
- Technical issues: [Dev Team Lead]
- Pilot coordination: [Project Manager]
- Production access: [DevOps/Admin]
- Emergency: [CTO/Technical Director]

---

**Document Created:** 2026-06-22  
**Last Updated:** 2026-06-22  
**Status:** ✅ Ready for execution  
**Next Step:** Follow Bước 1 (Deploy RPC to Production)
