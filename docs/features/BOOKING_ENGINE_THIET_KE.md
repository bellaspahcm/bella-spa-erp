# Booking Engine - Thiết Kế Chi Tiết

**Phiên bản**: 1.0.0  
**Ngày tạo**: 2026-07-09  
**Ưu tiên**: ⭐⭐⭐⭐⭐ Critical  
**Timeline**: 2-3 tuần

---

## 🏗️ VỊ TRÍ TRONG KIẾN TRÚC

```
Core Platform Layer
  ├── Decision Engine (Core)
  ├── Workflow Engine (Core)
  └── BI Engine (Core)

Business Engine Layer
  ├── Booking Engine        ← ĐÂY
  ├── Payroll Engine
  ├── POS Engine
  └── ...

Booking Engine (Business)
  ├── Assignment Provider
  ├── Capacity Provider
  ├── Conflict Provider
  ├── Waitlist Provider
  ├── Pricing Provider
  └── Cancellation Provider
```

**Lưu ý**: Đây là **Business Engine**, không phải Core Platform. Các "Provider" bên trong Booking Engine là **business-specific providers**, khác với Decision Engine Providers (Booking Provider, Payroll Provider đã có sẵn trong Core Platform).

---

## 🎯 MỤC TIÊU

**Từ**: Công cụ đặt lịch thủ công  
**Sang**: Hệ thống tối ưu doanh thu thông minh

### Tác Động Mong Đợi
- **+15-20%** tỷ lệ chuyển đổi booking
- **+10-15%** doanh thu mỗi booking (dynamic pricing)
- **-50%** thời gian admin (tự động hóa)
- **+25%** tỷ lệ sử dụng KTV

---

## 🏗️ BOOKING ENGINE - 6 CORE PROVIDERS

### 1. Assignment Provider 🤖
**Chức năng**: Tự động gán KTV tối ưu

**Tiêu chí**:
- Skills match (package → KTV specialty)
- Availability (lịch trống, không nghỉ phép)
- Workload balance (cân bằng số ca)
- Performance (rating, completion rate)
- Customer preference (khách quen → KTV cũ)

---

### 2. Capacity Provider 📊
**Chức năng**: Quản lý công suất real-time

**Theo dõi**:
- Mỗi KTV: Max ca/ngày, hiện tại, còn trống
- Mỗi Time Slot: Tổng capacity, đã book, còn trống
- Mỗi Chi nhánh: Phân bổ capacity

**Quyết định**:
- Chấp nhận/từ chối booking
- Gợi ý time slot khác
- Kích hoạt waitlist khi full

---

### 3. Conflict Provider ⚠️
**Chức năng**: Phát hiện xung đột trước khi confirm

**Loại xung đột**:
- Double-booking (KTV trùng giờ)
- Overbooking (vượt capacity)
- Equipment conflict (phòng/thiết bị)
- Leave conflict (KTV nghỉ phép)
- Holiday conflict (ngày nghỉ lễ)

**Giải quyết**:
- Gợi ý KTV khác
- Gợi ý time slot khác
- Đưa vào waitlist

---

### 4. Waitlist Provider 📋
**Chức năng**: Chuyển đổi khách chờ → booking

**Khi nào vào waitlist**:
- Time slot đã full
- KTV mong muốn không rảnh
- Thiết bị không có sẵn

**Tự động chuyển đổi**:
- Có cancellation → Notify waitlist theo priority
- Có capacity mới → Batch notify
- Hết hạn sau 7 ngày → Auto-remove

**Priority**:
- VIP (cao nhất)
- Loyal (cao)
- First-come-first-served (bình thường)

---

### 5. Pricing Provider 💰
**Chức năng**: Tối ưu giá theo demand

**Yếu tố ảnh hưởng giá**:
- **Demand**: Cao → +10-20%
- **Giờ**: Peak (10-14h, 18-21h) → +10-20%
- **Ngày**: Cuối tuần → +15%, Lễ → +25%
- **Advance**: Last-minute (<24h) → +20%, Sớm (>7 ngày) → -10%
- **Customer**: VIP → discount, New → first-time discount
- **Capacity**: Thấp (<50%) → giảm giá, Cao (>80%) → tăng giá

**Ví dụ**:
```
Base: 500K
Peak hour (+15%): 575K
Cuối tuần (+15%): 661K
High demand (+10%): 727K
→ Làm tròn: 730K

VIP discount (-15%): 620K (giá cuối)
```

---

### 6. Cancellation Provider 🔄
**Chức năng**: Minimize mất doanh thu, maximize rebooking

**Chính sách hoàn tiền**:
- **>48h trước**: 100% refund hoặc đổi lịch free
- **24-48h trước**: 50% refund hoặc đổi lịch +100K
- **<24h trước**: Không refund, đổi lịch +50%
- **No-show**: Không refund, không đổi lịch

**Smart refund**:
- Khách quen → Linh hoạt hơn
- High-value → Giữ khách (retention)
- Lý do khẩn cấp → Linh hoạt
- Có thể bán lại slot → Full refund

---

## 🗄️ DATABASE SCHEMA MỚI

### Bảng Mới

**1. waitlist** (Hàng đợi)
```sql
- customer_id, package_id
- preferred_date, preferred_time_slot
- preferred_ktv_id
- priority_score (VIP=100, Loyal=50, New=0)
- status (active, converted, expired, cancelled)
- expires_at (7 ngày)
```

**2. pricing_rules** (Quy tắc giá)
```sql
- rule_type (peak_hour, weekend, demand, seasonal)
- condition (JSON: giờ, ngày, điều kiện)
- multiplier (1.15 = +15%)
- priority (thứ tự áp dụng)
```

**3. capacity_snapshots** (Báo cáo capacity)
```sql
- snapshot_date, snapshot_hour
- total_capacity, booked, available
- utilization_rate (%)
```

**4. booking_events** (Lịch sử booking)
```sql
- booking_id, event_type
- (created, assigned, confirmed, cancelled, completed)
- event_data (JSON)
```

---

## 🔄 WORKFLOWS

### Workflow 1: Tạo Booking Mới

**Input**: Customer, Package, Date/Time, KTV (optional)

**Steps**:
1. **Validate** → Kiểm tra hợp lệ
2. **Check Capacity** → Có slot không?
3. **Detect Conflicts** → Có xung đột không?
4. **Auto-assign KTV** → Gán KTV tự động
5. **Calculate Price** → Tính giá dynamic
6. **Create Booking** → Tạo booking hoặc waitlist

---

### Workflow 2: Chuyển Đổi Waitlist

**Trigger**: Có cancellation HOẶC capacity mới

**Steps**:
1. **Tìm waitlist** → Priority cao nhất
2. **Check availability** → Vẫn còn không?
3. **Notify customer** → SMS/Email (2h để response)
4. **Convert** → Tạo booking nếu accept
5. **Cleanup** → Xóa expired entries

---

### Workflow 3: Cancellation & Refund

**Steps**:
1. **Validate** → Kiểm tra quyền hủy
2. **Calculate refund** → Theo policy
3. **Process refund** → Hoàn tiền
4. **Release capacity** → Mở slot
5. **Notify waitlist** → Offer cho customer tiếp
6. **Retention** → Gợi ý rebooking + voucher

---

## 🧪 TESTING (65+ SCENARIOS)

### Auto-Assignment (15 tests)
- Single KTV available
- Multiple KTVs → Highest score
- KTV on leave → Skip
- Workload balancing
- Customer preference
- ...

### Capacity (12 tests)
- Available → Accept
- No capacity → Waitlist
- Overbooking protection
- Real-time updates
- ...

### Conflict (10 tests)
- Double-booking detection
- Equipment conflict
- Leave conflict
- Holiday conflict
- ...

### Waitlist (8 tests)
- Priority ordering (VIP first)
- Auto-convert on availability
- Expiry logic (7 days)
- ...

### Pricing (10 tests)
- Peak hour +15%
- Weekend +15%
- High demand surge
- VIP discount
- ...

### Cancellation (10 tests)
- >48h → 100% refund
- <24h → No refund
- Frequent canceller → Stricter
- ...

---

## 📈 PERFORMANCE TARGETS

- Auto-assignment: <50ms
- Capacity check: <20ms
- Conflict detection: <30ms
- Pricing: <40ms
- Full booking: <500ms

**Throughput**:
- 1,000 bookings/giờ
- 10,000 concurrent users

---

## 📅 IMPLEMENTATION PLAN (2-3 tuần)

### Tuần 1: Foundation
- **Ngày 1-2**: Database schema + migrations
- **Ngày 3-5**: Core Providers (Auto-assign, Capacity, Conflict)

### Tuần 2: Decision Logic
- **Ngày 6-8**: More Providers (Waitlist, Pricing, Cancellation)
- **Ngày 9-10**: Provider integration + Feature flags

### Tuần 3: Workflows & Testing
- **Ngày 11-13**: 4 Workflows implementation
- **Ngày 14-15**: 65+ tests + Bug fixes

---

## 📋 DELIVERABLES

**Code** (~5,700 dòng):
- [ ] 6 Decision Providers (~1,500 dòng)
- [ ] 4 Workflows (~800 dòng)
- [ ] 4 Database migrations (~400 dòng)
- [ ] Adapters (~600 dòng)
- [ ] API routes (~400 dòng)
- [ ] 65+ tests (~2,000 dòng)

**Docs**:
- [ ] Design spec (file này)
- [ ] API documentation
- [ ] User guide
- [ ] Admin guide

---

## ✅ SUCCESS CRITERIA

### Technical
- [ ] 65+ tests passing (100%)
- [ ] Latency <50ms
- [ ] Throughput >1,000 bookings/giờ

### Business
- [ ] +15% booking conversion
- [ ] +10% revenue/booking
- [ ] -50% admin time
- [ ] +20% KTV utilization

---

## 📞 STAKEHOLDERS

**Decision Makers**: CEO, CPO, CFO  
**Contributors**: 2 Backend, 1 Frontend, 1 QA, 0.5 BA  
**Reviewers**: Booking Manager, KTV Leads, Finance Team

---

## 🚀 NEXT STEPS

1. ✅ Review design spec này
2. 📋 Tạo task breakdown chi tiết
3. 📋 Setup dev environment
4. 📋 Kick-off meeting với team
5. 📋 Bắt đầu Tuần 1: Database

---

**Trạng thái**: Chờ phê duyệt  
**Owner**: CTO Office  
**Cập nhật**: 2026-07-09
