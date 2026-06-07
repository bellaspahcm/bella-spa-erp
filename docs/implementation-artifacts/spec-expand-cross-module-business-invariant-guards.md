# Expand Cross-Module Business Invariant Guards

## Muc tieu

Tang lop kiem tra du lieu sau khi van hanh de phat hien cac chuoi nghiep vu bi dut gay giua booking, payment, session, inventory, salary va accounting.

## Pham vi

- Bo sung nhom check `cross_module_side_effects` trong `scripts/check-business-invariants.cjs`.
- Kiem tra doanh thu goi da confirmed phai co dau vet `PACKAGE_SALE` outbox hoac but toan active.
- Kiem tra refund da confirmed phai co dau vet `REFUND_ISSUED`.
- Kiem tra ca da hoan thanh phai co `SESSION_DONE`.
- Kiem tra ca co tieu hao kho phai co `INVENTORY_CONSUMED`.
- Kiem tra booking `completed_sessions` phai khop so session log da completed.
- Kiem tra salary record da paid phai co `SALARY_PAID`.
- Canh bao outbox PENDING/PROCESSING qua 24 gio de tranh nghiep vu da ghi nhung chua vao so.

## Ket qua mong doi

- Neu portal/payment, booking progress, salary, inventory hoac accounting bi lech du lieu, script `npm run db:business:check` co the bao ro ma loi va bang lien quan.
- Cac warning khong chan mac dinh, nhung critical se lam check fail.

## Kiem thu

- `src/__tests__/business-invariants-check.test.ts` bao gom dataset tot, dataset thieu side-effect va outbox pending qua lau.
