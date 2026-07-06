# Sprint 2 - Quick Test Checklist

**Deploy Date:** June 22, 2026  
**Vercel URL:** https://bella-spa-erp-<branch-slug>.vercel.app  
**Test Tenant:** beauty  
**Estimated Time:** 15-30 minutes

---

## 🚀 Pre-Test Setup (5 min)

### 1. Verify Deployment
- [ ] Vercel build passed with green checkmark
- [ ] Open Vercel preview URL
- [ ] Login as Admin on beauty tenant
- [ ] Navigate to `/dashboard/sessions` (Leave Approval page)

### 2. Quick Data Check
- [ ] At least 1 pending leave request exists
- [ ] Leave requests have various scenarios:
  - [ ] One with sufficient balance (>= 1 day)
  - [ ] One with 0 balance
  - [ ] One with < 24h notice (if possible)

---

## ✅ Core Test (10 min)

### Test 1: Happy Path (APPROVE)
**Pick:** Leave request with balance >= 1, no violations, > 24h notice

- [ ] Click on leave request
- [ ] Wait for Decision Engine recommendation to load
- [ ] **Expected:** ✅ Green panel with "Khuyến nghị: PHÊ DUYỆT"
- [ ] **Verify:** Execution time < 100ms

**PASS / FAIL:** _________

---

### Test 2: Reject - No Balance
**Pick:** Leave request from KTV with 0 balance

- [ ] Click on leave request
- [ ] Wait for recommendation
- [ ] **Expected:** ❌ Red panel with "Khuyến nghị: TỪ CHỐI"
- [ ] **Verify:** Explanation mentions "Insufficient leave balance"

**PASS / FAIL:** _________

---

### Test 3: Escalate - Session Conflict
**Pick:** Leave request where KTV has scheduled session on that date

- [ ] Click on leave request
- [ ] Wait for recommendation
- [ ] **Expected:** ⚠️ Yellow panel with "Khuyến nghị: CẦN XEM XÉT"
- [ ] **Verify:** Explanation mentions "Sessions scheduled"

**PASS / FAIL:** _________

---

## 🔍 Console Check (5 min)

### Browser Console Logs
- [ ] Open DevTools → Console tab
- [ ] Select a leave request
- [ ] Look for `[DecisionEngine]` log entry
- [ ] **Verify log contains:**
  ```json
  {
    "timestamp": "...",
    "policy": "leave-approval-v1",
    "policyVersion": "1.0.0",
    "outcome": "APPROVE" | "REJECT" | "ESCALATE",
    "reason": "...",
    "durationMs": <number>,
    "knowledge": {
      "hoursNotice": <number>,
      "balance": <number>,
      "violations": <number>,
      "hasConflict": <boolean>
    }
  }
  ```

**PASS / FAIL:** _________

---

## 🐛 Error Check (5 min)

### No Critical Errors
- [ ] No red errors in browser console
- [ ] No "Failed to fetch" errors
- [ ] No Supabase query errors
- [ ] No TypeScript type errors

**PASS / FAIL:** _________

---

## 📊 Performance Check (2 min)

### Timing Verification
- [ ] Recommendation loads within 2 seconds
- [ ] `durationMs` in logs is < 100ms
- [ ] No loading spinner hangs

**PASS / FAIL:** _________

---

## ✅ Final Verdict

**All Core Tests Pass?** YES / NO

**Console Logs Correct?** YES / NO

**No Critical Errors?** YES / NO

**Performance Acceptable?** YES / NO

---

## 🎯 Next Steps

### If All Pass ✅
- [ ] Mark Sprint 2 as **DEPLOYED TO STAGING**
- [ ] Begin **Production Soak** (3-5 days monitoring)
- [ ] Update deployment log in `SPRINT2_COMPLETION_SUMMARY.md`
- [ ] Plan Sprint 3 (Booking Capacity policy)

### If Any Fail ❌
- [ ] Document failures in this checklist
- [ ] Create bug report using template in `MANUAL_TEST_GUIDE.md`
- [ ] Fix critical bugs
- [ ] Redeploy and re-test

---

## 📝 Test Notes

**Date Tested:** __________________  
**Tested By:** __________________  
**Browser:** __________________  
**Deployment URL:** __________________

**Issues Found:**
- [ ] None
- [ ] Minor (document below)
- [ ] Blocking (document below)

**Details:**
```
[Write any issues or observations here]
```

---

## 🎉 Success Criteria Met

- [ ] Decision Engine recommendations appear correctly
- [ ] All 3 outcomes (APPROVE/REJECT/ESCALATE) work
- [ ] Performance < 100ms
- [ ] No JavaScript errors
- [ ] Structured logs in console
- [ ] UI panels display correct colors
- [ ] Admin can still override recommendations

**Sprint 2 Status:** READY FOR PRODUCTION SOAK ✅

