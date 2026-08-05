# White Screen Debug & Fix - Bella ERP

## Vấn Đề (Issue)

**Triệu chứng:** Màn trắng khi load localhost:3000
- Browser hiển thị trang trắng không có nội dung
- Console có logs `[TenantContextProvider]` nhưng không render component
- Network tab cho thấy `/api/tenant/context` trả về 401 Unauthorized
- Không có redirect đến trang login

## Nguyên Nhân (Root Cause)

Theo **AGENTS.md Section 14.1-14.2**:

1. **`NODE_ENV` không được set** → `process.env.NODE_ENV === undefined`
2. **Dev fallback không hoạt động** → Check `if (process.env.NODE_ENV === 'development')` fails
3. **401 Unauthorized response** → TenantContextProvider không set fallback context
4. **Redirect logic fails** → Stuck ở loading state infinitely
5. **White screen persists** → No error shown, just blank page

## Mã Nguồn Liên Quan (Related Code)

File: `src/core/providers/TenantContextProvider.tsx`

```typescript
// Line ~77-90: Dev fallback for 401
if (response.status === 401) {
  console.warn('[TenantContextProvider] User not authenticated');
  
  // CRITICAL: This block only runs if NODE_ENV === 'development'
  if (process.env.NODE_ENV === 'development') {
    console.warn('[TenantContextProvider] Dev mode: Using fallback tenant context');
    setContext({
      tenantId: 'dev-tenant',
      tenantName: 'Bella Land (Dev)',
      enabledModules: ['real_estate', 'beauty_spa', 'cleaning'],
      subscriptionPlan: 'enterprise',
      featureFlags: {},
      settings: {},
    });
    setLoading(false);  // ✅ CRITICAL: Must set loading=false
    return;
  }
  
  // Production: redirect to login
  window.location.href = '/login';
  return;
}
```

**Vấn đề:** Nếu `NODE_ENV` không được set, dev fallback không chạy → Redirect không xảy ra → Loading spinner vô tận → Màn trắng.

## Giải Pháp (Solution)

### Quick Fix (Tạm Thời)

**PowerShell (Windows):**
```powershell
# 1. Kill all node processes
Get-Process -Name node | Stop-Process -Force

# 2. Set NODE_ENV and start dev server
$env:NODE_ENV = "development"
npm run dev
```

**Bash/Zsh (Mac/Linux):**
```bash
# 1. Kill node processes
killall node

# 2. Set NODE_ENV and start dev server
NODE_ENV=development npm run dev
```

### Permanent Fix (Vĩnh Viễn)

**1. Cài đặt `cross-env`:**
```bash
npm install --save-dev cross-env
```

**2. Update `package.json` scripts:**

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development next dev",
    "dev:windows": "powershell -Command \"$env:NODE_ENV='development'; npm run dev:internal\"",
    "dev:internal": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

**3. Từ giờ chỉ cần chạy:**
```bash
npm run dev
```

## Xác Minh (Verification)

### 1. Kiểm Tra NODE_ENV

**PowerShell:**
```powershell
echo "NODE_ENV: $env:NODE_ENV"
# Output mong muốn: NODE_ENV: development
```

**Bash:**
```bash
echo "NODE_ENV: $NODE_ENV"
# Output mong muốn: NODE_ENV: development
```

### 2. Kiểm Tra Browser Console

Sau khi chạy `npm run dev`, mở http://localhost:3000 và kiểm tra browser console:

**✅ Logs mong muốn (Correct):**
```
[TenantContextProvider] User not authenticated
[TenantContextProvider] Dev mode: Using fallback tenant context
[TenantContextProvider] enabledModules RAW: ['real_estate', 'beauty_spa', 'cleaning']
[TenantContextProvider] ✅ Applied module theme: real_estate
```

**❌ Logs SAI (Incorrect - WHITE SCREEN):**
```
[TenantContextProvider] User not authenticated
(No "Dev mode" message)
(Stuck in loading state)
```

### 3. Kiểm Tra HTML Attribute

Trong browser console:
```javascript
document.documentElement.getAttribute('data-tenant-module')
// Output mong muốn: "real_estate" or "beauty_spa" or "bella_auto"
```

### 4. Kiểm Tra Network Tab

- `/api/tenant/context` trả về **401** → OK (expected in dev without auth)
- TenantContextProvider tự động fallback → Page loads → **No white screen**

## Port Conflict Issue

**Triệu chứng:**
```
⚠ Port 3000 is in use by process 16692, using available port 3001 instead.
```

**Nguyên nhân:** Stale Node process từ session trước đó vẫn chạy trên port 3000

**Giải pháp:**

**PowerShell:**
```powershell
Get-Process -Name node | Stop-Process -Force
npm run dev
```

**Bash:**
```bash
killall node
npm run dev
```

## Hard Refresh After Changes

**ALWAYS hard refresh browser sau khi:**
- Thay đổi `NODE_ENV`
- Kill và restart dev server
- Update theme/module code

**Cách hard refresh:**
- **Windows:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`
- **Or:** F12 → Right-click Refresh button → "Empty Cache and Hard Reload"

## Prevention Best Practices

Theo **AGENTS.md Section 14.9**:

1. **Always set NODE_ENV** trong dev scripts hoặc IDE launch configurations
2. **Add dev fallback context** cho ALL context providers phụ thuộc API auth
3. **Show loading skeletons** trong tất cả async operations (không return null)
4. **Log context provider state changes** trong development mode để debug
5. **Test với clean browser state** (incognito mode) để catch auth-dependent white screens

## Related Documentation

- **AGENTS.md Section 14:** TenantContextProvider White Screen Debug (chi tiết đầy đủ)
- **Section 14.1:** Development Environment NODE_ENV Requirement
- **Section 14.2:** Dev Fallback Context for 401 Unauthorized
- **Section 14.3:** Port Conflict and Stale Dev Server Processes
- **Section 14.7:** Debugging Checklist for White Screen Issues
- **Section 14.8:** Quick Fix Commands
- **Section 14.9:** Prevention Best Practices

## Real-World Incident Log

**Date:** 05/08/2026  
**Issue:** White screen on localhost:3000 after checkout/branch switch  
**Symptoms:**
- Browser blank white page with "Rendering" text only
- Console logs show TenantContextProvider loading but no errors
- Network tab shows `/api/tenant/context` returns 401 Unauthorized
- No redirect to login page occurs

**Root causes:**
1. NODE_ENV not set → `process.env.NODE_ENV === undefined`
2. Dev fallback check `if (process.env.NODE_ENV === 'development')` fails
3. 401 triggers redirect logic but redirect doesn't execute
4. React stuck in loading state with no context

**Resolution:**
1. Updated TenantContextProvider to use dev fallback for 401 in development
2. Added `setLoading(false)` after setting fallback context
3. Set `$env:NODE_ENV = "development"` before running dev server
4. Killed stale node processes on port 3000
5. Hard refresh browser (Ctrl+Shift+R)

**Time lost:** ~20 minutes debugging white screen  
**Lesson:** Always set NODE_ENV=development when running dev server. Dev fallbacks MUST set loading=false. Kill stale processes before restart.

---

**Last Updated:** 05/08/2026  
**Status:** ✅ RESOLVED - Permanent fix implemented with cross-env
