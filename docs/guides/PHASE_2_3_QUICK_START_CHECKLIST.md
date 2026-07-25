# Phase 2.2 + 3.1: Quick Start Checklist
## Visual Builder + Natural Language (3 Weeks)

**Date:** 2026-07-10  
**Goal:** Transform "Technical Excellence" → "ERP dễ dùng nhất"

---

## ✅ Week 1: Visual Condition Builder

### Day 1-2: Field Schemas
- [ ] Create `src/lib/rule-management/field-schemas.ts`
- [ ] Define `FieldDefinition` interface
- [ ] Map 5 providers (Booking, Discount, Payroll, Commission, Inventory)
- [ ] 50-75 fields with Vietnamese labels
- [ ] Operator mappings by field type
- [ ] Unit tests (10+)

### Day 3-4: ConditionCard Component
- [ ] Create `src/components/rules/ConditionCard.tsx`
- [ ] Field selector dropdown (contextual by provider)
- [ ] Operator selector dropdown (contextual by field type)
- [ ] Value input (dynamic: text/number/select/date)
- [ ] Remove button (×)
- [ ] Card styling (border, shadow, hover)
- [ ] Unit tests (15+)

### Day 5: ConditionBuilder Container
- [ ] Create `src/components/rules/ConditionBuilder.tsx`
- [ ] Render list of ConditionCard
- [ ] [+ Thêm điều kiện] button
- [ ] AND/OR toggle between conditions
- [ ] Empty state
- [ ] Integration with RuleEditor
- [ ] Integration tests (10+)

---

## ✅ Week 2: Action Builder + Natural Language

### Day 1-2: Action Schemas + ActionCard
- [ ] Create `src/lib/rule-management/action-schemas.ts`
- [ ] Define 20-30 action types (all providers)
- [ ] Vietnamese labels + icons
- [ ] Create `src/components/rules/ActionCard.tsx`
- [ ] Action type picker modal
- [ ] Dynamic param form rendering
- [ ] Unit tests (15+)

### Day 3-4: Natural Language Generator
- [ ] Create `src/lib/rule-management/natural-language-generator.ts`
- [ ] `generateVietnameseDescription()` function
- [ ] Field/operator/action label mappings (Vietnamese)
- [ ] Value formatting (money, dates, arrays)
- [ ] Logic joining (AND → "và", OR → "hoặc")
- [ ] Unit tests (25+, edge cases)

### Day 5: Natural Language UI Integration
- [ ] Create `src/components/rules/NaturalLanguagePreview.tsx`
- [ ] "👁 Xem bằng tiếng Việt" toggle
- [ ] Copy-to-clipboard button
- [ ] Integration in RuleEditor (live update)
- [ ] Integration in Rule Detail page (prominent)
- [ ] Integration in RulesTable (preview column)
- [ ] UI tests (10+)

---

## ✅ Week 3: Testing + Documentation + Demo

### Day 1-2: Comprehensive Testing
- [ ] 50+ automated tests (Jest + RTL)
- [ ] Visual Builder happy path (5 scenarios)
- [ ] Visual Builder edge cases (5 scenarios)
- [ ] Natural Language accuracy (9 scenarios)
- [ ] Natural Language edge cases (4 scenarios)
- [ ] Integration tests (5 scenarios)
- [ ] Test coverage >85%
- [ ] All tests passing

### Day 3: User Guide + Screenshots
- [ ] Create `docs/user-guides/RULE_MANAGEMENT_VISUAL_BUILDER_USER_GUIDE.md`
- [ ] 2,000-3,000 words guide
- [ ] 10-15 annotated screenshots
- [ ] 5 example rules (common use cases)
- [ ] Video recording (optional, 5 minutes)

### Day 4-5: Demo Preparation + Deployment
- [ ] Finalize demo script (5 minutes)
- [ ] Prepare demo data (sample customers, services, rules)
- [ ] Record demo video (practice run)
- [ ] Create demo slides (5-10 slides)
- [ ] Deploy to staging
- [ ] Internal testing (team creates 5-10 rules)
- [ ] Deploy to production
- [ ] Monitor metrics

---

## 📊 Success Criteria (Check Before Sign-Off)

### Technical ✅
- [ ] 50+ fields across 5 providers
- [ ] 15+ operators mapped
- [ ] 20-30 action types defined
- [ ] Natural language 95%+ accurate
- [ ] 85%+ test coverage
- [ ] Zero TypeScript errors
- [ ] Build passes

### User Experience ✅
- [ ] Non-technical user creates rule in <5 minutes
- [ ] User understands natural language (tested with 3+ people)
- [ ] UI feels fast (<100ms interaction)
- [ ] Error messages clear

### Business ✅
- [ ] Demo-ready for investors
- [ ] "WOW factor" achieved (natural language impresses)
- [ ] User guide complete
- [ ] Can onboard pilot customer without training

---

## 🚀 Quick Deploy Commands

```bash
# Week 1: After Condition Builder
npm run build
npm run test -- src/components/rules/ConditionBuilder.test.tsx
git add .
git commit -m "feat: Visual Condition Builder complete"
git push origin feature/visual-builder

# Week 2: After Natural Language
npm run build
npm run test -- src/lib/rule-management/natural-language-generator.test.ts
git add .
git commit -m "feat: Natural Language Preview complete"
git push origin feature/natural-language

# Week 3: Production Deploy
npm run build
npm run test
git checkout main
git merge feature/visual-builder
git merge feature/natural-language
git push origin main
# Vercel auto-deploys
```

---

## 📞 Quick Reference

**Full Plan:** `PHASE_2_3_VISUAL_BUILDER_NATURAL_LANGUAGE_PLAN.md` (comprehensive)  
**Roadmap:** `BELLA_2026_2027_UX_FIRST_ROADMAP.md` (strategic context)  
**Design Mockup:** `RULE_BUILDER_VISUAL_DESIGN_MOCKUP.md` (visual specs)

**Status:** ✅ READY TO START  
**Next Action:** Kickoff meeting → Assign Day 1-2 tasks

