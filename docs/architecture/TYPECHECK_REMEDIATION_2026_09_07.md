---
title: Kiểm tra và sửa TypeScript toàn dự án
type: bugfix
created: 2026-09-07
status: in-review
baseline_commit: 1698280e
---

## Intent

Kiểm tra mã hiện có, xác định lỗi bằng compiler và sửa tối thiểu trong phạm vi đã được người dùng ủy quyền. Giữ nguyên nghiệp vụ và các thay đổi có sẵn trong workspace.

## Boundaries & Constraints

- Không đổi database, RLS, migration, permission, hoặc khởi động/dừng dịch vụ của người dùng.
- Không thêm exclusions, suppressions, any hoặc kiểu giả để làm xanh compiler.
- Chỉ sửa khi ownership và ngữ nghĩa đã rõ; xung đột contract/schema phải được ghi nhận riêng.
- Không commit các thay đổi của công việc khác.

## Code Map

- `tsconfig.json`: kiểm tra ứng dụng, không bao gồm mobile, shared, MCP, scripts, tests.
- `scripts/governance/scoped-typecheck.ts`: 45 scope Platform hiện tại.
- `apps/mobile/src/lib/shared-utils.ts`: bản sao type và helper của shared.
- `src/lib/bella-auto/engines/BusinessRollbackEngine.ts`: probe compiler dừng ở file này; client injected thiếu Database generic, fallback có generic.

## Tasks & Acceptance

- [x] Chạy Gate B: 45 PASS / 0 FAIL / 0 HOTSPOT.
- [x] Kiểm tra shared và MCP: PASS với compiler root.
- [x] Sửa các lỗi kiểu mobile đã xác minh, kiểm tra lại.
- [x] Ghi rõ các lỗi còn lại và giới hạn kiểm chứng.
- Given workspace có thay đổi trước phiên, when sửa typecheck, then giữ nguyên các thay đổi đó.
- Given sửa chỉ annotation, when so sánh JavaScript emit, then không đổi hành vi runtime.
- Given compiler timeout, when báo kết quả, then không gọi đó là PASS hoặc không có lỗi.

## Verification

- `npm run type-check -- --pretty false --incremental false --extendedDiagnostics`: không hoàn tất sau khoảng 3 phút; dừng riêng compiler của phiên để điều tra.
- `npm run governance:typecheck -- --verbose`: 45/45 PASS.
- Root compiler với `packages/shared/tsconfig.json`, `mcp-server/tsconfig.json`: PASS.
- Mobile: TS5098; override bundler để chẩn đoán lộ 29 lỗi trong 12 file, chưa phải PASS.

## Spec Change Log

Chỉ dẫn trực tiếp của người dùng cho phép kiểm tra và sửa; không cần lặp lại phê duyệt cho sửa tối thiểu đã rõ.

Người dùng đã chọn: giữ nguyên nghiệp vụ; sửa lỗi kiểu an toàn và lập danh sách phần cần đối chiếu contract/schema.

## Kết quả cuối đợt sửa an toàn

Chỉ giữ thay đổi trong 3 file mobile:

- `apps/mobile/src/lib/shared-utils.ts`: AuthState theo trạng thái thật của AuthContext và canonical shared; giữ phone optional; role helpers chỉ nới input annotation; validation result phân biệt success/error.
- `apps/mobile/app/(auth)/login.tsx`: hai validator dùng return type phân biệt success/error.
- `apps/mobile/tsconfig.json`: moduleResolution bundler theo Expo base có customConditions react-native. Không thay include/exclude, strict hoặc skipLibCheck.

Root TypeScript 5.9.3: mobile giảm 29 xuống 4 diagnostics sau sửa. Trước sửa dùng CLI override bundler để lộ lỗi mã nguồn; sau sửa không cần override. Đây không phải mobile PASS.

Compiler mobile 5.3.3: còn TS6046 do Expo base dùng module preserve, ngoài 4 lỗi mã nguồn. Không nâng dependency trong phiên này.

Hai file TypeScript sửa có JavaScript emit giống hệt baseline (removeComments=true). Ba lượt review không có finding actionable. `git diff --check` PASS cho 3 file.

Gate B: 45/45 PASS. Regression: 45 ALLOW / 0 BLOCK. Architecture Guard: PASS theo script hiện có; không phải chứng minh toàn bộ runtime không có lỗi.

Không chạy DB/E2E, không đổi dữ liệu, migration, RLS, hoặc dịch vụ đang chạy. Không commit/push vì full typecheck chưa hoàn tất và workspace có nhiều thay đổi của công việc khác.

## Phần cần đối chiếu riêng

1. Bella Auto rollback: schema có sequence/action/entity_type/entity_id/snapshot_before, mã lại dùng step_order/action_type/target_table/target_record_id/before_snapshot. Route dùng completed trong khi enum có committed. Không tự suy diễn mapping nghiệp vụ.
2. BusinessRollbackEngine static methods truy vấn auto_rollback_transactions, auto_rollback_steps, auto_invoices chưa có trong generated Database và chưa tìm thấy CREATE TABLE tương ứng. Probe tách method: executeRollback instance 723ms, static 2403ms; createRollbackTransaction và validateRollback vượt 15 giây. Chỉ trong probe bỏ select/single thì trả chẩn đoán missing-table sau 1159/1014ms. Thay annotation thử đã hoàn tác, engine không có diff cuối.
3. Mobile: thiếu expo-updates; Sentry stub trả null nhưng useTodaySessions gọi startChild/finish; tenant resolver nhận 0 tham số, caller truyền enabled_modules. Những sửa này có thể đổi dependency/hành vi, chưa thực hiện theo phạm vi người dùng chọn.
4. Các diagnostics ứng dụng còn lại xem [inventory theo file](TYPECHECK_DIAGNOSTICS_2026_09_07.md). Inventory chưa đầy đủ, không dùng để tuyên bố toàn dự án đã sạch lỗi.

## Suggested Review Order

- Kiểu auth/validation theo dữ liệu và trạng thái thực tế.
  [shared-utils.ts](../../apps/mobile/src/lib/shared-utils.ts#L22)
- Thu hẹp kết quả validator, giữ nguyên login runtime.
  [login.tsx](../../apps/mobile/app/%28auth%29/login.tsx#L17)
- Đồng bộ cơ chế phân giải type của Expo.
  [tsconfig.json](../../apps/mobile/tsconfig.json#L16)
