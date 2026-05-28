# 👑 BẢN ĐỒ DỰ ÁN & QUY TẮC PHÁT TRIỂN (AGENT CONTEXT)
**Dự án**: Bella Spa Enterprise Resource Planning (ERP) System  
**Ngày cập nhật**: 29/05/2026  
**Mục tiêu**: Giúp AI Coding Assistants và lập trình viên con người nhanh chóng hiểu toàn diện dự án trong 30 giây và tuyệt đối tuân thủ các quy tắc lập trình an toàn để chống lỗi hồi quy.

---

## 🎯 1. Tổng quan dự án Bella Spa ERP
Bella Spa ERP là giải pháp quản trị doanh nghiệp toàn diện thiết kế chuyên biệt cho chuỗi spa chăm sóc mẹ bầu và bé sau sinh. 

Hệ thống quản lý chu kỳ khép kín từ Đăng ký khách hàng $\rightarrow$ Hợp đồng gói trị liệu $\rightarrow$ Phân ca KTV $\rightarrow$ Chấm công GPS & Check-in $\rightarrow$ Tích điểm Loyalty tự động $\rightarrow$ Kế toán kép tự động cập nhật sổ cái & P&L $\rightarrow$ Tính lương hoa hồng KTV $\rightarrow$ Khóa kỳ kế toán hàng tháng.

---

## 🛠️ 2. Công nghệ & Lệnh điều khiển chính (Scripts)
* **Frontend**: Next.js 16 (App Router, Server Components), Tailwind CSS v4, Framer Motion.
* **Backend**: Serverless Route Handlers, Supabase SSR.
* **Database & Auth**: Supabase Managed PostgreSQL 15, Row Level Security (RLS) bảo mật tuyệt đối, Supabase Realtime (WebSockets) cho Timeline Admin.
* **Offline-First Storage**: IndexedDB (Dexie.js) lưu trữ tạm thời các thao tác khi mất sóng 4G.
* **Các lệnh chính**:
  - `npm run dev`: Chạy môi trường Local Development.
  - `npm run build`: Biên dịch dự án hoàn chỉnh.
  - `npm run test`: Chạy toàn bộ 445 unit/logic test suites bằng Jest.
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
