# Booking Pricing Decision Engine Integration

**Priority:** 🔵 HIGH  
**Expected Volume:** 200-500 decisions/day  
**Timeline:** Week 2-3 (Jun 29 - Jul 12, 2026)  
**Status:** 📋 Planning

---

## 🎯 Objective

Implement intelligent dynamic pricing for bookings based on:
- Customer tier (VIP, Regular, New)
- Time slot demand (peak vs off-peak)
- Package type
- Booking advance time
- Promotional periods
- Seasonal factors
- KTV availability

---

## 📊 Current State Analysis

### Existing Pricing Logic Location

Need to identify current pricing calculation:
- [ ] Where is booking price calculated? (likely in `src/services/booking-decision-service.ts` or booking creation API)
- [ ] Is pricing hardcoded or rule-based?
- [ ] Where are package base prices stored? (`packages` table)
- [ ] Are there existing discounts/promotions?

### Current Flow
```
User selects package
  ↓
System shows fixed price (from packages.price)
  ↓
User books
  ↓
Price recorded in bookings.full_price
```

### Target Flow
```
User selects package
  ↓
🧠 Decision Engine: Calculate dynamic price
  ↓
Input: customer tier, time slot, demand, package
  ↓
Output: suggested_price, discount_applied, reason
  ↓
Display price to user
  ↓
User books
  ↓
Log decision in decision_audit
```

---

## 🧩 Decision Context Schema

```typescript
interface BookingPricingContext {
  // Customer info
  customerId: string;
  customerTier: 'vip' | 'regular' | 'new';
  customerLifetimeValue: number;
  customerBookingCount: number;
  customerLastVisit?: Date;
  
  // Booking info
  packageId: string;
  packageBasePrice: number;
  packageCategory: string;
  preferredDate: Date;
  preferredTime: string;
  
  // Demand factors
  timeSlotDemand: 'high' | 'medium' | 'low';
  ktvAvailability: number; // 0-100%
  isWeekend: boolean;
  isHoliday: boolean;
  daysInAdvance: number; // How many days before booking
  
  // Business factors
  currentMonthRevenue: number;
  currentMonthTarget: number;
  isPromotionalPeriod: boolean;
  tenantId: string;
  tenantModule: string;
}
```

## 📋 Decision Result Schema

```typescript
interface BookingPricingResult {
  decision: 'approve_price' | 'suggest_discount' | 'suggest_premium';
  suggestedPrice: number;
  originalPrice: number;
  discountPercent: number;
  premiumPercent: number;
  confidence: number;
  reason: string;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    impact: number; // +/- percent
    reason: string;
  }>;
  metadata: {
    priceBreakdown: {
      basePrice: number;
      customerTierAdjustment: number;
      demandAdjustment: number;
      timeSlotAdjustment: number;
      promotionalDiscount: number;
      finalPrice: number;
    };
  };
}
```

---

## 🎛️ Pricing Rules (Initial Set)

### Rule 1: VIP Customer Discount
```typescript
{
  id: 'pricing_vip_discount',
  name: 'VIP Customer Automatic Discount',
  priority: 90,
  conditions: {
    customerTier: 'vip',
    customerLifetimeValue: { $gte: 10000000 } // 10M VND
  },
  actions: {
    applyDiscount: 10, // 10% off
    reason: 'VIP customer loyalty discount'
  }
}
```

### Rule 2: New Customer Welcome Discount
```typescript
{
  id: 'pricing_new_customer',
  name: 'First-Time Customer Discount',
  priority: 85,
  conditions: {
    customerTier: 'new',
    customerBookingCount: 0
  },
  actions: {
    applyDiscount: 15, // 15% off first booking
    reason: 'Welcome discount for new customer'
  }
}
```

### Rule 3: Peak Time Premium
```typescript
{
  id: 'pricing_peak_premium',
  name: 'Peak Time Demand Premium',
  priority: 80,
  conditions: {
    timeSlotDemand: 'high',
    isWeekend: true,
    ktvAvailability: { $lt: 30 } // < 30% KTV available
  },
  actions: {
    applyPremium: 20, // +20% surcharge
    reason: 'High demand period - limited KTV availability'
  }
}
```

### Rule 4: Off-Peak Discount
```typescript
{
  id: 'pricing_offpeak_discount',
  name: 'Off-Peak Time Discount',
  priority: 75,
  conditions: {
    timeSlotDemand: 'low',
    isWeekend: false,
    preferredTime: { $in: ['08:00', '09:00', '10:00'] } // Morning slots
  },
  actions: {
    applyDiscount: 10, // 10% off morning slots
    reason: 'Off-peak morning discount'
  }
}
```

### Rule 5: Early Bird Discount
```typescript
{
  id: 'pricing_early_bird',
  name: 'Advance Booking Discount',
  priority: 70,
  conditions: {
    daysInAdvance: { $gte: 7 } // Book 7+ days in advance
  },
  actions: {
    applyDiscount: 5, // 5% off for planning ahead
    reason: 'Early bird discount - booked 7+ days in advance'
  }
}
```

### Rule 6: Last-Minute Premium
```typescript
{
  id: 'pricing_lastminute_premium',
  name: 'Same-Day Booking Premium',
  priority: 75,
  conditions: {
    daysInAdvance: 0, // Same day booking
    timeSlotDemand: { $in: ['high', 'medium'] }
  },
  actions: {
    applyPremium: 15, // +15% for same-day
    reason: 'Last-minute booking surcharge'
  }
}
```

### Rule 7: Promotional Period Discount
```typescript
{
  id: 'pricing_promo_period',
  name: 'Active Promotion Campaign',
  priority: 95, // Highest priority
  conditions: {
    isPromotionalPeriod: true
  },
  actions: {
    applyDiscount: 20, // 20% promotional discount
    reason: 'Active promotional campaign discount'
  }
}
```

### Rule 8: Revenue Target Incentive
```typescript
{
  id: 'pricing_revenue_target',
  name: 'End-of-Month Revenue Push',
  priority: 65,
  conditions: {
    currentMonthRevenue: { $lt: (ctx) => ctx.currentMonthTarget * 0.8 }, // < 80% of target
    preferredDate: (ctx) => {
      const date = new Date(ctx.preferredDate);
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const daysRemaining = Math.ceil((lastDayOfMonth - date) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 7; // Last week of month
    }
  },
  actions: {
    applyDiscount: 12, // 12% off to hit target
    reason: 'Special end-of-month promotion'
  }
}
```

---

## 🔧 Implementation Plan

### Phase 1: Backend Integration (Week 1)

#### 1.1: Create Pricing Policy
```bash
src/lib/decision-engine/policies/booking-pricing-policy.ts
```

```typescript
import { Policy, Rule } from '../types';
import type { BookingPricingContext, BookingPricingResult } from './types';

export const bookingPricingPolicy: Policy<BookingPricingContext, BookingPricingResult> = {
  id: 'booking_pricing',
  name: 'Dynamic Booking Pricing Policy',
  version: '1.0.0',
  domain: 'booking',
  category: 'pricing',
  rules: [
    // VIP discount rule
    {
      id: 'pricing_vip_discount',
      name: 'VIP Customer Automatic Discount',
      priority: 90,
      evaluate: (context) => {
        if (context.customerTier === 'vip' && context.customerLifetimeValue >= 10000000) {
          return {
            matches: true,
            action: {
              type: 'apply_discount',
              value: 10,
              reason: 'VIP customer loyalty discount'
            }
          };
        }
        return { matches: false };
      }
    },
    // ... other rules
  ],
  fallback: (context) => ({
    decision: 'approve_price',
    suggestedPrice: context.packageBasePrice,
    originalPrice: context.packageBasePrice,
    discountPercent: 0,
    premiumPercent: 0,
    confidence: 1.0,
    reason: 'Standard pricing applied',
    appliedRules: [],
    metadata: {
      priceBreakdown: {
        basePrice: context.packageBasePrice,
        customerTierAdjustment: 0,
        demandAdjustment: 0,
        timeSlotAdjustment: 0,
        promotionalDiscount: 0,
        finalPrice: context.packageBasePrice
      }
    }
  })
};
```

#### 1.2: Create Pricing Decision Service
```bash
src/services/booking-pricing-decision-service.ts
```

```typescript
import { DecisionEngine } from '@/lib/decision-engine/engine';
import { bookingPricingPolicy } from '@/lib/decision-engine/policies/booking-pricing-policy';
import type { BookingPricingContext, BookingPricingResult } from './types';

export async function calculateDynamicPrice(
  context: BookingPricingContext
): Promise<BookingPricingResult> {
  const engine = new DecisionEngine();
  
  // Execute decision
  const result = await engine.execute({
    policy: bookingPricingPolicy,
    context,
    metadata: {
      userId: context.customerId,
      tenantId: context.tenantId,
      timestamp: new Date().toISOString()
    }
  });
  
  return result.decision;
}
```

#### 1.3: Create Helper Functions
```typescript
// src/services/booking-pricing-helpers.ts

export async function getCustomerTier(customerId: string): Promise<'vip' | 'regular' | 'new'> {
  // Query customer table
  // Check lifetime value, booking count
  // Return tier
}

export async function getTimeSlotDemand(date: Date, time: string): Promise<'high' | 'medium' | 'low'> {
  // Query existing bookings for that date/time
  // Calculate booking rate
  // Return demand level
}

export async function getKtvAvailability(date: Date): Promise<number> {
  // Query KTV schedules
  // Calculate available percentage
  // Return 0-100
}

export function isPromotionalPeriod(tenantId: string): boolean {
  // Check promotions table
  // Return true if active promotion exists
}
```

#### 1.4: Update Booking Creation API
```typescript
// src/app/api/bookings/create/route.ts

import { calculateDynamicPrice } from '@/services/booking-pricing-decision-service';

export async function POST(req: Request) {
  const body = await req.json();
  
  // Build pricing context
  const pricingContext: BookingPricingContext = {
    customerId: body.customer_id,
    customerTier: await getCustomerTier(body.customer_id),
    customerLifetimeValue: await getCustomerLTV(body.customer_id),
    // ... other context fields
  };
  
  // 🧠 Call Decision Engine
  const pricingDecision = await calculateDynamicPrice(pricingContext);
  
  // Use suggested price
  const finalPrice = pricingDecision.suggestedPrice;
  
  // Create booking with dynamic price
  const booking = await supabase.from('bookings').insert({
    ...body,
    full_price: finalPrice,
    discount_percent: pricingDecision.discountPercent,
    pricing_reason: pricingDecision.reason
  });
  
  // Return with pricing explanation
  return NextResponse.json({
    booking,
    pricing: {
      originalPrice: pricingDecision.originalPrice,
      finalPrice: pricingDecision.suggestedPrice,
      discountApplied: pricingDecision.discountPercent,
      reason: pricingDecision.reason
    }
  });
}
```

### Phase 2: Frontend Integration (Week 2)

#### 2.1: Update Booking Modal
```typescript
// src/components/features/BookingModal.tsx

// When package is selected, call pricing API
const handlePackageChange = async (packageId: string) => {
  setSelectedPackage(packageId);
  
  // 🧠 Get dynamic price
  const response = await fetch('/api/bookings/preview-price', {
    method: 'POST',
    body: JSON.stringify({
      package_id: packageId,
      customer_id: formData.customer_id,
      preferred_date: formData.preferred_date,
      preferred_time: formData.preferred_time
    })
  });
  
  const { pricing } = await response.json();
  
  // Show pricing breakdown
  setDynamicPricing(pricing);
};
```

#### 2.2: Display Pricing Breakdown
```tsx
<div className="pricing-breakdown">
  <div className="original-price">
    {dynamicPricing.originalPrice !== dynamicPricing.finalPrice && (
      <span className="line-through text-gray-500">
        {formatCurrency(dynamicPricing.originalPrice)}
      </span>
    )}
  </div>
  
  <div className="final-price text-2xl font-bold">
    {formatCurrency(dynamicPricing.finalPrice)}
  </div>
  
  {dynamicPricing.discountApplied > 0 && (
    <div className="discount-badge bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
      -{dynamicPricing.discountApplied}% {dynamicPricing.reason}
    </div>
  )}
  
  {dynamicPricing.premiumApplied > 0 && (
    <div className="premium-badge bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
      +{dynamicPricing.premiumApplied}% {dynamicPricing.reason}
    </div>
  )}
</div>
```

### Phase 3: Testing (Week 3)

#### 3.1: Unit Tests
```typescript
// src/services/__tests__/booking-pricing-decision.test.ts

describe('Booking Pricing Decision Engine', () => {
  it('should apply VIP discount for high-value customers', async () => {
    const context: BookingPricingContext = {
      customerId: 'vip-001',
      customerTier: 'vip',
      customerLifetimeValue: 15000000,
      packageBasePrice: 1000000,
      // ...
    };
    
    const result = await calculateDynamicPrice(context);
    
    expect(result.discountPercent).toBe(10);
    expect(result.suggestedPrice).toBe(900000);
    expect(result.reason).toContain('VIP');
  });
  
  it('should apply peak time premium on weekends', async () => {
    const context: BookingPricingContext = {
      // ...
      isWeekend: true,
      timeSlotDemand: 'high',
      ktvAvailability: 20,
      packageBasePrice: 1000000,
    };
    
    const result = await calculateDynamicPrice(context);
    
    expect(result.premiumPercent).toBe(20);
    expect(result.suggestedPrice).toBe(1200000);
  });
  
  // Test rule conflicts
  it('should stack discounts correctly (VIP + Early Bird)', async () => {
    const context: BookingPricingContext = {
      customerTier: 'vip',
      customerLifetimeValue: 15000000,
      daysInAdvance: 10,
      packageBasePrice: 1000000,
      // ...
    };
    
    const result = await calculateDynamicPrice(context);
    
    // VIP 10% + Early Bird 5% = 15% total
    expect(result.discountPercent).toBe(15);
    expect(result.suggestedPrice).toBe(850000);
  });
});
```

#### 3.2: Integration Tests
- [ ] Test with real customer data
- [ ] Test different time slots
- [ ] Test weekend vs weekday
- [ ] Test promotional periods
- [ ] Test with 100+ bookings to ensure performance

#### 3.3: Load Tests
- [ ] Simulate 500 concurrent pricing decisions
- [ ] Measure latency (target < 50ms)
- [ ] Check database impact

---

## 📊 Success Metrics

### Volume Metrics
- [ ] 200+ pricing decisions/day within 2 weeks
- [ ] 500+ pricing decisions/day within 4 weeks

### Quality Metrics
- [ ] Decision latency < 50ms (p95)
- [ ] Zero pricing errors
- [ ] 100% decisions audited
- [ ] Policy coverage > 90%

### Business Metrics
- [ ] Revenue increase from dynamic pricing
- [ ] Customer satisfaction maintained
- [ ] Booking conversion rate improvement

---

## 🚨 Rollout Plan

### Week 1: Shadow Mode
- Deploy to production but DON'T apply prices
- Log all decisions
- Compare suggested prices vs current fixed prices
- Monitor for anomalies

### Week 2: A/B Test (10% traffic)
- Apply dynamic pricing to 10% of bookings
- Track conversion rate
- Track revenue per booking
- Compare vs control group

### Week 3: Full Rollout (100%)
- If A/B test successful, roll out to 100%
- Monitor closely for 7 days
- Be ready to rollback if issues

---

## 🔄 Future Enhancements

### Phase 2 (After initial deployment):
1. **Machine Learning Price Optimization**
   - Train model on historical booking data
   - Predict optimal price per customer segment
   - A/B test ML prices vs rule-based prices

2. **Competitor Price Monitoring**
   - Scrape competitor prices
   - Adjust pricing to stay competitive

3. **Demand Forecasting**
   - Predict high-demand days
   - Adjust pricing proactively

4. **Personalized Pricing**
   - Per-customer price optimization
   - Consider individual price sensitivity

---

## 📝 Related Documents

- [Decision Engine Core](../DECISION_ENGINE_CORE.md)
- [Policy Framework](../POLICY_FRAMEWORK.md)
- [Audit Engine](../AUDIT_ENGINE.md)
- [Strategic Roadmap](../BELLA_EIP_STRATEGIC_ROADMAP.md)

---

**Document Version:** 1.0  
**Created:** June 22, 2026  
**Owner:** Bella Platform Team  
**Status:** 📋 Planning Phase

---

## ✅ Next Actions

**This Week:**
- [ ] Analyze current booking pricing logic
- [ ] Define pricing rules with business team
- [ ] Create pricing policy file
- [ ] Implement pricing decision service
- [ ] Add unit tests

**Next Week:**
- [ ] Integrate with booking API
- [ ] Update booking modal UI
- [ ] Deploy to shadow mode
- [ ] Monitor shadow decisions

**Week 3:**
- [ ] Start A/B test (10% traffic)
- [ ] Analyze results
- [ ] Full rollout if successful
