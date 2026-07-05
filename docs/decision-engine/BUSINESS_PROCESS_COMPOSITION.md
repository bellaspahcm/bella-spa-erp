# Business Process Composition

> **Critical Insight**: Bella EIP doesn't have "modules". Bella EIP has a **Business Policy Language** where every business process is composed from independent policies.

---

## The Platform Shift

### ❌ OLD: Module-Based Thinking
```
Payroll Module
  └─ Payroll Engine
      └─ Calculate salary (monolithic)

Booking Module
  └─ Booking Engine
      └─ Create booking (monolithic)

Procurement Module
  └─ Procurement Engine
      └─ Create purchase order (monolithic)
```

**Problem**: Each module is a silo. Adding new industry = rewrite everything.

### ✅ NEW: Policy Composition Thinking
```
Employee Context
        │
        ▼
┌──────────────────┐
│ Base Salary      │ ← Policy 1
└──────────────────┘
        +
┌──────────────────┐
│ Reward Policy    │ ← Policy 2
└──────────────────┘
        +
┌──────────────────┐
│ Penalty Policy   │ ← Policy 3
└──────────────────┘
        +
┌──────────────────┐
│ Constraint       │ ← Policy 4
└──────────────────┘
        ▼
  Payroll Result
```

**Benefit**: Same policies work for Spa, Retail, Manufacturing, Real Estate.

---

## What This Proves

### 1. **Platform Capability**
A business process (Payroll) is NOT a module. It's a **composition** of policies.

### 2. **Cross-Industry Reusability**
The same `RewardPolicy` works for:
- Spa: Session commission
- Retail: Sales commission
- Real Estate: Deal commission
- Manufacturing: Production bonus

### 3. **Plugin Architecture**
Adding a new industry doesn't change the engine. Just register policies:
```typescript
registerPolicy('RewardPolicy', HospitalAdapter)
registerPolicy('PenaltyPolicy', HospitalAdapter)
// Done. Hospital Payroll works.
```

### 4. **Composability**
Policies are independent. They can:
- Run in any order (for independent policies)
- Run in parallel
- Be added/removed without affecting others
- Have their own versioning

---

## Business Process Examples

### Payroll Process
```
┌─────────────────────────────────────────────┐
│ PAYROLL BUSINESS PROCESS                    │
├─────────────────────────────────────────────┤
│ 1. Base Salary Policy                       │
│    → Calculate pro-rata, position adj       │
│                                              │
│ 2. Reward Policy (Compensation)             │
│    → Activity + Value + Sales rewards       │
│                                              │
│ 3. Penalty Policy (Attendance)              │
│    → Late penalties, absent deductions      │
│                                              │
│ 4. Constraint Policy                        │
│    → Min floor, Max cap                     │
│                                              │
│ 5. Eligibility Policy                       │
│    → Contract type, Probation status        │
│                                              │
│ 6. Approval Policy                          │
│    → Manager review, HR approval            │
└─────────────────────────────────────────────┘
        ▼
   Payroll Result
```

### Booking Process (Future)
```
┌─────────────────────────────────────────────┐
│ BOOKING BUSINESS PROCESS                    │
├─────────────────────────────────────────────┤
│ 1. Eligibility Policy                       │
│    → Customer status, Available slots       │
│                                              │
│ 2. Recommendation Policy                    │
│    → Suggest packages, Suggest KTV          │
│                                              │
│ 3. Approval Policy                          │
│    → Auto-approve or Manager review         │
│                                              │
│ 4. Constraint Policy                        │
│    → Max bookings per day, Blackout dates   │
└─────────────────────────────────────────────┘
        ▼
   Booking Result
```

### Procurement Process (Future)
```
┌─────────────────────────────────────────────┐
│ PROCUREMENT BUSINESS PROCESS                │
├─────────────────────────────────────────────┤
│ 1. Validation Policy                        │
│    → Budget check, Inventory check          │
│                                              │
│ 2. Approval Policy                          │
│    → Manager → Director → CFO               │
│                                              │
│ 3. Escalation Policy                        │
│    → Auto-escalate if > 50M                 │
│                                              │
│ 4. Constraint Policy                        │
│    → Max amount per vendor                  │
└─────────────────────────────────────────────┘
        ▼
  Purchase Order
```

---

## Policy Independence

**Key Rule**: Each policy MUST be independent.

### Good (Independent Policies)
```typescript
// Policy A: Base Salary
const baseSalary = calculateBaseSalary(context);

// Policy B: Reward (doesn't depend on Policy A's result)
const reward = calculateReward(context);

// Aggregate
const total = baseSalary + reward;
```

### Bad (Coupled Policies)
```typescript
// Policy A: Base Salary
const baseSalary = calculateBaseSalary(context);

// Policy B: Reward (depends on Policy A's output)
const reward = baseSalary * 0.1; // ❌ COUPLED!
```

**Why it matters**: Independent policies can run in parallel, be tested separately, and be reused across processes.

---

## Implementation Plan

### Phase 2.1: Process Executor ⭐⭐⭐⭐⭐
Create a `BusinessProcess` that composes multiple policies:

```typescript
interface BusinessProcess {
  name: string;
  policies: PolicyProvider[];
  
  execute(context: DecisionContext): Promise<ProcessResult>;
}

class PayrollProcess implements BusinessProcess {
  name = 'PayrollProcess';
  
  policies = [
    new BaseSalaryProvider(),
    new CompensationProvider(),
    new AttendanceProvider(), // Penalty
    new ConstraintProvider(),
  ];
  
  async execute(context: PayrollDecisionContext): Promise<PayrollResult> {
    // Compose policy results
    const results = await Promise.all(
      this.policies.map(p => p.evaluate(context))
    );
    
    return this.aggregate(results);
  }
}
```

### Phase 2.2: Composition Tests ⭐⭐⭐⭐⭐
Prove that policies compose correctly:

```typescript
describe('Business Process Composition', () => {
  it('should compose Base Salary + Compensation', async () => {
    const process = new PayrollProcess();
    const result = await process.execute(context);
    
    // Verify both policies ran
    expect(result.components).toHaveLength(2);
    expect(result.total).toBe(baseSalary + compensation);
  });
  
  it('should execute policies independently', async () => {
    // Policy A failure shouldn't affect Policy B
  });
  
  it('should aggregate results correctly', async () => {
    // Total = sum of all policy results
  });
  
  it('should execute in < 100ms for 5 policies', async () => {
    // Performance check
  });
});
```

### Phase 2.3: Parallel Execution ⭐⭐⭐⭐
Prove that independent policies can run in parallel:

```typescript
// Sequential (OLD)
const baseSalary = await provider1.evaluate(context);
const compensation = await provider2.evaluate(context);
// Time: 50ms + 30ms = 80ms

// Parallel (NEW)
const [baseSalary, compensation] = await Promise.all([
  provider1.evaluate(context),
  provider2.evaluate(context),
]);
// Time: max(50ms, 30ms) = 50ms
```

### Phase 2.4: Dependency Graph (Optional)
For policies with dependencies:

```typescript
const graph = new PolicyDependencyGraph();
graph.addPolicy('BaseSalary', []);
graph.addPolicy('Compensation', []);
graph.addPolicy('Constraint', ['BaseSalary', 'Compensation']); // Depends on both

await graph.executeTopological(context);
// Executes in order: BaseSalary + Compensation → Constraint
```

---

## Success Criteria

### ✅ Technical Proof
- [ ] Multiple policies compose into a process
- [ ] Policies run independently (no side effects)
- [ ] Results aggregate correctly
- [ ] Performance < 100ms for 5 policies
- [ ] Policies can run in parallel

### ✅ Business Proof
- [ ] Same policies work for different contexts
- [ ] Adding new policy doesn't break existing ones
- [ ] Removing policy doesn't break process
- [ ] Process can be visualized (policy composition diagram)

### ✅ Platform Proof
- [ ] Process is NOT hardcoded
- [ ] Process is configurable
- [ ] Process can be versioned
- [ ] Process can be audited (which policies applied)

---

## Stakeholder Message

After this phase, you can say:

> "Bella EIP doesn't have a Payroll Module.  
> Bella EIP has a Business Process Composition Engine.  
>   
> Payroll is just `RewardPolicy + PenaltyPolicy + ConstraintPolicy`.  
> Booking is just `EligibilityPolicy + RecommendationPolicy + ApprovalPolicy`.  
> Procurement is just `ValidationPolicy + ApprovalPolicy + EscalationPolicy`.  
>   
> The engine is the same. Only the policy composition changes."

This is the **Platform value proposition**.

---

## Files to Create

1. `src/lib/business-process/types.ts` - Process interfaces
2. `src/lib/business-process/executor.ts` - Process executor
3. `src/lib/business-process/payroll-process.ts` - Example process
4. `src/__tests__/business-process/composition.test.ts` - Composition tests
5. `docs/decision-engine/PROCESS_COMPOSITION_PROOF.md` - Evidence document

---

**Next Action**: Create the `BusinessProcess` infrastructure and prove composition works.
