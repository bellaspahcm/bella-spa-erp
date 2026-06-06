---
status: done
date: 2026-06-06
owner: Codex
---

# Standardize Revenue Ledger Rules

## Intent

Chuẩn hóa luồng doanh thu đi vào sổ cái để các nguồn ghi nhận tiền khách không tự dựng metadata và trạng thái rà soát kế toán theo nhiều công thức khác nhau.

## Scope

- Gom `resolveAccountingReviewStatus` vào `src/services/accounting/ledger-rules.ts`.
- Thêm `buildRevenueAccountingMetadata` dùng chung cho cọc, thanh toán nốt, thanh toán trọn gói, thu đối soát, webhook VietQR và hoàn tiền.
- Giữ các adapter cũ như `src/modules/booking/actions/accounting-review.ts` và `src/services/finance/transaction-review.ts` dưới dạng re-export để không phá vỡ caller hiện tại.
- Mở rộng test audit payment -> ledger cho case khách đã cọc trước.

## Acceptance Checks

- Given một revenue `deposit` có đủ `amount`, `payment_method`, `booking_id`, when build metadata và resolve review status, then event là `CUSTOMER_DEPOSIT` và trạng thái là `UNREVIEWED`.
- Given một revenue `refund`, when build metadata, then số tiền được chuẩn hóa dương và có `deferredRefundAmount`, `revenueReductionAmount`.
- Given các luồng booking/payment/webhook/finance/reconciliation tạo doanh thu, then tất cả dùng cùng helper metadata kế toán.

## Verification

- `npm.cmd test -- src/__tests__/accounting-template-rules.test.ts src/__tests__/payment-business-rule-audit.test.ts src/__tests__/payment-webhook.test.ts src/__tests__/finance-transaction-mutations.test.ts src/__tests__/session-completion-accounting.test.ts --runInBand`
