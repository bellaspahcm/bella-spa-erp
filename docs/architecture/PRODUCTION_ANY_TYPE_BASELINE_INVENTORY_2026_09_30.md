# Production Any-Type Baseline Inventory

Date: 2026-09-30
Status: INVENTORY ONLY / NO CODE FIXES

## Scope

This inventory uses the same broad-type detector and production file scope as `src/__tests__/invariants/production-runtime-integrity.test.ts`. It does not include `next.config.ts` and does not change production code.

```text
Production files scanned: 1620
Violations:               93
Files affected:           37
```

## Classification Summary

| classification | count |
|---|---:|
| D. Supabase/generated contract | 28 |
| F. Frozen Logistics / domain-contract boundary | 18 |
| A. Type-local catch narrowing | 14 |
| F. Frozen Logistics / dynamic rules contract | 11 |
| D. Supabase/RPC/generated contract | 9 |
| C. JSON / dynamic payload | 5 |
| A. Type-local UI union narrowing | 3 |
| E. Platform/Core-adjacent Finance contract | 2 |
| A. Type-local / scanner-noise comment | 1 |
| A. Type-local exhaustive narrowing | 1 |
| B. Test/runtime boundary in production scope | 1 |

## Layer Summary

| layer | count |
|---|---:|
| platform/logistics | 30 |
| app-ui/education | 15 |
| app/api | 12 |
| platform/real-estate | 10 |
| app-ui/real-estate | 8 |
| platform/integration-runtime | 8 |
| platform/integration-hub | 7 |
| platform/finance | 2 |
| lib/decision-engine | 1 |

## Risk Summary

| risk | count |
|---|---:|
| Medium | 38 |
| High | 31 |
| Low-Medium | 18 |
| Medium-High | 5 |
| Low | 1 |

## Inventory

| file | line | pattern | layer | owner | risk | classification | recommended action |
|---|---:|---|---|---|---|---|---|
| src/app/api/admin/partner-applications/[id]/approve/route.ts | 98 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/approve/route.ts | 106 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/approve/route.ts | 109 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/approve/route.ts | 121 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/approve/route.ts | 131 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/reject/route.ts | 93 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/reject/route.ts | 102 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/reject/route.ts | 105 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/reject/route.ts | 117 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/admin/partner-applications/[id]/reject/route.ts | 127 | as any | app/api | Partner Admin API | Medium | D. Supabase/generated contract | Check whether partner tables exist in generated Database; likely contract gap if missing. |
| src/app/api/education/analytics/route.ts | 26 | : any | app/api | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local error normalizer; low runtime risk. |
| src/app/api/education/care/medication/route.ts | 35 | : any | app/api | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local error normalizer; low runtime risk. |
| src/app/dashboard/education/facilities/page.tsx | 120 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/facilities/page.tsx | 191 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/facilities/page.tsx | 237 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/facilities/page.tsx | 258 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/facilities/page.tsx | 288 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/facilities/page.tsx | 319 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/learning/page.tsx | 309 | as any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local UI union narrowing | Derive literal union from tab/options or add typed handler; no data contract change if local. |
| src/app/dashboard/education/learning/page.tsx | 322 | as any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local UI union narrowing | Derive literal union from tab/options or add typed handler; no data contract change if local. |
| src/app/dashboard/education/scheduling/page.tsx | 129 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/scheduling/page.tsx | 218 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/scheduling/page.tsx | 240 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/scheduling/page.tsx | 265 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/scheduling/page.tsx | 293 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/scheduling/page.tsx | 314 | : any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local catch narrowing | Replace catch annotation with unknown and local message extraction; UI-only. |
| src/app/dashboard/education/scheduling/page.tsx | 605 | as any | app-ui/education | Education Product/UI | Low-Medium | A. Type-local UI union narrowing | Derive literal union from tab/options or add typed handler; no data contract change if local. |
| src/app/dashboard/real-estate/apartments/page.tsx | 561 | : any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/contracts/page.tsx | 587 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/customers/page.tsx | 1011 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/documents/page.tsx | 1181 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/leads/page.tsx | 467 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/marketing/page.tsx | 930 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/marketing/page.tsx | 1020 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/app/dashboard/real-estate/reports/page.tsx | 257 | as any | app-ui/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/lib/decision-engine/providers/payroll/payroll-provider.ts | 836 | as any | lib/decision-engine | Decision Engine | Medium | A. Type-local exhaustive narrowing | Use discriminated-union exhaustive helper; verify provider tests. |
| src/platform/finance/resolvers/kernel-client.service.ts | 73 | : any | platform/finance | Finance OS | High | E. Platform/Core-adjacent Finance contract | DEFER to Finance contract triage; do not invent Kernel request DTO. |
| src/platform/finance/resolvers/kernel-client.service.ts | 132 | Promise<any> + <any> | platform/finance | Finance OS | High | E. Platform/Core-adjacent Finance contract | DEFER to Finance contract triage; do not invent Kernel request DTO. |
| src/platform/integration-hub/finance-outbox-replay.ts | 100 | : any | platform/integration-hub | Integration Hub | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-hub/finance-outbox-replay.ts | 149 | : any | platform/integration-hub | Integration Hub | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-hub/finance-outbox-worker-test.ts | 99 | Promise<any> + <any> + : any | platform/integration-hub | Integration Hub | Low-Medium | B. Test/runtime boundary in production scope | Rename/move or type local harness; verify whether file should be excluded or renamed as .test.ts. |
| src/platform/integration-hub/finance-outbox-worker.ts | 265 | : any | platform/integration-hub | Integration Hub | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-hub/finance-outbox-writer.ts | 156 | as any | platform/integration-hub | Integration Hub | Medium-High | C. JSON / dynamic payload | Replace with canonical Json/outbox payload type only if already owned by Integration Hub. |
| src/platform/integration-hub/types/outbox.types.ts | 13 | Record<string, any> | platform/integration-hub | Integration Hub | Medium-High | C. JSON / dynamic payload | Replace with canonical Json/outbox payload type only if already owned by Integration Hub. |
| src/platform/integration-hub/types/outbox.types.ts | 85 | Record<string, any> | platform/integration-hub | Integration Hub | Medium-High | C. JSON / dynamic payload | Replace with canonical Json/outbox payload type only if already owned by Integration Hub. |
| src/platform/integration-runtime/database/audit-repository.ts | 318 | : any | platform/integration-runtime | Integration Runtime | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-runtime/database/idempotency-repository.ts | 80 | as any | platform/integration-runtime | Integration Runtime | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-runtime/database/idempotency-repository.ts | 248 | : any | platform/integration-runtime | Integration Runtime | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-runtime/database/outbox-repository.ts | 42 | as any | platform/integration-runtime | Integration Runtime | Medium-High | C. JSON / dynamic payload | Use Json/structured payload contract if canonical; otherwise DEFER as payload contract gap. |
| src/platform/integration-runtime/database/outbox-repository.ts | 430 | : any | platform/integration-runtime | Integration Runtime | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-runtime/database/quarantine-repository.ts | 46 | as any | platform/integration-runtime | Integration Runtime | Medium-High | C. JSON / dynamic payload | Use Json/structured payload contract if canonical; otherwise DEFER as payload contract gap. |
| src/platform/integration-runtime/database/quarantine-repository.ts | 297 | : any | platform/integration-runtime | Integration Runtime | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/integration-runtime/database/tenant-repository.ts | 199 | : any | platform/integration-runtime | Integration Runtime | Medium | D. Supabase/RPC/generated contract | Inventory DB row/query contract; fix with generated row type or typed adapter if proven. |
| src/platform/logistics/contracts/freight-audit.contract.ts | 441 | : any | platform/logistics | Logistics OS | Low | A. Type-local / scanner-noise comment | Rename comment wording; no runtime change. |
| src/platform/logistics/domain/rules/compliance.evaluation.ts | 31 | <any> | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/compliance.evaluation.ts | 37 | Record<string, any> | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/compliance.evaluation.ts | 219 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.composition.ts | 49 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.composition.ts | 138 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.helpers.ts | 105 | Record<string, any> | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.helpers.ts | 106 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.helpers.ts | 107 | Record<string, any> | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.types.ts | 110 | Record<string, any> | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.types.ts | 113 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/domain/rules/rule.types.ts | 116 | Record<string, any> | platform/logistics | Logistics OS | High | F. Frozen Logistics / dynamic rules contract | DEFER for Logistics governance; needs canonical rule value type, not local cast. |
| src/platform/logistics/engines/freight-audit-engine.ts | 821 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/engines/freight-audit-engine.ts | 824 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/engines/freight-audit-engine.ts | 829 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/engines/freight-audit-engine.ts | 1295 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/engines/freight-audit-engine.ts | 2463 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/repositories/movement.repository.ts | 176 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/repositories/movement.repository.ts | 240 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/repositories/movement.repository.ts | 255 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1038 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1061 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1062 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1209 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1323 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1401 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1666 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1744 | as any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1778 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/logistics/warehouse/receipt.service.ts | 1887 | : any | platform/logistics | Logistics OS | High | F. Frozen Logistics / domain-contract boundary | DEFER for Logistics OS triage; only typed mapper/status enum fixes after contract proof. |
| src/platform/real-estate/engines/property.service.ts | 42 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/engines/property.service.ts | 62 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/engines/property.service.ts | 75 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/engines/property.service.ts | 101 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/engines/reservation.service.ts | 54 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/engines/reservation.service.ts | 91 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/repositories/property-unit.repository.ts | 93 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/repositories/property-unit.repository.ts | 96 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/repositories/property-unit.repository.ts | 144 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |
| src/platform/real-estate/repositories/property-unit.repository.ts | 147 | as any | platform/real-estate | Real Estate OS/Product | Medium | D. Supabase/generated contract | Check generated table/enum types; likely typed mapper batch after source-of-truth proof. |

## Stop Rules

```text
No Batch 21
No production fixes from this inventory
No next.config.ts change
No suppression
No fake contract
Frozen Logistics remains DEFER unless separately authorized
```
