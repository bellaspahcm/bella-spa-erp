# Hướng dẫn tạo Sale Test User

## Option 1: Qua UI (Khuyến nghị - Dễ nhất)

### Bước 1: Chạy dev server
```bash
npm run dev
```

### Bước 2: Login với admin account
Vào: http://localhost:3000/login

Login với tài khoản admin hiện tại của bạn

### Bước 3: Tạo user mới
1. Vào: http://localhost:3000/dashboard/settings
2. Click "Thêm nhân sự mới"
3. Điền thông tin:
   - **Email**: `sale.test@bellaeip.com`
   - **Họ và tên**: `Nguyễn Văn Sale (Test)`
   - **Role**: Chọn `sale` (hoặc `Sale` tùy dropdown)
4. Click "Tạo tài khoản"

### Bước 4: Lấy password
Sau khi tạo, hệ thống sẽ hiển thị temporary password (hoặc gửi email).

**Nếu không hiển thị**: Check console.log hoặc xem trong `createUser()` response.

### Bước 5: Login và test
1. Logout khỏi admin account
2. Login với:
   - Email: `sale.test@bellaeip.com`
   - Password: (password từ bước 4)
3. Vào: http://localhost:3000/workforce/dashboard

---

## Option 2: SQL Script (Nếu cần tạo nhanh nhiều users)

### Bước 1: Mở Supabase SQL Editor
https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new

### Bước 2: Run script này

```sql
-- Replace YOUR_TENANT_ID with your actual tenant ID
DO $$
DECLARE
  v_tenant_id UUID := 'YOUR_TENANT_ID'; -- ⚠️ CHANGE THIS
  v_email TEXT := 'sale.test@bellaeip.com';
  v_full_name TEXT := 'Nguyễn Văn Sale (Test)';
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = v_email) THEN
    -- Insert into public.users (auth user will be created by app)
    INSERT INTO public.users (
      email,
      full_name,
      role,
      status,
      tenant_id,
      created_at,
      updated_at
    ) VALUES (
      v_email,
      v_full_name,
      'sale',
      'active',
      v_tenant_id,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ User profile created: %', v_email;
  ELSE
    RAISE NOTICE '⚠️ User already exists: %', v_email;
  END IF;
END $$;
```

**⚠️ LƯU Ý**: Script này chỉ tạo profile, chưa tạo auth user. Vẫn cần dùng app UI để set password lần đầu.

---

## Option 3: Supabase Auth Dashboard (Nhanh nhất nếu có service_role)

### Bước 1: Vào Auth Dashboard
https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/auth/users

### Bước 2: Click "Add user" → "Create new user"

### Bước 3: Điền thông tin
- **Email**: `sale.test@bellaeip.com`
- **Password**: `BellaSale2026!` (hoặc tự chọn)
- **Email Confirm**: ✅ Check (bỏ qua email verification)

### Bước 4: Tạo profile trong public.users

Run SQL này (thay `AUTH_USER_ID` bằng ID vừa tạo):

```sql
INSERT INTO public.users (
  id,  -- ⚠️ MUST match auth.users.id
  email,
  full_name,
  role,
  status,
  tenant_id,
  created_at,
  updated_at
) VALUES (
  'AUTH_USER_ID',  -- ⚠️ CHANGE THIS
  'sale.test@bellaeip.com',
  'Nguyễn Văn Sale (Test)',
  'sale',
  'active',
  'YOUR_TENANT_ID',  -- ⚠️ CHANGE THIS
  NOW(),
  NOW()
);
```

---

## Lấy Tenant ID

Nếu không biết tenant ID, chạy query này:

```sql
SELECT id, name, status
FROM tenants
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Test Login

### Credentials
- **Email**: `sale.test@bellaeip.com`
- **Password**: (từ bước tạo)

### Test URLs
- Login: http://localhost:3000/login
- Workforce Dashboard: http://localhost:3000/workforce/dashboard
- Lead Management: http://localhost:3000/workforce/leads
- KPI Dashboard: http://localhost:3000/workforce/kpi

### Expected Behavior
- ✅ Login thành công
- ✅ Redirect về `/workforce/dashboard` (không phải `/dashboard`)
- ✅ Bottom nav hiển thị 5 icons: Dashboard, Lead, Calendar, KPI, Profile
- ✅ Dashboard hiển thị AI Daily Brief và 4 quick stats
- ❌ Nếu try access `/dashboard` (admin page) → Redirect về `/workforce/dashboard`

---

## Troubleshooting

### 1. "Unauthorized" khi login
- Kiểm tra email/password đúng chưa
- Check auth.users table: `SELECT * FROM auth.users WHERE email = 'sale.test@bellaeip.com';`

### 2. "Tenant not found"
- Kiểm tra `public.users.tenant_id` có giá trị và match với `tenants.id`
- Run: `SELECT u.email, u.tenant_id, t.name FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email = 'sale.test@bellaeip.com';`

### 3. Redirect về `/dashboard` thay vì `/workforce`
- Kiểm tra role: `SELECT email, role FROM users WHERE email = 'sale.test@bellaeip.com';`
- Role phải là `sale` (lowercase), không phải `Sale` hay `SALE`

### 4. "Access Denied" khi vào workforce portal
- Check auth guard trong `src/app/workforce/dashboard/page.tsx`
- Allowed roles: `['sale', 'team_lead', 'branch_manager', 'admin']`
- Verify role bằng: `SELECT role FROM users WHERE email = 'sale.test@bellaeip.com';`

---

## Recommendation

**👉 Dùng Option 1 (UI)** - Đơn giản nhất, không cần biết tenant_id hay auth_user_id.

App sẽ tự động:
1. Tạo auth.users với hashed password
2. Tạo public.users profile với tenant_id đúng
3. Generate temporary password và hiển thị
4. Send email (nếu SMTP configured)
