/**
 * Common Integration Runtime
 * 
 * Platform capability for Industry OS → Finance OS integration
 * 
 * Version: 1.0.0 (IMPLEMENTATION IN PROGRESS)
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 * 
 * CRITICAL BOUNDARIES:
 * - Runtime = Reliability + Isolation + Observability
 * - Runtime ≠ Accounting authority
 * - Runtime ≠ Business logic
 * - Runtime ≠ Policy engine
 * 
 * Phase 1 — Foundation (COMPLETE):
 * - ✅ Financial Intent types
 * - ✅ Runtime configuration types
 * - ✅ Runtime error types
 * - ✅ Intent validator
 * - ✅ Tenant validator
 * - ✅ Idempotency key derivation
 * - ✅ Idempotency registry
 * - ✅ Idempotency manager
 * 
 * Phase 2 — Database (COMPLETE):
 * - ✅ Database schema (5 tables)
 * - ✅ Tenant repository
 * - ✅ Idempotency repository
 * - ✅ Outbox repository
 * - ✅ Audit repository
 * - ✅ Quarantine repository
 * 
 * Phase 3 — Enforcement (PENDING):
 * - ⏳ Runtime validation (prohibited fields)
 * - ⏳ Finance Protection tests
 * 
 * Phase 4 — Reliability (PENDING):
 * - ⏳ Outbox writer
 * - ⏳ Outbox worker
 * - ⏳ Retry manager
 * - ⏳ Quarantine manager
 * - ⏳ Finance publisher
 * 
 * Phase 5 — Observability (PENDING):
 * - ⏳ Correlation manager
 * - ⏳ Audit logger
 * - ⏳ Tracer
 * 
 * Verification (PENDING):
 * - ⏳ 9 test suites
 * - ⏳ Production Readiness Gate
 */

export * from './types';
export * from './validation';
export * from './idempotency';
export * from './database';
