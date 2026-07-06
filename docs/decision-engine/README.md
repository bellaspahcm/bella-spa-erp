# Decision Engine Documentation Index

**Last Updated:** July 5, 2026

This directory contains all documentation for the Bella ERP Decision Engine - a rule-based system for automating business decisions (leave approvals, salary calculations, etc.) with full audit trails and replay capabilities.

---

## 📚 Quick Navigation

### 🚀 Getting Started
- **[STAGING_PRODUCTION_GATES.md](./STAGING_PRODUCTION_GATES.md)** - Full gate definitions and philosophy ⭐ **START HERE**
- **[GATES_PROGRESS_SUMMARY.md](./GATES_PROGRESS_SUMMARY.md)** - Current status of all gates
- **[ENGINEERING_STANDARD.md](./ENGINEERING_STANDARD.md)** - Quality pyramid and maturity model

### 🎯 Production Gates (In Order)
1. **[GATE1_QUICK_START.md](./GATE1_QUICK_START.md)** - Functional validation (2 hours) ✅ **COMPLETE**
2. **[GATE2_SETUP_COMPLETE.md](./GATE2_SETUP_COMPLETE.md)** - Failure injection (24 hours) 🟡 **PARTIAL**
3. **[GATE3_MONITORING_GUIDE.md](./GATE3_MONITORING_GUIDE.md)** - Operational stability (72 hours) 🔵 **IN PROGRESS**
4. **[GATE4_DATA_QUALITY_GUIDE.md](./GATE4_DATA_QUALITY_GUIDE.md)** - Data quality (14 days) ⏳ **READY**

### 📊 Monitoring & Operations
- **[GATE3_START_MARKER.md](./GATE3_START_MARKER.md)** - Gate 3 timeline and checklist
- **[GATE4_START_MARKER.md](./GATE4_START_MARKER.md)** - Gate 4 timeline and checklist
- **[OPERATIONS_CONSOLE_ROADMAP.md](./OPERATIONS_CONSOLE_ROADMAP.md)** - Future operations UI
- **[OPERATIONS_CONSOLE_IMPLEMENTATION_CHECKLIST.md](./OPERATIONS_CONSOLE_IMPLEMENTATION_CHECKLIST.md)** - Implementation plan

---

## 🎯 Current Status (July 5, 2026)

| Gate | Status | Timeline | Blocking? |
|------|--------|----------|-----------|
| **Gate 1: Functional** | ✅ **COMPLETE** | 2 hours | ✅ YES |
| **Gate 2: Failure Injection** | 🟡 **PARTIAL** | 24 hours | ✅ YES (2.1 done) |
| **Gate 3: Operational** | 🔵 **IN PROGRESS** | 72 hours | ⚠️ WARNING ONLY |
| **Gate 4: Data Quality** | ⏳ **READY** | 14 days | ℹ️ OBSERVATIONAL |

**Production Rollout Target:** July 19, 2026

---

## 📖 Document Descriptions

### Core Philosophy & Standards

#### STAGING_PRODUCTION_GATES.md
**Purpose:** Master document defining all 4 production gates  
**When to read:** Before starting any gate  
**Key content:**
- Gate definitions and objectives
- Pass/fail criteria for each gate
- Rollback triggers and procedures
- Philosophy: "Staging is evidence-gathering, not preview"

#### ENGINEERING_STANDARD.md
**Purpose:** Quality pyramid and engineering maturity model  
**When to read:** Understanding "why" behind the gates  
**Key content:**
- 5-level quality pyramid (L0-L4)
- Maturity model progression
- Testing philosophy
- Production readiness criteria

#### GATES_PROGRESS_SUMMARY.md
**Purpose:** Real-time status tracker for all gates  
**When to read:** Daily (quick status check)  
**Key content:**
- Current status table
- Known issues and mitigations
- Next milestones
- Commands reference

---

### Gate 1: Functional Validation ✅

#### GATE1_QUICK_START.md
**Status:** ✅ Complete (Jun 22, 2026)  
**Duration:** 2 hours  
**Type:** BLOCKING

**What it validates:**
- 6 core scenarios work end-to-end
- Leave approval/rejection logic
- Audit persistence
- Replay functionality
- Trace viewer
- Health endpoint

**Pass criteria:** 6/6 scenarios passed  
**Result:** ✅ PASSED - Decision engine is functional

---

### Gate 2: Failure Injection Testing 🟡

#### GATE2_SETUP_COMPLETE.md
**Status:** 🟡 Partial (Jun 23, 2026)  
**Duration:** 24 hours  
**Type:** BLOCKING

**What it validates:**
- System resilience under failure conditions
- Circuit breaker behavior
- Audit queue and retry logic
- **CRITICAL ASSERTION:** "Business decisions NEVER block on audit failures"

**Completed scenarios:**
- ✅ **Scenario 2.1:** Audit Database Down (10/10 decisions succeeded)

**Deferred scenarios:**
- ⏸️ 2.2-2.5: Audit timeout, queue full, network partition, policy exceptions

**Result:** ✅ SUFFICIENT - Core resilience proven

---

### Gate 3: Operational Stability 📊

#### GATE3_MONITORING_GUIDE.md
**Status:** 🔵 In Progress (Jul 5-8, 2026)  
**Duration:** 72 hours  
**Type:** WARNING-ONLY (not blocking)

**What it validates:**
- System stability under real workload
- Queue depth remains manageable
- Retry/error rates within thresholds
- Circuit breaker uptime > 95%
- Performance (p95/p99 latency)

**7 Metrics tracked:**
1. Queue Depth (< 100)
2. Retry Rate (< 5%)
3. DLQ Rate (< 1%)
4. Error Rate (< 0.1%)
5. p95 Latency (< 200ms)
6. p99 Latency (< 500ms)
7. Circuit Uptime (> 95%)

**Monitoring:**
- Automated: Vercel Cron (daily at 19:00 VN time)
- Manual: SQL queries every 6 hours

**API Endpoints:**
- `/api/cron/gate3-monitor` (cron job, protected)
- `/api/gate3/metrics` (view aggregated data)

**Check progress:**
```bash
curl https://bella-spa-erp.vercel.app/api/gate3/metrics | jq
```

#### GATE3_START_MARKER.md
**Purpose:** Timeline, checklist, and status tracking  
**Key content:**
- Start/end times
- Checklist of monitoring activities
- Manual SQL queries to run
- Expected snapshot count (3 total)

---

### Gate 4: Data Quality Validation 📋

#### GATE4_DATA_QUALITY_GUIDE.md
**Status:** ⏳ Ready (Awaiting 500+ decisions)  
**Duration:** 14 days (Jul 5-19, 2026)  
**Type:** OBSERVATIONAL (not blocking)

**What it validates:**
- Audit data completeness and usability
- Policy rule coverage
- Replay determinism
- Trace ID presence

**4 Validation checks:**
1. **Audit Completeness** - All fields populated (100%)
2. **Rule Coverage** - 6/8 rules triggered (75%)
3. **Replay Determinism** - Replays match original (100%)
4. **Trace Completeness** - All decisions have traces (100%)

**How to monitor:**
```bash
# Daily monitoring
./scripts/gate4-monitor.sh

# Replay test (50 samples)
./scripts/gate4-replay-test.sh

# Check decision count
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM decision_audit_log WHERE engine_version IS NOT NULL;"
```

**Pass criteria:** All 4 checks pass (observational, not blocking)

#### GATE4_START_MARKER.md
**Purpose:** Timeline, checklist, and progress tracking  
**Key content:**
- Weekly milestones
- Validation checklist
- Expected decision count timeline
- Report generation instructions

---

### Operations & Future Work

#### OPERATIONS_CONSOLE_ROADMAP.md
**Purpose:** Future operations UI design  
**When to read:** Sprint 2 planning  
**Key content:**
- Dashboard wireframes
- Real-time monitoring features
- Admin tools (replay, circuit breaker override)
- Alert management

#### OPERATIONS_CONSOLE_IMPLEMENTATION_CHECKLIST.md
**Purpose:** Implementation task list for operations UI  
**When to read:** Sprint 2 kickoff  
**Key content:**
- Component breakdown
- API endpoint requirements
- Database schema additions
- Testing requirements

---

## 🔧 Related Scripts

All scripts located in `../../scripts/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| `gate2-scenario-2.1-audit-db-down.js` | Test audit DB failure | `node scripts/gate2-scenario-2.1-audit-db-down.js` |
| `setup-gate2-test-data.js` | Create test data | `node scripts/setup-gate2-test-data.js` |
| `gate3-monitor.js` | Local Gate 3 monitoring | `node scripts/gate3-monitor.js` (backup) |
| `gate4-monitor.sh` | Daily Gate 4 validation | `./scripts/gate4-monitor.sh` |
| `gate4-replay-test.sh` | Replay determinism test | `./scripts/gate4-replay-test.sh` |

---

## 📖 Strategic Roadmap

**⚠️ IMPORTANT:** Before diving into details, read the strategic direction:

👉 **[BELLA_EIP_STRATEGIC_ROADMAP.md](./BELLA_EIP_STRATEGIC_ROADMAP.md)** ⭐ **MUST READ**

**Key Insight:**
- Operations Console is deferred to Phase D (Dec 2026)
- Focus now: Integrate Decision Engine into 5-10 business processes (Phase B)
- Goal: Collect 100,000+ real decisions before building dashboard
- Principle: "Dashboard without data = Pretty UI, Dashboard with real scale = Intelligence"

---

## 🚀 Quick Start Guide

### For New Team Members:

1. **Read core philosophy:**
   - [STAGING_PRODUCTION_GATES.md](./STAGING_PRODUCTION_GATES.md)
   - [ENGINEERING_STANDARD.md](./ENGINEERING_STANDARD.md)

2. **Check current status:**
   - [GATES_PROGRESS_SUMMARY.md](./GATES_PROGRESS_SUMMARY.md)

3. **Review completed gates:**
   - [GATE1_QUICK_START.md](./GATE1_QUICK_START.md) ✅
   - [GATE2_SETUP_COMPLETE.md](./GATE2_SETUP_COMPLETE.md) 🟡

4. **Monitor in-progress gates:**
   - [GATE3_MONITORING_GUIDE.md](./GATE3_MONITORING_GUIDE.md) 🔵
   - [GATE4_DATA_QUALITY_GUIDE.md](./GATE4_DATA_QUALITY_GUIDE.md) ⏳

### For Daily Operations:

**Every Day:**
```bash
# Check Gate 3 metrics
curl https://bella-spa-erp.vercel.app/api/gate3/metrics | jq

# Run Gate 4 monitoring
./scripts/gate4-monitor.sh
```

**Every 6 Hours (during Gate 3):**
```sql
-- Run manual SQL queries from GATE3_MONITORING_GUIDE.md
-- Check: Retry Rate, Error Rate, p95/p99 Latency
```

**Weekly:**
- Review [GATES_PROGRESS_SUMMARY.md](./GATES_PROGRESS_SUMMARY.md)
- Update status tables
- Document any issues or findings

---

## 📊 Monitoring Endpoints

### Health & Metrics:
- **Health Check:** `GET /api/decision-engine/health`
- **Gate 3 Metrics:** `GET /api/gate3/metrics`
- **Audit Logs:** `GET /api/decision-engine/audit?limit=50`

### Admin Operations:
- **Replay Decision:** `POST /api/decision-engine/replay/{decisionId}`
- **View Trace:** `GET /api/decision-engine/trace/{traceId}`

### Cron Jobs (Protected):
- **Gate 3 Monitor:** `GET /api/cron/gate3-monitor` (daily at 19:00 VN)

---

## 🔑 Key Terminology

| Term | Definition |
|------|------------|
| **Decision Engine** | Rule-based system for automating business decisions |
| **Audit Log** | Immutable record of every decision with full context |
| **Replay** | Re-execute a past decision to verify determinism |
| **Trace** | Correlation ID linking related decisions in a flow |
| **Circuit Breaker** | Protection mechanism that opens when audit failures exceed threshold |
| **DLQ** | Dead Letter Queue - failed audit logs after all retries exhausted |
| **RLS** | Row-Level Security - Supabase database access control |
| **Gate** | Production readiness validation phase |

---

## 🎯 Production Rollout Checklist

### Minimum Requirements (BLOCKING):
- [x] Gate 1: Functional validation passed (6/6 checks)
- [x] Gate 2: Resilience proven (Scenario 2.1 passed)
- [ ] Gate 3: 72-hour monitoring complete (in progress)
- [ ] Gate 4: Baseline data quality established (pending)

### Additional Criteria (RECOMMENDED):
- [ ] 500-1000 decisions collected in staging
- [ ] Zero rollback triggers fired
- [ ] Operational team trained on health endpoint
- [ ] Runbook updated with observed metrics

### Sign-Off Required:
- [ ] Tech Lead
- [ ] Product Owner
- [ ] Operations Team

**Target Date:** July 19, 2026

---

## 🚨 Rollback Triggers

**Immediate rollback if:**
1. Business logic blocked by audit failure
2. DLQ rate > 10% (systemic audit failure)
3. Circuit breaker stuck OPEN > 1 hour
4. p95 latency > 1 second for > 30 minutes
5. Memory leak detected (> 1GB and increasing)

**Rollback procedure:** See [STAGING_PRODUCTION_GATES.md](./STAGING_PRODUCTION_GATES.md#rollback-triggers-)

---

## 📧 Contact & Support

**Questions about:**
- **Gate philosophy:** Review [ENGINEERING_STANDARD.md](./ENGINEERING_STANDARD.md)
- **Gate status:** Check [GATES_PROGRESS_SUMMARY.md](./GATES_PROGRESS_SUMMARY.md)
- **Monitoring:** See gate-specific guides (GATE3/GATE4)
- **Production issues:** Follow rollback procedure in main gates doc

**Related Documentation:**
- Main docs: `docs/decision-engine/`
- Scripts: `scripts/gate*.{sh,js}`
- API routes: `src/app/api/decision-engine/`, `src/app/api/gate3/`, `src/app/api/cron/`

---

## 🔄 Document Update Frequency

| Document | Update Frequency |
|----------|------------------|
| GATES_PROGRESS_SUMMARY.md | Daily (during gates) |
| GATE3_START_MARKER.md | Every 6 hours (during monitoring) |
| GATE4_START_MARKER.md | Daily (during collection) |
| STAGING_PRODUCTION_GATES.md | Rarely (only when gates change) |
| ENGINEERING_STANDARD.md | Rarely (philosophy changes) |
| This README | Weekly (or when structure changes) |

---

**Last Updated:** July 5, 2026  
**Next Review:** July 8, 2026 (after Gate 3 completion)

---

## 🎓 Philosophy Reminder

> **"Staging không phải là môi trường xem trước. Đây là giai đoạn thu thập bằng chứng."**

> "Staging is NOT a preview environment. It's an evidence-gathering phase."

If you can't prove it with data from staging, don't ship it to production.

---

**🚀 Ready for production by July 19, 2026!**
