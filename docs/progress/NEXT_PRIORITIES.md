# 🎯 Next Priorities - What to Work On Next

**Last Updated:** 2026-07-12  
**Decision Framework:** Strategic alignment + Business impact + Effort required  
**Strategic Direction:** UX-First (80% UX, 20% Backend)

---

## 🏆 TOP PRIORITY: UX Roadmap (Conversational Builder) **⚠️ DESIGN UPDATED**

**Recommendation:** ⭐⭐⭐⭐⭐ **START THIS NEXT**

**CRITICAL UPDATE (2026-07-12):** Design completely revised based on user feedback

### Design Change Summary
- ❌ OLD: "Field/Operator/Value" technical builder
- ✅ NEW: "Conversational intent-based" builder (Canva/Notion approach)
- Goal: User answers 2 questions ("Khi nào?", "Bella sẽ làm gì?")
- NO technical terms visible (field, operator, condition, action, JSON)

### Why This is #1
1. **Strategic Alignment:** "ERP dễ dùng nhất" requires conversational UX
2. **Business Impact:** <1 minute to first rule (vs <3 minutes with technical builder)
3. **Platform Foundation Ready:** Decision Engine proven (9.1/10 maturity)
4. **Market Differentiation:** "Canva for Business Rules" = unique positioning
5. **User Feedback:** "Làm đơn giản dễ hiểu dễ dùng, mục tiêu giống Notion hoặc Canva"

### What Gets Done (REVISED)
- **Week 1:** Conversational Builder MVP
  - IntentSelector.tsx (7 categories: 🎁 Khuyến mãi, 👩 Phân công, 💰 Hoa hồng)
  - WhenSelector.tsx (Checkboxes: ☐ Khách VIP, ☐ Cuối tuần, NOT field/operator)
  - ActionSelector.tsx (Icons + inputs: 💰 Giảm [__]%, NOT technical forms)
  - PreviewGenerator.ts (Auto-generate Vietnamese description)
  - Demo to 2-3 spa owners (Friday Week 1)

- **Week 2:** Template System
  - TemplateGallery.tsx (Left panel, always visible, like Canva)
  - 15-20 templates (🔥 VIP Weekend, 🎂 Birthday, etc.)
  - One-click apply (click template → form auto-filled → customize → save)
  - Social proof ("89% spa đang dùng")
  - Demo to 3-5 pilot customers (Friday Week 2)

- **Week 3-4:** Rule Templates (separate phase)
- **Week 5-6:** Natural Language + Explain Why

### Timeline
- **Total:** 6 weeks (no change from original)
- **First value:** Week 1 (Conversational Builder demo)
- **Complete Phase A-C:** Week 6

### Success Criteria (UPDATED - Higher Bar)
- **<1 minute** to create first rule (not <3 minutes) ⬆️
- **Zero questions** about "what is operator?" (100%, not 90%) ⬆️
- User says "Tôi hiểu ngay!" (95%+, not 80%) ⬆️
- **>90% users apply template** (vs <10% create from scratch) ⬆️

### Blocking Dependencies
- ❌ None (Decision Engine complete, design approved)

### Documents to Read
- `docs/BELLA_2026_2027_UX_FIRST_ROADMAP_REVISED.md` - Strategic direction
- `docs/PHASE_2_3_VISUAL_BUILDER_NATURAL_LANGUAGE_PLAN.md` - Implementation plan
- `docs/PHASE_2_3_QUICK_START_CHECKLIST.md` - Day-by-day checklist
- `docs/design/RULE_BUILDER_VISUAL_DESIGN_MOCKUP.md` - Visual specs

---

## 🥈 PRIORITY 2: Complete Waitlist (Day 13-14)

**Recommendation:** ⭐⭐⭐⭐ **Quick Win Before UX Roadmap**

### Why This is #2
1. **Low Hanging Fruit:** Only 1-2 days remaining
2. **Complete Phase 1:** Finish what we started (83% → 100%)
3. **First Customer Feature:** Waitlist is customer-facing
4. **Psychological:** Completing initiatives builds momentum

### What Gets Done
- **Day 13:** Integration tests
  - E2E workflows (add to waitlist → notify → reserve → convert)
  - Mock provider validation
  - Error handling tests

- **Day 14:** Pilot testing
  - Pilot testing plan
  - Production deployment checklist
  - Rollback procedure

### Timeline
- **Total:** 1-2 days
- **Blocking:** None (Day 1-12 complete)

### Success Criteria
- All E2E workflows tested
- Pilot plan documented
- Deployment checklist ready

### Recommendation: **Do this BEFORE starting UX Roadmap**
- Rationale: Clean slate for Phase 2
- Impact: 1-2 days won't delay UX roadmap significantly
- Benefit: Psychological win + complete feature

---

## 🥉 PRIORITY 3: Rule Management UI Phase 3 (Visual Builder)

**Recommendation:** ⭐⭐⭐ **Consider After UX Roadmap Week 1-2**

### Why This is #3
1. **Overlaps with UX Roadmap:** Visual Builder is core of both
2. **Can Reuse Components:** ConditionCard, ActionCard from UX roadmap
3. **Complete Self-Service:** Phase 1&2 is metadata only, Phase 3 is full builder

### What Gets Done
- Conditions builder (visual cards)
- Actions builder (visual cards)
- Test simulator UI (execution trace, timeline)
- Approval workflow UI
- Version comparison UI

### Timeline
- **Total:** 7-10 days
- **Blocking:** None (Phase 1&2 complete)
- **Note:** Shares ~50% of work with UX Roadmap Visual Builder

### Recommendation: **Merge into UX Roadmap or do after**
- Option A: Do UX Roadmap Week 1-2, then port to Rule Management UI
- Option B: Do in parallel (if enough resources)
- Option C: Wait until UX Roadmap Phase A-C complete

---

## 📊 PRIORITY 4: Production Runbook

**Recommendation:** ⭐⭐ **Do When Preparing for Production Deployment**

### Why This is #4
1. **Not Urgent:** No immediate production deployment planned
2. **Maintenance Work:** Important but not customer-facing
3. **Can Do Anytime:** No blocking dependencies

### What Gets Done
- Deployment guide (local, staging, production, rollback)
- Monitoring & Observability (metrics, alerts, dashboards)
- Troubleshooting guide
- Scaling guide (horizontal, vertical, HA)

### Timeline
- **Total:** 3-4 days
- **Blocking:** None

### When to Do This
- **Option A:** Before first production deployment (when ready to go live)
- **Option B:** After UX Roadmap Phase A-C (Week 6+)
- **Option C:** When pilot customers need production deployment

---

## 💼 PRIORITY 5: Investor-Grade Platform Report

**Recommendation:** ⭐⭐ **Do When Fundraising**

### Why This is #5
1. **Fundraising Dependent:** Only needed when raising money
2. **Not Urgent:** No immediate fundraising planned
3. **Foundation Complete:** Multi-Provider Validation Report exists (8,500 lines)

### What Gets Done
- Executive summary (1-page overview)
- Technical architecture (leverage existing validation report)
- Competitive analysis
- Market position
- Business value
- Pitch deck

### Timeline
- **Total:** 2-3 days
- **Blocking:** None

### When to Do This
- **When:** 2-4 weeks before fundraising meetings
- **Pre-work:** Complete UX Roadmap Phase A-C first (better story to tell)

---

## 🗓️ RECOMMENDED EXECUTION ORDER

### Immediate (This Week)
1. ✅ **Complete Waitlist Day 13-14** (1-2 days)
   - Quick win
   - Complete Phase 1
   - Clean slate for Phase 2

### Short-Term (Next 6 Weeks)
2. ⭐ **UX Roadmap Phase A-C** (6 weeks)
   - Week 1-2: Visual Builder MVP
   - Week 3-4: Rule Templates
   - Week 5-6: Natural Language + Explain Why
   - Customer demos every Friday
   - Continuous validation

### Medium-Term (Week 7-10)
3. 🎨 **Rule Management UI Phase 3** (7-10 days)
   - Port Visual Builder components
   - Add test simulator
   - Complete self-service story

### As-Needed (When Required)
4. 📖 **Production Runbook** (3-4 days) - Before production deployment
5. 💼 **Investor Report** (2-3 days) - Before fundraising

---

## 📊 Priority Scoring Matrix

| Priority | Strategic Fit | Business Impact | Effort | Urgency | **Total Score** |
|----------|---------------|-----------------|--------|---------|-----------------|
| **UX Roadmap (Visual Builder)** | 10/10 | 9/10 | 6 weeks | High | **9.5/10** ⭐⭐⭐⭐⭐ |
| **Waitlist Day 13-14** | 7/10 | 6/10 | 1-2 days | Medium | **8.0/10** ⭐⭐⭐⭐ |
| **Rule UI Phase 3** | 8/10 | 7/10 | 7-10 days | Low | **7.5/10** ⭐⭐⭐ |
| **Production Runbook** | 5/10 | 5/10 | 3-4 days | Low | **5.0/10** ⭐⭐ |
| **Investor Report** | 4/10 | 6/10 | 2-3 days | Low | **5.0/10** ⭐⭐ |

---

## 🚨 Decision Rules for AI Agents

### When User Asks "What's Next?"
1. **Default Answer:** "Complete Waitlist Day 13-14 (1-2 days), then start UX Roadmap Visual Builder (6 weeks)"
2. **Check:** Has Waitlist Day 13-14 been completed? If yes, skip to UX Roadmap.
3. **Validate:** Read `CURRENT_STATUS.md` to confirm status.

### When User Wants to Start New Work
1. **Ask:** "Do you want to follow recommended priority (Waitlist → UX Roadmap) or something else?"
2. **If recommended:** Start with checklist from appropriate document
3. **If different:** Discuss tradeoffs and confirm direction

### When Priorities Conflict
1. **Strategic alignment wins** - UX-first direction is locked in
2. **Customer-facing wins** over internal tooling
3. **Complete > Start** - Finish Waitlist before new initiatives

---

## 📝 Context for Each Priority

### Why Not "Complete Decision Engine Ecosystem"?
**Answer:** Decision Engine Platform is DONE (9.1/10 maturity). Tasks 11-12 (Runbook, Investor Report) are supplementary documentation, not core platform work. They can wait until needed (production deployment, fundraising).

### Why Not "Build More Providers"?
**Answer:** 5 Providers across 4 domains already proves platform generality. More providers = diminishing returns. Focus shifted to UX layer to make existing providers usable.

### Why Not "Workflow Engine Production"?
**Answer:** Workflow Engine core is complete. Needs SupabaseStateManager for production, but no urgent workflow needs yet. Can add when first workflow goes to production.

---

## 🎯 Success Metrics by Priority

### UX Roadmap (Visual Builder)
- **Week 2:** 2-3 spa owners demo → positive feedback
- **Week 4:** 70%+ users apply template (vs create)
- **Week 6:** <3 min to first rule, zero "what is operator?" questions

### Waitlist Day 13-14
- **Day 14:** All E2E tests passing, pilot plan documented

### Rule UI Phase 3
- **Completion:** Self-service rate >80% (users don't need support)

### Production Runbook
- **Completion:** Zero deployment issues, <5 min rollback time

### Investor Report
- **Completion:** Pitch deck ready, competitive analysis complete

---

## 📞 When to Revisit Priorities

### Trigger Points:
1. **User requests different priority** → Discuss tradeoffs, update this file
2. **UX Roadmap Week 2 demo fails** → Pause, iterate, re-demo
3. **Urgent production need** → Production Runbook jumps to #1
4. **Fundraising meeting scheduled** → Investor Report jumps to #1
5. **Major strategy change** → Rewrite this entire file

### Review Cadence:
- **Weekly:** After completing each milestone
- **Monthly:** Deep review of strategic alignment
- **Quarterly:** Full roadmap revision

---

**Last Updated:** 2026-07-12  
**Next Review:** After Waitlist Day 13-14 completion  
**Status:** ✅ Aligned with revised UX-first strategy  
**Confidence:** 🟢 High (based on user feedback + strategic pivot)
