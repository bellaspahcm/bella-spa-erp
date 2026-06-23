# Production Pilot - Quick Start Guide

**⏱️ Thời gian:** 3 giờ setup + 2-3 ngày pilot  
**🎯 Mục tiêu:** Test app với 2-3 KTV thật qua TestFlight/Play Store  

---

## 🚀 BƯỚC THỰC HIỆN NHANH

### 1. Login Expo (2 phút)

```bash
cd apps/mobile
eas login
```

Nhập email/password Expo account.  
**Chưa có?** → https://expo.dev/signup

---

### 2. Init Project (5 phút)

```bash
eas project:init
```

Copy `Project ID` → Paste vào `apps/mobile/app.json`:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "PASTE_HERE"
      }
    }
  }
}
```

---

### 3. Configure Build (10 phút)

```bash
eas build:configure
```

Tạo file `eas.json` với nội dung:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

---

### 4. Build App (30-45 phút)

**iOS + Android:**
```bash
eas build --platform all --profile preview
```

Hoặc từng platform:
```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

**Đợi build xong** → Download IPA + APK từ: https://expo.dev

---

### 5. Upload to Stores (30 phút)

**iOS → TestFlight:**
1. Cần **Apple Developer Account** ($99/năm)
2. Upload IPA qua Transporter (macOS) hoặc:
   ```bash
   eas submit --platform ios
   ```

**Android → Play Console:**
1. Cần **Google Play Console** ($25 một lần)
2. Upload APK/AAB qua web console hoặc:
   ```bash
   eas submit --platform android
   ```

---

### 6. Invite Pilot Users (10 phút)

**iOS TestFlight:**
1. App Store Connect → TestFlight → External Testing
2. Add emails của 2-3 KTVs
3. KTVs nhận email → Install TestFlight app → Install Bella ERP

**Android Play Store:**
1. Play Console → Internal Testing → Create release
2. Upload APK/AAB
3. Add tester emails
4. KTVs nhận email → Install từ Play Store

---

### 7. Monitor (2-3 ngày)

**Hàng ngày check:**
- ✅ Sentry dashboard: https://sentry.io
- ✅ Expo analytics: https://expo.dev
- ✅ Feedback từ KTVs (Zalo/Telegram)

**Metrics cần đạt:**
- Login success: >95%
- Crash rate: <1%
- User satisfaction: ≥4/5

---

## 🆘 NẾU KHÔNG CÓ APPLE/GOOGLE ACCOUNTS

### Plan B: Ad-hoc Distribution

**iOS (không cần App Store):**
```bash
# Build với Enterprise cert hoặc Ad-hoc
eas build --platform ios --profile preview
# Share IPA file qua AirDrop/Telegram
# KTVs install qua Apple Configurator hoặc Xcode
```

**Android (không cần Play Store):**
```bash
# Build APK
eas build --platform android --profile preview
# Download APK
# Share file qua Telegram/Drive
# KTVs enable "Unknown Sources" → Install APK
```

**⚠️ Lưu ý:** Cách này không scale được, chỉ dùng cho pilot 2-3 users.

---

## ✅ SUCCESS CRITERIA

**Pilot thành công khi:**
- [x] 2-3 KTVs install app thành công
- [x] Login works >95%
- [x] Dashboard loads <3s
- [x] No critical crashes
- [x] Sentry tracking hoạt động
- [x] RPCs trả về data đúng
- [x] Feedback ≥4/5 stars

**Nếu đạt → Proceed to Week 4 features**  
**Nếu không → Fix bugs, re-pilot**

---

## 📚 TÀI LIỆU CHI TIẾT

- **Full setup guide:** `EAS_BUILD_SETUP_GUIDE.md`
- **Pilot metrics:** `PILOT_SUCCESS_CRITERIA.md`
- **Troubleshooting:** `EAS_BUILD_SETUP_GUIDE.md` section "TROUBLESHOOTING"

---

**Bắt đầu ngay:** `eas login` ⬆️
