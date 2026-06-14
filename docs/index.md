# Chỉ Mục Tri Thức Bella ERP

Đây là tài liệu đầu tiên cần mở khi một lập trình viên, quản lý kỹ thuật, hoặc AI agent mới tham gia dự án.

## Bắt Đầu Từ Đây

1. `AGENTS.md` - các quy tắc bắt buộc về kỹ thuật, test, database, lương, tài chính và side effects.
2. `docs/AI_AGENT_ONBOARDING.md` - cách một AI agent hoặc người mới xây context và bắt đầu làm việc an toàn.
3. `docs/KNOWLEDGE_STORAGE_PROCESS.md` - quy trình lưu trữ quyết định, spec, investigation, log và handoff.
4. `docs/DEVELOPMENT_LOG.md` - lịch sử phát triển theo thời gian và bằng chứng kiểm tra.

## Định Hướng Sản Phẩm Hiện Tại

Bella hiện là ERP cho spa. Định hướng dài hạn là tiến hóa thành lõi ERP tái sử dụng được cho nhiều ngành dịch vụ.

- Core platform: tenant, auth, RBAC, billing, quota, audit, notification, booking/order primitives, payment, workflow, rule configuration.
- Module ngành đầu tiên: spa/babycare với KTV, buổi dịch vụ, gói liệu trình, lương, hoa hồng và quy trình chăm sóc.
- Module tương lai: cleaning, babycare, home service và các ngành dịch vụ khác.

Không thực hiện thay đổi kiến trúc rộng nếu chưa ghi rõ intent và ranh giới migration trong `docs/implementation-artifacts/`.

## Bản Đồ Tài Liệu

| Nhu cầu | Đọc / ghi tại |
| --- | --- |
| Người mới hoặc AI agent bắt đầu | `docs/AI_AGENT_ONBOARDING.md` |
| Quy tắc lưu trữ context và handoff | `docs/KNOWLEDGE_STORAGE_PROCESS.md` |
| Quy trình phát triển phân hệ ngành mới, bài học Beauty Spa và checklist chống lặp lỗi | `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` |
| Roadmap tách core platform đa ngành | `docs/plans/core-platform-extraction-roadmap.md` |
| Kế hoạch hoãn triển khai Beauty Spa chuỗi nhiều chi nhánh | `docs/plans/beauty-spa-chain-expansion-deferred-plan.md` |
| Kế hoạch triển khai máy POS và in bill nhiệt K80 | `docs/plans/pos-and-bill-printing-plan.md` |
| Nhật ký phát triển theo ngày | `docs/DEVELOPMENT_LOG.md` |
| Một lát cắt triển khai cụ thể | `docs/implementation-artifacts/spec-*.md` |
| Điều tra trước khi sửa rủi ro cao | `docs/implementation-artifacts/investigations/*.md` |
| Tài liệu lịch sử business/technical | Các file `docs/*.md` cấp cao |
| Báo cáo kế toán chi tiết TT133 | `docs/bella_spa_accounting_report.html` |
| Báo cáo sức khỏe vận hành hệ thống | `docs/bella_spa_business_report.html` |
| Cẩm nang kế toán song song | `docs/bella_spa_dual_mode_accounting_guide.html` |
| Lưu trữ bất biến | `docs/archive/*.md` |

## Quy Tắc Vàng

Nếu một AI agent tương lai không thể hiểu vì sao một thay đổi tồn tại từ tài liệu và git history, quy trình lưu trữ đã thất bại. Hãy thêm artifact ngắn gọn trước hoặc trong lúc thực hiện thay đổi.
