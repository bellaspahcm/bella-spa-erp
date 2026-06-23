# Device Testing Session Script
**Mục đích:** Hướng dẫn chi tiết từng phút để test app trên thiết bị thật  
**Thời gian:** 4-5 giờ (2-2.5 giờ/thiết bị)  
**Người thực hiện:** 1 tester (có thể tự test)  
**Ngày tạo:** 2026-06-22  

---

## 📋 TỔNG QUAN

**Mục tiêu chính:**
1. ✅ Verify app chạy tốt trên thiết bị thật
2. ✅ Verify KTV không thấy dữ liệu của KTV khác (CRITICAL)
3. ✅ Verify realtime updates hoạt động
4. ✅ Verify offline/background behavior
5. ✅ Tìm và document tất cả bugs

**Test sequence:**
```
iPhone Tests (2-2.5h)
  → Bug fixes (if needed)
    → Android Tests (2-2.5h)
      → Cross-platform verification
        → Final report
```

**Nguyên tắc quan trọng:**
- ⏱️ Tuân thủ thời gian cho mỗi test (không kéo dài quá)
- 📸 Chụp screenshot cho MỌI test (PASS hoặc FAIL)
- 🐛 Document bugs ngay khi phát hiện (không để sau)
- ⛔ Nếu gặp CRITICAL bug → STOP và fix trước khi tiếp tục

---

## 📱 THIẾT BỊ CẦN CHUẨN BỊ

### Trước khi bắt đầu:

**Laptop (Dev Machine):**
- [ ] Expo dev server đang chạy (`npx expo start`)
- [ ] Terminal mở để xem logs
- [ ] Supabase Dashboard mở (để tạo test data)
- [ ] Report template mở sẵn để điền kết quả

**iPhone:**
- [ ] Expo Go app đã cài
- [ ] WiFi cùng mạng với laptop
- [ ] Pin > 50%
- [ ] Không có notifications làm phiền

**Android:**
- [ ] Expo Go app đã cài
- [ ] WiFi cùng mạng với laptop
- [ ] Pin > 50%
- [ ] Developer mode enabled (optional, để debug)

**Test Accounts (đã verify có data):**
- [ ] Admin: `_________________`
- [ ] KTV A: `_________________` (Expected: `___` sessions today)
- [ ] KTV B: `_________________` (Expected: `___` sessions today)

---

## 🍎 PHẦN 1: iPHONE TESTING (2-2.5 giờ)

### ⏱️ 00:00 - 00:30 | TEST 1: Basic Login & Dashboard

**Mục tiêu:** Verify app loads và hiển thị đúng data cho Admin

#### Bước 1.1: Scan QR Code (5 phút)

1. Mở Expo Go trên iPhone
2. Tap "Scan QR Code"
3. Quét QR từ terminal/Expo dashboard

**Kết quả mong đợi:**
- [ ] App bắt đầu build (trắng màn hình trong 5-10s là bình thường)
- [ ] Không có error popup từ Expo
- [ ] Màn hình login xuất hiện

**Nếu FAIL:**
- Screenshot error message
- Check terminal logs: `[ERROR]` có gì không?
- Verify: Laptop và iPhone cùng WiFi?

#### Bước 1.2: Login Admin (5 phút)


1. Nhập số điện thoại Admin
2. Tap "Gửi mã OTP"
3. Lấy OTP từ console/database (dev mode)
4. Nhập OTP
5. Tap "Đăng nhập"

**Kết quả mong đợi:**
- [ ] OTP sent successfully
- [ ] Login thành công
- [ ] Redirect đến Dashboard (màn hình hồng)

**Nếu FAIL:**
- Screenshot error
- Check: `.env.local` có đúng production Supabase URL?
- Check: Test account có tồn tại trong production DB?

#### Bước 1.3: Verify Dashboard Content (10 phút)

**Check Header:**
- [ ] Hiển thị: "Xin chào, [Tên Admin]!"
- [ ] Hiển thị: Tên chi nhánh (tenant name)
- [ ] Badge vai trò: "ADMIN" hoặc "QUẢN LÝ"

**Check KPI Cards (Admin View):**
- [ ] Card 1: "Lịch hôm nay" - Số ≥ 0
- [ ] Card 2: "Đang phục vụ" - Số ≥ 0
- [ ] Card 3: "Doanh thu" - Formatted currency (VD: "1.200.000 ₫")

**Check Sessions List:**
- [ ] Title: "Lịch hôm nay"
- [ ] Có ít nhất 1 session card
- [ ] Session card hiển thị:
  - Customer name
  - Package name
  - Time slot
  - KTV name
  - Status badge

**Screenshot:** `ios_01_admin_dashboard.png`

#### Bước 1.4: Verify Data Accuracy (10 phút)

1. Mở Supabase Dashboard trên laptop
2. Run query:
   ```sql
   SELECT COUNT(*) FROM session_logs 
   WHERE DATE(start_time) = CURRENT_DATE 
   AND tenant_id = '[ADMIN_TENANT_ID]';
   ```
3. So sánh số sessions trong database vs số hiển thị trên app

**Verify:**
- [ ] Số lượng sessions khớp
- [ ] Tên KTV khớp
- [ ] Thời gian khớp

**Nếu không khớp:** 🔴 CRITICAL BUG - Document ngay

---

### ⏱️ 00:30 - 01:00 | TEST 2: KTV Isolation 🔴 **CRITICAL TEST**

**Mục tiêu:** Verify KTV CHỈ thấy sessions được gán cho mình

#### Bước 2.1: Logout Admin (2 phút)

1. Tap "Cá nhân" tab (bottom navigation)
2. Scroll xuống
3. Tap "Đăng xuất"
4. Confirm popup

**Verify:**
- [ ] Redirect về màn hình login

#### Bước 2.2: Login KTV A (5 phút)

1. Nhập số điện thoại KTV A
2. Nhập OTP
3. Đăng nhập

**Verify:**
- [ ] Login thành công
- [ ] Dashboard loads
- [ ] Badge: "KỸ THUẬT VIÊN"

#### Bước 2.3: Count KTV A Sessions (10 phút)

**Check KPI Cards (KTV View):**
- [ ] Card 1: "Tổng ca" - Ghi số: `_____`
- [ ] Card 2: "Hoàn thành" - Số
- [ ] Card 3: "Còn lại" - Số

**Check Sessions List:**
- [ ] Title: "Lịch của tôi hôm nay"
- [ ] Đếm số session cards: `_____`

**Cross-check with Database:**
```sql
SELECT COUNT(*) FROM session_logs 
WHERE DATE(start_time) = CURRENT_DATE 
AND assigned_ktv_id = '[KTV_A_USER_ID]';
```
Database count: `_____`

**CRITICAL VERIFICATION:**
- [ ] App count = Database count ✅
- [ ] Không thấy sessions của KTV khác ✅

**Screenshot:** `ios_02_ktv_a_dashboard.png`

#### Bước 2.4: Verify Session Details (5 phút)

Tap vào 1 session card (nếu có)

**Verify:**
- [ ] Session detail hiển thị đầy đủ
- [ ] Customer name hiển thị
- [ ] Package details hiển thị
- [ ] Assigned KTV = KTV A


#### Bước 2.5: Login KTV B (8 phút)

1. Logout KTV A
2. Login với KTV B account
3. Đếm sessions: `_____`
4. Cross-check database:
   ```sql
   SELECT COUNT(*) FROM session_logs 
   WHERE DATE(start_time) = CURRENT_DATE 
   AND assigned_ktv_id = '[KTV_B_USER_ID]';
   ```

**CRITICAL VERIFICATION:**
- [ ] KTV B count ≠ KTV A count ✅
- [ ] KTV B chỉ thấy sessions của mình ✅
- [ ] Không có sessions trùng lặp giữa KTV A và B ✅

**Screenshot:** `ios_03_ktv_b_dashboard.png`

**Nếu KTV B thấy sessions của KTV A:** 🚨 **CRITICAL DATA LEAK** - STOP ngay

---

### ⏱️ 01:00 - 01:15 | TEST 3: Pull to Refresh

**Mục tiêu:** Verify refresh mechanism hoạt động

#### Bước 3.1: Trigger Refresh (5 phút)

1. Ở màn hình Dashboard (KTV A account)
2. Kéo xuống từ đầu sessions list
3. Quan sát loading indicator

**Verify:**
- [ ] Loading spinner xuất hiện
- [ ] List "nhảy" một chút (animation)
- [ ] Sau 1-2 giây: data refresh xong
- [ ] Không có error message

**Screenshot:** `ios_04_pull_refresh.png` (chụp khi đang loading)

#### Bước 3.2: Verify Data Updated (5 phút)

1. Note thời gian refresh: `_____`
2. Check terminal logs: Có API call mới không?
3. Verify: Timestamp của sessions có update không?

**Expected behavior:**
- [ ] RPC call trong logs: `rpc_mobile_today_sessions`
- [ ] Response time < 2 seconds
- [ ] Không có error logs

#### Bước 3.3: Rapid Refresh Test (5 phút)

1. Kéo refresh liên tục 3 lần
2. Quan sát: Có lag/crash không?

**Verify:**
- [ ] App không crash
- [ ] Mỗi lần refresh hoàn thành
- [ ] Không bị "stuck" ở loading state

---

### ⏱️ 01:15 - 01:45 | TEST 4: Realtime Updates

**Mục tiêu:** Verify realtime subscriptions hoạt động

#### Bước 4.1: Setup (10 phút)

**Trên iPhone:**
- Dashboard đang mở (KTV A account)
- Note số sessions hiện tại: `_____`

**Trên Laptop:**
- Mở Supabase Dashboard
- Mở table `session_logs`
- Chuẩn bị INSERT query

**Screenshot:** `ios_05_realtime_before.png`

#### Bước 4.2: Create New Session (5 phút)

**Chạy SQL trên laptop:**
```sql
INSERT INTO session_logs (
  booking_id,
  assigned_ktv_id,
  start_time,
  estimated_duration,
  status,
  tenant_id
) VALUES (
  '[TEST_BOOKING_ID]',
  '[KTV_A_USER_ID]',
  NOW(),
  90,
  'scheduled',
  '[TENANT_ID]'
);
```

**Start timer:** `_____` (note thời gian thực hiện INSERT)

#### Bước 4.3: Observe iPhone (15 phút)

**Quan sát iPhone trong 30 giây:**
- [ ] Có animation/flash không?
- [ ] Sessions list có thêm 1 session mới không?

**Note thời điểm update xuất hiện:** `_____`

**Tính latency:**
```
Latency = [Thời điểm update] - [Thời điểm INSERT]
```
Latency: `_____` giây

**Expected:** < 30 giây  
**Good:** < 10 giây  
**Excellent:** < 5 giây

**Screenshot:** `ios_06_realtime_after.png`

#### Bước 4.4: Update Session Status (10 phút)

1. **Trên laptop:** Update status của session vừa tạo
   ```sql
   UPDATE session_logs 
   SET status = 'in_progress' 
   WHERE id = '[NEW_SESSION_ID]';
   ```

2. **Quan sát iPhone:** Status badge có đổi màu không?

**Verify:**
- [ ] Status update trong < 30 giây
- [ ] Badge color changes (scheduled → in_progress)

**Nếu realtime KHÔNG hoạt động:**
- Check terminal logs: Có subscription errors không?
- Check Supabase Dashboard → Logs: Có connection issues không?
- Note: Realtime failures = HIGH priority bug

---

### ⏱️ 01:45 - 02:05 | TEST 5: Offline Behavior

**Mục tiêu:** Verify cached data và error handling

#### Bước 5.1: Load Data First (5 phút)

1. Dashboard đang hiển thị sessions
2. Note số sessions: `_____`
3. Verify: Tất cả data đã load xong

**Screenshot:** `ios_07_online_data.png`

#### Bước 5.2: Go Offline (10 phút)

1. Swipe up (Control Center)
2. Bật **Airplane Mode** ✈️
3. Quay lại app

**Verify cached data:**
- [ ] Sessions list vẫn hiển thị (không biến mất)
- [ ] KPI cards vẫn hiển thị
- [ ] Không có loading spinner (vì đang offline)

**Screenshot:** `ios_08_offline_cached.png`

#### Bước 5.3: Try Refresh Offline (5 phút)

1. Kéo xuống để refresh
2. Quan sát error message

**Expected behavior:**
- [ ] Error UI xuất hiện
- [ ] Message rõ ràng (VD: "Không có kết nối mạng")
- [ ] Có nút "Thử lại"
- [ ] Cached data vẫn hiển thị phía dưới

**Screenshot:** `ios_09_offline_error.png`


#### Bước 5.4: Go Back Online (10 phút)

1. Tắt Airplane Mode
2. Quay lại app
3. Tap nút "Thử lại" (hoặc pull-to-refresh)

**Verify:**
- [ ] Loading spinner xuất hiện
- [ ] Data refresh thành công
- [ ] Error message biến mất
- [ ] Sessions list update với data mới nhất

**Screenshot:** `ios_10_back_online.png`

---

### ⏱️ 02:05 - 02:20 | TEST 6: Background Resume

**Mục tiêu:** Verify app không crash khi resume từ background

#### Bước 6.1: Open Dashboard (5 phút)

1. Login với KTV A
2. Dashboard loads completely
3. Note thời gian: `_____`

#### Bước 6.2: Go Background (5 phút)

1. Swipe up (Home gesture)
2. Mở Safari/Messages app
3. Dùng app khác 5 phút
4. **Set timer 5 phút - đợi**

#### Bước 6.3: Resume App (5 phút)

1. Swipe up → App Switcher
2. Tap vào Bella ERP thumbnail
3. Quan sát: App có crash không?

**Verify:**
- [ ] App không crash
- [ ] Dashboard vẫn hiển thị (không về login screen)
- [ ] Data vẫn hiển thị (cached)
- [ ] Pull-to-refresh hoạt động

**Screenshot:** `ios_11_after_resume.png`

#### Bước 6.4: Long Background Test (Optional - 10 phút)

1. Leave app background 15-30 phút
2. Resume lại

**Verify:**
- [ ] App có thể bị kick về login (iOS memory management) - OK
- [ ] Hoặc: Dashboard vẫn hiển thị và có thể refresh - OK
- [ ] KHÔNG crash khi resume - Must NOT crash

---

### ⏱️ 02:20 - 02:30 | iPhone Testing Summary

#### Bug Summary

**Count bugs found:**
- 🔴 Critical bugs: `_____`
- 🟡 High bugs: `_____`
- 🟢 Low bugs: `_____`

**List all bugs:**
```
1. [SEVERITY] [Test #] Bug description
2. [SEVERITY] [Test #] Bug description
...
```

#### Decision Point: Continue to Android?

**Nếu có CRITICAL bugs:**
- [ ] ⛔ **STOP** - Không test Android yet
- [ ] Document bugs chi tiết
- [ ] Estimate fix time
- [ ] Create fix branch

**Nếu 0 Critical bugs:**
- [ ] ✅ **CONTINUE** to Android testing
- [ ] Note High/Low bugs để fix sau
- [ ] Take 10-minute break ☕

---

## 🤖 PHẦN 2: ANDROID TESTING (2-2.5 giờ)

### ⏱️ 00:00 - 00:30 | TEST 7: Basic Login & Dashboard (Android)

**Lặp lại TEST 1 với Android:**

#### Bước 7.1: Scan QR Code (5 phút)

1. Mở Expo Go trên Android
2. Scan QR code
3. Wait for app to build

**Verify:**
- [ ] App loads successfully
- [ ] Login screen appears

**Screenshot:** `android_01_login.png`

#### Bước 7.2: Login Admin (10 phút)

1. Login với Admin account
2. Verify dashboard loads
3. Check KPI cards

**Verify:**
- [ ] Same data as iPhone
- [ ] No layout issues on Android
- [ ] Cards render correctly

**Screenshot:** `android_02_admin_dashboard.png`

#### Bước 7.3: Verify Layout Differences (15 phút)

**Android-specific checks:**
- [ ] Bottom navigation tay trong được không? (notch handling)
- [ ] Font rendering OK? (không bị pixelated)
- [ ] Colors match iOS? (không bị washed out)
- [ ] Touch targets đủ lớn? (44x44dp minimum)

**Note any Android-specific issues:** `_________________`

---

### ⏱️ 00:30 - 01:00 | TEST 8: KTV Isolation (Android) 🔴 **CRITICAL**

**Lặp lại TEST 2 với Android:**

#### Bước 8.1: Login KTV A (10 phút)

1. Logout Admin
2. Login KTV A
3. Count sessions: `_____`

**Verify:**
- [ ] Same count as iPhone
- [ ] Only KTV A's sessions visible

**Screenshot:** `android_03_ktv_a_dashboard.png`

#### Bước 8.2: Login KTV B (10 phút)

1. Logout KTV A
2. Login KTV B
3. Count sessions: `_____`

**CRITICAL VERIFICATION:**
- [ ] KTV B count matches iPhone test
- [ ] No data leaks
- [ ] Sessions isolated correctly

**Screenshot:** `android_04_ktv_b_dashboard.png`

#### Bước 8.3: Cross-Platform Consistency (10 phút)

**Compare iPhone vs Android:**

| Metric | iPhone | Android | Match? |
|--------|--------|---------|--------|
| KTV A sessions | `___` | `___` | [ ] |
| KTV B sessions | `___` | `___` | [ ] |
| Admin total | `___` | `___` | [ ] |

**Nếu không match:** 🔴 CRITICAL - Platform-specific bug

---

### ⏱️ 01:00 - 01:15 | TEST 9: Pull to Refresh (Android)

**Lặp lại TEST 3:**

1. Pull down to refresh
2. Observe loading indicator
3. Verify data updates

**Android-specific:**
- [ ] RefreshControl animation smooth? (không giật lag)
- [ ] Loading spinner visible? (có thể khác màu vs iOS)

**Screenshot:** `android_05_pull_refresh.png`

---

### ⏱️ 01:15 - 01:45 | TEST 10: Realtime Updates (Android)

**Lặp lại TEST 4:**

1. Dashboard mở (KTV A)
2. Create session via SQL
3. Time latency: `_____` giây

**Verify:**
- [ ] Realtime works on Android
- [ ] Latency similar to iPhone (±5 giây)
- [ ] No subscription errors

**Screenshots:** `android_06_realtime_before.png`, `android_07_realtime_after.png`

---

### ⏱️ 01:45 - 02:05 | TEST 11: Offline Behavior (Android)

**Lặp lại TEST 5:**

1. Load dashboard
2. Enable Airplane Mode
3. Verify cached data visible
4. Try refresh → Error message
5. Disable Airplane Mode
6. Refresh works

**Android-specific:**
- [ ] Airplane mode icon hiển thị trên status bar
- [ ] Error message styling OK on Android

**Screenshots:** `android_08_offline_cached.png`, `android_09_offline_error.png`

---

### ⏱️ 02:05 - 02:20 | TEST 12: Background Resume (Android)

**Lặp lại TEST 6:**

1. Open dashboard
2. Go background (Home button)
3. Wait 5 minutes
4. Resume app

**Android-specific:**
- [ ] App không bị killed bởi Android memory manager
- [ ] Hoặc: Gracefully restart nếu bị killed
- [ ] Data persists hoặc refresh smoothly

**Screenshot:** `android_10_after_resume.png`


---

### ⏱️ 02:20 - 02:30 | Android Testing Summary

#### Platform Comparison

| Feature | iPhone | Android | Status |
|---------|--------|---------|--------|
| Login | PASS/FAIL | PASS/FAIL | ✅/❌ |
| KTV Isolation | PASS/FAIL | PASS/FAIL | ✅/❌ |
| Pull Refresh | PASS/FAIL | PASS/FAIL | ✅/❌ |
| Realtime | PASS/FAIL | PASS/FAIL | ✅/❌ |
| Offline | PASS/FAIL | PASS/FAIL | ✅/❌ |
| Background | PASS/FAIL | PASS/FAIL | ✅/❌ |

#### Android-Specific Bugs

**List bugs chỉ xuất hiện trên Android:**
```
1. [SEVERITY] Bug description
2. [SEVERITY] Bug description
```

---

## 📊 PHẦN 3: FINAL VERIFICATION (30 phút)

### ⏱️ 00:00 - 00:15 | Performance Comparison

#### Metric Collection

| Metric | iPhone | Android | Target | Status |
|--------|--------|---------|--------|--------|
| Dashboard load time | `___s` | `___s` | <3s | ✅/❌ |
| Refresh time | `___s` | `___s` | <2s | ✅/❌ |
| Realtime latency | `___s` | `___s` | <30s | ✅/❌ |
| Session detail load | `___s` | `___s` | <1s | ✅/❌ |

**Performance issues found:** `_________________`

---

### ⏱️ 00:15 - 00:30 | Bug Triage & Prioritization

#### All Bugs Found

**🔴 CRITICAL (Must fix before pilot):**
```
1. [Platform] Bug description
   Impact: [Describe user impact]
   Steps to reproduce: [Detailed steps]
   Expected: [What should happen]
   Actual: [What happened]
   Screenshot: [Filename]

2. ...
```

**🟡 HIGH (Should fix before pilot):**
```
1. [Platform] Bug description
   ...
```

**🟢 LOW (Can defer to Week 4+):**
```
1. [Platform] Bug description
   ...
```

#### Fix Estimate

- Critical bugs count: `_____`
- Estimated fix time: `_____` hours
- Can start pilot? **YES / NO**

---

## 📝 PHẦN 4: REPORTING (30 phút)

### Report Checklist

- [ ] **Fill `DEVICE_TESTING_REPORT_[DATE].md`**
  - Executive summary
  - All test results (PASS/FAIL)
  - Bug list with severity
  - Screenshots attached
  - Recommendations

- [ ] **Organize screenshots**
  ```bash
  mkdir -p docs/mobile-app/screenshots/device-testing-[DATE]/
  mv *.png docs/mobile-app/screenshots/device-testing-[DATE]/
  ```

- [ ] **Commit report**
  ```bash
  git add docs/mobile-app/DEVICE_TESTING_REPORT_*.md
  git add docs/mobile-app/screenshots/
  git commit -m "test(mobile): Complete device testing on iPhone and Android"
  git push origin main
  ```

---

## 🎯 GO/NO-GO DECISION

### GO Criteria (All must be met)

- [ ] ✅ 0 CRITICAL bugs
- [ ] ✅ KTV isolation verified on both platforms
- [ ] ✅ Realtime works on both platforms
- [ ] ✅ Performance acceptable (<3s dashboard load)
- [ ] ✅ No crashes during testing
- [ ] ✅ Offline handling graceful

### NO-GO Conditions (Any one blocks pilot)

- [ ] ❌ CRITICAL bugs found
- [ ] ❌ KTV data leak detected
- [ ] ❌ Frequent crashes
- [ ] ❌ Realtime completely broken
- [ ] ❌ Performance unacceptable (>5s load times)

---

## 🔧 APPENDIX: COMMON ISSUES & FIXES

### Issue 1: Expo Go Connection Failed

**Symptoms:** Can't connect to dev server

**Fixes:**
1. Check WiFi: Both devices same network?
2. Restart Expo server: `Ctrl+C`, then `npx expo start`
3. Try LAN mode: Press `s` in terminal → Switch to LAN
4. Check firewall: Allow Node.js through firewall

### Issue 2: Login OTP Not Working

**Symptoms:** OTP verification fails

**Fixes:**
1. Check Supabase auth settings
2. Verify phone number format (+84...)
3. Check auth logs in Supabase Dashboard
4. Use email login as fallback (if implemented)

### Issue 3: Dashboard Blank/White Screen

**Symptoms:** Dashboard loads but no content

**Fixes:**
1. Check terminal for errors
2. Verify RPC functions deployed: Run SQL check
3. Check network tab: RPC calls returning data?
4. Try different account: Admin vs KTV

### Issue 4: Realtime Not Working

**Symptoms:** Manual SQL INSERT doesn't update app

**Fixes:**
1. Check Supabase realtime enabled on `session_logs` table
2. Verify subscription in code: Look for `supabase.channel()`
3. Check browser console: Subscription errors?
4. Fallback: Manual refresh still works?

### Issue 5: Android-Specific Crashes

**Symptoms:** App crashes only on Android

**Common causes:**
- Android version too old (<10)
- Memory issues (Android kills background apps)
- Date/time format incompatibility

**Fixes:**
1. Check Android version
2. Restart Android device
3. Clear Expo Go cache: App Settings → Clear Cache
4. Check terminal logs for platform-specific errors

---

## 📞 ESCALATION

**Nếu stuck quá 30 phút trên 1 issue:**

1. Document issue chi tiết (screenshots, logs)
2. Post in team channel với tag `@mobile-team`
3. Include:
   - What you're testing
   - What failed
   - What you tried
   - Screenshots/logs

**Emergency contacts:**
- Mobile Lead: [Contact]
- DevOps: [Contact] (cho Supabase issues)
- CTO: [Contact] (cho CRITICAL blockers)

---

## ✅ COMPLETION CHECKLIST

**Sau khi hoàn thành testing:**

- [ ] iPhone testing done (6 tests)
- [ ] Android testing done (6 tests)
- [ ] Bug report filled
- [ ] Screenshots organized
- [ ] Report committed to git
- [ ] GO/NO-GO decision made
- [ ] Team notified of results

**Next steps:**
- If GO → Proceed to Production Pilot (Phase 5)
- If NO-GO → Fix bugs, re-test, then decide again

---

**Document Created:** 2026-06-22  
**Last Updated:** 2026-06-22  
**Status:** ✅ Ready to use  
**Estimated Time:** 4-5 hours total  
**Prerequisites:** `PRE_WEEK_4_EXECUTION_CHECKLIST.md` Bước 1-2 completed
