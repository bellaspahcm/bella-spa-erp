# Business Policy Language (BPL)

> **Vision**: A universal language for expressing business policies across all domains.
> 
> **Goal**: Any business domain (Payroll, Booking, Procurement, Manufacturing, CRM) can express its policies using the same policy types and composition rules.

**Status**: Foundation Document (v0.1)  
**Author**: Bella EIP Architecture Team  
**Last Updated**: 2026-06-22

---

## 🎯 Strategic Purpose

### Why a Universal Policy Language?

Most ERP systems build domain-specific logic:
- **Payroll Module** → Hardcoded salary calculations
- **Booking Module** → Hardcoded availability rules
- **Procurement Module** → Hardcoded approval workflows

**Problem**: When you add a new industry (Retail, Manufacturing, Healthcare), you rebuild everything.

**Bella EIP Solution**: Build a **universal policy language** once. Then:
- Spa = Map policies to Spa domain
- Retail = Map policies to Retail domain
- Manufacturing = Map policies to Manufacturing domain
- **Engine stays the same.**

---

## 🏗️ Core Policy Types

### 1. **Reward Policy**
What the user/employee **gets** for performing activities.

**Formula:**
```
Reward = ActivityCount × BaseRate × Multipliers
```

**Examples:**
- **Payroll**: KTV gets 150k per session
- **Loyalty**: Customer gets 100 points per booking
- **Referral**: Agent gets 500k per successful referral
- **Manufacturing**: Worker gets 5k per unit produced

**Attributes:**
```typescript
interface RewardPolicy {
  policyId: string;
  name: string;
  activityMetric: string;      // What triggers reward
  baseRate: number;             // Rate per unit
  multipliers?: Multiplier[];   // Optional boosts
  constraints?: Constraint[];   // Min/max limits
}
```

---

### 2. **Penalty Policy**
What the user/employee **loses** for violations or underperformance.

**Formula:**
```
Penalty = ViolationCount × PenaltyRate
```

**Examples:**
- **Payroll**: -50k per late day
- **Quality**: -1M for defect rate > 5%
- **SLA**: -500k per missed deadline
- **Compliance**: -2M for safety violation

**Attributes:**
```typescript
interface PenaltyPolicy {
  policyId: string;
  name: string;
  violationMetric: string;      // What triggers penalty
  penaltyRate: number;          // Rate per violation
  threshold: number;            // When penalty applies
  constraints?: Constraint[];   // Max penalty limits
}
```

---

### 3. **Multiplier Policy**
Performance factors that **boost or reduce** base amounts.

**Formula:**
```
FinalAmount = BaseAmount × Multiplier
```

**Examples:**
- **Payroll**: Senior position = 1.2x
- **Pricing**: VIP customer = 0.9x discount
- **Shipping**: Urgent = 1.5x cost
- **Manufacturing**: Night shift = 1.3x rate

**Attributes:**
```typescript
interface MultiplierPolicy {
  policyId: string;
  name: string;
  factorMetric: string;         // What determines multiplier
  multiplierTable: Record<string | number, number>;
  appliesTo: 'all' | 'specific'; // What gets multiplied
}
```

---

### 4. **Incentive Policy**
Goal-based bonuses for achieving **thresholds**.

**Formula:**
```
Incentive = IF (metric >= threshold) THEN bonusAmount
```

**Examples:**
- **Payroll**: Sales > 100M → +3M bonus
- **Marketing**: Conversion > 20% → +500k budget
- **Operations**: Uptime > 99% → +1M bonus
- **Customer Success**: Retention > 95% → +2M bonus

**Attributes:**
```typescript
interface IncentivePolicy {
  policyId: string;
  name: string;
  goalMetric: string;           // What is measured
  thresholds: Array<{
    threshold: number;
    bonusAmount: number;
  }>;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}
```

---

### 5. **Eligibility Policy**
Determines **who** can perform an action or **what** qualifies.

**Formula:**
```
Eligible = ALL(conditions) OR ANY(conditions)
```

**Examples:**
- **Booking**: Customer can book if: status = 'active' AND balance >= 0
- **Approval**: Manager can approve if: amount < 50M AND department match
- **Discount**: Customer eligible if: tier = 'vip' OR bookings > 10
- **Loan**: Applicant eligible if: creditScore > 700 AND income > 30M

**Attributes:**
```typescript
interface EligibilityPolicy {
  policyId: string;
  name: string;
  conditions: Condition[];      // Must satisfy
  logic: 'all' | 'any';         // AND or OR
  outcome: 'approve' | 'reject' | 'escalate';
}
```

---

### 6. **Approval Policy**
Determines **who must approve** and **routing logic**.

**Formula:**
```
Approval = IF (amount < threshold) THEN approverLevel
```

**Examples:**
- **Procurement**: < 10M → Manager, < 50M → Director, >= 50M → CEO
- **Expense**: < 5M → Team Lead, < 20M → Department Head, >= 20M → CFO
- **Discount**: < 10% → Auto, < 20% → Manager, >= 20% → Director
- **Contract**: < 100M → Sales Director, >= 100M → CEO

**Attributes:**
```typescript
interface ApprovalPolicy {
  policyId: string;
  name: string;
  approvalTiers: Array<{
    threshold: number;
    approverRole: string;
    requiredCount?: number;     // e.g., 2 out of 3 must approve
  }>;
  timeoutAction: 'escalate' | 'reject' | 'autoApprove';
  timeoutDuration: number;      // In hours
}
```

---

### 7. **Recommendation Policy**
Suggests **optimal choices** based on context.

**Formula:**
```
Recommendation = RANK(options BY score DESC)
```

**Examples:**
- **Booking**: Recommend KTV based on rating, availability, customer preference
- **Upsell**: Recommend packages based on purchase history
- **Staffing**: Recommend employees based on skills, availability, performance
- **Inventory**: Recommend reorder quantity based on demand forecast

**Attributes:**
```typescript
interface RecommendationPolicy {
  policyId: string;
  name: string;
  rankingFactors: Array<{
    factor: string;
    weight: number;
  }>;
  maxRecommendations: number;
  confidenceThreshold: number;  // Min confidence to show
}
```

---

### 8. **Validation Policy**
Ensures data/actions meet **quality standards**.

**Formula:**
```
Valid = ALL(validationRules)
```

**Examples:**
- **Order**: Total must match sum of items
- **Payroll**: Total salary must not exceed budget
- **Inventory**: Stock count must be non-negative
- **Quality**: Defect rate must be < 2%

**Attributes:**
```typescript
interface ValidationPolicy {
  policyId: string;
  name: string;
  validationRules: Array<{
    field: string;
    operator: string;
    value: any;
    errorMessage: string;
  }>;
  severity: 'error' | 'warning' | 'info';
}
```

---

### 9. **Escalation Policy**
Determines **when** and **to whom** to escalate issues.

**Formula:**
```
Escalate = IF (condition) THEN escalateTo
```

**Examples:**
- **Support**: Ticket unresolved > 24h → Escalate to Manager
- **Quality**: Defect rate > 5% → Escalate to Quality Director
- **SLA**: Delivery delayed > 48h → Escalate to Operations VP
- **Compliance**: Audit finding → Escalate to Legal

**Attributes:**
```typescript
interface EscalationPolicy {
  policyId: string;
  name: string;
  triggerConditions: Condition[];
  escalationTiers: Array<{
    delay: number;              // In hours
    escalateTo: string;         // Role or person
    notification: string;       // Message template
  }>;
}
```

---

### 10. **Constraint Policy**
Enforces **limits** (min/max, floor/cap).

**Formula:**
```
Constrained = MIN(MAX(value, floor), cap)
```

**Examples:**
- **Payroll**: Salary must be >= 5M (floor) and <= 50M (cap)
- **Discount**: Discount must be >= 0% and <= 30%
- **Inventory**: Reorder when stock < 100 units (floor)
- **Budget**: Department spending must be <= allocated budget (cap)

**Attributes:**
```typescript
interface ConstraintPolicy {
  policyId: string;
  name: string;
  constraintType: 'min' | 'max' | 'range' | 'threshold';
  minValue?: number;
  maxValue?: number;
  violationAction: 'reject' | 'cap' | 'escalate' | 'warn';
}
```

---

## 🎨 Policy Composition

Policies **compose** to form complete business logic.

### Example 1: Payroll Compensation
```
Compensation = 
  Reward (sessions, services, sales)
  + Multiplier (position, performance)
  + Incentive (volume goals)
  - Penalty (late, absent)
  
  THEN apply:
  - Constraint (min floor, max cap)
```

### Example 2: Booking Eligibility
```
Booking =
  Eligibility (customer active, balance OK)
  + Recommendation (suggest best KTV)
  + Approval (auto if < 5M, manager if >= 5M)
```

### Example 3: Procurement Request
```
Procurement =
  Validation (total matches items, vendor approved)
  + Approval (manager → director → CEO)
  + Escalation (if delayed > 48h)
```

### Example 4: Manufacturing Quality
```
Quality =
  Validation (defect rate < 2%)
  + Reward (bonus for 0 defects)
  + Penalty (fine for > 5% defects)
  + Escalation (if rate > 10%, escalate to QA director)
```

---

## 📊 Policy Metadata

Every policy has metadata for discoverability, versioning, and governance.

```typescript
interface PolicyMetadata {
  policyId: string;
  name: string;
  version: string;              // e.g., "1.2.0"
  domain: string;               // 'payroll' | 'booking' | 'procurement' | ...
  policyType: PolicyType;       // 'reward' | 'approval' | ...
  priority: number;             // Execution order
  tags: string[];               // For filtering
  owner: string;                // Who maintains it
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'deprecated';
  dependencies?: string[];      // Other policies it depends on
  applicableIndustries: string[]; // Which industries can use it
}
```

---

## 🔄 Policy Lifecycle

```
Draft → Review → Active → Deprecated
```

1. **Draft**: Policy is being designed
2. **Review**: Under approval by business stakeholders
3. **Active**: Live in production
4. **Deprecated**: Replaced by newer version

**Versioning**: Policies follow semantic versioning (1.2.3)
- Major: Breaking changes (e.g., formula change)
- Minor: New features (e.g., new constraint added)
- Patch: Bug fixes (e.g., threshold corrected)

---

## 🌍 Cross-Industry Mapping

### Spa Industry
```yaml
Payroll:
  - Reward: Session commission, service fees
  - Multiplier: Position (senior 1.2x), Rating (4.5+ = 1.1x)
  - Incentive: Volume bonus (>50 sessions = +1M)
  - Penalty: Late (-50k/day), Low rating (<4.0 = -500k)
  - Constraint: Min 5M, Max 20M per month

Booking:
  - Eligibility: Customer active, balance >= 0
  - Recommendation: KTV by rating + availability
  - Approval: Auto if < 5M, manager if >= 5M
```

### Retail Industry
```yaml
Sales Compensation:
  - Reward: Sales commission (5% of total)
  - Multiplier: Product category (premium 1.5x), Margin (>20% = 1.2x)
  - Incentive: Monthly goal (>200M = +3M)
  - Constraint: Max 15M per month

Discount Approval:
  - Eligibility: Customer tier (VIP, Loyal, Regular)
  - Approval: <10% auto, <20% manager, >=20% director
  - Validation: Discount <= max allowed
```

### Real Estate Industry
```yaml
Agent Commission:
  - Reward: Deal commission (2% of transaction)
  - Multiplier: Property tier (luxury 1.5x), Lead (1.5x)
  - Incentive: Quarterly goal (>10 deals = +5M)
  - Constraint: Max 10M per deal

Listing Approval:
  - Validation: Property details complete, Photos uploaded
  - Approval: <5B auto, >=5B broker approval
```

### Manufacturing Industry
```yaml
Production Bonus:
  - Reward: Output bonus (5k per unit)
  - Multiplier: Quality score (>95% = 1.2x), Shift (night 1.3x)
  - Incentive: Zero defects (+2M)
  - Penalty: Defect rate >5% (-1M)
  - Escalation: Defect >10% → QA Director

Quality Control:
  - Validation: Defect rate <2%
  - Penalty: >5% defects = fine
  - Escalation: >10% = escalate immediately
```

---

## 🤖 Future: AI Integration

Business Policy Language is designed for **AI augmentation**.

### AI-Enhanced Policies

```typescript
interface AIEnhancedPolicy extends BasePolicy {
  mlModel?: {
    modelType: 'recommendation' | 'prediction' | 'classification';
    modelId: string;
    confidenceThreshold: number;
    fallbackPolicy: string;      // If AI unavailable
  };
}
```

### Examples:

**AI Recommendation Policy:**
```
Recommend KTV for booking
├── ML Model: predicts customer-KTV match score
├── Confidence > 80% → Use AI recommendation
└── Confidence < 80% → Fallback to rule-based (rating + availability)
```

**AI Approval Policy:**
```
Approve discount request
├── ML Model: predicts profitability impact
├── High profit → Auto-approve
├── Medium profit → Manager approval
└── Low profit → Reject
```

**AI Escalation Policy:**
```
Escalate quality issue
├── ML Model: predicts defect severity
├── Critical → Immediate escalation
├── High → 4h escalation
└── Medium → 24h escalation
```

---

## 🎯 Success Criteria

A successful Business Policy Language enables:

- [ ] **Single Policy Definition** works across industries
- [ ] **Policy Composition** (combine policies for complex logic)
- [ ] **Policy Versioning** (track changes, rollback if needed)
- [ ] **Policy Discovery** (search/filter by domain, type, tags)
- [ ] **Industry Adaptation** (map same policy to different industries)
- [ ] **AI Integration** (ML models enhance policy decisions)
- [ ] **No Code Changes** when adding new policy instances
- [ ] **Dashboard Visibility** (admin sees all active policies)

---

## 📚 Next Steps

### Phase 1: Foundation (Current)
- [x] Define 10 core policy types
- [ ] Implement PolicyMetadata schema
- [ ] Create PolicyRegistry
- [ ] Build first policy example (Compensation)

### Phase 2: Composition
- [ ] Policy composition engine
- [ ] Policy dependency resolution
- [ ] Policy execution order (by priority)

### Phase 3: Multi-Industry
- [ ] Spa policy mappings
- [ ] Retail policy mappings
- [ ] Real Estate policy mappings
- [ ] Manufacturing policy mappings

### Phase 4: AI Integration
- [ ] ML model integration interface
- [ ] Fallback strategies
- [ ] Confidence thresholds

---

**Status**: Foundation complete. Ready for implementation.

**Key Message**:
> "Bella EIP doesn't have modules.  
> Bella EIP has a **Business Policy Language** that any domain can use."

That's a platform.
