# Centralize Accounting Outbox Event Adapter

## Muc tieu

Gom cac payload tao su kien ke toan vao mot adapter chung de cac luong booking, thanh toan, doi soat, chi phi, luong va kho khong tu lap cau truc outbox rieng le.

## Pham vi da gom

- `PACKAGE_SALE`: tao booking co coc, thanh toan webhook, thu doi soat cong no, phan bo tien treo, doanh thu nhap tay, doanh thu ca le.
- `REFUND_ISSUED`: giao dich hoan tien tu revenue.
- `EXPENSE_RECORDED`: chi phi da duoc phe duyet.
- `SALARY_PAID`: chi tra luong KTV gan voi salary record.
- `INVENTORY_CONSUMED`: vat tu bi tru khi hoan thanh ca.
- `SESSION_DONE`: ghi nhan doanh thu da thuc hien, doanh thu chua thuc hien, cong no va hoa hong khi hoan thanh buoi.

## Nguyen tac

- Noi tao nghiep vu chi truyen dau vao can thiet nhu `tenantId`, `revenueId`, `amount`, `bookingId`.
- Adapter tu gan `eventType`, `referenceType`, `referenceId`, `branchId` va cac truong payload bat buoc.
- Neu enqueue tra ve `false`, caller phai rollback va tra loi loi ro rang, khong duoc im lang.
- Worker xu ly outbox khong doi trong dot nay vi do la lop tieu thu su kien, khong phai lop tao payload.

## Diem cham code

- `src/lib/business-rules/accounting-outbox.ts`
- `src/modules/booking/actions/create-booking-helpers.ts`
- `src/modules/booking/actions/session-completion-helpers.ts`
- `src/services/reconciliation-actions.ts`
- `src/services/finance/transaction-mutations.ts`
- `src/services/inventory-actions.ts`
- `src/app/api/webhooks/payment/route.ts`

## Kiem thu

- `src/__tests__/business-rule-engines.test.ts` kiem tra shape cua cac event builders va assert khi enqueue fail.
- Cac test tich hop hien co cho booking, finance, inventory, webhook va reconciliation tiep tuc bao ve side effects va rollback.
