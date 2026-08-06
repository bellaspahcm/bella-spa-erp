# Bella Platform Architecture Governance Guide

Tài liệu này quy định quy trình và các công cụ thực thi tự động nhằm bảo vệ ranh giới kiến trúc **Bella Platform Enterprise Architecture v1 — FROZEN**.

---

## 1. The Stable Core Principle
- **Stable Zone**: Các thư mục `src/core/` và `src/modules/*-kernel/` được phân loại là Vùng Ổn Định.
- **Quy tắc sửa đổi**: Mọi yêu cầu tính năng mới trước tiên phải được giải quyết thông qua **Extension Points** (`products/*` hoặc `experience/*`).
- Chỉ khi chứng minh được Extension Points không đáp ứng được thì mới được xem xét chỉnh sửa Kernel, và thay đổi đó **BẮT BUỘC phải đi qua quy trình phê duyệt ADR**.

---

## 2. Dependency & Import Rules (Thực thi bằng Code & Tests)
1. **Rule 1 (Downstream Isolation)**: `src/modules/*-kernel/` CẤM import từ `src/products/*`.
2. **Rule 2 (Product Isolation)**: `src/products/[product_A]` CẤM import từ `src/products/[product_B]`.
3. **Rule 3 (No Global Singletons)**: Registries phải gắn theo Scoped Context Value / Instance.
4. **Rule 4 (No Branching in Kernel)**: Cấm các nhánh `if (type === 'medical')` hoặc `if (type === 'dental')` trong Kernel.
5. **Rule 5 (Zero `any`)**: Cấm tuyệt đối kiểu `any` trong TypeScript code.

---

## 3. Automated Architectural Verification
Hệ thống tự động kiểm tra ranh giới kiến trúc thông qua:
- **TypeScript Strict Compiler (`npm run build`)**
- **ESLint Dependency Rules (`npm run lint`)**
- **Jest Architecture Tests (`src/modules/bella-healthcare-kernel/__tests__/architecture-governance.test.ts`)**
