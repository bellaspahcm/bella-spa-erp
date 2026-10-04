# Bella English Center — Implementation Status

**Last Updated:** 2026-10-04
**Canonical authority:** `E2_E3_E4_GOVERNANCE_ACCEPTANCE.md`
**E5 seal baseline:** `origin/main@af28f1a0`
**E6 seal baseline:** `origin/main@a493ab88`
**E7 seal baseline:** `origin/main@364b624c`
**E8 seal baseline:** `origin/main@e4c085b0`
**E9 seal baseline:** `origin/main@19b57f09`
**E10 reconciliation baseline:** `origin/main@2105a81c`
**RC closure branch baseline:** `origin/main@4b213e74`
**RC closure merge baseline:** `origin/main@92da566a`
**Post-RC validation baseline:** `origin/main@391b0ec5`
**Post-RC validation merge baseline:** `origin/main@62074058`
**Field Verified RC baseline:** `origin/main@d4417cf8`
**Production Candidate readiness baseline:** `origin/main@d4417cf8`

---

## E2 / E3 / E4 Canonical Status

```text
E2 - Enrollment                  BOUNDED VERIFIED + SEALED
E3 - Program/Course/Class        BOUNDED VERIFIED + SEALED
E4 - Teacher/Workforce           BOUNDED VERIFIED + SEALED

E5 - Timetable/Room Scheduling   BOUNDED VERIFIED + SEALED

E6 - Attendance/Learning Ops      BOUNDED VERIFIED + SEALED

E7 - Tuition/Billing              BOUNDED VERIFIED + SEALED

E8 - Parent/Student Engagement    BOUNDED VERIFIED + SEALED

E9 - Chain Command Center         BOUNDED VERIFIED + SEALED

E10 - Product Reconciliation / RC RECONCILED / RC CLOSURE SEALED
```

The E2/E3/E4 seal is bounded to English Center evidence. It does not claim full
broader Education architecture compliance, full migration-history integrity, or
full root TypeScript compliance.

E5 is sealed after PR #94 merged to `main` under legitimate GitHub policy and
canonical main smoke passed on `origin/main@d7f6e4ac`.

E6 is sealed after PR #98 merged to `main` under legitimate GitHub policy and
canonical main smoke passed on `origin/main@a493ab88`.

E7 is sealed after PR #100 merged to `main` under legitimate GitHub policy and
canonical main smoke passed on `origin/main@364b624c`.

E8 is sealed after PR #102 merged to `main` under legitimate GitHub policy and
canonical main smoke passed on `origin/main@e4c085b0`.

E9 is sealed after PR #104 merged to `main` under legitimate GitHub policy and
canonical main smoke passed on `origin/main@19b57f09`.

E10 reconciliation is opened from canonical `origin/main@2105a81c`. Fresh gates
passed, but RC is held because E10 found missing full UI/API consumption
surfaces for E6-E9 and no full browser/live UI-to-DB smoke for the complete
E2-E9 chain.

RC Closure was opened from canonical `origin/main@4b213e74`, merged through
PR #107, and smoke-tested on canonical `origin/main@92da566a`. It implements
E6-E9 API/dashboard consumption surfaces and closes the E10 bounded RC hold.

Post-RC Validation was opened from canonical `origin/main@391b0ec5`, merged
through PR #109, and smoke-tested on canonical `origin/main@62074058`. It adds
dedicated browser and real-database validation gates and found a runtime
environment/schema proof gap in the Command Center path. This does not invalidate
the bounded RC; it holds Field Verified RC until the dedicated environment gates
pass.

Field Verified RC was reached after the runtime database, browser, and Command
Center API blockers were closed and revalidated on canonical `origin/main@d4417cf8`.
Production Candidate remains held pending deployment, rollback, backup/restore,
alerting, and production runtime evidence recorded in
`PRODUCTION_CANDIDATE_READINESS_REVIEW.md`.

Go-Live audit refresh on `origin/main@89e9c4b14` closed the E2/E3/E4 timeout
RCA as a test-harness/environment misclassification, not an English business
regression. The E2/E3/E4 service suites now fail fast with
`REAL_DB_ENV_REQUIRED` when Jest mock Supabase fallback values are present. With
the real `.env.test` Supabase environment loaded, the English Center regression
suite passed 10/10 suites and 74/74 tests, and the Post-RC real database
validation passed 1/1. This proves the current test database business chain for
E2-E4 plus the existing English Center regression surface; it does not yet lift
the production Go-Live hold because migration remote verification,
Education-wide gate scope classification, security advisory triage, and
production operations evidence remain separate gates.

Current Go-Live audit classification on `origin/main@89e9c4b14`:

```text
Typecheck                         PASS / zero diagnostics
English regression                PASS / real .env.test / 10 suites, 74 tests
E2/E3/E4 Real DB                  PASS / real .env.test / 3 suites, 26 tests
Post-RC Real DB validation        PASS / real .env.test / 1 suite, 1 test
Mock Supabase harness guard       PASS / REAL_DB_ENV_REQUIRED fail-fast

Migration remote verification     PARTIAL_REMEDIATED_ON_TEST_DB / STILL_FAIL_DRIFT
  Evidence: the migration checker false-green was fixed. On the test DB,
  20260912100000 and 20260912120000 were applied and repaired into remote
  migration history with schema read-back. The four canonical English
  history-only migrations 20260914120000, 20260914150000, 20260914170000, and
  20260914190000 were also repaired into test DB history after 14/14 E5-E8
  tables, RLS, and policies were read back. npm run db:migration:check now fails
  correctly on remaining non-English pending local migrations and malformed
  8-digit local migration ID defects.

Education-wide architecture gate  OUT_OF_SCOPE_FOR_ENGLISH_BLOCKER
  Evidence: scan of src/products/bella-education found direct DB/RPC usage
  under Preschool/Education-wide folders and 0 Bella English Center files.
  This remains Education governance debt, not English business regression.

Security audit                    PASS / PRODUCTION AUDIT
  Evidence: GHSA-vfj7-8cjw-p6xm was traced to the build/CSS tooling package
  shadcn -> fast-glob -> micromatch -> braces. Bella app/runtime source only
  imports shadcn/tailwind.css from src/app/globals.css; no service/API/runtime
  code imports shadcn, fast-glob, micromatch, braces, ts-morph, or
  @ts-morph/common. shadcn was moved from dependencies to devDependencies with
  no version bump or broad npm update. npm run security:audit now passes with
  only explicitly allowlisted xlsx advisories.

Production operations             NOT_PROVEN
  Evidence: deploy-production main runs remain old 2026-06 failures;
  deploy-staging has no returned runs; public health returns HTTP 200 with DB
  ok but reports environment=development; no current rollback, backup/restore,
  alert-delivery, English production smoke, or production runtime-env proof was
  found for origin/main@89e9c4b14. The health endpoint and deploy-production
  verify step were hardened after RCA so the next promoted release must report
  environment=production, but that is not deployed evidence yet.

BELLA_ENGLISH_GO_LIVE             NOT_READY / NOT_PROVEN
```

Security RCA on `origin/main@89e9c4b14`:

```text
Advisory                          GHSA-vfj7-8cjw-p6xm / CVE-2026-93687
Root vulnerable package            braces <= 3.0.3
Advisory class                     stack-exhaustion DoS via deeply nested brace patterns
Production audit path before fix   shadcn -> fast-glob -> micromatch -> braces
Direct dependency                  shadcn 4.14.0
Actual Bella usage                 src/app/globals.css imports shadcn/tailwind.css
Runtime service/API usage          none found
Fix applied                        move shadcn from dependencies to devDependencies
Version changes                    none
Production security audit          PASS
Changed-file typecheck             PASS / zero diagnostics
Build verification                 NOT_VERIFIED in audit worktree because node_modules
                                    is a junction to the primary checkout and Next
                                    resolved client modules through that absolute path.
```

Production Operations Evidence refresh on `origin/main@89e9c4b14` remained
read-only. No deployment, Vercel promotion, rollback execution, database backup,
restore drill, or alert-delivery trigger was performed.

```text
Deploy staging workflow            NOT_PROVEN
  Evidence: gh run list --workflow deploy-staging.yml returned no runs.

Deploy production workflow         NOT_PROVEN / HISTORICAL_FAILURES
  Evidence: gh run list --workflow deploy-production.yml --branch main returned
  old 2026-06 failures only; no successful deploy-production run exists for
  origin/main@89e9c4b14.

Production workflow config         NOT_PROVEN
  Evidence: deploy-production.yml requires VERCEL_TOKEN, VERCEL_ORG_ID,
  VERCEL_PRODUCTION_PROJECT_ID, PRODUCTION_SUPABASE_DB_URL,
  E2E_VERCEL_AUTOMATION_BYPASS_SECRET, and production/admin E2E credentials.
  Visible repo/environment secret and variable listings do not prove the full
  required set.

Public production health           PASS / LIMITED
  Evidence: https://bella-spa-erp.vercel.app/api/health returned HTTP 200 and
  database ok. The response reported environment=development, so this is
  reachability/DB health evidence only, not production runtime-env proof.

Runtime environment health RCA     FIXED_IN_CODE / NOT_DEPLOYED
  Evidence: /api/health and /api/health/replica previously reported
  process.env.DEPLOYMENT_ENV || 'development', while the Vercel workflows did
  not set DEPLOYMENT_ENV. The health route now reports DEPLOYMENT_ENV,
  VERCEL_ENV, NEXT_PUBLIC_VERCEL_ENV, then NODE_ENV. deploy-production verify
  now fails unless promoted /api/health returns status=healthy,
  environment=production, and database ok.

Production cron smoke              PASS / PARTIAL OPS EVIDENCE
  Evidence: Production Cron Smoke run 37156787032 passed on
  origin/main@89e9c4b14 at 2026-10-03T21:57:10Z. Logs showed accounting worker endpoint responded,
  persisted accounting_worker_runs id d237ca52-8d3e-47ee-bc13-52a1889a359c
  with status success, and business rule production guard passed 9 check
  groups with 0 critical findings. The latest run list also showed multiple
  successful scheduled runs after earlier 2026-10-02 failures, but this still
  proves only partial production execution health.

Production smoke for English       NOT_PROVEN
  Evidence: no authenticated English Center production/staging browser smoke
  was found for origin/main@89e9c4b14.

DB read-back for English prod      NOT_PROVEN
  Evidence: Real DB English proof exists for .env.test, not for a deployed
  production/staging environment tied to an ops release run.

Rollback                           NOT_PROVEN
  Evidence: scripts/emergency-rollback.sh exists and is dry-run by default, but
  no rollback dry-run/executed drill output was found for origin/main@89e9c4b14.

Backup / restore                   NOT_PROVEN
  Evidence: scripts/backup-database.sh is scoped to Decision Engine tables, not
  full application or English Center tables; run-staging-dr-drill.ts explicitly
  warns not to run against production; no English Center backup artifact,
  restore proof, or measured RTO/RPO was found.

Alerting                           PARTIAL / NOT_PROVEN_FOR_EXTERNAL_DELIVERY
  Evidence: cron smoke scripts can create in-app failure notifications on
  failure, and Slack/PagerDuty test scripts exist for Decision Engine. No
  English Center alert route, Slack/PagerDuty delivery proof, on-call drill, or
  SLO/error-budget dashboard evidence was found for this release.
```

Migration Drift RCA on `origin/main@89e9c4b14` started read-only. The follow-up
remediation was limited to the `.env.test` Supabase database and only applied
the two English-adjacent actual schema gaps identified by RCA. No production
mutation, database reset, or bulk migration push was performed.

```text
Initial remote migration rows      492
Initial pending-local rows         67
Pending rows from malformed or
duplicate local migration ids      18

Migration checker false-green      FIXED
  Evidence: scripts/check-supabase-migrations.cjs now parses current Supabase
  CLI JSON output with prelude and table output with backtick-wrapped IDs.
  Parser regression tests pass 8/8.

English / English-adjacent RCA:

20260912100000_org_unit_hierarchy_rpcs.sql
  Classification: APPLIED_ON_TEST_DB / HISTORY_REPAIRED
  Evidence: get_org_unit_hierarchy and get_org_unit_descendants were applied
  and read back from public.pg_proc; supabase_migrations.schema_migrations now
  contains 20260912100000 on the test DB.

20260912120000_add_branch_id_to_education_tables.sql
  Classification: APPLIED_ON_TEST_DB / HISTORY_REPAIRED
  Evidence: courses.branch_id, enrollments.branch_id, and
  v_branch_academic_summary were applied and read back from the test DB;
  supabase_migrations.schema_migrations now contains 20260912120000.

20260913_create_english_center_enrollments.sql
20260913_create_english_center_program_course_class.sql
20260913_create_english_center_teachers.sql
  Classification: HISTORY_ONLY plus LOCAL_MIGRATION_ID_DEFECT
  Evidence: headline English Center tables exist and RLS policies are present,
  but the files use a duplicated 8-digit migration id.

20260914_create_user_org_unit_access_projection.sql
20260914_repair_english_center_branch_rls.sql
20260914_repair_platform_org_people_rls.sql
  Classification: HISTORY_ONLY plus LOCAL_MIGRATION_ID_DEFECT
  Evidence: user_org_unit_access exists as a view; English Center and Platform
  RLS repair policies are present, but the files use a duplicated 8-digit
  migration id.

20260914120000_create_english_center_timetable_rooms.sql
20260914150000_create_english_center_learning_operations.sql
20260914170000_create_english_center_tuition_billing.sql
20260914190000_create_english_center_engagement.sql
  Classification: HISTORY_REPAIRED_ON_TEST_DB
  Evidence: 14/14 E5-E8 English Center tables were read back from the test DB
  with RLS enabled and one policy per table; the four canonical migration
  versions are now present in supabase_migrations.schema_migrations.

Remaining migration gate           STILL_FAIL_DRIFT
  Evidence: npm run db:migration:check now fails correctly with
  20260912100000, 20260912120000, 20260914120000, 20260914150000,
  20260914170000, and 20260914190000 removed from missing-local output. The
  duplicate 8-digit migration ID defects and non-English pending local
  migrations still require separate reconciliation.
```

---

## Accepted Evidence

```text
Branch-access architecture       RESOLVED
Platform projection              IMPLEMENTED
Platform Org/People RLS repair   APPLIED
E2/E3/E4 branch-aware RLS        APPLIED
Runtime branch isolation         PASS
Targeted tests                   33/33 PASS
Platform Architecture Guard      PASS
Education violations delta       0
Attribution unknown              0
Governance acceptance            ACCEPTED
Changed-file TypeScript delta    0

E5 targeted tests                40/40 PASS
E5 service tests                 7/7 PASS
E5 CI attribution                COMPLETE
E5 introduced violations         0
E5 unknown attribution           0
E5 PR #94 merge                  MERGED: d7f6e4ac
E5 canonical main smoke          PASS
E6-E10 roadmap reconciliation    COMPLETE
E6 architecture gate             PASS
E6 service tests                 7/7 PASS
E6 English Center regression     47/47 PASS
E6 scoped TypeScript check       PASS: bounded baseline 162/162
E6 migration zero-downtime       PASS
E6 migration changed-check       PASS / empty-remote drift skip
E6 architecture guard            PASS
E6 education conformance         39/39 PASS
E6 PR #98 merge                  MERGED: a493ab88
E6 canonical main smoke          PASS
E6 implementation                BOUNDED VERIFIED + SEALED
E7 architecture gate             PASS
E7 service tests                 8/8 PASS
E7 English Center regression     55/55 PASS
E7 scoped TypeScript check       PASS: bounded baseline 162/162
E7 migration zero-downtime       PASS
E7 migration changed-check       PASS / empty-remote drift skip
E7 architecture guard            PASS
E7 education conformance         39/39 PASS
E7 PR #100 merge                 MERGED: 364b624c
E7 canonical main smoke          PASS
E7 implementation                BOUNDED VERIFIED + SEALED
E8 architecture gate             PASS
E8 service tests                 7/7 PASS
E8 English Center regression     62/62 PASS
E8 scoped TypeScript check       PASS: bounded baseline 162/162
E8 migration zero-downtime       PASS
E8 migration changed-check       PASS / empty-remote drift skip
E8 architecture guard            PASS
E8 education conformance         39/39 PASS
E8 PR #102 merge                 MERGED: e4c085b0
E8 canonical main smoke          PASS
E8 implementation                BOUNDED VERIFIED + SEALED
E9 architecture gate             PASS
E9 service tests                 7/7 PASS
E9 English Center regression     69/69 PASS
E9 scoped TypeScript check       PASS: bounded baseline 162/162
E9 migration zero-downtime       PASS / no changed migrations
E9 migration changed-check       PASS / empty-remote drift skip
E9 architecture guard            PASS
E9 education conformance         39/39 PASS
E9 PR #104 merge                 MERGED: 19b57f09
E9 canonical main smoke          PASS
E9 implementation                BOUNDED VERIFIED + SEALED
E10 architecture gate            PASS
E10 English Center regression    69/69 PASS
E10 scoped TypeScript check      PASS: bounded baseline 162/162
E10 migration zero-downtime      PASS / no changed migrations
E10 migration changed-check      PASS / empty-remote drift skip
E10 architecture guard           PASS
E10 education conformance        39/39 PASS
E10 forbidden dependency grep    PASS / no hits
E10 RC decision                  BOUNDED RELEASE CANDIDATE after RC Closure
RC closure architecture gate     PASS
RC closure API smoke             4/4 PASS
RC closure regression + smoke    73/73 PASS
RC closure lint                  PASS
RC closure architecture guard    PASS
RC closure education conformance 39/39 PASS with 30s RLS timeout
RC closure migration zero-downtime PASS / no changed migrations
RC closure migration changed-check PASS / empty-remote drift skip
RC closure git diff --check      PASS
RC closure focused any scan      PASS / no hits
RC closure focused forbidden scan PASS / no hits
RC closure TypeScript changed    PASS on PR #107 dependency-aware CI
RC closure PR #107 merge         MERGED: 92da566a
RC closure canonical API smoke   4/4 PASS on origin/main@92da566a
RC closure canonical regression  73/73 PASS on origin/main@92da566a
RC closure canonical build       PASS on origin/main@92da566a
RC closure final RC              BOUNDED RELEASE CANDIDATE
Post-RC architecture gate        PASS / validation-only scope
Post-RC RC API smoke             4/4 PASS
Post-RC command center service   8/8 PASS
Post-RC real DB validation       SKIPPED / no runnable DB URL, not PASS
Post-RC browser validation       FAIL / runtime schema-grant gap found
Post-RC lint                     PASS
Post-RC build                    PASS
Post-RC architecture guard       PASS
Post-RC migration zero-downtime  PASS / no changed migrations
Post-RC migration drift check    PASS / empty-remote drift skip
Post-RC git diff --check         PASS
Post-RC PR #109 merge            MERGED: 62074058
Post-RC canonical API/service smoke 12 PASS / 1 real-DB skip on origin/main@62074058
Post-RC canonical architecture guard PASS on origin/main@62074058
Post-RC canonical build          PASS on origin/main@62074058
Post-RC canonical browser gate   FAIL / runtime schema-grant blocker remains
Post-RC final decision           BOUNDED RC retained; Field Verified RC HELD
Field Verified RC real DB validation PASS on origin/main@d4417cf8
Field Verified RC browser gate   PASS on origin/main@d4417cf8
Field Verified RC command center API PASS on origin/main@d4417cf8
Production Candidate review      COMPLETE on origin/main@d4417cf8
Production Candidate decision    HELD / operations evidence not yet complete
Go-Live audit harness guard      PASS on origin/main@89e9c4b14 / mock env fails fast with REAL_DB_ENV_REQUIRED
Go-Live audit English regression PASS on origin/main@89e9c4b14 / real .env.test / 10 suites, 74 tests
Go-Live audit Post-RC Real DB    PASS on origin/main@89e9c4b14 / 1 suite, 1 test
Go-Live migration checker        PASS parser fix / no false-green on current Supabase CLI output
Go-Live migration remediation    PARTIAL on .env.test / six known English migrations applied-or-history-repaired
Go-Live audit final decision     NOT_READY / NOT_PROVEN until remaining gates are verified
```

---

## Governed Debt / Accepted Risk

```text
DEBT-EDU-ARCH-01
  197 pre-existing Education direct-DB violations
  Owner: Broader Bella Education / Preschool architecture remediation
  Status: scoped out from English Center E2/E3/E4

DEBT-MIG-HISTORY-01
  Remote migration history unavailable; drift check not fully proven
  Owner: Platform database governance / release infrastructure
  Status: accepted as bounded infrastructure limitation, not PASS

DEBT-TSC-ROOT-01
  Root TypeScript has pre-existing diagnostics/timeouts outside changed E2/E3/E4 files
  Owner: Platform / whole-repository TypeScript hardening
  Status: scoped out from English Center E2/E3/E4, not PASS

DEBT-CI-POLICY-01
  Required gates now classify reviewed Education baseline debt and Education
  conformance infrastructure schema gaps without weakening new-regression blocks
  Owner: Platform governance / CI policy
  Status: policy hardened during PR #94, not E5 product-code debt

DEBT-REALDB-E2E-INFRA-01
  Real Database Business E2E can fail on Gateway Timeout during setup
  Owner: CI database infrastructure / real-db E2E reliability
  Status: passed on PR #94 final CI and canonical main smoke attribution remained
  not E5-introduced

DEBT-TSC-BASELINE-ORDER-01
  TypeScript diagnostic signatures can drift when TypeScript emits quoted union
  literal members in a different order.
  Owner: Platform governance / CI diagnostic comparator
  Status: comparator normalized during PR #98; E6 product diagnostic delta was 0

DEBT-REALDB-SMOKE-LATENCY-01
  Canonical main smoke for E7 had one transient E2 enrollment beforeEach
  Supabase setup timeout before the immediate rerun passed 55/55.
  Owner: CI/database test infrastructure reliability
  Status: not E7-introduced; PR #100 CI and canonical-main rerun passed

DEBT-REALDB-E2E-GATEWAY-01
  PR #102 Real Database Business E2E initially failed with Bad Gateway in
  existing accounting, order lifecycle, refund, and payroll real-db setup.
  Owner: CI/database test infrastructure reliability
  Status: not E8-introduced; failed jobs passed on rerun before merge

RC-BLOCKER-E10-UIAPI-01
  E6-E9 product services are implemented and regression-tested, but E10 did
  not find matching UI/API consumption surfaces for attendance/learning,
  tuition/billing, engagement, and chain command center.
  Owner: English Center product surface
  Status: closed by PR #107 and canonical smoke on origin/main@92da566a

RC-BLOCKER-E10-RUNTIME-01
  E10 did not execute a full browser/live UI-to-DB smoke across the complete
  E2-E9 product chain.
  Owner: English Center release validation
  Status: closed for bounded RC by canonical route-handler smoke, product
  regression, and production build on origin/main@92da566a; live browser/real
  database E2E remains not claimed unless run by a dedicated environment gate

POST-RC-DB-SCHEMA-01
  Post-RC browser validation found the Command Center runtime environment could
  not see `english_center_class_sessions` or
  `english_center_learning_progress`; local probes also exposed missing later
  English Center RC tables in the same runtime family. The corresponding
  migrations exist in the repository.
  Owner: English Center release validation / staging database operations
  Status: Field Verified RC blocker; apply canonical migrations and refresh
  schema cache in a dedicated runtime environment, then rerun Post-RC gates

POST-RC-ORGUNIT-GRANT-01
  Post-RC browser validation found `permission denied for view
  user_org_unit_access` during Command Center runtime fetching.
  Owner: Platform authorization projection / staging database operations
  Status: Field Verified RC blocker; verify view grants and authenticated DB
  context, then rerun Post-RC gates
```

---

## References

- `E2_E3_E4_GOVERNANCE_ACCEPTANCE.md`
- `E2_E3_E4_BOUNDED_SEAL_REVIEW.md`
- `E2_E3_E4_EDUCATION_VERIFY_ATTRIBUTION.md`
- `E2_E3_E4_BRANCH_ACCESS_ARCHITECTURE_DECISION.md`
- `ARCHITECTURE_GATE_RESULT.md`
- `E5_BOUNDED_SEAL_REVIEW.md`
- `E6_BOUNDED_SEAL_REVIEW.md`
- `E7_BOUNDED_SEAL_REVIEW.md`
- `E8_ARCHITECTURE_GATE_RESULT.md`
- `E8_BOUNDED_SEAL_REVIEW.md`
- `E9_ARCHITECTURE_GATE_RESULT.md`
- `E9_BOUNDED_SEAL_REVIEW.md`
- `E10_ARCHITECTURE_GATE_RESULT.md`
- `E10_PRODUCT_RECONCILIATION_RC.md`
- `RC_CLOSURE_ARCHITECTURE_GATE_RESULT.md`
- `RC_CLOSURE_EVIDENCE.md`
- `POST_RC_VALIDATION_ARCHITECTURE_GATE_RESULT.md`
- `POST_RC_VALIDATION_EVIDENCE.md`
- `PRODUCTION_CANDIDATE_READINESS_REVIEW.md`
- `E6_E10_ROADMAP_RECONCILIATION.md`
