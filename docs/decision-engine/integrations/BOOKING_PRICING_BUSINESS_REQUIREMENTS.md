# Booking Dynamic Pricing - Business Requirements Review

**Date:** June 22, 2026  
**Purpose:** Define pricing strategy and business rules for dynamic pricing system  
**Audience:** Business Team, Operations, Management  
**Status:** 📋 Awaiting Business Input

---

## 🎯 Executive Summary

**Objective:** Implement intelligent dynamic pricing for bookings to:
- **Maximize revenue** during peak demand periods
- **Fill capacity** during off-peak times with strategic discounts
- **Reward loyal customers** with automatic VIP benefits
- **Attract new customers** with welcome offers
- **Incentivize planning** with early bird discounts
- **Maintain flexibility** for promotional campaigns

**Expected Impact:**
- Revenue optimization (±5-10% revenue increase from better pricing)
- Higher conversion rate (15-20% increase from targeted discounts)
- Better capacity utilization (30% reduction in empty slots)
- Customer satisfaction (transparent pricing with clear reasons)

---

## 📋 Questions for Business Team

### Section 1: Customer Tier Strategy

#### Q1.1: Customer Tier Definitions
How should we classify customers into tiers?

**Proposed Classification:**

| Tier | Criteria | Benefits |
|------|----------|----------|
| **VIP** | LTV ≥ 10M VND OR 10+ completed bookings | Automatic 10% discount |
| **Regular** | 1-9 completed bookings | Standard pricing |
| **New** | 0 completed bookings | 15% welcome discount (first booking only) |

**Questions:**
- [ ] Are these thresholds appropriate? (10M VND, 10 bookings)
- [ ] Should VIP tier have sub-tiers? (e.g., Gold VIP, Platinum VIP)
- [ ] Should we consider recency? (e.g., "Active VIP" = visited in last 3 months)
- [ ] Should VIP discount be 10%, or different %?
- [ ] Should new customer discount be 15%, or different %?

**Alternative Classification:**
```
Option A (Simple):
- VIP: 10+ bookings → 10% discount
- Regular: 1-9 bookings → Standard
- New: 0 bookings → 15% discount

Option B (LTV-Based):
- Platinum VIP: LTV ≥ 20M → 15% discount
- Gold VIP: LTV 10-20M → 10% discount
- Silver: LTV 5-10M → 5% discount
- Regular: LTV < 5M → Standard
- New: 0 bookings → 15% discount

Option C (Recency + Volume):
- Active VIP: 5+ visits in last 6 months → 12% discount
- Dormant VIP: 10+ total but no visit in 6 months → 5% discount
- Regular: Standard
- New: 15% discount
```

**Business Decision Needed:**
- [ ] Choose classification model: A, B, C, or custom?
- [ ] Confirm discount percentages
- [ ] Set tier thresholds (LTV amounts, booking counts)

---

### Section 2: Time-Based Pricing

#### Q2.1: Peak Time Pricing Strategy
Should we charge more during high-demand periods?

**Proposed Peak Times:**
- **Weekend (Sat-Sun):** +20% premium
- **Evening (18:00-20:00):** +15% premium
- **Public holidays:** +25% premium

**Questions:**
- [ ] Should we charge premium during peak times?
- [ ] What % premium is acceptable? (Customers may feel it's unfair)
- [ ] Which time slots are actually "peak"? (Need historical data)
- [ ] Should we combine premiums? (e.g., Saturday evening = +35%?)

**Alternative Strategies:**
```
Option A (Premium Pricing):
- Weekend: +20%
- Evening prime time: +15%
- Holiday: +25%
PRO: Maximize revenue during peak
CON: May reduce bookings if too expensive

Option B (No Premium, Discount Off-Peak):
- Weekend/evening: Standard price (no premium)
- Off-peak (weekday morning 8-11): -10% discount
- Late night (after 20:00): -15% discount
PRO: Less customer resistance, fills empty slots
CON: Leaves money on table during peak

Option C (Hybrid):
- Weekend/prime time: Standard price
- Off-peak: -10% discount
- Only apply premium during PROVEN high-demand (80%+ booked)
PRO: Balanced approach
CON: More complex logic
```

**Business Decision Needed:**
- [ ] Choose strategy: A (Premium), B (Discount only), C (Hybrid)?
- [ ] Define peak times (which days/hours)?
- [ ] Set premium/discount percentages

#### Q2.2: Capacity-Based Pricing
Should price increase when KTV availability is low?

**Proposed Logic:**
- **High demand (>80% capacity booked):** +20% premium
- **Medium demand (50-80%):** Standard price
- **Low demand (<50%):** -10% discount to fill slots

**Questions:**
- [ ] Should we implement capacity-based pricing?
- [ ] How to calculate "capacity"? (KTVs available, rooms available, both?)
- [ ] What thresholds define high/medium/low demand?
- [ ] Should this stack with other discounts/premiums?

**Business Decision Needed:**
- [ ] Approve/reject capacity-based pricing
- [ ] Define capacity thresholds
- [ ] Set adjustment percentages

---

### Section 3: Early Bird & Last-Minute Pricing

#### Q3.1: Early Bird Discount
Should we reward customers who book in advance?

**Proposed Logic:**
- **7+ days in advance:** -5% discount
- **14+ days in advance:** -8% discount
- **30+ days in advance:** -10% discount

**Questions:**
- [ ] Should we offer early bird discounts?
- [ ] What advance booking periods? (7 days, 14 days, 30 days?)
- [ ] What discount percentages?
- [ ] Should this apply to ALL packages or only certain ones?

**Alternative:**
```
Option A (Tiered):
- 30+ days: -10%
- 14-29 days: -8%
- 7-13 days: -5%

Option B (Flat):
- 7+ days: -5% (simple, easy to communicate)

Option C (None):
- No early bird discount (customers book when they need service)
```

**Business Decision Needed:**
- [ ] Choose option: A, B, C?
- [ ] Set advance booking thresholds and discounts

#### Q3.2: Last-Minute Premium
Should we charge more for same-day bookings?

**Proposed Logic:**
- **Same-day booking:** +15% premium
- **Next-day booking:** +5% premium

**Questions:**
- [ ] Should we charge last-minute premium?
- [ ] Is this fair to customers? (Emergency bookings may be penalized)
- [ ] What % premium is acceptable?
- [ ] Should this only apply during high-demand periods?

**Considerations:**
- **PRO:** Discourages last-minute bookings, rewards planning
- **CON:** May lose spontaneous bookings, feels unfair to customers

**Business Decision Needed:**
- [ ] Approve/reject last-minute premium
- [ ] Set premium percentages
- [ ] Define when it applies (always vs high-demand only)

---

### Section 4: Promotional Campaigns

#### Q4.1: Active Promotion Periods
How to handle special promotional campaigns?

**Proposed Logic:**
- Create `promotions` table to track active campaigns
- When promotion is active, apply discount (e.g., "Summer Sale -20%")
- Promotion discount should have HIGHEST priority (overrides other rules)

**Questions:**
- [ ] Should promotional discount override ALL other rules?
- [ ] Or should it stack with VIP discount? (e.g., VIP + Promo = 30%)
- [ ] Who can create promotions? (Admin only, or branch managers?)
- [ ] Should promotions have limits? (Max uses per customer, total budget)

**Example Promotions:**
```
Promotion 1: "Lunar New Year Sale"
- Discount: 20%
- Period: Jan 20-Feb 5, 2027
- Limit: First 100 bookings only

Promotion 2: "Referral Bonus"
- Discount: 15%
- Condition: Referred by existing customer
- Limit: One per customer per year

Promotion 3: "Flash Sale"
- Discount: 30%
- Period: Today only (24 hours)
- Limit: First 50 bookings
```

**Business Decision Needed:**
- [ ] Approve promotion system
- [ ] Define stacking rules (override vs stack)
- [ ] Set promotion limits (budget, usage cap)

---

### Section 5: Revenue Target Incentives

#### Q5.1: End-of-Month Push Discount
Should we offer extra discounts to hit monthly revenue targets?

**Proposed Logic:**
```
IF (current_month_revenue < target * 80%) 
   AND (days_remaining_in_month <= 7)
THEN apply 12% discount
```

**Example:**
- Monthly target: 100M VND
- Current revenue (Day 23): 70M VND (70% of target)
- System automatically applies 12% discount for last 7 days to boost bookings

**Questions:**
- [ ] Should we implement auto-discount to hit targets?
- [ ] What % of target triggers discount? (80%? 75%?)
- [ ] What discount % to apply? (12%? 15%? 10%?)
- [ ] Should this be visible to customers? (Or silent internal strategy?)

**Concerns:**
- **Risk:** Customers may wait until end of month to get discount
- **Risk:** Revenue becomes front-loaded (all bookings early month)
- **Benefit:** Ensures consistent monthly revenue
- **Benefit:** Motivates bookings during slow periods

**Business Decision Needed:**
- [ ] Approve/reject revenue target incentives
- [ ] Set trigger threshold and discount %
- [ ] Decide on transparency (public vs internal)

---

### Section 6: Rule Conflicts & Stacking

#### Q6.1: Discount Stacking Rules
What happens when multiple discounts apply?

**Example Scenario:**
- Customer is VIP (-10%)
- Books 14 days in advance (-8%)
- During active promotion (-20%)
- On a weekend evening (+15%)

**Proposed Options:**

**Option A: Highest Discount Wins**
```
Apply only the best discount:
- Promo -20% (highest) → Final: -20%
- Ignore VIP -10%, Early Bird -8%
- Ignore Weekend +15%
```

**Option B: Stack All Discounts**
```
Add all discounts/premiums:
- VIP -10% + Early Bird -8% + Promo -20% + Weekend +15%
- Final: -23% (can lead to excessive discounts)
```

**Option C: Stack with Limits**
```
Stack discounts but cap at -30% max:
- VIP -10% + Early Bird -8% + Promo -20% = -38%
- Cap at -30% → Final: -30%
- Weekend +15% applies separately
```

**Option D: Category-Based Stacking**
```
Stack WITHIN categories, take best ACROSS categories:
- Customer tier: VIP -10%
- Time-based: Early Bird -8% (ignore weekend +15%)
- Promotional: -20%
- Stack: -10% + -8% + -20% = -38%, cap at -30%
```

**Business Decision Needed:**
- [ ] Choose stacking strategy: A, B, C, D, or custom?
- [ ] Set maximum total discount % (e.g., -30% cap)
- [ ] Define precedence order (which rules override others)

#### Q6.2: Premium & Discount Interaction
Can premiums cancel out discounts?

**Example:**
- VIP customer (-10% discount)
- Books same-day (+15% premium)
- Net: +5% premium? Or standard price?

**Options:**
```
Option A: Math it out
- -10% + 15% = +5% premium (VIP still pays premium)

Option B: Discounts always win
- VIP discount negates premium → Standard price

Option C: Premiums always win
- Premium overrides discount → +15% premium (VIP loses benefit)
```

**Business Decision Needed:**
- [ ] Choose interaction model: A, B, or C?

---

### Section 7: Price Transparency & Communication

#### Q7.1: Pricing Breakdown Display
Should customers see WHY they got a discount/premium?

**Proposed UI:**

```
┌─────────────────────────────────────┐
│ Package: Combo Mẹ & Bé VIP          │
│                                     │
│ Original Price:  1,500,000đ         │
│ VIP Discount:     -150,000đ (-10%)  │
│ Early Bird:       -120,000đ (-8%)   │
│ ─────────────────────────────────── │
│ Final Price:     1,230,000đ         │
│                                     │
│ 💡 You saved 270,000đ (18%)!        │
└─────────────────────────────────────┘
```

**Questions:**
- [ ] Should we show pricing breakdown to customers?
- [ ] Or just show final price? (Simpler but less transparent)
- [ ] Should we show premium reasons? ("Weekend premium +15%")
- [ ] Or hide premiums and just show higher price? (Avoids negative sentiment)

**Considerations:**
- **Transparency:** Customers appreciate knowing why they got a discount
- **Risk:** Showing premiums may cause complaints ("Why am I paying more?")
- **Gamification:** "You saved 270,000đ!" encourages booking

**Business Decision Needed:**
- [ ] Show full breakdown vs final price only
- [ ] Show discounts but hide premiums? (Asymmetric transparency)
- [ ] Use marketing language ("Premium time slot" vs "+15% surcharge")

---

### Section 8: Discount Limits & Guardrails

#### Q8.1: Minimum Price Floor
Should we prevent prices from going too low?

**Proposed Logic:**
```
Minimum price = 50% of original price

Example:
- Package base price: 1,000,000đ
- Customer qualifies for: VIP -10%, Early Bird -8%, Promo -20%, Off-peak -10%
- Total discount: -48%
- Final price WOULD BE: 520,000đ
- BUT floor is 500,000đ (50% of 1M)
- Final price: 500,000đ (capped)
```

**Questions:**
- [ ] Should we have a minimum price floor?
- [ ] What % floor? (50%? 60%? 70%?)
- [ ] Or fixed amount floor per package? (Package A min 500k, Package B min 1M)

**Business Decision Needed:**
- [ ] Set price floor % or amount
- [ ] Define per-package floors vs global %

#### Q8.2: Maximum Price Ceiling
Should we prevent prices from going too high?

**Proposed Logic:**
```
Maximum price = 150% of original price

Example:
- Package base price: 1,000,000đ
- Customer books: Last-minute +15%, Weekend +20%, High demand +20%
- Total premium: +55%
- Final price WOULD BE: 1,550,000đ
- BUT ceiling is 1,500,000đ (150% of 1M)
- Final price: 1,500,000đ (capped)
```

**Questions:**
- [ ] Should we have a maximum price ceiling?
- [ ] What % ceiling? (150%? 120%? 200%?)
- [ ] Or no ceiling? (Let market demand set price)

**Business Decision Needed:**
- [ ] Set price ceiling % or none
- [ ] Consider customer perception (too high = lose bookings)

---

## 📊 Recommended Default Configuration

Based on industry best practices and spa business models:

```yaml
customer_tiers:
  vip:
    threshold: 10_bookings_or_10M_ltv
    discount: 10%
  regular:
    discount: 0%
  new:
    discount: 15%
    limit: first_booking_only

time_based_pricing:
  early_bird:
    enabled: true
    threshold: 7_days
    discount: 5%
  off_peak:
    enabled: true
    times: ["08:00-11:00"]
    days: ["monday", "tuesday", "wednesday"]
    discount: 10%
  peak_premium:
    enabled: false  # ⚠️ Recommend disabling to avoid customer complaints
    
promotional:
  enabled: true
  priority: highest  # Overrides all other rules
  stackable: false   # Promo does NOT stack with other discounts

stacking_rules:
  max_total_discount: 30%
  discount_categories:
    - customer_tier    # VIP, Regular, New
    - time_based       # Early bird, Off-peak
    - promotional      # Active campaigns
  rule: stack_within_category_take_best_across_categories

price_guardrails:
  minimum_floor: 50%   # Never below 50% of original
  maximum_ceiling: 120% # Never above 120% of original

transparency:
  show_breakdown: true
  show_discounts: true
  show_premiums: false  # Hide premiums to avoid complaints
  show_savings: true    # "You saved 270,000đ!"
```

---

## ✅ Decision Checklist

Please review and approve/modify each item:

### Customer Strategy
- [ ] **Customer tier classification:** Simple (Option A) / LTV-based (Option B) / Recency (Option C) / Custom
- [ ] **VIP discount percentage:** 10% / _____% (specify)
- [ ] **New customer discount:** 15% / _____% (specify)
- [ ] **VIP threshold:** 10 bookings or 10M LTV / _____ (specify)

### Time-Based Pricing
- [ ] **Peak premium:** Enable / Disable / Conditional
- [ ] **Weekend premium:** +20% / _____% / None
- [ ] **Off-peak discount:** -10% / _____% / None
- [ ] **Early bird discount:** -5% (7 days) / Tiered / None
- [ ] **Last-minute premium:** +15% / _____% / None

### Promotional
- [ ] **Promotion system:** Enable / Disable
- [ ] **Promotion priority:** Highest (overrides all) / Stack with others
- [ ] **Promotion limits:** Budget cap / Usage cap / None

### Revenue Targets
- [ ] **Auto-discount for targets:** Enable / Disable
- [ ] **Trigger threshold:** 80% of target / _____% (specify)
- [ ] **End-of-month discount:** -12% / _____% (specify)

### Rule Stacking
- [ ] **Stacking strategy:** Highest wins / Stack all / Stack with cap / Category-based
- [ ] **Maximum total discount:** -30% / _____% (specify)
- [ ] **Premium-discount interaction:** Math it out / Discounts win / Premiums win

### Transparency
- [ ] **Show pricing breakdown:** Yes / No
- [ ] **Show premium reasons:** Yes / No / Only for discounts
- [ ] **Marketing language:** Use positive framing ("Premium slot") / Transparent ("Surcharge")

### Guardrails
- [ ] **Minimum price floor:** 50% / _____% / None
- [ ] **Maximum price ceiling:** 120% / _____% / None

---

## 📅 Review Meeting Agenda

**Suggested Meeting Structure:**

1. **Introduction (5 min):** Explain dynamic pricing objectives
2. **Customer Tiers (15 min):** Decide classification and discounts
3. **Time-Based Pricing (20 min):** Peak/off-peak strategy
4. **Promotions (10 min):** Campaign rules
5. **Stacking Rules (15 min):** How to handle multiple discounts
6. **Transparency (10 min):** What to show customers
7. **Guardrails (5 min):** Min/max price limits
8. **Next Steps (5 min):** Assign action items

**Total Time:** 1.5 hours

---

## 📝 Sign-Off

Once reviewed and approved, please sign below:

**Business Team Representative:**  
Name: _______________________  
Title: _______________________  
Date: _______________________  
Signature: ___________________

**Operations Manager:**  
Name: _______________________  
Date: _______________________  
Signature: ___________________

**CTO/Technical Lead:**  
Name: _______________________  
Date: _______________________  
Signature: ___________________

---

## 🔄 Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Jun 22, 2026 | Initial draft | Platform Team |
|     |              |                |                |

---

**Next Steps After Approval:**
1. Implementation team creates technical specification based on approved rules
2. Pricing policy coded into Decision Engine
3. Unit tests written for each rule
4. Shadow mode testing (2 weeks)
5. A/B test (1 week)
6. Full rollout

---

**Related Documents:**
- [Current State Analysis](./BOOKING_PRICING_CURRENT_STATE_ANALYSIS.md)
- [Integration Plan](./BOOKING_PRICING_INTEGRATION.md)
- [Strategic Roadmap](../BELLA_EIP_STRATEGIC_ROADMAP.md)

---

**Status:** 📋 **AWAITING BUSINESS REVIEW**

