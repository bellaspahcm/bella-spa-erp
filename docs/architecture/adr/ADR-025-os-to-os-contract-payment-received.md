# ADR-025: OS-to-OS Contract: `IPaymentReceived` v1 (Beauty OS → Finance OS)

## Status
LOCKED — APPROVED BY ARCHITECT

## Context
Under the **Finance OS Inheritance Constitution** (§10 and §14), direct database writes from Product Verticals (such as Beauty OS) into Finance OS tables are strictly prohibited. Inter-OS integration must go through public versioned contracts or public events.
Beauty OS needs to record cash payments received from salon/spa bookings, triggering both accounting ledger representation and cash-position updating.

## Decision
1. **F1-First Enforced:** Beauty OS must not call F2 Cash Engine directly. All booking payments must first be logged in F1 Ledger to establish the authoritative accrual truth.
2. **Public Event Contract:** Beauty OS publishes the `finance.payment.received.v1` event upon receiving booking payments.
3. **Consumer Path:**
   - **F1 Ledger Engine** consumes `finance.payment.received.v1`.
   - F1 validates the payload and invokes `postTransaction()` to commit the double-entry accounting record (Debit Cash Account `'1111'` / Credit Revenue Account `'5111'`).
   - Posting the F1 transaction writes a `finance.transaction.posted.v2` event to the outbox.
   - **F2 Cash Projection Worker** consumes the `posted.v2` outbox event to project the cash inflow to F2 bank accounts and positions.
4. **Contract Payload Structure (`IPaymentReceived` v1):**
   ```typescript
   export interface IPaymentReceivedV1 {
     tenant_id: string;
     booking_id: string;
     amount_minor: string;
     currency: string;
     payment_method: 'cash' | 'bank_transfer' | 'card' | string;
     received_at: Date;
   }
   ```

## Consequences
- Beauty OS remains decoupled from Finance database internals.
- Enforces the single financial truth invariant: F2 remains a downstream projection of F1, with no side-load insertions.
- Consistent auditing across all verticals (Healthcare, Education, and Beauty use the same F1-First posting pattern).
