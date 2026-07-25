# 📋 HTML Files Audit Report - Bella ERP Documentation

**Date**: 2026-06-18  
**Purpose**: Review, consolidate, and organize HTML documentation files

---

## 📊 Current HTML Files (25 files)

### ✅ KEEP - Important & Active Files

#### 1. **API Gateway & Valuation**
- `valuation_and_api_gateway.html` - Định giá chiến lược & API Gateway overview
- `valuation_report_external.html` - Báo cáo định giá cho external stakeholders
- **Action**: ✅ KEEP (business critical)

#### 2. **User Guides & Onboarding**
- `bella_spa_erp_user_guide_onboarding.html` - Hướng dẫn onboarding cho user
- `bella_spa_demo.html` - Demo guide
- `bella_spa_dual_mode_accounting_guide.html` - Kế toán hai chế độ
- **Action**: ✅ KEEP (end-user documentation)

#### 3. **Commercialization & Business Plans**
- `beauty_spa_commercialization_plan.html` - Kế hoạch thương mại hóa
- `beauty_spa_owner_sales_plan.html` - Sales plan cho owner
- **Action**: ✅ KEEP (business strategy)

---

### 🔄 ARCHIVE - Outdated/Redundant Reports

#### 4. **Executive Reviews (Multiple versions)**
- `BELLA_ERP_CODEBASE_EXECUTIVE_REVIEW_2026.html` (latest)
- `BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026.html` (duplicate?)
- `BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026_basic.html` (simplified version)
- `bella_erp_executive_audit_2026_06_05.html` (June 5 version)
- **Action**: 
  - ✅ KEEP latest: `BELLA_ERP_CODEBASE_EXECUTIVE_REVIEW_2026.html`
  - 📁 ARCHIVE others to `docs/archive/executive-reviews/`

#### 5. **Comprehensive Reports (Multiple similar)**
- `bella_beauty_erp_comprehensive_report.html`
- `bella_erp_comprehensive_codebase_analysis.html`
- `bella_erp_full_codebase_evaluation_report.html`
- `bella_erp_technical_codebase_review.html`
- **Action**:
  - ✅ KEEP most recent/complete one
  - 📁 ARCHIVE others to `docs/archive/codebase-reviews/`

#### 6. **Evaluation Reports (Multiple overlapping)**
- `bella_spa_evaluation_report.html`
- `bella_spa_beauty_module_evaluation_report.html`
- `bella_spa_modules_evaluation_report.html`
- `bella_erp_non_tech_evaluation_report.html`
- **Action**:
  - ✅ KEEP: `bella_spa_beauty_module_evaluation_report.html` (most specific)
  - 📁 ARCHIVE others to `docs/archive/evaluation-reports/`

#### 7. **Optimization & Quality Reports**
- `bella_erp_overall_optimization_report_2026_06_06.html` (June 6)
- `BELLA_ERP_SYSTEM_QUALITY_REPORT_2026.html`
- **Action**:
  - ✅ KEEP most recent
  - 📁 ARCHIVE older version

#### 8. **Accounting Reports**
- `bella_spa_accounting_report.html`
- **Action**: ✅ KEEP (accounting module documentation)

#### 9. **Refactoring Roadmaps**
- `REFACTORING_ROADMAP_2026.html` (full version)
- `REFACTORING_ROADMAP_2026_basic.html` (simplified)
- **Action**:
  - ✅ KEEP: `REFACTORING_ROADMAP_2026.html`
  - 📁 ARCHIVE: `REFACTORING_ROADMAP_2026_basic.html`

#### 10. **UI Mockups**
- `beauty_spa_erp_ui_mockup.html`
- **Action**: ✅ KEEP (design reference)

---

## 📁 Recommended Folder Structure

```
docs/
├── 📄 Active Documentation (KEEP HERE)
│   ├── valuation_and_api_gateway.html
│   ├── valuation_report_external.html
│   ├── bella_spa_erp_user_guide_onboarding.html
│   ├── bella_spa_demo.html
│   ├── bella_spa_dual_mode_accounting_guide.html
│   ├── beauty_spa_commercialization_plan.html
│   ├── beauty_spa_owner_sales_plan.html
│   ├── bella_spa_accounting_report.html
│   ├── beauty_spa_erp_ui_mockup.html
│   ├── BELLA_ERP_CODEBASE_EXECUTIVE_REVIEW_2026.html (latest)
│   ├── BELLA_ERP_SYSTEM_QUALITY_REPORT_2026.html
│   ├── bella_spa_beauty_module_evaluation_report.html
│   └── REFACTORING_ROADMAP_2026.html
│
└── 📁 archive/ (CREATE THIS FOLDER)
    ├── executive-reviews/
    │   ├── BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026.html
    │   ├── BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026_basic.html
    │   └── bella_erp_executive_audit_2026_06_05.html
    │
    ├── codebase-reviews/
    │   ├── bella_beauty_erp_comprehensive_report.html
    │   ├── bella_erp_comprehensive_codebase_analysis.html
    │   ├── bella_erp_full_codebase_evaluation_report.html
    │   └── bella_erp_technical_codebase_review.html
    │
    ├── evaluation-reports/
    │   ├── bella_spa_evaluation_report.html
    │   ├── bella_spa_modules_evaluation_report.html
    │   └── bella_erp_non_tech_evaluation_report.html
    │
    └── optimization-reports/
        ├── bella_erp_overall_optimization_report_2026_06_06.html
        └── REFACTORING_ROADMAP_2026_basic.html
```

---

## 🎯 Action Plan

### Step 1: Create Archive Folders
```bash
mkdir -p docs/archive/executive-reviews
mkdir -p docs/archive/codebase-reviews
mkdir -p docs/archive/evaluation-reports
mkdir -p docs/archive/optimization-reports
```

### Step 2: Move Files to Archive

**Executive Reviews** (3 files):
```bash
mv docs/BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026.html docs/archive/executive-reviews/
mv docs/BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026_basic.html docs/archive/executive-reviews/
mv docs/bella_erp_executive_audit_2026_06_05.html docs/archive/executive-reviews/
```

**Codebase Reviews** (4 files):
```bash
mv docs/bella_beauty_erp_comprehensive_report.html docs/archive/codebase-reviews/
mv docs/bella_erp_comprehensive_codebase_analysis.html docs/archive/codebase-reviews/
mv docs/bella_erp_full_codebase_evaluation_report.html docs/archive/codebase-reviews/
mv docs/bella_erp_technical_codebase_review.html docs/archive/codebase-reviews/
```

**Evaluation Reports** (3 files):
```bash
mv docs/bella_spa_evaluation_report.html docs/archive/evaluation-reports/
mv docs/bella_spa_modules_evaluation_report.html docs/archive/evaluation-reports/
mv docs/bella_erp_non_tech_evaluation_report.html docs/archive/evaluation-reports/
```

**Optimization Reports** (2 files):
```bash
mv docs/bella_erp_overall_optimization_report_2026_06_06.html docs/archive/optimization-reports/
mv docs/REFACTORING_ROADMAP_2026_basic.html docs/archive/optimization-reports/
```

### Step 3: Keep in Root (13 files)
- valuation_and_api_gateway.html ✅
- valuation_report_external.html ✅
- bella_spa_erp_user_guide_onboarding.html ✅
- bella_spa_demo.html ✅
- bella_spa_dual_mode_accounting_guide.html ✅
- beauty_spa_commercialization_plan.html ✅
- beauty_spa_owner_sales_plan.html ✅
- bella_spa_accounting_report.html ✅
- beauty_spa_erp_ui_mockup.html ✅
- BELLA_ERP_CODEBASE_EXECUTIVE_REVIEW_2026.html ✅ (latest)
- BELLA_ERP_SYSTEM_QUALITY_REPORT_2026.html ✅
- bella_spa_beauty_module_evaluation_report.html ✅
- REFACTORING_ROADMAP_2026.html ✅

---

## 📊 Summary

| Category | Total Files | Keep Active | Archive |
|----------|-------------|-------------|---------|
| Executive Reviews | 4 | 1 | 3 |
| Codebase Reviews | 4 | 0 | 4 |
| Evaluation Reports | 4 | 1 | 3 |
| Optimization Reports | 2 | 1 | 1 |
| Business & User Docs | 11 | 11 | 0 |
| **TOTAL** | **25** | **13** | **12** |

**Space saved**: ~12 HTML files moved to archive (cleaner root folder)

---

## ✅ Next Actions

1. ✅ Created new API Gateway Master Guide (Markdown)
2. ⏳ Execute file movement commands above
3. ⏳ Update index.md to reference new structure
4. ⏳ Create README in archive/ folder explaining archived content
5. ⏳ Commit changes with clear message

---

**Report created**: 2026-06-18  
**By**: Bella AI Team

