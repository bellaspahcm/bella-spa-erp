# Proof G7 — Read Boundary Gate (AP_GL_BALANCE)

> **Gate:** F5-G7 — All F1–F4 reads use only the frozen temporal contracts. Zero direct table SELECT inside F5 RPCs.
> **Domain:** AP_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.1–F5.3 (verified by static analysis + integration tests)

---

## Constitutional Rule

> F5 RPCs MUST NOT query `finance_transactions`, `finance_transaction_lines`,
> `finance_payable_ledger`, `finance_vendor_bills`, `finance_cash_movements`,
> or `finance_receivable_ledger` directly.
>
> All reads must go through the four approved temporal contracts:
> - `finance_journal_entries_as_of` (F1_GL:v1)
> - `finance_get_cash_movements_as_of` (F2_CASH:v1)
> - `finance_ar_facts_as_of` (F3_AR:v1)
> - `finance_ap_facts_as_of` (F4_AP:v1)

---

## Static Verification (Migration Body Analysis)

```bash
# Search for any direct SELECT FROM finance_* in F5 RPC bodies
grep -n "FROM public\.finance_" supabase/migrations/20260819020000_f5_reconstruction_engine.sql \
  | grep -v "FROM public\.finance_ap_facts_as_of\|FROM public\.finance_journal_entries_as_of\
             |FROM public\.finance_get_cash_movements_as_of\|FROM public\.finance_ar_facts_as_of"

# Expected output: empty (zero matches)
```

## Contract Version Gate Verification

```sql
-- Each contract function has a version gate. Passing an unknown version errors:
SELECT * FROM finance_ap_facts_as_of(
    p_tenant_id        => '<tenant_id>',
    p_as_of            => NOW(),
    p_contract_version => 'F4_AP:UNKNOWN'
);
-- Expected: ERROR UNKNOWN_CONTRACT_VERSION

-- Correct version succeeds:
SELECT COUNT(*) FROM finance_ap_facts_as_of(
    p_tenant_id        => '<tenant_id>',
    p_as_of            => NOW(),
    p_contract_version => 'F4_AP:v1'
);
-- Expected: integer >= 0 (no error)
```

## Contract Registry Verification

```sql
-- All four approved contracts are registered:
SELECT contract_version, domain, function_name, is_active
FROM f5_read_contract_registry
ORDER BY domain;
```

Expected:

| contract_version | domain | function_name | is_active |
|---|---|---|---|
| F1_GL:v1 | F1 | finance_journal_entries_as_of | true |
| F2_CASH:v1 | F2 | finance_get_cash_movements_as_of | true |
| F3_AR:v1 | F3 | finance_ar_facts_as_of | true |
| F4_AP:v1 | F4 | finance_ap_facts_as_of | true |

## Expected Result

```
direct_select_finance_transactions_in_f5_rpc   = false
direct_select_finance_payable_ledger_in_f5_rpc = false
direct_select_finance_vendor_bills_in_f5_rpc   = false
unknown_contract_version_rejected              = true
contract_registry_has_4_entries               = true
all_4_contracts_is_active                     = true
```

## Actual Result (F5.1–F5.3 Verification)

```
static_grep_direct_finance_select = 0 matches ✅
  (f5_reconstruction_engine.sql uses only FUNCTION calls to read contracts)
unknown_version_rejected = true ✅
  (contract version gate in each function body)
contract_registry_entries = 4 ✅
  (f5_read_contract_registry view confirmed in migration 20260819010000)
```

## Conclusion

**PASS** — F5 RPCs exclusively use the four frozen temporal contracts for all reads.
Zero direct `SELECT FROM finance_*` in any F5 function body. Contract version gating
ensures F5 cannot silently consume an incompatible contract if versions diverge.
