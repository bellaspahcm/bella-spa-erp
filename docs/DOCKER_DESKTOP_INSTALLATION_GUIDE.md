# Hướng Dẫn Cài Đặt Docker Desktop (Windows)

## 📋 YÊU CẦU HỆ THỐNG

### Windows 10/11 Requirements:
- ✅ Windows 10 64-bit: Pro, Enterprise, or Education (Build 19044 or higher)
- ✅ Windows 11 64-bit: Any edition
- ✅ Hardware virtualization enabled in BIOS
- ✅ 4GB RAM minimum (8GB recommended)
- ✅ 10GB free disk space

### Check Windows Version:
```powershell
# Run in PowerShell
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber
```

---

## 🚀 BƯỚC 1: DOWNLOAD DOCKER DESKTOP

### Option A: Download trực tiếp
1. Mở browser: https://www.docker.com/products/docker-desktop/
2. Click **"Download for Windows"**
3. File: `Docker Desktop Installer.exe` (~600MB)

### Option B: Download qua PowerShell (nếu có `winget`)
```powershell
# Check winget available
winget --version

# Install Docker Desktop
winget install Docker.DockerDesktop
```

---

## 🔧 BƯỚC 2: ENABLE VIRTUALIZATION (NẾU CHƯA BẬT)

### Check Virtualization Status:
```powershell
# Run in PowerShell as Administrator
Get-ComputerInfo | Select-Object HyperVisorPresent, HyperVRequirementVirtualizationFirmwareEnabled
```

Nếu `HyperVRequirementVirtualizationFirmwareEnabled = False`:

### Enable trong BIOS:
1. **Restart máy**
2. **Vào BIOS/UEFI** (thường nhấn `F2`, `F10`, `Del`, hoặc `Esc` khi khởi động)
3. Tìm setting tên:
   - **Intel**: "Intel VT-x" hoặc "Virtualization Technology"
   - **AMD**: "AMD-V" hoặc "SVM Mode"
4. **Enable** setting đó
5. **Save & Exit**

---

## 📦 BƯỚC 3: INSTALL DOCKER DESKTOP

### Installation Steps:
1. **Double-click** `Docker Desktop Installer.exe`
2. **Configuration screen**:
   - ✅ Check: "Use WSL 2 instead of Hyper-V" (recommended)
   - ✅ Check: "Add shortcut to desktop"
3. Click **"Ok"**
4. Đợi cài đặt (~5 phút)
5. Click **"Close and restart"** khi hoàn thành

### Post-Install:
- Máy sẽ **restart**
- Sau khi restart, Docker Desktop sẽ **tự động start**

---

## ⚙️ BƯỚC 4: SETUP WSL 2 (NẾU CHƯA CÓ)

Docker Desktop trên Windows khuyến nghị dùng **WSL 2** (Windows Subsystem for Linux).

### Check WSL installed:
```powershell
# Run in PowerShell as Administrator
wsl --list --verbose
```

### Nếu chưa có WSL:
```powershell
# Run in PowerShell as Administrator

# 1. Enable WSL feature
wsl --install

# 2. Restart máy (if prompted)

# 3. Set WSL 2 as default
wsl --set-default-version 2

# 4. Install Ubuntu (optional but recommended)
wsl --install -d Ubuntu-22.04
```

---

## ✅ BƯỚC 5: VERIFY DOCKER INSTALLATION

### Start Docker Desktop:
1. Tìm **"Docker Desktop"** trong Start Menu
2. Click mở
3. Đợi Docker engine start (~30 giây)
4. Icon Docker sẽ xuất hiện ở System Tray (màu xanh = running)

### Verify trong PowerShell:
```powershell
# Check Docker version
docker --version
# Output: Docker version 24.x.x, build xxxxxxx

# Check Docker running
docker info

# Test Docker with hello-world
docker run hello-world
```

Nếu thấy `Hello from Docker!` → ✅ **Cài đặt thành công!**

---

## 🐛 TROUBLESHOOTING

### Lỗi: "WSL 2 installation is incomplete"
**Fix:**
```powershell
# Run as Administrator
wsl --update
wsl --set-default-version 2
```
Restart Docker Desktop.

---

### Lỗi: "Docker Desktop starting..." mãi không xong
**Fix:**
1. Close Docker Desktop
2. Open **Task Manager** (`Ctrl+Shift+Esc`)
3. End tasks: `Docker Desktop`, `com.docker.backend`, `vpnkit`
4. Restart Docker Desktop
5. Nếu vẫn lỗi: Restart máy

---

### Lỗi: "Hardware assisted virtualization not enabled"
**Fix:** Vào BIOS enable virtualization (xem Bước 2)

---

### Lỗi: Docker start nhưng `docker info` báo lỗi
**Fix:**
```powershell
# Reset Docker Desktop
# 1. Close Docker Desktop
# 2. Run in PowerShell as Administrator
Remove-Item -Recurse -Force "$env:APPDATA\Docker"
# 3. Restart Docker Desktop
```

---

## 🎯 BƯỚC 6: CONFIGURE DOCKER FOR DEVELOPMENT

### Recommended Settings:
1. Open **Docker Desktop**
2. Click **Settings** (⚙️ icon)
3. **Resources → Advanced**:
   - CPUs: 2-4 (tùy máy)
   - Memory: 4-8GB (tùy máy)
   - Swap: 1GB
   - Disk image size: 60GB
4. **Docker Engine**: Giữ mặc định
5. Click **"Apply & restart"**

---

## 🧪 TEST DOCKER WITH SUPABASE

Sau khi Docker Desktop đã chạy:

```powershell
# Navigate to project
cd "D:\Antigravity\Projects\BELLA SPA ERP"

# Start Supabase local
npx supabase start
```

Nếu Supabase start thành công → ✅ **Docker hoạt động hoàn hảo!**

Supabase sẽ tạo các containers:
- `supabase_db_*` (PostgreSQL)
- `supabase_studio_*` (Admin UI)
- `supabase_kong_*` (API Gateway)
- `supabase_auth_*` (Auth service)

---

## ⏱️ THỜI GIAN ƯỚC TÍNH

| Bước | Thời gian |
|------|-----------|
| Download Docker Desktop | 5-10 phút (tùy mạng) |
| Install Docker Desktop | 5 phút |
| Restart máy | 2 phút |
| Setup WSL 2 (nếu chưa có) | 5-10 phút |
| Verify & test | 2 phút |
| **Tổng** | **20-30 phút** |

---

## 📞 NẾU GẶP LỖI KHÔNG GIẢI QUYẾT ĐƯỢC

1. **Check Docker logs**:
   - Docker Desktop → Troubleshoot → Get logs
   - Gửi logs cho tôi để debug

2. **Alternative**: Sử dụng **Supabase Cloud** thay vì local
   - Không cần Docker
   - Deploy migration trực tiếp lên cloud
   - (Nhưng không khuyến nghị cho dev workflow)

---

## ✅ SAU KHI DOCKER DESKTOP READY

Quay lại task deployment:
```powershell
# Deploy migration to local Supabase
.\scripts\deploy-booking-engine-schema.ps1 local
```

---

**Good luck! 🚀**
