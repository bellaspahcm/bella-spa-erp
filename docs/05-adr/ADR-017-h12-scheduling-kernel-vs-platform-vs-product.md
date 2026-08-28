# ADR-017: H12 — Scheduling Engine: Healthcare Kernel vs. Platform/Product Layer

**Status:** OPEN — Awaiting Architecture Decision  
**Date:** 2026-08-27  
**Author:** Kiến trúc sư trưởng (Human Architect required)  
**Context:** Reality Check 2026-08-27 phát hiện `scheduling-engine/` là thư mục rỗng, không contract, không implementation, bị loại khỏi ACTIVE_ENGINES. Đây là ADR phức tạp nhất vì scheduling có boundary overlap với Platform Core, Spa Kernel, và nhiều Product verticals.

---

## 1. Bối cảnh

`scheduling-engine/` tại `src/platform/healthcare/engines/scheduling-engine/` là **thư mục rỗng hoàn toàn**.

Không có contract, không có service, không có tests.

Những gì thực sự tồn tại:

| Location | Mô tả | Layer |
|---|---|---|
| `src/modules/spa/services/session.ts` | Spa session scheduling | Spa Kernel |
| `src/products/bella-dental/services/dental-chair.service.ts` | Dental chair reservation + scheduling state | Product |
| `src/modules/bella-auto/services/ServiceAppointmentService.ts` | Auto service appointment | Product |
| `src/modules/bella-healthcare/contexts/shared/EncounterSaga.ts` | `Scheduling.Appointment.Created.v1` event handler | Healthcare Module |
| `src/foundation/assignment/InMemoryAssignmentProvider.ts` | Round-robin assignment (approximates scheduling in tests) | Foundation |

---

## 2. Câu hỏi kiến trúc — Quan trọng hơn H7

> **Healthcare Scheduling có business semantics riêng mà generic scheduling không giải quyết được không?**

Đây là câu hỏi khó hơn H7 vì scheduling là concept cross-cutting nhiều industries.

---

## 3. Phân tích: Scheduling ở đâu trong Bella?

### 3a. Spa Scheduling (Spa Kernel — đã tồn tại)
```
Booking (time slot) → Therapist assignment → Session lifecycle
```
- Business entity: `spa_bookings`, `spa_sessions`, `spa_beds`
- Conflict detection: double-booking prevention
- Assignment: therapist availability + skill matching

### 3b. Dental Scheduling (Product — đã tồn tại)
```
Chair reservation (pre-encounter) → Patient check-in → Link to encounter
```
- Business entity: in-memory `DentalChairStore`
- Key insight: **Disambiguates "Product Scheduling State" vs "Kernel Clinical Encounter State"**
- Đây là pattern quan trọng — scheduling state ≠ clinical encounter state

### 3c. Healthcare Appointment Scheduling (chưa tồn tại ở Kernel)
```
Appointment booking → Provider availability → Room/Resource → Clinical Encounter trigger
```
- Domain event: `Scheduling.Appointment.Created.v1` (đã có string reference, chưa có engine)
- Clinical context: appointment scheduling in healthcare có compliance requirements (HIPAA audit trail, appointment types, referral workflows)

---

## 4. Ba hướng quyết định

### Hướng A: Scheduling là Healthcare Kernel Primitive riêng

**Điều kiện:** Healthcare appointment scheduling có **clinical-specific semantics** không có trong generic scheduling.

**Clinical-specific behaviors cần có:**
- Appointment types (Consultation, Follow-up, Emergency, Procedure-prep) với clinical constraints
- Provider credentialing check (bác sĩ có credential cho loại appointment không)
- Clinical referral tracking (ai refer patient, từ đâu)
- HIPAA audit trail cho mọi appointment change
- Integration với Clinical Decision Support (H8 CDS) — một số appointment types cần CDS clearance
- Integration với Encounter engine (H1) — appointment → encounter trigger

**Contract mẫu:**
```typescript
interface SchedulingEngineContract {
  scheduleAppointment(input: AppointmentInput): Promise<Appointment>;
  cancelAppointment(id: string, reason: ClinicalCancellationReason): Promise<void>;
  checkProviderAvailability(providerId: string, timeRange: TimeRange): Promise<Slot[]>;
  getAppointmentsByEncounter(encounterId: string): Promise<Appointment[]>;
  rescheduleAppointment(id: string, newSlot: Slot): Promise<Appointment>;
}
```

**Risk:** Overlap với Spa Kernel booking logic → cần xác định rõ Healthcare Scheduling là superset hay parallel implementation.

---

### Hướng B: Healthcare Scheduling được build trên Platform Scheduling Core

**Lập luận:** Booking/scheduling là concept đủ generic để tách thành Platform layer.

```
Platform Core
    └── SchedulingCore (generic: slot, resource, conflict detection)
            ↓
    Healthcare Scheduling Extension
            (adds: clinical appointment types, referral, HIPAA audit, encounter trigger)
            ↓
    Spa Scheduling Extension
            (adds: therapist assignment, session lifecycle, commission)
```

**Ưu điểm:**
- Spa Kernel scheduling đã chứng minh value → extract common parts lên Platform
- Tránh duplicate conflict detection logic
- Phù hợp AGENTS.md: "Can existing Kernel be extended?"

**Nhược điểm:**
- Platform Core refactoring có risk cao — Spa Kernel đang frozen
- Cần ACR để touch Platform Core
- Timeline dài hơn nhiều

---

### Hướng C: Healthcare Scheduling ở Product layer (không có Kernel engine)

**Lập luận:** Appointment scheduling workflow giữa Medical, Hospital, Dental quá khác nhau để justify một contract.

```
Medical Clinic: Patient appointment → Consultation slot → Single provider
Hospital:       Patient appointment → Department → Bed → Multi-provider team → OR prep
Dental:         Chair reservation → Procedure-specific duration → Equipment check
```

**Nếu chọn C:**
- Xóa `scheduling-engine/` placeholder
- Xóa `KNOWN_EXEMPTIONS['scheduling-engine']`
- Mỗi product tự quản lý scheduling state (như Dental hiện đang làm)
- Domain event `Scheduling.Appointment.Created.v1` vẫn dùng nhưng từ Product layer

---

## 5. Evidence so sánh với Industries khác

| Industry | Scheduling pattern | Complexity |
|---|---|---|
| Spa | Session/Therapist | Medium — Spa Kernel đã handle |
| Medical Clinic | Appointment/Provider | Low-Medium |
| Hospital | Multi-resource/Department | High |
| Dental | Chair/Procedure | Low — Product layer đủ |
| Auto (Bella Auto) | Service bay/Mechanic | Medium — Product layer |
| Education (future) | Class schedule/Lecturer | Medium |

> **Nhận xét:** Nếu 3+ industries cần scheduling → đủ evidence cho Platform Core. Hiện tại chỉ có evidence từ Spa và Dental.

---

## 6. Quyết định

> **[x] Hướng C — Scheduling stays Product layer, remove placeholder**

**Signed by:** Human Architect & Platform Team  
**Date:** 2026-08-27

---

## 8. Hành động tiếp theo

```
SchedulingEngineContract → Domain → Repository → Service
→ Register in service-locator.ts
→ Integration tests (appointment lifecycle, conflict, clinical cancel)
→ Regression
```

**Nếu chọn B:**
```
ACR (Architecture Change Request) để touch Platform Core
→ Extract SchedulingCore từ Spa Kernel patterns
→ Healthcare SchedulingExtension
→ Spa migrates to use SchedulingCore
→ Significant timeline investment
```

**Nếu chọn C (Recommended starting point):**
```
Remove scheduling-engine/ placeholder
Remove KNOWN_EXEMPTIONS['scheduling-engine']
Each product owns scheduling state (Dental pattern = template)
Document: "Healthcare Scheduling = Product capability, not Kernel engine"
H12 tái phân loại → không phải Healthcare Kernel số thứ tự
Healthcare Kernel claim = "11 active engines" (remove H12 label)
```
