# Conversational Builder - Executive Summary
## Complete UX Overhaul: "Canva for Business Rules"

**Date:** 2026-07-12  
**Decision:** APPROVED - Scrap old design, build conversational approach  
**Impact:** Changes entire Visual Builder implementation (Week 1-2)

---

## 🎯 THE BIG CHANGE

### ❌ OLD (Technical Mindset)
```
[Field ▼] [Operator ▼] [Value]
+ Add Condition
```
= JSON with pretty UI = WRONG ❌

### ✅ NEW (Canva/Notion Mindset)
```
Bella muốn giúp bạn điều gì?
  🎁 Khuyến mãi
  👩 Phân công
    ↓
Khi nào?
  ☐ Khách VIP
  ☐ Cuối tuần
    ↓
Bella sẽ làm gì?
  💰 Giảm 15%
```
= Conversation = RIGHT ✅

---

## 📋 3-STEP USER FLOW

### Step 1: Intent Selector (NOT "Create Rule")
```
🎁 Khuyến mãi (89% spa dùng)
👩 Phân công KTV (76% spa dùng)
💰 Hoa hồng (64% spa dùng)
```
Click → Next

### Step 2: When Selector (NOT "Conditions")
```
Khi nào áp dụng khuyến mãi?
☐ Khách VIP
☐ Sinh nhật
☐ Cuối tuần
☐ Booking trên ___ triệu

○ Tất cả điều kiện trên (AND)
○ Ít nhất một điều kiện (OR)
```
Check boxes → Next

### Step 3: Action Selector (NOT "Actions")
```
Bella sẽ làm gì?
💰 Giảm [__] %
🎁 Tặng voucher
⭐ Tặng [__] điểm
📩 Gửi SMS
```
Fill inputs → Preview

### Step 4: Auto-Generated Preview
```
✨ Bella sẽ:

Khi khách VIP đặt dịch vụ trên 2 triệu vào cuối tuần
  ↓
Giảm 15%
Tặng 100 điểm

💡 Dự đoán:
~50 khách/tháng
Chi phí: 3-5 triệu
Tăng doanh thu: 8-12 triệu

[Lưu] [Sửa]
```

User NEVER sees JSON ✅

---

## 🎨 LEFT PANEL: Template Gallery (Like Canva)

```
📂 Templates

🎁 Khuyến mãi
  🔥 VIP Weekend (Click = Auto-fill)
  🎂 Birthday Promo
  💝 Combo Deal
  ⚡ Flash Sale

👩 Phân công
  ⭐ Senior First
  📊 Load Balance
  💎 VIP Priority

💰 Hoa hồng
  📈 Volume Tier
  ⭐ Rating Bonus
  🎯 KPI Bonus
```

**Flow:** Click template → Form auto-filled → Customize → Save

**NOT:** Start from blank builder ❌

---

## 📝 TERMINOLOGY CHANGES (Critical!)

| ❌ OLD | ✅ NEW |
|-------|-------|
| Create Rule | Bella muốn giúp bạn điều gì? |
| Conditions | Khi nào? |
| Actions | Bella sẽ làm gì? |
| Field | Khách hàng, Dịch vụ, Booking |
| Operator | là, lớn hơn, nhỏ hơn, không phải |
| Value | (just input) |
| AND | Tất cả điều kiện |
| OR | Ít nhất một điều kiện |
| Priority | Ưu tiên (slider) |
| Rule Status | ✅ Đang chạy, ⏸️ Tạm dừng |

**NO technical terms visible to user** ✅

---

## 🚀 IMPLEMENTATION IMPACT

### What Changes (Everything!)

**Week 1 (Originally):**
- ❌ Field schemas (customer.tier, booking.amount)
- ❌ ConditionCard with field/operator/value
- ❌ Operator selector

**Week 1 (NEW):**
- ✅ Intent Selector (7 categories)
- ✅ When Selector (checkbox UI)
- ✅ Action Selector (icon + input)
- ✅ Auto-preview generator (Vietnamese)

**Week 2 (Originally):**
- ❌ ActionCard component
- ❌ Save/Load JSON

**Week 2 (NEW):**
- ✅ Template Gallery (left panel)
- ✅ One-click apply
- ✅ Business metrics predictor
- ✅ Demo to spa owners (Friday)

### What Stays Same
- ✅ Database schema (no changes)
- ✅ API routes (no changes)
- ✅ Decision Engine integration (no changes)
- ✅ Backend logic (no changes)

**Only frontend UI changes** ✅

---

## 🎯 SUCCESS CRITERIA (Updated)

| Metric | OLD Target | NEW Target |
|--------|-----------|-----------|
| Time to first rule | <3 min | **<1 min** |
| Zero "what is operator?" | 90% | **100%** |
| Template usage | 70% | **90%** |
| "Tôi hiểu ngay" | 80% | **95%** |
| Training required | <30% | **<10%** |

---

## 📦 DELIVERABLES (Week 1-2)

### Week 1: Conversational Builder MVP
1. IntentSelector.tsx (7 categories)
2. WhenSelector.tsx (checkboxes, not field/operator)
3. ActionSelector.tsx (icons + inputs)
4. PreviewGenerator.ts (Vietnamese natural language)
5. Integration with Decision Engine (backend unchanged)

### Week 2: Template System
1. TemplateGallery.tsx (left panel)
2. 15-20 templates (JSON definitions)
3. One-click apply logic
4. Social proof badges
5. Demo preparation

---

## 💡 KEY INSIGHTS

1. **Templates > Creation** - Users want to USE, not CREATE
2. **Conversation > Builder** - Feels like telling Bella what to do
3. **Business Language > Technical** - No field/operator/value visible
4. **Intent-First > Structure-First** - Ask "What?" not "How?"
5. **Visual > JSON** - Checkboxes/icons, not text inputs

---

## 📄 RELATED DOCUMENTS

**Full Design Specs:**
- `docs/design/CONVERSATIONAL_BUILDER_UX_DESIGN.md` - Complete UI flows (TODO: Finish writing)

**Implementation Plans:**
- `docs/PHASE_2_3_VISUAL_BUILDER_NATURAL_LANGUAGE_PLAN.md` - NEEDS UPDATE
- `docs/PHASE_2_3_QUICK_START_CHECKLIST.md` - NEEDS UPDATE

**Progress Tracking:**
- `docs/progress/UX_ROADMAP_PROGRESS.md` - NEEDS UPDATE

---

**Status:** ✅ Design approved, implementation plans need update  
**Next:** Update implementation plan + checklist with new approach  
**Timeline:** No change (still 2 weeks for MVP)
