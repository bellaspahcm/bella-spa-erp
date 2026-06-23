# EAS Build Setup Guide - Production Pilot

**Mục đích:** Build app iOS (TestFlight) và Android (Play Store) để pilot với 2-3 KTV thật  
**Thời gian ước tính:** 2-3 giờ (setup) + 30-45 phút (build)  
**Người thực hiện:** Dev Team  

---

## 📋 TỔNG QUAN

**Mục tiêu:**
- Build production-ready app
- Deploy to TestFlight (iOS) + Play Store Internal Testing (Android)
- Test với 2-3 pilot KTVs
- Verify Sentry + RPCs hoạt động trong production

**Kết quả:**
- iOS IPA file → Upload to TestFlight
- Android AAB file → Upload to Play Store Console
- Pilot users có thể install và test app thật

---

## 🎯 BƯỚC 1: SETUP EXPO ACCOUNT (10 phút)

### 1.1. Tạo/Đăng nhập Expo Account

**Nếu chưa có account:**
1. Vào: https://expo.dev/signup
2. Đăng ký với email công ty
3. Verify email

**Nếu đã có account:**
1. Sử dụng email và password hiện tại

### 1.2. Login vào EAS CLI

```bash
cd apps/mobile
eas login
```

**Nhập:**
- Email hoặc username
- Password

**Kết quả:** `Logged in as <your_email>`

---

## 🎯 BƯỚC 2: CONFIGURE EAS BUILD (15 phút)

### 2.1. Tạo EAS config

```bash
cd apps/mobile
eas build:configure
```

**Sẽ tạo file:** `eas.json`

### 2.2. Update `eas.json` với config sau:

```json
{
  "cli": {
    "version": ">= 20.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@example.com",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 2.3. Update `app.json` với build info

Thêm vào `expo` section:

```json
{
  "expo": {
    // ... existing config
    "owner": "your-expo-username",
    "extra": {
      "eas": {
        "projectId": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Lấy `projectId`:**
```bash
eas project:init
```

Copy project ID và paste vào `app.json`

---

## 🎯 BƯỚC 3: SETUP APPLE DEVELOPER ACCOUNT (iOS) (30 phút)

### 3.1. Đăng ký Apple Developer Account

**Yêu cầu:**
- Apple ID
- Phí: $99/năm (doanh nghiệp) hoặc $299/năm (enterprise)

**Đăng ký tại:** https://developer.apple.com/programs/enroll/

### 3.2. Tạo App ID

1. Vào: https://developer.apple.com/account/resources/identifiers/list
2. Click **"+"** → **App IDs**
3. Nhập:
   - Description: `Bella ERP Mobile`
   - Bundle ID: `com.bellaspa.erp` (từ `app.json`)
4. Click **Continue** → **Register**

### 3.3. Tạo App trong App Store Connect

1. Vào: https://appstoreconnect.apple.com
2. **My Apps** → **"+"** → **New App**
3. Nhập:
   - Platform: iOS
   - Name: `Bella ERP Mobile`
   - Primary Language: Vietnamese
   - Bundle ID: `com.bellaspa.erp`
   - SKU: `bella-erp-mobile`
4. Click **Create**
5. Lưu **App ID** (dạng `123456789`)

### 3.4. Setup Certificates (EAS tự động)

EAS sẽ tự động tạo certificates khi build lần đầu.

---

## 🎯 BƯỚC 4: SETUP GOOGLE PLAY CONSOLE (Android) (30 phút)

### 4.1. Đăng ký Google Play Console

**Yêu cầu:**
- Google Account
- Phí: $25 (một lần)

**Đăng ký tại:** https://play.google.com/console/signup

### 4.2. Tạo App

1. Vào: https://play.google.com/console
2. Click **"Create app"**
3. Nhập:
   - App name: `Bella ERP Mobile`
   - Default language: Vietnamese
   - App or game: App
   - Free or paid: Free
4. Chấp nhận policies
5. Click **Create app**

### 4.3. Setup Service Account (để upload tự động)

1. Vào: https://console.cloud.google.com
2. Chọn project (hoặc tạo mới)
3. **IAM & Admin** → **Service Accounts**
4. Click **"Create Service Account"**
5. Nhập:
   - Name: `eas-build-upload`
   - Description: `For EAS build uploads`
6. Click **Create and Continue**
7. Grant role: **Service Account User**
8. Click **Done**
9. Click vào service account vừa tạo
10. **Keys** tab → **Add Key** → **Create new key**
11. Chọn **JSON** → **Create**
12. Lưu file JSON download được vào `apps/mobile/google-service-account.json`
13. **QUAN TRỌNG:** Add vào `.gitignore`:
    ```
    echo "google-service-account.json" >> .gitignore
    ```

### 4.4. Grant quyền cho Service Account

1. Quay lại Google Play Console
2. **Setup** → **API access**
3. **Link** Google Cloud project (nếu chưa)
4. Trong **Service accounts**, tìm account vừa tạo
5. Click **Grant access**
6. Chọn quyền: **Admin** (Release management)
7. Click **Invite user** → **Send invitation**

---

## 🎯 BƯỚC 5: BUILD APP (30-45 phút)

### 5.1. Build cho Internal Testing (Preview)

**Build iOS:**
```bash
cd apps/mobile
eas build --platform ios --profile preview
```

**Build Android:**
```bash
eas build --platform android --profile preview
```

**Build cả 2:**
```bash
eas build --platform all --profile preview
```

**Thời gian build:**
- iOS: ~20-30 phút
- Android: ~15-20 phút

**Kết quả:**
- iOS: IPA file (download link)
- Android: APK file (download link)

### 5.2. Monitor build

1. Mở: https://expo.dev/accounts/[YOUR_USERNAME]/projects/bella-erp-mobile/builds
2. Xem progress bar
3. Đợi status → **Finished**
4. Download IPA/APK files

---

## 🎯 BƯỚC 6: UPLOAD TO STORES (15 phút)

### 6.1. Upload iOS to TestFlight

**Option A: Manual Upload**
1. Download IPA file từ EAS build
2. Mở **Transporter** app (macOS)
3. Drag & drop IPA file
4. Click **Deliver**
5. Đợi upload xong → Check App Store Connect

**Option B: Tự động qua EAS**
```bash
eas submit --platform ios --profile preview
```

**Sau khi upload:**
1. Vào App Store Connect → **TestFlight**
2. Đợi processing (~10 phút)
3. Status → **Ready to Submit**
4. **Add External Testers** → Nhập email pilot KTVs
5. Click **Save**

### 6.2. Upload Android to Play Store

**Option A: Manual Upload**
1. Download AAB file từ EAS build
2. Vào Play Console → **Testing** → **Internal testing**
3. Click **Create new release**
4. Upload AAB file
5. Fill release notes
6. Click **Review release** → **Start rollout**

**Option B: Tự động qua EAS**
```bash
eas submit --platform android --profile preview
```

**Sau khi upload:**
1. Vào Play Console → **Testing** → **Internal testing**
2. **Testers** tab → **Create email list**
3. Nhập email pilot KTVs
4. Click **Save** → **Send invitations**

---

## 🎯 BƯỚC 7: INVITE PILOT USERS (10 phút)

### 7.1. iOS TestFlight

**Pilot KTVs sẽ nhận email:**
1. Email title: "You're invited to test Bella ERP Mobile"
2. Click **"View in TestFlight"**
3. Install **TestFlight** app từ App Store (nếu chưa có)
4. Mở link lại → Install app
5. Mở app → Test

### 7.2. Android Play Store

**Pilot KTVs sẽ nhận email:**
1. Email title: "You've been invited to test Bella ERP Mobile"
2. Click **"Accept invitation"**
3. Mở Google Play Store
4. Search "Bella ERP Mobile"
5. Install → Test

---

## 🎯 BƯỚC 8: MONITOR PILOT (2-3 ngày)

### 8.1. Setup monitoring

**Sentry Dashboard:**
- URL: https://sentry.io/organizations/[YOUR_ORG]/projects/
- Monitor crashes, errors, performance

**Expo Dashboard:**
- URL: https://expo.dev/accounts/[YOUR_USERNAME]/projects/bella-erp-mobile
- Monitor crash reports, analytics

### 8.2. Daily checklist

**Morning (9:00 AM):**
- [ ] Check Sentry: Any crashes?
- [ ] Check Expo: App launches?
- [ ] Message pilot KTVs: Any issues?

**Midday (12:00 PM):**
- [ ] Check Sentry: Error trends
- [ ] Review feedback in Zalo/Telegram

**Evening (6:00 PM):**
- [ ] Collect daily feedback
- [ ] Note bugs in `PILOT_BUGS_LOG.md`
- [ ] Triage: Critical vs High vs Low

### 8.3. Success metrics

| Metric | Target | Track Daily |
|--------|--------|-------------|
| App launches | 100% | Expo Analytics |
| Login success | >95% | Sentry + feedback |
| Dashboard load | <3s | Sentry Performance |
| Crash rate | <1% | Sentry Issues |
| User satisfaction | ≥4/5 | Feedback survey |

---

## 🆘 TROUBLESHOOTING

### Issue 1: EAS build fails - Certificate error

**Lỗi:** `No valid certificate found`

**Giải pháp:**
```bash
eas credentials
# Select iOS → Certificates → Generate new
```

---

### Issue 2: TestFlight không thấy build

**Lỗi:** Upload xong nhưng không thấy build trong TestFlight

**Nguyên nhân:** Processing chưa xong (10-30 phút)

**Giải pháp:** Đợi, check email từ Apple

---

### Issue 3: Play Store reject upload

**Lỗi:** `You need to use a different version code`

**Giải pháp:**
1. Mở `app.json`
2. Tăng `android.versionCode`:
   ```json
   "android": {
     "versionCode": 2  // Tăng từ 1
   }
   ```
3. Build lại

---

### Issue 4: Pilot users không nhận được email

**Giải pháp:**
1. Check spam folder
2. Gửi lại invitation
3. Hoặc share direct install link:
   - iOS: Copy TestFlight public link
   - Android: Copy Play Store internal testing link

---

## 📝 CHECKLIST HOÀN CHỈNH

### Setup
- [ ] Expo account created
- [ ] EAS CLI installed
- [ ] `eas.json` configured
- [ ] `app.json` updated with projectId
- [ ] Apple Developer account (iOS)
- [ ] Google Play Console account (Android)
- [ ] Service account created (Android)

### Build
- [ ] iOS preview build SUCCESS
- [ ] Android preview build SUCCESS
- [ ] IPA/APK files downloaded

### Upload
- [ ] iOS uploaded to TestFlight
- [ ] Android uploaded to Play Store Internal
- [ ] Processing complete

### Pilot
- [ ] 2-3 pilot KTVs selected
- [ ] Invitations sent
- [ ] Apps installed on pilot devices
- [ ] Initial feedback collected

### Monitoring
- [ ] Sentry dashboard checked daily
- [ ] Expo analytics reviewed
- [ ] Bug log maintained
- [ ] Metrics tracked

---

## 📊 EXPECTED TIMELINE

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Setup accounts | 1 hour | Expo + Apple + Google |
| Configure EAS | 30 min | `eas.json` ready |
| First build | 45 min | IPA + APK files |
| Upload to stores | 30 min | TestFlight + Play Console |
| Invite pilots | 15 min | 2-3 users invited |
| **Total setup** | **3 hours** | Ready for pilot |
| Pilot monitoring | 2-3 days | Feedback collected |

---

## 🎯 NEXT STEPS AFTER PILOT

**If pilot SUCCESS (≥80% metrics met):**
1. Fix any minor bugs found
2. Prepare for full rollout
3. Update documentation
4. Proceed to Week 4 features (QR + GPS)

**If pilot FAIL (<80% metrics):**
1. Analyze root causes
2. Fix critical bugs
3. Re-run pilot
4. Adjust timeline

---

## 📞 CONTACTS

**Build issues:** EAS Support (https://expo.dev/support)  
**Store issues:** Apple/Google Support  
**Technical:** Dev Team Lead  
**Emergency:** CTO  

---

**Document created:** 2026-06-22  
**Next:** Follow steps 1-8 to complete pilot setup
