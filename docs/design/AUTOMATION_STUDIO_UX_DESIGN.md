# Bella Automation Studio - UX Design Document

**Version:** 1.0  
**Date:** 2026-07-12  
**Author:** Product Team  
**Status:** 🎨 Design Phase (Sprint 1)

---

## 📋 TABLE OF CONTENTS

1. [Vision Statement](#vision-statement)
2. [Strategic Context](#strategic-context)
3. [Design Principles](#design-principles)
4. [User Research](#user-research)
5. [Information Architecture](#information-architecture)
6. [User Flows](#user-flows)
7. [Wireframes](#wireframes)
8. [Component Library](#component-library)
9. [Visual Design System](#visual-design-system)
10. [Interaction Patterns](#interaction-patterns)
11. [Accessibility](#accessibility)
12. [Implementation Roadmap](#implementation-roadmap)
13. [Success Metrics](#success-metrics)

---

## 🎯 VISION STATEMENT

> **"Bella Automation Studio là Canva cho Business Rules"**

### Goal
Enable spa owners to create complex business automations in **2-3 minutes** without any technical knowledge, starting from **templates** (not blank canvas).

### Anti-Goals
- ❌ NOT a traditional "Rule Management UI"
- ❌ NOT JSON/code editor with pretty UI
- ❌ NOT for developers or technical users
- ❌ NOT another Odoo/ERPNext/Salesforce clone
- ❌ NOT "Intent-first" flow (don't make users choose categories first)

### Success Criteria
**Primary KPI:**  
> A spa owner opening Bella for the first time can create their first automation **WITHOUT ANY TUTORIAL** in under 2 minutes using a template.

**Secondary KPIs:**
- **95%+ of automations created using templates** (not from scratch)
- <3% error rate in rule creation
- 90%+ user satisfaction (NPS >60)
- Users say "Dễ như Canva" (as easy as Canva)

---

## 🌍 STRATEGIC CONTEXT

### Current State (Before Automation Studio)

**Backend:** ✅ Complete
- Decision Engine (5 providers proven)
- Workflow Engine (95% complete)
- Rule CRUD APIs
- Test Simulator

**Frontend:** ⚠️ Incomplete
- Rule listing page exists
- Rule detail/edit pages exist
- BUT: Designed for technical users (shows JSON, conditions, operators)
- Result: Spa owners can't use it

### What's Missing
> **"The bridge between powerful engines and non-technical users"**

**Problem:**
- Spa owner sees: `{ "field": "customerTier", "operator": "==", "value": "vip" }`
- Spa owner wants: "Khách VIP đặt dịch vụ..."

### Competitive Analysis

| Platform | Approach | Usability | Bella Differentiation |
|----------|----------|-----------|----------------------|
| Odoo | Form-based rules | 4/10 | Still too technical |
| ERPNext | Workflow UI | 5/10 | Requires training |
| Salesforce Flow | Visual builder | 7/10 | Better but still complex |
| Power Automate | Connector-based | 6/10 | Too many options |
| Zapier | Trigger-action | 8/10 | ✅ Good model but limited |
| Notion | Block-based | 9/10 | ✅ Inspiration for UX |
| Canva | Template-first | 10/10 | ✅ Our target benchmark |

**Bella's Position:**  
- **Zapier's simplicity** (trigger → action)
- **Notion's flexibility** (composable blocks)
- **Canva's discoverability** (templates + search)
- **AI-powered** (explain why + natural language)

---

## 🧠 PRODUCT PSYCHOLOGY

### Purpose
Understanding the psychological principles that make Automation Studio feel effortless and enjoyable, not intimidating.

---

### Principle 1: Progressive Confidence

**Concept:** Build user confidence step-by-step, never overwhelm.

**How Canva does it:**
```
Step 1: Choose beautiful template (instant confidence: "I can make this!")
Step 2: Change one text field (small win)
Step 3: Preview result (looks professional already!)
Step 4: Download (success!)
```

**How Bella does it:**
```
Step 1: See "🎁 Khuyến mãi VIP" template (instant confidence: "This is what I need!")
Step 2: Change "15%" → "20%" (small win: "I understand this!")
Step 3: Preview with real customer example (looks professional: "This will work!")
Step 4: Save (success: "I just automated something complex!")
```

**Anti-pattern:**
```
❌ Step 1: Choose entity type (intimidating: "What's an entity?")
❌ Step 2: Define conditions (overwhelming: 50 fields to choose from)
❌ Step 3: Configure actions (confused: "What's the difference between these 3 discount types?")
```

**Implementation:**
- **Always show templates first** (not blank canvas)
- **Pre-fill 90% of fields** (user only changes 1-2 values)
- **Show immediate preview** (user sees result before committing)
- **Use real data in examples** (not abstract descriptions)

---

### Principle 2: Never Show Complexity

**Concept:** Hide technical implementation, show business language only.

**Backend Reality:**
```json
{
  "conditions": [
    {
      "field": "customer.tier",
      "operator": "==",
      "value": "vip"
    },
    {
      "field": "booking.totalValue",
      "operator": ">=",
      "value": 2000000
    }
  ],
  "actions": [
    {
      "type": "applyDiscount",
      "discountType": "percentage",
      "value": 15
    }
  ]
}
```

**Frontend User Sees:**
```
Khi:
• Khách VIP
• Đặt dịch vụ trên 2 triệu

Bella sẽ:
• Giảm 15%
• Gửi SMS chúc mừng
```

**Key Rules:**
- ❌ Never show: "field", "operator", "value", "condition", "action"
- ✅ Always show: "Khi...", "Bella sẽ...", natural business language
- ❌ Never show: JSON (unless user clicks "Advanced" → "View JSON")
- ✅ Always show: Visual representation (cards, chips, nodes)

**Implementation:**
```tsx
// ❌ Bad: Expose technical terms
<Select label="Operator">
  <option value="==">Equals</option>
  <option value=">=">Greater than or equal</option>
</Select>

// ✅ Good: Hide complexity
<Checkbox label="Khách VIP" />
<Input label="Đặt dịch vụ trên" suffix="VNĐ" />
```

---

### Principle 3: Instant Reward (Dopamine Loop)

**Concept:** Give positive feedback after EVERY interaction, not just at the end.

**How Notion does it:**
```
User types "/" → Instant menu appears (dopamine: "It understood me!")
User selects block → Smooth animation (dopamine: "This feels good!")
User saves → Checkmark animation (dopamine: "Success!")
```

**How Bella does it:**

**Micro-feedback after each action:**
```
User clicks template → ✨ "Bella đã hiểu" (200ms delay)
User changes 15% → 👍 "Automation hợp lệ" (live validation)
User clicks preview → 📊 "Automation này có thể tiết kiệm 3 giờ/tuần" (value shown)
User clicks save → 🎉 "Xong rồi! Bella sẽ tự động chạy từ bây giờ" (celebration)
```

**Implementation:**
```tsx
// After every state change
const handleTemplateSelect = (template: Template) => {
  setSelectedTemplate(template);
  
  // Instant feedback (dopamine hit #1)
  toast.success('✨ Bella đã hiểu', { duration: 1500 });
  
  // Show preview immediately (dopamine hit #2)
  setShowPreview(true);
  
  // Animate transition (dopamine hit #3)
  animateTransition();
};
```

**Feedback Types:**
- ✨ Understanding: "Bella đã hiểu"
- 👍 Validation: "Automation hợp lệ"
- 💡 Insight: "Có thể tiết kiệm 3 giờ/tuần"
- 🎉 Success: "Xong rồi!"
- ⚠️ Gentle warning: "Có vẻ điều kiện này chưa đủ rõ"

---

### Principle 4: Social Proof & Safety

**Concept:** Users trust what others trust, and need safety nets.

**Social Proof Examples:**
```
🎂 Sinh nhật giảm 20%
👍 248 spa đang dùng  ← Social proof
⭐ 4.8/5 đánh giá      ← Social proof
```

**Safety Nets:**
```
[Lưu nháp]  ← Can save without activating
[Preview]   ← Can see result before committing
[Hoàn tác]  ← Can undo after 5 seconds
[Version history] ← Can restore previous version
[Tạm dừng]  ← Can pause anytime (reversible)
```

**Implementation:**
- Show usage count on templates: "248 spa đang dùng"
- Show success stories: "Spa ABC tiết kiệm 5h/tuần với automation này"
- Always offer undo/rollback: Toast with [Hoàn tác] button
- Show impact before confirm: "Ảnh hưởng: ~8 booking/ngày"

---

### Principle 5: Contextual Intelligence

**Concept:** Show relevant options only, not everything at once.

**Bad (Overwhelming):**
```
Actions: (50 options shown)
• Apply discount (percentage)
• Apply discount (fixed amount)
• Apply discount (tiered)
• Apply voucher (one-time)
• Apply voucher (recurring)
• Send SMS (template A)
• Send SMS (template B)
• Send email
• Send push notification
• Add loyalty points (fixed)
• Add loyalty points (percentage)
... (40 more options)
```

**Good (Contextual):**
```
Bạn chọn "🎁 Khuyến mãi" intent
↓
Actions shown: (5 relevant options only)
• Giảm % (most common for promotions)
• Tặng Voucher
• Tặng điểm
• Gửi SMS
• Thông báo
```

**Implementation:**
```typescript
// Filter actions by intent
const getRelevantActions = (intent: Intent) => {
  const allActions = getAllActions();
  return allActions.filter(action => 
    action.categories.includes(intent) &&
    action.usageCount > 10 // Only show popular actions
  );
};
```

---

### Principle 6: Emotion & Personality

**Concept:** Software can have personality, make users smile.

**Traditional ERP (Cold):**
```
✓ Record saved successfully.
✓ Operation completed.
✓ Rule created.
```

**Bella (Warm):**
```
🎉 Xong rồi! Bella sẽ tự động chạy automation này từ bây giờ.

💡 Mẹo: Bạn có thể tạm dừng automation bất cứ lúc nào.

✨ Automation này có thể tiết kiệm khoảng 3 giờ mỗi tuần cho bạn!
```

**Empty State (Traditional):**
```
No data
```

**Empty State (Bella):**
```
✨ Bắt đầu tự động hóa với Bella

Chưa có automation nào. Bạn muốn bắt đầu bằng:

🎁 VIP (Phổ biến nhất)
🎂 Sinh nhật (Dễ nhất)
📅 Booking cuối tuần (Tiết kiệm thời gian nhất)

[Xem tất cả mẫu →]
```

**Error State (Traditional):**
```
Error: Invalid input
```

**Error State (Bella):**
```
😅 Ối, có vẻ giá trị này chưa đúng

Giá trị phải từ 0 đến 100%
(Bạn đang nhập: 150%)

[Sửa lại]
```

**Implementation Checklist:**
- Use emoji sparingly but strategically (🎉 for success, ✨ for magic, 💡 for tips)
- Write in conversational tone (not formal documentation)
- Address user directly ("Bạn", not "User")
- Celebrate success (not just confirm)
- Be gentle with errors (not blame)

---

### Principle 7: Template-First Discovery

**Concept:** Don't make users start from blank canvas (intimidating). Show inspiration first.

**How Canva wins:**
```
User opens Canva
↓
Immediately sees: 1000+ beautiful templates
↓
User thinks: "I can make something like this!"
↓
Clicks template → Small edits → Done
↓
User feels: "I'm a designer!"
```

**How Bella wins:**
```
User opens Automation Studio
↓
Immediately sees: 
  🔥 Phổ biến nhất
  - Khuyến mãi VIP (248 spa dùng)
  - Sinh nhật giảm giá (195 spa dùng)
  - Booking cuối tuần (167 spa dùng)
↓
User thinks: "Đây là những gì tôi cần!"
↓
Clicks template → Changes one value → Save
↓
User feels: "I just automated my business!"
```

**Anti-pattern (Intent-first is wrong):**
```
❌ User opens Automation Studio
❌ Sees: "Bạn muốn tạo automation gì?"
   - Khuyến mãi
   - Booking
   - Nhân viên
   - Kho
❌ User thinks: "Uh... which one do I need?"
❌ Blank canvas after selection
❌ User feels: "I don't know where to start"
```

**Implementation:**
- Homepage = Template Gallery (not Intent Selection)
- Templates sorted by popularity (social proof)
- "+ Tạo mới" button is secondary (bottom right, not center)
- Search bar prominent: "Tìm automation..." (instant filter)

---

## 🎨 DESIGN PRINCIPLES

**Note:** These principles are tactical implementations of the Product Psychology principles above.

### 1. Template-First (NOT Blank Canvas)
**"Show inspiration before creation"**

**Bad Example (Blank Canvas):**
```
Screen: "Tạo automation mới"
[Empty form with 20 fields to fill]
→ User: "I don't know where to start"
```

**Good Example (Bella):**
```
Screen: "Automation Studio"
🔥 Phổ biến nhất:
- 🎁 Khuyến mãi VIP (248 spa dùng)
- 🎂 Sinh nhật giảm giá (195 spa dùng)
- 📅 Booking cuối tuần (167 spa dùng)

[+ Tạo từ đầu] ← Secondary button, bottom right
→ User: "I'll use the VIP template!"
```

**Implementation:**
- Homepage = Template Gallery (sorted by popularity)
- Search bar: "Tìm automation..." (instant filter)
- Category filters: [Tất cả] [Khuyến mãi] [Booking] [HR]
- Usage count visible: "248 spa đang dùng" (social proof)

### 2. Natural Language First
**"Business language, not technical jargon"**

| ❌ Technical | ✅ Natural |
|-------------|-----------|
| field: customerTier, operator: ==, value: vip | Khách VIP |
| bookingValue >= 2000000 | Đặt dịch vụ trên 2 triệu |
| dayOfWeek IN [6,7] | Cuối tuần |
| action: applyDiscount(15%) | Giảm 15% |

### 3. Template-First Discovery
**"80% of use cases covered by templates"**

Users should:
1. **Browse templates** first (not "Create from scratch")
2. **Customize template** (not start from blank canvas)
3. **Save as new template** (share knowledge)

Analogy: Canva doesn't make you design from scratch.

### 4. Instant Feedback
**"See result immediately, not after save"**


Every interaction should show:
- **Live preview** (natural language summary)
- **Visual graph** (optional, collapsed by default)
- **Example scenarios** ("Ví dụ: Khách Lan VIP đặt Combo 3tr → giảm 15%")

### 5. Contextual Intelligence
**"Show relevant options only"**

Example:
- If user selects "🎁 Khuyến mãi" intent → Only show discount/voucher/points actions
- If user selects "📅 Booking" intent → Only show assign/notify/reschedule actions
- Don't show all 50 actions at once

### 6. Explain Why (Future Sprint 5)
**"AI narrates decisions"**

Not just: "Rule triggered"  
But: "Bella chọn KTV Lan vì: ✓ Trống lịch ✓ Laser Expert ✓ Đánh giá 4.9"

---

## 👥 USER RESEARCH

### Primary Persona: Chị Mai (Spa Owner)

**Demographics:**
- Age: 35-45
- Role: Owner/Manager of 2-3 branch spa
- Tech savvy: Medium (uses Facebook, Zalo, Excel)
- Daily tasks: Staff management, customer care, finance review

**Pain Points:**
- "Tôi không hiểu JSON là gì"
- "Mỗi lần muốn thay đổi khuyến mãi phải gọi IT"
- "Không biết rule nào đang chạy, nào đang tắt"
- "Sợ làm sai, ảnh hưởng doanh thu"

**Goals:**
- Create promotion rules for holidays/events
- Auto-assign KTV based on skills/ratings
- Send birthday SMS automatically
- Calculate commission correctly

**Behaviors:**
- Prefers clicking over typing
- Likes visual confirmation (preview before save)
- Wants undo/rollback safety
- Shares successful strategies with other owners


### Secondary Persona: Anh Tuấn (Operations Manager)

**Demographics:**
- Age: 28-35
- Role: Operations/IT Manager at spa chain
- Tech savvy: High (familiar with software, APIs, some coding)
- Daily tasks: Configure systems, train staff, troubleshoot

**Pain Points:**
- "Chủ spa thay đổi rule liên tục, tôi phải config lại mãi"
- "Không có audit trail, không biết ai sửa gì"
- "Muốn test rule trước khi apply production"
- "Cần clone rule từ chi nhánh này sang chi nhánh khác"

**Goals:**
- Empower spa owners to self-serve
- Maintain audit trail and version control
- Test rules safely before deployment
- Share templates across franchise network

**Behaviors:**
- Comfortable with technical terms (but wants UX for owners)
- Values reliability over speed
- Needs export/import capabilities
- Wants API access for advanced customization

---

## 🗂️ INFORMATION ARCHITECTURE

### Navigation Structure

```
Dashboard
├─ 🎨 Automation Studio (NEW, renamed from "Rules")
│  ├─ 📚 Discover (Template Gallery)
│  ├─ ⚡ My Automations (Active rules list)
│  ├─ 📝 Drafts (Unsaved/incomplete)
│  ├─ 📊 Analytics (Rule performance)
│  └─ ⚙️ Settings (Notifications, permissions)
```

### Content Hierarchy

**Level 1: Intent Categories** (Homepage)
```
🎁 Khuyến mãi (Promotions)
📅 Booking (Auto-assignment, reminders)
👩 Nhân viên (HR, performance)
💰 Hoa hồng (Commission calculations)
📦 Kho (Inventory, reorder)
👥 Chăm sóc khách (Customer care, loyalty)
```


**Level 2: When (Conditions)** (Contextual based on intent)

For "🎁 Khuyến mãi" intent:
```
□ Khách VIP
□ Sinh nhật khách
□ Booking trên [số tiền]
□ Cuối tuần (Thứ 7, CN)
□ Dịch vụ cụ thể
□ Lần đầu đặt dịch vụ
□ Combo/Package
□ Flash Sale (giới hạn số lượng)
```

For "📅 Booking" intent:
```
□ Thời gian cụ thể
□ Loại dịch vụ
□ KTV trống lịch
□ Phòng còn chỗ
□ Khách yêu cầu
□ Tự động phân công
```

**Level 3: Action (What Bella will do)** (Contextual based on intent)

For "🎁 Khuyến mãi" intent:
```
💰 Giảm % (5%, 10%, 15%, 20%, custom)
🎁 Tặng Voucher (số tiền, thời hạn)
⭐ Tặng điểm (loyalty points)
📩 Gửi SMS (template có sẵn)
🔔 Thông báo (in-app notification)
```

For "📅 Booking" intent:
```
👤 Phân công KTV (auto-select best match)
📲 Gửi nhắc lịch (SMS/Zalo)
📅 Đề xuất lịch khác (if full)
✅ Tự động xác nhận (if conditions met)
```

---

## 🗺️ USER FLOWS

### Flow 1: Create Automation from Template (PRIMARY FLOW)

**Scenario:** Chị Mai wants VIP customers to get 15% discount on all services above 2 million VND.

**This is the MOST COMMON flow (95%+ of users will use this).**

**Steps:**

**Step 1: Template Gallery (Homepage)**
```
Screen: "Automation Studio"

[Search bar: 🔍 Tìm automation...]
[Filters: [🔥 Phổ biến] [🎁 Khuyến mãi] [📅 Booking] [👩 HR] [Tất cả]]

🔥 Phổ biến nhất

┌────────────────────────┐ ┌────────────────────────┐
│ 🎁 Khuyến mãi VIP 15%  │ │ 🎂 Sinh nhật giảm 20%  │
│ ──────────────────────│ │ ──────────────────────│
│ Tự động giảm giá cho   │ │ Tặng giảm giá và SMS   │
│ khách VIP booking >2tr │ │ cho khách sinh nhật    │
│                        │ │                        │
│ 👍 248 spa đang dùng   │ │ 👍 195 spa đang dùng   │
│ ⏱️ Tiết kiệm 3h/tuần   │ │ ⏱️ Tiết kiệm 2h/tuần   │
│                        │ │                        │
│ [Xem chi tiết] [Dùng]  │ │ [Xem chi tiết] [Dùng]  │
└────────────────────────┘ └────────────────────────┘

┌────────────────────────┐ ┌────────────────────────┐
│ 📅 Booking cuối tuần   │ │ 💎 VIP miễn phí massage│
│ ──────────────────────│ │ ──────────────────────│
│ Tự động phân công KTV  │ │ Tặng dịch vụ miễn phí  │
│ cho booking T7, CN     │ │ mỗi tháng cho VIP      │
│                        │ │                        │
│ 👍 167 spa đang dùng   │ │ 👍 142 spa đang dùng   │
│ ⏱️ Tiết kiệm 5h/tuần   │ │ ⏱️ Tăng retention 23%  │
│                        │ │                        │
│ [Xem chi tiết] [Dùng]  │ │ [Xem chi tiết] [Dùng]  │
└────────────────────────┘ └────────────────────────┘

[Xem thêm 25 mẫu khác →]

                [+ Tạo từ đầu]  ← Small button, bottom right
```

User clicks: **[Dùng]** on "🎁 Khuyến mãi VIP 15%"

**Step 2: Customize Template (90% Pre-filled)**
```
Screen: "Tùy chỉnh: Khuyến mãi VIP 15%"

[← Quay lại template gallery]

┌─────────────────────────────────────┬──────────────────────┐
│                                     │                      │
│ 📋 Thông tin cơ bản                 │ ✨ Bella sẽ:         │
│                                     │                      │
│ Tên automation                      │ Khi:                 │
│ [Khuyến mãi VIP 15%___________]     │ • Khách VIP          │
│                                     │ • Đặt dịch vụ >2tr   │
│ ─────────────────────────────────── │                      │
│                                     │ Bella sẽ:            │
│ 🎯 Áp dụng khi nào?                 │ • Giảm 15%           │
│                                     │ • Gửi SMS chúc mừng  │
│ ☑ Khách VIP                         │                      │
│   └─ Tier = VIP                     │ ────────────────────  │
│                                     │                      │
│ ☑ Đặt dịch vụ trên                  │ 💡 Ví dụ thực tế:    │
│   └─ [2,000,000______] VNĐ          │                      │
│       [1tr] [2tr] [3tr] [5tr]       │ Khách: Lan (VIP)     │
│         ↑ Suggestion chips          │ Dịch vụ: Combo       │
│                                     │ Giá: 2,500,000đ      │
│ ☐ Cuối tuần (optional)              │                      │
│                                     │ → Giảm 15%:          │
│ ─────────────────────────────────── │   -375,000đ          │
│                                     │                      │
│ 💰 Bella sẽ làm gì?                 │ → Khách trả:         │
│                                     │   2,125,000đ         │
│ ◉ Giảm giá                          │                      │
│   └─ [5% 10% [15%] 20% 25%]        │ → SMS gửi:           │
│       ↑ Slider                      │   "Chúc mừng! Bạn    │
│                                     │    được giảm 15%"    │
│ ☑ Gửi SMS thông báo                 │                      │
│   └─ Template: [Chúc mừng VIP ▾]   │ [📋 Copy]            │
│                                     │ [</> JSON]           │
│ ☐ Tặng điểm loyalty (optional)      │                      │
│                                     │                      │
│             [Xem trước →]           │                      │
│                                     │                      │
└─────────────────────────────────────┴──────────────────────┘

✨ Bella đã hiểu  ← Toast appears after any change
```

**Key Features:**
- 90% pre-filled (user only changes 1-2 values)
- Live preview with REAL customer example (not abstract text)
- Suggestion chips for common values
- Optional conditions collapsed by default
- Preview shows exact calculation (2.5M → -375k → 2.125M)

User changes: 15% → 20%, keeps everything else

**Step 3: Simulation (NEW! Test with Real Data)**
```
Screen: "Xem trước & Test"

[← Quay lại chỉnh sửa]

┌─────────────────────────────────────────────┐
│ 🧪 Test với khách hàng thực                  │
│ ───────────────────────────────────────────  │
│                                             │
│ Chọn khách để test:                         │
│ [Tìm khách hàng...________]                 │
│                                             │
│ Kết quả gợi ý:                              │
│ • Lan (VIP, 0979637535)                     │
│ • Mai (VIP, 0912345678)                     │
│ • Hoa (Loyal, 0987654321) ← Không đủ điều kiện│
│                                             │
│ [Chọn: Lan]                                 │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Giả lập booking:                            │
│ • Khách: Lan (VIP)                          │
│ • Dịch vụ: Combo Laser                      │
│ • Giá gốc: 2,500,000đ                       │
│                                             │
│ 🤖 Bella sẽ làm gì?                         │
│                                             │
│ ✅ Kiểm tra điều kiện:                      │
│    ✓ Khách VIP (match)                      │
│    ✓ Booking >2tr (match: 2.5tr)            │
│                                             │
│ ✅ Hành động:                               │
│    ✓ Giảm 20%: -500,000đ                    │
│    ✓ SMS gửi: "Chúc mừng! Bạn được giảm 20%"│
│                                             │
│ 💰 Kết quả:                                 │
│    Giá gốc:     2,500,000đ                  │
│    Giảm giá:     -500,000đ                  │
│    Khách trả:   2,000,000đ                  │
│                                             │
│ [Test khách khác] [Lưu automation →]        │
└─────────────────────────────────────────────┘
```

**This is HUGE! Users can test before saving → Confidence++**

User clicks: **[Lưu automation]**

**Step 4: Success State (Emotional!)**
```
Screen: "🎉 Automation đã được kích hoạt!"

[Centered card with animation]

┌─────────────────────────────────────────┐
│                                         │
│            🎉                           │  ← Animated (scale spring)
│                                         │
│       Xong rồi!                         │
│                                         │
│ "Khuyến mãi VIP 20%" đã được kích hoạt  │
│                                         │
│ Bella sẽ tự động:                       │
│ • Giảm 20% cho khách VIP booking >2tr   │
│ • Gửi SMS chúc mừng                     │
│                                         │
│ ✨ Automation này có thể tiết kiệm      │
│    khoảng 3 giờ mỗi tuần cho bạn!       │
│                                         │
│ Bắt đầu từ: 12/07/2026 23:30           │
│                                         │
│ [🔍 Xem chi tiết] [✏️ Chỉnh sửa]        │
│                                         │
│ [📋 Tạo automation tương tự]            │
│                                         │
└─────────────────────────────────────────┘

💡 Mẹo: Bạn có thể tạm dừng automation bất cứ lúc nào  ← Gentle tip

[← Về Automation Studio]  ← Auto-redirect after 3s
```

**Total time: <2 minutes** (because 90% pre-filled from template!)

---

### Flow 2: Create from Scratch (RARE, <5% users)

**Note:** This flow is intentionally harder to find. Most users should use templates.

**Access:** From template gallery → [+ Tạo từ đầu] button (bottom right, small)

**Steps:**

**Step 1: Intent Selection** (Only shown if creating from scratch)
```
Screen: "Tạo automation mới"

[← Quay lại template gallery]

Bạn muốn Bella làm gì?

┌─────────────────┐  ┌─────────────────┐  ┌──────────┐
│  🎁             │  │  📅             │  │  �      │
│  Khuyến mãi     │  │  Booking        │  │  Nhân    │
│  Giảm giá, tặng │  │  Phân công,     │  │  viên    │
│  quà, voucher   │  │  nhắc lịch      │  │  Lương,  │
│                 │  │                 │  │  KPI     │
└─────────────────┘  └─────────────────┘  └──────────┘

┌─────────────────┐  ┌─────────────────┐  ┌──────────┐
│  💰 Hoa hồng    │  │  📦 Kho         │  │  👥 Chăm │
│  Tính hoa hồng  │  │  Nhập xuất,     │  │  sóc KH  │
│  theo session   │  │  tồn kho        │  │  SMS,    │
│                 │  │                 │  │  loyalty │
└─────────────────┘  └─────────────────┘  └──────────┘
```

**Step 2-4:** Same as template flow, but starts with blank form (no pre-filled values)

**Why this flow exists:**
- For edge cases not covered by templates
- For power users who want full control
- But 95%+ users won't need this

---



**Scenario:** Chị Mai wants to see all active automations and edit one.

**Screen: "My Automations"** (Automation Studio > My Automations)
```
[Header]
🎨 Automation Studio

[Tabs]
[⚡ Đang chạy (12)] [📝 Nháp (3)] [📊 Analytics]

[Toolbar]
🔍 [Search: Tìm automation...]
[Filter: Tất cả ▾] [Sort: Mới nhất ▾]
[+ Tạo mới]

[List view, card-based]

┌──────────────────────────────────────────────────────┐
│ 🎁 Khuyến mãi VIP 15%                    [Đang chạy] │
│ ──────────────────────────────────────────────────── │
│ Giảm 15% cho khách VIP booking >2tr                  │
│                                                      │
│ 📊 Hôm nay: 8 lần kích hoạt | Tiết kiệm: 3.6tr     │
│ 📅 Tạo: 12/07/2026 | Bởi: Chị Mai                   │
│                                                      │
│ [👁️ Xem]  [✏️ Sửa]  [⏸️ Tạm dừng]  [⋯ More]        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 🎂 Sinh nhật giảm 15%                    [Đang chạy] │
│ ──────────────────────────────────────────────────── │
│ Gửi SMS + giảm 15% trong vòng 7 ngày trước/sau sinh  │
│ nhật                                                 │
│                                                      │
│ 📊 Tuần này: 12 lần | Tiết kiệm: 4.2tr             │
│ 📅 Tạo: 10/07/2026 | Từ mẫu: "Birthday Template"    │
│                                                      │
│ [👁️ Xem]  [✏️ Sửa]  [⏸️ Tạm dừng]  [⋯ More]        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 📅 Tự động phân công KTV                [Đang chạy] │
│ ──────────────────────────────────────────────────── │
│ Chọn KTV phù hợp dựa trên lịch trống, kỹ năng, đánh │
│ giá                                                  │
│                                                      │
│ 📊 Hôm nay: 24 booking tự động | 98% thành công     │
│ 📅 Tạo: 08/07/2026 | Bởi: Anh Tuấn (IT Manager)     │
│                                                      │
│ [👁️ Xem]  [✏️ Sửa]  [⏸️ Tạm dừng]  [⋯ More]        │
└──────────────────────────────────────────────────────┘

[Load more...]
```

User clicks: **[✏️ Sửa]** on "Khuyến mãi VIP 15%"

→ Goes to Step 2 of Flow 1 (edit mode, pre-filled)


---

### Flow 4: Analytics View

**Scenario:** Chị Mai wants to see which automations are most effective.

**Screen: "Automation Analytics"**
```
[Header] 🎨 Automation Studio > 📊 Analytics

[Date range picker]
[Tuần này ▾] [So sánh với tuần trước]

[Summary cards, 4 columns]
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 12           │ │ 248          │ │ 18.5 triệu   │ │ 98.2%        │
│ Automations  │ │ Kích hoạt    │ │ Giá trị xử lý│ │ Thành công   │
│ đang chạy    │ │ hôm nay      │ │ (tiết kiệm/  │ │              │
│              │ │              │ │ tạo ra)      │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

[Chart: Activation trend over time]
┌──────────────────────────────────────────────────────┐
│ Lượt kích hoạt automation theo ngày                  │
│                                                      │
│     █                                                │
│   █ █ █                                              │
│ █ █ █ █ █ █ █                                        │
│ T2 T3 T4 T5 T6 T7 CN                                 │
│                                                      │
│ ━━━ Khuyến mãi  ━━━ Booking  ━━━ Nhân viên          │
└──────────────────────────────────────────────────────┘

[Top performing automations]
┌──────────────────────────────────────────────────────┐
│ Top 5 Automation hiệu quả nhất                       │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ 1. 📅 Tự động phân công KTV                          │
│    ├─ 156 lần kích hoạt                             │
│    ├─ 98% thành công                                │
│    └─ Tiết kiệm ~2h công phân công thủ công/ngày    │
│                                                      │
│ 2. 🎁 Khuyến mãi VIP 15%                             │
│    ├─ 48 lần kích hoạt                              │
│    ├─ Doanh thu tạo ra: 24.6 triệu                  │
│    └─ ROI: 3.2x (chi 7.2tr giảm giá, thu 24.6tr)   │
│                                                      │
│ 3. 🎂 Sinh nhật giảm 15%                             │
│    ├─ 18 lần kích hoạt                              │
│    ├─ Conversion rate: 72% (18/25 khách phản hồi)   │
│    └─ Tăng retention: +12% khách quay lại           │
│                                                      │
│ [Xem tất cả →]                                       │
└──────────────────────────────────────────────────────┘
```



---

### Flow 5: Edit Existing Automation

**Scenario:** Chị Mai wants to increase VIP discount from 15% → 20% because of a special campaign.

**Steps:**

**Step 1: Navigate to Edit**
From "My Automations" list → Click **[✏️ Sửa]** on "Khuyến mãi VIP 15%"

**Step 2: Edit Mode (Pre-filled)**
```
Screen: "Chỉnh sửa: Khuyến mãi VIP 15%"

[Warning banner if automation is currently running]
┌──────────────────────────────────────────────────────┐
│ ⚠️ Automation này đang chạy                          │
│ Thay đổi sẽ áp dụng ngay sau khi lưu                │
│ [Tạm dừng trước khi sửa]                            │
└──────────────────────────────────────────────────────┘

[Breadcrumb: 🎁 Khuyến mãi > Chỉnh sửa]

[Step 2: When - Pre-filled, can modify]
☑ Khách VIP
☑ Booking trên [2,000,000] VNĐ

[Step 3: Action - Pre-filled, can modify]
◉ Giảm [20]% ← Changed from 15% to 20%
☑ Gửi SMS thông báo

[Preview panel - Live update]
┌─────────────────────────────────────────┐
│ ✨ Bella sẽ:                            │
│                                         │
│ Khi:                                    │
│ • Khách VIP                             │
│ • Đặt dịch vụ trên 2 triệu VNĐ          │
│                                         │
│ Bella sẽ:                               │
│ • Giảm 20% ← Thay đổi                   │
│ • Gửi SMS thông báo                     │
│                                         │
│ So sánh:                                │
│ Trước: Khách Lan booking 3tr → giảm 450k│
│ Sau:  Khách Lan booking 3tr → giảm 600k│
└─────────────────────────────────────────┘

[Buttons]
[← Hủy]  [💾 Lưu thay đổi]
```

**Step 3: Confirmation Modal**
```
┌──────────────────────────────────────────────────────┐
│ Xác nhận thay đổi?                                   │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ Bạn đang thay đổi:                                   │
│ • Giảm giá: 15% → 20%                                │
│                                                      │
│ Ảnh hưởng:                                           │
│ • Áp dụng ngay cho tất cả booking mới                │
│ • Không ảnh hưởng booking đã tạo                     │
│                                                      │
│ Ước tính:                                            │
│ • ~8 booking/ngày sẽ được giảm thêm 5%               │
│ • Chi phí tăng: ~400k/ngày                           │
│                                                      │
│ [← Quay lại]  [✅ Xác nhận thay đổi]                 │
└──────────────────────────────────────────────────────┘
```

**Step 4: Success + Audit Trail**
```
┌──────────────────────────────────────────────────────┐
│ ✅ Đã cập nhật!                                      │
│                                                      │
│ "Khuyến mãi VIP" đã được cập nhật                    │
│                                                      │
│ Thay đổi:                                            │
│ • 12/07/2026 23:45 - Chị Mai                         │
│ • Tăng giảm giá từ 15% lên 20%                       │
│                                                      │
│ [Xem lịch sử thay đổi]                              │
└──────────────────────────────────────────────────────┘
```

**Key Features:**
- ⚠️ Warning if automation is running (impact awareness)
- 📊 Live preview with before/after comparison
- 💰 Estimated impact (cost/benefit)
- 📝 Audit trail automatically recorded

---

### Flow 6: Debug Why Rule Didn't Trigger

**Scenario:** Chị Mai created "Flash Sale cuối tuần" but it didn't activate on Saturday. She wants to know why.

**Steps:**

**Step 1: Access Debug Mode**
From "My Automations" list → Click **[⋯ More]** → **[🔍 Debug]** on "Flash Sale cuối tuần"

**Step 2: Debug Dashboard**
```
Screen: "Debug: Flash Sale cuối tuần"

[Header]
🔍 Debug Mode: Flash Sale cuối tuần
[Status: ❌ Không kích hoạt hôm nay (0/3 booking kiểm tra)]

[Timeline view - Recent bookings checked]
┌──────────────────────────────────────────────────────┐
│ Booking được kiểm tra hôm nay (Thứ 7, 13/07/2026)    │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ 🔴 09:30 - Booking #1234 (Khách Lan, 2.5tr)          │
│    ├─ ✅ Điều kiện: Thứ 7 (match)                    │
│    ├─ ✅ Điều kiện: Booking >2tr (match)             │
│    ├─ ❌ Điều kiện: Slot còn lại >0 (FAILED)        │
│    │   └─ Hiện tại: 0/20 slot (đã hết quota)        │
│    └─ KẾT QUẢ: Không kích hoạt                      │
│                                                      │
│ 🔴 10:15 - Booking #1235 (Khách Mai, 1.8tr)          │
│    ├─ ✅ Điều kiện: Thứ 7 (match)                    │
│    ├─ ❌ Điều kiện: Booking >2tr (FAILED)            │
│    │   └─ Giá trị: 1,800,000đ < 2,000,000đ          │
│    └─ KẾT QUẢ: Không kích hoạt                      │
│                                                      │
│ 🟢 11:00 - Booking #1236 (Khách Hoa, 3tr)            │
│    ├─ ✅ Điều kiện: Thứ 7 (match)                    │
│    ├─ ✅ Điều kiện: Booking >2tr (match)             │
│    ├─ ❌ Điều kiện: Slot còn lại >0 (FAILED)        │
│    │   └─ Hiện tại: 0/20 slot (đã hết từ 09:15)    │
│    └─ KẾT QUẢ: Không kích hoạt                      │
└──────────────────────────────────────────────────────┘

[Root cause analysis - AI-powered]
┌──────────────────────────────────────────────────────┐
│ 🤖 Bella phát hiện vấn đề:                           │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ Nguyên nhân chính:                                   │
│ • Slot giới hạn (20 khách) đã hết từ 09:15 sáng     │
│ • 3/3 booking thỏa điều kiện khác nhưng hết quota    │
│                                                      │
│ Đề xuất:                                             │
│ 1. Tăng quota lên 50 khách (hiện tại: 20)           │
│ 2. Hoặc reset quota hàng giờ thay vì hàng ngày      │
│ 3. Hoặc loại bỏ giới hạn số lượng                   │
│                                                      │
│ [✏️ Sửa automation]  [📊 Xem thống kê đầy đủ]        │
└──────────────────────────────────────────────────────┘

[Simulation tool]
┌──────────────────────────────────────────────────────┐
│ 🧪 Test với booking giả                              │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ Khách hàng: [Chọn khách ▾] Lan (VIP)                │
│ Ngày booking: [13/07/2026 (Thứ 7)]                  │
│ Giá trị: [3,000,000] VNĐ                            │
│                                                      │
│ [▶️ Chạy simulation]                                 │
│                                                      │
│ KẾT QUẢ:                                             │
│ ❌ Không kích hoạt                                   │
│ Lý do: Slot đã hết (0/20)                           │
└──────────────────────────────────────────────────────┘
```

**Step 3: Quick Fix**
User clicks **[✏️ Sửa automation]** → Goes to edit mode with suggestion pre-filled (increase quota 20 → 50)

**Key Features:**
- 🔍 Timeline view of all bookings checked
- ✅❌ Pass/fail for each condition (visual clarity)
- 🤖 AI-powered root cause analysis
- 💡 Actionable suggestions
- 🧪 Simulation tool (test before fixing)

---

## 📐 WIREFRAMES

### Purpose
This section provides low-fidelity wireframes for all key screens to guide implementation. These are NOT final designs but structural blueprints.

### Wireframe Conventions
```
┌─────┐  = Container/Card
│     │  = Content area
├─────┤  = Divider
[Button]  = Interactive button
[Input____]  = Input field
☑ ☐  = Checkbox
◉ ○  = Radio button
▾  = Dropdown indicator
→  = Navigation/flow direction
```

---

### Wireframe 1: Intent Selection Screen (Step 1)

**Layout:** Centered grid, 2x3 cards

```
┌──────────────────────────────────────────────────────────┐
│ [Header: Logo] [Search] [User Menu]                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                 🎨 Automation Studio                      │
│                                                          │
│              Bạn muốn Bella làm gì?                      │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │                 │  │                 │  │          │ │
│  │  🎁             │  │  📅             │  │  👩      │ │
│  │                 │  │                 │  │          │ │
│  │  Khuyến mãi     │  │  Booking        │  │  Nhân    │ │
│  │                 │  │                 │  │  viên    │ │
│  │  Giảm giá, tặng │  │  Phân công,     │  │  Lương,  │ │
│  │  quà, voucher   │  │  nhắc lịch      │  │  KPI     │ │
│  │                 │  │                 │  │          │ │
│  └─────────────────┘  └─────────────────┘  └──────────┘ │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │  💰 Hoa hồng    │  │  📦 Kho         │  │  👥 Chăm │ │
│  │  Tính hoa hồng  │  │  Nhập xuất,     │  │  sóc KH  │ │
│  │  theo session   │  │  tồn kho        │  │  SMS,    │ │
│  │                 │  │                 │  │  loyalty │ │
│  └─────────────────┘  └─────────────────┘  └──────────┘ │
│                                                          │
│              [Hoặc bắt đầu từ mẫu có sẵn →]              │
│                                                          │
└──────────────────────────────────────────────────────────┘

```

**Responsive Breakpoints:**
- Desktop (>1024px): 3 cards per row
- Tablet (768-1024px): 2 cards per row
- Mobile (<768px): 1 card per row (stack vertically)

**Interaction:**
- Hover: Card lifts (shadow), icon animates (scale 1.1)
- Click: Fade out, slide to next step

---

### Wireframe 2: Condition Selection Screen (Step 2)

**Layout:** Left panel (conditions) + Right panel (preview)

```
┌──────────────────────────────────────────────────────────┐
│ [← Back] 🎁 Khuyến mãi > Khi nào? > ...                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─────────────────────────────┬──────────────────────┐  │
│ │                             │                      │  │
│ │  Áp dụng khi nào?           │  ✨ Bella sẽ:        │  │
│ │                             │                      │  │
│ │  ┌─────────────────────┐    │  Khi:                │  │
│ │  │☑ Khách VIP          │    │  • (Chưa chọn)       │  │
│ │  │  Khách có tier VIP  │    │                      │  │
│ │  └─────────────────────┘    │  Bella sẽ:           │  │
│ │                             │  • (Chưa chọn)       │  │
│ │  ┌─────────────────────┐    │                      │  │
│ │  │☐ Sinh nhật khách    │    │  Ví dụ:              │  │
│ │  │  Trong vòng X ngày  │    │  (Chưa có)           │  │
│ │  └─────────────────────┘    │                      │  │
│ │                             │                      │  │
│ │  ┌─────────────────────┐    │  [📋 Copy natural    │  │
│ │  │☑ Booking trên       │    │      language]       │  │
│ │  │  [2,000,000___] VNĐ │    │  [</> Xem JSON]      │  │
│ │  └─────────────────────┘    │                      │  │
│ │                             │                      │  │
│ │  ┌─────────────────────┐    └──────────────────────┘  │
│ │  │☐ Cuối tuần          │                             │
│ │  │  Thứ 7, Chủ nhật    │                             │
│ │  └─────────────────────┘                             │
│ │                                                      │
│ │  [+ Thêm điều kiện]                                  │
│ │                                                      │
│ │              [Tiếp theo →]                           │
│ │                                                      │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- **Left Panel (60% width):**
  - Condition cards (checkbox + label + description)
  - Expandable details (collapsed by default)
  - Sticky "Next" button at bottom
  
- **Right Panel (40% width):**
  - Sticky preview (always visible)
  - Live updates as conditions change
  - Copy to clipboard button (for sharing)
  - View JSON button (for tech users, collapsed)

**Responsive Breakpoints:**
- Desktop: Side-by-side (60/40)
- Tablet: Side-by-side (50/50)
- Mobile: Stack vertically (Preview as floating bottom sheet)

---

### Wireframe 3: Action Selection Screen (Step 3)

**Layout:** Similar to Step 2 (left panel + right preview)

```
┌──────────────────────────────────────────────────────────┐
│ [← Back] 🎁 Khuyến mãi > Khi nào? > Bella làm gì?        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─────────────────────────────┬──────────────────────┐  │
│ │                             │                      │  │
│ │  Bella sẽ làm gì?           │  ✨ Bella sẽ:        │  │
│ │                             │                      │  │
│ │  Hành động chính            │  Khi:                │  │
│ │  (Chọn 1)                   │  • Khách VIP         │  │
│ │                             │  • Booking >2tr      │  │
│ │  ┌─────────────────────┐    │                      │  │
│ │  │◉ 💰 Giảm %          │    │  Bella sẽ:           │  │
│ │  │                     │    │  • Giảm 15%          │  │
│ │  │  [5% 10% [15%] 20%] │    │  • Gửi SMS           │  │
│ │  │  [Custom: ____]     │    │                      │  │
│ │  └─────────────────────┘    │  Ví dụ:              │  │
│ │                             │  Khách Lan (VIP)     │  │
│ │  ┌─────────────────────┐    │  đặt Combo 3tr       │  │
│ │  │○ 🎁 Tặng Voucher    │    │  → Giảm 450,000đ     │  │
│ │  │  Số tiền: [____] VNĐ│    │  → Thanh toán:       │  │
│ │  │  Hạn: [30] ngày     │    │     2,550,000đ       │  │
│ │  └─────────────────────┘    │                      │  │
│ │                             └──────────────────────┘  │
│ │  ┌─────────────────────┐                             │
│ │  │○ ⭐ Tặng điểm       │                             │
│ │  │  [____] điểm loyalty│                             │
│ │  └─────────────────────┘                             │
│ │                                                      │
│ │  Hành động phụ (Tùy chọn)                            │
│ │                                                      │
│ │  ┌─────────────────────┐                             │
│ │  │☑ 📩 Gửi SMS         │                             │
│ │  │  [Template: ▾]      │                             │
│ │  └─────────────────────┘                             │
│ │                                                      │
│ │  ┌─────────────────────┐                             │
│ │  │☐ 🔔 Thông báo       │                             │
│ │  │  In-app             │                             │
│ │  └─────────────────────┘                             │
│ │                                                      │
│ │              [Xem trước →]                           │
│ │                                                      │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key Interaction:**
- **Primary Action:** Radio buttons (only 1 allowed)
- **Secondary Actions:** Checkboxes (multiple allowed)
- **Slider Component:** For percentage (5-25% range, 5% increments)
- **Live Preview:** Updates immediately on interaction

---

### Wireframe 4: Preview & Confirm Screen (Step 4)

**Layout:** Centered card with large preview

```
┌──────────────────────────────────────────────────────────┐
│ [← Back] 🎁 Khuyến mãi > ... > Xác nhận                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              ┌────────────────────────────┐              │
│              │                            │              │
│              │ 🎁 Khuyến mãi VIP 15%      │              │
│              │ ────────────────────────── │              │
│              │                            │              │
│              │ ✨ Bella sẽ tự động:       │              │
│              │                            │              │
│              │ Khi:                       │              │
│              │ ├─ Khách VIP               │              │
│              │ └─ Đặt dịch vụ >2tr VNĐ    │              │
│              │                            │              │
│              │ Bella sẽ:                  │              │
│              │ ├─ Giảm 15% tổng giá trị   │              │
│              │ └─ Gửi SMS thông báo       │              │
│              │                            │              │
│              │ Ví dụ thực tế:             │              │
│              │ • Lan (VIP) đặt Combo 3tr  │              │
│              │   → Giảm 450,000đ          │              │
│              │ • Mai (VIP) đặt Massage    │              │
│              │   2.5tr → Giảm 375,000đ    │              │
│              │                            │              │
│              │ [▼ Xem JSON (cho IT)]      │              │
│              │                            │              │
│              └────────────────────────────┘              │
│                                                          │
│              Tên automation                              │
│              [Khuyến mãi VIP 15%___________]             │
│                                                          │
│              Kích hoạt                                   │
│              ◉ Bật ngay    ○ Lưu nháp                    │
│                                                          │
│              [← Quay lại]    [💾 Lưu automation]         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- **Preview Card:** Large, centered, read-only summary
- **Name Input:** Pre-filled with smart default (editable)
- **Status Toggle:** Bật ngay (active immediately) vs Lưu nháp (draft)
- **JSON Viewer:** Collapsed by default (expandable for tech users)

---

### Wireframe 5: Success State Screen (Step 5)

**Layout:** Centered success message with quick actions

```
┌──────────────────────────────────────────────────────────┐
│ [Header: Logo] [Search] [User Menu]                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              ┌────────────────────────────┐              │
│              │                            │              │
│              │       ✅ Thành công!       │              │
│              │                            │              │
│              │ "Khuyến mãi VIP 15%"       │              │
│              │ đã được kích hoạt          │              │
│              │                            │              │
│              │ Bella sẽ tự động:          │              │
│              │ • Giảm 15% cho khách VIP   │              │
│              │   booking >2tr             │              │
│              │ • Gửi SMS thông báo        │              │
│              │                            │              │
│              │ Bắt đầu từ:                │              │
│              │ 12/07/2026 23:30           │              │
│              │                            │              │
│              └────────────────────────────┘              │
│                                                          │
│         [🔍 Xem chi tiết]  [✏️ Chỉnh sửa]                │
│                                                          │
│              [📋 Tạo automation tương tự]                │
│                                                          │
│              [← Về Automation Studio]                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Auto-redirect:** After 3 seconds, automatically go to "My Automations" list (with skip button)

---

### Wireframe 6: My Automations List Screen

**Layout:** Toolbar + Card list

```
┌──────────────────────────────────────────────────────────┐
│ [Header: Logo] [Search] [User Menu]                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 🎨 Automation Studio                                     │
│                                                          │
│ [⚡ Đang chạy (12)] [📝 Nháp (3)] [📊 Analytics]          │
│                                                          │
│ 🔍 [Tìm automation...________]  [Filter: Tất cả ▾]       │
│ [Sort: Mới nhất ▾]                        [+ Tạo mới]    │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🎁 Khuyến mãi VIP 15%             [● Đang chạy]      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ Giảm 15% cho khách VIP booking >2tr                  │ │
│ │                                                      │ │
│ │ 📊 Hôm nay: 8 lần | Tiết kiệm: 3.6tr                │ │
│ │ 📅 Tạo: 12/07/2026 | Bởi: Chị Mai                   │ │
│ │                                                      │ │
│ │ [👁️ Xem] [✏️ Sửa] [⏸️ Tạm dừng] [⋯]                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🎂 Sinh nhật giảm 15%             [● Đang chạy]      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ Gửi SMS + giảm 15% trong vòng 7 ngày sinh nhật      │ │
│ │                                                      │ │
│ │ 📊 Tuần này: 12 lần | Tiết kiệm: 4.2tr              │ │
│ │ 📅 Tạo: 10/07/2026 | Từ mẫu: "Birthday Template"    │ │
│ │                                                      │ │
│ │ [👁️ Xem] [✏️ Sửa] [⏸️ Tạm dừng] [⋯]                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📅 Tự động phân công KTV          [● Đang chạy]      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ Chọn KTV dựa trên lịch, kỹ năng, đánh giá           │ │
│ │                                                      │ │
│ │ 📊 Hôm nay: 24 booking | 98% thành công             │ │
│ │ 📅 Tạo: 08/07/2026 | Bởi: Anh Tuấn                  │ │
│ │                                                      │ │
│ │ [👁️ Xem] [✏️ Sửa] [⏸️ Tạm dừng] [⋯]                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [Load more...]                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- Status indicator: ● (green = active, gray = paused, orange = draft)
- Stats row: 📊 icon + metrics (compact format)
- Action buttons: Icon + label (primary actions visible, secondary in dropdown)

---

## 🧩 COMPONENT LIBRARY

### Purpose
Define reusable UI components to ensure consistency and accelerate implementation.

---

### Component 1: IntentCard

**Purpose:** Large clickable card for intent selection (Step 1)

**Anatomy:**
```
┌─────────────────────┐
│                     │
│  [Icon: 64px]       │ ← Lucide React icon
│                     │
│  Title              │ ← 20px bold
│  ─────────────────  │
│  Subtitle           │ ← 14px regular, gray
│  (2 lines max)      │
│                     │
└─────────────────────┘
```

**Specifications:**
- **Size:** 200x180px (Desktop), 100% width (Mobile)
- **Padding:** 24px
- **Border:** 1px solid rose-200
- **Border Radius:** 12px
- **Background:** White
- **Hover State:**
  - Shadow: 0 8px 16px rgba(244, 63, 94, 0.15)
  - Transform: translateY(-4px)
  - Icon scale: 1.1
  - Transition: 200ms ease-out
- **Active State:**
  - Border: 2px solid rose-500
  - Background: rose-50

**Props (TypeScript):**
```typescript
interface IntentCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  isSelected?: boolean;
}
```

**Accessibility:**
- `role="button"`
- `aria-label={title}`
- `tabindex="0"`
- Keyboard: Enter/Space to activate

---

### Component 2: ConditionChip

**Purpose:** Checkbox card for condition selection (Step 2)

**Anatomy:**
```
┌─────────────────────────────┐
│ ☑ Label Text                │ ← Checkbox + 16px medium
│   Description (gray, 14px)  │ ← Optional description
│   [Expandable details...]   │ ← Collapsed by default
└─────────────────────────────┘
```

**Specifications:**
- **Size:** 100% width, min-height 60px
- **Padding:** 16px
- **Border:** 1px solid gray-200
- **Border Radius:** 8px
- **Background:** White (unchecked), rose-50 (checked)
- **Hover State:**
  - Border: rose-300
  - Cursor: pointer
- **Checked State:**
  - Border: 2px solid rose-500
  - Background: rose-50
  - Checkbox: rose-500

**Props (TypeScript):**
```typescript
interface ConditionChipProps {
  label: string;
  description?: string;
  isChecked: boolean;
  onChange: (checked: boolean) => void;
  expandableContent?: React.ReactNode;
}
```

**Interaction:**
- Click anywhere on card → Toggle checkbox
- Click expand icon → Show/hide details (doesn't toggle checkbox)

---

### Component 3: ActionRadioCard

**Purpose:** Radio button card for action selection (Step 3)

**Anatomy:**
```
┌─────────────────────────────┐
│ ◉ [Icon] Label Text         │ ← Radio + Icon + 16px medium
│   ─────────────────────────  │
│   [Configuration controls]  │ ← Slider, input, dropdown
└─────────────────────────────┘
```

**Specifications:**
- **Size:** 100% width, auto height
- **Padding:** 20px
- **Border:** 2px solid gray-200
- **Border Radius:** 12px
- **Background:** White (unchecked), gradient rose-50→rose-100 (checked)
- **Selected State:**
  - Border: 3px solid rose-500
  - Shadow: 0 4px 12px rgba(244, 63, 94, 0.2)

**Props (TypeScript):**
```typescript
interface ActionRadioCardProps {
  icon: LucideIcon;
  label: string;
  isSelected: boolean;
  onChange: () => void;
  children?: React.ReactNode; // Configuration controls
}
```

---

### Component 4: PreviewPanel

**Purpose:** Sticky side panel showing live automation summary (Steps 2-3)

**Anatomy:**
```
┌─────────────────────────────┐
│ ✨ Bella sẽ:                │ ← Heading
│                             │
│ Khi:                        │ ← Section title
│ • Condition 1               │ ← Bullet list
│ • Condition 2               │
│                             │
│ Bella sẽ:                   │ ← Section title
│ • Action 1                  │
│ • Action 2                  │
│                             │
│ Ví dụ:                      │ ← Section title
│ [Example scenario]          │ ← Prose text
│                             │
│ [📋 Copy]  [</> JSON]       │ ← Action buttons
└─────────────────────────────┘
```

**Specifications:**
- **Size:** 360px width (Desktop), 100% width (Mobile bottom sheet)
- **Padding:** 24px
- **Border:** 1px solid rose-200
- **Border Radius:** 16px
- **Background:** Linear gradient rose-50 → white
- **Position:** Sticky (top: 80px on Desktop)

**Props (TypeScript):**
```typescript
interface PreviewPanelProps {
  conditions: string[]; // Natural language conditions
  actions: string[]; // Natural language actions
  exampleScenario?: string;
  jsonData?: object; // For "View JSON" feature
}
```

**Responsive:**
- Desktop: Fixed right panel (40% width)
- Tablet: Fixed right panel (35% width)
- Mobile: Floating bottom sheet (slides up on scroll, collapsible)

---

### Component 5: ProgressDots

**Purpose:** Show current step in creation flow (Steps 1-4)

**Anatomy:**
```
● ○ ○ ○  ← Step 1/4
```

**Specifications:**
- **Dot Size:** 12px diameter
- **Spacing:** 8px between dots
- **Active Dot:** rose-500, solid fill
- **Inactive Dot:** gray-300, hollow (2px border)
- **Completed Dot:** rose-500, checkmark icon

**Props (TypeScript):**
```typescript
interface ProgressDotsProps {
  totalSteps: number;
  currentStep: number; // 1-indexed
}
```

**Placement:** Top center of screen (below breadcrumb, above main content)

---

### Component 6: AutomationCard (List Item)

**Purpose:** Display automation in "My Automations" list

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│ 🎁 Title                              [● Status]     │
│ ──────────────────────────────────────────────────── │
│ Description (1-2 lines, truncate with ...)           │
│                                                      │
│ 📊 Stats row | 📅 Metadata row                      │
│                                                      │
│ [👁️ Xem]  [✏️ Sửa]  [⏸️ Tạm dừng]  [⋯ More]         │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Size:** 100% width, min-height 140px
- **Padding:** 20px
- **Border:** 1px solid gray-200
- **Border Radius:** 12px
- **Background:** White
- **Hover State:**
  - Border: rose-300
  - Shadow: 0 4px 8px rgba(0,0,0,0.08)

**Props (TypeScript):**
```typescript
interface AutomationCardProps {
  id: string;
  icon: string; // Emoji
  title: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  stats: {
    label: string;
    value: string | number;
  }[];
  metadata: {
    createdAt: Date;
    createdBy: string;
    template?: string;
  };
  onView: () => void;
  onEdit: () => void;
  onPause: () => void;
  onMore: () => void;
}
```

---

### Component 7: DebugTimeline

**Purpose:** Show booking evaluation results in debug mode (Flow 6)

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│ 🔴 09:30 - Booking #1234 (Khách Lan, 2.5tr)          │
│    ├─ ✅ Điều kiện: Thứ 7 (match)                    │
│    ├─ ✅ Điều kiện: Booking >2tr (match)             │
│    ├─ ❌ Điều kiện: Slot còn lại >0 (FAILED)        │
│    │   └─ Hiện tại: 0/20 slot                       │
│    └─ KẾT QUẢ: Không kích hoạt                      │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Icon:** 🟢 (success) | 🔴 (failed) | 🟡 (partial)
- **Indent:** 24px per level (tree structure)
- **Font:** Monospace for values (e.g., "0/20 slot")
- **Colors:**
  - ✅ Green (#10b981)
  - ❌ Red (#ef4444)
  - Text: Gray-700

**Props (TypeScript):**
```typescript
interface DebugTimelineProps {
  evaluations: {
    bookingId: string;
    timestamp: Date;
    customerName: string;
    bookingValue: number;
    result: 'success' | 'failed' | 'partial';
    conditions: {
      label: string;
      passed: boolean;
      actualValue?: string;
      expectedValue?: string;
    }[];
  }[];
}
```

---

### Component 8: TemplateCard

**Purpose:** Display template in gallery (Template Discovery)

**Anatomy:**
```
┌────────────────────────┐
│ 🎂 Sinh nhật giảm 20%  │ ← Title with emoji
│ ──────────────────────│
│ Tặng giảm giá cho khách│ ← Description (2 lines)
│ trong ngày sinh nhật   │
│                        │
│ 👍 248 spa đang dùng   │ ← Social proof
│ [Xem chi tiết]  [Dùng] │ ← Actions
└────────────────────────┘
```

**Specifications:**
- **Size:** 300x200px (Desktop), 100% width (Mobile)
- **Padding:** 20px
- **Border:** 1px solid gray-200
- **Border Radius:** 12px
- **Background:** White
- **Hover State:**
  - Border: rose-300
  - Shadow: 0 6px 12px rgba(244, 63, 94, 0.12)
  - [Dùng] button: rose-600

**Props (TypeScript):**
```typescript
interface TemplateCardProps {
  id: string;
  emoji: string;
  title: string;
  description: string;
  usageCount: number; // Number of spas using this
  onViewDetails: () => void;
  onUse: () => void;
}
```

---

### Component 9: SmartInput

**Purpose:** Input field with smart suggestions and validation

**Anatomy:**
```
┌─────────────────────────────┐
│ [Label]                     │
│ [Input field____________]   │ ← With icon (left) + unit (right)
│ [Suggestion chips below]    │ ← Common values
│ [Validation message]        │ ← Error/success feedback
└─────────────────────────────┘
```

**Specifications:**
- **Height:** 48px (input field)
- **Border:** 1px solid gray-300
- **Border Radius:** 8px
- **Focus State:**
  - Border: 2px solid rose-500
  - Shadow: 0 0 0 4px rgba(244, 63, 94, 0.1)
- **Error State:**
  - Border: 2px solid red-500
  - Background: red-50

**Props (TypeScript):**
```typescript
interface SmartInputProps {
  label: string;
  type: 'number' | 'text' | 'currency';
  value: string | number;
  onChange: (value: string | number) => void;
  suggestions?: (string | number)[]; // Common values
  unit?: string; // e.g., "VNĐ", "%", "ngày"
  icon?: LucideIcon;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    errorMessage?: string;
  };
}
```

**Examples:**
- Booking value input: Icon (💰), Unit (VNĐ), Suggestions ([1tr, 2tr, 3tr, 5tr])
- Discount percentage: Icon (%), Unit (%), Suggestions ([5%, 10%, 15%, 20%])

---

### Component 10: AIInsightCard

**Purpose:** Show AI-powered suggestions and explanations (Debug mode)

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│ 🤖 Bella phát hiện vấn đề:                           │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ Nguyên nhân chính:                                   │
│ • [Insight 1]                                        │
│ • [Insight 2]                                        │
│                                                      │
│ Đề xuất:                                             │
│ 1. [Suggestion 1]                                    │
│ 2. [Suggestion 2]                                    │
│                                                      │
│ [✏️ Sửa automation]  [📊 Xem thống kê đầy đủ]        │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Border:** 2px solid blue-300 (distinct from normal cards)
- **Background:** Linear gradient blue-50 → white
- **Icon:** 🤖 (robot emoji, large 32px)
- **Padding:** 24px
- **Border Radius:** 12px

**Props (TypeScript):**
```typescript
interface AIInsightCardProps {
  rootCauses: string[]; // List of identified issues
  suggestions: string[]; // List of actionable suggestions
  onFix?: () => void; // Quick fix action
  onViewDetails?: () => void; // View full analytics
}
```

---

### Component 11: CommandPalette

**Purpose:** Global command palette (Ctrl+K) for power users

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│ 🔍 [Search input..._______________]                  │ ← Autofocus
│                                                      │
│ [Section title]                                      │
│ ├─ [Icon] [Label] [Shortcut]                        │
│ ├─ [Icon] [Label] [Shortcut]                        │
│ └─ [Icon] [Label] [Shortcut]                        │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Size:** 600px width, max-height 500px (scrollable)
- **Position:** Fixed center of screen
- **Padding:** 16px
- **Border Radius:** 16px
- **Background:** White with 0 20px 60px rgba(0,0,0,0.3) shadow
- **Backdrop:** Semi-transparent dark overlay (rgba(0,0,0,0.5))
- **Animation:** Scale from 0.95 to 1.0 (spring, 200ms)

**Props (TypeScript):**
```typescript
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  recentItems?: AutomationSummary[];
  quickActions?: QuickAction[];
  onSelect: (item: CommandItem) => void;
}

interface CommandItem {
  id: string;
  type: 'automation' | 'template' | 'action' | 'customer';
  label: string;
  icon: LucideIcon;
  shortcut?: string; // e.g., "Ctrl+N"
  action: () => void;
}
```

**Search Behavior:**
- Fuzzy search (finds "vip" in "Khuyến mãi VIP")
- Debounced (300ms)
- Keyboard navigation (Arrow keys + Enter)
- Categories collapsed if no matches

**Keyboard Shortcuts:**
```
Ctrl/Cmd + K:  Toggle palette
Esc:           Close palette
Arrow Up/Down: Navigate items
Enter:         Execute selected item
Ctrl/Cmd + 1-9: Jump to numbered item
```

---

### Component 12: AutomationCanvas (Visual Node Editor)

**Purpose:** Visual drag-and-drop automation builder (alternative to form-based)

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  WHEN                                                │
│  ┌───────────┐                                       │
│  │ Khách VIP │  ← Draggable node                     │
│  └─────┬─────┘                                       │
│        │                                             │
│        │ ← Connector line                            │
│        │                                             │
│  ┌─────┴─────┐                                       │
│  │ Booking   │                                       │
│  │ >2tr      │                                       │
│  └─────┬─────┘                                       │
│        │                                             │
│        ↓                                             │
│                                                      │
│  THEN                                                │
│  ┌───────────┐                                       │
│  │ Giảm 15%  │                                       │
│  └─────┬─────┘                                       │
│        │                                             │
│        ↓                                             │
│  ┌───────────┐                                       │
│  │ Gửi SMS   │                                       │
│  └───────────┘                                       │
│                                                      │
│  [+ Add condition]  [+ Add action]                   │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Canvas:** Infinite scroll (pan with mouse drag)
- **Node Size:** 180x80px (auto-expand if content exceeds)
- **Node Style:**
  - Border: 2px solid rose-300
  - Border Radius: 12px
  - Background: White
  - Shadow: 0 2px 8px rgba(0,0,0,0.1)
- **Connector:** Bezier curve, rose-400, 2px width
- **Drag & Drop:** Smooth animation (Framer Motion)

**Props (TypeScript):**
```typescript
interface AutomationCanvasProps {
  conditions: ConditionNode[];
  actions: ActionNode[];
  onAddCondition: () => void;
  onAddAction: () => void;
  onEditNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

interface ConditionNode {
  id: string;
  type: 'vip' | 'booking_value' | 'birthday' | 'weekend';
  label: string;
  config?: Record<string, any>;
  position: { x: number; y: number };
}
```

**Interactions:**
- Click node → Edit inline
- Drag node → Reposition
- Drag from node handle → Create connection
- Delete key → Delete selected node
- Ctrl+Z → Undo
- Ctrl+Y → Redo

**Why Canvas View:**
- Visual learners prefer this over forms
- Shows automation logic at-a-glance
- Easier to see complex multi-condition rules
- Future: Support workflow (multi-step automations)

**Note:** This is NOT in MVP (Sprint 1-6). Planned for V2.0 (Sprint 10+).

---

### Component 13: EmptyStateCard

**Purpose:** Show personality in empty states (not just "No data")

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              ┌─────┐                                 │
│              │     │                                 │
│              │ ✨  │  ← Large icon (64px)            │
│              │     │                                 │
│              └─────┘                                 │
│                                                      │
│         [Headline, bold, 20px]                       │
│                                                      │
│         [Description, 14px, gray-600]                │
│         [2 lines max]                                │
│                                                      │
│      ┌─────────────┐  ┌─────────────┐              │
│      │ Primary CTA │  │ Secondary   │              │
│      └─────────────┘  └─────────────┘              │
│                                                      │
│         [Quick actions, chips style]                 │
│         [🎁 VIP] [🎂 Sinh nhật] [📅 Booking]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Size:** 100% width, min-height 400px
- **Alignment:** Center (vertically and horizontally)
- **Padding:** 48px
- **Background:** Gradient (rose-50 to white)
- **Border Radius:** 16px

**Props (TypeScript):**
```typescript
interface EmptyStateCardProps {
  icon: LucideIcon | string; // Lucide icon or emoji
  headline: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  quickActions?: {
    icon: string;
    label: string;
    onClick: () => void;
  }[];
}
```

**Examples:**

**Empty Automation List:**
```tsx
<EmptyStateCard
  icon="✨"
  headline="Bắt đầu tự động hóa với Bella"
  description="Chưa có automation nào. Hãy tạo automation đầu tiên để Bella giúp bạn tiết kiệm thời gian."
  primaryAction={{
    label: "Xem mẫu có sẵn",
    onClick: () => router.push('/automation/templates')
  }}
  secondaryAction={{
    label: "Tạo từ đầu",
    onClick: () => router.push('/automation/new')
  }}
  quickActions={[
    { icon: "🎁", label: "VIP", onClick: () => useTemplate('vip') },
    { icon: "🎂", label: "Sinh nhật", onClick: () => useTemplate('birthday') },
    { icon: "📅", label: "Booking", onClick: () => useTemplate('booking') }
  ]}
/>
```

**No Search Results:**
```tsx
<EmptyStateCard
  icon={Search}
  headline="Không tìm thấy automation"
  description='Không có automation nào khớp với "xyz". Thử tìm kiếm với từ khóa khác hoặc tạo mới.'
  primaryAction={{
    label: "Xóa tìm kiếm",
    onClick: () => setSearchQuery('')
  }}
  secondaryAction={{
    label: "Tạo automation mới",
    onClick: () => router.push('/automation/new')
  }}
/>
```

---

### Component 14: VersionHistoryTimeline

**Purpose:** Show edit history with restore capability (like Notion)

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│ 📜 Lịch sử chỉnh sửa                                 │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ ● Hiện tại (12/07/2026 23:45)                       │
│ │ Chị Mai: Tăng giảm giá từ 15% lên 20%             │
│ │ [Restore version]                                  │
│ │                                                    │
│ ● 12/07/2026 14:30                                   │
│ │ Anh Tuấn: Thêm điều kiện "Cuối tuần"              │
│ │ [Restore version]                                  │
│ │                                                    │
│ ● 10/07/2026 09:15                                   │
│ │ Chị Mai: Tạo automation từ template "VIP 15%"     │
│ │ [Restore version]                                  │
│ │                                                    │
│ [Load older versions →]                              │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- **Timeline Style:** Vertical line (2px, rose-300)
- **Dot:** 12px diameter, rose-500 (current), gray-400 (past)
- **Padding:** 24px
- **Max Height:** 500px (scrollable)

**Props (TypeScript):**
```typescript
interface VersionHistoryTimelineProps {
  versions: AutomationVersion[];
  currentVersionId: string;
  onRestore: (versionId: string) => void;
}

interface AutomationVersion {
  id: string;
  timestamp: Date;
  author: {
    name: string;
    role: string;
  };
  changesSummary: string; // e.g., "Tăng giảm giá từ 15% lên 20%"
  isCurrentVersion: boolean;
}
```

**Restore Confirmation:**
```tsx
// When user clicks [Restore version]
<ConfirmDialog
  title="Khôi phục phiên bản này?"
  description="Automation sẽ quay lại trạng thái lúc 12/07/2026 14:30. Bạn có thể hoàn tác sau."
  confirmLabel="Khôi phục"
  cancelLabel="Hủy"
  onConfirm={() => restoreVersion(versionId)}
/>
```

**Why This Matters:**
- Users make mistakes → Need to rollback
- Audit trail (who changed what, when)
- Confidence to experiment (can always restore)

---

### Design Tokens (Shared Variables)

**Colors:**
```css
--color-primary: #f43f5e; /* rose-500 */
--color-primary-light: #ffe4e6; /* rose-50 */
--color-primary-dark: #be123c; /* rose-700 */
--color-success: #10b981; /* green-500 */
--color-error: #ef4444; /* red-500 */
--color-warning: #f59e0b; /* amber-500 */
--color-info: #3b82f6; /* blue-500 */
```

**Spacing:**
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

**Typography:**
```css
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-md: 16px;
--font-size-lg: 20px;
--font-size-xl: 24px;

--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-bold: 700;
```

**Border Radius:**
```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
```

---

## 🎨 VISUAL DESIGN SYSTEM

### Purpose
Define the visual language to ensure Bella Automation Studio feels cohesive with the rest of Bella ERP while standing out as a distinct, modern feature.

---

### Color Palette

**Primary Theme: Rose/Pink (Baby Care Default)**
```
Rose-50:  #ffe4e6  (Background, subtle highlights)
Rose-100: #fecdd3  (Hover states, light borders)
Rose-200: #fda4af  (Borders, dividers)
Rose-400: #fb7185  (Icons, accents)
Rose-500: #f43f5e  (Primary actions, selected states) ← Main brand color
Rose-600: #e11d48  (Hover on primary actions)
Rose-700: #be123c  (Active states, pressed)
```

**Module-Specific Overrides:**
- Beauty Spa: Teal/Green shades (via CSS variables)
- Future modules: Override via `html[data-tenant-module="module_key"]`

**Semantic Colors:**
```
Success: #10b981 (green-500)  - Rule active, condition passed
Error:   #ef4444 (red-500)    - Rule failed, validation error
Warning: #f59e0b (amber-500)  - Draft state, attention needed
Info:    #3b82f6 (blue-500)   - AI insights, help tooltips
```

**Neutral Palette:**
```
Gray-50:  #f9fafb  (Page background)
Gray-100: #f3f4f6  (Card background)
Gray-200: #e5e7eb  (Borders)
Gray-300: #d1d5db  (Disabled states)
Gray-400: #9ca3af  (Placeholder text)
Gray-500: #6b7280  (Secondary text)
Gray-700: #374151  (Primary text)
Gray-900: #111827  (Headings)
```

---

### Typography

**Font Family:**
```
Primary: Inter, system-ui, -apple-system, sans-serif
Monospace: 'Fira Code', 'Courier New', monospace (for JSON, debug logs)
```

**Type Scale:**
```
Display (32px/40px): Automation Studio title
Heading 1 (24px/32px): Page titles ("Bạn muốn Bella làm gì?")
Heading 2 (20px/28px): Section titles ("Áp dụng khi nào?")
Heading 3 (18px/24px): Card titles
Body Large (16px/24px): Primary content, preview panel
Body (14px/20px): Descriptions, secondary text
Small (12px/16px): Metadata, captions, stats
```

**Font Weights:**
```
Regular (400): Body text, descriptions
Medium (500): Labels, buttons
Semibold (600): Headings, emphasized text
Bold (700): Display titles, important metrics
```

---

### Iconography

**Icon Library:** Lucide React

**Icon Sizes:**
```
Small (16px):  Inline with text, form labels
Medium (24px): Buttons, list items
Large (32px):  Intent cards, section headers
XLarge (64px): Intent selection cards (Step 1)
```

**Intent Icons Mapping:**
```
🎁 Khuyến mãi   → Gift icon (Lucide: Gift)
📅 Booking      → Calendar icon (Lucide: Calendar)
👩 Nhân viên    → Users icon (Lucide: Users)
💰 Hoa hồng     → DollarSign icon (Lucide: DollarSign)
📦 Kho          → Package icon (Lucide: Package)
👥 Chăm sóc KH  → Heart icon (Lucide: Heart)
```

**Action Icons:**
```
Discount:      Percent (Lucide: Percent)
Voucher:       Ticket (Lucide: Ticket)
Points:        Star (Lucide: Star)
SMS:           MessageCircle (Lucide: MessageCircle)
Notification:  Bell (Lucide: Bell)
```

**Status Icons:**
```
Active:        CheckCircle (Lucide: CheckCircle2) + Green
Paused:        PauseCircle (Lucide: PauseCircle) + Gray
Draft:         Edit (Lucide: FileEdit) + Amber
Error:         XCircle (Lucide: XCircle) + Red
```

---

### Spacing & Layout Grid

**Container Widths:**
```
Max content width: 1280px (Desktop)
Sidebar width: 280px (collapsed: 64px)
Preview panel width: 360px (40% of main area)
```

**Grid System:**
```
Desktop (>1024px): 12-column grid, 24px gutter
Tablet (768-1024px): 8-column grid, 16px gutter
Mobile (<768px): 4-column grid, 16px gutter
```

**Component Spacing:**
```
Tight (8px):    Between label and input
Comfortable (16px): Between form fields
Relaxed (24px): Between sections
Spacious (32px): Between major blocks
Extra (48px):   Between page sections
```

**Card Padding:**
```
Compact: 12px (List items, chips)
Default: 20px (Standard cards)
Spacious: 24px (Preview panel, modals)
```

---

### Elevation (Shadows)

**Shadow Levels:**
```
Level 0 (None): Flat cards, default state
Level 1 (Subtle): 0 1px 2px rgba(0,0,0,0.05) - Resting cards
Level 2 (Raised): 0 4px 8px rgba(0,0,0,0.1) - Hover cards
Level 3 (Floating): 0 8px 16px rgba(0,0,0,0.15) - Modals, dropdowns
Level 4 (Overlay): 0 16px 32px rgba(0,0,0,0.2) - Dialogs, alerts
```

**Primary Color Shadows (for emphasis):**
```
Rose shadow: 0 4px 12px rgba(244, 63, 94, 0.2) - Selected states
Blue shadow: 0 4px 12px rgba(59, 130, 246, 0.2) - AI insights
```

---

### Border Styles

**Border Widths:**
```
Thin (1px): Default borders, dividers
Medium (2px): Focus states, selected items
Thick (3px): Emphasized selection (e.g., primary action card)
```

**Border Radius:**
```
Small (8px): Buttons, chips, small cards
Medium (12px): Standard cards, inputs
Large (16px): Preview panel, modals
Extra-Large (24px): Intent cards (Step 1)
```

---

### Animation & Transitions

**Timing Functions:**
```
ease-out: Default for most transitions (natural deceleration)
ease-in-out: For reversible interactions (expand/collapse)
spring: For playful micro-interactions (Framer Motion)
```

**Duration:**
```
Fast (100ms): Color changes, icon rotations
Default (200ms): Card hover, button press
Medium (300ms): Page transitions, panel slide
Slow (500ms): Modal fade-in, success animations
```

**Key Animations:**

**1. Card Hover:**
```css
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(244, 63, 94, 0.15);
}
```

**2. Button Press:**
```css
.button {
  transition: transform 100ms ease-out, background 200ms ease-out;
}
.button:active {
  transform: scale(0.98);
}
```

**3. Preview Panel Update (Framer Motion):**
```tsx
<motion.div
  key={previewContent}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
  {previewContent}
</motion.div>
```

**4. Success Checkmark:**
```tsx
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: "spring", stiffness: 200, damping: 10 }}
>
  <CheckCircle />
</motion.div>
```

---

### Illustration Style

**Approach:** Minimalist, geometric, friendly

**Empty States:**
- Use Lucide icons (large 64-96px)
- Add light background circle (rose-50)
- Include friendly copy ("Chưa có automation nào. Hãy tạo cái đầu tiên!")

**Example Empty State:**
```
     ┌─────┐
     │     │
     │ 🎨  │  (Icon: large, rose-500)
     │     │
     └─────┘
    
    Chưa có automation nào
    
    Hãy tạo automation đầu tiên để
    Bella giúp bạn tự động hóa công việc
    
    [+ Tạo automation mới]
```

**Error States:**
- Icon: AlertCircle (red-500)
- Background: red-50 (subtle, not alarming)
- Actionable button: "Thử lại" or "Báo lỗi"

---

### Dark Mode (Future Consideration)

**Strategy:** Not implemented in MVP, but design with dark mode in mind

**Preparation:**
- Use CSS variables for all colors (not hardcoded hex)
- Ensure sufficient contrast ratios (WCAG AA minimum)
- Test illustrations/icons on dark backgrounds

---

## ⚡ INTERACTION PATTERNS

### Purpose
Define consistent micro-interactions and behavioral patterns across all components.

---

### Pattern 1: Progressive Disclosure

**Principle:** Show complexity only when needed.

**Example 1: Collapsed Details in Condition Cards**
```
Default state:
┌─────────────────────┐
│ ☑ Khách VIP         │
│   Khách có tier VIP │ ← Brief description visible
└─────────────────────┘

On click expand icon:
┌─────────────────────────────────┐
│ ☑ Khách VIP                [▲] │
│   Khách có tier VIP             │
│                                 │
│   Chi tiết:                     │
│   • Tier = VIP                  │
│   • Hoặc lifetime value >50tr   │
│   • Hoặc tổng booking >100 lần  │
└─────────────────────────────────┘
```

**Implementation:**
- Use `<Collapsible>` component (Radix UI or custom)
- Animate height change (300ms ease-in-out)
- Persist collapsed state per session (localStorage)

**Example 2: JSON Viewer (For Technical Users)**
```
Default state (hidden):
[Preview panel shows natural language only]

On click "Xem JSON":
┌─────────────────────────────────┐
│ ✨ Bella sẽ:                    │
│ ... (natural language)          │
│                                 │
│ [▼ Xem JSON]                    │
│                                 │
│ {                               │
│   "conditions": [...],          │
│   "actions": [...]              │
│ }                               │
└─────────────────────────────────┘
```

---

### Pattern 2: Instant Feedback

**Principle:** Users see results of their actions immediately.

**Example 1: Live Preview Panel Update**
```
User action: Check "Khách VIP" condition
↓
Preview panel updates in real-time (within 50ms):
"Khi: • Khách VIP" appears immediately
```

**Implementation:**
```tsx
const [conditions, setConditions] = useState<string[]>([]);

// No debounce needed - update immediately
const handleConditionChange = (condition: string, checked: boolean) => {
  if (checked) {
    setConditions([...conditions, condition]);
  } else {
    setConditions(conditions.filter(c => c !== condition));
  }
};

// Preview panel re-renders automatically (React state)
<PreviewPanel conditions={conditions} actions={actions} />
```

**Example 2: Slider Value Preview**
```
User drags slider: 15% → 20%
↓
Preview shows updated calculation:
"Khách Lan booking 3tr → Giảm 600,000đ" (instead of 450k)
```

---

### Pattern 3: Contextual Help

**Principle:** Help appears in context, not in separate docs.

**Example 1: Tooltip on Hover**
```
User hovers over [?] icon next to "Slot giới hạn"
↓
Tooltip appears (200ms delay):
┌─────────────────────────────────┐
│ Slot giới hạn                   │
│ ─────────────────────────────── │
│ Số lượng khách tối đa được hưởng│
│ khuyến mãi này.                 │
│                                 │
│ VD: 20 slot = 20 khách đầu tiên │
└─────────────────────────────────┘
```

**Implementation:**
- Use Radix UI Tooltip component
- Max width: 280px
- Delay: 200ms (avoid flickering)
- Arrow pointing to trigger element

**Example 2: Inline Suggestions**
```
User focuses on "Booking trên" input field
↓
Suggestion chips appear below:
[1,000,000] [2,000,000] [3,000,000] [5,000,000]

User clicks chip → Value auto-fills
```

---

### Pattern 4: Undo Safety

**Principle:** Users can reverse destructive actions.

**Example 1: Pause Automation (Reversible)**
```
User clicks [⏸️ Tạm dừng]
↓
Toast notification appears:
┌─────────────────────────────────┐
│ ⏸️ Đã tạm dừng "Khuyến mãi VIP" │
│ [Hoàn tác]                      │ ← Clickable, 5s timeout
└─────────────────────────────────┘
```

**Implementation:**
```tsx
const handlePause = async (automationId: string) => {
  const previousState = automation.status;
  
  // Optimistic update
  setAutomation({ ...automation, status: 'paused' });
  
  // Show toast with undo
  toast.success('Đã tạm dừng', {
    action: {
      label: 'Hoàn tác',
      onClick: async () => {
        await updateAutomationStatus(automationId, previousState);
        setAutomation({ ...automation, status: previousState });
      }
    },
    duration: 5000
  });
  
  // Persist to database
  await updateAutomationStatus(automationId, 'paused');
};
```

**Example 2: Delete Automation (Confirmation Required)**
```
User clicks [⋯ More] → [🗑️ Xóa]
↓
Modal appears:
┌─────────────────────────────────────────┐
│ Xác nhận xóa?                           │
│ ───────────────────────────────────────  │
│                                         │
│ Bạn có chắc muốn xóa "Khuyến mãi VIP"?  │
│                                         │
│ Hành động này không thể hoàn tác.       │
│                                         │
│ [Hủy]  [Xóa vĩnh viễn]                  │
└─────────────────────────────────────────┘
```

---

### Pattern 5: Loading States

**Principle:** Always show progress, never leave users wondering.

**Example 1: Saving Automation**
```
User clicks [💾 Lưu automation]
↓
Button state changes:
[💾 Lưu automation] → [⏳ Đang lưu...] (disabled, spinner)
↓ (2-3 seconds later)
Success screen appears
```

**Implementation:**
```tsx
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  setIsSaving(true);
  
  try {
    await saveAutomation(automationData);
    router.push('/dashboard/automation/success');
  } catch (error) {
    toast.error('Lưu thất bại: ' + error.message);
  } finally {
    setIsSaving(false);
  }
};

<button disabled={isSaving}>
  {isSaving ? (
    <>
      <Loader2 className="animate-spin" />
      Đang lưu...
    </>
  ) : (
    <>
      <Save />
      Lưu automation
    </>
  )}
</button>
```

**Example 2: Loading Automation List (Skeleton)**
```
┌──────────────────────────────────────────┐
│ ▮▮▮▮▮▮▮▮▮▮▮▮                [●●●]      │ ← Skeleton shimmer
│ ──────────────────────────────────────── │
│ ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮   │
│                                         │
│ ▮▮▮▮▮▮▮▮▮▮▮ | ▮▮▮▮▮▮▮▮▮▮▮▮            │
│                                         │
│ [●●●] [●●●] [●●●] [●●●]                 │
└──────────────────────────────────────────┘
```

---

### Pattern 6: Error Recovery

**Principle:** Errors should be actionable, not dead ends.

**Example 1: Validation Error**
```
User enters invalid value: "-5%" in discount field
↓
Input field shows error state:
┌─────────────────────────────┐
│ Giảm giá                    │
│ [-5%___________]            │ ← Red border
│ ❌ Giá trị phải từ 0-100%   │ ← Error message
└─────────────────────────────┘

[Tiếp theo] button disabled until fixed
```

**Example 2: API Error**
```
Save automation fails (network error)
↓
Toast notification:
┌─────────────────────────────────┐
│ ❌ Lưu thất bại                 │
│ Không thể kết nối server        │
│ [Thử lại]  [Lưu nháp offline]   │ ← Actionable options
└─────────────────────────────────┘
```

---

### Pattern 7: Bulk Actions

**Principle:** Enable efficient multi-item operations.

**Example: Pause Multiple Automations**
```
[My Automations List]

[☑ Select all (12)] [Bulk actions ▾]
  ↓ Dropdown menu:
  ┌─────────────────┐
  │ ⏸️ Tạm dừng tất cả│
  │ ▶️ Kích hoạt tất cả│
  │ 🗂️ Nhóm lại       │
  │ 🗑️ Xóa           │
  └─────────────────┘

┌──────────────────────────────────────────┐
│ ☑ 🎁 Khuyến mãi VIP 15%      [●]        │ ← Checkbox visible
│ ... │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ☑ 🎂 Sinh nhật giảm 15%      [●]        │
│ ... │
└──────────────────────────────────────────┘
```

**Confirmation:**
```
User selects 5 automations → Clicks [⏸️ Tạm dừng tất cả]
↓
Toast: "Đã tạm dừng 5 automations [Hoàn tác]"
```

---

### Pattern 8: Search & Filter

**Principle:** Fast access to specific items.

**Example: Filter Automations**
```
[🔍 Tìm automation...________] [Filter: Tất cả ▾]
  ↓ Dropdown:
  ┌─────────────────┐
  │ ✓ Tất cả        │
  │ 🎁 Khuyến mãi   │
  │ 📅 Booking      │
  │ 👩 Nhân viên    │
  │ 💰 Hoa hồng     │
  └─────────────────┘

User types: "VIP"
↓
Results filter in real-time (debounced 300ms):
- "Khuyến mãi VIP 15%" ← Match
- "Sinh nhật giảm 15%" ← Hidden
- "VIP miễn phí massage" ← Match
```

**Implementation:**
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [selectedFilter, setSelectedFilter] = useState('all');

// Debounced search (avoid excessive re-renders)
const debouncedSearch = useDebouncedValue(searchQuery, 300);

const filteredAutomations = automations.filter(auto => {
  const matchesSearch = auto.title.toLowerCase().includes(debouncedSearch.toLowerCase());
  const matchesFilter = selectedFilter === 'all' || auto.category === selectedFilter;
  return matchesSearch && matchesFilter;
});
```

---

### Pattern 9: Keyboard Shortcuts

**Principle:** Power users can work faster with keyboard.

**Global Shortcuts:**
```
Ctrl/Cmd + K:  Open search/command palette
Ctrl/Cmd + N:  Create new automation (from any page)
Ctrl/Cmd + S:  Save current automation
Esc:           Close modal/cancel action
```

**In-Form Navigation:**
```
Tab:           Next field
Shift + Tab:   Previous field
Enter:         Submit form / Next step
Space:         Toggle checkbox/radio (when focused)
Arrow keys:    Navigate between chips/cards (when focused)
```

**Implementation:**
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      router.push('/dashboard/automation/new');
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

### Pattern 10: Optimistic Updates

**Principle:** UI updates immediately, rollback if server fails.

**Example: Toggle Automation Status**
```
User clicks [⏸️ Tạm dừng]
↓
UI updates immediately (status: active → paused)
↓ (in background)
API call sent to server
↓
If success: Do nothing (UI already updated)
If error: Rollback UI + show error toast
```

**Implementation:**
```tsx
const handleToggleStatus = async (automationId: string) => {
  const previousStatus = automation.status;
  const newStatus = previousStatus === 'active' ? 'paused' : 'active';
  
  // Optimistic update (instant)
  setAutomation({ ...automation, status: newStatus });
  
  try {
    // Background API call
    await updateAutomationStatus(automationId, newStatus);
  } catch (error) {
    // Rollback on error
    setAutomation({ ...automation, status: previousStatus });
    toast.error('Cập nhật thất bại: ' + error.message);
  }
};
```

---

## ♿ ACCESSIBILITY

### Purpose
Ensure Automation Studio is usable by everyone, including users with disabilities.

---

### WCAG 2.1 Level AA Compliance

**Target:** Meet all Level AA criteria (minimum standard for production)

**Key Requirements:**
1. Perceivable: Information presented in multiple ways
2. Operable: All functionality via keyboard
3. Understandable: Clear language and predictable behavior
4. Robust: Compatible with assistive technologies

---

### Keyboard Navigation

**Tab Order:**
- Logical flow: Left to right, top to bottom
- Skip to main content link at top (hidden, appears on focus)
- All interactive elements reachable via Tab
- No keyboard traps (user can always escape modals/dropdowns)

**Focus Indicators:**
```css
/* Visible focus ring for all interactive elements */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Higher contrast for buttons */
button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 4px;
}
```

**Keyboard Shortcuts Summary Card:**
```
┌─────────────────────────────────────────┐
│ ⌨️ Phím tắt                             │
│ ─────────────────────────────────────── │
│                                         │
│ Tab            - Trường tiếp theo       │
│ Shift+Tab      - Trường trước           │
│ Enter          - Xác nhận/Tiếp          │
│ Space          - Chọn/bỏ chọn           │
│ Esc            - Đóng/Hủy               │
│ Ctrl/Cmd+K     - Tìm kiếm               │
│ Ctrl/Cmd+N     - Tạo mới                │
│ Ctrl/Cmd+S     - Lưu                    │
│                                         │
│ [Đóng]                                  │
└─────────────────────────────────────────┘
```

**Show on:** First visit (modal), or via Help menu (? icon)

---

### Screen Reader Support

**ARIA Labels:**

**Example 1: Intent Cards (Step 1)**
```tsx
<button
  role="button"
  aria-label="Tạo automation khuyến mãi - Giảm giá, tặng quà, voucher"
  onClick={handleSelectIntent('promotion')}
>
  <Gift size={64} aria-hidden="true" />
  <h3>Khuyến mãi</h3>
  <p>Giảm giá, tặng quà, voucher</p>
</button>
```

**Example 2: Condition Checkboxes**
```tsx
<div role="group" aria-labelledby="conditions-heading">
  <h2 id="conditions-heading">Áp dụng khi nào?</h2>
  
  <label>
    <input
      type="checkbox"
      checked={isVipChecked}
      onChange={handleVipChange}
      aria-describedby="vip-description"
    />
    <span>Khách VIP</span>
    <span id="vip-description">Khách có tier VIP hoặc lifetime value trên 50 triệu</span>
  </label>
</div>
```

**Example 3: Preview Panel (Live Region)**
```tsx
<div
  role="region"
  aria-live="polite"
  aria-label="Xem trước automation"
>
  <h3>Bella sẽ:</h3>
  <ul aria-label="Điều kiện">
    <li>Khách VIP</li>
    <li>Đặt dịch vụ trên 2 triệu</li>
  </ul>
  <ul aria-label="Hành động">
    <li>Giảm 15%</li>
    <li>Gửi SMS thông báo</li>
  </ul>
</div>
```

**Screen Reader Announcements:**
- Step transitions: "Bước 2 trong 4: Áp dụng khi nào?"
- Validation errors: "Lỗi: Giá trị phải từ 0 đến 100%"
- Success actions: "Đã lưu automation Khuyến mãi VIP"

---

### Color Contrast

**Minimum Contrast Ratios (WCAG AA):**
- Normal text (14-18px): 4.5:1
- Large text (>18px or bold >14px): 3:1
- UI components (borders, icons): 3:1

**Verified Combinations:**
```
✅ Rose-500 (#f43f5e) on White (#ffffff): 4.8:1 (Pass)
✅ Gray-700 (#374151) on White: 12.6:1 (Pass)
✅ Gray-500 (#6b7280) on White: 4.6:1 (Pass)
✅ Green-600 (#059669) on White: 4.5:1 (Pass)
✅ Red-600 (#dc2626) on White: 5.9:1 (Pass)
```

**Color-Blind Safe:**
- Do NOT rely on color alone to convey information
- Always pair color with icons or text labels

**Example:**
```
Status indicators:
✅ [Green dot] Đang chạy    (not just green dot)
⏸️ [Gray dot] Tạm dừng      (not just gray dot)
```

---

### Text Alternatives

**Images and Icons:**
- All icons have `aria-hidden="true"` if decorative
- Functional icons have `aria-label` or adjacent text

**Example:**
```tsx
// Decorative icon (next to text)
<Gift aria-hidden="true" />
<span>Khuyến mãi</span>

// Functional icon-only button
<button aria-label="Xóa automation">
  <Trash2 aria-hidden="true" />
</button>
```

**Charts and Visualizations:**
- Provide text summary or data table alternative
- Use `<figcaption>` for chart descriptions

**Example:**
```tsx
<figure>
  <Chart data={activationTrend} />
  <figcaption>
    Biểu đồ lượt kích hoạt automation theo ngày:
    Thứ 2 (120), Thứ 3 (140), Thứ 4 (135), ...
  </figcaption>
</figure>
```

---

### Forms and Inputs

**Label Association:**
```tsx
// ✅ Good: Explicit label
<label htmlFor="discount-value">Giảm giá (%)</label>
<input id="discount-value" type="number" />

// ❌ Bad: No label
<input placeholder="Giảm giá (%)" /> // Placeholder is not a label
```

**Error Messages:**
```tsx
<div>
  <label htmlFor="discount">Giảm giá (%)</label>
  <input
    id="discount"
    type="number"
    value={discount}
    aria-invalid={error ? "true" : "false"}
    aria-describedby={error ? "discount-error" : undefined}
  />
  {error && (
    <p id="discount-error" role="alert">
      {error}
    </p>
  )}
</div>
```

**Required Fields:**
```tsx
<label htmlFor="automation-name">
  Tên automation <span aria-label="bắt buộc">*</span>
</label>
<input id="automation-name" required aria-required="true" />
```

---

### Focus Management

**Modal Dialogs:**
- Focus moves to modal when opened
- Focus returns to trigger element when closed
- Esc key closes modal
- Focus trapped within modal (Tab cycles through modal elements only)

**Implementation:**
```tsx
import { Dialog } from '@radix-ui/react-dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Content onOpenAutoFocus={(e) => {
    // Focus first input in modal
    e.preventDefault();
    firstInputRef.current?.focus();
  }}>
    {/* Modal content */}
  </Dialog.Content>
</Dialog>
```

**Page Transitions:**
- Focus moves to page heading (`<h1>`) on route change
- Announce page title to screen readers

```tsx
useEffect(() => {
  // Set document title
  document.title = 'Automation Studio - Bella ERP';
  
  // Focus heading
  headingRef.current?.focus();
}, [pathname]);

<h1 ref={headingRef} tabIndex={-1}>
  Automation Studio
</h1>
```

---

### Responsive Text Sizing

**Allow Text Zoom:**
- Support 200% browser zoom (WCAG requirement)
- Use `rem` units for font sizes (not `px`)
- Avoid fixed heights for text containers

**Example:**
```css
/* ✅ Good: Scales with browser zoom */
.heading {
  font-size: 1.5rem; /* 24px at default zoom */
}

/* ❌ Bad: Does not scale */
.heading {
  font-size: 24px;
}
```

**Line Height:**
- Minimum 1.5 for body text
- Minimum 1.2 for headings

---

### Motion and Animation

**Respect User Preferences:**
```css
/* Disable animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**No Flashing Content:**
- Avoid flashing more than 3 times per second
- No auto-playing videos with sound

---

### Language and Readability

**Clear Language:**
- Avoid jargon (use "Giảm giá" not "Apply discount rule")
- Provide examples where helpful
- Error messages are actionable ("Giá trị phải từ 0-100%" not "Invalid input")

**Reading Level:**
- Target 8th-9th grade reading level (Vietnamese)
- Short sentences (15-20 words max)
- Active voice preferred

**Example:**
```
❌ Bad: "The automation will be executed when the conditions specified above are met."

✅ Good: "Bella sẽ tự động áp dụng khi điều kiện đủ."
```

---

### Testing Checklist

**Manual Testing:**
- [ ] Navigate entire flow using keyboard only (no mouse)
- [ ] Test with screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
- [ ] Zoom browser to 200% - all content still usable
- [ ] Test with color-blind simulator (Chrome extension)
- [ ] Disable JavaScript - graceful degradation message shown

**Automated Testing:**
- [ ] Run axe-core or Lighthouse accessibility audit (0 critical issues)
- [ ] Check focus order with Tab key visualizer
- [ ] Validate ARIA attributes with axe DevTools

**Real User Testing:**
- [ ] Test with actual users with disabilities (paid user research)
- [ ] Gather feedback on keyboard navigation efficiency
- [ ] Iterate based on findings

---

### Accessibility Statement

**Include in Help/About page:**
```
# Cam kết về khả năng tiếp cận

Bella ERP cam kết đảm bảo Automation Studio có thể sử dụng được
cho mọi người, bao gồm người khuyết tật.

Chúng tôi tuân thủ WCAG 2.1 Level AA.

Nếu bạn gặp vấn đề về khả năng tiếp cận, vui lòng liên hệ:
- Email: support@bella-erp.com
- Hotline: 1900 xxxx
```

---

## 🗓️ IMPLEMENTATION ROADMAP

### Purpose
Break down UX design into actionable sprints for development team.

---

### Sprint 0: Preparation & Setup (1 week)

**Objective:** Establish foundation for Automation Studio implementation

**Tasks:**
1. **Project Setup**
   - Create new route: `/dashboard/automation`
   - Setup folder structure:
     ```
     src/app/dashboard/automation/
     ├── page.tsx (Intent selection)
     ├── new/
     │   ├── page.tsx (Multi-step wizard)
     │   └── components/
     │       ├── IntentCard.tsx
     │       ├── ConditionSelector.tsx
     │       ├── ActionSelector.tsx
     │       └── PreviewPanel.tsx
     ├── [id]/
     │   ├── page.tsx (Detail view)
     │   └── edit/page.tsx (Edit mode)
     ├── templates/page.tsx (Template gallery)
     └── analytics/page.tsx (Analytics dashboard)
     ```

2. **Component Library Bootstrap**
   - Install dependencies: Radix UI, Framer Motion, Lucide React
   - Create base components in `/src/components/automation/`:
     - `IntentCard.tsx`
     - `ConditionChip.tsx`
     - `ActionRadioCard.tsx`
     - `PreviewPanel.tsx`
     - `ProgressDots.tsx`
   - Setup Storybook for component development (optional but recommended)

3. **API Integration Planning**
   - Review existing Decision Engine APIs
   - Map API endpoints to UI flows:
     - `POST /api/automation/rules` - Create rule
     - `GET /api/automation/rules` - List rules
     - `PATCH /api/automation/rules/:id` - Update rule
     - `DELETE /api/automation/rules/:id` - Delete rule
     - `POST /api/automation/simulate` - Test rule

4. **Design Tokens Configuration**
   - Add CSS variables to `globals.css`:
     ```css
     :root {
       --color-automation-primary: #f43f5e;
       --color-automation-primary-light: #ffe4e6;
       --spacing-automation-card: 20px;
       /* ... */
     }
     ```

**Deliverables:**
- ✅ Project structure created
- ✅ Dependencies installed
- ✅ Base components scaffolded (no logic yet)
- ✅ API integration plan documented

---

### Sprint 1: Visual Builder MVP - Step 1-3 (2 weeks)

**Objective:** Implement core creation flow (Intent → Conditions → Actions)

**Priority:** ⭐⭐⭐⭐⭐ CRITICAL PATH

**Tasks:**

**Week 1:**
1. **Step 1: Intent Selection**
   - Build Intent Selection screen
   - Implement 6 intent cards (Khuyến mãi, Booking, Nhân viên, Hoa hồng, Kho, Chăm sóc KH)
   - Card hover animations (Framer Motion)
   - Click → Navigate to Step 2 with intent context

2. **Step 2: Condition Selection (Part 1)**
   - Build Condition Selector layout (left panel + right preview)
   - Implement ConditionChip component
   - Show conditions filtered by intent (e.g., only discount conditions for "Khuyến mãi")
   - Handle checkbox state changes

**Week 2:**
3. **Step 2: Condition Selection (Part 2)**
   - Implement PreviewPanel component
   - Live update preview as conditions change
   - Add "Tiếp theo" button (enabled only if ≥1 condition selected)
   - Handle expandable details in ConditionChip

4. **Step 3: Action Selection**
   - Build Action Selector layout (similar to Step 2)
   - Implement ActionRadioCard component
   - Show actions filtered by intent
   - Add configuration controls (slider for %, input for VNĐ)
   - Update PreviewPanel to show actions
   - Add example scenario generation

**Deliverables:**
- ✅ Users can create automation through Steps 1-3
- ✅ Preview panel updates in real-time
- ✅ No API integration yet (state stored in React only)
- ✅ Visual design 90% matches wireframes

---

### Sprint 2: Complete Creation Flow + API Integration (2 weeks)

**Objective:** Finish creation flow, persist to database

**Priority:** ⭐⭐⭐⭐⭐ CRITICAL PATH

**Tasks:**

**Week 1:**
1. **Step 4: Preview & Confirm**
   - Build confirmation screen
   - Show final preview card with full automation summary
   - Add name input (pre-filled with smart default)
   - Add status toggle (Bật ngay / Lưu nháp)
   - "Xem JSON" expandable (for technical users)

2. **Step 5: Success State**
   - Build success screen
   - Animated checkmark (Framer Motion spring)
   - Quick action buttons
   - Auto-redirect to list after 3 seconds

**Week 2:**
3. **API Integration**
   - Connect Step 4 save button to `POST /api/automation/rules`
   - Map UI state to Decision Engine rule format:
     ```typescript
     // UI state
     { intent: 'promotion', conditions: ['vip', 'booking>2M'], actions: ['discount15%', 'sms'] }
     
     // → API payload
     {
       name: 'Khuyến mãi VIP 15%',
       provider: 'discount',
       conditions: [
         { field: 'customerTier', operator: '==', value: 'vip' },
         { field: 'bookingValue', operator: '>=', value: 2000000 }
       ],
       actions: [
         { type: 'applyDiscount', value: 15, unit: 'percentage' },
         { type: 'sendSMS', template: 'birthday_discount' }
       ],
       status: 'active'
     }
     ```

4. **Error Handling**
   - Add loading states (spinner in save button)
   - Handle API errors (toast notifications)
   - Validation errors (show inline in form)

**Deliverables:**
- ✅ Full creation flow (Steps 1-5) working
- ✅ Automations persisted to database
- ✅ Decision Engine executes rules correctly
- ✅ Error handling implemented

---

### Sprint 3: Template Gallery (2 weeks)

**Objective:** Enable template-first discovery

**Priority:** ⭐⭐⭐⭐ HIGH

**Tasks:**

**Week 1:**
1. **Template Data Structure**
   - Define template schema:
     ```typescript
     interface AutomationTemplate {
       id: string;
       emoji: string;
       title: string;
       description: string;
       category: 'promotion' | 'booking' | 'hr' | 'commission' | 'inventory' | 'customer_care';
       usageCount: number; // Number of spas using this
       prefilledData: {
         conditions: Condition[];
         actions: Action[];
       };
     }
     ```

2. **Seed Initial Templates (10 templates)**
   - 🎂 Sinh nhật giảm 20%
   - 💎 VIP 15% mọi dịch vụ
   - 🔥 Flash Sale cuối tuần
   - 👶 Combo Mẹ Bé ưu đãi
   - 📅 Tự động phân công KTV
   - 📲 Nhắc lịch trước 1 ngày
   - 💰 Hoa hồng theo session
   - ⭐ Thưởng KPI tháng
   - 📦 Tự động đặt hàng khi hết hàng
   - 🎁 Tặng điểm sinh nhật

**Week 2:**
3. **Template Gallery UI**
   - Build template listing page (`/dashboard/automation/templates`)
   - TemplateCard component
   - Search bar (filter by title/description)
   - Filter chips (by category)
   - [Xem chi tiết] modal (show full template details)
   - [Dùng] button → Navigate to Step 2 with pre-filled data

4. **Template Customization Flow**
   - User clicks [Dùng] → Step 2 opens with pre-filled conditions/actions
   - User can modify any field
   - Save as new automation (not overwrite template)

**Deliverables:**
- ✅ 10 production-ready templates
- ✅ Template gallery page working
- ✅ Users can customize templates
- ✅ 80%+ of automations created via templates (analytics)

---

### Sprint 4: List View + Edit Flow (2 weeks)

**Objective:** View all automations, edit existing ones

**Priority:** ⭐⭐⭐⭐ HIGH

**Tasks:**

**Week 1:**
1. **My Automations List Page**
   - Build list page (`/dashboard/automation`)
   - AutomationCard component
   - Fetch automations from API (`GET /api/automation/rules`)
   - Display status (Đang chạy, Tạm dừng, Nháp)
   - Display stats (activations today, savings)
   - Action buttons: [Xem], [Sửa], [Tạm dừng], [⋯ More]

2. **Status Management**
   - Implement [⏸️ Tạm dừng] action
   - Optimistic update (instant UI feedback)
   - Undo toast (5-second timeout)
   - API call to `PATCH /api/automation/rules/:id`

**Week 2:**
3. **Edit Flow**
   - [✏️ Sửa] button → Navigate to edit mode
   - Pre-fill all fields with existing automation data
   - Warning banner if automation is active
   - Show before/after comparison in preview
   - Confirmation modal (show impact estimate)
   - Save changes → Update database

4. **Delete Flow**
   - [⋯ More] → [🗑️ Xóa]
   - Confirmation modal (cannot undo)
   - Soft delete (mark as deleted, keep audit trail)

**Deliverables:**
- ✅ Users can view all automations
- ✅ Users can edit automations
- ✅ Users can pause/resume/delete automations
- ✅ Audit trail preserved

---

### Sprint 5: Debug Mode (1 week)

**Objective:** Help users understand why rules didn't trigger

**Priority:** ⭐⭐⭐ MEDIUM

**Tasks:**
1. **Debug Dashboard**
   - Build debug page (`/dashboard/automation/[id]/debug`)
   - Fetch evaluation logs from API (`GET /api/automation/rules/:id/evaluations`)
   - DebugTimeline component (show recent bookings checked)
   - Condition pass/fail visualization (✅❌ icons)

2. **AI Root Cause Analysis**
   - Analyze evaluation logs to find patterns
   - Example: "Slot giới hạn đã hết từ 09:15"
   - Suggest fixes: "Tăng quota lên 50 khách"
   - [✏️ Sửa automation] button with suggestion pre-filled

3. **Simulation Tool**
   - Allow users to test rules with fake data
   - Input: Customer, Booking date, Value
   - Output: Will rule trigger? Why/why not?

**Deliverables:**
- ✅ Users can debug non-triggering rules
- ✅ AI provides actionable insights
- ✅ Simulation tool working

---

### Sprint 6: Analytics Dashboard (1 week)

**Objective:** Show automation performance metrics

**Priority:** ⭐⭐⭐ MEDIUM

**Tasks:**
1. **Summary Cards**
   - Total automations active
   - Activations today
   - Value processed (revenue/savings)
   - Success rate

2. **Activation Trend Chart**
   - Line chart (7-day trend)
   - Segment by category (Khuyến mãi, Booking, Nhân viên)

3. **Top Performing Automations**
   - Ranked list by activations
   - Show ROI (if applicable)
   - Quick links to view/edit

**Deliverables:**
- ✅ Analytics page showing performance data
- ✅ Spa owners can see ROI of automations

---

### Sprint 7: Natural Language Input (Future, Sprint 8-10)

**Objective:** Allow users to type in natural language

**Priority:** ⭐⭐ LOW (Future enhancement)

**Example:**
```
User types: "Khi khách VIP đặt dịch vụ trên 2 triệu thì giảm 15%"
↓
AI parses intent, conditions, actions
↓
Pre-fills Step 2-3 automatically
↓
User reviews and saves
```

**Tech Stack:**
- OpenAI GPT-4 or Gemini for parsing
- Prompt engineering to map natural language → structured rules
- Fallback to manual flow if parsing fails

**Not in MVP** (requires AI integration, training, high cost)

---

### Sprint 8: Explain Why (Future, Sprint 11-12)

**Objective:** AI narrates decision-making process

**Priority:** ⭐⭐ LOW (Future enhancement)

**Example:**
```
Bella chọn KTV Lan vì:
✓ Trống lịch (9:00-11:00)
✓ Laser Expert (5 năm kinh nghiệm)
✓ Đánh giá 4.9/5 (248 reviews)
✓ Khách Mai yêu cầu KTV nữ
```

**Tech Stack:**
- Decision Engine logs all evaluation steps
- AI summarizes logs into natural language narrative
- Integrate with booking detail page

**Not in MVP** (requires Decision Engine instrumentation)

---

### Timeline Summary

| Sprint | Duration | Focus | Priority | Deliverables |
|--------|----------|-------|----------|--------------|
| Sprint 0 | 1 week | Setup | Critical | Project structure, component library |
| Sprint 1 | 2 weeks | Builder MVP (Steps 1-3) | Critical | Intent + Conditions + Actions |
| Sprint 2 | 2 weeks | Complete flow + API | Critical | Steps 4-5, database persistence |
| Sprint 3 | 2 weeks | Templates | High | 10 templates, gallery page |
| Sprint 4 | 2 weeks | List + Edit | High | View all, edit, pause/delete |
| Sprint 5 | 1 week | Debug mode | Medium | Debug dashboard, AI insights |
| Sprint 6 | 1 week | Analytics | Medium | Performance metrics |
| **Total** | **11 weeks** | **MVP Complete** | | **Production-ready** |
| Sprint 7-8 | 4 weeks | NLP + Explain Why | Low | Future enhancements |

---

### Release Strategy

**MVP Release (After Sprint 6):**
- Deploy to staging for internal testing (1 week)
- Pilot with 3-5 friendly spa owners (2 weeks)
- Collect feedback, fix critical bugs
- Production release (soft launch, no marketing)

**V1.1 Release (After Sprint 7):**
- Add natural language input
- Expand template library to 20+ templates
- Public launch with marketing campaign

**V2.0 Release (After Sprint 8):**
- "Explain Why" feature (AI narration)
- Advanced workflow orchestration (multi-step automations)
- Franchise-wide template sharing

---

### Success Criteria (After MVP)

**Quantitative:**
- ✅ 90%+ of automations created via templates (not from scratch)
- ✅ <3 minutes average time to create first automation (first-time users)
- ✅ <5% error rate in rule creation
- ✅ 200+ rules created per month (across all tenants)

**Qualitative:**
- ✅ 90%+ user satisfaction (NPS >50)
- ✅ Zero "I don't understand how to use this" support tickets
- ✅ Positive testimonials: "Dễ dùng như Canva"

---

## 📊 SUCCESS METRICS

### Purpose
Define measurable KPIs to evaluate Automation Studio success.

---

### Primary KPI: Time to First Automation (From Template)

**Target:** <2 minutes for first-time users (without tutorial) **using a template**

**Measurement:**
```
Time = [First page load] → [Template selected] → [Automation saved successfully]
```

**Tracking Implementation:**
```typescript
// Analytics event
analytics.track('automation_creation_started', {
  userId: user.id,
  timestamp: Date.now(),
  method: 'template' | 'from_scratch'
});

// On save success
analytics.track('automation_creation_completed', {
  userId: user.id,
  timestamp: Date.now(),
  duration: timeElapsed, // in seconds
  method: 'template' | 'from_scratch',
  templateId: template?.id
});

// Calculate average across all users
const avgTimeToFirstAutomation = average(
  users.filter(u => u.firstAutomationCreated).map(u => u.creationTime)
);
```

**Success Threshold:**
- Excellent: <90 seconds (80%+ users)
- Good: 90-120 seconds (70%+ users)
- Acceptable: 2-3 minutes (60%+ users)
- Needs improvement: >3 minutes

**Action Plan if Below Target:**
- Analyze drop-off points (which step users abandon)
- A/B test different template layouts
- Add contextual help tooltips
- Simplify template customization (fewer editable fields)

---

### Template Usage Rate (CRITICAL!)

**Target:** **95%+ of automations created from templates** (not from scratch)

**Measurement:**
```typescript
const templateUsageRate = (
  automations.filter(a => a.createdFrom === 'template').length /
  automations.length
) * 100;
```

**Why This Matters:**
- High template usage = UX is working (users find templates valuable)
- Low template usage = Templates don't match needs OR discovery is poor
- 95% target (not 80%) because templates are now FIRST-CLASS (homepage)

**Success Threshold:**
- Excellent: >95% (Templates dominate)
- Good: 85-95% (Most use templates)
- Needs improvement: <85% (Template-first approach failing)

**Action Plan if Below Target:**
- Survey users: "Why didn't you use a template?"
- Expand template library (15 → 30 → 50 templates)
- Improve template search/filter (add tags, categories)
- Add "Most popular" and "Recommended for you" sections
- A/B test template vs. blank canvas prominence

---

### Rule Creation Error Rate

**Target:** <3% of creation attempts fail (reduced from 5%)

**Measurement:**
```typescript
const errorRate = (
  automationAttempts.filter(a => a.status === 'failed').length /
  automationAttempts.length
) * 100;
```

**Common Error Types:**
- Validation errors (invalid input values)
- API errors (network/server issues)
- Logic errors (conflicting conditions/actions)

**Success Threshold:**
- Excellent: <2% error rate
- Good: 2-3% error rate
- Needs improvement: >3% error rate

**Action Plan if Above Target:**
- Add inline validation (real-time, not on submit)
- Improve error messages (more specific, actionable)
- Add retry logic for API failures
- Implement offline mode (save draft locally)
- Pre-validate templates (ensure all templates work 100%)

---

### User Satisfaction (NPS)

**Target:** NPS >60 (world-class product, raised from >50)

**Measurement:**
Survey users after 2 weeks of usage:
```
"Bạn có khả năng giới thiệu Automation Studio cho đồng nghiệp không?"

0 (Không) ──────────── 10 (Chắc chắn)

[0] [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]
```

**NPS Calculation:**
```
NPS = % Promoters (9-10) - % Detractors (0-6)
```

**Success Threshold:**
- Excellent: NPS >60 (world-class)
- Good: NPS 40-60 (very good)
- Needs improvement: NPS <40

**Action Plan if Below Target:**
- Conduct user interviews (qualitative feedback)
- Prioritize top 3 pain points from detractors
- Follow up with promoters: "What do you love most?"
- Double down on what works

**NEW Qualitative KPI:**
> Users say **"Dễ như Canva"** (as easy as Canva)

Track open-ended feedback for mentions of:
- "dễ như Canva"
- "không cần hướng dẫn"
- "2 phút là xong"
- "đơn giản"

---

### Simulation Tool Usage

**NEW KPI:** % of users who test automation before saving

**Target:** >60% of automation creations include simulation step

**Measurement:**
```typescript
const simulationUsageRate = (
  automations.filter(a => a.wasSimulated === true).length /
  automations.length
) * 100;
```

**Why This Matters:**
- Simulation = Confidence = Higher quality automations
- Low usage = Users skip testing (higher error rate likely)

**Action Plan if Below Target:**
- Make simulation mandatory (block save until tested once)
- Add "Test now" prompt before save button
- Show value: "Automation tested → 80% fewer errors"

---

### Automation Activation Rate

**Target:** 90%+ of created automations are actually used (not just saved and forgotten)

**Measurement:**
```typescript
const activationRate = (
  automations.filter(a => a.totalActivations > 0).length /
  automations.length
) * 100;
```

**Why This Matters:**
- High activation = Users create rules that match real workflows
- Low activation = Users create "test" rules or rules that never trigger

**Success Threshold:**
- Excellent: >90% (Rules are highly relevant)
- Good: 70-90% (Most rules useful)
- Needs improvement: <70% (Many unused rules)

**Action Plan if Below Target:**
- Add onboarding: "Create your first real automation" (not test)
- Suggest deleting unused automations (cleanup prompt)
- Debug mode: "Why isn't this automation triggering?"

---

### Feature Adoption Metrics

**Breakdown of Feature Usage:**

**1. Template Discovery:**
```typescript
const templateDiscoveryRate = (
  users.filter(u => u.viewedTemplateGallery).length /
  users.length
) * 100;
```
Target: >80% users visit template gallery

**2. Debug Mode Usage:**
```typescript
const debugUsageRate = (
  users.filter(u => u.usedDebugMode).length /
  users.length
) * 100;
```
Target: >30% users use debug mode (indicates troubleshooting need)

**3. Edit Existing Automation:**
```typescript
const editRate = (
  automations.filter(a => a.editCount > 0).length /
  automations.length
) * 100;
```
Target: >50% automations edited at least once (indicates iteration)

**4. Analytics View:**
```typescript
const analyticsViewRate = (
  users.filter(u => u.viewedAnalytics).length /
  users.length
) * 100;
```
Target: >60% users check analytics (indicates interest in performance)

---

### Business Impact Metrics

**1. Reduction in Manual Configuration Time:**
```
Before Automation Studio: 30 minutes to create discount rule via code
After Automation Studio: 2 minutes to create via UI

Time saved: 28 minutes/rule
```
Target: >90% time reduction

**2. Reduction in Support Tickets:**
```
Before: 20 tickets/month about "How to change discount rule?"
After: 2 tickets/month (only edge cases)

Ticket reduction: 90%
```
Target: >80% reduction

**3. Increase in Rule Creation Velocity:**
```
Before: 5 rules/month created (only by IT manager)
After: 50 rules/month created (by all spa owners)

Velocity increase: 10x
```
Target: >5x increase

**4. Error Rate in Live Rules:**
```
Before: 10% of rules had bugs (manual coding errors)
After: 1% of rules had bugs (validation prevents most errors)

Error reduction: 90%
```
Target: >80% error reduction

---

### Technical Performance Metrics

**1. Page Load Time:**
- Intent Selection page: <1 second
- Template Gallery: <2 seconds (loading 50+ templates)
- My Automations list: <2 seconds (loading 100+ automations)

**2. API Response Time:**
- Create automation: <500ms (P95)
- Update automation: <300ms (P95)
- Fetch automations list: <200ms (P95)

**3. Error Rate:**
- Client-side errors (JS errors): <0.1% of page views
- API errors (5xx): <1% of requests

---

### Accessibility Metrics

**1. Keyboard Navigation Completeness:**
```
% of features accessible via keyboard only
```
Target: 100%

**2. Screen Reader Compatibility:**
```
% of users with screen readers able to complete core flow
```
Target: 100% (after testing with real users)

**3. WCAG Compliance:**
```
Lighthouse accessibility score
```
Target: 95+ (WCAG AA compliant)

---

### Monitoring Dashboard

**Real-Time Dashboard (for Product team):**
```
┌────────────────────────────────────────────┐
│ Automation Studio - Health Dashboard       │
│ ─────────────────────────────────────────── │
│                                            │
│ ⏱️  Avg Time to First Automation: 2.3 min  │
│     ✅ Target: <3 min                       │
│                                            │
│ 📋 Template Usage Rate: 82%                │
│     ✅ Target: >80%                         │
│                                            │
│ ❌ Error Rate: 3.2%                        │
│     ✅ Target: <5%                          │
│                                            │
│ 😊 NPS Score: 58                           │
│     ✅ Target: >50                          │
│                                            │
│ 📊 Activation Rate: 91%                    │
│     ✅ Target: >90%                         │
│                                            │
│ ────────────────────────────────────────   │
│                                            │
│ 🚨 Alerts:                                 │
│ • None (All metrics healthy)               │
│                                            │
│ 📈 Trends (Last 7 days):                   │
│ • Template usage ↑ 5%                      │
│ • Error rate ↓ 1.2%                        │
│ • NPS ↑ 3 points                           │
│                                            │
└────────────────────────────────────────────┘
```

**Implementation:**
```typescript
// Create monitoring dashboard in internal admin
// URL: /admin/automation-studio/metrics

// Fetch aggregated metrics
const metrics = await db.query(`
  SELECT
    AVG(creation_duration) as avg_creation_time,
    (COUNT(*) FILTER (WHERE created_from = 'template') / COUNT(*))::FLOAT as template_usage_rate,
    (COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*))::FLOAT as error_rate,
    AVG(nps_score) as avg_nps
  FROM automation_analytics
  WHERE created_at > NOW() - INTERVAL '7 days'
`);
```

---

### Weekly Review Ritual

**Every Monday morning:**
1. Review dashboard (5 minutes)
2. Identify 1 metric below target (if any)
3. Assign owner to investigate (15 minutes)
4. Propose 1 action to improve (30 minutes)
5. Track improvement next week

**Example Action Log:**
```
Week 1: Error rate 8% (above target 5%)
Action: Add inline validation for discount percentage
Owner: Dev Team
Result: Week 2 error rate dropped to 3.2% ✅

Week 2: Template usage 68% (below target 80%)
Action: Add "Most Popular" section to template gallery
Owner: UX Team
Result: Week 3 template usage increased to 76%, Week 4 to 82% ✅
```

---

### Quarterly Goals

**Q3 2026 (MVP Launch):**
- ✅ <3 min time to first automation
- ✅ >80% template usage
- ✅ <5% error rate
- ✅ NPS >50

**Q4 2026 (V1.1):**
- ✅ <2 min time to first automation (with NLP)
- ✅ >85% template usage (20+ templates)
- ✅ <3% error rate (improved validation)
- ✅ NPS >60

**Q1 2027 (V2.0):**
- ✅ 10x increase in rules created/month
- ✅ 90% reduction in manual config time
- ✅ 80% reduction in support tickets
- ✅ NPS >70 (world-class)

---

## 🎉 CONCLUSION

### Document Summary

This UX design document provides a comprehensive blueprint for **Bella Automation Studio**, a Canva-style visual rule builder that transforms complex business logic into intuitive, 3-step automation creation.

**What We've Defined:**
1. ✅ Vision & Principles (Progressive disclosure, natural language, template-first)
2. ✅ User Research (2 personas: Chị Mai & Anh Tuấn)
3. ✅ Information Architecture (6 intent categories, contextual options)
4. ✅ User Flows (6 flows: Create, Template, List, Analytics, Edit, Debug)
5. ✅ Wireframes (6 screens: Intent → Conditions → Actions → Preview → Success → List)
6. ✅ Component Library (10 reusable components + design tokens)
7. ✅ Visual Design System (Colors, typography, icons, animations)
8. ✅ Interaction Patterns (10 patterns: Progressive disclosure, instant feedback, undo, etc.)
9. ✅ Accessibility (WCAG 2.1 AA compliance, keyboard nav, screen reader support)
10. ✅ Implementation Roadmap (6 sprints, 11 weeks to MVP)
11. ✅ Success Metrics (Time to first automation, template usage, NPS, error rate)

---

### Key Differentiators

**Bella Automation Studio vs. Competitors:**

| Feature | Odoo | Salesforce | Zapier | Bella Studio |
|---------|------|------------|--------|--------------|
| No-code | ❌ | Partial | ✅ | ✅ |
| Natural language | ❌ | ❌ | ❌ | ✅ (V1.1) |
| Template-first | ❌ | Partial | ✅ | ✅ |
| <3 min setup | ❌ | ❌ | Partial | ✅ |
| Domain-specific | ❌ | ❌ | Generic | ✅ Spa industry |
| AI insights | ❌ | ❌ | ❌ | ✅ (V2.0) |

**Unique Value Proposition:**
> "Bella Automation Studio là cách dễ nhất để spa tự động hóa quy trình - không cần IT, không cần đào tạo, chỉ cần 2-3 phút."

---

### Next Steps

**Immediate (This Week):**
1. ✅ Approve UX design document (Product Owner sign-off)
2. ✅ Kickoff Sprint 0 (Project setup, component library bootstrap)
3. ✅ Assign dev team (2 frontend + 1 backend engineer)

**Short-Term (Next 2 Weeks):**
1. ✅ Complete Sprint 1 (Visual Builder MVP - Steps 1-3)
2. ✅ Conduct first internal demo
3. ✅ Gather feedback from Bella team

**Mid-Term (Next 11 Weeks):**
1. ✅ Complete Sprints 2-6 (MVP with all features)
2. ✅ Pilot with 3-5 friendly spa owners
3. ✅ Production launch (soft launch)

**Long-Term (Q4 2026 - Q1 2027):**
1. ✅ Add natural language input (Sprint 7)
2. ✅ Add "Explain Why" feature (Sprint 8)
3. ✅ Expand to 20+ templates
4. ✅ Public launch with marketing campaign

---

### Design Principles to Remember

Throughout implementation, always refer back to these 6 principles:

1. **Progressive Disclosure:** Show only what's needed, when it's needed
2. **Natural Language First:** Business language, not technical jargon
3. **Template-First Discovery:** 80% use templates, not from scratch
4. **Instant Feedback:** Users see results immediately
5. **Contextual Intelligence:** Show relevant options only
6. **Explain Why:** AI narrates decisions (future)

---

### Final Quote

> "If a spa owner opens Bella for the first time and can create an automation in 2-3 minutes WITHOUT ANY TUTORIAL, we've achieved the goal of 'Easiest ERP ever'."

— Product Vision

---

**Document Version:** 1.0 (Complete)  
**Last Updated:** 2026-07-12  
**Status:** ✅ Ready for Implementation

**Approvals:**
- [ ] Product Owner
- [ ] UX Lead
- [ ] Engineering Lead
- [ ] Spa Owner (Pilot user review)

---


### Flow 3: Command Palette (Ctrl+K) - Power User Shortcut

**Scenario:** Anh Tuấn (IT Manager) wants to quickly create/find automations without clicking through UI.

**Trigger:** Press **Ctrl+K** (Cmd+K on Mac) from anywhere in Bella

**Screen:**
```
┌──────────────────────────────────────────────────────┐
│ 🔍 [Search or create...________________]             │
│                                                      │
│ Quick Actions                                        │
│ ├─ ⚡ Create Automation                              │
│ ├─ 🎁 Create Promotion Rule                          │
│ ├─ 📅 Create Booking Automation                      │
│ ├─ 👥 Manage Customers                               │
│ └─ 📊 View Analytics                                 │
│                                                      │
│ Recent Automations                                   │
│ ├─ 🎁 Khuyến mãi VIP 15% (Đang chạy)                │
│ ├─ 🎂 Sinh nhật giảm 20% (Đang chạy)                │
│ └─ 📅 Booking cuối tuần (Tạm dừng)                   │
│                                                      │
│ Templates                                            │
│ ├─ 🔥 Phổ biến nhất                                 │
│ ├─ 🎁 Khuyến mãi                                    │
│ └─ 📅 Booking                                        │
└──────────────────────────────────────────────────────┘
```

**As user types:**
```
User types: "vip"

┌──────────────────────────────────────────────────────┐
│ 🔍 [vip___________________________________]          │
│                                                      │
│ Automations matching "vip"                           │
│ ├─ 🎁 Khuyến mãi VIP 15% (Edit | View | Pause)      │
│ ├─ 💎 VIP miễn phí massage (Edit | View | Pause)    │
│ └─ 🎉 VIP birthday package (Template, not used yet)  │
│                                                      │
│ Templates matching "vip"                             │
│ ├─ 💎 VIP 15% mọi dịch vụ (248 spa dùng)            │
│ ├─ 🎁 VIP miễn phí massage (142 spa dùng)           │
│ └─ 🎂 VIP birthday special (89 spa dùng)             │
│                                                      │
│ Create new                                           │
│ └─ ⚡ Create "VIP" automation from scratch           │
└──────────────────────────────────────────────────────┘
```

**Keyboard Navigation:**
- Arrow keys: Move selection
- Enter: Open selected item
- Esc: Close palette
- Ctrl+1-9: Quick jump to numbered items

**Why This Matters:**
- Power users (like Anh Tuấn) work 10x faster
- No mouse needed (keyboard-only workflow)
- Instant access from anywhere
- Fuzzy search (finds "vip" even if title is "Khuyến mãi VIP")

---

### Flow 4: Search Everywhere (Global Search)

**Scenario:** Chị Mai remembers creating a "birthday" automation but can't find it in the list.

**Trigger:** Click search bar at top (or Ctrl+K → type query)

**Screen:**
```
[Header bar, always visible]
┌──────────────────────────────────────────────────────┐
│ [☰ Menu] 🔍 [Search automations, customers...______] │
└──────────────────────────────────────────────────────┘

User types: "sinh nhật"

┌──────────────────────────────────────────────────────┐
│ Automations (2)                                      │
│ ├─ 🎂 Sinh nhật giảm 20% (Đang chạy)                │
│ │   Last triggered: 2h ago for Khách Mai            │
│ └─ 🎁 Sinh nhật VIP special (Tạm dừng)               │
│     Last edited: 3 days ago                         │
│                                                      │
│ Templates (3)                                        │
│ ├─ 🎂 Sinh nhật giảm 20% (248 spa dùng)             │
│ ├─ 🎉 Sinh nhật + tặng điểm (156 spa dùng)           │
│ └─ 🎂 VIP birthday special (89 spa dùng)             │
│                                                      │
│ Customers with birthday today (5)                    │
│ ├─ Lan (VIP, 0979637535, Sinh nhật: 12/07)         │
│ ├─ Mai (Loyal, 0912345678, Sinh nhật: 12/07)       │
│ └─ [View all 5 →]                                    │
│                                                      │
│ Related workflows                                    │
│ └─ 📩 SMS Campaign: Birthday greetings               │
└──────────────────────────────────────────────────────┘
```

**Search Scope:**
- Automations (name, description, conditions, actions)
- Templates (name, description, category)
- Customers (name, phone, tier)
- Workflows (name, description)
- Rules (rule name, provider)

**Why This Matters:**
- Users don't remember exact names
- Cross-domain search (not just automations)
- Contextual results (e.g., shows customers with birthday today when searching "sinh nhật")

---

