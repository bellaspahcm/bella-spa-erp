# BDGF REUSABLE TOOLING ARCHITECTURE

**Version:** 1.0  
**Status:** DESIGN  
**Date:** 2026-08-20  

---

## PURPOSE

Define reusable tooling architecture so new OS can **plug into BDGF governance kernel** without rebuilding governance from scratch.

**Strategic Goal:**
> One OS plug vào BDGF, không tự xây governance.

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│              NEW OS (Finance/Healthcare/etc)            │
├─────────────────────────────────────────────────────────┤
│  1. OS-Specific Config (deployment-config.json)        │
│  2. Domain Gate Pack (finance-gates/, healthcare-gates/)│
├─────────────────────────────────────────────────────────┤
│              BDGF GOVERNANCE KERNEL (Reusable)          │
├─────────────────────────────────────────────────────────┤
│  • Gate Runner Standard                                 │
│  • Evidence Collector                                   │
│  • Gate Status Standard (PASS/FAIL/HOLD/BLOCKED)       │
│  • Human GO Record Template                             │
│  • Scope Manifest Template                              │
│  • Rollback Verification Template                       │
│  • Deployment Audit Trail                               │
│  • Compliance Report Generator                          │
└─────────────────────────────────────────────────────────┘
```

---

## CORE COMPONENTS

### 1. Gate Runner Standard

**Location:** `scripts/bdgf/gate-runner.mjs`

**Purpose:** Unified execution engine for all verification gates

**Interface:**
```javascript
import { GateRunner } from './bdgf/gate-runner.mjs';

const runner = new GateRunner({
  gateName: 'package-integrity',
  gateVersion: '1.0',
  deployment: 'migration-05',
  config: deploymentConfig
});

const result = await runner.execute();
// result: { status, passCount, failCount, warnings, evidence, timestamp }
```

**Capabilities:**
- Execute verification checks from config
- Collect evidence automatically
- Generate standardized gate result
- Support all gate statuses: PASS / FAIL / HOLD / BLOCKED
- Record execution audit trail

**Config-Driven:**
```json
{
  "gateName": "package-integrity",
  "checks": [
    {
      "id": "check-001",
      "name": "SQL Syntax Validation",
      "type": "file-parser",
      "target": "supabase/migrations/*.sql",
      "validator": "sql-parser",
      "failOn": "syntax-error"
    },
    {
      "id": "check-002",
      "name": "Semantic Pattern Match",
      "type": "regex-match",
      "target": "supabase/migrations/05a_*.sql",
      "pattern": "metadata->>'provisioned_by'",
      "failOn": "not-found"
    }
  ]
}
```

---

### 2. Evidence Collector

**Location:** `scripts/bdgf/evidence-collector.mjs`

**Purpose:** Automatically collect and structure verification evidence

**Interface:**
```javascript
import { EvidenceCollector } from './bdgf/evidence-collector.mjs';

const collector = new EvidenceCollector({
  deployment: 'migration-05',
  gate: 'e0-verification'
});

collector.recordCheck('artifact-001', 'PASS', { fileHash: 'abc123...' });
collector.recordCheck('artifact-002', 'PASS', { fileSize: 52000 });
collector.recordCheck('dependency-001', 'FAIL', { expected: 'uuid', actual: 'text' });

const evidence = collector.finalize();
// evidence: { deployment, gate, timestamp, checks, summary, artifacts }
```

**Evidence Structure:**
```json
{
  "deployment": "migration-05",
  "gate": "e0-verification",
  "timestamp": "2026-08-20T10:30:00Z",
  "checks": [
    {
      "id": "artifact-001",
      "status": "PASS",
      "evidence": { "fileHash": "abc123..." },
      "timestamp": "2026-08-20T10:30:01Z"
    }
  ],
  "summary": {
    "total": 33,
    "pass": 32,
    "fail": 1,
    "warn": 0
  },
  "artifacts": {
    "logs": "logs/e0-verification-20260820.log",
    "report": "reports/e0-verification-20260820.json"
  }
}
```

**Auto-Archive:** Evidence automatically stored in `evidence/<deployment>/<gate>/` with timestamp

---

### 3. Gate Status Standard

**Location:** `scripts/bdgf/gate-status.mjs`

**Purpose:** Unified status model across all gates

**Status Values:**
```javascript
const GateStatus = {
  PASS: 'PASS',           // All checks passed
  FAIL: 'FAIL',           // At least one check failed
  HOLD: 'HOLD',           // Checks passed, awaiting authorization
  BLOCKED: 'BLOCKED',     // Cannot proceed (dependency failed)
  WARN: 'WARN',           // Passed with warnings
  SKIP: 'SKIP'            // Gate skipped (conditional)
};
```

**Status Transitions:**
```
FAIL ──────────────────> [Fix] ─────> PASS/FAIL
                                        │
PASS ───────────────────────────────────┤
                                        │
                                        v
                                      HOLD
                                        │
                                        v
                                 [Human Decision]
                                        │
                                        ├──> GO (proceed)
                                        └──> NO-GO (stop)
```

**Usage:**
```javascript
import { GateStatus } from './bdgf/gate-status.mjs';

function evaluateGateResult(checks) {
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  
  if (failCount > 0) {
    return GateStatus.FAIL;
  }
  
  // All checks passed
  return GateStatus.PASS;
}
```

---

### 4. Human GO Record Template

**Location:** `scripts/bdgf/templates/human-go-record.json`

**Purpose:** Standardized format for Human GO decision recording

**Template:**
```json
{
  "deployment": "migration-05",
  "decisionDate": "2026-08-20",
  "decisionBy": "Platform Architect",
  "decision": "GO | HOLD | NO-GO",
  "conditions": {
    "backup": {
      "required": true,
      "confirmed": true,
      "evidence": {
        "backupFile": "backup-20260820-0930.dump",
        "backupSize": "150MB",
        "backupLocation": "s3://bella-backups/prod/",
        "verifiedBy": "DBA",
        "restoreTested": true
      }
    },
    "monitoring": {
      "required": true,
      "confirmed": true,
      "evidence": {
        "monitoringPlan": "docs/monitoring/migration-05-plan.md",
        "checkpoints": ["05-A checkpoint", "E2 gate", "05-B checkpoint", "05-C checkpoint", "E3 gate"],
        "stopCriteria": "Any checkpoint FAIL → STOP immediately",
        "rollbackReady": true
      }
    },
    "scope": {
      "required": true,
      "confirmed": true,
      "evidence": {
        "scopeManifest": "docs/governance/migration-05-scope-manifest.md",
        "authorizedMutations": [
          "CREATE COLUMN reserved_tenant_id",
          "CREATE COLUMN canonical_tenant_id",
          "UPDATE SET canonical_tenant_id",
          "ALTER COLUMN tenant_id TYPE uuid"
        ],
        "notAuthorized": [
          "DROP any table",
          "DELETE any data",
          "TRUNCATE any table"
        ],
        "boundaryConfirmed": true
      }
    }
  },
  "priorEvidence": {
    "packageIntegrity": "52/52 PASS",
    "e0Gate": "33/33 PASS",
    "rollbackTest": "31/31 PASS (3 scenarios)",
    "e1Gate": "10/10 PASS",
    "totalAutomated": "126/126 PASS"
  },
  "signature": {
    "authorizedBy": "Platform Architect",
    "authorizedAt": "2026-08-20T14:00:00Z",
    "notes": "All 3 conditions confirmed with evidence. Authorization granted for controlled execution."
  }
}
```

---

### 5. Scope Manifest Template

**Location:** `scripts/bdgf/templates/scope-manifest.md`

**Purpose:** Exhaustive listing of authorized and prohibited mutations

**Template:**
```markdown
# Deployment Scope Manifest

**Deployment:** [Name]
**Date:** [YYYY-MM-DD]
**Authorized By:** [Role]

## AUTHORIZED MUTATIONS

### Schema Mutations
- [ ] CREATE COLUMN `table_name.column_name` TYPE `data_type`
- [ ] ALTER COLUMN `table_name.column_name` TYPE `new_type`
- [ ] CREATE INDEX `index_name` ON `table_name(column_name)`
- [ ] ADD CONSTRAINT `constraint_name` FOREIGN KEY ...

### Data Mutations
- [ ] UPDATE `table_name` SET `column_name` = `value` WHERE `condition`
- [ ] INSERT INTO `table_name` (`columns`) VALUES (`values`)

### Total Mutations: [X]

---

## NOT AUTHORIZED

### Prohibited Operations
- ❌ DROP TABLE (any table)
- ❌ DROP COLUMN (any column)
- ❌ DELETE FROM (any table)
- ❌ TRUNCATE (any table)
- ❌ ALTER TYPE (enum changes)
- ❌ DISABLE RLS
- ❌ DROP POLICY

---

## SCOPE BOUNDARY

**In Scope:**
- Tables: [list]
- Columns: [list]
- Operations: [list]

**Out of Scope:**
- Everything not explicitly listed in AUTHORIZED MUTATIONS

---

## VERIFICATION

Scope confirmed by: [Name]
Date: [YYYY-MM-DD]
Signature: [Signature]
```

---

### 6. Rollback Verification Template

**Location:** `scripts/bdgf/templates/rollback-verification.mjs`

**Purpose:** Standardized rollback verification for all deployments

**Template:**
```javascript
import { RollbackVerifier } from '../bdgf/rollback-verifier.mjs';

export async function verifyRollback(deployment) {
  const verifier = new RollbackVerifier({
    deployment,
    scenarios: [
      {
        name: 'Failure after gate PASS, before mutation',
        injectAt: 'pre-mutation',
        expectedRollback: ['transaction-abort', 'no-schema-change', 'no-data-change']
      },
      {
        name: 'Failure after partial mutation',
        injectAt: 'mid-mutation',
        expectedRollback: ['transaction-abort', 'schema-reverted', 'data-reverted']
      },
      {
        name: 'Failure after critical operation',
        injectAt: 'post-critical',
        expectedRollback: ['transaction-abort', 'full-revert', 'pristine-state']
      }
    ]
  });

  const results = await verifier.executeScenarios();

  // Verify pristine state (5-point check)
  const pristineChecks = [
    verifier.checkSchemaIntact(),
    verifier.checkTableIntact(),
    verifier.checkFixturesIntact(),
    verifier.checkTypeIntact(),
    verifier.checkForeignKeysIntact()
  ];

  return {
    scenarios: results,
    pristineVerified: pristineChecks.every(c => c === true),
    totalChecks: results.reduce((sum, r) => sum + r.checks, 0)
  };
}
```

---

### 7. Deployment Audit Trail

**Location:** `scripts/bdgf/audit-trail.mjs`

**Purpose:** Immutable log of all deployment actions and decisions

**Interface:**
```javascript
import { AuditTrail } from './bdgf/audit-trail.mjs';

const audit = new AuditTrail({ deployment: 'migration-05' });

audit.record('gate-executed', { gate: 'package-integrity', result: 'PASS', checks: 52 });
audit.record('gate-executed', { gate: 'e0', result: 'PASS', checks: 33 });
audit.record('human-decision', { decision: 'HOLD', reason: '3 conditions not confirmed' });
audit.record('condition-confirmed', { condition: 'backup', evidence: {...} });
audit.record('human-decision', { decision: 'GO', conditions: 3 });
audit.record('stage-executed', { stage: '05-A', result: 'PASS' });
audit.record('checkpoint-verified', { checkpoint: 'E2', result: 'PASS' });

const trail = audit.export();
// Immutable log with timestamps, hashes, signatures
```

**Audit Record Structure:**
```json
{
  "deployment": "migration-05",
  "records": [
    {
      "seq": 1,
      "timestamp": "2026-08-19T10:00:00Z",
      "action": "gate-executed",
      "data": { "gate": "package-integrity", "result": "PASS", "checks": 52 },
      "actor": "system",
      "hash": "abc123..."
    },
    {
      "seq": 2,
      "timestamp": "2026-08-20T14:00:00Z",
      "action": "human-decision",
      "data": { "decision": "GO", "conditions": 3 },
      "actor": "platform-architect",
      "hash": "def456...",
      "prevHash": "abc123..."
    }
  ],
  "exportedAt": "2026-08-20T15:00:00Z",
  "integrity": "verified"
}
```

---

### 8. Compliance Report Generator

**Location:** `scripts/bdgf/compliance-report-generator.mjs`

**Purpose:** Generate BDGF compliance report for any deployment

**Interface:**
```javascript
import { ComplianceReportGenerator } from './bdgf/compliance-report-generator.mjs';

const generator = new ComplianceReportGenerator({
  os: 'Healthcare',
  deployment: 'migration-05',
  evidencePath: 'evidence/migration-05/'
});

const report = await generator.generate();
// report: markdown file with compliance matrix, check results, violations
```

**Generated Report:**
```markdown
# BDGF v1.0 Compliance Report

**OS:** Healthcare OS
**Deployment:** Migration 05
**Date:** 2026-08-20

## Compliance Status

| Layer | Required | Status | Checks | Evidence |
|-------|----------|--------|--------|----------|
| Design Authority | ✅ | ✅ PASS | - | Amendment 12 v3 approved |
| Package Integrity | ✅ | ✅ PASS | 52/52 | evidence/package-integrity/ |
| E0 Gate | ✅ | ✅ PASS | 33/33 | evidence/e0-gate/ |
| Rollback Proof | ✅ | ✅ PASS | 3 scenarios | evidence/rollback-test/ |
| E1 Gate | ✅ | ✅ PASS | 10/10 | evidence/e1-gate/ |
| Human GO | ✅ | 🟡 HOLD | 3 conditions | 0/3 confirmed |
| Controlled Execution | ✅ | ⏸️ PENDING | - | Awaiting Human GO |
| Post-Verification | ✅ | ⏸️ PENDING | - | Awaiting execution |
| Monitoring | ✅ | ⏸️ PENDING | - | Awaiting activation |

**Overall Compliance:** 🟡 HOLD (Human GO pending)
**Total Automated Checks:** 126/126 PASS
**Violations:** None
**Blocking Issue:** Human GO conditions not confirmed

## Domain Gates
- Healthcare Domain Gate Pack: Ready
- Person/Encounter Integrity Gate: Configured
- Clinical Provenance Gate: Configured
```

---

## DEPLOYMENT CONFIG STANDARD

### OS-Specific Config File

**Location:** `.bdgf/deployment-config.json`

**Purpose:** Single source of truth for OS-specific BDGF configuration

**Structure:**
```json
{
  "os": "Healthcare",
  "osVersion": "1.0",
  "bdgfVersion": "1.0",
  
  "deployment": {
    "name": "migration-05",
    "type": "schema-migration",
    "scope": "tenant-identity-reconciliation",
    "riskLevel": "HIGH"
  },
  
  "gates": {
    "packageIntegrity": {
      "enabled": true,
      "configPath": ".bdgf/gates/package-integrity.json",
      "minChecks": 40
    },
    "e0": {
      "enabled": true,
      "configPath": ".bdgf/gates/e0-gate.json",
      "minChecks": 30
    },
    "rollback": {
      "enabled": true,
      "configPath": ".bdgf/gates/rollback-test.json",
      "minScenarios": 3
    },
    "e1": {
      "enabled": true,
      "configPath": ".bdgf/gates/e1-gate.json",
      "minChecks": 8
    },
    "domainGates": {
      "enabled": true,
      "pack": "healthcare",
      "configPath": ".bdgf/gates/healthcare-domain-gates.json"
    }
  },
  
  "humanGo": {
    "required": true,
    "conditions": ["backup", "monitoring", "scope"],
    "recordPath": ".bdgf/human-go-record.json"
  },
  
  "execution": {
    "strategy": "staged",
    "stages": [
      { "name": "05-A", "checkpoint": "E2" },
      { "name": "05-B", "checkpoint": "manual-verify" },
      { "name": "05-C", "checkpoint": "E3" }
    ],
    "stopOnFailure": true
  },
  
  "monitoring": {
    "enabled": true,
    "checkpoints": 6,
    "rollbackReadyDays": 7
  },
  
  "evidence": {
    "outputPath": "evidence/migration-05/",
    "retention": "permanent"
  }
}
```

---

## TOOLING USAGE WORKFLOW

### For New OS Adopting BDGF

**Step 1: Initialize BDGF**
```bash
npm run bdgf:init -- --os="Finance" --deployment="ledger-migration-01"
# Creates .bdgf/ directory with templates
```

**Step 2: Configure Deployment**
```bash
# Edit .bdgf/deployment-config.json
# Add OS-specific settings, gate configs
```

**Step 3: Run Automated Verification**
```bash
npm run bdgf:verify:package-integrity
npm run bdgf:verify:e0
npm run bdgf:verify:rollback
npm run bdgf:verify:e1
# Each command uses gate-runner with OS config
```

**Step 4: Generate Compliance Report**
```bash
npm run bdgf:report:compliance
# Generates compliance report with current status
```

**Step 5: Record Human GO**
```bash
npm run bdgf:human-go:record -- --decision=GO
# Records decision in audit trail
```

**Step 6: Execute with Control**
```bash
npm run bdgf:execute -- --stage=all
# Executes stages with checkpoint verification
```

**Step 7: Generate Final Report**
```bash
npm run bdgf:report:final
# Full deployment report with evidence
```

---

## REUSABLE COMPONENTS CHECKLIST

### Core Infrastructure (scripts/bdgf/)

- [ ] `gate-runner.mjs` - Unified gate execution engine
- [ ] `evidence-collector.mjs` - Evidence collection and archiving
- [ ] `gate-status.mjs` - Status model and transitions
- [ ] `rollback-verifier.mjs` - Rollback verification framework
- [ ] `audit-trail.mjs` - Immutable audit log
- [ ] `compliance-report-generator.mjs` - Report generation

### Templates (scripts/bdgf/templates/)

- [ ] `human-go-record.json` - Human GO decision template
- [ ] `scope-manifest.md` - Scope definition template
- [ ] `rollback-verification.mjs` - Rollback test template
- [ ] `deployment-config.json` - OS config template
- [ ] `gate-config.json` - Gate configuration template

### CLI Commands (package.json scripts)

- [ ] `bdgf:init` - Initialize BDGF for new deployment
- [ ] `bdgf:verify:*` - Run specific verification gate
- [ ] `bdgf:verify:all` - Run all automated gates
- [ ] `bdgf:report:compliance` - Generate compliance report
- [ ] `bdgf:human-go:record` - Record Human GO decision
- [ ] `bdgf:execute` - Execute deployment with control
- [ ] `bdgf:report:final` - Generate final report

---

## BENEFITS

### For New OS

**Before BDGF Tooling (rebuild everything):**
- Write custom verification scripts: 2-3 days
- Implement rollback testing: 1-2 days
- Build evidence collection: 1 day
- Create audit trail: 1 day
- Generate compliance reports: 1 day
- **Total: 6-8 days of governance plumbing**

**After BDGF Tooling (plug and configure):**
- Configure deployment-config.json: 2 hours
- Adapt gate configs to schema: 4 hours
- Add domain-specific gates: 4 hours
- Run verification: 1 hour
- **Total: 1 day of configuration**

**Time Saved: 5-7 days per deployment**

---

### For Platform

**Consistency:**
- Same tooling → same rigor across all OS
- Same evidence format → easier auditing
- Same compliance verification → objective assessment

**Scalability:**
- 1 OS: manageable without tooling
- 4 OS (Finance, Healthcare, Education, Real Estate): requires tooling
- 10+ OS: tooling is mandatory

**Trust:**
- Governance quality does NOT degrade as platform scales
- External auditors see consistent governance
- Compliance becomes verifiable, not subjective

---

## NEXT STEPS

1. **Build Core Infrastructure** (scripts/bdgf/)
   - Implement gate-runner
   - Implement evidence-collector
   - Implement audit-trail

2. **Create Templates** (scripts/bdgf/templates/)
   - Human GO record template
   - Scope manifest template
   - Deployment config template

3. **Add CLI Commands** (package.json)
   - bdgf:init
   - bdgf:verify:all
   - bdgf:report:compliance

4. **Test with Amendment 12 v3**
   - Refactor existing scripts to use new tooling
   - Verify no regression in verification quality
   - Document as tooling reference implementation

5. **Document Adoption Guide**
   - Step-by-step guide for new OS
   - Configuration examples
   - Troubleshooting guide

---

**Status:** DESIGN COMPLETE  
**Implementation:** READY TO START  
**First User:** Amendment 12 v3 (refactor existing scripts)  
**Next User:** Finance OS (first new adopter)  
