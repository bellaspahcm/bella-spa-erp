# ADR-005: Universal Bella Runtime & Domain Runtime

> **Trạng thái:** ACCEPTED  
> **Ngày quyết định:** 2026-08-06  
> **Người đưa ra quyết định:** Enterprise Architecture Board & AI Agent  

## Bối Cảnh (Context)
Trước đây, các Capability được kích hoạt thủ công qua các tham số tĩnh. Khi số lượng ngành và Capability tăng lên (Healthcare, Beauty, Industrial Cleaning, Real Estate, Retail), cần một cơ chế động cấp Nền tảng để nạp (load), kiểm tra phụ thuộc và quản lý vòng đời của từng Capability.

## Quyết Định (Decision)
Nâng cấp cơ chế quản lý Capability thành **Universal Bella Runtime & Domain Runtime**:
- Chạy ở tầng Bella Host Platform, dùng chung cho mọi ngành.
- Quản lý vòng đời Capability theo các bước tiêu chuẩn: `Load` $\rightarrow$ `Dependency Resolution` $\rightarrow$ `Migration Check` $\rightarrow$ `Permission Binding` $\rightarrow$ `Navigation Mount` $\rightarrow$ `API Route Registry` $\rightarrow$ `Event Register` $\rightarrow$ `Unload`.
- Capability Manifest sử dụng **Semantic Versioning** (`schemaVersion`, `capabilityVersion`, `apiVersion`, `migrationVersion`).

## Hệ Quả (Consequences)
- **Tích cực:** Tự động hóa quá trình bật/tắt module, ngăn chặn lỗi thiếu phụ thuộc (Missing dependencies) trước khi chạy runtime.
- **Thách thức:** Đòi hỏi mỗi Capability phải tuân thủ nghiêm ngặt chuẩn định dạng Manifest và Semantic Versioning.
