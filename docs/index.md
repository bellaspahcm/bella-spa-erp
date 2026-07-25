# Chỉ Mục Tri Thức Bella ERP

**Last Updated:** July 25, 2026

Đây là tài liệu đầu tiên cần mở khi một lập trình viên, quản lý kỹ thuật, hoặc AI agent mới tham gia dự án.

## 🚀 Bắt Đầu Từ Đây

1. **`AGENTS.md`** (Workspace root) - Các quy tắc bắt buộc về kỹ thuật, test, database, lương, tài chính và side effects
2. **`docs/FEATURES.md`** - Danh sách đầy đủ 250+ tính năng thực tế của hệ thống (MỚI)
3. **`docs/guides/AI_AGENT_ONBOARDING.md`** - Cách một AI agent hoặc người mới xây context và bắt đầu làm việc an toàn
4. **`docs/guides/KNOWLEDGE_STORAGE_PROCESS.md`** - Quy trình lưu trữ quyết định, spec, investigation, log và handoff
5. **`docs/guides/DEVELOPMENT_LOG.md`** - Lịch sử phát triển theo thời gian và bằng chứng kiểm tra

## 📋 Định Hướng Sản Phẩm Hiện Tại

Bella hiện là **ERP đa ngành cho dịch vụ**. Định hướng dài hạn là tiến hóa thành lõi ERP tái sử dụng được cho nhiều ngành dịch vụ.

### Các Module Ngành Đang Hoạt Động
- ✅ **Baby Care** (Module chính): Chăm sóc sau sinh, massage bé, KTV chuyên môn
- ✅ **Beauty Spa**: Spa, massage, phòng điều trị, liệu trình làm đẹp
- ✅ **Industrial Cleaning (CleanPro)**: Vệ sinh công nghiệp, team-based, site management
- 🚧 **Student Training**: Đào tạo sinh viên, quản lý khóa học (đang phát triển)

### Core Platform Features
- Multi-tenancy & white-label branding
- Authentication, RBAC, Row-Level Security
- Booking engine với AI suggestions
- Finance & Accounting (TT133 compliant)
- HR & Payroll với commission system
- Intelligence Layer (8 AI domains)
- Workflow & Decision automation
- Mobile app (React Native)

Xem chi tiết 250+ tính năng tại **`docs/FEATURES.md`**

**Lưu ý:** Không thực hiện thay đổi kiến trúc rộng nếu chưa ghi rõ intent và ranh giới migration trong `docs/implementation-artifacts/`.

## 📚 Cấu Trúc Tài Liệu (Reorganized July 2026)

Tài liệu đã được tổ chức lại thành các thư mục chuyên biệt để dễ tìm kiếm:

### 1️⃣ Features (`docs/features/`)
**Tài liệu tính năng, specs, roadmaps** - 30 files
- Booking Engine design & implementation plans
- Commission System specifications
- Decision Engine & Workflow Engine roadmaps
- Intelligence Layer domains & roadmap
- Product roadmaps và "What's Next"

### 2️⃣ Technical (`docs/technical/`)
**Kiến trúc, thiết kế kỹ thuật, migration guides** - 24 files
- `BELLA_EIP_ARCHITECTURE_WHITEPAPER.md` - Architecture overview
- `KIEN_TRUC_BELLA_TONG_QUAN.md` - Tổng quan kiến trúc (Vietnamese)
- `INTELLIGENCE_LAYER_ARCHITECTURE.md` - Intelligence Layer design
- `MODULE_THEME_COLOR_OVERRIDE_GUIDE.md` - Multi-module theming
- API deployment strategies, database schemas, refactoring roadmaps

### 3️⃣ Guides (`docs/guides/`)
**Hướng dẫn người dùng, developer guides, deployment guides** - 87 files

#### User Guides
- `BELLA_SPA_ERP_MASTER_GUIDE.md` - Master user guide
- `HUONG_DAN_SU_DUNG_*.md` - Vietnamese user guides
- `COMMISSION_SYSTEM_ADMIN_GUIDE.md` - Commission admin guide
- `PAYROLL_PROVIDER_USAGE_GUIDE.md` - Payroll user guide

#### Developer Guides
- `DEVELOPER_ONBOARDING.md` - Onboarding for developers
- `AI_AGENT_ONBOARDING.md` - Onboarding for AI agents
- `INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` - How to build new industry modules
- `KNOWLEDGE_STORAGE_PROCESS.md` - Documentation process

#### Deployment & Operations
- `ENVIRONMENT_VARIABLES_SETUP.md` - Environment configuration
- `DOCKER_DESKTOP_INSTALLATION_GUIDE.md` - Docker setup
- `STAGING_DEPLOYMENT_QUICKSTART.md` - Staging deployment
- Deployment guides cho Booking Engine, Commission, Decision Engine, Workflow Engine
- Testing guides, runbooks, monitoring guides

### 4️⃣ Reports (`docs/reports/`)
**Completion reports, status updates, bug fixes** - 181 files
- Completion summaries cho tất cả major features
- Bug fix reports and verification reports
- Test status reports and coverage analysis
- Deployment status and verification reports
- Phase completion reports (Phase 1-8 Intelligence Layer, etc.)

### 5️⃣ Reference (`docs/reference/`)
**HTML reports, screenshots, scripts, business documents** - 51 files organized

#### `docs/reference/html-reports/` (25 files)
- Executive reports: `BELLA_ERP_COMPREHENSIVE_ASSESSMENT_2026.html`, `BELLA_ERP_SYSTEM_QUALITY_REPORT_2026.html`
- Business reports: `bella_spa_accounting_report.html`, `bella_spa_dual_mode_accounting_guide.html`
- Demo files: `bella_spa_demo.html`, `industrial_cleaning_demo.html`, `beauty_spa_erp_ui_mockup.html`
- Architecture reports: `BELLA_EIP_ARCH_REPORT_2026.html`, `INTELLIGENCE_LAYER_REPORT.html`

#### `docs/reference/screenshots/` (17 files)
- Verification screenshots: `beauty_*.png`, `bella_*.png`
- UI mockups: `beauty_spa_erp_ui_mockup_desktop.png`, `beauty_spa_erp_ui_mockup_mobile.png`

#### `docs/reference/scripts/` (6 files)
- Report generators: `generate-review.js`, `generate_system_quality_report.js`
- Conversion scripts: `convert.js`, `create-styled-refactor.js`

#### `docs/reference/business-docs/` (3 files)
- Quotations: `BaoGia_ChiNhanh_BellaSpa_ERP.xlsx`, `BaoGia_GoiThue_BellaSpa_SaaS.xlsx`
- Master guide PDF: `BELLA_SPA_ERP_MASTER_GUIDE.pdf`

### 6️⃣ Existing Organized Folders
**Already well-organized, no changes needed**
- `docs/adr/` - Architecture Decision Records
- `docs/api/` - API documentation
- `docs/architecture/` - Architecture diagrams
- `docs/archive/` - Historical documents (immutable)
- `docs/business-rules/` - Business rule documentation
- `docs/database/` - Database schemas and migration docs
- `docs/design/` - Design files and previews
- `docs/development/` - Development process docs
- `docs/implementation-artifacts/` - Implementation details
- `docs/INCIDENTS/` - Incident reports
- `docs/infrastructure/` - Infrastructure and DevOps
- `docs/lessons-learned/` - Post-mortem and lessons
- `docs/migration/` - Migration guides
- `docs/mobile-app/` - Mobile app documentation
- `docs/phases/` - Project phase documentation
- `docs/plans/` - Project plans and roadmaps
- `docs/product/` - Product documentation
- `docs/providers/` - Provider-specific docs
- `docs/security/` - Security documentation
- `docs/troubleshooting/` - Troubleshooting guides

---

## 🗺️ Bản Đồ Tài Liệu (Quick Reference)

| Nhu cầu | Đọc tại |
| --- | --- |
| **📖 Tổng quan toàn bộ tính năng hệ thống** | `docs/FEATURES.md` ⭐ NEW |
| Người mới hoặc AI agent bắt đầu | `docs/guides/AI_AGENT_ONBOARDING.md` |
| Quy tắc lưu trữ context và handoff | `docs/guides/KNOWLEDGE_STORAGE_PROCESS.md` |
| Quy trình phát triển phân hệ ngành mới | `docs/guides/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` |
| Lịch sử phát triển theo ngày | `docs/guides/DEVELOPMENT_LOG.md` |
| Kiến trúc tổng quan (Vietnamese) | `docs/technical/KIEN_TRUC_BELLA_TONG_QUAN.md` |
| Architecture whitepaper (English) | `docs/technical/BELLA_EIP_ARCHITECTURE_WHITEPAPER.md` |
| Intelligence Layer architecture | `docs/technical/INTELLIGENCE_LAYER_ARCHITECTURE.md` |
| Roadmap tách core platform đa ngành | `docs/plans/core-platform-extraction-roadmap.md` |
| Kế hoạch Mobile App | `docs/mobile-app/phase-1-week-1-foundation-plan.md` |
| Một lát cắt triển khai cụ thể | `docs/implementation-artifacts/spec-*.md` |
| Điều tra trước khi sửa rủi ro cao | `docs/implementation-artifacts/investigations/*.md` |
| Báo cáo kế toán chi tiết TT133 | `docs/reference/html-reports/bella_spa_accounting_report.html` |
| Đánh giá kỹ thuật codebase (CTO) | `docs/reference/html-reports/bella_erp_technical_codebase_review.html` |
| Cẩm nang kế toán song song | `docs/reference/html-reports/bella_spa_dual_mode_accounting_guide.html` |
| Lưu trữ bất biến | `docs/archive/*.md` |

---

## 🎯 Navigating by Role

### 👨‍💼 Business Owner / Product Manager
1. `docs/FEATURES.md` - Understand what the system can do
2. `docs/features/BELLA_2026_2027_UX_FIRST_ROADMAP_REVISED.md` - Product roadmap
3. `docs/reference/html-reports/bella_spa_accounting_report.html` - Financial capabilities

### 👩‍💻 New Developer
1. `docs/guides/DEVELOPER_ONBOARDING.md` - Start here
2. `docs/FEATURES.md` - Understand the features
3. `docs/technical/KIEN_TRUC_BELLA_TONG_QUAN.md` - Architecture overview
4. `AGENTS.md` (workspace root) - Critical development rules

### 🤖 AI Agent
1. `docs/guides/AI_AGENT_ONBOARDING.md` - Agent-specific onboarding
2. `AGENTS.md` (workspace root) - Mandatory rules and constraints
3. `docs/FEATURES.md` - System capabilities inventory
4. `docs/guides/KNOWLEDGE_STORAGE_PROCESS.md` - How to document work

### 🏗️ System Architect / Tech Lead
1. `docs/technical/BELLA_EIP_ARCHITECTURE_WHITEPAPER.md` - Complete architecture
2. `docs/technical/INTELLIGENCE_LAYER_ARCHITECTURE.md` - Analytics architecture
3. `docs/plans/core-platform-extraction-roadmap.md` - Platform evolution
4. `docs/adr/` - Architecture decisions

### 📊 Finance / Accounting
1. `docs/reference/html-reports/bella_spa_dual_mode_accounting_guide.html` - Dual-mode accounting guide
2. `docs/reference/html-reports/bella_spa_accounting_report.html` - TT133 compliance details
3. `docs/features/FRANCHISE_AND_OFFLINE_SPEC.md` - Multi-branch accounting

### 🧪 QA / Tester
1. `docs/guides/TESTING_HEALTH_DASHBOARD.md` - Testing overview
2. `docs/guides/SALARY_SYSTEM_E2E_TEST_GUIDE.md` - E2E testing guide
3. `docs/reports/TEST_*.md` - Test reports and status

---

## 📝 Documentation Standards

### Quy Tắc Vàng
Nếu một AI agent tương lai không thể hiểu vì sao một thay đổi tồn tại từ tài liệu và git history, quy trình lưu trữ đã thất bại. Hãy thêm artifact ngắn gọn trước hoặc trong lúc thực hiện thay đổi.

### Where to Add New Documentation
- **Feature specs**: `docs/features/`
- **Technical designs**: `docs/technical/`
- **Completion reports**: `docs/reports/`
- **User/developer guides**: `docs/guides/`
- **Architecture decisions**: `docs/adr/`
- **Implementation details**: `docs/implementation-artifacts/`

### File Naming Conventions
- Features: `FEATURE_NAME_*.md` or descriptive name
- Technical: `ARCHITECTURE_*.md`, `MIGRATION_*.md`
- Reports: `*_COMPLETION_*.md`, `*_STATUS_*.md`, `BUG_FIX_*.md`
- Guides: `*_GUIDE.md`, `*_ONBOARDING.md`, `HUONG_DAN_*.md`

---

## 🔍 Search Tips

- **Find a feature**: Check `docs/FEATURES.md` table of contents
- **Find implementation status**: Search `docs/reports/` for COMPLETION or STATUS
- **Find how to deploy**: Search `docs/guides/` for DEPLOYMENT or STAGING
- **Find architecture details**: Check `docs/technical/` or `docs/architecture/`
- **Find business rules**: Check `AGENTS.md` or `docs/business-rules/`

---

## 📞 Support

- **Technical issues**: Review `docs/troubleshooting/` first
- **Incidents**: Check `docs/INCIDENTS/` for similar past issues
- **Questions**: Ask in team chat or create a GitHub issue

---

**Last reorganized:** July 25, 2026  
**Total documentation files:** 370+ files across all folders  
**Files in /docs root:** 6 essential files only (index, README, FEATURES, etc.)  
**Lines of documentation:** 50,000+ lines