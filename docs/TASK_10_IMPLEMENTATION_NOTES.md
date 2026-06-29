# Task 10: Update Booking Form - Service Items Input

**Status:** Ready to implement  
**Priority:** High  
**Estimate:** 3 hours  
**Assigned to:** [Developer Name]

---

## 📋 Implementation Notes

### Discovery

**Current Booking Flow:**
- Booking creation happens via `BookingsPosPanel.tsx` (POS-style interface)
- Session scheduling via `BookingCreateScheduleModal.tsx`
- Booking uses package-based model (select package, then schedule sessions)

**Key Finding:**
Current system creates booking at package level (one package = one booking).  
For service commission tracking, we need to track **individual services within each session**.

---

## 🎯 Implementation Approach

### Option A: Add Service Items to Session Creation

**Where:** `BookingCreateScheduleModal.tsx`

**Changes:**
1. Add "Service Details" section after resource selector
2. User can add multiple service items per session
3. Each service item has:
   - Service name (dropdown from packages)
   - Quantity (default 1)
   - Unit price (from package, editable)
   - Commission override (optional)

**Pros:**
- Matches current workflow (create session → add services)
- Less disruptive to existing code

**Cons:**
- Services tied to sessions, not bookings
- Need to modify session creation logic

### Option B: Add Service Items to Booking Detail Page

**Where:** Create new page `/dashboard/bookings/[id]/services`

**Changes:**
1. After booking created, admin goes to booking detail
2. "Services" tab shows list of all services across sessions
3. Can add/edit/delete service items
4. Commission calculated when services added

**Pros:**
- Clean separation of concerns
- Easier to implement (new page, less risk)
- Can manage services independently

**Cons:**
- Extra step after booking creation
- Not as seamless

### Option C: Hybrid Approach (Recommended for MVP)

**Phase 1:** Implement Option B (service management page)
**Phase 2:** Later add Option A (inline in session creation)

**Reasoning:**
- Fastest to market
- Least risk of breaking existing booking flow
- Can iterate based on user feedback

---

## 🛠️ Recommended Implementation Steps

### Step 1: Create Service Items Management Page

**File:** `src/app/dashboard/bookings/[id]/services/page.tsx`

```typescript
// Pseudo-code structure
export default function BookingServicesPage({ params }) {
  const { id: bookingId } = params;
  
  // State
  const [services, setServices] = useState([]);
  const [isAddingService, setIsAddingService] = useState(false);
  
  // Load services for this booking
  useEffect(() => {
    loadBookingServices(bookingId);
  }, [bookingId]);
  
  return (
    <div>
      <h1>Booking Services</h1>
      <ServiceItemsList services={services} />
      <AddServiceButton onClick={() => setIsAddingService(true)} />
      {isAddingService && <AddServiceModal onClose={...} onSave={...} />}
    </div>
  );
}
```

### Step 2: Create ServiceItemRow Component

**File:** `src/components/bookings/ServiceItemRow.tsx`

```typescript
interface ServiceItemRowProps {
  item: ServiceItem;
  packages: Package[];
  onChange: (field: string, value: any) => void;
  onRemove: () => void;
}

export function ServiceItemRow({ item, packages, onChange, onRemove }: ServiceItemRowProps) {
  return (
    <div className="grid grid-cols-6 gap-4">
      {/* Service dropdown */}
      {/* Quantity input */}
      {/* Unit price */}
      {/* Subtotal (readonly) */}
      {/* Commission override toggle */}
      {/* Remove button */}
    </div>
  );
}
```

### Step 3: Create Server Actions

**File:** `src/modules/bookings/actions/service-items-actions.ts`

```typescript
export async function createServiceItem(data: ServiceItemInput) {
  // 1. Validate input
  // 2. Calculate commission
  // 3. Insert into booking_service_items
  // 4. Trigger salary recalculation if needed
  // 5. Return result
}

export async function updateServiceItem(id: string, data: Partial<ServiceItemInput>) {
  // Similar logic
}

export async function deleteServiceItem(id: string) {
  // Soft delete or hard delete
}
```

### Step 4: Integration with Existing Booking Detail

**File:** `src/app/dashboard/bookings/[id]/page.tsx` (or wherever booking detail is)

Add tab navigation:
```typescript
<Tabs>
  <Tab>Overview</Tab>
  <Tab>Sessions</Tab>
  <Tab>Services</Tab> {/* NEW */}
  <Tab>History</Tab>
</Tabs>
```

---

## 🧪 Testing Checklist

- [ ] Can add service item to booking
- [ ] Commission calculated correctly (fixed & percentage)
- [ ] Can edit service item
- [ ] Can delete service item
- [ ] Service items display correctly in list
- [ ] Mobile responsive
- [ ] Salary recalculates when service added
- [ ] RLS policies working (tenant isolation)

---

## 🚨 Important Considerations

### 1. Booking vs Session

Current system structure:
```
Booking (contract)
  └─> Sessions (individual appointments)
      └─> Session Logs (completed records)
```

Service items could attach to:
- **Booking** (all services in contract)
- **Session** (services per appointment)  
- **Session Log** (services actually completed)

**Recommendation:** Attach to **Session Log** (completed_date from session_logs)

**Why:** Commission should only count for completed services, not planned.

### 2. Data Migration

Current bookings don't have service items. Two approaches:

**A. Backfill (Optional):**
- Create script to generate service items from existing bookings
- Use package_id to infer service name
- Set default commission

**B. Forward-Only (Recommended for MVP):**
- Only new bookings/sessions have service items
- Old bookings use legacy commission (session_bonus)
- Gradual transition

### 3. Commission Calculation Timing

**When to calculate commission:**
- Option A: When service item created (pre-calculated, stored)
- Option B: When salary recalculated (dynamic, on-demand)

**Recommendation:** Option A (pre-calculated)

**Why:** 
- Faster salary calculation
- Historical accuracy (commission rates may change)
- Easier to audit

---

## 📚 Reference Code

### Commission Calculation (from MVP)

```typescript
import { calculateServiceCommission } from '@/lib/business-rules/commission';

// Calculate commission for service item
const commission = calculateServiceCommission({
  subtotal: item.quantity * item.unitPrice,
  overrideType: item.overrideType || undefined,
  overrideValue: item.overrideValue || undefined,
  defaultType: tenantConfig.service_commission_default?.type,
  defaultValue: tenantConfig.service_commission_default?.value,
});

// Save to database
await supabase.from('booking_service_items').insert({
  booking_id: bookingId,
  ktv_id: ktvId,
  tenant_id: tenantId,
  service_name: item.serviceName,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  subtotal: item.quantity * item.unitPrice,
  override_commission_type: item.overrideType,
  override_commission_value: item.overrideValue,
  calculated_commission: commission,
  status: 'completed',
  completed_date: sessionDate,
});
```

---

## 🎨 UI Mockup (Text-based)

```
┌─────────────────────────────────────────────────┐
│  Booking Detail - Services                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  [+ Add Service]                   [Export CSV] │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Service Items (3)                       │   │
│  ├─────────────────────────────────────────┤   │
│  │ Service Name  │ Qty │ Price │ Commission│   │
│  ├─────────────────────────────────────────┤   │
│  │ Massage       │  1  │ 500k  │ 150k (F)  │🗑️│
│  │ Facial        │  1  │ 300k  │  30k (10%)│🗑️│
│  │ Nail Art      │  1  │ 200k  │  40k (20%)│🗑️│
│  └─────────────────────────────────────────┘   │
│                                                  │
│  Total Subtotal: 1,000,000đ                     │
│  Total Commission: 220,000đ                     │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ⏭️ Next Steps

1. **Review this document** with team
2. **Decide on approach** (A/B/C)
3. **Create branch:** `feature/commission-task-10-service-items`
4. **Implement step by step**
5. **Test thoroughly**
6. **Create PR**

---

**Document Version:** 1.0  
**Created:** 2026-06-22  
**Status:** Ready for development  

**Questions?** Ping team lead or check implementation template!
