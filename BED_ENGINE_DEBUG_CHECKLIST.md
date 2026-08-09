# 🔍 BED ENGINE ERROR DEBUG CHECKLIST

**Error:** "No available beds matching criteria"  
**Location:** `src/platform/healthcare/engines/bed-engine/bed-engine.service.ts`  
**Date:** 09/08/2026

---

## ✅ Đã Xác Định

1. ✅ **Schema xác định:**
   - Table: `hc_beds`
   - Status column: `VARCHAR(50)` (not ENUM)
   - Default value: `'available'`
   - Location: `supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql` line 63

2. ✅ **Frontend mapping chính xác:**
   - UI hiển thị: "Sẵn sàng"
   - DB value: `'available'`
   - Location: `src/app/dashboard/hospital/beds/page.tsx` line 40-50

3. ✅ **Code query đúng:**
   - `.eq('status', 'available')` ✅ Correct
   - NOT using `.eq('status', 'SẴN SÀNG')` ❌

---

## 🐛 Nguyên Nhân Có Thể

### **Giả Thuyết 1: Bed không thực sự available trong DB** (Khả năng cao 70%)

**Triệu chứng:**
- UI hiển thị "SẴN SÀNG" (màu xanh)
- DB thực tế có status khác: `'occupied'`, `'cleaning'`, `'maintenance'`
- UI chưa refresh hoặc có cache

**Cách kiểm tra:**
```sql
-- Run trong Supabase SQL Editor
SELECT 
  bed_code,
  ward_id,
  status,
  bed_type,
  current_patient_id,
  current_admission_id
FROM hc_beds
WHERE bed_code = 'ICU-BED-04'
  AND tenant_id = '<your-tenant-id>';
```

**Giải pháp nếu đúng:**
- Fix: UI cần fetch real-time status từ DB (không cache)
- Implement Supabase Realtime subscriptions cho bed status updates

---

### **Giả Thuyết 2: Ward ID không khớp** (Khả năng 20%)

**Triệu chứng:**
- Request tìm giường trong ward `'w-icu'`
- Giường ICU-BED-04 thực tế thuộc ward `'ward-icu-01'` (format khác)

**Cách kiểm tra:**
```sql
-- Run trong Supabase SQL Editor
SELECT 
  b.bed_code,
  b.ward_id,
  w.id AS ward_id_from_wards_table,
  w.ward_name,
  b.status
FROM hc_beds b
LEFT JOIN hc_wards w ON b.ward_id = w.id
WHERE b.bed_code = 'ICU-BED-04';
```

**Giải pháp nếu đúng:**
- Fix: Chuẩn hóa ward ID format trong toàn hệ thống
- Kiểm tra request gửi từ frontend có đúng ward ID không

---

### **Giả Thuyết 3: Bed Type filter không khớp** (Khả năng 10%)

**Triệu chứng:**
- Request yêu cầu `bedType: 'icu'`
- Giường ICU-BED-04 có `bed_type: 'standard'` hoặc NULL

**Cách kiểm tra:**
```sql
-- Run trong Supabase SQL Editor
SELECT 
  bed_code,
  bed_type,
  status,
  ward_id
FROM hc_beds
WHERE bed_code = 'ICU-BED-04';
```

**Giải pháp nếu đúng:**
- Fix: Update `bed_type` cho tất cả ICU beds về `'icu'`
- Hoặc remove bedType filter trong trường hợp không cần thiết chặt

---

## 🔧 Debug Code Đã Thêm

**File:** `src/platform/healthcare/engines/bed-engine/bed-engine.service.ts`

**Changes:**
1. ✅ Added debug logging before error return (line 56-66)
2. ✅ Added additional debug query to fetch all beds in ward (line 68-75)
3. ✅ Enhanced error response with breakdown details (line 77-93)

**Debug Output Example:**
```typescript
{
  success: false,
  error: {
    code: 'NO_BEDS_AVAILABLE',
    message: 'No available beds matching criteria',
    details: {
      requestedWardId: 'w-icu',
      requestedBedType: 'icu',
      requestedPreferredBedId: null,
      totalBedsInWard: 8,
      bedsStatusBreakdown: {
        'occupied': 5,
        'cleaning': 2,
        'maintenance': 1,
        'available': 0  // ❌ No available beds!
      }
    }
  }
}
```

---

## 📋 Next Steps

### **Step 1: Kiểm tra Browser Console**
Mở DevTools khi reproduce lỗi, xem console log:
```
[BedEngine] allocateBed debug: {...}
[BedEngine] No beds available. Debug info: {...}
```

### **Step 2: Kiểm tra Database Trực Tiếp**
Chạy SQL queries ở trên trong Supabase SQL Editor

### **Step 3: Reproduce Lỗi**
1. Mở trang Hospital Beds: `http://localhost:3000/dashboard/hospital/beds`
2. Click vào giường ICU-BED-04 (hoặc bất kỳ giường "Sẵn sàng")
3. Thử phân bổ bệnh nhân
4. Check console logs

### **Step 4: So Sánh UI vs DB**
```typescript
// Frontend query (check network tab)
const { data: frontendBeds } = await supabase
  .from('hc_beds')
  .select('*')
  .eq('status', 'available');

// Backend query (check server logs)
console.log('[BedEngine] Query:', {
  tenantId, wardId, status: 'available', bedType
});
```

### **Step 5: Fix Based on Root Cause**
- If **Hypothesis 1** → Add Realtime subscription + force refresh
- If **Hypothesis 2** → Standardize ward ID format
- If **Hypothesis 3** → Update bed_type values or relax filter

---

## 🚨 Production Impact

**Severity:** 🔴 **CRITICAL**  
**User Impact:** Không thể phân bổ giường cho bệnh nhân mới  
**Workaround:** Manual SQL update hoặc skip bed allocation temporarily

**Recommended Priority:** **P0 - Fix immediately**

---

## 📚 Related Files

- **Bed Engine:** `src/platform/healthcare/engines/bed-engine/bed-engine.service.ts`
- **Frontend UI:** `src/app/dashboard/hospital/beds/page.tsx`
- **Database Schema:** `supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql`
- **Bed Hook:** `src/hooks/use-bed-engine.ts`
- **Contract:** `src/platform/healthcare/contracts/bed-engine.contract.ts`

---

## 📝 Notes

- Law 11 compliance: No `any` types in Bed Engine ✅
- Law 2 compliance: Engine provides abstraction over DB ✅
- Law 5 compliance: Event publishing needed (TODO) ⚠️

---

**Last Updated:** 09/08/2026  
**Status:** 🟡 Debug code added, awaiting reproduction
