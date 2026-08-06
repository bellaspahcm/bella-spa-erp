# ADR-002: Healthcare Kernel & Product Isolation Architecture

- **Status**: Approved & Frozen (Architecture v1)
- **Date**: 2026-08-06
- **Deciders**: Bella Platform Core Architecture Team

## Context
Bella Healthcare phục vụ các chuỗi phòng khám và bệnh viện đa dạng (Đa khoa, Nha khoa, Xét nghiệm LIS-RIS, Dược phẩm, Bệnh viện...). Trước đây, logic chuyên khoa từng có nguy cơ bị đan xen bởi các câu lệnh rẽ nhánh `if (type === 'medical')` hoặc `if (type === 'dental')`, gây rủi ro sửa nhầm logic giữa các sản phẩm.

## Decision
1. **Purity & Isolation**: `Healthcare Kernel` (`src/modules/bella-healthcare-kernel/`) hoàn toàn độc lập và KHÔNG chứa bất kỳ mã nguồn hay import nào từ `src/products/*`.
2. **Single Direction Dependency**: Dependency chảy 1 chiều duy nhất từ dưới lên: `Host Platform` ← `Plugin Runtime` ← `Healthcare Kernel` ← `Products` ← `Experience Packs`.
3. **Instance-Scoped CapabilityRegistry**: `CapabilityRegistry` thuộc về một `HealthcareKernelInstance` cụ thể, CẤM sử dụng Global Singleton.
4. **Fail-Fast Engine**: Nạp Plugin thất bại sẽ ngay lập tức ném lỗi `HealthcarePluginLoadException`, CẤM fallback ngầm sang sản phẩm khác.
5. **Stable Core Principle**: `kernel/*` là Vùng Ổn Định (Stable Zone). Mọi thay đổi tại Kernel bắt buộc phải có ADR phê duyệt. Mọi tính năng mới ưu tiên phát triển tại `products/*` hoặc `experience/*`.
6. **Zero `any` Types**: Nghiêm cấm sử dụng kiểu dữ liệu `any` trong toàn bộ mã nguồn.

## Consequences
- Đảm bảo an toàn tuyệt đối khi bổ sung các dòng sản phẩm y tế mới (Mắt, Tai Mũi Họng, Bệnh viện đa khoa...).
- AI Agents và các Developer mới không bao giờ có thể làm hỏng logic của sản phẩm khác.
