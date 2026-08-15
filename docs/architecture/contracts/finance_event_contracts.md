# Finance OS Domain Event Contracts Registry

This registry defines the authoritative schemas, versioning semantics, and compatibility windows for public domain events emitted by Finance OS. 

All platform modules and consumer systems (e.g. Healthcare OS, Beauty OS, and Cash Projection Worker) MUST strictly adhere to these versioned contracts.

---

## 🔒 Versioning & Compatibility Policy

1.  **Strict Additive Compatibility:** Upgrades to event payloads MUST be additive. Field deprecation or removal requires a major version increment (e.g. from `.v2` to `.v3`) and a formal ADR change control window.
2.  **Legacy Coexistence:** To guarantee backward compatibility during transitions, the F1 Ledger Engine will emit both legacy `.v1` and canonical `.v2` events atomically in the same database transaction.
3.  **Audit Log of Compatibility:** A grep audit conducted on 2026-08-15 confirms:
    - **`finance.transaction.posted.v1`**: 0 active production consumers (only integration tests).
    - **`finance.transaction.reversed.v1`**: 0 active production consumers.
    - **Decision:** v1 remains emitted solely for legacy test suite compatibility, and will be deprecated in Phase F3. The Cash Projection Worker (F2.2) subscribes **exclusively** to the `.v2` canonical contracts.

---

## ✉️ Contract Registry

### 1. `finance.transaction.posted.v2`

Emitted atomically when an F1 ledger transaction transitions to the `POSTED` state.

- **Event Name:** `finance.transaction.posted.v2`
- **Delivery Mode:** At-least-once outbox dispatcher delivery.
- **Payload Schema:**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FinanceTransactionPostedV2",
  "type": "object",
  "required": [
    "event_id",
    "event_type",
    "event_version",
    "tenant_id",
    "transaction_id",
    "transaction_type",
    "posted_at",
    "candidate_cash_legs"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "format": "uuid",
      "description": "Authoritative UUID for event deduplication."
    },
    "event_type": {
      "type": "string",
      "const": "finance.transaction.posted.v2"
    },
    "event_version": {
      "type": "string",
      "const": "2.0"
    },
    "tenant_id": {
      "type": "string",
      "format": "uuid",
      "description": "Canonical tenant owner identity."
    },
    "transaction_id": {
      "type": "string",
      "format": "uuid",
      "description": "F1 ledger transaction identifier."
    },
    "transaction_type": {
      "type": "string",
      "enum": ["CASH", "ACCRUAL", "ADJUSTMENT", "CLOSING", "REVERSAL"],
      "description": "Accounting category of the transaction."
    },
    "posted_at": {
      "type": "string",
      "format": "date-time",
      "description": "Authority date-time the ledger hạch toán was posted."
    },
    "source_type": {
      "type": "string",
      "description": "Origin vertical name (e.g. spa.booking, health.consultation)."
    },
    "source_id": {
      "type": "string",
      "description": "Source business document entity ID."
    },
    "candidate_cash_legs": {
      "type": "array",
      "description": "F1 ASSET-type ledger lines eligible for F2 cash classification. Does not represent authoritative cash facts until mapped by F2.",
      "items": {
        "type": "object",
        "required": [
          "account_id",
          "account_code",
          "direction",
          "amount_minor",
          "currency",
          "functional_amount_minor",
          "functional_currency",
          "exchange_rate"
        ],
        "properties": {
          "account_id": {
            "type": "string",
            "format": "uuid"
          },
          "account_code": {
            "type": "string"
          },
          "direction": {
            "type": "string",
            "enum": ["INFLOW", "OUTFLOW"],
            "description": "Mapped from F1 entry: Debit = INFLOW, Credit = OUTFLOW."
          },
          "amount_minor": {
            "type": "number",
            "description": "Absolute value of the transaction line in minor units."
          },
          "currency": {
            "type": "string"
          },
          "functional_amount_minor": {
            "type": "number"
          },
          "functional_currency": {
            "type": "string"
          },
          "exchange_rate": {
            "type": "number"
          }
        }
      }
    }
  }
}
```

---

### 2. `finance.transaction.reversed.v2`

Emitted atomically when an F1 transaction is successfully reversed.

- **Event Name:** `finance.transaction.reversed.v2`
- **Delivery Mode:** At-least-once outbox dispatcher delivery.
- **Payload Schema:** Matches `finance.transaction.posted.v2` with the addition of `reversal_of_transaction_id`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FinanceTransactionReversedV2",
  "type": "object",
  "required": [
    "event_id",
    "event_type",
    "event_version",
    "tenant_id",
    "transaction_id",
    "transaction_type",
    "posted_at",
    "reversal_of_transaction_id",
    "candidate_cash_legs"
  ],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "event_type": { "type": "string", "const": "finance.transaction.reversed.v2" },
    "event_version": { "type": "string", "const": "2.0" },
    "tenant_id": { "type": "string", "format": "uuid" },
    "transaction_id": { "type": "string", "format": "uuid" },
    "transaction_type": { "type": "string", "const": "REVERSAL" },
    "posted_at": { "type": "string", "format": "date-time" },
    "reversal_of_transaction_id": {
      "type": "string",
      "format": "uuid",
      "description": "Identifier of the original F1 transaction being reversed."
    },
    "candidate_cash_legs": {
      "type": "array",
      "description": "Reversing candidate cash legs (lines of the reversal transaction).",
      "items": {
        "type": "object",
        "required": [
          "account_id",
          "account_code",
          "direction",
          "amount_minor",
          "currency",
          "functional_amount_minor",
          "functional_currency",
          "exchange_rate"
        ],
        "properties": {
          "account_id": { "type": "string", "format": "uuid" },
          "account_code": { "type": "string" },
          "direction": { "type": "string", "enum": ["INFLOW", "OUTFLOW"] },
          "amount_minor": { "type": "number" },
          "currency": { "type": "string" },
          "functional_amount_minor": { "type": "number" },
          "functional_currency": { "type": "string" },
          "exchange_rate": { "type": "number" }
        }
      }
    }
  }
}
```

---

## 🚫 Validation Bounds

The Cash Projection Worker and RPCs MUST validate the following:
1.  **No Financial Inference:** The worker MUST NOT infer missing currency, functional values, or exchange rates. Missing fields in the event contract trigger immediate quarantine.
2.  **Transitional Liquidity Abstraction:** The prefix `'11'` check is transitional and MUST be isolated within a single worker helper method (`classifyLiquidityAccount`).
