# Booking Engine - TypeScript Types Update Guide

**Date**: 2026-07-09  
**Purpose**: Generate và integrate types cho 4 tables mới

---

## 🎯 SAU KHI DEPLOY MIGRATION

### Step 1: Generate Supabase Types

```bash
# Generate types from database schema
npx supabase gen types typescript --project-ref YOUR_PROJECT_REF > src/types/supabase-generated.ts

# Hoặc nếu dùng local dev
npx supabase gen types typescript --local > src/types/supabase-generated.ts
```

---

## 📝 EXPECTED NEW TYPES

### 1. Waitlist Table

```typescript
// Generated type
export type Waitlist = Database['public']['Tables']['waitlist']['Row'];
export type WaitlistInsert = Database['public']['Tables']['waitlist']['Insert'];
export type WaitlistUpdate = Database['public']['Tables']['waitlist']['Update'];

// Example Row type
interface WaitlistRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  package_id: string;
  preferred_date: string;
  preferred_time_slot: 'morning' | 'afternoon' | 'evening' | null;
  preferred_ktv_id: string | null;
  notes: string | null;
  priority_score: number;
  status: 'active' | 'notified' | 'converted' | 'expired' | 'cancelled';
  expires_at: string;
  notified_at: string | null;
  converted_booking_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}
```

---

### 2. Pricing Rules Table

```typescript
export type PricingRule = Database['public']['Tables']['pricing_rules']['Row'];
export type PricingRuleInsert = Database['public']['Tables']['pricing_rules']['Insert'];

interface PricingRuleRow {
  id: string;
  tenant_id: string;
  rule_name: string;
  rule_type: 'peak_hour' | 'weekend' | 'demand' | 'advance' | 'seasonal' | 'customer_tier' | 'bundle';
  description: string | null;
  condition: Record<string, any>; // JSONB
  multiplier: number;
  priority: number;
  enabled: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}
```

---

### 3. Capacity Snapshots Table

```typescript
export type CapacitySnapshot = Database['public']['Tables']['capacity_snapshots']['Row'];

interface CapacitySnapshotRow {
  id: string;
  tenant_id: string;
  snapshot_date: string;
  snapshot_hour: number;
  time_slot: 'morning' | 'afternoon' | 'evening' | null;
  total_capacity: number;
  booked_capacity: number;
  available_capacity: number;
  buffer_reserved: number;
  utilization_rate: number | null;
  branch_id: string | null;
  created_at: string;
}
```

---

### 4. Booking Events Table

```typescript
export type BookingEvent = Database['public']['Tables']['booking_events']['Row'];
export type BookingEventInsert = Database['public']['Tables']['booking_events']['Insert'];

interface BookingEventRow {
  id: string;
  tenant_id: string;
  booking_id: string;
  event_type: 
    | 'created'
    | 'assigned'
    | 'confirmed'
    | 'rescheduled'
    | 'cancelled'
    | 'completed'
    | 'no_show'
    | 'refund_processed'
    | 'waitlist_added'
    | 'waitlist_converted'
    | 'price_calculated'
    | 'conflict_detected'
    | 'conflict_resolved';
  event_description: string | null;
  event_data: Record<string, any> | null; // JSONB
  created_by: string | null;
  created_by_role: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}
```

---

## 🔄 UPDATE EXISTING TYPES

### Update `src/lib/booking-engine/types/index.ts`

```typescript
// Add imports
import type { Database } from '@/types/supabase';

// Update types to use generated types
export type Waitlist = Database['public']['Tables']['waitlist']['Row'];
export type WaitlistInsert = Database['public']['Tables']['waitlist']['Insert'];
export type PricingRule = Database['public']['Tables']['pricing_rules']['Row'];
export type CapacitySnapshot = Database['public']['Tables']['capacity_snapshots']['Row'];
export type BookingEvent = Database['public']['Tables']['booking_events']['Row'];
```

---

## 🧪 VERIFY TYPES

### Test Queries

```typescript
// Test Waitlist query
const { data: waitlistEntries } = await supabase
  .from('waitlist')
  .select('*')
  .eq('status', 'active')
  .order('priority_score', { ascending: false });

// TypeScript should infer correct type
type WaitlistEntry = typeof waitlistEntries[0];
// Should be: WaitlistRow

// Test Pricing Rules query
const { data: rules } = await supabase
  .from('pricing_rules')
  .select('*')
  .eq('enabled', true)
  .order('priority', { ascending: false });

// Test insert
const { data: newWaitlist } = await supabase
  .from('waitlist')
  .insert({
    tenant_id: 'xxx',
    customer_id: 'xxx',
    package_id: 'xxx',
    preferred_date: '2026-07-10',
    priority_score: 50,
    status: 'active',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  .select()
  .single();
```

---

## 📋 CHECKLIST

### After Migration Deployment

- [ ] Deploy migration to dev/staging
- [ ] Generate types (`npx supabase gen types`)
- [ ] Verify 4 new table types exist
- [ ] Update `src/lib/booking-engine/types/index.ts`
- [ ] Run `npm run build` (no TypeScript errors)
- [ ] Test Provider queries với real types
- [ ] Commit type updates

---

## 🚨 COMMON ISSUES

### Issue 1: Types not generated

**Solution**: 
```bash
# Make sure migration is applied
npx supabase migration up

# Then generate
npx supabase gen types typescript --local
```

### Issue 2: JSONB fields typed as `Json` (too generic)

**Solution**: Manually type them in `booking-engine/types/index.ts`:
```typescript
// Instead of Json (too generic)
export interface PricingRuleCondition {
  hour_range?: [number, number];
  days?: string[];
  utilization_min?: number;
  utilization_max?: number;
  tier?: string;
  date_range?: [string, string];
}

// Use specific type
export interface PricingRuleWithTypedCondition {
  // ... other fields
  condition: PricingRuleCondition;
}
```

### Issue 3: RLS policies prevent queries

**Solution**: Set tenant context before queries:
```typescript
// Set tenant context
await supabase.rpc('set_config', {
  setting: 'app.current_tenant_id',
  value: tenantId,
  is_local: false,
});

// Then query
const { data } = await supabase.from('waitlist').select('*');
```

---

**Status**: Guide complete  
**Next**: Deploy migration → Generate types → Update providers
