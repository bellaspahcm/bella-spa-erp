# Chuẩn hóa rule orchestration hoàn thành ca

Ngày: 2026-06-07

## Mục tiêu

Tách các quyết định thuần trong luồng hoàn thành ca khỏi server action để giảm lặp logic và làm rõ ranh giới giữa:

- Quyết định nghiệp vụ: trạng thái booking, gói lẻ, rollback message.
- Side-effect thực thi: cập nhật DB, trừ kho, ghi doanh thu, tính lương, enqueue kế toán.

## Engine mới

`src/lib/business-rules/session-completion.ts`

Các rule chính:

- `shouldCreateSingleSessionRevenue`: xác định gói dịch vụ lẻ cần tự ghi doanh thu.
- `calculateBookingCompletionUpdate`: tính payload cập nhật tiến trình booking theo số ca hoàn thành.
- `buildCompletionRollbackPayload`: dựng payload hoàn tác booking progress.
- `formatRollbackAppend`: thống nhất cách gắn lỗi rollback vào lỗi chính.

## Điểm nối

- `src/modules/booking/actions/session-completion-helpers.ts`
- `src/__tests__/business-rule-engines.test.ts`

## Kiểm thử

Targeted regression:

- `src/__tests__/business-rule-engines.test.ts`
- `src/__tests__/session-completion-accounting.test.ts`
- `src/__tests__/transaction-safety.test.ts`

Kết quả: 31/31 tests pass.

## Ranh giới không đổi

- Không đổi thứ tự side-effect.
- Không đổi rollback DB hiện tại.
- Không đổi accounting outbox payload.
- Không đổi user-facing workflow khi hoàn thành ca.
