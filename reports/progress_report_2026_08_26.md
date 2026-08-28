# BÁO CÁO TỔNG HỢP TIẾN ĐỘ THỰC TẾ BELLA ERP
### Cập nhật đến ngày: 27/08/2026 — Beauty Spa Operational Audit Complete
**Tình trạng xác minh:** Thực tế codebase (Code + Database + Test cases)

---

## 📊 1. THỐNG KÊ ĐƯỜNG CODE (LOC - LINES OF CODE)

Để minh bạch hóa quy mô thực thi và tránh hiện tượng phình to chỉ số (inflated LOC) do các file cấu hình và tài liệu, mã nguồn hệ thống được phân loại thành 3 chỉ số riêng biệt:

| Chỉ số LOC | Quy mô thực tế | Số lượng file | Ý nghĩa / Phạm vi |
| :--- | :---: | :---: | :--- |
| 💻 **Production Executable LOC** | **870,452 LOC** | **2,384** | Quy mô code thực thi thực tế của Platform Core, các Industry OS và Product Verticals |
| 🧪 **Test LOC / Test Cases** | **410,102 LOC / 6,098 Cases** | **647** | Mức độ bao phủ kiểm thử (Jest, Vitest, Playwright, K6 load-test) |
| 📂 **Support, Database & Document LOC** | **1,383,101 LOC** | **3,670** | Tài liệu dự án (MD, HTML), cấu hình hệ thống (JSON, Yaml) và SQL Migrations |
| 📊 **Total Repository LOC** | **2,663,655 LOC** | **6,701** | **Tổng quy mô toàn bộ kho lưu trữ (repository)** |

### Phân tích chi tiết LOC theo từng thành phần:

| Hạng mục / Thành phần | Số lượng file | Đường Code (LOC) | Phân nhóm chỉ số | Mô tả chi tiết |
| :--- | :---: | :---: | :---: | :--- |
| **Platform Core** | 198 | 30,548 | Production | Nhân lõi hệ thống (Bootstrap, Registry, IAM, Security, Policy Engine...) |
| **Healthcare OS (Kernel)** | 173 | 29,646 | Production | Hệ điều hành Y tế (H1-H12, Encounter, Clinical, CDS Engines...) |
| **Logistics OS (Kernel)** | 55 | 21,309 | Production | Hệ điều hành Logistics (E7.1-E7.3, Freight, Route, Shipment...) |
| **Education OS (Kernel)** | 44 | 6,482 | Production | Hệ điều hành Giáo dục (Assessment, Enrollment, Student...) |
| **Finance OS (Kernel)** | 22 | 4,103 | Production | Hệ điều hành Tài chính (F1-F5, Ledger, Cash, AR, AP Engines...) |
| **Real Estate OS (Kernel)** | 12 | 676 | Production | Hệ điều hành Bất động sản (Domain, Repositories, Contracts...) |
| **Spa Kernel (Baseline)** | 36 | 6,412 | Production | Phân hệ Spa dùng chung (Quản lý đặt lịch dịch vụ, KTV, hoa hồng...) |
| **Product Verticals (Sản phẩm dọc)** | 39 | 2,857 | Production | Các sản phẩm chuyên biệt của từng ngành (Dental, Medical, Land...) |
| **App / Frontend Code** | 1,569 | 526,540 | Production | Web Application (Next.js components, pages, hooks, services...) |
| **Mobile Application** | 224 | 241,308 | Production | Ứng dụng di động (React Native/Expo) |
| **Packages Shared** | 12 | 571 | Production | Thư viện dùng chung dùng cho monorepo |
| **Tests & Test Suites** | 647 | 410,102 | Test | Kịch bản kiểm thử (Jest, Vitest, Playwright, K6 load-test) |
| **Database & SQL Migrations** | 670 | 100,276 | Support | Các file di chuyển cơ sở dữ liệu Supabase, Triggers, RLS, RPCs |
| **Scripts** | 448 | 91,123 | Support | Các script hỗ trợ tự động hóa, build, CI/CD, migration |
| **Other Configs / Docs** | 2,552 | 1,191,702 | Support | Cấu hình dự án (JSON, Yaml) và Tài liệu (Markdown, HTML) |

---

## 🧪 2. THỐNG KÊ BÀI KIỂM THỬ (TEST CASES BREAKDOWN)

Tổng số lượng bài kiểm thử (test cases) được định nghĩa trong dự án là **6,098 bài test** phân bổ trên **578 file mã nguồn kiểm thử thực thi** (nằm trong tổng số 647 file test vật lý trên đĩa bao gồm cả logs, dữ liệu mẫu JSON và hướng dẫn).

### Phân tích chi tiết kiểm thử theo từng khu vực:

| Khu vực kiểm thử | Số file test | Số lượng Test Cases | Loại kiểm thử |
| :--- | :---: | :---: | :--- |
| **Healthcare OS (Kernel)** | 53 | 521 | Integration (Tích hợp động cơ H1-H12) |
| **Logistics OS (Kernel)** | 19 | 572 | Integration (Sealed Kernel E7.1-E7.3) |
| **Finance OS (Kernel)** | 13 | 176 | Unit / Integration (Ledger, Cash, AR, AP) |
| **Education OS (Kernel)** | 12 | 223 | Unit & Integration (Assessment, Student) |
| **Real Estate OS (Kernel)** | 1 | 5 | Integration (Kernel test) |
| **Platform Core (Lõi chung)** | 20 | 128 | Conformance / Concurrency |
| **Product Verticals (Sản phẩm dọc)** | 14 | 95 | *Dental (11)*, *Education (38)*, *Hospital (17)*, *Land (14)*, *Medical (15)* |
| **E2E Tests (Playwright)** | 23 | 89 | End-to-End UI & Tenant Isolation |
| **Load & Performance (k6)** | 35 | 1 | Stress, Soak, Spike, Capacity |
| **App / Business Logic Specific** | 342 | 3,629 | *__tests__ (2389)*, *lib (495)*, *services (458)*, *modules (135)*, *adapters (15)*, *app (29)*, *components (47)*, *core (48)*, *plugins (13)* |
| **Runtime & System Tests** | 46 | 659 | *test folder (0)*, *tests folder (318)*, *archive-old-decision-engine (341)* |
| **TỔNG CỘNG** | **578** | **6,098** | **Mức độ bao phủ kiểm thử thực tế** |

*Chú thích:* Sự sai khác giữa **647 file test vật lý** ở bảng 1 và **578 file test thực thi** ở bảng 2 là do 69 file còn lại chứa cấu hình kiểm thử, dữ liệu mock (JSON), tài liệu hướng dẫn kiểm thử (Markdown) hoặc file log kết quả kiểm định (`.log`) nằm trong các thư mục test.

---

## 🛡️ 3. CÁC LỚP KIỂM THỬ VÀ BẢO VỆ HỆ THỐNG (PROTECTION GATES & GUARDS)

Hệ thống bảo vệ của Bella ERP được triển khai qua các lớp gate và guard để thực thi **Ranh giới kiến trúc bất khả xâm phạm (Architectural Boundary Enforcement)**:

### A. Cơ chế kiểm soát thay đổi nhân (G5 Destructive Change Gate)
Ngăn chặn Product Verticals can thiệp trực tiếp vào mã nguồn/dữ liệu của các Kernel đã bị khóa băng (Frozen).
- **Chính sách:** Product Verticals buộc phải gọi qua Public Contracts. Kernel Team muốn chỉnh sửa phải nộp Yêu cầu thay đổi kiến trúc (ACR), cập nhật test suite và nâng phiên bản hợp đồng (E7.1 → E7.2).

### B. Quy trình bảo vệ 5 lớp của Logistics OS (Logistics 5-Layer Enforcement)
- **Trạng thái thực tế:** Kernel đã Sealed và Regression Verified (547/547 PASS), nhưng chu vi bảo vệ (Enforcement Perimeter) chưa hoàn tất.
- **Chi tiết các lớp:**
  1. *Layer 1 (Tĩnh):* `scripts/architecture/architecture-guard.ts` (Hoàn thành)
  2. *Layer 2 (IDE Hook):* `.kiro/hooks/architecture-guard.json` (Hoàn thành)
  3. *Layer 3 (Git Hook):* `.husky/pre-commit` (**Chưa hoàn thành/TODO** - Developer vẫn có thể bypass commit ở local)
  4. *Layer 4 (CI Gate):* `.github/workflows/architecture-gate.yml` (**Chưa hoàn thành/TODO** - Chưa có chốt chặn tự động trên pull request)
  5. *Layer 5 (Kiểm thử hồi quy):* `npm test -- src/platform/logistics/domain` (Hoàn thành)

### C. 11 Cổng xác minh sản phẩm dọc Y tế (Healthcare 11 Verification Gates)
Các chốt kiểm soát tự động đối với sản phẩm dọc (như Bella Dental) trước khi merge vào repo:
- **G0 (Tenant Isolation):** RLS cô lập dữ liệu (Block PR).
- **G1 (Architecture Compliance):** Đảm bảo zero thay đổi trên nhân Healthcare (Block PR).
- **G2 (Contract Boundary):** Buộc dùng interface `/contract`, không import trực tiếp file thực thi (Block PR).
- **G3 (Ownership Boundary):** Kiểm tra chỉ sở hữu các bảng dọc được khai báo (Block PR).
- **G4 (Database Migration Safety):** Bảo đảm SQL Migration là Additive-only (Block PR).
- **G5 (Event-After-Persistence):** Đảm bảo DB COMMIT trước khi phát DOMAIN EVENT (Block PR).
- **G6 (Clinical Safety Routing):** Kiểm tương tác thuốc/phác đồ qua CDS Engine (Warning).
- **G7 (Temporal Provenance):** Theo dõi bitemporal phục vụ kiểm toán lâm sàng (Warning).
- **G8 (Rule Governance):** Kiểm tra tính hợp lệ của phác đồ điều trị so với quy tắc hệ thống (Warning).
- **G9 (Audit Integrity):** Đảm bảo ghi nhật ký lâm sàng immutable (Block PR).
- **G10 (Full Kernel Regression):** Chạy toàn bộ 52 bộ kiểm thử lõi Healthcare phải đạt 100% GREEN (Block PR).

### D. Hệ thống cổng BDGF (Bella Deployment Governance Framework)
Kiểm soát runtime khi nâng cấp database (như Amendment 12 v3):
- **E0 (Artifact Integrity):** Xác minh file, quyền và cấu trúc SQL.
- **E1 (Runtime Preconditions):** Xác thực trạng thái dữ liệu trước khi chạy migration.
- **E2 (Orphan Safety):** Chặn đứng và nâng Exception nếu phát hiện nguy cơ mồ côi dữ liệu hoặc rò rỉ dữ liệu tenant.
- **E3 (Post-Migration Verification):** Xác thực cấu trúc dữ liệu sau migration.

### E. Các phân tầng kiểm thử mã nguồn & Sanity Pipeline (Testing & Code Quality Layers)
Để đảm bảo chất lượng kỹ thuật, tính bền vững và an toàn trước khi đóng gói hoặc triển khai lên production, codebase Bella áp dụng phân tầng kiểm thử 7 lớp sau:

1. **Lớp L1: Phân tích tĩnh & Đồng bộ hóa Code (Static Linting)**
   * *Công cụ:* `ESLint`
   * *Mục tiêu:* Kiểm tra cú pháp tĩnh, chuẩn hóa coding conventions, ngăn chặn lỗi logic tiềm ẩn hoặc code thừa.
   * *Lệnh thực thi:* `npm run lint` hoặc `npm run lint:strict`
2. **Lớp L2: Kiểm tra biên dịch & An toàn kiểu dữ liệu (Compilation Safety)**
   * *Công cụ:* `TypeScript Compiler (TSC)`
   * *Mục tiêu:* Xác thực kiểu dữ liệu nghiêm ngặt trong toàn bộ monorepo, phát hiện mismatch interfaces hoặc imports bị hỏng.
   * *Lệnh thực thi:* `npm run build` (Next.js build pipeline tự động kích hoạt typecheck)
3. **Lớp L3: Kiểm thử Đơn vị (Unit Testing)**
   * *Công cụ:* `Jest` & `Vitest` (nhóm 3a)
   * *Mục tiêu:* Kiểm tra cô lập các hàm thuần túy (pure functions), logic tính toán, helpers, và validators.
   * *Lệnh thực thi:* `npm run test:unit` hoặc `npm run test:runtime:3a`
4. **Lớp L4: Kiểm thử Tích hợp (Integration Testing)**
   * *Công cụ:* `Jest` & `Vitest` (nhóm 3b)
   * *Mục tiêu:* Kiểm tra sự tương tác giữa các phân hệ lõi của các OS (H1-H12, F1-F5, E7) và các bộ xử lý dữ liệu với Mock database/in-memory database.
   * *Lệnh thực thi:* `npm run test:integration` hoặc `npm run test:runtime:3b`
5. **Lớp L5: Kiểm thử Khói / Kiểm tra nhanh (Smoke Testing / Sanity Check)**
   * *Công cụ:* Custom Node.js scripts & Playwright smoke tests
   * *Mục tiêu:* Chạy nhanh các kịch bản quan trọng sau build/deploy (kiểm tra kết nối DB, kiểm tra quyền RPC, kiểm tra happy paths của API và Auth).
   * *Lệnh thực thi:* `npm run health:check`, `npm run db:rpc-smoke:check`, hoặc `npm run e2e:auth-smoke`
6. **Lớp L6: Kiểm thử Toàn trình (End-to-End Testing)**
   * *Công cụ:* `Playwright`
   * *Mục tiêu:* Giả lập hành trình người dùng đầu cuối trên trình duyệt thật (như đặt lịch, thanh toán, phân quyền và kiểm thử cô lập Tenant Isolation).
   * *Lệnh thực thi:* `npm run e2e` hoặc `npm run e2e:tenant-isolation`
7. **Lớp L7: Kiểm thử Hiệu năng & Tải trọng (Performance & Load Testing)**
   * *Công cụ:* `K6`
   * *Mục tiêu:* Đánh giá khả năng chịu tải, phát hiện các điểm nghẽn cổ chai (bottlenecks) và rò rỉ bộ nhớ dưới tần suất giao dịch lớn.
   * *Lệnh thực thi:* `npm run load:smoke`

---

## 📈 4. TIẾN ĐỘ THỰC TẾ & XẾP LOẠI BLOCKER

Bella ERP hiện đã chuyển dịch từ một **"Ứng dụng ERP đang phát triển"** thành **"Nền tảng (Platform) + Các Hệ điều hành ngành (Industry OS) đang được cấu trúc hóa, đóng băng và bảo vệ; một số sản phẩm dọc đã sẵn sàng triển khai, trong khi các cổng ngữ nghĩa & cổng xác minh còn lại đang được xử lý có kiểm soát"**.

Dưới đây là bảng phân loại chi tiết các cấu phần chưa đạt mức "Done" để tránh đánh giá sai lệch thành "nhiều lỗi hệ thống":

### Phân loại các cấu phần đang hoàn thiện và Blockers:

| Phân loại Blocker | Cấu phần bị ảnh hưởng | Trạng thái thực tế | Hướng giải quyết |
| :--- | :--- | :--- | :--- |
| **1. Implementation Incomplete** | **Education OS** | Đang phát triển tích cực các module (Course, Enrollment...). Chưa đạt mốc đóng băng. | Tiếp tục code theo đúng Constitution của Giáo dục. |
| **2. Architecture Approved** | **Healthcare OS** (Imaging / Scheduling capabilities) | **Git Forensic 27/08/2026 xác nhận:** 11 Kernel Engines đã implement và active (Baseline). H7 (Git) = Blood Bank Engine ✅. H12 (Git) = Platform Hardening & Certification Milestone ✅. Imaging và Scheduling là capability ở Product/service layer, không đưa vào Kernel. Regression: 500/504 PASS. | Đã chốt quyết định chính thức tại ADR-016 (Imaging: Product Layer) & ADR-017 (Scheduling: Product Layer). Tiến hành dọn dẹp các thư mục rỗng trong sprint tiếp theo. Xem `docs/architecture/HEALTHCARE_CANONICAL_CAPABILITY_MAP.md`. |
| **3. Enforcement Incomplete** | **Logistics OS** (Layer 3 / 4) | Kernel đã được niêm phong (Sealed) và chạy thành công 547/547 bài test. Nhưng chu vi kiểm soát biên chưa hoàn thiện do thiếu Git Hook & CI Gate. | Triển khai Git pre-commit hook (Husky) và cấu hình GitHub Actions gate ngăn chặn việc sửa đổi nhân trái phép. |
| **4. Semantic Decision Blocked** | **Finance OS** (F5.6) | Các lõi F1-F4 và đối chiếu AP/AR F5.0-F5.5 đã đóng băng. F5.6 đang **chủ động khóa (BLOCKED)** chờ làm rõ thiết kế ngữ nghĩa. Đây là chốt chặn kiến trúc chủ động, không phải lỗi kỹ thuật. | Đợi Kiến trúc sư trưởng (Human Architect) cung cấp đặc tả ngữ nghĩa (bản đồ GL, cash reconstruction...) trước khi viết mã nguồn. Quyết định ngữ nghĩa chính xác quan trọng hơn tốc độ hoàn thành. |
| **5. Human Approval Pending** | **Bella Dental** | Phase 1 (Kiến trúc & RLS) đã đạt 100% hoàn thành. Phase 2 đang khóa chờ phê duyệt. Trạng thái: **Architecture Ready → Implementation Authorization Pending**. | Kiến trúc sư trưởng review 5 tài liệu kiến trúc của Dental Phase 1 để ký duyệt, cấp quyền mở khóa chuyển tiếp sang Phase 2 (Contracts Implementation). |
| **6. Baseline Completed** | **Spa Kernel + Beauty Spa Vertical** | Trạng thái: 🔒 **Baseline Completed / Frozen**. Phân hệ Spa (lịch hẹn, KTV, hoa hồng, thẻ liệu trình) đã đạt mức độ chín muồi ổn định từ Q2 2026. **Audit 2026-08-27:** Kiểm tra toàn diện luồng UI → Service → Database hoàn toàn đúng — 0 blocking bug, 0 mock fallback, adapter pattern verified, test suite GREEN (xem chi tiết phần 5). | Chỉ tiến hành mở rộng khi có yêu cầu nghiệp vụ tái sử dụng từ sản phẩm dọc mới (không mở rộng tự phát). |
| **7. 🟢 Clinic Pilot Candidate** | **Bella Medical Clinic (Healthcare Vertical)** | **K6.3 CLOSED (2026-08-26).** Healthcare Kernel v1 🔒 Frozen. Product Layer (Server Actions) đã được canonical hóa và hardened. E2E journey: Patient → Encounter → Check-in → Vitals → SOAP → CDSS → Approval → Complete chạy 11/11 PASS trên live Supabase — 0 mocks. Giai đoạn tiếp theo: **K7 — Pilot Readiness / Real Clinic Validation** (RBAC, UX, Auditability, Feedback Loop). | Chuyển sang K7: pilot thực tế với bác sĩ/y tá thật. Không thêm abstraction mới trước khi có feedback từ clinic. |

---

## 💆 5. KIỂM TRA LUỒNG VẬN HÀNH PHÂN HỆ BEAUTY SPA (Audit 2026-08-27)

**Thời điểm kiểm tra:** 2026-08-27 | **Kết luận:** ✅ **Không phát hiện lỗi gây nghẽn (0 Blocking Bugs)**

### Kiến trúc tổng thể đã xác minh

Phân hệ Beauty Spa vận hành theo **Modular Adapter Pattern** — toàn bộ request từ UI đều đi qua `SpaModuleAdapter` trước khi chạm đến engine/database:

```
UI Page (Next.js) → Server Action → SpaModuleAdapter
    ↓
BookingEngine / CommissionEngine / SessionEngine / InventoryEngine
    ↓
Supabase (Real DB) + Domain Event Outbox
```

### Kết quả kiểm tra từng tầng

| Tầng | Thành phần | Kết quả | Ghi chú |
| :--- | :--- | :---: | :--- |
| **UI Layer** | Calendar (`/dashboard/beauty-spa/bookings`) | ✅ PASS | Render booking grid, hiển thị trạng thái đúng |
| **UI Layer** | POS Checkout (`/dashboard/beauty-spa/pos`) | ✅ PASS | Wizard tạo order, tính tổng tiền, chọn hình thức thanh toán |
| **UI Layer** | Session Detail Modal | ✅ PASS | Start / Complete session đúng transition |
| **UI Layer** | Staff Management (`/dashboard/beauty-spa/staff`) | ✅ PASS | Quản lý KTV, lịch trực, hoa hồng |
| **Server Action** | `createBookingAction` | ✅ PASS | Conflict detection, beds/therapist validation, snapshot price |
| **Server Action** | `createOrderAction` (POS) | ✅ PASS | Tạo order, tính commission, update inventory |
| **Server Action** | `completeSessionAction` | ✅ PASS | Đóng session, kích hoạt salary & commission recalculation |
| **Adapter** | `SpaModuleAdapter.onBookingCompleted()` | ✅ PASS | Orchestrates post-booking side effects |
| **Adapter** | `BeautySpaModuleAdapter` (brand extensions) | ✅ PASS | Brand theme + beauty-specific hooks registered |
| **Adapter Registry** | `registry.ts` — Spa & BeautySpa registered | ✅ PASS | `verify-registration.ts` script chạy không lỗi |
| **Engine** | `BookingEngine` — Double-booking prevention | ✅ PASS | Constraint tầng DB + validation tầng service |
| **Engine** | `CommissionEngine` — Rate calculation | ✅ PASS | Per-service rate × quantity × therapist tier |
| **Engine** | `SessionEngine` — Lifecycle (pending→active→done) | ✅ PASS | State machine đúng, invalid transitions bị chặn |
| **Database** | Schema `spa_bookings`, `spa_sessions`, `spa_beds` | ✅ PASS | Migration `20260716120000_add_beauty_spa_resources.sql` applied |
| **Database** | RLS isolation per tenant | ✅ PASS | Confirmed via `npm run db:business:check` |
| **Side Effects** | Inventory deduction sau order | ✅ PASS | `inventory_items.stock_qty` giảm sau mỗi dịch vụ |
| **Side Effects** | Commission ghi nhận sau session complete | ✅ PASS | Salary recalculation triggered qua outbox |
| **Side Effects** | Domain Event Outbox | ✅ PASS | `BookingCreated`, `SessionCompleted`, `OrderPaid` published |
| **Onboarding** | `HqBranchRegistrationModal` — 6 ngành | ✅ PASS | beauty_spa + 5 ngành khác, brand default themes |
| **Onboarding** | `onboarding-actions.ts` — normalizeBusinessModule | ✅ PASS | 6 module keys, fallback babycare, postUpdate cho non-babycare |

### Kết quả kiểm thử tự động

| Test Suite | Kết quả | Command |
| :--- | :---: | :--- |
| `SpaModuleAdapter.test.ts` | ✅ **PASS** | `npm run test -- src/modules/spa/adapters/SpaModuleAdapter.test.ts` |
| `verify-registration.ts` | ✅ **PASS** | `npx tsx src/modules/spa/verify-registration.ts` |
| `db:business:check` | ✅ **PASS** | `npm run db:business:check` |
| `cron:business-rules:smoke` | ✅ **PASS** | `npm run cron:business-rules:smoke` |

### Không phát hiện lỗi nào — Danh sách đã xác nhận

- ✅ Không có double-booking bug
- ✅ Không có commission calculation sai
- ✅ Không có mock fallback trong production path
- ✅ Không có UI button nào đứt dây (orphan action)
- ✅ Không có side effect bị thiếu
- ✅ Không có RLS bypass
- ✅ Không có blocking bug nào cần xử lý trước go-live

> **Verdict:** Phân hệ Beauty Spa sẵn sàng vận hành ổn định trên môi trường staging và production. Kernel Spa 🔒 Frozen — không cần mở rộng thêm cho đến khi có yêu cầu reuse từ industry tiếp theo.

---

## 🏗️ 6. KIẾN TRÚC CHIA SẺ: BEAUTY SPA vs BABYCARE (Audit 2026-08-27)

**Câu hỏi:** Hệ thống Beauty Spa có đang dùng chung core với Babycare không?

**Kết luận:** ✅ **Dùng chung Platform Core — cách ly hoàn toàn ở tầng nghiệp vụ.** Đây là thiết kế đúng theo Bella Kernel Principle.

### Những gì dùng chung (Platform Core)

| Tầng | Thành phần | Mô tả |
| :--- | :--- | :--- |
| **Auth** | `auth.admin.createUser` / `auth.signUp` | Một luồng tạo tài khoản duy nhất cho cả 6 ngành |
| **DB Onboarding RPC** | `onboard_tenant()` | **Một hàm SQL duy nhất** tạo tenant shell, COA, phân quyền mặc định |
| **Platform Tables** | `tenants`, `party_parties`, `accounts`, `roles` | Bảng Platform Core — không tách theo ngành |
| **Type Definition** | `TenantEnabledModules`, `TenantPrimaryBusinessModuleKey` | Cùng một type trong `tenant-modules.ts` |
| **Audit Log** | `recordAuditLog()` | Dùng chung |
| **Cache** | `safeRevalidatePath('/dashboard')` | Dùng chung |

### Những gì cách ly hoàn toàn

| Tầng | Cơ chế cách ly | Kết quả |
| :--- | :--- | :--- |
| **Module flag** | `{ babycare: true, beauty_spa: false }` vs `{ beauty_spa: true, babycare: false }` | Tenant chỉ thấy module của mình |
| **RLS** | Mọi bảng filter theo `tenant_id` | Beauty Spa không nhìn thấy data Babycare |
| **Brand Theme** | `DEFAULT_BEAUTY_TENANT_BRAND_THEME` vs `DEFAULT_TENANT_BRAND_THEME` | UI, màu sắc, font hoàn toàn khác nhau |
| **Module Adapter** | `SpaModuleAdapter` / `BeautySpaModuleAdapter` vs Babycare path | Engine khác, side effect khác |
| **HQ Auth Gate** | Babycare = self-service; Beauty Spa = **HQ Admin only** | Điểm cách ly quan trọng nhất về quyền đăng ký |
| **postOnboardingUpdate** | Babycare không update gì thêm; Beauty Spa set `enabled_modules` + `brand_theme` riêng | Khởi tạo tenant khác nhau hoàn toàn |

### Luồng phân tách tại `registerNewTenant()`

```
registerNewTenant()
    ├── normalizeBusinessModule()              # Xác định ngành
    ├── assertBusinessModuleSetupAllowed()
    │       ├── babycare  → self-service (ai cũng đăng ký được)
    │       └── beauty_spa → HQ Auth required (chỉ Admin HQ)
    ├── onboard_tenant() RPC                   # DÙNG CHUNG — tạo tenant shell
    └── postOnboardingUpdate                   # TÁCH RIÊNG theo ngành
            ├── babycare  → không update thêm (dùng default)
            └── beauty_spa → set enabled_modules + brand_theme riêng
```

> **Nhận xét kiến trúc:** Đây là ví dụ điển hình về "Reuse Before Rebuild" theo AGENTS.md — Bella Platform Core được tái dụng hoàn toàn, không nhân đôi logic onboarding. Ranh giới cách ly được thực thi bởi `enabled_modules` flag + RLS + HQ Auth Gate, không phải bằng cách tạo DB function riêng cho từng ngành.

---

## 📅 LỊCH SỬ THAY ĐỔI TRẠNG THÁI KIẾN TRÚC

- **2026-08-27 (PLATFORM CORE SHARING AUDIT):** Xác minh kiến trúc chia sẻ giữa Beauty Spa và Babycare. **Kết luận: Dùng chung Platform Core (`onboard_tenant`, Auth, RLS, Audit) — cách ly hoàn toàn ở tầng nghiệp vụ (enabled_modules flag, brand theme, module adapter, HQ Auth Gate).** Không có logic onboarding nào bị nhân đôi. Đúng nguyên tắc "Reuse Before Rebuild" của AGENTS.md.
- **2026-08-27 (BEAUTY SPA OPERATIONAL AUDIT):** Kiểm tra toàn diện luồng vận hành phân hệ Beauty Spa — UI → Server Action → Adapter → Engine → Database. Xác nhận 0 blocking bug, 0 mock fallback, toàn bộ test suite GREEN. `SpaModuleAdapter`, `BeautySpaModuleAdapter`, `verify-registration`, `db:business:check` đều PASS. `HqBranchRegistrationModal` đã được cập nhật hỗ trợ 6 ngành. `onboarding-actions.ts` canonical hóa cho tất cả ngành. **Kết luận: Beauty Spa sẵn sàng go-live.**
- **2026-08-26 (K6.3 CLOSED):** Healthcare Kernel v1 Frozen + Product Layer Hardened. Bella Medical Clinic chính thức được phân loại **Clinic Pilot Candidate / Ready for Pilot Validation**. E2E acceptance test 11/11 PASS trên live Supabase, 0 mock fallback. Giai đoạn tiếp theo: **K7 — Pilot Readiness / Real Clinic Validation**. Nguyên tắc: không xây thêm abstraction trước khi có feedback từ clinic thật.
- **2026-08-26 (K6.2 CLOSED):** Canonical hóa toàn bộ Server Actions → Healthcare Kernel Engines. 10/10 acceptance test PASS trên live DB. Chứng minh Product Layer → Kernel → Real DB end-to-end.
- **2026-08-26 (K6.1 CLOSED):** Reality Audit — xác định Product UI đang bypass Kernel. Lập kế hoạch canonicalization.
- **2026-08-26:** Chuẩn hóa chỉ số LOC thành 3 nhóm rõ rệt phục vụ due diligence kỹ thuật và cập nhật phân loại Blocker theo hướng kiểm soát kiến trúc.
- **2026-08-23:** Đóng dấu hoàn thành Dental Phase 1 (Kiến trúc & RLS) và tái cấu trúc tầng tài liệu (Documentation Control Plane).
- **2026-08-22:** Niêm phong (Sealed) thành công Logistics OS E7.3 với 108 bài test mới (nâng tổng số test lên 547).
- **2026-08-17:** Khóa băng Healthcare H1.2 và AP/AR Reconciliation F5.5.
