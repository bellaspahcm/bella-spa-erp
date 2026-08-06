# ADR-004: Bella Host Platform Pattern

> **Trạng thái:** ACCEPTED  
> **Ngày quyết định:** 2026-08-06  
> **Người đưa ra quyết định:** Enterprise Architecture Board & AI Agent  

## Bối Cảnh (Context)
Khi mở rộng sang các phân hệ ngành phức tạp như Healthcare (`medical_clinic`, `hospital`), có rủi ro tạo ra một hệ thống y tế độc lập (Silo Platform) bị trùng lặp lại các hạ tầng cơ bản của Bella ERP như Authentication, Permissions, Finance, CRM, Inventory, Metadata và Document Management.

## Quyết Định (Decision)
Thống nhất áp dụng **Bella Host Platform Pattern**:
- **Bella Platform** đóng vai trò là **Host Platform**, quản lý toàn bộ các Foundation Platforms dùng chung (`Finance`, `CRM`, `Inventory`, `Document`, `Metadata`, `Workflow`, `AI`, `Integration`).
- **Healthcare Platform** được thiết kế như một **Domain Platform** chạy trên Bella Host Platform, kế thừa 100% các Foundation Services mà không nhân bản bất kỳ hạ tầng lõi nào.

## Hệ Quả (Consequences)
- **Tích cực:** Tái sử dụng tối đa kiến trúc hiện có, tiết kiệm chi phí phát triển, nhất quán dữ liệu CRM và Kế toán TT133 cho toàn bộ doanh nghiệp.
- **Thách thức:** Cần duy trì hợp đồng API và RLS tenant isolation khắt khe để đảm bảo ranh giới giữa các Domain Platform (Healthcare, Beauty, Real Estate).
