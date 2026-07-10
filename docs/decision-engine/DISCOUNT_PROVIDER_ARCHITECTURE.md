# Discount Provider Architecture

**Date:** July 9, 2026  
**Phase:** Multi-Provider Validation (Task 5)  
**Purpose:** Prove Decision Engine works beyond Booking domain

---

## Overview

Discount Provider centralizes all discount calculation logic using the Decision Engine framework. This replaces hardcoded discount logic scattered across checkout, booking, and product sales flows.

**Key Goals:**
1. ✅ Prove Decision Engine is domain-agnostic (works for Finance/Pricing)
2. ✅ Use same `DecisionEngineContext` wrapper (zero duplication)
3. ✅ Emit metrics to unified dashboard
4. ✅ Rules editable without code changes (future Rule Management UI)

---

## Discount Types

### 1. Membership Tier Discounts (Static)

**Rule-based discounts** applied automatically based on customer membership tier.

| Tier | Discount | Applies To |
|------|----------|------------|
| VIP | 15% | All services + products |
| Loyal | 10% | All services + products |
| New | 5% | First 3 purchases only |

**Example Rules:**
- VIP customers always get 15% off
- Loyal customers get 10% off after 5+ bookings
- New customers get 5% off first 3 orders (then removed)

**Provider:** `calculateTierDiscount()`

### 2. Campaign-Based Promotions (Time-bound)

**Promotional campaigns** with start/end dates and specific conditions.

| Campaign Type | Example | Conditions |
|---------------|---------|------------|
| Seasonal | Summer Sale 20% | June-August, services only |
| Bundle | Buy 3 Get 1 Free | Min 3 services, same type |
| Referral | 50k off | Referee's first booking |
| Flash Sale | 30% off weekdays | Mon-Fri 9am-3pm only |
| First-Time | 100k off | New customer, min 500k order |

**Example Rules:**
- Summer Sale: 20% off all spa services (Jun 1 - Aug 31)
- Bundle: Buy 3 massage sessions, get 1 free
- Referral: Both referrer and referee get 50k VND off
- Weekday Flash: 30% off Mon-Fri 9am-3pm

**Provider:** `applyCampaignPromotion()`

### 3. Eligibility Rules (Conditions)

**Conditions that must be met** before discount applies.

| Rule Type | Example | Logic |
|-----------|---------|-------|
| Minimum Purchase | Min 500k VND | `order.total >= 500000` |
| Time Restriction | Weekdays only | `day in [Mon, Tue, Wed, Thu, Fri]` |
| Service Exclusion | Exclude VIP services | `service.tier !== 'vip'` |
| Customer Limit | Max 3 uses per customer | `customer.discount_usage[campaign_id] < 3` |
| Stacking Rules | Cannot combine with other promos | `!order.has_other_discounts` |
| Geographic | Chi nhánh Hà Nội only | `booking.branch_id === 'hanoi'` |

**Provider:** `checkDiscountEligibility()`

---

## Provider Methods

### Method 1: `calculateTierDiscount()`

**Purpose:** Calculate membership tier discount (VIP/Loyal/New).

**Input:**
```typescript
{
  customerId: string;
  customerTier: 'vip' | 'loyal' | 'new';
  orderTotal: number; // VND
  orderType: 'service' | 'product' | 'package';
  tenantId: string;
}
```

**Output:**
```typescript
{
  eligible: boolean;
  discountPercent: number; // 0-100
  discountAmount: number; // VND
  tierName: string; // "VIP Member 15%"
  reason: string; // "VIP tier discount applied"
  ruleId: string;
}
```

**Logic:**
1. Fetch customer tier from database
2. Lookup tier discount rule
3. Calculate discount amount: `orderTotal * (discountPercent / 100)`
4. Apply max/min caps if configured
5. Return result

**Metrics:**
- Provider: `discount_calculation`
- Operation: `calculateTierDiscount`
- Outcome: `discount_applied` | `not_eligible`
- Metadata: `{ tier, discount_percent, discount_amount, order_total }`

---

### Method 2: `applyCampaignPromotion()`

**Purpose:** Apply time-bound campaign promotions (seasonal, bundles, referrals).

**Input:**
```typescript
{
  customerId: string;
  orderTotal: number;
  orderItems: Array<{
    serviceId?: string;
    productId?: string;
    quantity: number;
    price: number;
  }>;
  orderDate: string; // ISO timestamp
  referralCode?: string;
  tenantId: string;
}
```

**Output:**
```typescript
{
  eligible: boolean;
  campaignId: string;
  campaignName: string;
  discountType: 'percentage' | 'fixed' | 'bundle' | 'gift';
  discountPercent?: number;
  discountAmount?: number;
  freeItem?: { itemId: string; quantity: number };
  reason: string;
  validUntil: string; // Campaign end date
}
```

**Logic:**
1. Fetch active campaigns (start_date <= now <= end_date)
2. Filter by eligibility (minimum purchase, service type, etc.)
3. Check customer usage limits (max uses per customer)
4. Apply campaign discount/bundle/gift logic
5. Return best campaign (highest savings)

**Metrics:**
- Provider: `discount_calculation`
- Operation: `applyCampaignPromotion`
- Outcome: `campaign_applied` | `no_campaign_found` | `eligibility_failed`
- Metadata: `{ campaign_id, discount_type, discount_amount, campaign_name }`

---

### Method 3: `checkDiscountEligibility()`

**Purpose:** Validate all eligibility conditions before applying discount.

**Input:**
```typescript
{
  customerId: string;
  orderTotal: number;
  orderDate: string;
  serviceIds?: string[];
  productIds?: string[];
  branchId: string;
  existingDiscounts: string[]; // Already applied discount IDs
  tenantId: string;
}
```

**Output:**
```typescript
{
  eligible: boolean;
  violations: Array<{
    rule: string; // "minimum_purchase" | "time_restriction" | "service_exclusion"
    message: string;
    severity: 'blocking' | 'warning';
  }>;
  eligibleDiscounts: string[]; // IDs of discounts customer can use
  reason: string;
}
```

**Logic:**
1. Check minimum purchase requirement
2. Check time restrictions (weekday/weekend, time range)
3. Check service/product exclusions
4. Check customer usage limits
5. Check stacking rules (can combine discounts?)
6. Return eligible discount IDs or violations

**Metrics:**
- Provider: `discount_calculation`
- Operation: `checkDiscountEligibility`
- Outcome: `eligible` | `not_eligible`
- Metadata: `{ violations_count, eligible_discounts_count, reason }`

---

## Database Schema

### Table: `discount_rules`

**Purpose:** Store tier-based and static discount rules.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant isolation |
| `rule_name` | TEXT | "VIP Member Discount" |
| `rule_type` | TEXT | `tier` \| `fixed` |
| `customer_tier` | TEXT | `vip` \| `loyal` \| `new` \| NULL |
| `discount_type` | TEXT | `percentage` \| `fixed_amount` |
| `discount_value` | NUMERIC | 15 (for 15%) or 50000 (for 50k VND) |
| `applies_to` | TEXT[] | `['services', 'products', 'packages']` |
| `is_active` | BOOLEAN | Enable/disable rule |
| `priority` | INTEGER | 1-100 (higher priority applies first) |
| `metadata` | JSONB | Flexible rule data |
| `created_at` | TIMESTAMPTZ | Audit |
| `updated_at` | TIMESTAMPTZ | Audit |

**Indexes:**
- `tenant_id`, `is_active`
- `customer_tier`, `is_active`

---

### Table: `discount_campaigns`

**Purpose:** Store time-bound promotional campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant isolation |
| `campaign_name` | TEXT | "Summer Sale 2026" |
| `campaign_type` | TEXT | `seasonal` \| `bundle` \| `referral` \| `flash` |
| `discount_type` | TEXT | `percentage` \| `fixed_amount` \| `bundle` \| `gift` |
| `discount_value` | NUMERIC | 20 (for 20%) or 100000 (for 100k VND) |
| `start_date` | TIMESTAMPTZ | Campaign start |
| `end_date` | TIMESTAMPTZ | Campaign end |
| `min_purchase_amount` | NUMERIC | NULL or minimum order value |
| `max_uses_per_customer` | INTEGER | NULL or usage limit |
| `applies_to_services` | TEXT[] | Service IDs or NULL (all) |
| `applies_to_products` | TEXT[] | Product IDs or NULL (all) |
| `time_restrictions` | JSONB | `{ days: ['mon', 'tue'], hours: ['09:00', '15:00'] }` |
| `stacking_allowed` | BOOLEAN | Can combine with other discounts? |
| `is_active` | BOOLEAN | Enable/disable campaign |
| `metadata` | JSONB | Flexible campaign data |
| `created_at` | TIMESTAMPTZ | Audit |
| `updated_at` | TIMESTAMPTZ | Audit |

**Indexes:**
- `tenant_id`, `is_active`, `start_date`, `end_date`
- `campaign_type`, `is_active`

---

### Table: `discount_usage`

**Purpose:** Track customer discount usage (for usage limits).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant isolation |
| `customer_id` | UUID | Customer who used discount |
| `discount_rule_id` | UUID | FK to `discount_rules` or NULL |
| `discount_campaign_id` | UUID | FK to `discount_campaigns` or NULL |
| `order_id` | UUID | Order that received discount |
| `discount_amount` | NUMERIC | Actual discount applied (VND) |
| `used_at` | TIMESTAMPTZ | When discount was used |
| `metadata` | JSONB | Additional usage data |

**Indexes:**
- `customer_id`, `discount_campaign_id` (for usage limit checks)
- `tenant_id`, `used_at`

---

## Integration Points

### 1. Checkout Flow (Order Creation)

**File:** `src/services/order-creation.service.ts` (or similar)

**Integration:**
```typescript
import { DiscountDecisionService } from '@/services/discount-decision.service';
import { DecisionEngineContext } from '@/lib/decision-engine/DecisionEngineContext';

async function createOrder(orderData) {
  // Step 1: Calculate tier discount
  const tierDiscountContext = new DecisionEngineContext({
    providerType: 'discount_calculation',
    operation: 'calculateTierDiscount',
    tenantId: orderData.tenantId,
    customerId: orderData.customerId,
  });

  const tierDiscount = await tierDiscountContext.executeWithOutcome(
    () => DiscountDecisionService.calculateTierDiscount({
      customerId: orderData.customerId,
      customerTier: orderData.customerTier,
      orderTotal: orderData.total,
      orderType: 'service',
      tenantId: orderData.tenantId,
    }),
    (result) => ({
      success: result.eligible,
      outcome: result.eligible ? 'discount_applied' : 'not_eligible',
      metadata: {
        tier: orderData.customerTier,
        discount_percent: result.discountPercent,
        discount_amount: result.discountAmount,
        order_total: orderData.total,
      },
    })
  );

  // Step 2: Apply campaign promotion (if eligible)
  const campaignContext = new DecisionEngineContext({
    providerType: 'discount_calculation',
    operation: 'applyCampaignPromotion',
    tenantId: orderData.tenantId,
    customerId: orderData.customerId,
  });

  const campaignDiscount = await campaignContext.executeWithOutcome(
    () => DiscountDecisionService.applyCampaignPromotion({
      customerId: orderData.customerId,
      orderTotal: orderData.total,
      orderItems: orderData.items,
      orderDate: new Date().toISOString(),
      tenantId: orderData.tenantId,
    }),
    (result) => ({
      success: result.eligible,
      outcome: result.eligible ? 'campaign_applied' : 'no_campaign_found',
      metadata: {
        campaign_id: result.campaignId,
        discount_type: result.discountType,
        discount_amount: result.discountAmount,
        campaign_name: result.campaignName,
      },
    })
  );

  // Step 3: Calculate final discount (use best one or stack if allowed)
  const totalDiscount = tierDiscount.discountAmount + (campaignDiscount.eligible ? campaignDiscount.discountAmount : 0);
  const finalTotal = orderData.total - totalDiscount;

  // Step 4: Create order with discount
  await supabase.from('orders').insert({
    ...orderData,
    discount_amount: totalDiscount,
    final_total: finalTotal,
  });

  return { success: true, discount: totalDiscount };
}
```

---

### 2. Dashboard Integration

**Extend Booking Engine Dashboard** to show Discount metrics:

**New KPI Cards:**
- 💰 **Total Discounts Given** (VND this month)
- 📊 **Discount Rate** (% of revenue)
- 🎯 **Campaign Conversion** (% orders with campaigns)
- 👑 **Top Campaign** (most used)

**New Charts:**
- Discount breakdown by type (tier vs campaign)
- Campaign performance (conversions, revenue impact)
- Eligibility failure reasons

**File:** `src/app/dashboard/admin/booking-engine/page.tsx` (extend to all Decision Engine providers)

---

## Sample Discount Rules (Seed Data)

### Tier Discounts (3 rules)

1. **VIP Member Discount**
   - Type: `tier`
   - Customer Tier: `vip`
   - Discount: 15% off
   - Applies to: All services + products

2. **Loyal Customer Discount**
   - Type: `tier`
   - Customer Tier: `loyal`
   - Discount: 10% off
   - Applies to: All services + products

3. **New Customer Welcome**
   - Type: `tier`
   - Customer Tier: `new`
   - Discount: 5% off
   - Applies to: First 3 purchases only (tracked in metadata)

### Campaign Promotions (7 rules)

4. **Summer Sale 2026**
   - Type: `seasonal`
   - Discount: 20% off
   - Period: June 1 - August 31, 2026
   - Applies to: All spa services

5. **Buy 3 Massage, Get 1 Free**
   - Type: `bundle`
   - Logic: Buy 3+ massage services, get 1 free
   - Applies to: Massage services only

6. **Referral Bonus**
   - Type: `referral`
   - Discount: 50,000 VND off
   - Logic: Both referrer and referee get discount
   - Max uses: 5 per customer

7. **Weekday Flash Sale**
   - Type: `flash`
   - Discount: 30% off
   - Time: Mon-Fri, 9am-3pm only
   - Applies to: All services

8. **First-Time Booking Bonus**
   - Type: `first_time`
   - Discount: 100,000 VND off
   - Min purchase: 500,000 VND
   - Max uses: 1 per customer

9. **Weekend Warrior**
   - Type: `seasonal`
   - Discount: 15% off
   - Time: Sat-Sun only
   - Applies to: All services

10. **Product Bundle: Buy 2, Get 20% Off**
    - Type: `bundle`
    - Discount: 20% off
    - Logic: Min 2 products in order
    - Applies to: All products

---

## Metrics Emitted

### Metrics Table: `decision_engine_metrics`

**Discount Provider Metrics:**

| provider_type | operation | outcome | metadata |
|---------------|-----------|---------|----------|
| `discount_calculation` | `calculateTierDiscount` | `discount_applied` | `{ tier, discount_percent, discount_amount, order_total }` |
| `discount_calculation` | `calculateTierDiscount` | `not_eligible` | `{ tier, reason }` |
| `discount_calculation` | `applyCampaignPromotion` | `campaign_applied` | `{ campaign_id, discount_amount, campaign_name }` |
| `discount_calculation` | `applyCampaignPromotion` | `no_campaign_found` | `{ reason }` |
| `discount_calculation` | `applyCampaignPromotion` | `eligibility_failed` | `{ violations, reason }` |
| `discount_calculation` | `checkDiscountEligibility` | `eligible` | `{ eligible_discounts_count }` |
| `discount_calculation` | `checkDiscountEligibility` | `not_eligible` | `{ violations_count, reason }` |

**Dashboard queries these metrics to show:**
- Discount application rate (% orders with discounts)
- Campaign performance (conversions, revenue impact)
- Eligibility failure reasons (top violations)
- Average discount amount
- Tier vs campaign discount split

---

## Architecture Validation

### ✅ Domain-Agnostic

- Uses same `DecisionEngineContext` wrapper as Booking providers
- Uses same `MetricsCollector` service
- Uses same `decision_engine_metrics` table
- Dashboard can be extended to show all providers

### ✅ Zero Code Duplication

All 3 discount methods use **same pattern**:
```typescript
const context = new DecisionEngineContext({ providerType: 'discount_calculation', ... });
const result = await context.executeWithOutcome(() => provider(...), outcomeExtractor);
```

### ✅ Rule-Based (Future Rule Management UI)

All discounts stored as **database rules**, not hardcoded:
- Business users can edit via UI (future)
- No code changes to modify discount percentages
- No deployments to add new campaigns

### ✅ Audit Trail

Every discount decision recorded in `decision_engine_metrics`:
- Who got discount (customer_id)
- Which order (order_id via metadata)
- Which rule/campaign applied
- When discount was given
- How much discount given

---

## Success Criteria

1. ✅ All 10+ discount rules seed successfully
2. ✅ Discount calculation works correctly (tier + campaign)
3. ✅ Eligibility checks enforce all conditions
4. ✅ Metrics emitted to `decision_engine_metrics` table
5. ✅ Dashboard shows discount metrics (extend Booking Engine Dashboard)
6. ✅ Zero code duplication (uses DecisionEngineContext wrapper)
7. ✅ Tests pass (20+ test cases)
8. ✅ Migration from hardcoded logic complete

---

## Next Steps

1. **Create database migration** (Task 2)
2. **Implement DiscountDecisionService** (Task 3)
3. **Seed sample rules** (Task 4)
4. **Integrate into checkout flow** (Task 5)
5. **Write tests** (Task 6)
6. **Documentation** (Task 7)

---

**Status:** Architecture design complete ✅  
**Ready for implementation:** Yes  
**Estimated time:** 2-3 days total
