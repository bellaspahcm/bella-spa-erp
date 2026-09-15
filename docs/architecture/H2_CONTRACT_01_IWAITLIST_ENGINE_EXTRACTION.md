# H2 Contract #1 Extraction: IWaitlistEngine

**Contract:** IWaitlistEngine  
**Kernel:** H2 Temporal (Healthcare Platform)  
**Extraction Date:** 2026-09-15  
**Status:** ✅ **COMPLETE**

---

## Extraction Summary

**Source Implementation:** `src/services/waitlist/waitlist-service.ts` (Bella Spa)  
**Target Contract:** `src/platform/healthcare/contracts/waitlist-engine.contract.ts`  
**Commit:** `7fb2b9b3`

**Capabilities Extracted:** 10 methods  
**Types Defined:** 17 types/interfaces  
**Lines of Code:** 714 lines  
**Invariants Documented:** 5 invariants

---

## Contract Scope

### Capability Definition

**IWaitlistEngine** provides walk-in queue management for time-sensitive service allocation:

1. **Queue Management:**
   - Add customer to waitlist with priority/position
   - Query waitlist entries (filters, pagination, sorting)
   - Update entry (status, dates, notes, priority)
   - Remove from waitlist (cancel with reason)

2. **Slot Availability Processing:**
   - Auto-notify top N customers when slot becomes available
   - Process reserved slots
   - Handle slot confirmations

3. **Queue Maintenance:**
   - Recalculate positions (enforce continuity)
   - Expire old entries (auto-cleanup)
   - Handle status transitions

4. **Reporting:**
   - Get waitlist statistics (by date, by package)
   - Track conversion rates
   - Monitor average wait times

5. **Booking Conversion:**
   - Convert waitlist entry to confirmed booking
   - Track conversion metadata

---

## Contract Methods

### 1. addToWaitlist

```typescript
addToWaitlist(input: AddToWaitlistInput): Promise<AddToWaitlistOutput>
```

**Purpose:** Create new waitlist entry with calculated priority and position

**Invariants Enforced:**
- No duplicate active entries (same customer, service, date)
- Position uniqueness (recalculates all positions)
- Priority score calculation (consumer-provided rules)

**Flow:**
1. Validate input
2. Check for duplicate active entry
3. Fetch customer & package details
4. Calculate priority score (via consumer business rules)
5. Calculate position in queue
6. Insert into database
7. Audit log
8. Auto-notify if position ≤ 3

---

### 2. getWaitlistEntries

```typescript
getWaitlistEntries(filters: WaitlistFilters): Promise<WaitlistListResponse>
```

**Purpose:** Query waitlist entries with filters and pagination

**Filters Supported:**
- tenant_id (required)
- customer_id (optional)
- package_id (optional)
- preferred_date (optional)
- status[] (optional, multiple)
- min_priority, max_priority (optional)
- Pagination: page, page_size
- Sorting: sort_by, sort_order

**Response:** Paginated list with total_count, page metadata

---

### 3. getWaitlistEntry

```typescript
getWaitlistEntry(entryId: string, tenantId: string): Promise<WaitlistEntry | null>
```

**Purpose:** Retrieve single entry by ID

**Authorization:** Requires tenantId for multi-tenant isolation

---

### 4. updateWaitlistEntry

```typescript
updateWaitlistEntry(input: UpdateWaitlistEntryInput): Promise<AddToWaitlistOutput>
```

**Purpose:** Update entry fields (status, dates, notes, priority)

**Invariants Enforced:**
- Position recalculation on priority change
- Status transition validation
- Timestamp updates (updated_at)

**Allowed Updates:**
- status
- cancellation_reason (required if status = cancelled)
- priority_override (admin only)
- preferred_date, preferred_start_time, preferred_end_time
- notes
- preferred_channels

---

### 5. removeFromWaitlist

```typescript
removeFromWaitlist(
  entryId: string, 
  tenantId: string, 
  reason: string
): Promise<{ success: boolean; error?: string }>
```

**Purpose:** Cancel waitlist entry (soft delete, status = cancelled)

**Invariants Enforced:**
- Position recalculation (fill gap)
- Status validation (cannot cancel converted entries)

---

### 6. processSlotAvailable

```typescript
processSlotAvailable(slot: AvailableSlot): Promise<ProcessSlotResult>
```

**Purpose:** Auto-notify top N customers when slot becomes available

**Business Logic:**
1. Query top N active entries (by position)
2. Update status to 'notified'
3. Trigger notifications (consumer responsibility)
4. Return list of notified entry IDs

**Default:** Notify top 3 customers

---

### 7. expireOldEntries

```typescript
expireOldEntries(tenantId: string): Promise<{ expired_count: number }>
```

**Purpose:** Mark entries as expired based on expiration rules

**Expiration Rules:**
- Status 'notified' for > 24 hours without conversion
- Preferred date in the past
- Custom expires_at timestamp

**Invariants Enforced:**
- Position recalculation (remove expired from queue)

---

### 8. recalculatePositions

```typescript
recalculatePositions(
  tenantId: string, 
  date?: string
): Promise<{ success: boolean; recalculated_count: number }>
```

**Purpose:** Rebuild position sequence for all active entries

**Used When:**
- Entry added/removed
- Priority changed
- Status changed (active ↔ other)

**Algorithm:**
1. Query all active entries
2. Sort by priority_score DESC, created_at ASC
3. Assign positions 1, 2, 3, ...
4. Update database

---

### 9. getWaitlistStats

```typescript
getWaitlistStats(tenantId: string, date?: string): Promise<WaitlistStats>
```

**Purpose:** Aggregate statistics for monitoring and reporting

**Metrics:**
- Counts by status (active, notified, reserved, converted, cancelled, expired)
- Average wait time (minutes, for converted entries)
- Conversion rate (converted / total entries)
- Breakdown by package

---

### 10. convertToBooking

```typescript
convertToBooking(input: ConvertToBookingInput): Promise<ConvertToBookingOutput>
```

**Purpose:** Create confirmed booking from waitlist entry

**Flow:**
1. Validate entry (status must be 'notified' or 'reserved')
2. Create booking (consumer responsibility via booking engine)
3. Update entry status to 'converted'
4. Store converted_booking_id
5. Recalculate positions (remove from queue)

---

## Types & Interfaces

### Core Types

1. **WaitlistStatus:** `active | notified | reserved | converted | cancelled | expired`
2. **CustomerTier:** `platinum | gold | silver | bronze`
3. **NotificationChannel:** `zalo | sms | email | push`

### Domain Entities

4. **WaitlistEntry:** Complete entry with all fields (id, tenant_id, customer_id, package_id, dates, priority, position, status, timestamps)

### Input/Output Types

5. **AddToWaitlistInput:** Required fields for creating entry
6. **AddToWaitlistOutput:** Result with entry or error
7. **WaitlistFilters:** Query filters for listing
8. **WaitlistListResponse:** Paginated list response
9. **AvailableSlot:** Slot availability details
10. **ProcessSlotResult:** Slot processing result
11. **UpdateWaitlistEntryInput:** Update fields
12. **ConvertToBookingInput:** Booking confirmation details
13. **ConvertToBookingOutput:** Conversion result

### Statistics

14. **WaitlistStats:** Aggregated statistics

---

## Invariants

### 1. Position Uniqueness

**Rule:** No two active entries can have the same position

**Enforcement:**
- Recalculate positions on every add/remove/status change
- Algorithm ensures 1, 2, 3, ... sequence (no duplicates)

---

### 2. Position Continuity

**Rule:** Positions must be sequential (no gaps)

**Enforcement:**
- Recalculation assigns 1, 2, 3, ... in order
- Cancelled/expired entries removed from sequence

---

### 3. Single Active Entry

**Rule:** Customer can only have one active entry per service per date

**Enforcement:**
- Check for duplicate on addToWaitlist
- Reject if active entry already exists

---

### 4. Status Progression

**Rule:** Status transitions follow lifecycle: `active → notified → reserved/converted/cancelled/expired`

**Valid Transitions:**
- active → notified (slot available)
- notified → reserved (customer holds slot)
- reserved → converted (booking confirmed)
- reserved → cancelled (customer declines)
- notified → expired (timeout)
- active → cancelled (customer cancels)
- active → expired (date passed)

**Invalid Transitions:**
- converted → any (final state)
- expired → any (final state, except admin override)

---

### 5. Timestamp Immutability

**Rule:** `created_at` never changes after insert

**Enforcement:**
- Database column default: `now()`
- Update operations do not modify `created_at`
- Only `updated_at`, `notified_at`, `reserved_at`, `converted_at`, `cancelled_at` can be updated

---

## Business Rules (Consumer-Specific)

### Healthcare (Medical Services)

**Priority:** Triage by clinical urgency

**Rules:**
- Emergency cases: priority_score = 100
- Urgent cases: priority_score = 75
- Routine cases: priority_score = 50
- Priority overrides position (high priority jumps queue)

---

### Spa (Beauty Services — Existing Implementation)

**Priority:** FIFO queue with customer tier bonus

**Rules:**
- Base priority = 50
- Platinum tier: +20
- Gold tier: +15
- Silver tier: +10
- Bronze tier: +5
- Position by priority DESC, then created_at ASC

---

### Haircut (Beauty Services — H2 Consumer)

**Priority:** FIFO queue with stylist preference

**Rules:**
- Base priority = 50
- Preferred stylist available: +10
- Customer tier bonus (same as Spa)
- Position by priority DESC, then created_at ASC

---

### Nail (Beauty Services — Future)

**Priority:** FIFO queue with technician preference

**Rules:**
- Base priority = 50
- Preferred technician available: +10
- Customer tier bonus (same as Spa)
- Position by priority DESC, then created_at ASC

---

## Data Ownership

### Kernel Owns

**Schema:** `waitlist_entries` table structure

**Fields:**
- id, tenant_id, customer_id, package_id
- preferred_date, preferred_start_time, preferred_end_time
- position, status
- created_at, updated_at, notified_at, reserved_at, converted_at, cancelled_at, expires_at
- converted_booking_id

**Invariants:**
- Position uniqueness
- Position continuity
- Status lifecycle

---

### Consumer Owns

**Business Rules:**
- Priority score calculation
- Status transition rules (product-specific)
- Notification timing and channels
- Booking creation logic
- Expiration policies

**Integrations:**
- Notification service
- Booking engine
- Customer profile service
- Package/service catalog

---

## Contract Metadata

```typescript
WAITLIST_ENGINE_CONTRACT_METADATA = {
  name: 'IWaitlistEngine',
  version: '1.0.0',
  kernel: 'H2 Temporal',
  kernel_responsibility: [
    'Position calculation and uniqueness',
    'Status lifecycle enforcement',
    'Queue invariant validation',
    'Slot availability processing',
    'Expiration management',
  ],
  consumer_responsibility: [
    'Priority score calculation (business rules)',
    'Notification delivery',
    'Booking creation',
    'Business rule enforcement (FIFO, triage, etc.)',
  ],
  consumers: [
    'Bella Spa (existing)',
    'Bella Haircut (H2 extraction)',
    'Bella Nail (future)',
    'Bella Medical (future)',
  ],
  data_ownership: {
    kernel: ['waitlist_entries table structure', 'position', 'status', 'timestamps'],
    consumer: ['priority calculation logic', 'notification rules', 'booking rules'],
  },
  extraction: {
    source: 'src/services/waitlist/waitlist-service.ts',
    extracted_date: '2026-09-15',
    extracted_by: 'H2 Contract Extraction Phase',
    product: 'Bella Haircut',
    baseline: 'd02b4fbb3a954ab8e5fafecfbb2ff93340065acd',
  },
}
```

---

## Extraction Evidence

### Source Analysis

**Bella Spa Implementation:**
- File: `src/services/waitlist/waitlist-service.ts`
- Functions: 11 exported functions
- Lines: ~1,200 lines (implementation + business logic)

**Extracted to Contract:**
- Interface: `IWaitlistEngine`
- Methods: 10 (addToWaitlist, getWaitlistEntries, getWaitlistEntry, updateWaitlistEntry, removeFromWaitlist, processSlotAvailable, expireOldEntries, recalculatePositions, getWaitlistStats, convertToBooking)
- Types: 17 interfaces/types
- Lines: 714 lines (contract + types + documentation)

---

### Mapping: Spa Function → Contract Method

| Spa Function | Contract Method | Notes |
|--------------|----------------|-------|
| `addToWaitlist` | `addToWaitlist` | Direct mapping |
| `getWaitlistEntries` | `getWaitlistEntries` | Direct mapping |
| `getWaitlistEntry` | `getWaitlistEntry` | Direct mapping |
| `updateWaitlistEntry` | `updateWaitlistEntry` | Direct mapping |
| `removeFromWaitlist` | `removeFromWaitlist` | Direct mapping |
| `processSlotAvailable` | `processSlotAvailable` | Direct mapping |
| `expireOldEntries` | `expireOldEntries` | Direct mapping |
| `recalculatePositions` | `recalculatePositions` | Direct mapping |
| `getWaitlistStats` | `getWaitlistStats` | Direct mapping |
| `convertToBooking` | `convertToBooking` | Direct mapping |
| `parseTime` (internal helper) | Not extracted | Internal implementation detail |

**Coverage:** 10/11 functions extracted (parseTime excluded as internal helper)

---

### Architecture Guard Compliance

**Pre-commit Hook:** ✅ PASSED

**Checks:**
- No frozen kernel files modified: ✅
- Healthcare contracts allowed: ✅
- No H1-H12 engine modifications: ✅

**Commit:** `7fb2b9b3`

---

## Next Steps (H2 Day 2)

### Contract #2: IServiceInventoryEngine

**Source:** `src/services/waitlist/waitlist-service.ts` (service catalog references)  
**Alternative Source:** E7 Logistics Kernel (InventoryItem investigation per ADR-005)

**Scope:**
- Service catalog management
- Service definition (name, duration, price, category)
- Service availability rules
- Multi-location service inventory

**Investigation Required (ADR-005):**
1. Ownership boundary: E7 = Logistics domain, Service = Clinical/Beauty domain
2. Semantic fit: InventoryItem vs Service definition alignment
3. Invariant compatibility: Physical inventory vs intangible service rules
4. E7 FROZEN status: Cannot modify E7.1-E7.3 sealed kernel
5. Dependency direction: Product → Contract → Kernel
6. Data ownership: E7 owns `inventory_item`, Service needs separate ownership
7. Extension cost: Adapt E7 vs build dedicated service contract

---

## Extraction Metrics

### Contract #1 Summary

```
Contract: IWaitlistEngine
Status: ✅ COMPLETE

Extraction:
- Methods: 10/11 (90.9% coverage)
- Types: 17 interfaces/types
- Invariants: 5 documented
- Lines: 714 (contract + docs)

Kernel Compliance:
- No frozen files modified: ✅
- Architecture Guard: ✅ PASSED
- Kernel freeze compliance: ✅

Consumers Ready:
- Bella Spa: ✅ (existing implementation)
- Bella Haircut: ⏳ (next: integrate contract)
- Bella Nail: ⏳ (future)
- Bella Medical: ⏳ (future)
```

---

**Contract #1 Extraction:** ✅ **COMPLETE**  
**H2 Progress:** 1/8 contracts extracted (12.5%)  
**Next:** Extract Contract #2 (IServiceInventoryEngine) — Day 2

---

**Extraction Version:** 1.0.0  
**Date:** 2026-09-15  
**Commit:** `7fb2b9b3`
