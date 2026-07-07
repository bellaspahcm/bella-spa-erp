# Cách Thêm Mức Thưởng Mới

**Câu hỏi:** Nếu muốn thêm mức thưởng khác thì sao?

---

## TL;DR - 3 Cách

| Cách | Độ Khó | Thời Gian | Phù Hợp Cho |
|------|--------|-----------|-------------|
| **1. Đổi Strategy** | ⭐ Dễ | 2h | Nhiều mức cùng rule (KPI 20/30/40 ca) |
| **2. Provider Mới** | ⭐⭐⭐ Khó | 6h | Rule hoàn toàn mới (thưởng bán hàng) |
| **3. Multi-Instance** | ⭐⭐ TB | 3h | Clone rule có sẵn (2 loại KPI) |

---

## Cách 1: Đổi Strategy ⭐ KHUYÊN DÙNG

**Ví dụ:** KPI nhiều mức thay vì 1 mức
- Hiện tại: 30 ca → 1M (threshold)
- Muốn: 20-29 ca → 500k, 30-39 ca → 1M, 40+ ca → 2M (tier)

**Giải pháp:** Đổi strategy từ `threshold` → `tier`

**Providers đã support 3 strategies:**
1. `threshold`: Đạt ngưỡng → nhận thưởng (30 ca → 1M)
2. `linear`: Tuyến tính (mỗi ca thêm → +50k)
3. `tier`: Bậc thang (nhiều mức)

**Cần làm:**
1. Sửa Settings UI: Thêm dropdown chọn strategy
2. Thêm form nhập config theo strategy
3. Save → Provider tự động áp dụng

**Code mẫu:**
```tsx
<Select value={kpiStrategy}>
  <option value="threshold">Ngưỡng đơn</option>
  <option value="tier">Bậc thang</option>
  <option value="linear">Tuyến tính</option>
</Select>
```

---

## Cách 2: Tạo Provider Mới

**Ví dụ:** Thưởng bán hàng (rule hoàn toàn mới)
- Bán sản phẩm > 5M/tháng → 10% doanh số

**Giải pháp:** Tạo `SalesProvider`

**Bước 1:** Tạo provider class
```typescript
// src/services/providers/sales-provider.ts
export class SalesProvider implements IPayrollProvider {
  key = 'sales';
  async calculate(input) {
    const config = await getProviderConfig('sales');
    if (!config.enabled) return [];
    
    const revenue = await getSalesRevenue(input.employeeId);
    if (revenue > config.config.minRevenue) {
      return [{ type: 'bonus', value: revenue * config.config.percentage }];
    }
    return [];
  }
}
```

**Bước 2:** Insert config vào DB
**Bước 3:** Thêm UI section trong Settings

---

## Cách 3: Multi-Instance

**Ví dụ:** 2 loại KPI (cơ bản + VIP)
- KPI cơ bản: 30 ca → 1M
- KPI VIP: 50 ca → 3M

**Giải pháp:** Dùng 2 provider keys (`kpi` + `kpi_vip`)

---

## Khuyến Nghị

**Hiện tại:** Làm **Cách 1** (strategy selector)
- Thời gian: 2-3 giờ
- Không cần code provider mới
- UI cho phép chọn strategy + nhập config

**Tương lai:** **Cách 2** khi cần rule mới (bán hàng, giữ chân khách)

**Chi tiết:** Đọc file này hoặc hỏi tôi!
