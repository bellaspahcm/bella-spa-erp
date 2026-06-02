# Quy Trình Lưu Trữ Tri Thức

Quy trình này giúp Bella ERP dễ hiểu với người mới và AI agent trong tương lai.

## Mục Tiêu

- Lưu lại lý do quyết định, không chỉ lưu thay đổi.
- Giữ context cho AI nhỏ, dễ tìm và không trùng lặp.
- Làm cho quá trình tách core platform an toàn hơn.
- Tránh việc phải điều tra lại các rule về lương, tài chính, tenant, audit và side effects.

## Thứ Tự Source Of Truth

Khi tài liệu mâu thuẫn, ưu tiên theo thứ tự:

1. `AGENTS.md` - quy tắc kỹ thuật và kiểm thử bắt buộc.
2. Source code hiện tại và database migrations.
3. `docs/implementation-artifacts/` - spec, investigation, deploy checkpoint mới nhất.
4. `docs/DEVELOPMENT_LOG.md` - lịch sử và bằng chứng verification.
5. Tài liệu lịch sử cấp cao trong `docs/*.md`.
6. Tài liệu archive trong `docs/archive/`.

Nếu tài liệu lịch sử mâu thuẫn với code hiện tại hoặc `AGENTS.md`, không làm theo mù quáng. Tạo investigation note và reconcile trước.

## Quy Tắc Thư Mục

| Vị trí | Mục đích | Khi nào ghi |
| --- | --- | --- |
| `docs/index.md` | Cửa vào và bản đồ tài liệu | Khi thêm/bỏ nhóm tài liệu lớn |
| `docs/AI_AGENT_ONBOARDING.md` | Quy trình agent bắt đầu làm việc | Khi workflow agent thay đổi |
| `docs/KNOWLEDGE_STORAGE_PROCESS.md` | Quy tắc lưu trữ | Khi governance tài liệu thay đổi |
| `docs/DEVELOPMENT_LOG.md` | Nhật ký phát triển theo thời gian | Sau batch triển khai/deploy đáng kể |
| `docs/implementation-artifacts/spec-*.md` | Một lát cắt thay đổi cụ thể | Trước hoặc trong lúc triển khai |
| `docs/implementation-artifacts/investigations/*.md` | Root-cause hoặc kiến trúc investigation | Trước thay đổi rủi ro/không rõ |
| `docs/plans/` | Kế hoạch/roadmap lớn | Khi việc kéo dài nhiều lát cắt |
| `docs/archive/` | Snapshot cũ | Khi nội dung lỗi thời nhưng cần giữ |

## Cách Đặt Tên Artifact

Dùng tên ổn định, dễ tìm:

- `spec-harden-<area>-<risk>.md`
- `spec-refactor-<area>-<boundary>.md`
- `spec-add-<capability>.md`
- `investigation-<area>-<question>.md`
- `deploy-readiness-<area>.md`
- `core-platform-<decision>.md`

Ví dụ:

- `spec-harden-dashboard-audit-typing.md`
- `investigation-crm-zalo-sms-quota-flow.md`
- `deploy-readiness-super-admin-subscription-quota.md`
- `core-platform-module-boundary-decision.md`

## Nội Dung Tối Thiểu Của Spec

```markdown
# Title

## Intent
- Problem:
- Approach:

## Scope
- In:
- Out:

## Risk
- Data:
- Tenant/security:
- Side effects:

## Files
- `path` - vì sao quan trọng

## Verification
- command/result

## Handoff
- commit:
- pushed:
- deferred:
```

Dùng format BMAD spec khi công việc không đơn giản hoặc đang chạy theo BMAD.

## Quy Tắc Development Log

Chỉ thêm vào `docs/DEVELOPMENT_LOG.md` với batch có ý nghĩa:

- hành vi production thay đổi
- database/migration/deploy thay đổi
- refactor rủi ro cao hoàn tất
- thêm test hoặc safety rule
- điều tra và đóng một bug

Không thêm log nhiễu cho sửa typo nhỏ, trừ khi typo đó ảnh hưởng onboarding hoặc kiến trúc.

## Decision Record Cho Core Platform

Với mục tiêu dài hạn biến Bella thành ERP core đa ngành, mọi quyết định module-boundary phải ghi:

- Đây là core hay industry-specific?
- Ngành tương lai nào sẽ tái sử dụng?
- Giả định spa nào được loại bỏ hoặc giữ lại?
- Database table nào bị ảnh hưởng?
- Migration path nào giữ nguyên hành vi Bella Spa hiện tại?
- Test nào chứng minh workflow spa cũ vẫn chạy?

Core candidates:

- tenant management
- auth/RBAC
- audit
- notification
- billing/quota
- service catalog primitives
- booking/order primitives
- payment/invoice primitives
- workflow state
- module registry

Spa module candidates:

- thuật ngữ KTV và luật lương
- package session multipliers
- treatment sessions
- trường mother/baby care
- spa commission rules
- KTV leaderboard và compensation theo attendance

## Quy Tắc Context Budget Cho AI

AI agent tương lai không nên load toàn bộ thư mục docs. Load theo thứ tự:

1. `AGENTS.md`
2. `docs/index.md`
3. file này
4. 1-3 artifact mới nhất liên quan
5. đúng các code file của task

Chỉ load master guide cũ khi artifact hiện tại không trả lời được câu hỏi.

## Done Nghĩa Là Đã Lưu

Một task chưa thật sự xong cho đến khi:

- code/docs đã commit hoặc được ghi rõ là chưa commit
- verification result được ghi trong final response hoặc artifact
- quyết định mới được lưu đúng chỗ
- deferred work được nêu tên rõ, không để ngầm hiểu
