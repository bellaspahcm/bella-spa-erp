# Bella Spa - Cấu Hình Lương & Thưởng Mặc Định

**Tenant:** Bella Spa Headquarter  
**Ngày tạo:** June 22, 2026  
**Trạng thái:** ✅ Đã cài đặt (default configs)  

---

## Tổng Quan Settings Mới

Bella Spa giờ có **5 providers** trong hệ thống lương & thưởng:

| # | Provider | Tên tiếng Việt | Trạng thái mặc định | Có thể toggle on/off |
|---|----------|-----------------|---------------------|---------------------|
| 1 | Commission | Hoa hồng ca làm | ✅ **BẬT** | ✅ Có |
| 2 | KPI | Thưởng hiệu suất | ⚪ **TẮT** | ✅ Có |
| 3 | Attendance | Phạt kỷ luật | ✅ **BẬT** | ✅ Có |
| 4 | Rating | Thưởng chất lượng | ⚪ **TẮT** | ✅ Có |
| 5 | Bonus | Thưởng thủ công | ⚪ **TẮT** | ✅ Có |

---

## Chi Tiết Từng Provider

### 1. 🎯 Hoa Hồng Ca Làm (Commission)

**Trạng thái:** ✅ **BẬT** (enabled by default)  
**Chiến lược:** Fixed (cố định)  

**Cấu hình:**
```json
{
  "rate": 120000,        // 120,000 VNĐ/ca
  "minSessions": 0       // Không yêu cầu số ca tối thiểu
}
```

**Ý nghĩa:**
- Mỗi ca hoàn thành → KTV nhận **120,000 VNĐ**
- Không phân biệt gói dịch vụ (áp dụng chung)
- Tự động tính vào lương cuối tháng

**Có thể tùy chỉnh:**
- ✅ Tăng/giảm hoa hồng (ví dụ: 150k/ca)
- ✅ Đổi sang chiến lược khác (tier, percentage)
- ✅ Tắt hẳn nếu không muốn trả hoa hồng

---

### 2. 🏆 Thưởng KPI (KPI Bonus)

**Trạng thái:** ⚪ **TẮT** (disabled by default)  
**Chiến lược:** Threshold (ngưỡng)  

**Cấu hình:**
```json
{
  "target": 30,          // Mục tiêu: 30 ca/tháng
  "bonus": 1000000,      // Thưởng: 1,000,000 VNĐ
  "metric": "sessions"   // Tính theo số ca
}
```

**Ý nghĩa:**
- KTV làm đủ **30 ca/tháng** → Nhận thêm **1 triệu đồng**
- Không đủ 30 ca → Không có thưởng
- Chỉ áp dụng khi **Admin bật toggle** trong Settings

**Khi nào nên bật:**
- Muốn khuyến khích KTV làm nhiều ca
- Có đội ngũ KTV đông, cần phân biệt hiệu suất
- Tạo động lực thi đua

**Có thể tùy chỉnh:**
- ✅ Thay đổi mục tiêu (ví dụ: 40 ca)
- ✅ Thay đổi thưởng (ví dụ: 2 triệu)
- ✅ Đổi sang chiến lược khác (linear, tier)

---

### 3. 📅 Phạt Kỷ Luật (Attendance Penalties)

**Trạng thái:** ✅ **BẬT** (enabled by default)  
**Chiến lược:** Late Deduction (phạt đi trễ)  

**Cấu hình:**
```json
{
  "latePenalty": 50000,       // Phạt đi trễ: 50,000 VNĐ
  "absentPenalty": 200000,    // Phạt vắng: 200,000 VNĐ
  "lateGracePeriod": 15       // Dung sai: 15 phút
}
```

**Ý nghĩa:**
- Đi trễ > 15 phút → Trừ **50,000 VNĐ**
- Vắng không phép → Trừ **200,000 VNĐ**
- Đi trễ ≤ 15 phút → Không phạt (grace period)

**Logic tính:**
- Hệ thống đọc từ bảng `attendance`
- Tự động trừ vào cột `violations_deduction` trong `salary_records`
- Hiển thị trong bảng lương cuối tháng

**Có thể tùy chỉnh:**
- ✅ Tăng/giảm mức phạt
- ✅ Thay đổi grace period (ví dụ: 30 phút)
- ✅ Tắt hẳn nếu không muốn phạt

---

### 4. ⭐ Thưởng Chất Lượng (Rating Bonus)

**Trạng thái:** ⚪ **TẮT** (disabled by default)  
**Chiến lược:** Threshold (ngưỡng)  

**Cấu hình:**
```json
{
  "minRating": 4.5,      // Đánh giá tối thiểu: 4.5 sao
  "bonus": 50000         // Thưởng: 50,000 VNĐ
}
```

**Ý nghĩa:**
- Đánh giá trung bình ≥ **4.5 sao** → Nhận thêm **50,000 VNĐ**
- Dưới 4.5 sao → Không có thưởng
- Chỉ áp dụng khi **Admin bật toggle** trong Settings

**Khi nào nên bật:**
- Muốn khuyến khích KTV phục vụ tốt
- Có hệ thống đánh giá từ khách hàng
- Muốn tạo động lực cải thiện chất lượng

**Có thể tùy chỉnh:**
- ✅ Thay đổi ngưỡng (ví dụ: 4.0 sao)
- ✅ Thay đổi thưởng (ví dụ: 100,000 VNĐ)
- ✅ Đổi sang chiến lược khác (linear, tier)

---

### 5. 💰 Thưởng Thủ Công (Manual Bonus)

**Trạng thái:** ⚪ **TẮT** (disabled by default)  
**Chiến lược:** Không có (manual assignment)  

**Cấu hình:**
```json
{}  // Không có config tự động
```

**Ý nghĩa:**
- Admin tự nhập thưởng cho từng KTV
- Không có công thức tự động
- Dùng cho: Thưởng sinh nhật, lễ Tết, thành tích đặc biệt

**Khi nào dùng:**
- Thưởng dịp lễ (Tết, 8/3, 20/10)
- Thưởng nhân viên xuất sắc tháng
- Thưởng ad-hoc không theo quy tắc cố định

**Có thể tùy chỉnh:**
- ⚠️ Provider này không có config tự động
- ✅ Admin nhập thủ công trong màn hình Salary Adjustments

---

## Cách Xem Settings Trong UI

**Bước 1:** Đăng nhập vào http://localhost:3000  
**Bước 2:** Vào menu **Dashboard > Settings**  
**Bước 3:** Click tab **"Lương & Thưởng"**  

**Màn hình hiển thị:**
```
┌─────────────────────────────────────────────────┐
│  🏆 THƯỞNG KPI                      [Toggle ⚪]  │
│  ├─ Mục tiêu (số ca):     [  30  ]             │
│  └─ Thưởng (VNĐ):         [1000000]            │
│  ⚠️ Thưởng KPI hiện đang TẮT                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  📅 PHẠT KỶ LUẬT                    [Toggle ✅]  │
│  ├─ Phạt đi trễ (VNĐ):   [50000 ]              │
│  ├─ Phạt vắng (VNĐ):     [200000]              │
│  └─ Dung sai (phút):     [  15  ]              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ⭐ THƯỞNG CHẤT LƯỢNG                [Toggle ⚪]  │
│  ├─ Đánh giá tối thiểu:  [ 4.5 ]               │
│  └─ Thưởng (VNĐ):        [50000]               │
│  ⚠️ Thưởng chất lượng hiện đang TẮT             │
└─────────────────────────────────────────────────┘

                     [Lưu cấu hình]
```

---

## Cách Sửa Settings

### Ví dụ 1: Bật thưởng KPI
1. Vào Settings > Lương & Thưởng
2. Tìm section "🏆 THƯỞNG KPI"
3. Click toggle ⚪ → ✅
4. Điều chỉnh mục tiêu (nếu muốn): 30 ca → 40 ca
5. Điều chỉnh thưởng (nếu muốn): 1M → 2M
6. Click **"Lưu cấu hình"**

**Kết quả:**
- Từ tháng sau, KTV làm đủ 40 ca sẽ nhận thêm 2 triệu

---

### Ví dụ 2: Giảm phạt đi trễ
1. Vào Settings > Lương & Thưởng
2. Tìm section "📅 PHẠT KỶ LUẬT"
3. Sửa "Phạt đi trễ": 50000 → 30000
4. Sửa "Dung sai": 15 → 30 (cho thêm 30 phút)
5. Click **"Lưu cấu hình"**

**Kết quả:**
- Đi trễ ≤ 30 phút: Không phạt
- Đi trễ > 30 phút: Phạt 30,000 VNĐ (giảm từ 50k)

---

### Ví dụ 3: Tắt hẳn phạt kỷ luật
1. Vào Settings > Lương & Thưởng
2. Tìm section "📅 PHẠT KỶ LUẬT"
3. Click toggle ✅ → ⚪
4. Click **"Lưu cấu hình"**

**Kết quả:**
- Hệ thống không tự động trừ lương khi KTV đi trễ/vắng
- Admin vẫn có thể thủ công trừ lương trong Salary Adjustments

---

## So Sánh: Trước vs. Sau

### Trước khi có Settings mới (Old System)

**Vấn đề:**
- Tất cả rules hardcoded trong code
- Muốn đổi hoa hồng 120k → 150k phải sửa code, commit, deploy
- Không thể bật/tắt thưởng KPI theo tháng
- Mỗi tenant dùng chung 1 config (không flexible)

**Ví dụ code cũ:**
```typescript
// Hardcoded ❌
const commission = 120000;  // Muốn đổi phải sửa code
const kpiBonus = 1000000;   // Không thể tắt được
```

---

### Sau khi có Settings mới (New System)

**Ưu điểm:**
- ✅ Admin tự sửa trong UI, không cần dev
- ✅ Bật/tắt provider theo tháng (flexible)
- ✅ Mỗi tenant có config riêng (multi-tenant safe)
- ✅ Audit trail (biết ai sửa gì lúc nào)
- ✅ Rollback được (lưu lịch sử thay đổi)

**Ví dụ code mới:**
```typescript
// Configuration-driven ✅
const config = await PayrollConfigService.getProviderConfig('kpi');
if (config.enabled) {
  const kpiBonus = config.config.bonus;  // Đọc từ database
}
```

---

## FAQ - Câu Hỏi Thường Gặp

### Q1: Tôi sửa settings, khi nào có hiệu lực?
**A:** Ngay lập tức cho kỳ lương hiện tại. Bảng lương đã chốt (finalized) không bị ảnh hưởng.

### Q2: Tôi có thể sửa settings giữa tháng không?
**A:** Có! Nhưng chỉ áp dụng cho các ca làm/chấm công sau khi sửa. Dữ liệu cũ không bị tính lại.

### Q3: Tôi tắt thưởng KPI, KTV có mất thưởng tháng này không?
**A:** Không. Nếu đã tính thưởng rồi (bảng lương đã save) thì không mất. Chỉ tháng sau mới không có.

### Q4: Tôi có thể rollback về config cũ không?
**A:** Có! Vào Audit Trail, xem lịch sử thay đổi, copy config cũ, paste lại.

### Q5: Các tenant khác (Bella 2, Bella 3) có bị ảnh hưởng không?
**A:** Không! Mỗi tenant có config riêng. Sửa Bella HQ không ảnh hưởng Bella 2.

---

## Roadmap - Tương Lai

### Week 3 (Đang làm)
- ✅ Settings UI hoàn chỉnh
- ⏳ Test với real data
- ⏳ Deploy to production

### Week 4+ (Kế hoạch)
- Strategy selector dropdown (cho phép đổi từ threshold → tier → linear)
- Commission settings (tương tự, cho phép config hoa hồng theo gói)
- Salary preview calculator (xem trước lương trước khi save)
- Config templates ("Aggressive KPI", "Conservative", "Balanced")

---

## Kết Luận

Bella Spa giờ có **5 providers** linh hoạt:
1. ✅ **Hoa hồng ca làm** (120k/ca, bật sẵn)
2. ⚪ **Thưởng KPI** (30 ca → 1M, tắt mặc định)
3. ✅ **Phạt kỷ luật** (50k late, 200k absent, bật sẵn)
4. ⚪ **Thưởng chất lượng** (≥4.5★ → 50k, tắt mặc định)
5. ⚪ **Thưởng thủ công** (admin nhập, tắt mặc định)

**Admin có thể:**
- Bật/tắt từng provider theo nhu cầu
- Sửa số liệu (mục tiêu, thưởng, phạt) không cần dev
- Xem lịch sử thay đổi
- Rollback về config cũ

**Đã sẵn sàng test:** http://localhost:3000/dashboard/settings?tab=salary 🚀
