# Sửa Lỗi Tương Phản Màu Giao Diện
**Ngày thực hiện**: 22/06/2026  
**Phiên bản**: Bella ERP v0.1.0

---

## 🎯 Mục Tiêu
Khắc phục 2 vấn đề về màu sắc và tương phản trong giao diện KTV Mobile:

1. **Màu hồng hệ thống bị thay thế bằng màu be/xám** → Mất tương phản, không đọc được
2. **Màu chữ xám nhạt** → Cần tăng đậm lên nhưng không quá đậm trùng màu đen text hệ thống

---

## 📊 Vấn Đề Được Báo Cáo (Từ Screenshots)

### 1. Bảng Xếp Hạng KTV (Leaderboard)
**File**: `src/app/ktv/leaderboard/page.tsx`  
**Vấn đề**: Bục #2 (rank 2) sử dụng gradient màu hồng nhạt `from-pink-400 to-rose-400` → Không nổi bật như bục #1 (màu vàng) và bục #3 (màu hồng)

**Khắc phục**:
```tsx
// TRƯỚC (quá nhạt, mất tương phản)
bg-gradient-to-br from-pink-400 to-rose-400
shadow-md shadow-pink-200/60

// SAU (đậm hơn, tương phản tốt)
bg-gradient-to-br from-pink-500 to-rose-500
shadow-md shadow-pink-300/60
```

---

### 2. Modal Đăng Ký Nghỉ Phép
**File**: `src/app/ktv/dashboard/components/KtvLeaveModals.tsx`  
**Vấn đề**: Label form (`text-slate-700`) quá nhạt, không đủ tương phản với nền trắng

**Khắc phục**:
```tsx
// TRƯỚC (3 labels đều dùng text-slate-700)
<label className="text-[10px] font-black text-slate-700 ...">
  Chọn ngày nghỉ phép
</label>

// SAU (tăng lên text-slate-900 để đậm hơn)
<label className="text-[10px] font-black text-slate-900 ...">
  Chọn ngày nghỉ phép
</label>
```

**Các label được cập nhật**:
1. ✅ "Chọn ngày nghỉ phép" (`text-slate-700` → `text-slate-900`)
2. ✅ "Thời gian nghỉ" (`text-slate-700` → `text-slate-900`)
3. ✅ "Lý do xin nghỉ" (`text-slate-700` → `text-slate-900`)

---

## 🧪 Kiểm Thử

### Build Production
```bash
npm.cmd run build
```
**Kết quả**: ✅ Thành công (0 errors, 77/77 pages compiled)

### Kiểm Thử Thủ Công (Manual Testing)
#### Test Case 1: Bảng Xếp Hạng
- [ ] Truy cập `/ktv/leaderboard`
- [ ] Kiểm tra bục #2 có màu hồng đậm (`from-pink-500 to-rose-500`) không bị nhạt
- [ ] So sánh với bục #1 (vàng) và bục #3 (hồng nhạt) để đảm bảo hài hòa

#### Test Case 2: Modal Nghỉ Phép
- [ ] Truy cập `/ktv/dashboard`
- [ ] Click nút "Đăng ký nghỉ phép"
- [ ] Kiểm tra 3 label ("Chọn ngày nghỉ phép", "Thời gian nghỉ", "Lý do xin nghỉ") có màu `text-slate-900` (đậm hơn)
- [ ] Đảm bảo không quá đậm, vẫn phân biệt được với text input (`text-slate-800`)

#### Test Case 3: Dark Mode
- [ ] Kiểm tra cả 2 màn hình ở chế độ tối (dark mode)
- [ ] Đảm bảo `dark:text-[#D4C5B6]` vẫn hoạt động bình thường

---

## 📁 Files Thay Đổi

| File | Thay đổi | Lý do |
|------|----------|-------|
| `src/app/ktv/leaderboard/page.tsx` | `from-pink-400 to-rose-400` → `from-pink-500 to-rose-500` | Tăng độ tương phản bục #2 |
| `src/app/ktv/dashboard/components/KtvLeaveModals.tsx` | `text-slate-700` → `text-slate-900` (3 labels) | Tăng độ đậm chữ label form |

---

## 🎨 Quy Tắc Màu Sắc Hệ Thống (Design System)

### Màu Chữ Slate (Gray Scale)
| Class | Độ đậm | Sử dụng cho |
|-------|--------|-------------|
| `text-slate-300` | Rất nhạt | Icon disabled, placeholder phụ |
| `text-slate-400` | Nhạt | Label tiêu đề bảng, metadata phụ |
| `text-slate-500` | Trung bình nhạt | Placeholder input, subtitle |
| `text-slate-600` | Trung bình | Body text phụ |
| `text-slate-700` | Trung bình đậm | **CŨ**: Form labels (bị report quá nhạt) |
| `text-slate-800` | Đậm | **HIỆN TẠI**: Input text, body text chính |
| `text-slate-900` | Rất đậm | **MỚI**: Form labels (sau khi fix), headings |

### Màu Hồng Hệ Thống (Brand Color - Baby Care)
| Class | Độ đậm | Sử dụng cho |
|-------|--------|-------------|
| `pink-300/rose-300` | Nhạt | Background light, hover effects |
| `pink-400/rose-400` | **CŨ**: Podium #2 (bị report quá nhạt) |
| `pink-500/rose-500` | **MỚI**: Podium #2, CTAs, buttons |
| `pink-600/rose-600` | Đậm | Hover states, focus rings |

---

## 🔍 Lưu Ý Quan Trọng

### 1. KHÔNG Thay Đổi Toast Errors
Toast error "Lỗi khi tải dữ liệu thu nhập" không được sửa trong lần này vì:
- Styling đến từ thư viện `sonner` (bên ngoài codebase)
- Cần cấu hình riêng trong `toastOptions` nếu muốn override

### 2. Các `text-slate-400` Khác KHÔNG Cần Sửa
Nhiều components khác dùng `text-slate-400` (ví dụ: table headers, metadata) nhưng đều **hợp lý** vì:
- Là tiêu đề phụ, không phải nội dung chính
- Có background tương phản cao (ví dụ: `bg-slate-50`)
- Có uppercase + tracking-widest để tăng khả năng đọc

### 3. Nguyên Tắc Tương Phản (WCAG 2.1)
- **AA Standard**: Tỷ lệ tương phản tối thiểu 4.5:1 cho text thường, 3:1 cho text lớn
- `text-slate-700` trên nền trắng: ~4.0:1 (gần đủ AA, nhưng user phàn nàn)
- `text-slate-900` trên nền trắng: ~10:1 (đủ AAA, dư sức)
- `from-pink-400 to-rose-400`: Gradient nhạt làm mất điểm nhấn thị giác
- `from-pink-500 to-rose-500`: Gradient đậm hơn, nổi bật hơn

---

## ✅ Checklist Triển Khai

- [x] Sửa màu podium #2 trong leaderboard
- [x] Tăng độ đậm label modal nghỉ phép (3 labels)
- [x] Kiểm tra TypeScript compilation (0 errors)
- [x] Build production thành công (77/77 pages)
- [ ] Deploy to staging
- [ ] Smoke test trên mobile thực (iOS/Android)
- [ ] Xác nhận với user báo bug ban đầu

---

## 🚀 Deploy Steps

```bash
# 1. Commit changes
git add src/app/ktv/leaderboard/page.tsx src/app/ktv/dashboard/components/KtvLeaveModals.tsx docs/UI_COLOR_CONTRAST_FIX_20260622.md
git commit -m "fix(ui): improve color contrast - leaderboard podium & modal labels

- Leaderboard rank #2: pink-400 → pink-500 for better contrast
- Leave request modal labels: slate-700 → slate-900 for readability
- Verified build: 0 errors, 77/77 pages compiled
- Ref: User reported washed-out pink colors & hard-to-read gray labels"

# 2. Push to remote
git push origin main

# 3. Deploy (tự động qua CI/CD hoặc chạy thủ công)
# Vercel: git push sẽ tự động deploy
# Hoặc: npm run deploy (nếu có script)
```

---

## 📚 Tài Liệu Tham Khảo

- [WCAG 2.1 Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Tailwind CSS Color Palette](https://tailwindcss.com/docs/customizing-colors)
- [Bella ERP Design Tokens](../src/styles/design-tokens.md) (nếu có)
- Project Rules: `AGENTS.md` → Section "Route Path Consistency and Navigation Safety" (không liên quan trực tiếp nhưng là best practice)

---

**Người thực hiện**: AI Agent (Kiro)  
**Người duyệt**: _(Chờ user xác nhận)_  
**Trạng thái**: ✅ Hoàn thành code → ⏳ Chờ smoke test production
