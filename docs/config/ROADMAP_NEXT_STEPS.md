# Configuration-Driven Payroll System - Roadmap & Next Steps

**Updated:** June 22, 2026  
**Current Status:** Week 2 Complete (95%), UI Pending  

---

## ✅ Completed (Week 1-2)

### Week 1: Foundation
- ✅ Database schema (`tenant_payroll_config`, `tenant_payroll_config_history`)
- ✅ TypeScript types (`KPIConfig`, `AttendanceConfig`, `RatingConfig`)
- ✅ `PayrollConfigService` (with 5-min cache)
- ✅ Default configs for 6 tenants × 5 providers = 30 records
- ✅ RLS policies (FIXED: use `public.users.tenant_id`)
- ✅ Audit trail triggers

### Week 2: Providers
- ✅ `KPIProvider` (3 strategies: threshold, linear, tier)
- ✅ `AttendanceProvider` (3 strategies: late, absent, combined)
- ✅ `RatingProvider` (3 strategies: threshold, linear, tier)
- ✅ Server Actions (`payroll-config-actions.ts`)
- ✅ Settings UI Component (`SalaryConfigTab.tsx` v2.0.0)
  - ✅ Backend state management ready
  - ⏳ UI dropdowns pending (manual 30min work)

---

## ✅ Recently Completed (June 22, 2026)

### Critical Fixes
- ✅ **FIX RLS PERMISSION ERROR** 
  - Ran `20260622_fix_payroll_config_rls.sql` in Supabase Dashboard
  - Settings UI save button works correctly
  - Admin can insert/update configs without permission errors

### UI Implementation
- ✅ **Add Strategy Selector Dropdown**
  - KPI section: threshold / linear / tier dropdown with icons
  - Conditional forms based on selected strategy
  - Rating section: same pattern with PremiumSelect
  - Tier editor: dynamic add/remove rows
  - All compiles with 0 TypeScript errors

### Bug Fixes
- ✅ **Fixed duplicate save button** (removed from header in salary tab)
- ✅ **Fixed re-load bug** (removed useEffect dependency causing reset)
- ✅ **Replaced native select with PremiumSelect** (consistent UI/UX)

## ⏳ In Progress (Current Sprint)

### Testing & QA
- [ ] **Manual E2E Testing** (see `SETTINGS_UI_E2E_TEST.md`)
  - Scenario 1: Threshold strategy
  - Scenario 2: Linear strategy
  - Scenario 3: Tier strategy with multi-level
  - Scenario 4: Rating section (same patterns)
  - Scenario 5: Edge cases
  - Scenario 6: Mobile responsive

---

## 📋 Next Steps (Priority Order)

### Priority 1: Production Readiness (This Week)
**Goal:** Deploy configuration system to production

**Tasks:**
1. ✅ Fix RLS permission error (run SQL migration)
2. [ ] Manual test Settings UI with real tenant
   - Enable/disable KPI
   - Change threshold values
   - Save and reload page
   - Check database for persisted config
3. [ ] Add strategy selector UI (30 min manual work)
4. [ ] E2E test with 3 scenarios:
   - Scenario A: Keep default (KPI off)
   - Scenario B: Enable KPI threshold (30 ca → 1M)
   - Scenario C: Change to tier (20-29: 500k, 30-39: 1M, 40+: 2M)
5. [ ] Merge to `main` branch
6. [ ] Deploy to production

**ETA:** 1-2 days  
**Blocker:** RLS permission error (needs SQL fix first)

---

### Priority 2: Provider Integration (Next Week)
**Goal:** Actual salary calculation uses new providers

**Tasks:**
1. [ ] Update `recalculateAndSaveSalaryRecord` engine
   - Call `KPIProvider.evaluate(context)`
   - Call `AttendanceProvider.evaluate(context)`
   - Call `RatingProvider.evaluate(context)`
   - Sum up all `SalaryComponent[]` results
2. [ ] Remove hardcoded KPI/attendance logic
3. [ ] Test salary calculation with 3 tenants (different configs)
4. [ ] Compare old vs new calculation results
5. [ ] Gradual rollout (1 tenant → 3 tenants → all tenants)

**ETA:** 3-4 days  
**Risk:** Medium (touching core salary engine)

---

### Priority 3: Commission Settings (Week 3)
**Goal:** Commission config UI (similar to KPI/Attendance/Rating)

**Tasks:**
1. [ ] Add Commission section to Settings UI
2. [ ] Support strategies:
   - Fixed: 120k per session
   - Tier: Different rates for session ranges
   - Percentage: % of service revenue
   - Service-based: Different rates per service type
3. [ ] Refactor `CommissionProvider` to read from config
4. [ ] Test with existing commission data

**ETA:** 2-3 days  
**Complexity:** Medium (commission has more edge cases)

---

### Priority 4: Advanced Features (Week 4+)
**Goal:** Power user features

**Tasks:**
1. [ ] **Config Templates**
   - "Aggressive KPI" preset (20 ca → 500k, 30 ca → 1.5M)
   - "Balanced" preset (default)
   - "Conservative" preset (40 ca → 1M)
   - One-click apply template
2. [ ] **Salary Preview Calculator**
   - Input: sessions, attendance, rating
   - Output: Estimated salary breakdown
   - Shows impact of config changes before save
3. [ ] **Tier Array Editor**
   - Add/remove tier rows dynamically
   - Validation (no gaps, no overlaps)
   - Drag & drop reordering
4. [ ] **Config History Viewer**
   - Show all changes to payroll config
   - Who changed what when
   - Rollback to previous version (one-click)
5. [ ] **Multi-Provider Comparison**
   - Side-by-side view of 2-3 configs
   - Compare Spa A vs Spa B settings
   - Export comparison report

**ETA:** 1-2 weeks  
**Priority:** Low (nice-to-have)

---

### Priority 5: Industry Expansion (Month 2)
**Goal:** Support 3 new industries beyond Beauty Spa

**Tasks:**
1. [ ] **Dental Clinic Module**
   - Treatment-based commission (filling, extraction, braces)
   - Patient retention bonus (same patient returns)
   - Equipment usage tracking
2. [ ] **Gym & Fitness Module**
   - PT session commission
   - Membership signup bonus
   - Retention rate KPI (churn < 5%)
3. [ ] **Retail Store Module**
   - Sales commission (% of revenue)
   - Upsell bonus (add-ons)
   - Inventory accuracy KPI

**ETA:** 1 month per industry  
**Approach:** Reuse existing providers, add industry adapters

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] **Config coverage:** 95%+ of payroll logic driven by config
- [ ] **Code reduction:** Remove 80%+ of hardcoded values
- [ ] **Cache hit rate:** >90% (5-min TTL effective)
- [ ] **Load time:** Settings UI loads in <500ms

### Business Metrics
- [ ] **Onboarding time:** New tenant setup < 1 hour (no dev needed)
- [ ] **Config changes:** Admin can change without deploying
- [ ] **Industry expansion:** Launch 3 new verticals in Q1 2027
- [ ] **Customer NPS:** Payroll feature >50 NPS score

---

## 🚧 Known Issues & Limitations

### Current Limitations
1. **No multi-strategy selector UI** (hardcoded to "threshold")
   - Workaround: Edit database directly
   - Fix: Add dropdown (30 min work)

2. **No tier array editor** (can't add/remove tiers in UI)
   - Workaround: Edit JSON manually
   - Fix: Build dynamic form component

3. **No real-time preview** (must save to see impact)
   - Workaround: Use salary calculator spreadsheet
   - Fix: Build preview calculator component

4. **No validation warnings** (e.g., KPI target too high)
   - Workaround: Manual review by admin
   - Fix: Add config validation rules

### Technical Debt
1. **Legacy config sync** (dual-write to `generalSettings.salary_config`)
   - Reason: Backward compatibility during migration
   - Cleanup: Remove after all tenants migrated

2. **Provider registration** (manual registration in index.ts)
   - Current: `ProviderRegistry.register(new KPIProvider())`
   - Future: Auto-discovery via file system

3. **Type safety** (strategy config uses `any` in places)
   - Current: `config as any` in load/save logic
   - Future: Use discriminated unions for strategy types

---

## 📊 Progress Overview

```
Week 1: Foundation          [████████████████████] 100%
Week 2: Providers           [█████████████████░░░]  95%
Week 3: UI Polish           [████░░░░░░░░░░░░░░░░]  20%
Week 4: Integration         [░░░░░░░░░░░░░░░░░░░░]   0%
Week 5: Commission          [░░░░░░░░░░░░░░░░░░░░]   0%
Week 6: Advanced Features   [░░░░░░░░░░░░░░░░░░░░]   0%
```

**Overall Progress:** 85% backend, 20% UI = ~60% total

---

## 🎓 Learning & Documentation

### Documentation Status
- ✅ Architecture overview (`WEEK_2_PROVIDER_REFACTOR.md`)
- ✅ Migration guide (`MIGRATION_GUIDE.md`)
- ✅ Settings explanation (`BELLA_SPA_DEFAULT_SETTINGS.md`)
- ✅ FAQ (`HOW_TO_ADD_NEW_BONUS_LEVEL.md`)
- ✅ RLS fix guide (`FIX_RLS_PERMISSION_ERROR.md`)
- ✅ Strategy selector status (`STRATEGY_SELECTOR_STATUS.md`)

### Missing Documentation
- [ ] API reference (server actions)
- [ ] Provider developer guide (how to create new provider)
- [ ] Industry adapter guide (how to add new industry)
- [ ] Testing guide (unit + integration tests)

---

## 🚀 Quick Start (For New Developers)

### To understand the system:
1. Read: `docs/config/WEEK_2_PROVIDER_REFACTOR.md`
2. Read: `docs/config/BELLA_SPA_DEFAULT_SETTINGS.md`
3. Check: `src/services/providers/kpi-provider.ts` (example provider)

### To add a new strategy:
1. Edit provider file (e.g., `kpi-provider.ts`)
2. Add new case in `calculate()` method
3. Update TypeScript types
4. No database migration needed!

### To test locally:
1. Run: `npm run dev`
2. Open: http://localhost:3000/dashboard/settings?tab=salary
3. Toggle on/off, change values, save
4. Check database: `SELECT * FROM tenant_payroll_config`

---

## 💡 Recommendations

### Immediate Actions (This Week)
1. ⚠️ **RUN RLS FIX FIRST** (blocks everything else)
2. Manual test Settings UI save button
3. Add strategy dropdown (30 min)
4. Deploy to staging
5. QA sign-off
6. Deploy to production

### Short Term (Next 2 Weeks)
1. Integrate providers into salary calculation engine
2. Remove hardcoded KPI/attendance logic
3. Build Commission settings UI
4. Test with 10 real salary records

### Long Term (Next 3 Months)
1. Launch 1 new industry (Dental or Gym)
2. Build config templates & preview
3. Add advanced features (history viewer, comparison)
4. Prepare for international expansion (multi-currency)

---

**Current Phase:** Production Readiness  
**Next Milestone:** Deploy configuration system to production  
**Estimated Completion:** End of Week 3 (June 29, 2026)
