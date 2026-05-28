# Bella Spa ERP — Hệ Thống Quản Trị Nguồn Lực Doanh Nghiệp Chuỗi Spa Cao Cấp

Chào mừng bạn đến với **Bella Spa ERP** — giải pháp quản trị doanh nghiệp (ERP) toàn diện được thiết kế riêng cho mô hình chuỗi Spa chăm sóc mẹ và bé cao cấp. Hệ thống được xây dựng trên các công nghệ hiện đại nhất, chú trọng vào tính chính xác tài chính, tự động hóa kho vận, quản lý nhân sự hiệu quả và tích hợp Trợ lý điều hành AI COO.

---

## 🌟 Tính Năng Cốt Lõi

### 1. Phân Hệ Đặt Ca & Trị Liệu (Booking & Sessions)
* **Đặt lịch thông minh:** Quản lý vòng đời booking từ tạm tính, đặt cọc, xếp lịch cho đến hoàn thành buổi.
* **Chốt ca an toàn (Idempotent & Transaction-safe):** Cơ chế chốt ca tự động tích hợp trừ kho vật tư tiêu hao, tính toán hoa hồng kỹ thuật viên (KTV) và ghi nhận doanh thu tự động cho gói lẻ.
* **Cơ chế Rollback toàn diện:** Đảm bảo khi bất kỳ bước nào trong quy trình chốt ca bị lỗi (ví dụ: lỗi ghi sổ lương), toàn bộ hệ thống bao gồm tồn kho tiêu hao sẽ được hoàn trả (Restock) chính xác 100%, triệt tiêu hoàn toàn rủi ro sai lệch dữ liệu.

### 2. Quản Lý Kho & Vật Tư Tiêu Hao (Inventory Management)
* **Định mức tiêu hao tự động:** Tự động tính toán lượng dầu massage, khăn sạch, và các vật tư khác dựa trên gói dịch vụ khách hàng sử dụng.
* **Chặn đứng stock-out:** Hệ thống kiểm tra tồn kho thực tế trước khi thực hiện ca làm. Nếu thiếu hụt vật tư, ca làm sẽ bị chặn đứng và cảnh báo KTV/Admin ngay lập tức thay vì tự ý reset tồn kho về 0.

### 3. Phân Hệ Nhân Sự & Lương Thưởng (HR & Salary)
* **Sổ lương tự động:** Tự động tạo và cập nhật sổ lương hàng tháng của kỹ thuật viên.
* **Tính hoa hồng (Commission):** Cộng trực tiếp hoa hồng dịch vụ thực tế vào tài khoản KTV ngay sau khi hoàn thành mỗi ca làm.
* **Phân công linh hoạt:** Hỗ trợ tính năng KTV làm thay khi KTV chính vắng mặt, hiển thị minh bạch thông tin KTV làm thay trên giao diện khách hàng.

### 4. Kế Toán & Đối Soát (Accounting & Outbox)
* **Outbox Pattern:** Cơ chế ghi nhận các sự kiện tài chính (`SESSION_DONE`, `PACKAGE_SALE`, `INVENTORY_CONSUMED`, v.v.) vào hàng đợi giao dịch `accounting_outbox`, sau đó được bộ máy kế toán đối soát tự động xử lý.
* **Không nuốt lỗi:** Đảm bảo quy tắc **Zero Silent Database Failures**, mọi lỗi truy vấn hoặc ghi nhận tài chính đều được ném ra ngoài để hệ thống phát hiện và rollback an toàn.

### 5. Trợ Lý Điều Hành AI COO (AI Assistant)
* **Phân tích thông minh:** Trợ lý AI COO đóng vai trò là Trợ lý Tổng Giám Đốc, tự động đọc dữ liệu vận hành từ chi nhánh và đưa ra báo cáo tóm tắt executive, phát hiện bất thường và đề xuất các quyết định chiến lược tức thời.
* **Tích hợp Gemini 3.5 Flash:** Sử dụng các mô hình ngôn ngữ lớn để trả về cấu trúc phân tích JSON cực kỳ ổn định.

---

## 🛠️ Công Nghệ Sử Dụng

* **Frontend & Backend:** [Next.js](https://nextjs.org/) (App Router, Server Actions)
* **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, RLS policies, SSR session manager)
* **Ngôn ngữ:** TypeScript (Type-safe database insert/update payloads)
* **Kiểm thử:** Jest (445/445 unit test pass) & Playwright (E2E testing)
* **Styling:** Vanilla CSS & Tailwind CSS

---

## 🚀 Hướng Dẫn Chạy Dự Án

### 1. Yêu Cầu Cài Đặt
* Node.js v18 trở lên
* Tài khoản Supabase hoặc môi trường local development Supabase.

### 2. Cài Đặt Dependencies
```bash
npm install
```

### 3. Thiết Lập Môi Trường (Environment Variables)
Tạo file `.env.local` ở thư mục gốc và điền các biến cấu hình sau:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Chạy Local Development
```bash
npm run dev
```
Truy cập trang ứng dụng tại địa chỉ: `http://localhost:3000`.

---

## 🧪 Hệ Thống Kiểm Thử & Biên Dịch

### 1. Biên dịch TypeScript
Kiểm tra tính an toàn về kiểu dữ liệu (đảm bảo không lạm dụng `any` trong database payload):
```bash
npx tsc --noEmit
```

### 2. Chạy Jest Unit Tests
Hệ thống sở hữu bộ kiểm thử nghiêm ngặt bao quát toàn bộ logic chốt ca, trừ kho và tính lương:
```bash
npm test
```

### 3. Chạy Playwright E2E Tests
```bash
npx playwright test
```

---

## 🛡️ Nguyên Tắc Phát Triển Bắt Buộc (BELLA ERP RULES)

1. **Zero Silent Database Failures:** Tuyệt đối không được nuốt lỗi cơ sở dữ liệu. Nếu có lỗi phát sinh trong giao dịch, phải re-throw hoặc trả về lỗi rõ ràng để hệ thống thực hiện rollback trạng thái.
2. **Mandatory Side-Effect Assertions:** Trong các bài test, bắt buộc phải truy vấn các bảng chịu tác động phụ (như `attendance`, `revenue`, `inventory_logs`) để khẳng định dữ liệu được ghi nhận/hoàn tác chính xác 100%.
3. **Strict Database Payload Typing:** Không sử dụng kiểu `any` hoặc ép kiểu lỏng lẻo khi insert/update cơ sở dữ liệu. Sử dụng kiểu tự động sinh từ Supabase Schema để phát hiện lỗi ngay khi gõ code.
