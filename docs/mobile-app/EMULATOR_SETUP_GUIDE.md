# Android Emulator Setup Guide
**Date:** June 24, 2026  
**For:** Bella ERP Mobile App Testing

---

## 🎯 Objective

Create an Android Virtual Device (AVD) to test the Bella ERP Mobile app without needing a physical device.

---

## 📋 Step-by-Step Instructions

### **Step 1: Open Device Manager**

Android Studio should now be opening. Once it's loaded:

**Option A - From Welcome Screen:**
```
1. Click "More Actions" (⋮) button in top-right
2. Select "Virtual Device Manager"
```

**Option B - From Main Window:**
```
1. Top menu → Tools → Device Manager
2. Or click the phone icon in toolbar
```

---

### **Step 2: Create New Virtual Device**

In Device Manager window:

```
1. Click "Create Device" button (or "+" icon)
2. Device Definition screen will appear
```

---

### **Step 3: Select Device Hardware**

**Recommended Choices:**

#### **Option A: Pixel 5 (KHUYẾN NGHỊ)**
```
Category: Phone
Device: Pixel 5
- Screen: 6.0" 1080x2340 (440 dpi)
- Memory: Good for testing
→ Click "Next"
```

#### **Option B: Pixel 7**
```
Category: Phone
Device: Pixel 7
- Screen: 6.3" 1080x2400 (416 dpi)
- More modern
→ Click "Next"
```

**Why Pixel 5/7?**
- ✅ Represents mid-range Android phones (similar to KTV devices)
- ✅ Good performance on dev machine
- ✅ Standard screen size for testing
- ✅ Pre-configured Google Play Services

---

### **Step 4: Select System Image**

**Recommended: Android 13 (API 33) "Tiramisu"**

```
1. Click "Recommended" tab
2. Find "Android 13.0 (API 33)"
   - ABI: x86_64
   - Target: Google APIs
   
3. If "Download" button appears:
   - Click "Download"
   - Wait for download to complete (~1-2 GB)
   - Accept license agreements
   - Click "Finish" when done

4. Select the downloaded system image
5. Click "Next"
```

**Alternative (if API 33 not available):**
- Android 14 (API 34) - Latest
- Android 12 (API 32) - Older but stable

**Why API 33?**
- ✅ Matches most current Android devices (70%+ market share)
- ✅ Stable and well-tested
- ✅ Good balance of features and compatibility
- ✅ Bella ERP Mobile supports API 24+ (Android 7.0+)

---

### **Step 5: Configure AVD**

**AVD Name:**
```
Pixel_5_API_33
(Or customize: Bella_Test_Device)
```

**Settings:**
```
Startup orientation: Portrait
Graphics: Hardware - GLES 2.0 (Recommended)
Device Frame: Enable (shows device bezel)
```

**Advanced Settings (Optional - Click "Show Advanced Settings"):**
```
Camera:
  - Front: Emulated
  - Back: VirtualScene
  
Memory and Storage:
  - RAM: 2048 MB (minimum)
  - VM heap: 256 MB
  - Internal Storage: 2048 MB
  
Boot option:
  - Cold boot (recommended for first time)
```

**Final Check:**
```
✅ AVD Name: Pixel_5_API_33
✅ Target: Android 13.0 (API 33)
✅ CPU/ABI: x86_64
✅ RAM: 2048 MB
✅ Storage: 2048 MB
```

**Click "Finish"**

---

### **Step 6: Start Emulator**

Back in Device Manager:

```
1. Find your newly created emulator "Pixel_5_API_33"
2. Click ▶ (Play/Start button) on the right
3. Wait 30-60 seconds for emulator to boot
```

**First Boot:**
- Takes longer (30-60 seconds)
- Shows "Android" animation
- Eventually shows lock screen or home screen

**Subsequent Boots:**
- Faster (10-20 seconds) if using "Quick Boot" snapshot

---

### **Step 7: Verify Emulator is Running**

**In Terminal/PowerShell:**
```powershell
adb devices
```

**Expected Output:**
```
List of devices attached
emulator-5554    device
```

✅ If you see `emulator-5554 device` → Emulator is ready!

---

## 🚀 Install Bella ERP Mobile App

### **Method 1: Install Production APK**

```powershell
# Navigate to project root
cd "D:\Antigravity\Projects\BELLA SPA ERP"

# Install APK
adb install apps\mobile\builds\bella-erp-mobile-v1.0.0-pilot.apk
```

**Expected Output:**
```
Performing Streamed Install
Success
```

**Open App:**
- Find "Bella ERP Mobile" icon in app drawer
- Tap to open
- Test login, navigation, features

---

### **Method 2: Run Development Build (with Hot Reload)**

**Start Metro (if not running):**
```powershell
cd apps\mobile
npm start
```

**In another terminal:**
```powershell
cd apps\mobile
npm run android
```

**This will:**
1. Build development APK
2. Install on emulator
3. Start app with Metro connection
4. Enable Hot Reload (code changes auto-update)

---

## 🧪 Testing Checklist

Once app is installed and running:

### **Basic Functionality:**
- [ ] App launches without crashes
- [ ] Splash screen displays correctly
- [ ] Login screen loads
- [ ] Can input email/password
- [ ] Login button responds

### **Navigation:**
- [ ] Bottom tabs work (LỊCH CA, THU NHẬP, CẢ NHÂN)
- [ ] Can switch between tabs
- [ ] Back button works

### **UI/UX:**
- [ ] Text is readable (color contrast fix `#555`)
- [ ] Icons display correctly
- [ ] Buttons are tappable
- [ ] Scrolling is smooth
- [ ] No layout issues

### **Data Loading:**
- [ ] Can fetch data from Supabase
- [ ] Loading indicators show
- [ ] Data displays in lists/cards

---

## 🐛 Troubleshooting

### **Emulator won't start:**
```
Error: "Cannot start emulator"
Solution:
1. Check BIOS virtualization is enabled (Intel VT-x / AMD-V)
2. Disable Hyper-V in Windows (if conflicts)
3. Try creating emulator with different API level
```

### **Emulator is very slow:**
```
Solutions:
1. Enable Hardware Acceleration (HAXM on Intel, AMD on AMD)
2. Reduce RAM to 2048 MB if machine has low memory
3. Close other applications
4. Use "Cold Boot" instead of "Quick Boot"
```

### **APK install fails:**
```
Error: "INSTALL_FAILED_UPDATE_INCOMPATIBLE"
Solution:
adb uninstall com.bellaspa.erp
adb install apps\mobile\builds\bella-erp-mobile-v1.0.0-pilot.apk
```

### **App crashes on launch:**
```
Check logs:
adb logcat | findstr "bellaspa"

Common issues:
- Missing .env.local (Supabase credentials)
- Network connection error
- Check Metro bundler is running (for dev builds)
```

---

## 📱 Emulator Shortcuts

### **Common Actions:**
- **Home button:** Click house icon or press `Home` key
- **Back button:** Click back arrow or press `Esc`
- **Recent apps:** Click square icon
- **Rotate screen:** `Ctrl + F11` / `Ctrl + F12`
- **Volume up/down:** `Ctrl + Up/Down arrow`
- **Power button:** Click power icon (sleep/wake)

### **Developer Menu (in app):**
- **Shake gesture:** `Ctrl + M`
- **Reload JS:** `R R` (press R twice)
- **Toggle inspector:** `Ctrl + M` → "Toggle Inspector"

---

## 💾 Snapshot Management

**Quick Boot (Default):**
- Saves emulator state when closed
- Faster subsequent boots
- Can consume disk space

**Cold Boot:**
- Fresh start every time
- Slower but more reliable
- Right-click emulator → "Cold Boot Now"

**Delete Snapshots (if disk space low):**
```
Device Manager → ⋮ (More) → Wipe Data
```

---

## 🔧 Advanced Configuration

### **Change RAM/Storage:**
```
Device Manager → ⋮ → Edit → Show Advanced Settings
- Increase RAM if emulator is slow
- Decrease if machine has low memory
```

### **GPU Acceleration:**
```
Graphics: Hardware - GLES 2.0 (Fastest)
If issues: Try Software - GLES 2.0 (Slower but compatible)
```

### **Network Settings:**
```
Emulator uses host machine's network
No additional setup needed for Supabase connection
```

---

## ✅ Success Criteria

Emulator is ready when:
- ✅ Boots to home screen
- ✅ Shows in `adb devices` as `device`
- ✅ Can install APK successfully
- ✅ Bella ERP Mobile app launches
- ✅ UI is responsive and readable

---

## 📚 Additional Resources

**Official Documentation:**
- [Android Emulator Documentation](https://developer.android.com/studio/run/emulator)
- [Create and Manage Virtual Devices](https://developer.android.com/studio/run/managing-avds)

**Expo Documentation:**
- [Using Android Emulator](https://docs.expo.dev/workflow/android-studio-emulator/)

---

**Created by:** Kiro AI  
**Last Updated:** June 24, 2026  
**Version:** 1.0
