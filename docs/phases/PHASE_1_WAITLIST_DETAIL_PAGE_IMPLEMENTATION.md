# Waitlist Detail Page Implementation

**Date:** 2026-07-12  
**Status:** ✅ COMPLETE  
**Extension of:** Day 8-10 UI Components

---

## 🎯 Overview

Built a comprehensive detail page for individual waitlist entries that provides:
- Customer and service information cards
- Visual priority breakdown with score components
- Position timeline showing status changes
- Notification history (ready for Day 11-12 integration)
- Action buttons (notify, reserve, convert, cancel)

**Route:** `/dashboard/waitlist/[entryId]`

---

## 📁 Files Created (5 new files)

### 1. Page Structure
**File:** `src/app/dashboard/waitlist/[entryId]/page.tsx`
- Dynamic route parameter: `entryId`
- Suspense wrapper with loading fallback
- Passes `entryId` to content component

### 2. Main Content Component
**File:** `src/app/dashboard/waitlist/[entryId]/components/WaitlistDetailContent.tsx`
- **Responsibilities:**
  - Data fetching (entry details + notifications)
  - Loading/error state management
  - Actions handling (notify, reserve, convert, cancel)
  - Layout orchestration

- **State Management:**
  - `entry` - Current waitlist entry
  - `notifications` - Notification history (empty for now, Day 11-12)
  - `isLoading` - Initial load state
  - `isSyncing` - Refresh state
  - `error` - Error message
  - `isActionsOpen` - Actions dropdown visibility
  - `isProcessing` - Action in progress

- **API Integration:**
  - `GET /api/waitlist/:id` - Fetch entry details
  - `PATCH /api/waitlist/:id` - Update status (notify, reserve)
  - `DELETE /api/waitlist/:id` - Cancel entry
  - TODO: `GET /api/waitlist/:id/notifications` (Day 11-12)

- **Navigation:**
  - Back button → `/dashboard/waitlist`
  - Cancel action → Redirects to list after deletion

- **Refresh Integration:**
  - `usePageRefresh` hook for soft refresh on focus
  - Non-intrusive loading bar at top (matches Bookings pattern)

### 3. Detail Cards Component
**File:** `src/app/dashboard/waitlist/[entryId]/components/WaitlistDetailCards.tsx`

**Three Card Layout:**

#### Card 1: Customer Information
- Customer name (from `customer_name`)
- Phone number (placeholder - needs customer table join)
- Tier badge (VIP, Loyal, New) with color coding:
  - VIP → Yellow badge
  - Loyal → Blue badge
  - New → Gray badge

#### Card 2: Service Information
- Package name
- Price (formatted VNĐ)
- Duration (minutes)

#### Card 3: Preferences
- Preferred date (formatted dd/mm/yyyy)
- Preferred time (HH:MM or "Không chỉ định")
- Preferred KTV name (or "Không chỉ định")
- Flexibility indicator (Yes with icon / No)
- Notes (if provided)

**Responsive Layout:**
- Desktop: 2 columns (Customer + Service side-by-side), Preferences full-width below
- Mobile: All cards stacked vertically

### 4. Priority Breakdown Component
**File:** `src/app/dashboard/waitlist/[entryId]/components/WaitlistPriorityBreakdown.tsx`

**Visual Score Breakdown:**

Each component displayed as a horizontal bar chart:
1. **Tier Score** (max 40)
   - Yellow bar
   - Label: "Hạng VIP" / "Hạng LOYAL" / "Hạng NEW"
   - Score from `entry.tier_score`

2. **Value Score** (max 30)
   - Blue bar
   - Label: "Giá trị đơn"
   - Score from `entry.value_score`

3. **Wait Time Score** (max 20)
   - Purple bar
   - Label: "Thời gian chờ"
   - Score from `entry.wait_time_score`

4. **Flexibility Bonus** (max 10)
   - Emerald bar
   - Label: "Linh hoạt"
   - Score from `entry.flexibility_bonus`

**Total Score Display:**
- Larger bar showing total score / 100
- Color-coded by score range:
  - ≥80 → Emerald (excellent)
  - ≥60 → Blue (good)
  - ≥40 → Yellow (average)
  - <40 → Gray (low)

**Explanation Box:**
- Blue info box with score calculation rules
- Helps users understand priority logic

### 5. Position Timeline Component
**File:** `src/app/dashboard/waitlist/[entryId]/components/WaitlistPositionTimeline.tsx`

**Timeline Events (Auto-generated from entry data):**

1. **Created** (always present)
   - Icon: ➕
   - Label: "Thêm vào hàng (vị trí #X)"
   - Timestamp: `entry.created_at`
   - Color: Blue

2. **Notified** (if `entry.notified_at` exists)
   - Icon: 📢
   - Label: "Đã gửi thông báo"
   - Timestamp: `entry.notified_at`
   - Color: Green

3. **Reserved** (if `entry.reserved_at` exists)
   - Icon: ✅
   - Label: "Giữ chỗ thành công"
   - Timestamp: `entry.reserved_at`
   - Color: Yellow

4. **Converted** (if `entry.converted_at` exists)
   - Icon: 🎉
   - Label: "Chuyển đổi sang lịch hẹn"
   - Timestamp: `entry.converted_at`
   - Color: Emerald

5. **Cancelled** (if `entry.removed_at` exists)
   - Icon: ❌
   - Label: "Đã hủy (reason)"
   - Timestamp: `entry.removed_at`
   - Color: Red

**Timeline Visual:**
- Vertical line connecting events
- Emoji icons in colored circles
- Timestamps in dd/mm HH:MM format

**Wait Time Summary (below timeline):**
- Actual wait time (`entry.wait_minutes`)
- Estimated wait time (`entry.estimated_wait_minutes`)
- Displayed in hours/minutes format

### 6. Notification History Component
**File:** `src/app/dashboard/waitlist/[entryId]/components/WaitlistNotificationHistory.tsx`

**Notification Log Display:**

Each notification shows:
- **Channel badge:** Zalo / SMS / Email / Push
- **Status badge:** 
  - Pending (gray)
  - Sent (green)
  - Failed (red)
  - Cancelled (gray)
- **Type:** Có chỗ trống / Cập nhật vị trí / Sắp hết hạn / Đã hết hạn / Giữ chỗ thành công
- **Message content** (if available)
- **Timestamps:**
  - Sent time
  - Delivered time (if sent)
  - Read time (if delivered and read)
- **Error details** (if failed)
  - Error message
  - Retry count (X/Y attempts)
- **Customer response** (if available)
  - Accept / Decline / Later
  - Response timestamp

**Empty State:**
- Bell icon in gray circle
- "Chưa có thông báo"
- Explanation: "Thông báo sẽ được gửi khi có chỗ trống hoặc vị trí thay đổi"

**Note:** Currently shows empty state. Will populate with real data in Day 11-12 when notification service is integrated.

---

## 🎨 UI Design Highlights

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ ← Danh sách chờ                                     │ Back button
├─────────────────────────────────────────────────────┤
│ Vị trí #3 • [Đang chờ]           [Thao tác ▼]      │ Header + Actions
├─────────────────────────────────────────────────────┤
│ [Customer Card]    [Service Card]                   │ 2-col grid (desktop)
│ [Preferences Card - full width]                     │
│ [Priority Breakdown - full width]                   │
│ [Position Timeline - full width]                    │
│ [Notification History - full width]                 │
└─────────────────────────────────────────────────────┘
```

### Color System
- **Primary:** Rose/Pink (brand color)
- **Status colors:** Blue (active), Green (success), Yellow (warning), Gray (inactive), Red (error)
- **Tier badges:** Yellow (VIP), Blue (Loyal), Gray (New)
- **Priority bars:** Yellow (tier), Blue (value), Purple (wait time), Emerald (flexibility)

### Spacing & Typography
- Card padding: `p-6` (24px)
- Section gap: `space-y-6` (24px)
- Title: `text-lg font-semibold` (18px semibold)
- Label: `text-sm text-gray-600` (14px gray)
- Value: `text-base font-medium text-gray-900` (16px medium black)

### Responsive Breakpoints
- Mobile: < 640px (1 column, stacked cards)
- Tablet: 640-1024px (2 columns for some cards)
- Desktop: > 1024px (full 2-column layout)

---

## 🔌 Integration Points

### With Backend APIs
- `GET /api/waitlist/:id` → Fetch entry details
- `PATCH /api/waitlist/:id` → Update status (notify, reserve)
- `DELETE /api/waitlist/:id?reason=X` → Cancel entry
- TODO (Day 11-12): `GET /api/waitlist/:id/notifications` → Fetch notification logs

### With Components
- `WaitlistStatusBadge` → Reused from list page
- `useTenantContext` → Tenant isolation
- `usePageRefresh` → Auto-refresh on focus
- `useRouter` → Navigation (back button, cancel redirect)

### With Decision Engine
- Priority scores already calculated in `entry` object
- Visual breakdown shows Decision Engine's priority algorithm
- No real-time recalculation (uses saved scores)

---

## ⚙️ Actions Available

### By Status

#### Status: `active`
- ✅ **Gửi thông báo** → Changes status to `notified`, triggers notification
- ✅ **Chuyển sang lịch hẹn** → TODO: Create booking from entry
- ✅ **Hủy** → Soft delete with reason prompt

#### Status: `notified`
- ✅ **Đánh dấu giữ chỗ** → Changes status to `reserved`
- ✅ **Chuyển sang lịch hẹn** → TODO: Create booking from entry
- ✅ **Hủy** → Soft delete with reason prompt

#### Status: `reserved`
- ✅ **Chuyển sang lịch hẹn** → TODO: Create booking from entry
- ✅ **Hủy** → Soft delete with reason prompt

#### Status: `converted`
- ❌ No actions (already converted)

#### Status: `expired`
- ❌ No actions (expired)

#### Status: `cancelled`
- ❌ No actions (already cancelled)

---

## ✅ Features Checklist

### Completed ✅
- [x] Dynamic route `/dashboard/waitlist/[entryId]`
- [x] Data fetching from API
- [x] Loading state with spinner
- [x] Error state with retry
- [x] Back button navigation
- [x] Customer information card
- [x] Service information card
- [x] Preferences card (date, time, KTV, flexibility, notes)
- [x] Priority breakdown with visual bars
- [x] Position timeline with events
- [x] Notification history component (structure ready)
- [x] Actions dropdown (notify, reserve, convert, cancel)
- [x] Status-based action filtering
- [x] Optimistic UI updates
- [x] Toast notifications
- [x] Mobile responsive layout
- [x] usePageRefresh integration
- [x] Non-intrusive loading bar

### Deferred (Future Enhancement)
- [ ] Edit preferences inline
- [ ] Add internal notes (admin only)
- [ ] View customer full profile (link to customer detail page)
- [ ] View service full details (link to package page)
- [ ] Manual position adjustment
- [ ] Export entry details (PDF/print)

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] Page loads without errors
- [ ] Back button navigates to list
- [ ] All cards display data correctly
- [ ] Priority bars match score values
- [ ] Timeline shows correct events
- [ ] Actions dropdown opens/closes
- [ ] "Gửi thông báo" changes status to `notified`
- [ ] "Đánh dấu giữ chỗ" changes status to `reserved`
- [ ] "Chuyển sang lịch hẹn" shows coming soon toast
- [ ] "Hủy" prompts for reason and redirects
- [ ] Error state shows when entry not found (404)
- [ ] Notification history shows empty state
- [ ] Mobile layout stacks cards correctly
- [ ] Loading bar animates on refresh

### Edge Cases
- [ ] Entry with no preferred KTV
- [ ] Entry with no notes
- [ ] Entry with flexibility = false
- [ ] Entry with all timeline events (created → notified → reserved → converted)
- [ ] Entry cancelled (shows cancel event + reason)
- [ ] Entry expired (no actions available)
- [ ] Very long customer name (text wraps)
- [ ] Very long notes (text wraps)

---

## 📊 Code Statistics

**Lines of Code:** ~900 lines across 5 files

**File Breakdown:**
- `page.tsx` - 25 lines (minimal wrapper)
- `WaitlistDetailContent.tsx` - 280 lines (main orchestrator)
- `WaitlistDetailCards.tsx` - 150 lines (3 cards)
- `WaitlistPriorityBreakdown.tsx` - 170 lines (score visualization)
- `WaitlistPositionTimeline.tsx` - 150 lines (timeline + wait time)
- `WaitlistNotificationHistory.tsx` - 125 lines (notification logs)

**Total Waitlist Feature (including list page):**
- ~3,400 lines of TypeScript/React code
- 15 files (10 list page + 5 detail page)
- 0 tests (manual testing only for now)

---

## 🚀 Next Steps

### Immediate (Day 11-12)
1. **Notification Service Integration**
   - Implement real SMS/Email/Zalo sending
   - Create notification templates
   - Update `processSlotAvailable()` to send real notifications
   - Add API endpoint: `GET /api/waitlist/:id/notifications`
   - Populate notification history in detail page

2. **Cron Job Setup**
   - Hourly: `expireOldEntries()` cleanup
   - Every 5 minutes: Retry failed notifications
   - Notification cleanup (remove old logs after 30 days)

### Future Enhancements
1. **Convert to Booking Flow**
   - Create booking from waitlist entry
   - Auto-fill customer, service, date, time, KTV
   - Mark entry as `converted`
   - Link to new booking

2. **Enhanced Notifications**
   - Real-time delivery status (via webhook)
   - Customer response tracking (accept/decline/later)
   - Notification preferences (channel priority)

3. **Analytics Dashboard**
   - Waitlist conversion funnel
   - Average wait time by service
   - Peak hours for waitlist
   - Notification effectiveness (open rate, response rate)

---

**Last Updated:** 2026-07-12  
**Status:** Ready for Day 11-12 Notification Service Integration  
**Extension Complete:** Detail page adds 900 lines to Day 8-10 deliverables

