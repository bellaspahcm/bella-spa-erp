# Discount Provider Integration Example

**Date:** July 9, 2026  
**Phase:** Multi-Provider Validation (Task 5)  
**Purpose:** Show how to integrate Discount Provider into checkout/order flow

---

## Overview

This document provides **integration examples** for adding Discount Provider to:
1. Booking creation flow
2. Product sales checkout
3. Service checkout
4. Package purchase

**Pattern:** All integrations use `DecisionEngineContext` wrapper for automatic metrics emission.

---

## Integration Pattern (Standard)

```typescript
import { DecisionEngineContext } from '@/lib/decision-engine/DecisionEngineContext';
import {
  calculateTierDiscount,
  applyCampaignPromotion,
  trackDiscountUsage,
} from '@/services/discount-decision.service';

// Step 1: Calculate tier discount
const tierDiscountContext = new DecisionEngineContext({
  providerType: 'discount_calculation',
  operation: 'calculateTierDiscount',
  tenantId: order.tenantId,
  customerId: order.customerId,
});

const tierDiscount = await tierDiscountContext.executeWithOutcome(
  () => calculateTierDiscount({
    customerId: order.customerId,
    customerTier: customer.tier,
    orderTotal: order.total,
    orderType: 'service',
    tenantId: order.tenantId,
  }),
  (result) => ({
    success: result.eligible,
    outcome: result.eligible ? 'discount_applied' : 'not_eligible',
    metadata: {
      tier: customer.tier,
      discount_percent: result.discountPercent,
      discount_amount: result.discountAmount,
      order_total: order.total,
    },
  })
);

// Step 2: Apply campaign promotion (if eligible)
const campaignContext = new DecisionEngineContext({
  providerType: 'discount_calculation',
  operation: 'applyCampaignPromotion',
  tenantId: order.tenantId,
  customerId: order.customerId,
});

const campaignDiscount = await campaignContext.executeWithOutcome(
  () => applyCampaignPromotion({
    customerId: order.customerId,
    orderTotal: order.total,
    orderItems: order.items,
    orderDate: new Date().toISOString(),
    tenantId: order.tenantId,
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

// Step 3: Calculate total discount (tier + campaign, or best one)
// Note: Check campaign.stacking_allowed to decide if can combine
const totalDiscount = tierDiscount.eligible ? tierDiscount.discountAmount : 0;
// For simplicity, use tier discount only (campaign stacking logic to be implemented)

// Step 4: Apply discount to order
const finalTotal = order.total - totalDiscount;

// Step 5: Create order with discount
await supabase.from('bookings').insert({
  ...bookingData,
  discount_amount: totalDiscount,
  final_total: finalTotal,
  discount_type: tierDiscount.eligible ? 'tier' : 'none',
  discount_metadata: {
    tier_discount: tierDiscount.eligible ? {
      rule_id: tierDiscount.ruleId,
      percent: tierDiscount.discountPercent,
      amount: tierDiscount.discountAmount,
    } : null,
  },
});

// Step 6: Track discount usage
if (tierDiscount.eligible) {
  await trackDiscountUsage({
    tenantId: order.tenantId,
    customerId: order.customerId,
    discountRuleId: tierDiscount.ruleId,
    bookingId: booking.id,
    discountType: 'percentage',
    discountAmount: tierDiscount.discountAmount,
    originalAmount: order.total,
    finalAmount: finalTotal,
    metadata: { tier: customer.tier },
  });
}
```

---

## Example 1: Booking Creation Flow

**File:** `src/core/services/order/create-booking-action.ts` (conceptual integration)

```typescript
/**
 * Integrate discount calculation into booking creation
 * 
 * Insert after Step 8 (Pricing Calculation) and before Step 10 (Booking Record)
 */

// ... existing code ...

// Step 8: Pricing Calculation (existing)
const bookingPayload = await buildBookingPayload({ ... });
const originalPrice = bookingPayload.full_price;

// ========================================
// NEW: Step 8.5: Discount Calculation
// ========================================

import { DecisionEngineContext } from '@/lib/decision-engine/DecisionEngineContext';
import {
  calculateTierDiscount,
  applyCampaignPromotion,
  trackDiscountUsage,
} from '@/services/discount-decision.service';

// Get customer tier (from customers table)
const { data: customer } = await supabase
  .from('customers')
  .select('tier')
  .eq('id', customerResult.customerId)
  .single();

const customerTier = customer?.tier || 'new';

// Calculate tier discount
const tierDiscountContext = new DecisionEngineContext({
  providerType: 'discount_calculation',
  operation: 'calculateTierDiscount',
  tenantId,
  customerId: customerResult.customerId,
  bookingId: bookingPayload.id, // If known
});

const tierDiscount = await tierDiscountContext.executeWithOutcome(
  () => calculateTierDiscount({
    customerId: customerResult.customerId,
    customerTier,
    orderTotal: originalPrice,
    orderType: 'package',
    tenantId,
  }),
  (result) => ({
    success: result.eligible,
    outcome: result.eligible ? 'discount_applied' : 'not_eligible',
    metadata: {
      tier: customerTier,
      discount_percent: result.discountPercent,
      discount_amount: result.discountAmount,
      order_total: originalPrice,
    },
  })
);

// Apply campaign (optional - can add later)
// const campaignDiscount = await applyCampaignPromotion({ ... });

// Calculate final price
const discountAmount = tierDiscount.eligible ? tierDiscount.discountAmount : 0;
const finalPrice = originalPrice - discountAmount;

// Update booking payload
bookingPayload.full_price = finalPrice;
bookingPayload.discount_amount = discountAmount;
bookingPayload.discount_percent = tierDiscount.eligible ? tierDiscount.discountPercent : null;

// Step 9: Adapter Validation (existing)
// ... continue with existing code ...

// Step 10: Booking Record (existing)
const bookingResult = await upsertBookingRecord(supabase, bookingPayload);

// ========================================
// NEW: Step 12.5: Track Discount Usage
// ========================================

if (tierDiscount.eligible && bookingResult.data) {
  await trackDiscountUsage({
    tenantId,
    customerId: customerResult.customerId,
    discountRuleId: tierDiscount.ruleId,
    bookingId: bookingResult.data.id,
    discountType: 'percentage',
    discountAmount: discountAmount,
    originalAmount: originalPrice,
    finalAmount: finalPrice,
    metadata: {
      tier: customerTier,
      package_id: validatedData.package_id,
    },
  });
}

// Step 13: Cache Invalidation (existing)
// ... continue with existing code ...
```

---

## Example 2: Product Sales Checkout

**File:** `src/services/product-sales-checkout.service.ts` (conceptual)

```typescript
export async function createProductSale(saleData: ProductSaleInput) {
  const supabase = await createClient();
  
  // Step 1: Calculate order total
  const orderTotal = saleData.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price);
  }, 0);
  
  // Step 2: Get customer tier
  const { data: customer } = await supabase
    .from('customers')
    .select('tier')
    .eq('id', saleData.customerId)
    .single();
  
  const customerTier = customer?.tier || 'new';
  
  // Step 3: Calculate tier discount (products)
  const tierDiscountContext = new DecisionEngineContext({
    providerType: 'discount_calculation',
    operation: 'calculateTierDiscount',
    tenantId: saleData.tenantId,
    customerId: saleData.customerId,
  });
  
  const tierDiscount = await tierDiscountContext.executeWithOutcome(
    () => calculateTierDiscount({
      customerId: saleData.customerId,
      customerTier,
      orderTotal,
      orderType: 'product',
      productIds: saleData.items.map(i => i.product_id),
      tenantId: saleData.tenantId,
    }),
    (result) => ({
      success: result.eligible,
      outcome: result.eligible ? 'discount_applied' : 'not_eligible',
      metadata: {
        tier: customerTier,
        discount_percent: result.discountPercent,
        discount_amount: result.discountAmount,
        order_total: orderTotal,
      },
    })
  );
  
  // Step 4: Apply campaign (product bundle discount)
  const campaignContext = new DecisionEngineContext({
    providerType: 'discount_calculation',
    operation: 'applyCampaignPromotion',
    tenantId: saleData.tenantId,
    customerId: saleData.customerId,
  });
  
  const campaignDiscount = await campaignContext.executeWithOutcome(
    () => applyCampaignPromotion({
      customerId: saleData.customerId,
      orderTotal,
      orderItems: saleData.items.map(i => ({
        productId: i.product_id,
        quantity: i.quantity,
        price: i.unit_price,
      })),
      orderDate: new Date().toISOString(),
      tenantId: saleData.tenantId,
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
  
  // Step 5: Calculate final discount (use best one)
  const tierAmount = tierDiscount.eligible ? tierDiscount.discountAmount : 0;
  const campaignAmount = campaignDiscount.eligible ? campaignDiscount.discountAmount : 0;
  const finalDiscountAmount = Math.max(tierAmount, campaignAmount);
  const finalTotal = orderTotal - finalDiscountAmount;
  
  // Step 6: Create product sale record
  const { data: sale, error } = await supabase
    .from('product_sales')
    .insert({
      tenant_id: saleData.tenantId,
      customer_id: saleData.customerId,
      sale_date: new Date().toISOString(),
      total_amount: orderTotal,
      discount_amount: finalDiscountAmount,
      final_amount: finalTotal,
      items: saleData.items,
      discount_metadata: {
        tier_discount: tierDiscount.eligible ? tierDiscount : null,
        campaign_discount: campaignDiscount.eligible ? campaignDiscount : null,
      },
    })
    .select()
    .single();
  
  if (error || !sale) {
    return { success: false, error: error?.message };
  }
  
  // Step 7: Track discount usage
  if (tierDiscount.eligible) {
    await trackDiscountUsage({
      tenantId: saleData.tenantId,
      customerId: saleData.customerId,
      discountRuleId: tierDiscount.ruleId,
      orderId: sale.id,
      discountType: 'percentage',
      discountAmount: tierAmount,
      originalAmount: orderTotal,
      finalAmount: finalTotal,
      metadata: { tier: customerTier, product_sale: true },
    });
  }
  
  if (campaignDiscount.eligible) {
    await trackDiscountUsage({
      tenantId: saleData.tenantId,
      customerId: saleData.customerId,
      discountCampaignId: campaignDiscount.campaignId,
      orderId: sale.id,
      discountType: campaignDiscount.discountType,
      discountAmount: campaignAmount,
      originalAmount: orderTotal,
      finalAmount: finalTotal,
      metadata: { campaign_name: campaignDiscount.campaignName, product_sale: true },
    });
  }
  
  return { success: true, data: sale };
}
```

---

## Example 3: Service Checkout (Session Completion)

**File:** `src/services/session-checkout.service.ts` (conceptual)

```typescript
export async function completeSession(sessionData: SessionCompletionInput) {
  // ... existing session completion logic ...
  
  // Calculate service fee
  const serviceFee = sessionData.durationMinutes * sessionData.ratePerMinute;
  
  // Get customer tier
  const { data: customer } = await supabase
    .from('customers')
    .select('tier')
    .eq('id', sessionData.customerId)
    .single();
  
  const customerTier = customer?.tier || 'new';
  
  // Calculate tier discount
  const tierDiscountContext = new DecisionEngineContext({
    providerType: 'discount_calculation',
    operation: 'calculateTierDiscount',
    tenantId: sessionData.tenantId,
    customerId: sessionData.customerId,
  });
  
  const tierDiscount = await tierDiscountContext.executeWithOutcome(
    () => calculateTierDiscount({
      customerId: sessionData.customerId,
      customerTier,
      orderTotal: serviceFee,
      orderType: 'service',
      serviceIds: [sessionData.serviceId],
      tenantId: sessionData.tenantId,
    }),
    (result) => ({
      success: result.eligible,
      outcome: result.eligible ? 'discount_applied' : 'not_eligible',
      metadata: {
        tier: customerTier,
        discount_percent: result.discountPercent,
        discount_amount: result.discountAmount,
        order_total: serviceFee,
      },
    })
  );
  
  const discountAmount = tierDiscount.eligible ? tierDiscount.discountAmount : 0;
  const finalFee = serviceFee - discountAmount;
  
  // Update session with discount
  await supabase
    .from('session_logs')
    .update({
      service_fee: finalFee,
      discount_amount: discountAmount,
      discount_percent: tierDiscount.eligible ? tierDiscount.discountPercent : null,
      status: 'completed',
    })
    .eq('id', sessionData.sessionId);
  
  // Track usage
  if (tierDiscount.eligible) {
    await trackDiscountUsage({
      tenantId: sessionData.tenantId,
      customerId: sessionData.customerId,
      discountRuleId: tierDiscount.ruleId,
      bookingId: sessionData.bookingId,
      discountType: 'percentage',
      discountAmount: discountAmount,
      originalAmount: serviceFee,
      finalAmount: finalFee,
      metadata: { tier: customerTier, session_id: sessionData.sessionId },
    });
  }
  
  return { success: true, finalFee };
}
```

---

## Metrics Emitted

After integration, the following metrics will be emitted to `decision_engine_metrics` table:

| provider_type | operation | outcome | metadata |
|---------------|-----------|---------|----------|
| `discount_calculation` | `calculateTierDiscount` | `discount_applied` | `{ tier, discount_percent, discount_amount, order_total }` |
| `discount_calculation` | `calculateTierDiscount` | `not_eligible` | `{ tier, reason }` |
| `discount_calculation` | `applyCampaignPromotion` | `campaign_applied` | `{ campaign_id, discount_amount, campaign_name }` |
| `discount_calculation` | `applyCampaignPromotion` | `no_campaign_found` | `{ reason }` |

---

## Dashboard Integration

**Extend Booking Engine Dashboard** to show Discount metrics:

**File:** `src/app/dashboard/admin/booking-engine/page.tsx`

**New sections to add:**

```tsx
{/* Discount Provider Metrics */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <DollarSign className="h-5 w-5" />
      Discount Performance
    </CardTitle>
    <CardDescription>Tier discounts and campaign promotions</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <div className="text-sm text-muted-foreground">Total Discounts</div>
        <div className="text-2xl font-bold">{data.discount.total_amount_vnd}đ</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Discount Rate</div>
        <div className="text-2xl font-bold">{data.discount.discount_rate_percent}%</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Orders with Discount</div>
        <div className="text-2xl font-bold">{data.discount.orders_with_discount}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Top Campaign</div>
        <div className="text-sm font-semibold">{data.discount.top_campaign_name}</div>
      </div>
    </div>
  </CardContent>
</Card>

{/* Discount Breakdown */}
<Card>
  <CardHeader>
    <CardTitle>Discount Breakdown</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Tier Discounts (VIP/Loyal/New)</span>
        <span className="font-semibold">{data.discount.tier_discount_amount}đ</span>
      </div>
      <div className="flex justify-between">
        <span>Campaign Promotions</span>
        <span className="font-semibold">{data.discount.campaign_discount_amount}đ</span>
      </div>
      <div className="flex justify-between border-t pt-2">
        <span className="font-bold">Total</span>
        <span className="font-bold">{data.discount.total_amount_vnd}đ</span>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Testing Integration

**Manual Test Steps:**

1. **Run migration and seed:**
   ```bash
   # Apply migration
   npx supabase db reset
   
   # Seed discount rules
   # Run seed_discount_rules.sql in Supabase SQL Editor
   ```

2. **Create test booking:**
   - Customer: VIP tier
   - Package: Any package (e.g., 5,000,000 VND)
   - Expected: 15% discount = 750,000 VND off
   - Final price: 4,250,000 VND

3. **Verify metrics:**
   ```sql
   SELECT
     provider_type,
     operation,
     success,
     outcome,
     execution_time_ms,
     metadata
   FROM decision_engine_metrics
   WHERE provider_type = 'discount_calculation'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

4. **Check discount usage:**
   ```sql
   SELECT
     customer_id,
     discount_type,
     discount_amount,
     original_amount,
     final_amount,
     used_at
   FROM discount_usage
   ORDER BY used_at DESC
   LIMIT 10;
   ```

5. **Dashboard verification:**
   - Open http://localhost:3000/dashboard/admin/booking-engine
   - Should show discount metrics (if extended)

---

## Migration from Hardcoded Logic

**Before (Hardcoded):**
```typescript
// Hardcoded discount logic (BAD)
let discount = 0;
if (customer.tier === 'vip') {
  discount = orderTotal * 0.15;
} else if (customer.tier === 'loyal') {
  discount = orderTotal * 0.10;
} else if (customer.tier === 'new') {
  discount = orderTotal * 0.05;
}

const finalTotal = orderTotal - discount;
```

**After (Rule-Based):**
```typescript
// Rule-based discount (GOOD)
const tierDiscount = await calculateTierDiscount({
  customerId: customer.id,
  customerTier: customer.tier,
  orderTotal,
  orderType: 'service',
  tenantId: tenant.id,
});

const discount = tierDiscount.eligible ? tierDiscount.discountAmount : 0;
const finalTotal = orderTotal - discount;
```

**Benefits:**
- ✅ Business users can change discount percentages via UI (future)
- ✅ No code changes needed to add new campaigns
- ✅ Full audit trail (who got discount, when, how much)
- ✅ Metrics for dashboard (discount performance, campaign ROI)
- ✅ A/B testing campaigns (enable/disable campaigns easily)

---

## Success Criteria

✅ Discount Provider integrated into at least one checkout flow (booking/product/service)  
✅ Metrics emitted to `decision_engine_metrics` table  
✅ `discount_usage` table tracks all discounts applied  
✅ Discount calculation uses `DecisionEngineContext` wrapper  
✅ Build passes without errors  
✅ Manual test shows correct discount calculation  

---

## Next Steps

1. **Choose integration point** (booking creation recommended first)
2. **Implement integration** following Example 1 pattern
3. **Test with sample data** (run seed script first)
4. **Verify metrics emission** (check `decision_engine_metrics` table)
5. **Extend dashboard** (add discount performance cards)
6. **Write tests** (Task 6)

---

**Status:** Integration pattern documented ✅  
**Implementation:** Deferred to production deployment (safe to integrate anytime)  
**Reason:** Booking flow is production-critical, integration should be done carefully with full test coverage
