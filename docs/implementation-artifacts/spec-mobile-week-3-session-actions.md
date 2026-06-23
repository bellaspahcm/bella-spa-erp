# Spec: Mobile Week 3 — Session Actions & Customer Profile

**Created:** 2026-06-22
**Status:** Planning → Implementation
**Type:** Feature (Mobile App Phase 1 Week 3)
**Risk Level:** 🔴 High (database writes, RLS changes, atomic operations)

---

## Intent

### Problem
- Mobile app hiện tại chỉ read-only dashboard (Week 1-2)
- KTV không thể thực hiện actions: complete session, add notes
- Phát hiện lỗ hổng RLS: `session_logs` UPDATE policy không hoạt động đúng
- Missing customer profile view
- No permission guards

### Approach
**Tuân thủ BMAD:** Brainstorm → Model → Analyze → Develop
- Phase 1 (Brainstorm): Đọc Week 3 plan, identify risks
- Phase 2 (Model): Create spec artifact này (CURRENT)
- Phase 3 (Analyze): Review với stakeholders, identify gotchas
- Phase 4 (Develop): Implement theo spec, verify từng bước

**Không ảnh hưởng Bella ERP hiện tại:**
- ✅ Chỉ thêm mobile features, không sửa web app
- ✅ RPC migrations additive only (không drop/alter existing)
- ✅ RLS fix chỉ ảnh hưởng mobile role checks (web không dùng policy này)
- ✅ Shared package chỉ thêm types, không breaking changes

---

## Scope

### In Scope (Week 3)
✅ **Fix RLS Security Hole**
- Fix `session_logs` UPDATE policy (join via bookings)
- Verify KTV A cannot update KTV B's sessions
- Add migration với rollback plan

✅ **Core Session Actions**
- View session detail
- Complete session (atomic, idempotent)
- Add session notes
- RPC với proper permission checks

✅ **Customer Profile View**
- Basic customer info
- Active booking summary
- Recent sessions list

✅ **Permission Guards**
- Route protection
- Action button visibility based on role
- Type-safe permission checks

✅ **Code Quality**
- Remove Week 2 fallback code (after RPC deployed)
- Comprehensive error handling
- Full TypeScript coverage

### Out of Scope (Deferred)
❌ QR code scanning → Week 4
❌ Optimistic UI updates → Week 4-5
❌ Session rescheduling → Week 5+
❌ Customer CRUD operations → Future
❌ Photo upload → Future

---

## Risk Analysis

### 🔴 High Risk: RLS Policy Fix

**Current Issue:**
```sql
-- BROKEN POLICY (từ migration 20260520000006)
CREATE POLICY "KTV cập nhật session_logs được phân công"
    ON session_logs
    FOR UPDATE
    USING (
        assigned_ktv_id = auth.uid()   -- ❌ Cột này KHÔNG TỒN TẠI!
        OR completed_by_ktv_id = auth.uid()
    );
```

**Impact:**
- KTV A có thể UPDATE sessions của KTV B (cùng tenant)
- Security hole trong production!

**Mitigation:**
1. Fix ngay lập tức trong Week 3
2. Test thoroughly before deploy
3. Có rollback plan
4. Document trong AGENTS.md

---

### 🔴 High Risk: Race Condition in Complete Session

**Problem:**
```typescript
// BAD: Check-then-act pattern (race condition)
const session = await getSession(id);
if (session.status !== 'completed') {
  await updateSession(id, { status: 'completed' });
}
```

**Solution:**
```sql
-- GOOD: Atomic UPDATE with WHERE clause
UPDATE session_logs
SET status = 'completed', completed_date = NOW()
WHERE id = p_session_id
  AND status <> 'completed'  -- Atomic check
RETURNING *;

GET DIAGNOSTICS affected_rows = ROW_COUNT;
IF affected_rows = 0 THEN
  RAISE EXCEPTION 'Already completed or not found';
END IF;
```

---

### 🔴 High Risk: `completed_sessions` Double Count

**Problem:**
```sql
-- BAD: Increment pattern (if retry → double count)
UPDATE bookings
SET completed_sessions = completed_sessions + 1
WHERE id = p_booking_id;
```

**Solution:**
```sql
-- GOOD: Derive from source of truth
UPDATE bookings
SET completed_sessions = (
  SELECT COUNT(*)
  FROM session_logs
  WHERE booking_id = bookings.id
    AND status = 'completed'
)
WHERE id = p_booking_id;
```

---

### 🟡 Medium Risk: Tenant Isolation

**Concern:** Mobile RPC must enforce tenant_id filter

**Mitigation:**
- All RPCs check `sl.tenant_id = p_tenant_id`
- Add to test matrix
- Document in RPC comments

---

### 🟡 Medium Risk: No Breaking Changes to Web

**Concern:** Week 3 changes might affect web app

**Mitigation:**
- Only additive changes (no drops/alters)
- RLS fix only affects mobile policies
- Shared package only adds types
- Run full web build after changes
- Verify `npm run test:critical` passes

---

## Architecture

### Database Changes

**New Migrations:**
1. `20260628_fix_session_logs_rls.sql` — Fix broken RLS policy
2. `20260628_mobile_complete_session_rpc.sql` — Atomic complete
3. `20260628_mobile_save_session_note_rpc.sql` — Note with permission check

**No Schema Changes:**
- ✅ No new tables
- ✅ No new columns
- ✅ Only RPC functions + RLS policy fix

---

### Mobile App Structure

```
apps/mobile/src/
├── services/
│   ├── session/
│   │   ├── fetchSessionDetail.ts      (NEW)
│   │   ├── completeSession.ts         (NEW)
│   │   └── saveSessionNote.ts         (NEW)
│   └── customer/
│       └── fetchCustomerProfile.ts    (NEW)
├── hooks/
│   ├── useSessionDetail.ts            (NEW)
│   └── useCustomerProfile.ts          (NEW)
├── components/
│   ├── PermissionGuard.tsx            (NEW)
│   ├── SessionDetailCard.tsx          (NEW)
│   ├── CompleteSessionButton.tsx      (NEW)
│   ├── SessionNoteInput.tsx           (NEW)
│   └── CustomerBookingCard.tsx        (NEW)
└── app/(app)/
    ├── session/[id].tsx               (NEW)
    └── customer/[id].tsx              (NEW)
```

---

### Shared Package Changes

```typescript
// packages/shared/src/types/domain.ts
export const SESSION_STATUS = { ... } as const;
export type SessionStatus = ...;
export function isSessionCompletable(status): boolean;

export interface SessionLogSummary { ... }
export interface BookingSummary { ... }
export interface CustomerMobileInfo { ... }
```

**Breaking Change Check:** ✅ No breaking changes (only additions)

---

## Implementation Plan

### Phase 1: Fix Security Issues (Priority 1)
**ETA:** Day 1 morning
- Bước 2-3: Fix RLS policy
- Verify: KTV A cannot update KTV B's sessions
- Deploy to staging immediately

### Phase 2: Core Session Actions (Priority 1)
**ETA:** Day 1 afternoon
- Bước 1: Add domain types to shared
- Bước 5-8: Create RPC migrations
- Bước 9-11: Create services
- Test: Complete session flow end-to-end

### Phase 3: UI Components (Priority 2)
**ETA:** Day 2
- Bước 13-19: Hooks + Components
- Bước 20-22: Screens
- Test: Full user flow on simulator

### Phase 4: Cleanup & Polish (Priority 3)
**ETA:** Day 3
- Bước 4: Remove Week 2 fallback code
- Bước 15: Add permission guards
- Bước 23: Full verification

---

## Verification Plan

### Automated Tests

**Must Pass:**
```bash
✓ npm run shared:typecheck
✓ npm run mobile:typecheck
✓ npm run build (web regression)
✓ npm run test:critical (payment, accounting, finance, salary)
```

**New Tests Needed:**
- [ ] RLS policy test (KTV isolation)
- [ ] Complete session idempotency test
- [ ] Race condition test (concurrent complete)
- [ ] Tenant isolation test

---

### Manual Tests

**Session Complete Flow:**
1. Login as KTV A
2. View today's sessions list
3. Tap on session
4. Press "Hoàn thành"
5. Verify status updates to "completed"
6. Verify `completed_sessions` increments correctly
7. Try to complete again → should show error
8. Check web app → should reflect change

**Permission Tests:**
1. Login as KTV A
2. Try to access KTV B's session (via URL)
3. Should show permission error
4. Try to complete KTV B's session (if somehow accessed)
5. Should fail with RLS error

**Race Condition Test:**
1. Open 2 mobile apps (different devices/simulators)
2. Login as same KTV
3. Both tap "Complete" on same session simultaneously
4. Only 1 should succeed
5. Other should show "Already completed" error

---

## Rollback Plan

### If RLS Fix Causes Issues

**Rollback migration:**
```sql
-- Restore old (broken) policy
CREATE POLICY "KTV cập nhật session_logs được phân công"
    ON session_logs
    FOR UPDATE
    USING (
        assigned_ktv_id = auth.uid()
        OR completed_by_ktv_id = auth.uid()
    );
```

**Impact:** Back to security hole, but mobile still works

---

### If Complete Session RPC Fails

**Fallback:** Disable "Complete" button in mobile
```typescript
// In CompleteSessionButton.tsx
const RPC_AVAILABLE = false; // Toggle này

if (!RPC_AVAILABLE) {
  return <Text>Tính năng tạm thời không khả dụng</Text>;
}
```

**Impact:** KTV must use web to complete sessions (temporary)

---

## Files to Modify/Create

### High Priority (Day 1)

**Migrations (CRITICAL):**
- `supabase/migrations/20260628_fix_session_logs_rls.sql`
- `supabase/migrations/20260628_mobile_complete_session_rpc.sql`
- `supabase/migrations/20260628_mobile_save_session_note_rpc.sql`

**Shared Package:**
- `packages/shared/src/types/domain.ts` (add types)
- `packages/shared/src/index.ts` (export new types)

**Services:**
- `apps/mobile/src/services/session/fetchSessionDetail.ts`
- `apps/mobile/src/services/session/completeSession.ts`
- `apps/mobile/src/services/session/saveSessionNote.ts`

### Medium Priority (Day 2)

**Hooks:**
- `apps/mobile/src/hooks/useSessionDetail.ts`
- `apps/mobile/src/hooks/useCustomerProfile.ts`

**Components:**
- `apps/mobile/src/components/PermissionGuard.tsx`
- `apps/mobile/src/components/SessionDetailCard.tsx`
- `apps/mobile/src/components/CompleteSessionButton.tsx`
- `apps/mobile/src/components/SessionNoteInput.tsx`

**Screens:**
- `apps/mobile/app/(app)/session/[id].tsx`

### Low Priority (Day 3)

**Customer Features:**
- `apps/mobile/src/services/customer/fetchCustomerProfile.ts`
- `apps/mobile/src/components/CustomerBookingCard.tsx`
- `apps/mobile/app/(app)/customer/[id].tsx`

**Cleanup:**
- `apps/mobile/src/services/dashboard/fetchTodaySessions.ts` (remove fallback)

---

## Success Criteria

### Must Have (Blocking Production)
- ✅ RLS policy fixed and verified
- ✅ Complete session works (atomic, idempotent)
- ✅ No double counting
- ✅ KTV isolation works
- ✅ Web app not affected
- ✅ All critical tests pass

### Should Have (Can ship without)
- ⏸️ Customer profile view (can defer to Week 4)
- ⏸️ Session notes (can defer to Week 4)
- ⏸️ Permission guards (can do manual check first)

### Nice to Have (Future)
- ⏸️ Optimistic UI
- ⏸️ QR code
- ⏸️ Photo upload

---

## Dependencies

### Prerequisites from Week 2
- ✅ Service layer structure
- ✅ Hooks pattern
- ✅ Context (Auth, Tenant)
- ✅ Component library basics
- ✅ Navigation setup

### External Dependencies
- ✅ Supabase RPC support
- ✅ Supabase RLS
- ✅ Expo Router navigation
- ✅ React Native 0.76.5

---

## Timeline

**Week 3 Sprint:**
- Day 1 AM: RLS fix + RPC migrations → **CRITICAL PATH**
- Day 1 PM: Services + basic hooks
- Day 2: UI components + screens
- Day 3: Testing + cleanup + deploy to staging

**Total:** 3 days

---

## Deferred Items (Documented)

| Item | Reason | Target Week |
|------|--------|-------------|
| QR code scanning | Need camera permissions setup | Week 4 |
| Optimistic UI | Complex, not blocking | Week 4-5 |
| Session rescheduling | Business logic clarification needed | Week 5+ |
| Photo upload | Storage setup needed | Week 6+ |
| Customer CRUD | Scope creep, admin feature | Future |

---

## Handoff

**This spec created by:** Kiro AI Agent
**Reviewed by:** _Pending_
**Approved by:** _Pending_

**Next steps:**
1. Review spec với team
2. Get approval from Product Manager
3. Deploy RLS fix to staging ASAP (security critical)
4. Start implementation (Bước 1)

**Questions to clarify:**
- [ ] Is RLS fix approved for immediate deploy?
- [ ] Any business rule changes for "complete session"?
- [ ] Customer profile: which fields are must-have?
- [ ] Timeline: 3 days realistic?

---

## Compliance Checklist

### BMAD Process ✅
- ✅ Brainstorm: Analyzed Week 3 plan
- ✅ Model: Created this spec
- ⏸️ Analyze: Pending review
- ⏸️ Develop: Pending approval

### AGENTS.md Rules ✅
- ✅ No silent database failures (RPC returns proper errors)
- ✅ Side-effect assertions (complete session updates booking)
- ✅ Strict typing (no `any` types)
- ✅ Atomic operations (UPDATE with WHERE + GET DIAGNOSTICS)
- ✅ Tenant isolation (all RPCs filter by tenant_id)

### No Impact on Bella ERP ✅
- ✅ Only additive changes (no drops/alters)
- ✅ Web app not affected (runs own build test)
- ✅ Beauty Spa module untouched
- ✅ No schema changes (only RPC + RLS)

---

**Status:** ✅ **SPEC READY FOR REVIEW**

**Approval Required Before Implementation:**
- [ ] Technical Lead
- [ ] Product Manager
- [ ] Security Review (RLS changes)

**Once approved, proceed to Bước 1**
