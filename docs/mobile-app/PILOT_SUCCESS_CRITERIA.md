# 🎯 PILOT SUCCESS CRITERIA - BELLA SPA MOBILE

**Version**: v0.1.0 (Pilot Phase)  
**Duration**: 7 days  
**Participants**: 2-3 KTVs + 1 Admin + 1 Owner  
**Start Date**: TBD (after RPC deployment + device testing)  
**Goal**: Validate app stability, usability, and data accuracy before scaling to all KTVs

---

## 📊 PILOT OVERVIEW

### Participants Profile

| Role | Count | Criteria |
|------|-------|----------|
| **KTV** | 2-3 | Active staff, tech-comfortable, willing to give feedback |
| **Admin** | 1 | Branch manager or supervisor with web system access |
| **Owner** | 1 | Spa owner or operations lead (optional observer) |

**Total**: 3-5 users  
**Location**: Single spa location (Bella Spa Hà Nội)  
**Timeline**: 7 consecutive days (1 full week)

---

## ✅ SUCCESS CRITERIA (PASS)

To consider pilot successful, ALL of the following must be met:

### 1. Authentication & Access (CRITICAL)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Login Success Rate** | ≥95% | Successful logins / Total attempts |
| **Login Time** | <5 seconds | Average time from submit to dashboard |
| **Session Stability** | 0 unexpected logouts | No forced re-login during usage |

**Verification**:
- All 3-5 users can login on Day 1
- No more than 1 login failure per 20 attempts across all users
- Users stay logged in for entire work shift (8+ hours)

---

### 2. Performance (HIGH PRIORITY)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Dashboard Load Time** | <3 seconds | From login to data displayed |
| **Pull-to-Refresh** | <2 seconds | Time to reload session list |
| **App Launch Time** | <5 seconds | Cold start to interactive |

**Verification**:
- Use stopwatch during device testing
- Measure on both iPhone and Android
- Test with realistic data (8-10 sessions per KTV)

**P95 Targets** (95% of requests):
- Dashboard load: <3s
- Refresh: <2s
- RPC calls: <200ms

---

### 3. Stability & Reliability (CRITICAL)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Crash Rate** | 0% | App crashes / Total sessions |
| **Error Rate** | <2% | Failed operations / Total operations |
| **Data Load Success** | 100% | Sessions loaded successfully |

**Verification**:
- **0 crashes** during 7-day pilot (zero tolerance)
- **0 blank screens** or infinite loading states
- **0 "Network error" when WiFi/4G available**
- All KTVs see their sessions on first load

**Operations Tracked**:
- App opens
- Dashboard loads
- Pull-to-refresh
- Profile views
- Logout

---

### 4. Data Accuracy (CRITICAL)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **KTV Session Isolation** | 100% correct | KTV sees only assigned sessions |
| **Stats Accuracy** | 100% correct | Tổng ca, Hoàn thành, Còn lại matches reality |
| **Customer Info Accuracy** | 100% correct | Names, packages match web system |
| **Realtime Sync** | <30 seconds | Changes on web appear in app |

**Verification**:
- Daily cross-check: Mobile vs Web system
- Admin verifies each KTV sees correct sessions
- Update 1 session on web → appears in app within 30s
- Test cases:
  - KTV1 cannot see KTV2's sessions ✅
  - Admin sees all sessions ✅
  - Stats match manual count ✅

**Zero Tolerance Issues**:
- ❌ Wrong KTV assignment (security breach)
- ❌ Missing sessions (data loss)
- ❌ Wrong customer names (critical error)

---

### 5. Usability & User Understanding (HIGH PRIORITY)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Self-Service Rate** | ≥80% | Users complete tasks without help |
| **Understanding Score** | ≥4/5 | Users understand how to use app |
| **Documentation Sufficiency** | ≥4/5 | Guides answer user questions |

**Verification**:
- **Day 1**: Install + login without tech support
- **Day 2-3**: Use app daily without asking questions
- **Day 7**: Survey with 5 questions (1-5 scale):
  1. I understand how to view my schedule (Target: ≥4)
  2. I understand how to refresh data (Target: ≥4)
  3. I can use the app without help (Target: ≥4)
  4. The guides are clear and helpful (Target: ≥4)
  5. I would use this app regularly (Target: ≥4)

**Red Flags**:
- ❌ KTV asks "Where is my schedule?" after Day 1
- ❌ KTV needs daily tech support
- ❌ KTV confuses app data with reality

---

### 6. Realtime & Network Resilience (MEDIUM PRIORITY)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Offline Detection** | 100% | Shows error when no Internet |
| **Offline Recovery** | <5 seconds | Reconnects when Internet returns |
| **Realtime Updates** | <30 seconds | Web changes → mobile refresh |

**Verification**:
- Turn off WiFi → app shows "No Internet" error ✅
- Turn on WiFi → app recovers automatically ✅
- Admin updates session on web → KTV refreshes and sees change within 30s ✅

---

## ❌ FAILURE CRITERIA (FAIL)

If **ANY** of these occur, pilot is considered **FAILED** and must be halted:

### 🔴 Security Failures (IMMEDIATE HALT)
- [ ] **KTV sees other KTV's sessions** (privacy breach)
- [ ] **Cross-tenant data leakage** (sees different spa's data)
- [ ] **Unauthorized access** (can access without login)

**Action**: STOP pilot immediately, investigate, fix, restart pilot.

---

### 🔴 Data Integrity Failures (IMMEDIATE HALT)
- [ ] **Data loss**: Sessions disappear from app
- [ ] **Data corruption**: Wrong customer assigned to session
- [ ] **KPI calculation errors**: Stats don't match reality >10% variance

**Action**: STOP pilot, root cause analysis, verify database integrity, fix, restart.

---

### 🔴 Stability Failures (HALT IF PERSISTENT)
- [ ] **Crash rate >2%** (more than 1 crash per 50 operations)
- [ ] **Blank screen >5 minutes** (data fails to load)
- [ ] **App becomes unusable** (freeze, extreme lag >10s)

**Action**: Investigate immediately. If not fixable within 24h, HALT pilot.

---

### 🟠 Performance Failures (REVIEW REQUIRED)
- [ ] **Dashboard load >5 seconds** consistently (P95)
- [ ] **Refresh >5 seconds** consistently
- [ ] **Users complain app is "too slow"** (>50% of users)

**Action**: Performance profiling, add indexes if needed, may continue pilot if fixable.

---

### 🟡 Usability Failures (REVIEW REQUIRED)
- [ ] **>50% of users need daily tech support**
- [ ] **>50% of users say "too confusing"**
- [ ] **Users prefer paper/whiteboard over app**

**Action**: Review UX, update guides, provide training, may continue pilot with adjustments.

---

## 📋 DAILY MONITORING CHECKLIST

### Day 1: Installation & First Use
- [ ] All users installed app successfully
- [ ] All users logged in successfully
- [ ] All users see their correct schedule
- [ ] No crashes reported
- [ ] Collect initial feedback

**Expected Issues**: Minor confusion, questions about features  
**Red Flags**: Cannot login, wrong data, crashes

---

### Day 2-3: Regular Usage
- [ ] Users open app at start of shift
- [ ] Users refresh data before each session
- [ ] No tech support needed
- [ ] No crashes reported
- [ ] Stats accuracy verified (cross-check with web)

**Expected Issues**: Occasional refresh failures (network)  
**Red Flags**: Daily tech support needed, data errors

---

### Day 4-5: Stress Testing
- [ ] High session volume days (10+ sessions per KTV)
- [ ] Multiple KTVs using simultaneously
- [ ] Admin and KTVs both active
- [ ] Realtime updates tested (web → mobile)
- [ ] Performance under load measured

**Expected Issues**: Slight slowdown during peak  
**Red Flags**: Crashes, timeouts, data conflicts

---

### Day 6-7: Feedback & Evaluation
- [ ] Survey distributed to all users
- [ ] Bug reports collected and categorized
- [ ] Feature requests logged
- [ ] Success/failure determination
- [ ] Go/No-Go decision for scaling

---

## 📊 DATA COLLECTION REQUIREMENTS

### Automated Metrics (if audit logging enabled)
```sql
-- Query from rpc_access_log (if deployed)
SELECT 
  rpc_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
FROM rpc_access_log
WHERE created_at >= PILOT_START_DATE
GROUP BY rpc_name;
```

### Manual Metrics (collect daily)
| Metric | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|--------|-------|-------|-------|-------|-------|-------|-------|
| Login attempts | | | | | | | |
| Login failures | | | | | | | |
| Crashes | | | | | | | |
| Tech support calls | | | | | | | |
| Data accuracy issues | | | | | | | |
| User complaints | | | | | | | |

---

## 🎯 GO/NO-GO DECISION FRAMEWORK

### ✅ GO (Proceed to Week 4)
**Conditions**:
- ✅ All SUCCESS CRITERIA met
- ✅ Zero FAILURE CRITERIA triggered
- ✅ Users satisfied (≥4/5 survey score)
- ✅ Admin confirms data accuracy
- ✅ Owner approves scaling

**Action**: 
- Scale to 10-15 KTVs (Phase 2)
- Begin Week 4 development (QR Check-in + GPS)
- Deploy audit logging migration
- Plan for 2nd pilot with larger group

---

### ⚠️ GO WITH CONDITIONS (Conditional Pass)
**Conditions**:
- ✅ Most SUCCESS CRITERIA met
- ⚠️ Minor performance issues (fixable)
- ⚠️ Usability feedback requires UX tweaks
- ✅ No FAILURE CRITERIA triggered
- ⚠️ Users satisfied but with reservations (3.5-4/5)

**Action**:
- Fix identified issues first (1-2 weeks)
- Run mini-pilot (2-3 days) to verify fixes
- Then proceed to Week 4

---

### ❌ NO-GO (Do NOT proceed)
**Conditions**:
- ❌ Any FAILURE CRITERIA triggered
- ❌ Users unsatisfied (<3/5 survey score)
- ❌ Data accuracy issues persist
- ❌ Crash rate >1%
- ❌ Admin/Owner vetoes scaling

**Action**:
- **Root cause analysis** (1-2 days)
- **Fix critical issues** (1-2 weeks)
- **Re-test internally** (dev/QA)
- **Re-run pilot** from Day 1
- DO NOT proceed to Week 4 until pilot passes

---

## 📈 SUCCESS PROBABILITY ESTIMATE

Based on Week 1-3 preparation:

| Category | Probability | Reasoning |
|----------|-------------|-----------|
| **Authentication** | 95% | Well-tested, Supabase Auth is stable |
| **Performance** | 85% | RPC optimized, but needs real device verification |
| **Stability** | 90% | No known crashes, error handling complete |
| **Data Accuracy** | 95% | RPCs reviewed, security tested, KTV isolation verified |
| **Usability** | 80% | Guides created, but untested with real users |
| **Realtime** | 75% | Depends on network conditions, needs monitoring |

**Overall Estimated Success**: **85%** (with current preparation)

**Improvement Needed**:
- ⚠️ Real device testing (iPhone + Android) - BLOCKING
- ⚠️ Network resilience testing - HIGH PRIORITY
- ⚠️ Usability testing with non-tech users - MEDIUM PRIORITY

---

## 📞 ESCALATION PROCEDURES

### Minor Issues (Performance, Usability)
- **Report to**: Dev team lead
- **Response Time**: 24 hours
- **Fix Timeline**: 2-3 days
- **Pilot Status**: Continue with monitoring

### Major Issues (Crashes, Errors)
- **Report to**: Dev team + Admin
- **Response Time**: 4 hours
- **Fix Timeline**: 24 hours
- **Pilot Status**: Pause if >3 issues in 24h

### Critical Issues (Security, Data Loss)
- **Report to**: Dev team + Admin + Owner
- **Response Time**: IMMEDIATE
- **Fix Timeline**: ASAP (hours not days)
- **Pilot Status**: **HALT IMMEDIATELY**

---

## 📄 PILOT COMPLETION REPORT TEMPLATE

At end of Day 7, complete this report:

```markdown
# PILOT COMPLETION REPORT

**Date**: ___________  
**Duration**: 7 days  
**Participants**: ___ KTVs, ___ Admin, ___ Owner

## METRICS ACHIEVED
- Login Success Rate: ____%
- Average Dashboard Load Time: ___s
- Crash Rate: ____%
- Data Accuracy Rate: ____%
- User Satisfaction Score: ___/5

## SUCCESS CRITERIA STATUS
- [ ] Authentication & Access: PASS / FAIL
- [ ] Performance: PASS / FAIL
- [ ] Stability: PASS / FAIL
- [ ] Data Accuracy: PASS / FAIL
- [ ] Usability: PASS / FAIL
- [ ] Realtime: PASS / FAIL

## FAILURE CRITERIA TRIGGERED
- [ ] None
- [ ] Security Failures: _______
- [ ] Data Integrity Failures: _______
- [ ] Stability Failures: _______
- [ ] Performance Failures: _______
- [ ] Usability Failures: _______

## ISSUES ENCOUNTERED
1. Issue: _____ | Severity: _____ | Status: _____
2. Issue: _____ | Severity: _____ | Status: _____
3. ...

## USER FEEDBACK HIGHLIGHTS
- Positive: _______
- Negative: _______
- Suggestions: _______

## GO/NO-GO DECISION
- [ ] ✅ GO - Proceed to Week 4 and scaling
- [ ] ⚠️ GO WITH CONDITIONS - Fix X, Y, Z first
- [ ] ❌ NO-GO - Requires major rework

## NEXT STEPS
1. _______
2. _______
3. _______

**Signed**:  
Dev Team Lead: ___________  
Admin: ___________  
Owner: ___________  
Date: ___________
```

---

## 🎓 LESSONS LEARNED (To Be Updated Post-Pilot)

This section will be filled after pilot completion. Expected learnings:
- Real device performance vs emulator
- User behavior patterns
- Common confusion points
- Network stability in real environment
- RPC performance under real load
- Documentation gaps

---

**This document defines the objective criteria for pilot success. All stakeholders must review and agree before pilot start.**

---

*PILOT_SUCCESS_CRITERIA.md*  
*Version 1.0 - Created: 2026-06-22*  
*Updated: TBD (after pilot completion)*
