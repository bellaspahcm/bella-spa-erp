# Phase 2.2 + 3.1: Visual Rule Builder + Natural Language Preview
## Implementation Plan (Integrated)

**Date:** 2026-07-10  
**Duration:** 3 weeks  
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL (Transform to "ERP dễ dùng nhất")  
**Status:** READY TO START

---

## 🎯 Strategic Goal

**Transform Bella from "Technical Excellence" → "Business User Friendly"**

**Before (Current):**
```json
{
  "conditions": [
    { "field": "customer.tier", "operator": "=", "value": "VIP" }
  ]
}
```
→ User: "Tôi không hiểu" 😕

**After (Phase 2.2 + 3.1):**
```
┌─────────────────────┐
│ Khách hàng VIP      │
└─────────────────────┘
        ↓
🎁 Giảm 15%

👁 Xem bằng tiếng Việt:
"Khi khách hàng VIP thì tự động giảm 15%"
```
→ User: "Tôi hiểu ngay!" ✅

---

## 📊 Success Criteria

### Phase 2.2 (Visual Builder)
- [ ] User can create rule WITHOUT editing JSON
- [ ] Field selector contextual by provider
- [ ] Operator selector contextual by field type
- [ ] Value input dynamic (text/number/select/date)
- [ ] Add/Remove condition/action with 1 click
- [ ] AND/OR toggle between conditions
- [ ] Visual card-based UI (NOT form fields)

### Phase 3.1 (Natural Language)
- [ ] Every rule has Vietnamese description
- [ ] "👁 Xem bằng tiếng Việt" toggle
- [ ] Preview in rule list table
- [ ] Grammatically correct Vietnamese (95%+ cases)
- [ ] Copy button for documentation
- [ ] Non-technical user understands rule without seeing JSON

### Business Metrics
- [ ] <5 minutes to create first rule (non-technical user)
- [ ] 90%+ comprehension rate (understand rule without help)
- [ ] <2% error rate (user creates wrong rule)
- [ ] Demo-ready for investor pitch

---

## 🗓️ Timeline (3 Weeks)

### Week 1: Visual Condition Builder
- Day 1-2: Field schema + operators mapping
- Day 3-4: ConditionCard component
- Day 5: Integration + testing

### Week 2: Visual Action Builder + Natural Language
- Day 1-2: ActionCard component
- Day 3-4: Natural language generator
- Day 5: Integration + polish

### Week 3: Testing + Documentation
- Day 1-2: Comprehensive testing
- Day 3: User guide + screenshots
- Day 4-5: Demo preparation + handoff

---

## 📋 Week 1: Visual Condition Builder

### Day 1-2: Field Schema + Provider Mappings

**Objective:** Define all field schemas for 5 providers

**File:** `src/lib/rule-management/field-schemas.ts`

**Code Structure:**
```typescript
// Field type definitions
export type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date' | 'time';

export interface FieldDefinition {
  key: string;              // e.g., "customer.tier"
  label: string;            // e.g., "Khách hàng VIP"
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
  operators?: OperatorType[];
  placeholder?: string;
  helpText?: string;
}

// Provider-specific fields
export const bookingFields: FieldDefinition[] = [
  {
    key: 'customer.tier',
    label: 'Loại khách hàng',
    type: 'select',
    options: [
      { value: 'VIP', label: 'VIP' },
      { value: 'Regular', label: 'Thường' },
      { value: 'New', label: 'Mới' }
    ],
    operators: ['equals', 'not_equals', 'in'],
    helpText: 'Phân loại khách hàng theo membership'
  },
  {
    key: 'booking.amount',
    label: 'Giá trị đơn hàng',
    type: 'number',
    operators: ['equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'],
    placeholder: '2000000',
    helpText: 'Tổng giá trị booking (VND)'
  },
  // ... 10-15 more fields
];
```

**Deliverables:**
- [ ] `field-schemas.ts` with 5 provider schemas (50-75 fields total)
- [ ] Operator mappings by field type
- [ ] Vietnamese labels for all fields
- [ ] Unit tests (field validation)

**Time:** 2 days

---

### Day 3-4: ConditionCard Component

**Objective:** Build visual condition editor (card-based, NOT form)

**File:** `src/components/rules/ConditionCard.tsx`

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ 1️⃣ [Loại khách hàng ▼]                  │
│    [Bằng ▼] [VIP ▼]              [×]    │
└─────────────────────────────────────────┘
```

**Props:**
```typescript
interface ConditionCardProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
  provider: string;
  index: number;
}
```

**Features:**
- Field dropdown (filtered by provider)
- Operator dropdown (filtered by field type)
- Value input (dynamic component based on field type)
  - Text: `<Input type="text" />`
  - Number: `<Input type="number" />`
  - Select: `<Select><Option>...</Select>`
  - Date: `<DatePicker />`
- Remove button (×)
- Card styling (border, shadow, hover effect)

**Deliverables:**
- [ ] `ConditionCard.tsx` component
- [ ] Dynamic value input rendering
- [ ] Field/operator cascading logic
- [ ] 15+ unit tests

**Time:** 2 days

---
### Day 5: Condition Builder Container + Integration

**Objective:** Wrap ConditionCard in container with AND/OR logic

**File:** `src/components/rules/ConditionBuilder.tsx`

**Visual Design:**
```
⚙️ Conditions (When)

[+ Thêm điều kiện]

┌─────────────────────────────────┐
│ 1️⃣ Khách hàng VIP            [×]│
└─────────────────────────────────┘
      [VÀ ●] [HOẶC ○]
┌─────────────────────────────────┐
│ 2️⃣ Giá trị > 2 triệu         [×]│
└─────────────────────────────────┘
```

**Features:**
- Render list of ConditionCard
- [+ Thêm điều kiện] button (adds empty condition)
- AND/OR toggle between conditions
- Empty state (no conditions yet)
- Integrate with RuleEditor parent component

**Deliverables:**
- [ ] `ConditionBuilder.tsx` container
- [ ] AND/OR logic state management
- [ ] Integration with existing RuleEditor
- [ ] 10+ integration tests

**Time:** 1 day

---

## 📋 Week 2: Action Builder + Natural Language

### Day 1-2: Action Schemas + ActionCard Component

**Objective:** Build visual action editor

**File 1:** `src/lib/rule-management/action-schemas.ts`

**Action Type Definitions:**
```typescript
export interface ActionDefinition {
  type: string;
  label: string;
  icon: string;
  category: 'discount' | 'booking' | 'payroll' | 'notification';
  params: ActionParamDefinition[];
}

export const discountActions: ActionDefinition[] = [
  {
    type: 'apply_discount',
    label: 'Áp dụng giảm giá',
    icon: '🎁',
    category: 'discount',
    params: [
      {
        key: 'discountType',
        label: 'Loại giảm giá',
        type: 'select',
        options: [
          { value: 'percentage', label: 'Phần trăm (%)' },
          { value: 'fixed', label: 'Số tiền cố định (VND)' }
        ]
      },
      {
        key: 'value',
        label: 'Giá trị',
        type: 'number',
        required: true
      }
    ]
  },
  // ... 5-10 more action types
];
```

**File 2:** `src/components/rules/ActionCard.tsx`

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ 🎁 Áp dụng giảm giá               [×]   │
│ ┌─────────────────────────────────────┐ │
│ │ Loại: [Phần trăm ▼]                 │ │
│ │ Giá trị: [15] %                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Deliverables:**
- [ ] `action-schemas.ts` (20-30 action definitions)
- [ ] `ActionCard.tsx` component
- [ ] Dynamic param form rendering
- [ ] Action type picker modal
- [ ] 15+ unit tests

**Time:** 2 days

---

### Day 3-4: Natural Language Generator

**Objective:** Generate Vietnamese description from rules

**File:** `src/lib/rule-management/natural-language-generator.ts`

**Core Function:**
```typescript
export function generateVietnameseDescription(
  conditions: Condition[],
  actions: Action[]
): string {
  // Step 1: Generate condition text
  const conditionTexts = conditions.map((c, idx) => {
    const field = getFieldLabel(c.field);
    const operator = getOperatorLabel(c.operator);
    const value = formatValue(c.value, c.field);
    
    return `${field} ${operator} ${value}`;
  });
  
  const conditionText = joinWithLogic(conditionTexts, conditions);
  
  // Step 2: Generate action text
  const actionTexts = actions.map(a => {
    return getActionLabel(a.type, a.params);
  });
  
  const actionText = actionTexts.join(', ');
  
  // Step 3: Combine
  return `Khi ${conditionText} thì ${actionText}.`;
}

// Helper: Field labels in Vietnamese
const fieldLabels: Record<string, string> = {
  'customer.tier': 'khách hàng',
  'booking.amount': 'giá trị đơn hàng',
  'weekday': 'ngày trong tuần',
  // ... 50+ mappings
};

// Helper: Operator labels in Vietnamese
const operatorLabels: Record<string, string> = {
  'equals': 'là',
  'greater_than': 'lớn hơn',
  'less_than': 'nhỏ hơn',
  'in': 'thuộc',
  // ... 15+ mappings
};

// Helper: Action labels
function getActionLabel(type: string, params: any): string {
  if (type === 'apply_discount') {
    if (params.discountType === 'percentage') {
      return `giảm ${params.value}%`;
    }
    return `giảm ${formatMoney(params.value)}`;
  }
  // ... 20+ action types
}
```

**Example Outputs:**
```typescript
// Input:
conditions = [
  { field: 'customer.tier', operator: 'equals', value: 'VIP' },
  { field: 'booking.amount', operator: 'greater_than', value: 2000000 }
]
actions = [
  { type: 'apply_discount', params: { discountType: 'percentage', value: 15 } }
]

// Output:
"Khi khách hàng là VIP và giá trị đơn hàng lớn hơn 2,000,000 VND thì giảm 15%."
```

**Deliverables:**
- [ ] `natural-language-generator.ts` (200-300 lines)
- [ ] Field/operator/action label mappings (Vietnamese)
- [ ] Value formatting (money, dates, arrays)
- [ ] Logic joining (AND → "và", OR → "hoặc")
- [ ] 25+ unit tests (edge cases, complex rules)

**Time:** 2 days

---
### Day 5: Natural Language UI Integration

**Objective:** Add "👁 Xem bằng tiếng Việt" to all relevant pages

**File 1:** `src/components/rules/NaturalLanguagePreview.tsx`

**Component:**
```typescript
export function NaturalLanguagePreview({ 
  conditions, 
  actions 
}: NaturalLanguagePreviewProps) {
  const [showVietnamese, setShowVietnamese] = useState(false);
  const description = generateVietnameseDescription(conditions, actions);
  
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            👁️ Bản mô tả tiếng Việt
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVietnamese(!showVietnamese)}
          >
            {showVietnamese ? 'Ẩn' : 'Hiện'}
          </Button>
        </div>
      </CardHeader>
      {showVietnamese && (
        <CardContent>
          <p className="text-base leading-relaxed">
            {description}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(description)}
            className="mt-4"
          >
            📋 Copy
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
```

**Integration Points:**
1. Rule Editor Page (create/edit)
   - Show preview above Save button
   - Live update as user edits conditions/actions

2. Rule Detail Page
   - Show at top (prominent)
   - Always visible (not toggle)

3. Rules List Table
   - Add "Mô tả" column
   - Show first 100 chars + "..." (tooltip for full)

**Deliverables:**
- [ ] `NaturalLanguagePreview.tsx` component
- [ ] Integration in RuleEditor
- [ ] Integration in Rule Detail page
- [ ] Integration in RulesTable (preview column)
- [ ] Copy-to-clipboard functionality
- [ ] 10+ UI tests

**Time:** 1 day

---

## 📋 Week 3: Testing + Documentation

### Day 1-2: Comprehensive Testing

**Test Scenarios:**

**1. Visual Builder - Happy Path**
- [ ] Create rule with 1 condition + 1 action (VIP discount)
- [ ] Create rule with 3 conditions + 2 actions (complex)
- [ ] Edit existing rule (load conditions, modify, save)
- [ ] Remove condition/action
- [ ] Change AND to OR logic
- [ ] Field/operator/value validation

**2. Visual Builder - Edge Cases**
- [ ] Empty conditions (show error on save)
- [ ] Empty actions (show error on save)
- [ ] Invalid value (number field with text)
- [ ] Field with no operators (should never happen, but test)
- [ ] Unknown provider (fallback to generic fields)

**3. Natural Language - Accuracy**
- [ ] Single condition → correct Vietnamese
- [ ] Multiple conditions with AND → "và"
- [ ] Multiple conditions with OR → "hoặc"
- [ ] Complex nested logic → readable
- [ ] All field types (text, number, select, date) → formatted correctly
- [ ] All operators → correct Vietnamese
- [ ] All action types → correct labels
- [ ] Money formatting → 2,000,000 VND (with commas)
- [ ] Date formatting → dd/MM/yyyy

**4. Natural Language - Edge Cases**
- [ ] No conditions → "Luôn áp dụng thì..."
- [ ] No actions → "Khi ... thì không làm gì."
- [ ] Unknown field → Use field key as fallback
- [ ] Unknown operator → Use operator key as fallback

**5. Integration Tests**
- [ ] Create rule via visual builder → Save → Load → Edit → Verify
- [ ] Natural language matches actual rule logic
- [ ] Copy-to-clipboard works
- [ ] Preview updates in real-time (as user types)

**Deliverables:**
- [ ] 50+ automated tests (Jest + React Testing Library)
- [ ] Test coverage >85%
- [ ] All edge cases documented
- [ ] Manual testing checklist completed

**Time:** 2 days

---
### Day 3: User Guide + Screenshots

**Objective:** Document visual builder for end users

**File:** `docs/user-guides/RULE_MANAGEMENT_VISUAL_BUILDER_USER_GUIDE.md`

**Content Structure:**
1. **Introduction** (What is Visual Rule Builder?)
2. **Creating Your First Rule** (Step-by-step with screenshots)
   - Step 1: Click "Create Rule"
   - Step 2: Fill metadata (name, provider, priority)
   - Step 3: Add conditions (visual builder)
   - Step 4: Add actions (visual builder)
   - Step 5: Preview in Vietnamese
   - Step 6: Save
3. **Understanding Conditions** (Field types, operators)
4. **Understanding Actions** (Action types, parameters)
5. **Natural Language Preview** (How to use, when to copy)
6. **Tips & Best Practices**
7. **Troubleshooting** (Common errors, solutions)

**Screenshots Needed:**
- [ ] Empty rule editor
- [ ] Adding first condition (field selector open)
- [ ] Condition with number input
- [ ] Multiple conditions with AND/OR toggle
- [ ] Action card with parameters
- [ ] Natural language preview (collapsed/expanded)
- [ ] Complete rule example (VIP weekend promo)

**Deliverables:**
- [ ] User guide (2,000-3,000 words)
- [ ] 10-15 screenshots (annotated)
- [ ] Example rules (5 common use cases)
- [ ] Video recording (optional, 5 minutes)

**Time:** 1 day

---

### Day 4-5: Demo Preparation + Handoff

**Objective:** Prepare for investor/customer demo

**Demo Script (5 minutes):**

**Act 1: The Problem (30 seconds)**
```
Presenter: "Trước đây, để tạo rule trong Bella, bạn phải chỉnh JSON như thế này..."
[Show old JSON editor - complex, technical]
"Điều này khó hiểu với người không biết lập trình."
```

**Act 2: The Solution - Visual Builder (2 minutes)**
```
Presenter: "Giờ đây, với Visual Builder, bạn chỉ cần click và chọn."
[Click "Create Rule"]
[Fill name: "Khuyến mãi VIP cuối tuần"]
[Add condition: Loại khách hàng = VIP]
[Add condition: Ngày = Thứ 7, Chủ nhật]
[Add action: Giảm giá 15%]
"Xong! Không cần code."
```

**Act 3: Natural Language - The WOW (1.5 minutes)**
```
Presenter: "Nhưng đây mới là điểm đặc biệt..."
[Click "👁 Xem bằng tiếng Việt"]
[Show preview: "Khi khách hàng là VIP và ngày trong tuần thuộc Thứ 7, Chủ nhật thì giảm 15%."]

Presenter: "Bella tự động dịch rule thành tiếng Việt."
"Chủ spa không biết IT vẫn hiểu ngay."
"Copy dán vào quy trình, compliance, training materials."
"Tự động document hóa!"
```

**Act 4: Test Before Deploy (1 minute)**
```
Presenter: "Và quan trọng hơn, bạn test trước khi deploy."
[Click "🧪 Test Rule"]
[Select sample: "VIP Weekend"]
[Click "Run Test"]
[Show result: ✅ Conditions met, Actions executed]
"Không risk trong production."
```

**Act 5: The Metrics (30 seconds)**
```
[Show slide]
"Trước: 2-3 ngày để developer tạo rule
Sau: 5 phút tự làm

Trước: Chủ spa không hiểu rule
Sau: Đọc được bằng tiếng Việt

Trước: Sợ sai
Sau: Test trước deploy"

[Pause]

"Đây là ERP dễ dùng nhất."
```

**Deliverables:**
- [ ] Demo script (finalized)
- [ ] Demo data prepared (sample customers, services, rules)
- [ ] Demo video recorded (practice run)
- [ ] Demo slides (5-10 slides with screenshots)
- [ ] Q&A preparation (anticipate investor questions)
- [ ] Handoff document (features, known issues, next steps)

**Time:** 2 days

---

## 📊 Acceptance Criteria

### Technical Acceptance ✅

- [ ] All 5 providers have field schemas (50+ fields)
- [ ] All operators mapped correctly (15+ operators)
- [ ] ConditionCard component renders all field types
- [ ] ActionCard component renders all action types
- [ ] Natural language generator supports all field/operator/action combinations
- [ ] Vietnamese output grammatically correct (95%+ cases)
- [ ] Copy-to-clipboard works
- [ ] Preview updates in real-time
- [ ] 85%+ test coverage
- [ ] Zero TypeScript errors
- [ ] Build passes

### User Experience Acceptance ✅

- [ ] Non-technical user can create rule in <5 minutes
- [ ] User understands natural language description (tested with 3+ people)
- [ ] Error messages clear and actionable
- [ ] UI feels fast (<100ms interaction)
- [ ] Mobile responsive (basic, not full)
- [ ] Accessible (keyboard navigation, screen reader compatible)

### Business Acceptance ✅

- [ ] Demo-ready for investor pitch
- [ ] "WOW factor" achieved (natural language impresses)
- [ ] Differentiated from competitors (no one else has this)
- [ ] User guide complete
- [ ] Can onboard pilot customer without training

---

## 🚀 Deployment Plan

### Pre-Deployment Checklist

- [ ] All tests passing (50+ tests)
- [ ] Code review completed
- [ ] User guide published
- [ ] Demo script rehearsed
- [ ] Known issues documented
- [ ] Rollback plan defined

### Deployment Steps

1. **Deploy to Staging** (Day 1)
   - Deploy code
   - Verify visual builder works
   - Verify natural language works
   - Run smoke tests

2. **Internal Testing** (Day 2-3)
   - Team members create 5-10 rules
   - Collect feedback
   - Fix critical bugs (if any)

3. **Deploy to Production** (Day 4)
   - Deploy during low-traffic window
   - Monitor errors
   - Verify metrics

4. **Pilot Customer Testing** (Day 5+)
   - Onboard 1-2 pilot customers
   - Guide them through first rule creation
   - Collect feedback
   - Iterate

### Rollback Plan

**If critical bug found:**
1. Disable visual builder (feature flag)
2. Fallback to JSON editor (temporary)
3. Fix bug in staging
4. Re-deploy when stable

**Feature Flag:**
```typescript
// .env
FEATURE_VISUAL_RULE_BUILDER=true
FEATURE_NATURAL_LANGUAGE=true
```

---

## 📈 Success Metrics (Post-Deployment)

### Week 1 Metrics
- [ ] 5+ rules created via visual builder
- [ ] Zero critical bugs
- [ ] Avg rule creation time: <5 minutes
- [ ] User feedback: "Dễ dùng" (qualitative)

### Week 2-4 Metrics
- [ ] 50+ rules created
- [ ] 90%+ use visual builder (vs JSON editor)
- [ ] <5% error rate (users create correct rules)
- [ ] Natural language copy usage: >50% users
- [ ] NPS score: >40 (if measured)

### Business Impact Metrics
- [ ] Sales demo success rate: >80% (prospects impressed)
- [ ] Pilot customer retention: 100%
- [ ] Time to onboard new customer: <2 hours (vs 2 days before)
- [ ] Investor interest: Positive feedback on "ERP dễ dùng nhất"

---

## 🎯 Next Steps (After Phase 2.2 + 3.1)

### Phase 3.2: Explain Why (Week 4-5)
**Goal:** Show reasoning for AI decisions

**Features:**
- Assignment reasoning ("Đề xuất: Lan vì...")
- Conflict resolution suggestions
- Dashboard business language

**Value:** Builds trust in AI

### Phase 4: AI Generate Rule (Month 2-3)
**Goal:** "Canva for Business Rules"

**Features:**
- Natural language input → Rule generation
- LLM integration (GPT-4/Claude)
- User review before save

**Value:** 2027 moonshot feature

### Phase 5: Customer Testing (Ongoing)
**Goal:** Real feedback loop

**Activities:**
- Weekly demos
- User behavior tracking
- A/B testing
- Iterate based on data

**Value:** Product-market fit

---

## 📞 Support & Resources

**Documentation:**
- Technical spec: `RULE_BUILDER_VISUAL_DESIGN_MOCKUP.md`
- Roadmap: `BELLA_2026_2027_UX_FIRST_ROADMAP.md`
- Architecture: `DECISION_ENGINE_PLATFORM_ARCHITECTURE.md`

**Code References:**
- Existing RuleEditor: `src/components/rules/RuleEditor.tsx`
- Existing RuleMetadataForm: `src/components/rules/RuleMetadataForm.tsx`
- API routes: `src/app/api/rules/*`

**Contact:**
- Technical questions: Development Team
- UX questions: Design Team
- Business questions: Product Owner

---

## ✅ Sign-Off

**Implementation Ready:** ✅ YES

**Risks Identified:**
- Vietnamese grammar edge cases (mitigation: comprehensive testing)
- Complex nested logic readability (mitigation: user testing)
- Field schema completeness (mitigation: iterative expansion)

**Estimated Effort:**
- Week 1: 5 days (Visual Condition Builder)
- Week 2: 5 days (Action Builder + Natural Language)
- Week 3: 5 days (Testing + Documentation)
- **Total:** 15 days = 3 weeks

**Team Size:**
- 1 Full-stack Developer (Week 1-2)
- 1 Frontend Developer (Week 2-3)
- 1 QA/Tester (Week 3)
- 1 Technical Writer (Week 3)

**Approval:**
- [ ] Product Owner
- [ ] Technical Lead
- [ ] UX Designer

---

**Last Updated:** 2026-07-10  
**Status:** READY TO START  
**Next Action:** Kickoff meeting + assign tasks

