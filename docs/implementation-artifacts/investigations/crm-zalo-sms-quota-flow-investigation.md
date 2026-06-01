# Investigation: CRM Zalo SMS Quota Flow

## Hand-off Brief

1. **What happened.** Confirmed: CRM Zalo flows check SMS quota before sending, but they perform message/status/audit side effects before incrementing the SMS usage counter.
2. **Where the case stands.** Active; source trace is sufficient to plan a fix, but no runtime production logs or Zalo API traces were inspected.
3. **What's needed next.** Use `bmad-quick-dev` to harden CRM/Zalo side effects: fail closed on database sub-actions, align counter increment with actual sends, and add side-effect tests.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-06-02 |
| Status | Active |
| System | Next.js server actions, Supabase, Zalo ZNS integration |
| Evidence sources | `src/services/crm/campaigns.ts`, `src/services/crm/zalo-messaging.ts`, repository grep for SMS quota usage |

## Problem Statement

User asked to continue with the next recommended area: investigate CRM/Zalo/SMS campaign quota flow after subscription/quota refactors.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `src/services/crm/campaigns.ts` | Available | Birthday greeting flow inspected with line references. |
| `src/services/crm/zalo-messaging.ts` | Available | ZNS send, single reminder, and batch reminder flows inspected. |
| Tests | Partial | Repository grep did not show dedicated CRM/Zalo quota side-effect tests. |
| Production logs/Zalo API traces | Missing | Would confirm real-world failure modes and duplicate sends. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Add tests for counter failure after send side effects | High | Open | Current code can return error after side effects have already happened. |
| 2 | Decide whether failed/simulated Zalo sends should consume quota | High | Open | Current code increments even when `sendZaloZNS` fails or phone is missing. |
| 3 | Add campaign/batch quota strategy | Medium | Open | Current batch calls per-session single-send flow; no batch reservation. |
| 4 | Harden DB notification/audit side effects | Medium | Open | Notification insert warning is swallowed; audit failure is caught by outer catch after prior side effects. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-06-02 | Subscription quota runtime moved to entitlement/counter schema. | Recent commits through `f7c435dd` | Confirmed |
| 2026-06-02 | CRM/Zalo quota flow investigation opened. | User request | Confirmed |

## Confirmed Findings

### Finding 1: Birthday greeting checks quota before send but increments after side effects

**Evidence:** `src/services/crm/campaigns.ts:87`, `src/services/crm/campaigns.ts:132`, `src/services/crm/campaigns.ts:147`, `src/services/crm/campaigns.ts:165`, `src/services/crm/campaigns.ts:179`

**Detail:** `sendBirthdayGreeting` calls `checkSubscriptionLimit`, then attempts ZNS send, inserts a notification, records audit log, and only then calls `incrementSmsCount`.

### Finding 2: Reminder flow has the same post-send counter increment pattern

**Evidence:** `src/services/crm/zalo-messaging.ts:84`, `src/services/crm/zalo-messaging.ts:155`, `src/services/crm/zalo-messaging.ts:166`, `src/services/crm/zalo-messaging.ts:183`, `src/services/crm/zalo-messaging.ts:201`, `src/services/crm/zalo-messaging.ts:215`

**Detail:** `triggerZaloReminder` checks quota, sends or simulates ZNS, updates `session_logs.zalo_reminder_sent`, inserts a notification, records audit log, and only then increments usage.

### Finding 3: Failed or unavailable Zalo send is logged as simulated success and still consumes SMS quota

**Evidence:** `src/services/crm/campaigns.ts:132`, `src/services/crm/campaigns.ts:135`, `src/services/crm/campaigns.ts:142`, `src/services/crm/campaigns.ts:179`, `src/services/crm/zalo-messaging.ts:155`, `src/services/crm/zalo-messaging.ts:158`, `src/services/crm/zalo-messaging.ts:178`, `src/services/crm/zalo-messaging.ts:215`

**Detail:** Both flows set `isRealSent = false` on Zalo failure/no phone, create a simulated log message, and still increment SMS usage. This may be intentional sandbox behavior, but it is not documented in code or tests.

### Finding 4: Batch reminders delegate quota handling to each single-send call

**Evidence:** `src/services/crm/zalo-messaging.ts:270`, `src/services/crm/zalo-messaging.ts:306`

**Detail:** `triggerBatchReminders` scans sessions per tenant and calls `triggerZaloReminder` per qualifying session. There is no batch-level reservation, so quota enforcement is per message attempt.

### Finding 5: Notification insert failure is swallowed

**Evidence:** `src/services/crm/campaigns.ts:147`, `src/services/crm/campaigns.ts:160`, `src/services/crm/zalo-messaging.ts:183`, `src/services/crm/zalo-messaging.ts:196`

**Detail:** Both flows only `console.warn` when notification insert fails, then continue to audit and counter increment. This conflicts with the project rule against silent side-effect failure if notification persistence is considered a required side effect.

## Deduced Conclusions

### Deduction 1: Usage counter can undercount real sends if increment fails after Zalo succeeds

**Based on:** Findings 1 and 2.

**Reasoning:** The real send happens before `incrementSmsCount`. If `incrementSmsCount` throws, the outer catch returns an error but cannot undo the already-sent Zalo message or status updates.

**Conclusion:** Current workflow is not atomic-safe across external send, local side effects, and quota metering.

### Deduction 2: Campaign/batch cannot reserve remaining quota before a burst

**Based on:** Finding 4.

**Reasoning:** The code only checks quota one message at a time. That reduces blast radius for sequential sends, but it cannot guarantee a batch will fit before starting.

**Conclusion:** Batch behavior should be explicitly defined: per-message best effort or preflight reservation/limit.

## Hypothesized Paths

### Hypothesis 1: Sandbox simulation intentionally consumes quota

**Status:** Open

**Theory:** The system treats a simulated fallback as a billable/logical outbound message for testing and operational visibility.

**Supporting indicators:** Simulated log messages are explicitly inserted before the counter increment.

**Would confirm:** Product requirement or existing test asserting failed/no-phone Zalo attempts should count toward SMS usage.

**Would refute:** Requirement that only real Zalo API success consumes quota.

**Resolution:** Pending.

### Hypothesis 2: Notification insert is optional telemetry

**Status:** Open

**Theory:** Notification insert is not a required business side effect and may safely warn without failing the send flow.

**Supporting indicators:** Code explicitly uses `console.warn` and continues.

**Would confirm:** Product requirement that notification logs are best-effort only.

**Would refute:** Requirement that every send must be visible in UI/logs and tests must fail if log persistence fails.

**Resolution:** Pending.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Product rule for simulated/failed Zalo sends consuming quota | Determines whether counter should increment only on `isRealSent` or on every attempted message | Confirm with owner or inspect older specs |
| Dedicated CRM/Zalo quota tests | Determines current expected behavior | Add or locate tests for `sendBirthdayGreeting`, `triggerZaloReminder`, and `triggerBatchReminders` |
| Production Zalo failure logs | Confirms frequency and impact of post-send counter failures or simulated sends | Inspect app logs and `Notification` rows |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Entry point 1 | `src/services/crm/campaigns.ts:67` `sendBirthdayGreeting` |
| Entry point 2 | `src/services/crm/zalo-messaging.ts:64` `triggerZaloReminder` |
| Batch entry point | `src/services/crm/zalo-messaging.ts:224` `triggerBatchReminders` |
| Quota check | `src/services/crm/campaigns.ts:88`, `src/services/crm/zalo-messaging.ts:85` |
| External send | `src/services/crm/campaigns.ts:132`, `src/services/crm/zalo-messaging.ts:155` |
| Counter increment | `src/services/crm/campaigns.ts:179`, `src/services/crm/zalo-messaging.ts:215` |
| Related files | `src/lib/subscription.ts`, `src/services/crm/zalo-config.ts`, `src/services/audit-actions.ts` |

## Conclusion

**Confidence:** Medium

The evidence shows the CRM/Zalo flows are not atomic-safe around SMS quota metering: they check before sending, perform multiple side effects, and increment after those side effects. The most important unresolved product decision is whether failed/simulated Zalo messages should count against quota; once that is decided, implementation can harden the flow and add side-effect assertions.

## Recommended Next Steps

### Fix direction

Use `bmad-quick-dev` for a focused hardening batch:

- Add tests for `sendBirthdayGreeting` and `triggerZaloReminder` covering quota blocked, send success + counter increment, counter failure after send, and notification/audit failure behavior.
- Decide and encode the quota rule for simulated/failed sends.
- Return explicit failures for required DB side effects instead of warning-only behavior.
- Consider a preflight remaining-quota check or reservation strategy for `triggerBatchReminders` if batch all-or-nothing behavior is required.

### Diagnostic

- Confirm business rule: "count only real ZNS success" vs. "count every attempted/simulated outbound."
- Inspect whether `Notification` rows are required auditability or best-effort UI telemetry.

## Reproduction Plan

1. Mock `checkSubscriptionLimit` to allow one SMS.
2. Mock `sendZaloZNS` success.
3. Mock `incrementSmsCount` failure.
4. Call `sendBirthdayGreeting` or `triggerZaloReminder`.
5. Observe that upstream receives an error after earlier send/log/status side effects have already occurred.

## Side Findings

- Confirmed: `getBirthdayCustomers` returns `[]` on query failure instead of surfacing DB errors (`src/services/crm/campaigns.ts:26`). This is outside SMS quota metering but violates the zero silent database failures rule if the caller depends on accurate CRM birthday data.
