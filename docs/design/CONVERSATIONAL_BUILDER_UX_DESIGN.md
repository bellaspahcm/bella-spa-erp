# Conversational Builder - UX Design
## "Canva cho Business Rules" - Not "JSON có giao diện đẹp"

**Design Philosophy:** Notion + Canva = Conversational Intent-Based Builder  
**Target User:** Spa owner/manager (ZERO technical knowledge)  
**Key Principle:** User never sees "Field", "Operator", "Condition", "Action", "JSON"

**Date:** 2026-07-12  
**Status:** ✅ APPROVED - Implementation Ready  
**Revision:** 2.0 (Complete rewrite based on user feedback)

---

## 🎯 CORE PHILOSOPHY

### ❌ What We're NOT Building

```
[Field ▼] [Operator ▼] [Value]
```

This is **"JSON with pretty UI"** ❌

User still needs to understand:
- field, operator, value
- condition, action
- AND, OR
- Rule structure

**This is DEVELOPER MINDSET** ❌

---

### ✅ What We're Building Instead

```
Bella muốn giúp bạn điều gì?
  🎁 Khuyến mãi
  👩 Phân công KTV
  💰 Hoa hồng
    ↓
Khi nào áp dụng?
  ☐ Khách VIP
  ☐ Sinh nhật
  ☐ Cuối tuần
    ↓
Bella sẽ làm gì?
  💰 Giảm 15%
  ⭐ Tặng 100 điểm
    ↓
DONE (JSON generated behind)
```

This is **"Conversation with Bella"** ✅

User just answers 2 questions:
1. **Khi nào?** (When)
2. **Bella sẽ làm gì?** (What should Bella do)

**This is CANVA/NOTION EXPERIENCE** ✅

---

## 🌟 DESIGN PRINCIPLES (The 7 Commandments)

1. **Templates > Creation** - Users USE rules, not CREATE rules
2. **Conversation > Builder** - Feel like talking, not programming
3. **Business Language > Technical Terms** - "Khách VIP" not "customer.tier == VIP"
4. **Intent-First > Structure-First** - Ask "What?" before showing "How?"
5. **Visual > JSON** - Checkboxes + Icons, not field/operator/value
6. **One-Click > Multi-Step** - Apply template → Customize → Done (not start from blank)
7. **Show Don't Tell** - Preview in Vietnamese, not explain JSON structure

---

## 📐 COMPARISON: Old vs New Approach

### OLD Approach (Technical)

**Step 1: Click "Create Rule"**
```
┌─────────────────────────────────┐
│ Create New Rule                 │
│                                 │
│ Provider: [Select ▼]            │
│ Category: [Select ▼]            │
│                                 │
│ [Next]                          │
└─────────────────────────────────┘
```

**Step 2: Add Conditions**
```
┌─────────────────────────────────┐
│ Conditions                      │
│ [+ Add Condition]               │
│                                 │
│ [Field ▼] [Operator ▼] [Value] │
│                                 │
│ [AND ▼] [OR ▼]                  │
└─────────────────────────────────┘
```

**User thinks:** "What is Field? What is Operator?" 😕

---

### NEW Approach (Conversational)

**Step 1: Intent Selector**
```
┌─────────────────────────────────┐
│ Bella muốn giúp bạn điều gì?    │
│                                 │
│ 🎁 Khuyến mãi                   │
│    Giảm giá, tặng quà           │
│                                 │
│ 👩 Phân công KTV                │
│    Tự động gán ca               │
│                                 │
│ 💰 Hoa hồng                     │
│    Tính lương công bằng         │
└─────────────────────────────────┘
```

**Step 2: When Selector**
```
┌─────────────────────────────────┐
│ Khi nào áp dụng khuyến mãi?     │
│                                 │
│ ☐ Khách VIP                     │
│ ☐ Sinh nhật khách               │
│ ☐ Cuối tuần (T7, CN)            │
│ ☐ Booking trên ___ triệu        │
└─────────────────────────────────┘
```

**User thinks:** "Tôi hiểu ngay!" ✅

---

## 🎨 USER FLOW: Step-by-Step Experience

### Flow 1: Intent Selector (Home Screen)

**What user sees:**
```
┌──────────────────────────────────────────┐
│  Bella muốn giúp bạn điều gì?            │
│                                          │
│  🎁 Khuyến mãi                           │
│     Giảm giá tự động, tặng quà           │
│     → 89% spa đang dùng                  │
│                                          │
│  👩 Phân công KTV                        │
│     Tự động gán ca cho nhân viên         │
│     → 76% spa đang dùng                  │
│                                          │
│  💰 Hoa hồng                             │
│     Tính lương, thưởng công bằng         │
│     → 64% spa đang dùng                  │
│                                          │
│  📦 Kho                                   │
│     Nhập hàng, kiểm kho tự động          │
│                                          │
│  📅 Booking                               │
│     Xếp lịch, xác nhận tự động           │
│                                          │
│  👥 Chăm sóc khách                       │
│     Nhắc lịch, sinh nhật, điểm           │
│                                          │
│  ➕ Khác                                  │
│     Tạo rule tùy chỉnh                   │
└──────────────────────────────────────────┘
```

**Key Features:**
- ✅ NO "Create Rule" button
- ✅ Icons + Vietnamese labels
- ✅ Brief description under each
- ✅ Social proof ("89% spa đang dùng")
- ✅ Category-based (not provider-based)

**User Journey:** Click any category → Next screen

---

**User Journey:** Click any category → Next screen

---

### Flow 2: When Selector (Conditions Screen)

**What user sees when "🎁 Khuyến mãi" selected:**
```
┌──────────────────────────────────────────┐
│  ← Bella muốn giúp bạn điều gì?          │
│                                          │
│  🎁 Khuyến mãi: Khi nào áp dụng?         │
│                                          │
│  ────── VỀ KHÁCH HÀNG ──────            │
│  ☐ Khách VIP                            │
│  ☐ Khách Loyal                          │
│  ☐ Khách mới                            │
│  ☐ Sinh nhật khách (± ___ ngày)         │
│                                          │
│  ────── VỀ THỜI GIAN ──────             │
│  ☐ Cuối tuần (T7, CN)                   │
│  ☐ Ngày lễ                              │
│  ☐ Từ ___ đến ___ (chọn ngày)           │
│                                          │
│  ────── VỀ BOOKING ──────               │
│  ☐ Giá trị booking trên ___ triệu       │
│  ☐ Đặt dịch vụ [Select ▼]               │
│  ☐ Đặt gói [Select ▼]                   │
│  ☐ Đặt tại chi nhánh [Select ▼]         │
│                                          │
│  [Tiếp tục]                             │
└──────────────────────────────────────────┘
```

**Key Features:**
- ✅ NO "Field/Operator/Value" dropdowns
- ✅ Grouped by business context (Customer, Time, Booking)
- ✅ Checkboxes for yes/no conditions
- ✅ Text inputs for numeric values (shown inline)
- ✅ Smart defaults (e.g., "Sinh nhật khách ± 7 ngày")
- ✅ Back button to change intent

**Behind the Scenes (Hidden from User):**
```typescript
// User checks "☐ Khách VIP"
// System generates:
{
  field: "customer.tier",
  operator: "equals",
  value: "VIP"
}

// User checks "☐ Giá trị booking trên 2 triệu"
// System generates:
{
  field: "booking.total",
  operator: "greaterThan",
  value: 2000000
}
```

**Multiple Conditions Logic:**
- If user checks 2+ conditions → Default "Tất cả điều kiện sau" (AND)
- User can toggle to "Ít nhất một điều kiện" (OR)
- NO visible "AND/OR" labels
- Visual indicator: "✓ Tất cả" vs "≈ Ít nhất một"

**User Journey:** Select conditions → Click "Tiếp tục" → Next screen

---

### Flow 3: Action Selector (Actions Screen)

**What user sees:**
```
┌──────────────────────────────────────────┐
│  ← Khi nào áp dụng?                      │
│                                          │
│  🎁 Bella sẽ làm gì?                     │
│                                          │
│  💰 Giảm giá                             │
│     ○ Giảm ___ %                         │
│     ○ Giảm ___ VNĐ                       │
│                                          │
│  🎁 Tặng quà                             │
│     ○ Tặng voucher [Select ▼]            │
│     ○ Tặng sản phẩm [Select ▼]           │
│                                          │
│  ⭐ Tặng điểm                             │
│     ○ Tặng ___ điểm                      │
│                                          │
│  📩 Gửi thông báo                        │
│     ○ SMS                                │
│     ○ Zalo                               │
│     Nội dung: [_______________]          │
│                                          │
│  [Xem trước]  [Lưu]                      │
└──────────────────────────────────────────┘
```

**Key Features:**
- ✅ Icons for each action type
- ✅ Radio buttons for mutually exclusive choices (% vs VNĐ)
- ✅ Inline text inputs for values
- ✅ Dropdowns for pre-defined options (voucher, product)
- ✅ Preview button shows result in Vietnamese
- ✅ NO "Action Type" dropdown

**Behind the Scenes (Hidden from User):**
```typescript
// User selects "💰 Giảm 15%"
// System generates:
{
  type: "apply_discount",
  parameters: {
    type: "percentage",
    value: 15
  }
}

// User selects "📩 Gửi SMS: Chúc mừng sinh nhật!"
// System generates:
{
  type: "send_notification",
  parameters: {
    channel: "sms",
    message: "Chúc mừng sinh nhật!"
  }
}
```

**Multiple Actions:**
- User can select 2+ actions (e.g., "Giảm 15%" + "Tặng 100 điểm")
- Each action has a checkbox to enable/disable
- Visual indicator: ✓ (active) vs ○ (inactive)

**User Journey:** Select actions → Click "Xem trước" → See preview → Click "Lưu" → Done

---

### Flow 4: Preview Screen (Final Confirmation)

**What user sees:**
```
┌──────────────────────────────────────────┐
│  Xem trước rule của bạn                  │
│                                          │
│  ✨ Bella sẽ:                            │
│                                          │
│  📝 Khi khách VIP đặt dịch vụ           │
│     trên 2 triệu vào cuối tuần          │
│                                          │
│        ↓                                 │
│                                          │
│  💰 Giảm 15%                             │
│                                          │
│        ↓                                 │
│                                          │
│  ⭐ Tặng 100 điểm                        │
│                                          │
│  ──────────────────────────────────      │
│                                          │
│  Ví dụ:                                 │
│  • Khách A (VIP) đặt 2.5 triệu T7       │
│    → Giảm 375k + Tặng 100 điểm ✅       │
│  • Khách B (Loyal) đặt 3 triệu T7       │
│    → Không áp dụng ❌                    │
│                                          │
│  [← Sửa]  [Lưu rule]                    │
└──────────────────────────────────────────┘
```

**Key Features:**
- ✅ Vietnamese description (NO JSON)
- ✅ Visual flow (arrows showing sequence)
- ✅ Example scenarios (pass/fail)
- ✅ Back button to edit
- ✅ Prominent "Lưu rule" button

**Behind the Scenes:**
- PreviewGenerator.ts converts JSON → Vietnamese
- Uses same logic as rule execution (so preview = actual behavior)
- Validates rule before showing preview (no invalid previews)

**User Journey:** Review → Click "Lưu rule" → Success message → Return to rules list

---

## 🎨 TEMPLATE GALLERY (Left Panel)

### Why Templates First?

**Target:** 90%+ users should apply template (vs 10% create from scratch)

**Philosophy:** 
- Canva doesn't open with blank canvas
- Notion has templates for every use case
- Bella should have 15-20 templates ready

---

### Visual Layout

**Left Panel (Always Visible):**
```
┌──────────────────────┐
│  TEMPLATES          │
│                     │
│  🔥 PHỔ BIẾN        │
│  • VIP Weekend      │
│  • Birthday Promo   │
│  • Combo Deal       │
│                     │
│  💰 KHUYẾN MÃI      │
│  • Flash Sale       │
│  • Giờ vàng         │
│  • Tặng voucher     │
│                     │
│  👩 PHÂN CÔNG       │
│  • Auto KTV         │
│  • Skill matching   │
│                     │
│  💵 HOA HỒNG        │
│  • Session bonus    │
│  • Rating bonus     │
│                     │
│  [+ Tạo mới]        │
└──────────────────────┘
```

**Main Panel (Right Side):**
- Shows either Intent Selector (if new) or Template details (if clicked)

---

### Template Card Design

**When hovering over "VIP Weekend":**
```
┌────────────────────────────────────┐
│  🔥 VIP Weekend                    │
│  89% spa đang dùng                 │
│                                    │
│  📝 Giảm 15% cho khách VIP        │
│     đặt trên 2 triệu cuối tuần    │
│                                    │
│  [Áp dụng ngay]                    │
└────────────────────────────────────┘
```

**When clicking "Áp dụng ngay":**
1. Fills form with template values
2. User can customize (change 15% → 20%, add actions, etc.)
3. Click "Lưu" → Done

**Key Features:**
- ✅ One-click apply (not multi-step)
- ✅ Social proof ("89% spa đang dùng")
- ✅ Vietnamese description
- ✅ Prominent CTA button

---

### Template Definitions (Backend)

**Structure:**
```typescript
interface RuleTemplate {
  id: string;
  category: "promotion" | "assignment" | "commission" | "inventory";
  name: string;
  description: string;
  usagePercentage: number; // Social proof
  tags: string[];
  
  // Pre-filled values
  intent: string;
  conditions: Condition[];
  actions: Action[];
  
  // Customization hints
  customizableFields: string[]; // Which fields user typically changes
}
```

**Example: VIP Weekend Template**
```typescript
{
  id: "vip-weekend",
  category: "promotion",
  name: "VIP Weekend",
  description: "Giảm 15% cho khách VIP đặt trên 2 triệu cuối tuần",
  usagePercentage: 89,
  tags: ["vip", "weekend", "discount"],
  
  intent: "promotion",
  conditions: [
    { field: "customer.tier", operator: "equals", value: "VIP" },
    { field: "booking.total", operator: "greaterThan", value: 2000000 },
    { field: "booking.dayOfWeek", operator: "in", value: ["saturday", "sunday"] }
  ],
  actions: [
    { type: "apply_discount", parameters: { type: "percentage", value: 15 } }
  ],
  
  customizableFields: ["conditions.1.value", "actions.0.parameters.value"]
}
```

---

## 🎯 TERMINOLOGY MAPPING (Critical!)

### ❌ OLD (Technical) → ✅ NEW (Business)

| Technical Term | Business Term (Vietnamese) |
|----------------|----------------------------|
| Rule | (No label - implicit) |
| Condition | "Khi nào?" |
| Action | "Bella sẽ làm gì?" |
| Field | (Category label: "Về khách hàng", "Về thời gian") |
| Operator | (Hidden - implied by checkbox/input type) |
| Value | (Inline input or dropdown) |
| AND | "Tất cả điều kiện sau" |
| OR | "Ít nhất một điều kiện" |
| Provider | (Category: "Khuyến mãi", "Phân công", etc.) |
| Priority | "Thứ tự ưu tiên" (only in advanced settings) |
| Status | "Đang áp dụng" / "Tạm dừng" |

**Critical Rules:**
- ✅ User NEVER sees: "field", "operator", "condition", "action", "JSON"
- ✅ User ALWAYS sees: Business concepts, icons, checkboxes, Vietnamese
- ✅ Technical terms only appear in developer mode (hidden by default)

---

## 📱 RESPONSIVE DESIGN NOTES

### Desktop (Primary Target)
- Left panel: 300px fixed
- Main panel: Flexible
- Template hover: Popover on right side
- Preview: Modal overlay

### Tablet
- Left panel: Collapsible drawer (hamburger menu)
- Main panel: Full width
- Template cards: 2 columns
- Preview: Full-screen overlay

### Mobile
- Left panel: Bottom sheet (swipe up)
- Main panel: Single column
- Template cards: 1 column (vertical scroll)
- Preview: Full-screen

**Note:** Most users are on desktop (spa owner at counter). Mobile is secondary.

---

## 🎨 VISUAL DESIGN TOKENS

### Colors
```css
/* Intent Categories */
--intent-promotion: #FF6B9D;      /* Pink - 🎁 Khuyến mãi */
--intent-assignment: #00C2FF;     /* Blue - 👩 Phân công */
--intent-commission: #FFB800;     /* Yellow - 💰 Hoa hồng */
--intent-inventory: #00D084;      /* Green - 📦 Kho */
--intent-booking: #8B5CF6;        /* Purple - 📅 Booking */
--intent-customer: #F59E0B;       /* Orange - 👥 Chăm sóc */

/* Action Types */
--action-discount: #10B981;       /* Green - 💰 Giảm giá */
--action-gift: #F59E0B;           /* Orange - 🎁 Tặng quà */
--action-points: #FBBF24;         /* Yellow - ⭐ Tặng điểm */
--action-notify: #3B82F6;         /* Blue - 📩 Gửi thông báo */

/* UI States */
--bg-card: #FFFFFF;
--bg-hover: #F9FAFB;
--border-default: #E5E7EB;
--text-primary: #111827;
--text-secondary: #6B7280;
```

### Typography
```css
/* Headings */
--font-heading: "Inter", sans-serif;
--font-body: "Inter", sans-serif;

/* Sizes */
--text-xl: 20px;  /* Intent selector titles */
--text-lg: 18px;  /* Section headings */
--text-base: 16px;  /* Body text */
--text-sm: 14px;  /* Helper text */
```

### Spacing
```css
/* Consistent spacing scale */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
```

---

## 🧩 COMPONENT BREAKDOWN

### Components to Build (Week 1)

1. **IntentSelector.tsx**
   - Props: `onSelect: (intent: string) => void`
   - Shows 7 categories with icons
   - Social proof badges
   - Responsive grid (3 cols desktop, 2 cols tablet, 1 col mobile)

2. **WhenSelector.tsx**
   - Props: `intent: string, onUpdate: (conditions: Condition[]) => void`
   - Dynamic field groups based on intent
   - Checkbox + text input hybrid
   - AND/OR toggle (visual, no labels)

3. **ActionSelector.tsx**
   - Props: `intent: string, onUpdate: (actions: Action[]) => void`
   - Icon-based action cards
   - Multiple action support
   - Inline value inputs

4. **PreviewGenerator.ts**
   - Function: `generatePreview(rule: Rule): string`
   - Converts JSON → Vietnamese description
   - Generates example scenarios
   - Validates rule logic

5. **RulePreview.tsx**
   - Props: `rule: Rule`
   - Shows Vietnamese preview
   - Example scenarios (pass/fail)
   - Edit/Save actions

### Components to Build (Week 2)

6. **TemplateGallery.tsx**
   - Props: `onApply: (template: RuleTemplate) => void`
   - Left panel (always visible)
   - Template cards with social proof
   - Category filtering

7. **TemplateCard.tsx**
   - Props: `template: RuleTemplate, onApply: () => void`
   - Hover popover with description
   - One-click apply button
   - Social proof badge

---

## 📊 SUCCESS METRICS (Updated Targets)

### Usability Metrics
- ✅ **Time to first rule:** <1 minute (not <3 minutes)
- ✅ **"What is operator?" questions:** 0% (not 10%)
- ✅ **"Tôi hiểu ngay!" feedback:** 95%+ (not 80%)
- ✅ **Template usage:** >90% (not 70%)
- ✅ **Training required:** <10% (not 30%)

### Business Metrics
- ✅ **Rule creation rate:** 10x increase (vs Phase 1)
- ✅ **Rule errors:** <5% (vs 30% with JSON)
- ✅ **Support tickets:** 80% reduction
- ✅ **Customer satisfaction:** >4.5/5 (vs 3.2/5 with JSON editor)

---

## 🚀 IMPLEMENTATION ROADMAP

### Week 1: Conversational Builder MVP
**Goal:** Demo to 2-3 spa owners by Friday

**Day 1-2:**
- Build IntentSelector.tsx (7 categories)
- Build basic navigation flow
- Test with mock data

**Day 3-4:**
- Build WhenSelector.tsx (checkboxes, inputs)
- Build ActionSelector.tsx (icons, forms)
- Connect all 3 screens

**Day 5:**
- Build PreviewGenerator.ts (JSON → Vietnamese)
- Build RulePreview.tsx (display preview)
- **Demo to 2-3 spa owners**
- Collect feedback

### Week 2: Template System
**Goal:** 90% template usage rate

**Day 6-7:**
- Build TemplateGallery.tsx (left panel)
- Create 15-20 template definitions
- Build one-click apply logic

**Day 8-9:**
- Build TemplateCard.tsx (with social proof)
- Add hover popovers
- Add category filtering

**Day 10:**
- Polish UX (animations, loading states)
- **Demo to 3-5 pilot customers**
- Collect feedback

---

## 🔧 TECHNICAL NOTES

### State Management
```typescript
// React state structure
interface BuilderState {
  step: "intent" | "when" | "action" | "preview";
  intent: string | null;
  conditions: Condition[];
  actions: Action[];
  metadata: {
    name: string;
    description: string;
    priority: number;
    status: "active" | "inactive";
  };
}
```

### Validation Rules
```typescript
// Before showing preview
const isValidRule = (state: BuilderState): boolean => {
  return (
    state.intent !== null &&
    state.conditions.length > 0 &&
    state.actions.length > 0 &&
    state.metadata.name.length > 0
  );
};
```

### Preview Generation Algorithm
```typescript
const generatePreview = (rule: Rule): string => {
  // 1. Convert conditions to Vietnamese
  const whenText = rule.conditions
    .map(c => conditionToVietnamese(c))
    .join(rule.logic === "AND" ? " và " : " hoặc ");
  
  // 2. Convert actions to Vietnamese
  const whatText = rule.actions
    .map(a => actionToVietnamese(a))
    .join(", ");
  
  // 3. Generate full sentence
  return `Khi ${whenText}, Bella sẽ ${whatText}`;
};
```

---

## 📝 DEVELOPER HANDOFF CHECKLIST

### Design Assets
- [ ] Figma mockups (all 4 flows)
- [ ] Icon set (intent categories + action types)
- [ ] Color tokens (CSS variables)
- [ ] Typography scale

### Component Specs
- [ ] IntentSelector.tsx spec
- [ ] WhenSelector.tsx spec
- [ ] ActionSelector.tsx spec
- [ ] PreviewGenerator.ts spec
- [ ] RulePreview.tsx spec
- [ ] TemplateGallery.tsx spec
- [ ] TemplateCard.tsx spec

### Data Contracts
- [ ] RuleTemplate interface
- [ ] BuilderState interface
- [ ] Validation rules
- [ ] API endpoints (save rule, list templates)

### Testing Requirements
- [ ] Unit tests (PreviewGenerator)
- [ ] Integration tests (full flow)
- [ ] User testing plan (2-3 spa owners Week 1)
- [ ] Pilot testing plan (3-5 customers Week 2)

---

## 🎉 EXPECTED OUTCOMES

### Week 1 Demo Feedback
- **Target:** "Tôi hiểu ngay!" from 2/3 spa owners
- **Metrics:** <1 minute to create first rule, zero "what is field?" questions
- **Success:** Proceed to Week 2
- **Failure:** Iterate on WhenSelector/ActionSelector UX

### Week 2 Pilot Feedback
- **Target:** 90%+ customers apply template (vs create from scratch)
- **Metrics:** >4.5/5 satisfaction, <5% rule errors
- **Success:** Proceed to Week 3-4 (Rule Templates phase)
- **Failure:** Add more templates, simplify one-click apply flow

---

**Document Status:** ✅ COMPLETE  
**Next Step:** Start Week 1 implementation (IntentSelector.tsx)  
**Review Date:** After Week 1 demo  
**Approved By:** User (2026-07-12)
