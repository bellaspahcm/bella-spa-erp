# ADR-023: Finance OS Observability Integration Standard

## Status
LOCKED — APPROVED BY ARCHITECT

## Context
Under the **Finance OS Inheritance Constitution** (§3.1 and §18), Finance OS is a domain authority and must not construct a parallel observability, metrics, or telemetry infrastructure. It must inherit and extend the primitives provided by Bella Core.
Before exposing public reporting APIs in Phase F2.3, we must define the standard for tracing, performance logging, and error containment in all cash and ledger operations.

## Decision
1. **Inherit TelemetryTracer:** Finance OS will use the canonical `TelemetryTracer` (`src/platform/security/telemetry-tracer.ts`) for tracing execution duration, query counts, and transaction success.
2. **Namespace Convention:** Trace operations in Finance OS must follow the format `finance.<engine>.<operation>` (e.g., `finance.cash.get_cash_position`, `finance.cash.get_runway`).
3. **Telemetry Error Isolation:** Following the *Production Failure Containment Law 7*, any failure inside the metrics system or telemetry reporter must be isolated. It must log a warning but never crash the active domain transaction (preventing system downtime due to telemetry failure).
4. **Internal Event Logging:** TelemetryTracer remains the technical performance boundary. Business audits or security alerts (such as Case 3 quarantine signals) write structured messages to standard error with the `[SECURITY_AUDIT_SIGNAL]` prefix for collection by the platform collector.

## Consequences
- Zero duplication of metrics/logging collectors.
- Complete performance tracing coverage for F2.3 read APIs.
- Production transactions are immune to telemetry server outages.
