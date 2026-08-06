# ADR-008: Centralized Event Contract Registry

> **Trạng thái:** ACCEPTED  
> **Ngày quyết định:** 2026-08-06  
> **Người đưa ra quyết định:** Enterprise Architecture Board & AI Agent  

## Bối Cảnh (Context)
Khi hệ thống phát triển trong 10-20 năm với hàng chục Capability giao tiếp bằng Asynchronous Domain Events, việc không quản lý tập trung cấu trúc sự kiện (Payload Schemas) sẽ dẫn đến nguy cơ xung đột schema, phá vỡ tính tương thích ngược và gây ra lỗi âm thầm khi nâng cấp.

## Quyết Định (Decision)
Thiết lập **Centralized Event Contract Registry**:
- Tất cả Domain Events phải đăng ký Schema chính thức tại Event Contract Registry trước khi sử dụng.
- Quản lý **Payload Schema (JSON Schema)**, **Semantic Versioning** (`EventName.v1`, `EventName.v2`), **Backward Compatibility Rules** và **Deprecation Lifecycle** cho từng sự kiện.

## Hệ Quả (Consequences)
- **Tích cực:** Ngăn ngừa hoàn toàn tình trạng phá vỡ hợp đồng dữ liệu giữa các Capability khi nâng cấp độc lập.
- **Thách thức:** Cần kiểm tra tự động Event Schema Compatibility trong CI/CD pipeline trước khi deploy.
