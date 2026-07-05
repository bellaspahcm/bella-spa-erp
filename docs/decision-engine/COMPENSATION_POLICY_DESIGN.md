# Compensation Policy Design (Cross-Industry)

> **Core Principle**: Engine doesn't know about "sessions", "sales", or "deals".  
> Engine only knows about **Rewards**, **Multipliers**, **Caps**, and **Constraints**.

---

## 🎯 Strategic Goal

Build a **universal compensation model** that works for:
- Spa & Beauty (session rewards, service fees)
- Retail (sales commission, product margins)
- Real Estate (deal commission, listing fees)
- Manufacturing (production bonus, quality rewards)
- Logistics (delivery incentive, performance bonus)
- Healthcare (procedure fees, patient volume)
- Consulting (project fees, hourly rates)

**Key Insight:**
> "Decision Engine doesn't care what industry you're in.  
> It only cares about: What activity triggers reward? How much? Under what conditions?"

---

## 🏗️ Compensation Model Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Compensation Policy                        │
│                  (Industry-Agnostic)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Components                         │
│                                                              │
│  ┌───────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Reward   │  │ Multiplier │  │ Penalty  │  │  Cap    │ │
│  │ (What)    │  │ (Boost)    │  │ (Reduce) │  │ (Limit) │ │
│  └───────────┘  └────────────┘  └──────────┘  └─────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Industry Mappings                         │
│                                                              │
│  Spa           Retail         Real Estate    Manufacturing  │
│  ─────────     ──────────     ────────────   ────────────   │
│  Sessions  →   Sales      →   Deals      →   Units         │
│  Rating    →   Margin     →   Price      →   Quality       │
│  Packages  →   Categories →   Property   →   Batch Size    │
│                                                              │
│  Same Engine → Different Metrics → Platform Proven          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 Component Definitions

### 1. **Reward** (Base Compensation)

What the employee/agent earns for performing an activity.

**Formula:**
```
Reward = ActivityCount × BaseRate × ActivityMultiplier
```

**Examples:**
- **Spa**: 15 sessions × 150,000đ × VIP(2.0x) = 4,500,000đ
- **Retail**: 50M sales × 5% commission = 2,500,000đ
- **Real Estate**: 3 deals × 2M fixed = 6,000,000đ
- **Manufacturing**: 1,000 units × 5,000đ = 5,000,000đ

**Abstraction:**
```typescript
interface RewardComponent {
  activityMetric: string;      // 'sessions' | 'sales' | 'deals' | 'units'
  activityCount: number;        // How many
  baseRate: number;             // Rate per unit
  activityMultiplier?: number;  // Quality factor (VIP, Premium, etc.)
}
```

---

### 2. **Multiplier** (Performance Boost)

Increases reward based on performance factors.

**Types:**
- **Position Multiplier**: Senior/Lead/Manager (1.2x, 1.5x, 2.0x)
- **Performance Multiplier**: Rating, Quality Score, CSAT (1.1x, 1.15x, 1.2x)
- **Tier Multiplier**: Volume thresholds (>50M = 1.1x, >100M = 1.2x)

**Formula:**
```
FinalReward = BaseReward × PositionMultiplier × PerformanceMultiplier
```

**Examples:**
- **Spa**: 3M base × Senior(1.2x) × Rating4.8(1.15x) = 4,140,000đ
- **Real Estate**: 10M base × Lead(1.5x) × TopPerformer(1.2x) = 18,000,000đ
- **Manufacturing**: 5M base × Manager(2.0x) × QualityA+(1.2x) = 12,000,000đ

**Abstraction:**
```typescript
interface MultiplierComponent {
  type: 'position' | 'performance' | 'tier' | 'team';
  factorValue: number;          // The score/rating/level
  multiplier: number;           // The boost (e.g., 1.2x)
  appliesTo: 'base' | 'specific'; // What gets boosted
}
```

---

### 3. **Incentive** (Goal-Based Bonus)

Additional bonus for achieving specific goals/thresholds.

**Types:**
- **Volume Incentive**: Reach sales target (>100M → +3M bonus)
- **Quality Incentive**: Zero defects → +1M bonus
- **Team Incentive**: Team lead gets % of team total (0.5% or 1%)

**Formula:**
```
Incentive = IF (metric >= threshold) THEN bonusAmount
```

**Examples:**
- **Spa**: Sessions > 50 → +1M bonus
- **Retail**: Sales > 200M → +3M bonus
- **Real Estate**: Deals > 10 → +5M bonus
- **Manufacturing**: Defect rate < 0.5% → +2M bonus

**Abstraction:**
```typescript
interface IncentiveComponent {
  goalMetric: string;           // 'sales' | 'sessions' | 'quality'
  threshold: number;            // Minimum to achieve
  bonusAmount: number;          // Fixed bonus
  bonusRate?: number;           // OR percentage bonus
}
```

---

### 4. **Penalty** (Reduction)

Reduces compensation for violations/underperformance.

**Types:**
- **Quality Penalty**: Low rating, high defect rate
- **Compliance Penalty**: Late submissions, missed deadlines
- **Min Threshold**: Didn't meet minimum activity (e.g., < 5 sessions → 0 reward)

**Formula:**
```
FinalReward = BaseReward - Penalty
```

**Examples:**
- **Spa**: Rating < 4.0 → -500k penalty
- **Manufacturing**: Defect > 5% → -1M penalty
- **Logistics**: Late delivery → -300k penalty

**Abstraction:**
```typescript
interface PenaltyComponent {
  violationMetric: string;      // 'rating' | 'defect_rate' | 'late_days'
  threshold: number;            // When penalty applies
  penaltyAmount: number;        // Fixed penalty
  penaltyRate?: number;         // OR percentage penalty
}
```

---

### 5. **Cap** (Upper Limit)

Prevents excessive compensation in a single period.

**Types:**
- **Period Cap**: Max compensation per month (e.g., 50M/month)
- **Item Cap**: Max per transaction (e.g., 5M per deal)
- **Component Cap**: Max per component (e.g., max 20M commission)

**Formula:**
```
FinalReward = MIN(CalculatedReward, CapAmount)
```

**Examples:**
- **Spa**: Max 20M commission/month
- **Real Estate**: Max 10M per single deal
- **Retail**: Max 15M sales commission/month

**Abstraction:**
```typescript
interface CapComponent {
  capType: 'period' | 'item' | 'component';
  maxAmount: number;            // Upper limit
  scope: 'total' | 'session' | 'service' | 'product';
}
```

---

### 6. **Floor** (Lower Limit)

Ensures minimum compensation even with low activity.

**Types:**
- **Min Guarantee**: Minimum monthly compensation (e.g., 2M/month)
- **Min Per Activity**: Minimum per transaction (e.g., 100k per session)
- **Min Threshold**: Must meet minimum to qualify (e.g., >= 5 sessions)

**Formula:**
```
FinalReward = MAX(CalculatedReward, FloorAmount)
```

**Examples:**
- **Spa**: Min 2M/month even with 0 sessions
- **Real Estate**: Min 5M/month base
- **Logistics**: Min 100k per delivery

**Abstraction:**
```typescript
interface FloorComponent {
  floorType: 'period' | 'activity' | 'threshold';
  minAmount: number;            // Lower limit
  condition?: string;           // When floor applies
}
```

---

## 🎨 Universal Compensation Formula

```
TotalCompensation = 
  ( BaseReward × PositionMultiplier × PerformanceMultiplier )
  + Incentives
  + TeamBonus
  - Penalties
  
  THEN apply:
  - Floor (minimum)
  - Cap (maximum)
```

---

## 🌍 Industry Mappings (Examples)

### Spa & Beauty
```typescript
{
  activityMetric: 'sessions',
  baseRate: 150000,
  activityMultiplier: packageMultiplier, // Basic 1.0x, VIP 2.0x
  performanceMetric: 'avgRating',
  goalMetric: 'sessionsCount',
  threshold: 50,
}
```

### Retail
```typescript
{
  activityMetric: 'sales',
  baseRate: 0.05, // 5% commission
  performanceMetric: 'margin',
  goalMetric: 'totalSales',
  threshold: 100000000, // 100M
}
```

### Real Estate
```typescript
{
  activityMetric: 'deals',
  baseRate: 2000000, // 2M per deal
  activityMultiplier: propertyTierMultiplier, // Luxury 1.5x
  performanceMetric: 'closingRate',
  goalMetric: 'dealsCount',
  threshold: 10,
}
```

### Manufacturing
```typescript
{
  activityMetric: 'unitsProduced',
  baseRate: 5000, // 5k per unit
  performanceMetric: 'qualityScore',
  goalMetric: 'outputVolume',
  threshold: 1000, // 1k units
}
```

**Key Point:**
> Same compensation engine.  
> Only the **metric names** and **thresholds** change.  
> That's a platform.

---

## 🔑 Why This Matters

### For CTO:
> "We don't have a 'Spa Commission Calculator.'  
> We have a **Universal Compensation Engine** that Spa happens to use."

### For Investors:
> "When we sign a Retail client, we don't build new features.  
> We just **map their metrics** to our engine. 2 hours, not 2 months."

### For Partners:
> "Your industry has unique commission structures?  
> No problem. Map your metrics to our **Compensation Policy** model. Done."

---

## 🚀 Implementation Strategy

### Phase 2A: Abstract Model (This Document) ✅
- Define universal compensation components
- Document industry mappings
- Establish naming conventions

### Phase 2B: Compensation Rules
- Implement rules using abstract model
- Use generic field names (activityMetric, not "sessions")
- Cross-industry examples

### Phase 2C: Compensation Provider
- Service that applies rules
- Returns breakdown (reward + multipliers + incentives - penalties)
- Industry-agnostic calculation

### Phase 2D: Industry Adapters
- `SpaCompensationAdapter`: Maps Spa data → Compensation model
- `RetailCompensationAdapter`: Maps Retail data → Compensation model
- `RealEstateCompensationAdapter`: Maps RE data → Compensation model

---

## 📊 Success Criteria

- [ ] Same provider calculates: Spa, Retail, Real Estate, Manufacturing
- [ ] No industry-specific logic in provider
- [ ] Industry differences = configuration, not code
- [ ] Adding new industry = create adapter (< 2 hours)
- [ ] CTO sees: "Universal Compensation Engine", not "Spa Commission"

---

**Status**: Design complete. Ready for implementation.

**Next**: Build Compensation Rules using this abstract model.
