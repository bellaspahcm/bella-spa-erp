# HƯỚNG DẪN XÓA CACHE ĐỂ TEST FIX MỚI

## Vấn đề
Browser đang dùng JavaScript cũ (trước khi fix) nên vẫn bị vòng lặp vô hạn.

## Giải pháp

### Cách 1: Hard Refresh (Nhanh nhất)
1. Mở trang dashboard KTV
2. Nhấn **Ctrl + Shift + R** (Windows) hoặc **Cmd + Shift + R** (Mac)
3. Đợi trang load lại hoàn toàn

### Cách 2: Clear Site Data (Triệt để nhất)
1. Mở DevTools (F12)
2. Vào tab **Application**
3. Sidebar bên trái → **Storage** → **Clear site data**
4. Click nút "Clear site data"
5. Refresh trang (F5)

### Cách 3: Unregister Service Worker
1. Mở DevTools (F12)
2. Vào tab **Application**
3. Sidebar bên trái → **Service Workers**
4. Tìm service worker của site
5. Click "Unregister"
6. Refresh trang (F5)

### Cách 4: Incognito Mode (Chắc chắn nhất)
1. Mở cửa sổ **Incognito/Private** mới
2. Vào trang dashboard KTV
3. Test performance

## Kiểm tra sau khi clear cache

Mở Network tab và kiểm tra:
- ✅ **CHỈ CÓ 1 request `dashboard`** duy nhất (không phải 10-20 requests)
- ✅ **JavaScript files có hash MỚI** (không phải `0x49p_i-1793l3p.js` cũ)
- ✅ **Thời gian load < 3 giây**
- ✅ **"Finish" time < 10 giây** (thay vì 32s)

## Nếu vẫn chậm sau khi clear cache

Có thể Vercel deployment chưa hoàn tất. Chờ thêm 2-3 phút rồi thử lại.
