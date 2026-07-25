# Onboarding Cho AI Agent

Dùng checklist này trước khi chỉnh sửa Bella ERP.

## 0. Bắt Buộc Đọc Trước

Đọc theo thứ tự:

1. `AGENTS.md`
2. `docs/index.md`
3. `docs/KNOWLEDGE_STORAGE_PROCESS.md`
4. Các mục mới nhất trong `docs/DEVELOPMENT_LOG.md`
5. Spec hoặc investigation liên quan trong `docs/implementation-artifacts/`

Khi đụng Next.js App Router, Server Actions, Route Handlers hoặc React patterns, phải đọc guide phù hợp trong `node_modules/next/dist/docs/` trước khi sửa code.

## 1. Xây Mental Model

Phân loại công việc trước khi chạm file:

| Loại việc | Ý nghĩa | Artifact cần có |
| --- | --- | --- |
| Bug fix | Hành vi hiện tại sai hoặc không an toàn | `spec-fix-*.md` hoặc investigation nếu chưa rõ root cause |
| Refactor | Giữ nguyên hành vi, cải thiện cấu trúc/type safety | `spec-refactor-*.md` hoặc `spec-harden-*.md` |
| Feature | Năng lực nghiệp vụ mới | Spec trước khi triển khai |
| Architecture | Đổi boundary module/core/platform | Architecture note và implementation spec |
| Ops/deploy | Migration, Vercel, Supabase, smoke production | Deploy readiness/checkpoint artifact |

Nếu công việc chạm lương, tài chính, audit, tenant isolation, subscription, payment, inventory side effects hoặc database write, xem đó là rủi ro cao.

## 2. Định Hướng Core Platform

Bella nên tiến hóa từ ERP spa thành:

```text
Bella ERP Core Platform
  + Spa/Babycare Industry Module
  + Cleaning Industry Module
  + Home Service Industry Module
```

Core sở hữu các primitive trung lập ngành:

- tenant và branch
- user, role, permission
- subscription plan, quota, billing
- audit log và system notification
- service catalog primitive
- booking/order primitive
- payment và invoice primitive
- workflow state chung
- feature flag và module registry

Industry module sở hữu luật đặc thù ngành:

- spa session, KTV logic, package multiplier
- công thức lương và hoa hồng
- care plan và luật hoàn thành dịch vụ
- cleaning checklist, SLA, hourly pricing
- dashboard và label đặc thù ngành

Không đưa logic spa vào core chỉ vì nhiều màn hình đang dùng nó. Core phải trung lập ngành.

## 3. Vòng Làm Việc Chuẩn

1. Đọc rule và artifact liên quan.
2. Inspect code trước khi giả định kiến trúc.
3. Xác định scope nhỏ nhất đủ an toàn.
4. Tạo hoặc cập nhật spec/investigation artifact.
5. Triển khai đúng scope.
6. Chạy kiểm tra focused trước, kiểm tra rộng khi blast radius lớn.
7. Commit một lát cắt mạch lạc.
8. Cập nhật storage trail nếu quyết định hoặc hành vi thay đổi.

## 4. Verification Bắt Buộc

Chọn mức kiểm tra phù hợp với thay đổi:

- Docs/type-only: `git diff --check`; chạy `npx.cmd tsc --noEmit --pretty false` nếu chạm type/code.
- Code có lint: `npm.cmd run lint -- <changed files>`.
- Server actions hoặc side effects: targeted Jest có assert side-effect table.
- Finance/salary/booking/inventory shared logic: targeted test trước, full Jest sau.
- UI layout: kiểm tra browser/screenshot khi thực tế cần.
- Supabase migration/deploy: migration order artifact và smoke checklist.

## 5. Handoff Chuẩn

Mọi handoff đáng kể phải trả lời:

- Đã đổi gì?
- Vì sao đổi?
- File nào cần đọc trước?
- Check nào đã pass?
- Còn rủi ro hoặc deferred gì?
- Đã push, chỉ commit local, hay còn dirty?

Handoff phải đủ ngắn để AI agent khác nạp context mà không bị tràn.

## 6. Điểm Dừng Bắt Buộc

Dừng và hỏi trước khi:

- sửa generated database types thủ công
- đổi quyền sở hữu công thức lương
- làm yếu tenant isolation hoặc RLS
- nuốt database errors
- tách module diện rộng khi chưa có migration plan
- biến business flow lớn thành rule engine quá sớm
- xóa hoặc viết lại tài liệu lịch sử
