# 👑 BẢN ĐỒ DỰ ÁN & QUY TẮC PHÁT TRIỂN (AGENT CONTEXT)
**Dự án**: Bella Spa Enterprise Resource Planning (ERP) System  
**Ngày cập nhật**: 30/05/2026  
**Mục tiêu**: Giúp AI Coding Assistants và lập trình viên con người nhanh chóng hiểu toàn diện dự án trong 30 giây và tuyệt đối tuân thủ các quy tắc lập trình an toàn để chống lỗi hồi quy.

---

## 🎯 1. Tổng quan dự án Bella Spa ERP
Bella Spa ERP là giải pháp quản trị doanh nghiệp toàn diện thiết kế chuyên biệt cho chuỗi spa chăm sóc mẹ bầu và bé sau sinh. 

Hệ thống quản lý chu kỳ khép kín từ Đăng ký khách hàng $\rightarrow$ Hợp đồng gói trị liệu $\rightarrow$ Phân ca KTV $\rightarrow$ Chấm công GPS & Check-in $\rightarrow$ Tích điểm Loyalty tự động $\rightarrow$ Kế toán kép tự động cập nhật sổ cái & P&L $\rightarrow$ Tính lương hoa hồng KTV $\rightarrow$ Khóa kỳ kế toán hàng tháng.

---

## 🧭 1.1. Cập nhật trạng thái mới nhất ngày 30/05/2026
* **Độ an toàn dữ liệu**: Đã harden hàng loạt Server Actions theo nguyên tắc Zero Silent DB Failures. Các lỗi DB trong audit, brand service, customer/package actions, dashboard/customer/attendance/KTV reads và session lifecycle phải throw hoặc trả explicit failure, không được `console.error` rồi tiếp tục thành công giả.
* **GPS KTV**: Check-in/check-out vẫn phải thành công khi GPS lỗi. GPS check-in/out được lưu như side-effect phụ trợ và chỉ trả warning nếu lỗi; lỗi cập nhật booking, trừ kho, đếm session hoặc hậu xử lý quan trọng vẫn rollback để tránh dữ liệu nửa vời.
* **Salary/P&L**: Salary engine dùng `recalculateAndSaveSalaryRecord`, đồng bộ KPI từ `kpi_records`, bảo toàn record không còn `draft`, tính session quy đổi theo `packages.session_multiplier`, và P&L chỉ ghi nhận doanh thu/chi phí đúng trạng thái.
* **Salary reconciliation**: Legacy total phải dùng đủ `base_salary`, `session_bonus`, `kpi_bonus`, `rating_bonus`, trừ `violations_deduction` và xử lý `service_percentage_bonus`; `NO_LEGACY/PENDING_LEGACY` không được tính là lệch lớn.
* **HQ/Multi-tenant**: HQ branch list dùng cùng tập tenant với KPI, không loại nhầm Bella Spa Headquarter; không tạo số liệu fallback giả khi load lỗi. Brand distribution matrix không dùng embed `tenants(name)` trên `packages`, mà fetch tenants riêng rồi map bằng `tenant_id`.
* **UI mới sửa**: Header HQ mobile, date filter financial overview, chart legend financial overview, thẻ liệu trình mobile, GPS trong thẻ liệu trình completed, và các nút HQ desktop/mobile đã được chỉnh responsive cục bộ để không ảnh hưởng màn khác.
* **Triển khai**: Repo đúng là `bellaspahcm/bella-spa-erp`, Vercel đúng project `bella-spa-s-projects/bella-spa-erp`. Từ cuối ngày 30/05/2026 ưu tiên chỉ `git push` để Vercel auto-deploy, tránh chạy thêm `vercel --prod` gây 2 deployment cùng commit.

---

## 🛠️ 2. Công nghệ & Lệnh điều khiển chính (Scripts)
* **Frontend**: Next.js 16 (App Router, Server Components), Tailwind CSS v4, Framer Motion.
* **Backend**: Serverless Route Handlers, Supabase SSR.
* **Database & Auth**: Supabase Managed PostgreSQL 15, Row Level Security (RLS) bảo mật tuyệt đối, Supabase Realtime (WebSockets) cho Timeline Admin.
* **Offline-First Storage**: IndexedDB (Dexie.js) lưu trữ tạm thời các thao tác khi mất sóng 4G.
* **Các lệnh chính**:
  - `npm run dev`: Chạy môi trường Local Development.
  - `npm run build`: Biên dịch dự án hoàn chỉnh.
  - `npm run test`: Chạy toàn bộ Jest test suites. Mốc mới nhất 30/05/2026: 51 suites / 519 tests pass.
  - `npx tsc --noEmit`: Kiểm tra biên dịch và kiểu dữ liệu TypeScript.
  - `npx playwright test`: Chạy các test E2E Playwright.

---

## 📂 3. Cấu trúc thư mục cốt lõi (Core Directory Map)
_(💡 AI chỉ dẫn: Hãy đi tìm file theo cấu trúc Modular bên dưới, không tự đoán đường dẫn)_
```text
BELLA SPA ERP/
├── docs/                       # Tài liệu thiết kế & cẩm nang hệ thống
│   ├── BELLA_SPA_ERP_MASTER_GUIDE.md  # 👑 Cẩm nang tối cao, UAT Log & hướng dẫn sử dụng
│   ├── HR_AND_KTV_SPEC.md      # Đặc tả nhân sự, chấm công, xin nghỉ, đổi ca & tính lương
│   ├── FRANCHISE_AND_OFFLINE_SPEC.md  # Đặc tả đa chi nhánh nhượng quyền & đồng bộ offline
│   ├── DEVELOPMENT_LOG.md      # Nhật ký lịch sử phát triển & bảo trì tổng hợp
│   └── archive/                # 📦 Thư mục rác/lưu trữ tài liệu lịch sử cũ
├── src/
│   ├── app/                    # Next.js App Router (Phân trang & API Route Handlers)
│   │   ├── (auth)/             # Login, đăng xuất & bypass activation
│   │   ├── dashboard/          # Phân hệ Admin, Kế toán, Nhân sự (Web view)
│   │   ├── ktv/                # Phân hệ di động dành cho KTV (Check-in/out, earnings)
│   │   ├── portal/             # Cổng thông tin Khách hàng (Đánh giá ca, dynamic payment)
│   │   └── api/                # API Gateway backend
│   ├── components/             # Thư viện UI components dùng chung & features
│   ├── lib/                    # Cấu hình Supabase client/server, Dexie DB, rate limit
│   ├── services/               # Server Actions giao tiếp DB an toàn (Transaction-safe)
│   └── types/                  # Định nghĩa kiểu dữ liệu tĩnh TypeScript
├── supabase/
│   ├── config.toml             # Cấu hình Supabase CLI
│   ├── seed.sql                # Dữ liệu mẫu cấu trúc ban đầu
│   └── migrations/             # Lịch sử các tệp di cư database SQL
├── AGENTS.md                   # 🚦 Các quy tắc code khắt khe cho AI
├── CLAUDE.md                   # Chỉ mục quy tắc AI
└── package.json
```

---

## 🚦 4. Quy tắc phát triển nghiêm ngặt chống lỗi hồi quy
_(Bắt buộc tất cả AI và lập trình viên phải tuân thủ tuyệt đối theo `AGENTS.md`)_

1. **Zero Silent Database Failures (Chặn nuốt lỗi DB):**
   - **CẤM TUYỆT ĐỐI** viết khối `try/catch` chỉ thực hiện `console.error` rồi trả về kết quả thành công giả tạo (như `return { success: true }`).
   - Nếu truy vấn DB lỗi, bắt buộc phải re-throw (`throw error`) hoặc trả về cấu trúc lỗi tường minh (`return { success: false, error: error.message }`) để hệ thống dừng ngay tiến trình.

2. **Mandatory Side-Effect Assertions (Kiểm tra phản ứng phụ):**
   - Khi viết unit tests/E2E test cho một hành động phát sinh tác động gián tiếp (ví dụ: duyệt nghỉ phép $\rightarrow$ tự chèn bản ghi chấm công; chốt ca $\rightarrow$ tự trừ kho vật tư), **bắt buộc** bài test phải truy vấn CSDL và khẳng định (`expect`) bản ghi gián tiếp đó đã được tạo/sửa đổi chính xác.

3. **Strict Database Payload Typing (Ép kiểu DB tĩnh):**
   - **CẤM TUYỆT ĐỐI** ép kiểu `as any` hoặc dùng object lỏng lẻo khi chèn/cập nhật dữ liệu vào Supabase.
   - Luôn sử dụng kiểu dữ liệu tự động tạo từ Supabase (ví dụ: `Database['public']['Tables']['revenue']['Insert']`) để TypeScript compiler tự động chặn đứng lỗi sai cột hoặc mismatch kiểu tại thời điểm build.

4. **Salary Engine là nguồn sự thật duy nhất:**
   - Mọi thay đổi liên quan `salary_records` phải đi qua `recalculateAndSaveSalaryRecord`.
   - Draft salary được tính động theo attendance/pro-rata/deductions; record không còn `draft` phải bảo toàn manual approvals nếu không có override rõ ràng.
   - KPI bonus phải đồng bộ từ `kpi_records`, không tự tính lệch ở display layer.

5. **P&L và báo cáo tài chính phải lọc trạng thái nghiêm ngặt:**
   - Doanh thu chỉ tính khi `status === 'confirmed'`.
   - Chi phí chỉ tính khi `status === 'approved' || status === 'paid'`.
   - KTV salary fund dùng `salary_records.total_salary` nếu đã có record; nếu chưa có record thì pro-rata theo ngày làm thực tế.

6. **Salary reconciliation không được tạo false alarm:**
   - Legacy total phải bao gồm đủ base salary, session bonus, KPI bonus, rating bonus, trừ violation deduction và service percentage bonus nếu được dùng như ứng trước.
   - `NO_LEGACY` / `PENDING_LEGACY` là “Chưa chốt lương”, không phải “Lệch lớn”.

7. **Package-based KTV session multipliers:**
   - Các module lương/report/RPC phải dùng `packages.session_multiplier` để tính session quy đổi.
   - `salary_records.total_sessions` là numeric/number có thể có số thập phân, ví dụ `14.5`.

8. **GPS không được chặn trải nghiệm KTV:**
   - KTV vẫn phải check-in/check-out được nếu GPS hoặc lưu tọa độ lỗi.
   - GPS failure chỉ warning; các lỗi dữ liệu trọng yếu như booking update, inventory consume, count completed sessions vẫn phải rollback hoặc explicit failure.
