# Bella Auto Phase 6 — Technical Summary
## Workshop & Service Center Management System

**Version:** 1.0  
**Completion Date:** 2026-08-03  
**Module:** `bella_auto`  
**Tenant:** `bella_auto_demo`

---

## 🎯 Overview

Phase 6 delivers a complete Workshop & Service Center management system for automotive dealerships, covering:
- Service appointment scheduling
- Repair order/job card management
- VIN-linked immutable service history
- Warranty claims processing
- Parts inventory integration
- Workshop operations dashboard

---

## 📁 File Structure

```
bella-auto/
├── supabase/migrations/
│   └── 20260803260000_bella_auto_phase6_service_center.sql  # Database schema
│
├── src/modules/bella-auto/
│   ├── services/
│   │   ├── ServiceAppointmentService.ts      # Appointment lifecycle
│   │   ├── RepairOrderService.ts             # Job card & technician management
│   │   ├── ServiceHistoryService.ts          # Immutable VIN history
│   │   ├── WarrantyService.ts                # Warranty claims workflow
│   │   └── PartsInventoryIntegration.ts      # Inventory auto-deduction
│   │
│   └── components/workshop/
│       ├── ServiceCalendar.tsx               # Appointment calendar view
│       ├── RepairOrderBoard.tsx              # Kanban workflow board
│       └── TechnicianDashboard.tsx           # Technician workload & metrics
│
├── src/app/dashboard/bella-auto/
│   └── workshop/
│       └── page.tsx                          # Main workshop page
│
├── src/__tests__/
│   └── bella-auto-phase6-database.test.ts    # Integration tests
│
└── docs/
    ├── plans/bella-auto-execution-plan.md    # Updated checklist
    └── completion-reports/
        └── bella-auto-phase6-completion.md   # Detailed completion report
```

---

## 🗄️ Database Schema

### Tables Created (7)

#### 1. `auto_service_packages`
Service package definitions (oil change, major service, etc.)
```sql
- id (uuid, pk)
- tenant_id (uuid, indexed)
- package_code (text)
- package_name (text)
- description (text)
- estimated_duration (numeric)
- base_price (numeric)
- service_items (jsonb) -- Labor & parts included
```

#### 2. `auto_service_appointments`
Service appointment scheduling
```sql
- id (uuid, pk)
- tenant_id (uuid, indexed)
- appointment_number (text, unique) -- APT{YYYYMMDD}-{seq}
- customer_id (uuid, fk → customers)
- vehicle_id (uuid, fk → auto_vehicles)
- scheduled_date (date)
- scheduled_time (time)
- service_type (text)
- status (text) -- pending, confirmed, checked_in, in_progress, completed, delivered, cancelled, no_show, rescheduled
- confirmed_at, actual_arrival_time, service_started_at, service_completed_at, delivered_at
- service_advisor_id (uuid)
- reminder_sent (boolean)
```

#### 3. `auto_repair_orders`
Repair order/job card master records
```sql
- id (uuid, pk)
- tenant_id (uuid, indexed)
- order_number (text, unique) -- RO{YYYYMMDD}-{seq}
- customer_id (uuid, fk → customers)
- vehicle_id (uuid, fk → auto_vehicles)
- appointment_id (uuid, fk → auto_service_appointments)
- order_type (text)
- work_description (text)
- customer_complaints (jsonb)
- mileage_in (integer)
- fuel_level (text)
- vehicle_condition_notes (text)
- status (text) -- open, diagnosed, approved, in_progress, quality_check, completed, invoiced, delivered
- primary_technician_id (uuid)
- additional_technicians (uuid[])
- bay_number (text)
- estimated_hours, actual_hours (numeric)
- estimated_labor_cost, actual_labor_cost (numeric)
- estimated_parts_cost, actual_parts_cost (numeric)
- estimated_total, actual_total (numeric)
- is_warranty_work (boolean)
- warranty_claim_id (uuid)
- quality_check_passed (boolean)
- quality_checked_by (uuid)
```

#### 4. `auto_repair_order_items`
Line items (service, parts, labor)
```sql
- id (uuid, pk)
- tenant_id (uuid)
- repair_order_id (uuid, fk → auto_repair_orders)
- item_type (text) -- service, part, labor
- item_code (text)
- item_name (text)
- quantity (numeric)
- unit_price (numeric)
- discount_percentage (numeric)
- total_amount (numeric) -- Auto-calculated trigger
- labor_hours (numeric)
- hourly_rate (numeric)
- part_number (text)
- inventory_item_id (uuid, fk → inventory)
- is_warranty_covered (boolean)
- status (text) -- pending, in_progress, completed, cancelled
```

#### 5. `auto_service_history` ⭐ IMMUTABLE
VIN-linked service history (cannot be modified after creation)
```sql
- id (uuid, pk)
- tenant_id (uuid)
- vin (text, indexed) -- Primary search key
- vehicle_id (uuid)
- license_plate (text)
- vehicle_make, vehicle_model, vehicle_year
- customer_id (uuid)
- customer_name (text)
- repair_order_id (uuid)
- repair_order_number (text)
- service_date (date)
- service_type (text)
- mileage (integer)
- work_description (text)
- diagnosis_notes, technician_notes (text)
- service_items (jsonb) -- All work performed
- parts_replaced (jsonb) -- Parts list
- labor_hours, labor_cost, parts_cost, total_cost (numeric)
- warranty_work (boolean)
- quality_check_passed (boolean)
- is_locked (boolean, default true) -- Enforces immutability
```
**RLS Policy:** Blocks UPDATE/DELETE when `is_locked=true`

#### 6. `auto_warranty_claims`
Warranty claim processing
```sql
- id (uuid, pk)
- tenant_id (uuid)
- claim_number (text, unique) -- WC{YYYYMMDD}-{seq}
- customer_id (uuid, fk → customers)
- vehicle_id (uuid, fk → auto_vehicles)
- repair_order_id (uuid, fk → auto_repair_orders)
- claim_type (text)
- failure_description (text)
- failure_date (date)
- mileage_at_failure (integer)
- affected_parts (jsonb)
- status (text) -- submitted, under_review, inspection_scheduled, approved, rejected, repair_in_progress, completed, cancelled
- submitted_at, reviewed_at, approved_at, completed_at
- approved_by, reviewed_by (uuid)
- inspection_findings (text)
- estimated_repair_cost, actual_repair_cost (numeric)
```

#### 7. `auto_technician_time_logs`
Technician time tracking (auto-calculated hours)
```sql
- id (uuid, pk)
- tenant_id (uuid)
- repair_order_id (uuid, fk → auto_repair_orders)
- technician_id (uuid)
- technician_name (text)
- clock_in_time (timestamptz)
- clock_out_time (timestamptz)
- hours_worked (numeric) -- Auto-calculated by trigger
- notes (text)
```
**Trigger:** `trg_auto_technician_time_logs_hours` calculates `hours_worked` from clock in/out

---

### RPC Functions (3)

#### `generate_appointment_number(p_tenant_id UUID) → TEXT`
Generates unique appointment numbers: `APT{YYYYMMDD}-{sequence}`
- Example: `APT20260803-0001`
- Scoped to tenant + date

#### `generate_repair_order_number(p_tenant_id UUID) → TEXT`
Generates unique repair order numbers: `RO{YYYYMMDD}-{sequence}`
- Example: `RO20260803-0001`
- Scoped to tenant + date

#### `generate_warranty_claim_number(p_tenant_id UUID) → TEXT`
Generates unique warranty claim numbers: `WC{YYYYMMDD}-{sequence}`
- Example: `WC20260803-0001`
- Scoped to tenant + date

---

## 🔧 Services

### 1. ServiceAppointmentService
**File:** `src/modules/bella-auto/services/ServiceAppointmentService.ts`

**Key Methods:**
- `createAppointment(data)` - Create new appointment
- `confirmAppointment(id)` - Mark as confirmed
- `checkInAppointment(id)` - Customer arrives
- `startService(id)` - Begin work
- `completeService(id, data)` - Finish work
- `deliverVehicle(id)` - Vehicle handover
- `cancelAppointment(id, reason)` - Cancel with reason
- `rescheduleAppointment(id, newDate, newTime)` - Change schedule
- `markNoShow(id)` - Customer didn't show
- `checkAvailability(date, time)` - Check if time slot available
- `sendReminder(id)` - Send SMS/email reminder
- `getAppointmentStats(tenantId, dateRange)` - Statistics

**Workflow States:**
```
pending → confirmed → checked_in → in_progress → completed → delivered
         ↓
      cancelled / no_show / rescheduled
```

---

### 2. RepairOrderService
**File:** `src/modules/bella-auto/services/RepairOrderService.ts`

**Key Methods:**
- `createRepairOrder(data)` - Create job card
- `addLineItems(orderId, items)` - Add service/part/labor items
- `updateDiagnosis(orderId, data)` - Add diagnosis & estimates
- `approveRepairOrder(orderId, approvedBy)` - Customer approval
- `assignTechnician(orderId, techId, isPrimary, bayNumber)` - Assign tech & bay
- `startWork(orderId, techId)` - Clock in & start
- `completeWork(orderId, data)` - Clock out & finish
- `performQualityCheck(orderId, data)` - QC pass/fail
- `markAsInvoiced(orderId, invoiceId)` - Link to invoice
- `markAsDelivered(orderId)` - Vehicle delivery
- `getTechnicianWorkload(tenantId, techId)` - Workload stats
- `getRepairOrderStats(tenantId, dateRange)` - Statistics

**Workflow States:**
```
open → diagnosed → approved → in_progress → quality_check → completed → invoiced → delivered
                                   ↑                ↓
                                   └─── rework ─────┘
```

**Auto-Calculations:**
- Line item totals: `(quantity * unit_price) * (1 - discount_percentage / 100)`
- Order totals: Sum of all line items (labor + parts)
- Estimated vs. actual tracking

---

### 3. ServiceHistoryService
**File:** `src/modules/bella-auto/services/ServiceHistoryService.ts`

**Key Methods:**
- `createServiceHistoryRecord(tenantId, repairOrderId)` - Auto-create from completed RO
- `getServiceHistoryByVIN(tenantId, vin, options)` - Primary VIN-based lookup
- `getServiceHistoryByVehicle(tenantId, vehicleId)` - Get by vehicle ID
- `getCompleteVehicleHistory(tenantId, vin)` - Full vehicle report with analytics
- `getMaintenanceRecommendations(tenantId, vehicleId, currentMileage)` - AI recommendations
- `exportServiceHistory(tenantId, vin, format)` - CSV/JSON export
- `searchServiceHistory(tenantId, query)` - Advanced search
- `getWarrantyServices(tenantId, vehicleId)` - Warranty-covered services only
- `validateHistoryIntegrity(tenantId, repairOrderId)` - Check for duplicates

**Immutability Enforcement:**
- `is_locked=true` by default
- RLS blocks UPDATE/DELETE on locked records
- VIN as primary search key (never changes)

**Maintenance Recommendations:**
Standard intervals (in km):
- Oil Change: 5,000 km
- Tire Rotation: 10,000 km
- Brake Inspection: 20,000 km
- Air Filter: 15,000 km
- Transmission Service: 50,000 km
- Coolant Flush: 50,000 km

**Urgency Levels:**
- `overdue`: Mileage ≥ interval
- `due_soon`: Mileage ≥ 90% of interval
- `upcoming`: Mileage ≥ 70% of interval

---

### 4. WarrantyService
**File:** `src/modules/bella-auto/services/WarrantyService.ts`

**Key Methods:**
- `createWarrantyClaim(data)` - Submit new claim
- `validateWarrantyCoverage(tenantId, vehicleId, failureDate, mileage)` - Validate warranty
- `reviewClaim(claimId, data)` - Internal review & decision
- `scheduleInspection(claimId, data)` - Assign inspector
- `completeInspection(claimId, data)` - Inspection findings
- `linkToRepairOrder(claimId, repairOrderId)` - Connect claim to job card
- `completeClaim(claimId, data)` - Final cost & closure
- `cancelClaim(claimId, reason)` - Cancel with reason
- `getClaimsByStatus(tenantId, status)` - Get claims by status
- `getWarrantyStats(tenantId, dateRange)` - Statistics (approval rate, costs)

**Workflow States:**
```
submitted → under_review → inspection_scheduled → approved/rejected
                                                      ↓
                                            repair_in_progress → completed
```

**Validation Rules:**
- Warranty start/end date check
- Mileage limit check
- Links to `auto_sales` table for warranty terms

---

### 5. PartsInventoryIntegration
**File:** `src/modules/bella-auto/services/PartsInventoryIntegration.ts`

**Key Methods:**
- `checkPartsAvailability(tenantId, repairOrderId)` - Pre-work stock check
- `deductPartsOnCompletion(tenantId, repairOrderId, completedBy)` - Auto-deduct parts
- `reserveParts(tenantId, repairOrderId)` - Reserve stock (on approval)
- `releaseParts(tenantId, repairOrderId)` - Release reserved stock (on cancel)
- `getPartsUsageReport(tenantId, startDate, endDate)` - Usage analytics
- `getLowStockAlerts(tenantId)` - Reorder point monitoring
- `getPartsCostForRepairOrder(tenantId, repairOrderId)` - Cost breakdown

**Integration Points:**
- Uses existing `inventory` and `inventory_transactions` tables
- Creates transaction with `reference_type='repair_order'`
- Updates `quantity_on_hand` and `quantity_reserved`
- Triggers low-stock alerts at reorder point

**Safety Features:**
- Check for duplicate deductions (prevents double-deduct)
- Allow negative stock with warnings (emergency situations)
- Reserve/release mechanism for approved orders
- Only deduct completed line items

---

## 🎨 UI Components

### 1. ServiceCalendar
**File:** `src/modules/bella-auto/components/workshop/ServiceCalendar.tsx`

**Features:**
- Full-day calendar view
- Time slots: 8 AM - 6 PM (30-min intervals)
- Status-based color coding:
  - `confirmed`: Green
  - `checked_in`: Blue
  - `in_progress`: Purple
  - `completed`: Gray
  - `cancelled`: Red
  - `pending`: Yellow
- Day navigation (prev/next/today)
- Appointment summary footer (by status)
- Click to view appointment details
- Drag-and-drop rescheduling (future enhancement)

---

### 2. RepairOrderBoard
**File:** `src/modules/bella-auto/components/workshop/RepairOrderBoard.tsx`

**Features:**
- Kanban-style workflow board
- 6 workflow columns:
  1. Mới tiếp nhận (Open)
  2. Đã chẩn đoán (Diagnosed)
  3. Đã duyệt (Approved)
  4. Đang sửa chữa (In Progress)
  5. Kiểm tra chất lượng (Quality Check)
  6. Hoàn thành (Completed)
- Priority indicators (Low, Normal, High, Urgent)
- Bay number display
- Technician assignment
- Progress tracking (estimated vs. actual hours)
- Click to view order details
- Drag-and-drop status updates (future enhancement)

---

### 3. TechnicianDashboard
**File:** `src/modules/bella-auto/components/workshop/TechnicianDashboard.tsx`

**Features:**
- Technician cards with metrics:
  - Active orders count
  - Total hours today
  - Completed today
  - Efficiency percentage
  - Quality score (0-100)
- Workload status badges:
  - Rảnh (0 orders) - Green
  - Bình thường (1-2 orders) - Blue
  - Bận (3-4 orders) - Yellow
  - Quá tải (5+ orders) - Red
- Current job list with progress bars
- Summary footer (total workload, available technicians)
- Click to view technician details

---

### 4. Workshop Page
**File:** `src/app/dashboard/bella-auto/workshop/page.tsx`

**Features:**
- Tabbed navigation (Lịch Hẹn, Bảng Sửa Chữa, Kỹ Thuật Viên)
- Server-side rendering with Suspense
- Loading states & error handling
- Mock data for development testing
- Ready for API integration (TODO comments)

---

## 🧪 Testing

### Integration Tests
**File:** `src/__tests__/bella-auto-phase6-database.test.ts`

**Test Suites:**
1. **Schema Validation** (7 tests)
   - Verify all 7 tables exist
   - Check column structure

2. **RPC Functions** (3 tests)
   - Test number generators (APT, RO, WC)
   - Verify format correctness

3. **Service Appointment Lifecycle** (2 tests)
   - Create appointment with unique number
   - Transition through status workflow

4. **Repair Order Management** (2 tests)
   - Create repair order with line items
   - Auto-calculate line item totals

5. **Service History Immutability** (2 tests)
   - Create immutable service history record
   - Verify UPDATE blocked by RLS

6. **Warranty Claims Workflow** (2 tests)
   - Create warranty claim with unique number
   - Transition through status workflow

7. **Technician Time Tracking** (1 test)
   - Create time log
   - Auto-calculate hours

**Test Execution:**
```bash
npm.cmd test -- src/__tests__/bella-auto-phase6-database.test.ts --runInBand
```

**Expected Results:**
- ✅ Schema validation: All tables exist
- ✅ RPC functions: Generate unique numbers
- ⏳ Lifecycle tests: Require `bella_auto_demo` tenant with sample data

---

## 📦 Dependencies

### NPM Packages
- `@supabase/supabase-js` - Database client
- `react` - UI framework
- `lucide-react` - Icons
- `@jest/globals` - Testing framework

### Internal Dependencies
- `src/lib/supabase/server` - Supabase server client
- `src/types/supabase` - Database types
- Existing tables: `customers`, `inventory`, `inventory_transactions`, `auto_vehicles`, `auto_sales`

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# Deploy Phase 6 migration
supabase db push

# Verify tables created
supabase db pull
```

### 2. Build & Type Check
```bash
# Generate TypeScript types
npm.cmd run supabase:gen-types

# Build project
npm.cmd run build
```

### 3. Run Tests
```bash
# Run Phase 6 integration tests
npm.cmd test -- src/__tests__/bella-auto-phase6-database.test.ts --runInBand

# Run all tests
npm.cmd test -- --runInBand
```

### 4. Manual Testing
1. Login to `bella_auto_demo` tenant
2. Navigate to `/dashboard/bella-auto/workshop`
3. Test appointment creation
4. Test repair order workflow
5. Test warranty claim submission
6. Verify parts deduction

---

## 📖 Usage Examples

### Create Service Appointment
```typescript
import { ServiceAppointmentService } from '@/modules/bella-auto/services/ServiceAppointmentService';

const appointment = await ServiceAppointmentService.createAppointment({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-uuid',
  vehicleId: 'vehicle-uuid',
  scheduledDate: new Date('2026-08-10'),
  scheduledTime: '09:00',
  serviceType: 'Bảo dưỡng định kỳ',
  estimatedDuration: 2.0,
  serviceAdvisorId: 'advisor-uuid',
  notes: 'Khách hàng yêu cầu kiểm tra phanh',
});
```

### Create Repair Order with Line Items
```typescript
import { RepairOrderService } from '@/modules/bella-auto/services/RepairOrderService';

// Create repair order
const repairOrder = await RepairOrderService.createRepairOrder({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-uuid',
  vehicleId: 'vehicle-uuid',
  appointmentId: 'appointment-uuid',
  orderType: 'Bảo dưỡng',
  workDescription: 'Thay dầu động cơ và lọc dầu',
  mileageIn: 50000,
  fuelLevel: '75%',
  serviceAdvisorId: 'advisor-uuid',
});

// Add line items
await RepairOrderService.addLineItems(repairOrder.id, 'bella_auto_demo', [
  {
    itemType: 'part',
    itemName: 'Dầu động cơ 5W-30',
    partNumber: 'OIL-5W30-4L',
    quantity: 4,
    unitPrice: 150000,
    inventoryItemId: 'inventory-item-uuid',
  },
  {
    itemType: 'labor',
    itemName: 'Công thay dầu',
    quantity: 1,
    unitPrice: 200000,
    laborHours: 0.5,
    hourlyRate: 400000,
  },
]);
```

### Get Service History by VIN
```typescript
import { ServiceHistoryService } from '@/modules/bella-auto/services/ServiceHistoryService';

const history = await ServiceHistoryService.getServiceHistoryByVIN(
  'bella_auto_demo',
  'TEST-VIN-123456',
  {
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-12-31'),
    limit: 10,
  }
);

console.log(`Found ${history.length} service records for VIN`);
```

### Validate Warranty Coverage
```typescript
import { WarrantyService } from '@/modules/bella-auto/services/WarrantyService';

const validation = await WarrantyService.validateWarrantyCoverage(
  'bella_auto_demo',
  'vehicle-uuid',
  new Date('2026-08-01'), // Failure date
  40000 // Mileage at failure
);

if (validation.isValid) {
  console.log('Warranty is valid');
} else {
  console.log(`Warranty invalid: ${validation.reason}`);
}
```

### Auto-Deduct Parts on Completion
```typescript
import { PartsInventoryIntegration } from '@/modules/bella-auto/services/PartsInventoryIntegration';

const deductions = await PartsInventoryIntegration.deductPartsOnCompletion(
  'bella_auto_demo',
  'repair-order-uuid',
  'technician-uuid'
);

console.log(`Deducted ${deductions.length} parts from inventory`);
```

---

## ⚠️ Known Limitations & Future Enhancements

### Current Limitations
1. **UI Integration:** Mock data only, API integration pending
2. **Drag-and-Drop:** Planned for calendar & kanban board, not yet implemented
3. **Real-time Updates:** WebSocket integration for live status updates pending
4. **Email/SMS Notifications:** Notification service integration pending
5. **Mobile Responsive:** Desktop-first design, mobile optimization needed

### Future Enhancements
1. **Appointment Reminders:** Auto-send SMS/email reminders 24h before appointment
2. **Technician Clock-In App:** Mobile app for time tracking
3. **QR Code Check-In:** Customer self-check-in via QR code
4. **Parts Catalog Integration:** Link to supplier catalogs for pricing
5. **Service Package Templates:** Pre-defined service packages for common jobs
6. **Customer Portal:** Self-service appointment booking & status tracking
7. **AI-Powered Diagnostics:** Suggest likely issues based on symptoms
8. **Predictive Maintenance:** AI recommendations based on vehicle history

---

## 🔒 Security & Compliance

### Row-Level Security (RLS)
- All tables enforce tenant isolation via `tenant_id`
- Service history blocks UPDATE/DELETE when `is_locked=true`
- Warranty claims restrict based on customer ownership

### Immutability Guarantees
- Service history records cannot be modified after creation
- Technician time logs auto-calculated (prevents manipulation)
- Audit trail preserved via timestamps & actor IDs

### Data Privacy
- Customer PII stored in core `customers` table (existing RLS)
- VIN treated as sensitive data (indexed, not exposed in URLs)
- Parts usage tracked for cost analysis, not personal profiling

---

## 📞 Support & Documentation

### Additional Resources
- **Execution Plan:** `docs/plans/bella-auto-execution-plan.md`
- **Completion Report:** `docs/completion-reports/bella-auto-phase6-completion.md`
- **Database Schema:** `supabase/migrations/20260803260000_bella_auto_phase6_service_center.sql`
- **Integration Tests:** `src/__tests__/bella-auto-phase6-database.test.ts`

### Contact
- **Development Team:** Bella Auto Module Team
- **Project Manager:** [PM Name]
- **Technical Lead:** [Tech Lead Name]

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-03  
**Status:** ✅ Development Complete — Ready for Deployment
