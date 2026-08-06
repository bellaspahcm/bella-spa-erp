# ADR-001: Bella Platform Unified Plugin Runtime Constitution

- **Status**: Approved & Frozen (Architecture v1)
- **Date**: 2026-08-06
- **Deciders**: Bella Platform Core Architecture Team

## Context
Bella Platform là nền tảng đa ngành (Healthcare, Auto, Real Estate, Retail...). Nếu mỗi phân hệ ngành tự xây dựng một cơ chế plugin hoặc framework mở rộng riêng lẻ, hệ thống sẽ nhanh chóng rơi vào tình trạng phân mảnh, không thể dùng chung Marketplace, không thể chia sẻ các dịch vụ Phân quyền (Permissions), Asset Distribution, Versioning, và Audit Logging.

## Decision
1. **Duy Nhất Một Runtime**: Chỉ tồn tại duy nhất một hạ tầng `Platform Plugin Runtime` trong toàn bộ hệ sinh thái Bella Platform (`src/core/plugins/`).
2. **Tuân Thủ Thống Nhất**: Mọi phân hệ ngành (Healthcare, Auto, Real Estate, Retail...) BẮT BUỘC phải vận hành trên hạ tầng Runtime chung này. Không phân hệ nào được phép tự xây dựng Runtime riêng.
3. **Vòng Đời Thống Nhất**: Tất cả các Plugin của bất kỳ ngành nào đều tuân thủ Vòng đời 7 bước chuẩn:
   - `beforeLoad()` → `validate()` → `registerCapabilities()` → `registerExperience()` → `onInit()` → `onReady()` → `onDestroy()`.
4. **Marketplace & Versioning Standard**: Hợp đồng `ProductManifest` quy định thống nhất trên toàn hệ thống với kiểm soát phiên bản đa chiều (`apiVersion`, `schemaVersion`, `eventVersion`, `minimumKernelVersion`, `supportedHostVersion`).

## Consequences
- Mọi sản phẩm mới (Medical, Dental, Auto Showroom, Real Estate Portal...) có thể tạo mới dễ dàng theo cùng một mẫu chuẩn.
- Hạ tầng Marketplace, Phân quyền và Copilot AI được tích hợp 1 lần duy nhất ở cấp Host Platform.
- Ngăn chặn triệt để tình trạng vỡ kiến trúc hoặc rò rỉ trạng thái giữa các phân hệ.
