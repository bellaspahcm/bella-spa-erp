# 🎨 UX-First Roadmap (2026-2027) - Progress Tracker

**Last Updated:** 2026-07-12  
**Overall Status:** ⏸️ Planning Complete, Implementation NOT Started  
**Strategic Direction:** Product-Market Fit > Technical Excellence  
**Resource Allocation:** 80% UX, 20% Backend

---

## 📊 Roadmap Overview

**Total Timeline:** 48 weeks (~11 months)  
**Phases:** 9 phases (A-I)  
**Current Phase:** Planning complete, awaiting implementation start

| Quarter | Phases | Status | Duration |
|---------|--------|--------|----------|
| **Q3 2026** | A-E (Foundation + Pilot) | ⏸️ Not started | 12 weeks |
| **Q4 2026** | E-F (Pilot + Analytics) | ⏸️ Planned | 12 weeks |
| **Q1 2027** | G-H (Scale + Polish) | ⏸️ Planned | 12 weeks |
| **Q2 2027** | I (AI Layer) | ⏸️ Planned | 12 weeks |

---

## ✅ Planning Documents (COMPLETE)

### 1. Original Roadmap ✅
**File:** `docs/BELLA_2026_2027_UX_FIRST_ROADMAP.md`  
**Status:** ✅ Complete (baseline)  
**Score:** 8.6/10 (product feedback)

**Issues Identified:**
- Customer validation too late (after 3 weeks)
- AI positioned wrong (foundation vs growth layer)
- Missing templates (users want to USE rules, not CREATE)
- Empty experience not addressed
- Business language not clear (field/operator/value still technical)

---

### 2. Revised Roadmap ✅
**File:** `docs/BELLA_2026_2027_UX_FIRST_ROADMAP_REVISED.md`  
**Status:** ✅ Complete (2026-07-10)  
**Target Score:** 9.5/10

**Key Changes:**
- ✅ Templates > AI generation (70%+ template usage target)
- ✅ Customer validation every week (not after 3 weeks)
- ✅ Business language UI (not technical field/operator/value)
- ✅ Defer AI Generate to Q2 2027 (growth layer)
- ✅ Added Rule Templates (Phase B)
- ✅ Added Analytics (Phase F)
- ✅ Added Onboarding Experience (Phase D)

---

### 3. Phase 2-3 Implementation Plan ✅
**File:** `docs/PHASE_2_3_VISUAL_BUILDER_NATURAL_LANGUAGE_PLAN.md`  
**Status:** ✅ Complete  
**Scope:** Week 1-6 (Visual Builder + Natural Language)

**Sections:**
- Week 1: Field Schemas + ConditionCard MVP
- Week 2: ActionCard + Save/Load
- Week 3-4: Rule Templates (15-20 templates)
- Week 5: Natural Language Engine
- Week 6: Explain Why UI

---

### 4. Quick-Start Checklist ✅
**File:** `docs/PHASE_2_3_QUICK_START_CHECKLIST.md`  
**Status:** ✅ Complete  
**Format:** Day-by-day checklist

**Structure:**
- Week 1: Days 1-5 (Field schemas, ConditionCard)
- Week 2: Days 6-10 (ActionCard, integration)
- Checkpoint: Week 2 Friday demo to customers

---

## ❌ Q3 2026: Foundation + Validation (NOT STARTED)

### Phase A: Conversational Builder (Week 1-2) ❌ **⚠️ DESIGN CHANGED**

**Status:** ❌ 0% Complete  
**Duration:** 2 weeks  
**Priority:** ⭐⭐⭐⭐⭐ HIGHEST  
**Design:** ✅ Approved (2026-07-12) - Conversational approach

**CRITICAL CHANGE:** Scrapped old "field/operator/value" design  
**NEW APPROACH:** "Canva for Business Rules" - Conversational intent-based

#### ❌ NOT This (OLD - Technical):
```
[Field ▼] [Operator ▼] [Value]
+ Add Condition
```
= JSON with pretty UI ❌

#### ✅ BUT This (NEW - Conversational):
```
Bella muốn giúp bạn điều gì?
  🎁 Khuyến mãi (89% spa dùng)
  👩 Phân công KTV (76% spa dùng)
    ↓
Khi nào?
  ☐ Khách VIP
  ☐ Cuối tuần
    ↓
Bella sẽ làm gì?
  💰 Giảm 15%
    ↓
DONE (JSON generated behind)
```
= Conversation with Bella ✅

#### Week 1 Tasks (REVISED - NOT Started)
- [ ] IntentSelector.tsx (7 categories: Khuyến mãi, Phân công, Hoa hồng, etc.)
- [ ] WhenSelector.tsx (checkboxes, NOT field/operator/value)
- [ ] ActionSelector.tsx (icons + simple inputs, NOT technical forms)
- [ ] PreviewGenerator.ts (Vietnamese natural language)
- [ ] Integration with Decision Engine (backend unchanged)
- [ ] Unit tests (components only, no field schemas)

#### Week 2 Tasks (NOT Started)
- [ ] ActionCard component (visual cards with icons)
- [ ] Action types (discount, assign, notify, approve, reject)
- [ ] Save/Load rules with visual builder
- [ ] Integration with Decision Engine
- [ ] Demo to 2-3 spa owners (Friday)
- [ ] Iterate based on feedback

#### Success Criteria
- [ ] Non-technical spa owner creates rule in <3 minutes (NOT 5)
- [ ] Zero questions about "what is operator?"
- [ ] User says "Tôi hiểu ngay!"

---

### Phase B: Rule Templates (Week 3-4) ❌

**Status:** ❌ 0% Complete  
**Duration:** 2 weeks  
**Priority:** ⭐⭐⭐⭐⭐ HIGH

#### Goal
Users don't CREATE rules, they USE rules

#### Template Library (NOT Started)
```
★★★★★ Khuyến mãi VIP cuối tuần
89% spa đang dùng
[Áp dụng ngay]

★★★★★ Khuyến mãi sinh nhật
76% spa đang dùng
[Áp dụng ngay]

... (15-20 templates total)
```

#### Week 3 Tasks
- [ ] Template system architecture
- [ ] 15-20 templates (Vietnamese descriptions)
- [ ] Template categories (Khuyến mãi, Phân công, Hoa hồng, Nhắc lịch)
- [ ] One-click apply logic
- [ ] Customization flow (apply → adjust → save)

#### Week 4 Tasks
- [ ] Category UI (browse by category)
- [ ] Social proof ("X% spa đang dùng")
- [ ] Template search
- [ ] Demo to 3-5 pilot customers
- [ ] Track: Template usage vs custom rules
- [ ] Measure: Time to first rule

#### Success Criteria
- [ ] >70% users apply template (vs create from scratch)
- [ ] <2 minutes to first rule
- [ ] "Không cần hướng dẫn" feedback

---

### Phase C: Natural Language + Explain Why (Week 5-6) ❌

**Status:** ❌ 0% Complete  
**Duration:** 2 weeks  
**Priority:** ⭐⭐⭐⭐⭐ HIGH

#### Goal
NOT just translation, but INTELLIGENCE

#### Week 5: Natural Language Engine (NOT Started)
- [ ] Vietnamese generator (context-aware)
- [ ] Business value calculator (ROI, impact)
- [ ] Impact predictor (based on historical data)
- [ ] Integration in all rule views

**Example Output:**
```
"Khuyến mãi VIP cuối tuần

Khi khách hàng VIP đặt dịch vụ Premium trên 2 triệu vào thứ 7 hoặc chủ nhật, 
hệ thống sẽ tự động giảm 15%.

💡 Mục tiêu: Tăng tỷ lệ booking cuối tuần lên 30%
📊 Áp dụng cho: ~50 khách VIP/tháng
💰 Chi phí dự kiến: ~3-5 triệu/tháng
✅ Hiệu quả dự đoán: Tăng 25% doanh thu cuối tuần"
```

#### Week 6: Explain Why UI (NOT Started)
- [ ] Decision detail page (reasoning display)
- [ ] Assignment UI (why this KTV?)
- [ ] Conflict resolution (why rejected?)
- [ ] Dashboard business metrics

**Example Output:**
```
"Bella đề xuất: Lan ⭐⭐⭐⭐⭐

Vì sao?
✓ Đánh giá cao nhất (4.9/5.0)
✓ Rảnh lúc 10:00-12:00 hôm nay
✓ Chuyên môn Facial Premium (8 năm kinh nghiệm)
✓ Khách quen (đã phục vụ 3 lần trước)
✓ Hôm nay ít việc (chỉ 2 ca)

👥 KTV khác:
   Mai: Đang bận (10:30 có lịch)
   Hoa: Chưa được training Facial Premium
   Linh: Đánh giá 4.2 (thấp hơn Lan)"
```

#### Success Criteria
- [ ] User understands rule without reading conditions/actions
- [ ] CEO can explain rule to staff (in Vietnamese)
- [ ] Audit-ready documentation
- [ ] "Tại sao?" question answered 100% of time

---

### Phase D: Onboarding Experience (Week 7-8) ❌

**Status:** ❌ 0% Complete  
**Duration:** 2 weeks  
**Priority:** ⭐⭐⭐⭐⭐ HIGH

#### Goal
First 5 minutes make or break adoption

#### Empty Experience (NOT Started)
```
┌─────────────────────────────────────┐
│  Chào mừng đến với Bella ERP        │
│                                     │
│  Bella muốn giúp bạn điều gì?      │
│                                     │
│  ○ Khuyến mãi (Giảm giá tự động)   │
│  ○ Phân công KTV (Tự động gán ca)  │
│  ○ Hoa hồng (Tính lương công bằng) │
│  ○ Booking (Quản lý lịch hẹn)      │
│  ○ Nhắc lịch (Gửi SMS/Zalo)        │
│                                     │
│  [Bắt đầu] [Xem demo]               │
└─────────────────────────────────────┘
```

#### Week 7 Tasks
- [ ] Empty state redesign (wizard, not blank page)
- [ ] Intent selector UI
- [ ] Template recommendation engine
- [ ] One-click apply with customization
- [ ] Success screen (with predicted metrics)

#### Week 8 Tasks
- [ ] User testing with 5+ new users
- [ ] Measure time-to-first-rule
- [ ] A/B test different onboarding flows
- [ ] Optimize for <2 minute completion

#### Success Criteria
- [ ] >90% new users complete onboarding
- [ ] <2 minutes to first rule
- [ ] "Không cần training" feedback
- [ ] <10% abandonment rate

---

### Phase E: Pilot Customer Program (Week 9-16) ❌

**Status:** ❌ 0% Complete  
**Duration:** 8 weeks  
**Priority:** ⭐⭐⭐⭐⭐ HIGHEST (Validation)

#### Goal
3-5 pilot spas using Bella in production

#### Pilot Recruitment (NOT Started)
- [ ] Identify 3-5 spas
  - Different sizes (5 KTV, 10 KTV, 20+ KTV)
  - Different specialties (Massage, Facial, Nail, Full-service)
  - Different tech savviness
- [ ] Revenue model: Free for 6 months (in exchange for feedback)

#### Weekly Cadence
- Monday: Review last week metrics
- Wednesday: Feature demo (if new release)
- Friday: Office hours (Q&A, troubleshooting)
- Async: Slack/Zalo support group

#### Metrics to Track
| Metric | Week 1 | Week 4 | Week 8 | Target |
|--------|--------|--------|--------|--------|
| Daily Active Users | - | - | - | >80% staff |
| Rules Created | 0 | 5 | 15 | 10+ |
| Template Usage | - | - | - | >70% |
| Time to First Rule | - | - | - | <2 min |
| Support Tickets | - | - | - | <5/week |
| NPS Score | - | - | - | >50 |
| Churn Risk | - | - | - | <20% |

#### Success Criteria
- [ ] 3+ spas using Bella daily (>1 month)
- [ ] >50 NPS score
- [ ] <20% churn risk
- [ ] 2+ case studies ready
- [ ] Product-market fit signals

---

## ❌ Q4 2026: Pilot + Analytics (NOT STARTED)

### Phase F: Rule Analytics + Optimization (Week 13-16) ❌

**Status:** ❌ 0% Complete  
**Duration:** 4 weeks  
**Priority:** ⭐⭐⭐⭐ HIGH

#### Goal
Data-driven rule improvements

#### Dashboard (NOT Started)
```
┌──────────────────────────────────────────┐
│  📊 Hiệu quả của Rules                   │
│                                          │
│  ★★★★★ Khuyến mãi sinh nhật             │
│  ✅ Đang chạy                            │
│  📈 15 khách áp dụng (tuần này)          │
│  💰 2.4 triệu giảm giá                   │
│  💵 6.8 triệu doanh thu tăng (ROI 283%)  │
│  📊 Tỷ lệ quay lại: 85% (tăng 12%)       │
│                                          │
│  ⚠️ Khuyến mãi VIP cuối tuần             │
│  ⚠️ Ít người dùng (3 khách/tuần)         │
│  💡 Gợi ý: Thử giảm điều kiện từ         │
│     "2 triệu" → "1.5 triệu"              │
└──────────────────────────────────────────┘
```

#### Features
- [ ] Rule performance dashboard (hit count, ROI, outcomes)
- [ ] Underperforming rule detection (low usage, never triggered, negative ROI)
- [ ] Optimization suggestions (A/B test, threshold adjustments, conflict warnings)
- [ ] ROI calculator (cost vs revenue impact)
- [ ] Recommendation engine (ML-based or rule-based)

#### Success Criteria
- [ ] Users identify underperforming rules in <1 minute
- [ ] >30% rules optimized based on suggestions
- [ ] Users trust data-driven recommendations

---

## ❌ Q1 2027: Scale + Polish (NOT STARTED)

### Phase G: Market-Ready Polish (Week 17-20) ❌
### Phase H: Rule Marketplace (Week 21-24) ❌

**Status:** ❌ 0% Complete (both phases)  
**Priority:** ⭐⭐⭐ MEDIUM

*(Detailed scope in revised roadmap document)*

---

## ❌ Q2 2027: AI Layer (NOT STARTED)

### Phase I: AI Assistant (Week 25-32) ❌

**Status:** ❌ 0% Complete  
**Priority:** ⭐⭐⭐ MEDIUM (Growth layer)

**Note:** Deferred to Q2 2027 intentionally. AI is growth layer, not foundation.

---

## 📊 Overall Progress Summary

### Completion by Quarter
| Quarter | Phases | Planned | Complete | In Progress | Not Started | % Complete |
|---------|--------|---------|----------|-------------|-------------|------------|
| **Q3 2026** | A-E | 5 | 0 | 0 | 5 | 0% |
| **Q4 2026** | E-F | 2 | 0 | 0 | 2 | 0% |
| **Q1 2027** | G-H | 2 | 0 | 0 | 2 | 0% |
| **Q2 2027** | I | 1 | 0 | 0 | 1 | 0% |

**Overall:** 0% (0/10 phases complete)

### Deliverables Status
| Deliverable | Status | Notes |
|-------------|--------|-------|
| **Planning Docs** | ✅ 100% | 4 documents complete |
| **Implementation** | ❌ 0% | Not started yet |
| **Pilot Program** | ❌ 0% | No customers recruited |
| **Analytics** | ❌ 0% | Not planned in detail |

---

## 🎯 Success Metrics (Targets)

### User Experience Metrics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Time to First Rule | <2 min | N/A | Not measured |
| Rule Success Rate | >95% | N/A | Not measured |
| Rule Abandonment | <10% | N/A | Not measured |
| Self-Service Rate | >80% | N/A | Not measured |
| No Training Required | >70% | N/A | Not measured |
| Template Usage | >70% | N/A | Not measured |
| Rule Comprehension | >90% | N/A | Not measured |

### Business Impact Metrics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Daily Active Usage | >80% | N/A | Not measured |
| NPS Score | >50 | N/A | Not measured |
| Customer Retention | >80% | N/A | Not measured |
| Time Saved | >5 hrs/week | N/A | Not measured |
| ROI | >300% | N/A | Not measured |
| Support Tickets | <5/week | N/A | Not measured |

---

## 🚀 Next Steps

### Immediate Priority (This Week)
**Option A:** Complete Waitlist Day 13-14 first (1-2 days)  
**Option B:** Start Phase A Visual Builder immediately (2 weeks)

**Recommendation:** Option A (finish Waitlist first)

**Rationale:**
- Quick win (1-2 days)
- Complete Phase 1
- Clean slate for Phase 2
- Builds momentum

---

### After Waitlist Complete
**Start Phase A: Visual Builder Week 1-2**

**Checklist:**
1. Read `PHASE_2_3_QUICK_START_CHECKLIST.md`
2. Day 1: Field type system
3. Day 2: Field schema definitions
4. Day 3-4: ConditionCard component
5. Day 5: Operator selector + Value inputs
6. Week 2: ActionCard + Integration
7. Friday Week 2: Demo to customers

---

## 📝 Notes for AI Agents

### When Recommending UX Work:
1. ✅ Check this file FIRST - Confirm nothing is in progress
2. ✅ Confirm Waitlist Day 13-14 status before recommending
3. ✅ Follow revised roadmap (not original)
4. ✅ Templates > AI (Phase B before Phase I)
5. ✅ Customer validation every week (not after 3 weeks)

### When Starting Implementation:
1. ✅ Read `PHASE_2_3_QUICK_START_CHECKLIST.md` for day-by-day tasks
2. ✅ Read `PHASE_2_3_VISUAL_BUILDER_NATURAL_LANGUAGE_PLAN.md` for technical details
3. ✅ Read `docs/design/RULE_BUILDER_VISUAL_DESIGN_MOCKUP.md` for UI specs
4. ✅ Update this file after each phase completion

### When Reporting Progress:
1. ✅ Use percentage complete (not vague "in progress")
2. ✅ List specific deliverables complete
3. ✅ Update success metrics when measurable
4. ✅ Document customer feedback after demos

---

**Last Updated:** 2026-07-12  
**Next Review:** After Phase A completion (Week 2)  
**Status Confidence:** 🟢 High (planning docs verified, implementation not started)
