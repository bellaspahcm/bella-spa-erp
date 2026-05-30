# Migration Catalog & Apply Order

> Tài liệu này ghi nhận thứ tự apply migrations, đặc biệt cho các file **trùng timestamp prefix**.
>
> ⚠️ **KHÔNG RENAME** các file đã apply vào production — Supabase track migration theo `name` trong `supabase_migrations.schema_migrations`. Đổi tên = file mới = re-apply (có thể fail hoặc gây drift).
>
> Quy tắc mới (từ 2026-05-28): mọi migration mới **phải** dùng timestamp đến giây (`YYYYMMDDhhmmss`) và unique.

## Quy ước đặt tên

```
YYYYMMDDhhmmss_<verb>_<subject>.sql
```

- `YYYY` `MM` `DD` — UTC
- `hh` `mm` `ss` — bắt buộc đến giây, không được trùng với migration nào khác
- `verb` — `add`, `fix`, `drop`, `create`, `enable`, `disable`, `harden`, `seed`, `grant`
- `subject` — entity hoặc feature (`bookings`, `rls_security`, `coa`...)

Ví dụ đúng: `20260528103045_add_qstash_outbox.sql`

Ví dụ sai (đã có 3 file trùng prefix): `20260526040000_xxx.sql`

## Các file trùng prefix lịch sử (apply alphabetically)

Supabase CLI sort migration theo **filename string** (alphabetical sau prefix). Khi prefix trùng, thứ tự apply là alphabet của phần `_<name>.sql`.

### `20260514000000` — Initial schema follow-ups (alphabetical apply)

| Order | File | Mục đích |
|------:|------|---------|
| 1 | `20260514000000_add_gender_baby.sql` | Thêm cột giới tính cho hồ sơ bé |
| 2 | `20260514000000_audit_logs.sql` | Tạo bảng `audit_logs` lần đầu |

### `20260521000001` — RLS hardening day 1

| Order | File | Mục đích |
|------:|------|---------|
| 1 | `20260521000001_add_gps_to_session_logs.sql` | Cột GPS lat/lng cho check-in |
| 2 | `20260521000001_fix_rls_security.sql` | Vá lỗi RLS recursion + permissive policy |

### `20260523020000` — Revenue + auth RPC

| Order | File | Mục đích |
|------:|------|---------|
| 1 | `20260523020000_add_receipt_url_to_revenue.sql` | Cột `receipt_url` cho biên lai |
| 2 | `20260523020000_get_user_by_email_rpc.sql` | RPC tra cứu user theo email (admin) |

### `20260526040000` — Salary reconciliation + attendance fix

| Order | File | Mục đích |
|------:|------|---------|
| 1 | `20260526040000_fix_attendance_logic.sql` | Sửa logic chấm công auto-deduct |
| 2 | `20260526040000_salary_reconciliation.sql` | Engine đối chiếu legacy ↔ AI |
| 3 | `20260526040000_salary_reconciliation_report.sql` | RPC `get_salary_reconciliation` |

## Cảnh báo bảo trì

1. **Không sửa migration đã merge** — viết migration mới override thay vì sửa file cũ.
2. **Migration phải idempotent khi có thể** — dùng `IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY`, etc.
3. **No-op migration là chấp nhận được** — nếu đã hotfix trực tiếp trên production, tạo file no-op (`SELECT 1;`) để giữ schema_migrations table khớp với checkpoint local.

## Lịch sử các đợt refactor lớn

| Migration | Ý nghĩa |
|---|---|
| `20260515010000_the_great_purge.sql` | Dọn schema cũ trước khi standardize phase 1 |
| `20260520000006_enable_core_rls.sql` | Bật RLS lần đầu cho bảng core |
| `20260523010000_harden_all_database_rls.sql` | Hardening RLS toàn bộ tables |
| `20260524000000_accounting_core.sql` | Khai sinh accounting module (COA, journals, periods) |
| `20260525130000_accounting_outbox.sql` | Outbox pattern cho event-driven accounting |
| `20260525170000_period_closing_workflow.sql` | Workflow lock-month 3 bước |
| `20260526000000_ai_agent_infrastructure.sql` | Khai sinh AI COO + sub-agents |
| `20260526050000_dual_mode_accounting.sql` | Dual-mode SIMPLE/PROFESSIONAL |
| `20260531010000_atomic_legacy_ledger_sync.sql` | RPC atomic cho sync legacy sang so cai va bat Professional |
| `20260531020000_add_legacy_ledger_sync_preview.sql` | RPC dry-run preview truoc khi sync legacy sang so cai |
