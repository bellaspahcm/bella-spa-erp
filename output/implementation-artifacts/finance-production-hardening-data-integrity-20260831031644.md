# Finance Production Hardening Data Integrity Audit

Generated at: 2026-08-31T03:16:44.835Z
Environment host: db.lvnvkpyxtuilhrabtlwv.supabase.co

## Summary

- Total checks: 15
- PASS: 10
- WARN: 5
- FAIL: 0
- SKIPPED: 0
- Green: true

## Checks

### DI-001 — PASS

Category: Orphan GL
Severity: P0
Description: F1 transaction lines must always have a same-tenant transaction header.
Rows: 0

### DI-002 — PASS

Category: Orphan GL
Severity: P0
Description: Posted F1 transactions must have at least one line.
Rows: 0

### DI-003 — PASS

Category: Double Entry
Severity: P0
Description: Posted F1 transactions must balance on functional debit and credit amounts.
Rows: 0

### DI-004 — WARN

Category: Orphan Financial Facts
Severity: P0
Description: F2 cash movements must reference an existing same-tenant F1 transaction.
Rows: 9

Sample:

```json
[
  {
    "tenant_id": "39ca66f4-cbf5-470f-85cb-a6f77ba71f35",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "00d959ba-2863-470a-90b9-9af90a6bc98e",
    "f1_transaction_id": "2c880616-b6f0-47f8-a4cd-e2e60499066f"
  },
  {
    "tenant_id": "db6a900a-eb73-4ead-87fb-2a4c80c3a925",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "cf50a680-12ee-4b6e-849d-1b6b56260e9a",
    "f1_transaction_id": "9592c1d1-38c2-49f2-a922-96676a561ef6"
  },
  {
    "tenant_id": "1de94773-2f55-46a3-8d29-08fd7fb3c70a",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "0bdbf3f9-fb87-48bb-91e8-23d4eea2d8ba",
    "f1_transaction_id": "85b2d9d1-e892-4c5f-91c9-5c69b55fd441"
  },
  {
    "tenant_id": "4af1983e-0d92-44d5-831f-51a0886a2f9e",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "3a11ebaf-508d-41c8-a512-c70ed64efb67",
    "f1_transaction_id": "c1096d3d-44fd-453a-9426-d5a10e610278"
  },
  {
    "tenant_id": "381aa0c5-c48c-42ce-9ec7-226580c50413",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "5fbef071-dd6c-4769-814a-59b526dc3a61",
    "f1_transaction_id": "2933ba29-39f3-41fa-9494-bc1bad15fd2c"
  },
  {
    "tenant_id": "64fb008e-853f-4cde-9c26-75a1f1300a9a",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "1b8d2d96-e55a-42db-9e3f-7617b6c6fd47",
    "f1_transaction_id": "f79e9d7b-1444-4c89-acde-cfddfbd13003"
  },
  {
    "tenant_id": "038c2206-bffe-4f79-9a3d-570bd08a1452",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "3b50df83-32ac-4535-9a30-2212e6782688",
    "f1_transaction_id": "02726076-ebf1-42dc-9db0-b32ce8d96094"
  },
  {
    "tenant_id": "14a5809f-9690-45a8-828d-608f2cb85e36",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "fd10021f-434d-480e-87db-86a4f6040e5e",
    "f1_transaction_id": "ddecf32d-c978-473b-9143-2ff10014510f"
  },
  {
    "tenant_id": "62f0b09b-587a-453b-bc58-42d0280f0cdc",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "cash_movement_id": "e591a232-4a51-486f-9ea7-5dcf5be52154",
    "f1_transaction_id": "b67bb4f0-bcc0-49d8-baa6-50520ba7119f"
  }
]
```

### DI-005 — PASS

Category: Orphan Financial Facts
Severity: P0
Description: F4 payable ledger rows must reference an existing same-tenant F1 transaction.
Rows: 0

### DI-006 — WARN

Category: Orphan Financial Facts
Severity: P0
Description: F4 vendor prepayment facts must reference an existing same-tenant F1 transaction.
Rows: 24

Sample:

```json
[
  {
    "tenant_id": "c2e692a9-4215-4fc0-b35e-bb4011bf4d2d",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "fc332aa2-7d50-41df-80be-a16d75cef8d0",
    "f1_transaction_id": "4de9a77c-2921-4b23-9e9a-dadb2a66fc29"
  },
  {
    "tenant_id": "f0652160-828e-4562-995e-e72cce717e6c",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "c3f73de1-043f-46d8-a7d4-36ce56c286b6",
    "f1_transaction_id": "a3fd8df5-8d60-4c27-ba15-b91088972a16"
  },
  {
    "tenant_id": "85285ae4-3bd8-459f-846e-de5346bc73cd",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "9d3a1907-a62d-4a9d-82d6-27d40ddbc5c9",
    "f1_transaction_id": "608f9109-b287-474a-857f-c287d3da40c2"
  },
  {
    "tenant_id": "10613ae3-c923-46ba-9445-f47af353ccfc",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "504520b0-6dc0-448f-a0f0-2b1d403b1d4c",
    "f1_transaction_id": "d133f757-f161-4bff-a3eb-619bb545ea47"
  },
  {
    "tenant_id": "1390f4fe-6b9c-48e1-b877-bf512d1fa0e5",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "dbfb7135-3e07-46f8-958f-7c78b57032a1",
    "f1_transaction_id": "c028120b-4840-41c1-aa3d-0d4c84a4b5ef"
  },
  {
    "tenant_id": "9b510b42-fcdc-4318-954a-a610aff8da03",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "11022a39-e2b6-4b56-a788-6e6ea51d07cc",
    "f1_transaction_id": "618c66e2-451c-4074-af66-6ea52b616fb6"
  },
  {
    "tenant_id": "60b323f6-9b02-4b00-afb9-56dea19569a1",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "48c91608-673c-402f-a8e3-6011b6d77c43",
    "f1_transaction_id": "5e5a8a94-fe83-4825-a8c2-58a4eb665781"
  },
  {
    "tenant_id": "51e52db3-ef5c-4f24-8ecf-731ff9159c51",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "a3bf0814-3c1c-4c96-ad37-92b14195f8e2",
    "f1_transaction_id": "f8a38fe6-d9e5-4dbd-b5ec-ffcd920ec367"
  },
  {
    "tenant_id": "fef076ef-0233-4013-bedd-2f1c32380291",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "1d63f641-cd91-4e70-aec7-1a78258d5145",
    "f1_transaction_id": "907636a5-69bb-471e-a387-72e83211fabf"
  },
  {
    "tenant_id": "4f7ee4cb-3ee9-4252-869c-baae51aa0fba",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "prepayment_fact_id": "ffc64460-4bff-45c6-8dcf-62a773ddadca",
    "f1_transaction_id": "55810758-af64-472a-a43d-b6b2acee1af0"
  }
]
```

### DI-007 — PASS

Category: FX / Source Currency
Severity: P1
Description: F1 line currencies should be internally consistent with their transaction functional currency.
Rows: 0

### DI-008 — PASS

Category: FX / Source Currency
Severity: P1
Description: Same-currency transactions should use identity FX semantics.
Rows: 0

### DI-009 — PASS

Category: FX / Source Currency
Severity: P1
Description: F2 cash movement functional amount should equal amount * valuation_rate within rounding tolerance.
Rows: 0

### DI-010 — PASS

Category: Duplicate Effect
Severity: P0
Description: F1 idempotency keys must be unique per tenant.
Rows: 0

### DI-011 — WARN

Category: Duplicate Effect
Severity: P1
Description: Posted transactions with the same source identity may represent duplicate business effects unless they are intentional reversals.
Rows: 50

Sample:

```json
[
  {
    "tenant_id": "2c10157f-7625-4af0-8b15-44c4333bd1ca",
    "tenant_name": "F2-CONC-MTFBF0G6",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "d3b5d739-fe38-4aa4-934c-a9c20955bf1e",
    "tenant_name": "F2-CONC-MSV2Q7YI",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "65bc410a-8e0d-43f3-b374-a8772630270e",
    "tenant_name": "F2-CONC-MSUZWX52",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "c027078e-13d6-4d56-a54e-c83e9b6ae4d6",
    "tenant_name": "F2-CONC-MT6XXYD7",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "6d4cc796-5f79-48ab-beaa-e2356b3b49e4",
    "tenant_name": "F2-CONC-MTDNGDGK",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "d6ae8159-5961-45a1-990c-061dc21fe094",
    "tenant_name": "F2-CONC-MTDMXG3I",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "641e278f-1448-4a85-9228-01edccb078a2",
    "tenant_name": "F2-CONC-MTF9SGQH",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "d41198f6-df50-4f1f-81e7-c81c2293c308",
    "tenant_name": "F2-CONC-MT4HHWQA",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "a3567879-cc45-4ef6-a4d5-44d2087a0e87",
    "tenant_name": "F2-CONC-MSVEUOBQ",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  },
  {
    "tenant_id": "85fa8b76-df1b-4aaf-8ae3-1e2d6430a0cf",
    "tenant_name": "F2-CONC-MTDWDVKB",
    "tenant_status": "active",
    "production_risk": false,
    "source_type": "SALES_ORDER",
    "source_id": "so-conc-test",
    "posted_count": 22,
    "reversal_count": 0
  }
]
```

### DI-012 — WARN

Category: Document-Date Provenance
Severity: P1
Description: F1 transactions should carry document_date provenance.
Rows: 50

Sample:

```json
[
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "560ebcfc-496c-413e-934a-9f45daf298b9",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "3a2d178c-eae3-4dd0-809c-27c3a5e9c576",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "be28eed9-9700-490d-bee9-048c08280f89",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868931",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "ddc64cfc-46bb-40bf-8a73-a0b4611bd390",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "20746815-4724-4560-aed7-ce4f82b6bc41",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "ca65eba7-4a2b-4ff2-8135-0bc77beb3d58",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "82cbf082-b9b2-492a-bc21-3e47dae10c94",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "0ec0b8b0-429f-419f-b64c-4a881e9a96c3",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "02b7eb46-d47d-4490-81f7-778c709a6460",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  },
  {
    "tenant_id": "4918a808-636a-45bd-8690-2f64eab57cd4",
    "tenant_name": "F1-Concurrency-MSUZXU99",
    "tenant_status": "active",
    "production_risk": false,
    "transaction_id": "3e511fc4-b508-4a4f-bd4d-6d106c4096d1",
    "source_type": "CONCURRENCY_TEST",
    "source_id": "conc-1786835868932",
    "posted_at": "2026-11-15T12:00:00.000Z"
  }
]
```

### DI-013 — PASS

Category: Document-Date Provenance
Severity: P1
Description: Vendor bill F1 transaction document_date should match the bill date.
Rows: 0

### DI-014 — WARN

Category: Document-Date Provenance
Severity: P1
Description: Invoice F1 transaction document_date should match the invoice issue date.
Rows: 50

Sample:

```json
[
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "7fddabec-b25b-4e24-9269-e6ef2f70c53a",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "04b309a3-67ff-4ee8-bdb0-3f206dc087fe",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "04dbfa5a-ff0c-4c37-bb7c-63425f25cdcc",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "af675957-cc52-453a-b756-679790042ab1",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "50abf76c-986e-4ca7-ad80-478b81316bd5",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "1f1f0683-5e04-4253-8986-e71fd5710ebe",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "6d254c3b-2871-40b8-a819-48069643fb2c",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "93cf356a-b2c8-4765-88c5-3fc218970219",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "1c4f807b-230d-4510-829f-2045b344e3b5",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  },
  {
    "tenant_id": "de6b89b2-5731-43da-9055-6567cf80c50b",
    "tenant_name": "F3-ALLOC-MSUZWBCC",
    "tenant_status": "active",
    "production_risk": false,
    "invoice_id": "22680232-107c-4c45-bf98-545cd8114e63",
    "issue_date": "2026-08-14T17:00:00.000Z",
    "document_date": null
  }
]
```

### DI-015 — PASS

Category: Historical Evidence
Severity: INFO
Description: Retained test evidence tenants should stay explicitly marked so they are not confused with production data.
Rows: 0
