# Lấy Supabase API Keys

Bạn đang gặp lỗi "Invalid API key" vì `.env.local` thiếu Supabase keys thật.

## Cách 1: Supabase Dashboard (Dễ nhất)

1. Mở trình duyệt: https://supabase.com/dashboard/sign-in
2. Đăng nhập vào tài khoản của bạn
3. Chọn project: **lvnvkpyxtuilhrabtlwv** (Bella Spa ERP)
4. Vào **Settings** (bánh răng bên trái) → **API**
5. Copy các giá trị sau:

```
Project URL: https://lvnvkpyxtuilhrabtlwv.supabase.co

anon public key: 
eyJhbGc... (dòng dài ~500 ký tự)

service_role key (secret):
eyJhbGc... (dòng dài ~500 ký tự, KHÁC với anon key)
```

6. Paste vào `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://lvnvkpyxtuilhrabtlwv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<paste-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here>
SUPABASE_SECRET_KEY=<paste-service-role-key-here>
```

7. Restart dev server:
```bash
# Stop server
Ctrl+C

# Start again
npm run dev
```

8. Hard refresh browser: `Ctrl+Shift+R`

---

## Cách 2: Supabase CLI

Nếu bạn đã cài Supabase CLI:

```bash
npx supabase login
npx supabase projects list
npx supabase projects api-keys --project-ref lvnvkpyxtuilhrabtlwv
```

---

## Cách 3: Hỏi người setup project

Nếu không có quyền truy cập Supabase dashboard, hỏi người đã setup project này để lấy keys.

---

## Verify Keys

Sau khi update `.env.local`, test xem keys có work không:

```bash
# Test anon key
curl -X GET "https://lvnvkpyxtuilhrabtlwv.supabase.co/rest/v1/" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Nếu thành công, sẽ trả về:
# {"message":"The server is running"}
# hoặc danh sách tables

# Nếu fail, sẽ trả về:
# {"message":"Invalid API key"}
```

---

## Lưu ý bảo mật

- ✅ `anon public key` - OK để commit vào code (NEXT_PUBLIC_*)
- ❌ `service_role key` - KHÔNG BAO GIỜ commit vào Git
- ❌ `.env.local` - Đã có trong `.gitignore`, an toàn
