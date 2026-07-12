# Phase 1: Waitlist UI Design Specification
## Day 8-10: UI Components Implementation

**Date:** 2026-07-12  
**Status:** In Progress  
**Depends on:** Backend API routes (Day 5-7) ✅ Complete

---

## 🎯 Goals

Build intuitive, production-ready UI for waitlist management that allows:
- Admins to view and manage waitlist entries
- Adding customers to waitlist with priority preview
- Viewing detailed entry information (priority breakdown, position history)
- Processing slots (notify customers when slot available)
- Dashboard stats (conversion rate, top services)

---

## 📐 UI Component Architecture

```
/dashboard/waitlist
├── page.tsx (List page - Server Component)
└── [entryId]
    └── page.tsx (Detail page - Server Component)

/components/waitlist
├── WaitlistTable.tsx (Server - data fetching)
├── WaitlistFilters.tsx (Client - filter controls)
├── WaitlistTableRow.tsx (Client - interactive row)
├── WaitlistPagination.tsx (Client - pagination)
├── WaitlistStatusBadge.tsx (Client - status display)
├── AddToWaitlistModal.tsx (Client - form modal)
├── WaitlistDetailView.tsx (Client - detail display)
├── WaitlistStatsWidget.tsx (Server - dashboard widget)
└── ProcessSlotModal.tsx (Client - slot processing)
```

---

## 🎨 Design System

### Colors (Status-based)
```typescript
const statusColors = {
  active: 'blue',      // Waiting in queue
  notified: 'green',   // Notification sent
  reserved: 'yellow',  // Slot held
  converted: 'emerald',// Successfully booked
  expired: 'gray',     // Timeout
  cancelled: 'red',    // Manually removed
};
```

### Typography
- Page title: `text-2xl font-bold`
- Section title: `text-lg font-semibold`
- Table header: `text-sm font-medium text-gray-700`
- Table cell: `text-sm text-gray-900`
- Badge: `text-xs font-medium`

### Spacing
- Section gap: `space-y-6`
- Card padding: `p-6`
- Table cell padding: `px-6 py-4`

---

## 📄 Page 1: Waitlist List (`/dashboard/waitlist`)

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Danh sách chờ                                   [+ Thêm vào]│
├─────────────────────────────────────────────────────────────┤
│ 🔍 Filters                                                   │
│ Dịch vụ: [Tất cả ▼]  Ngày: [Hôm nay ▼]  Trạng thái: [...] │
│ Tìm kiếm: [Tên khách hàng hoặc SĐT...]           [Tìm]     │
├─────────────────────────────────────────────────────────────┤
│ Table (20 items/page)                                        │
│ ┌───┬─────────┬────────┬──────┬─────────┬─────────┬──────┐ │
│ │ # │ Khách   │ Dịch vụ│ Ngày │ Ưu tiên │ Trạng   │ ...  │ │
│ ├───┼─────────┼────────┼──────┼─────────┼─────────┼──────┤ │
│ │ 1 │ Nguyễn A│ Premium│ 12/7 │   87    │ Đang chờ│ [⋮]  │ │
│ │ 2 │ Trần B  │ Standard│13/7 │   75    │ Đã thông│ [⋮]  │ │
│ │...│         │        │      │         │   báo   │      │ │
│ └───┴─────────┴────────┴──────┴─────────┴─────────┴──────┘ │
├─────────────────────────────────────────────────────────────┤
│ Trang 1/5                                    [◀] [1][2]... [▶]│
└─────────────────────────────────────────────────────────────┘
```

### Components

#### WaitlistTable.tsx (Server Component)
**Purpose:** Fetch data from API and render table
**Props:** searchParams (from URL)
**Data source:** `GET /api/waitlist?tenant_id=...&filters`

**Columns:**
1. Position (#)
2. Customer (name + phone)
3. Service (package_name)
4. Preferred Date
5. Preferred Time
6. Priority Score (colored bar 0-100)
7. Status (badge)
8. Wait Time (minutes → human readable)
9. Actions (dropdown: View, Notify, Convert, Cancel)

#### WaitlistFilters.tsx (Client Component)
**Purpose:** Filter controls (updates URL params)
**Controls:**
- Service dropdown (fetch from packages table)
- Date picker (today, tomorrow, this week, custom)
- Status multi-select (active, notified, reserved, etc.)
- Search input (customer name or phone)
- Clear filters button

**URL params updated:**
- `package_id`, `preferred_date`, `status`, `search`, `page`

#### WaitlistStatusBadge.tsx
**Purpose:** Color-coded status display
**Variants:**
- `active`: Blue badge "Đang chờ"
- `notified`: Green badge "Đã thông báo"
- `reserved`: Yellow badge "Đã giữ chỗ"
- `converted`: Emerald badge "Đã đặt lịch"
- `expired`: Gray badge "Hết hạn"
- `cancelled`: Red badge "Đã hủy"

#### WaitlistTableRow.tsx (Client Component)
**Purpose:** Interactive table row with actions
**Actions dropdown:**
- 👁️ View Details → Navigate to `/dashboard/waitlist/[entryId]`
- 📢 Notify Now → Manual notification (if status = active)
- ✅ Convert to Booking → Create booking from entry
- ❌ Remove from Waitlist → Soft delete with reason

---

## 📄 Page 2: Add to Waitlist Modal

### Trigger
- Button: `[+ Thêm vào danh sách chờ]` (top-right of list page)

### Modal Layout
```
┌─────────────────────────────────────────┐
│ Thêm khách vào danh sách chờ        [×] │
├─────────────────────────────────────────┤
│                                          │
│ Khách hàng *                             │
│ [Tìm theo tên hoặc SĐT...]        [🔍]  │
│   → Nguyễn Thị A (0901234567)           │
│   → VIP - Chi tiêu: 15.000.000 VNĐ      │
│                                          │
│ Dịch vụ *                                │
│ [Chọn dịch vụ ▼]                         │
│   → Premium Massage - 3.500.000 VNĐ      │
│                                          │
│ Ngày mong muốn *          Giờ *          │
│ [📅 12/07/2026]          [⏰ 14:30]      │
│                                          │
│ Thời lượng (phút)                        │
│ [90 ▼] (60, 90, 120, 180)                │
│                                          │
│ Ưu tiên KTV (tùy chọn)                   │
│ [Chọn KTV ▼]                             │
│                                          │
│ Linh hoạt thời gian                      │
│ [✓] Có thể nhận lịch thay thế gần giờ   │
│     mong muốn (+10 điểm ưu tiên)         │
│                                          │
│ Ghi chú                                  │
│ [Textarea...]                            │
│                                          │
├─────────────────────────────────────────┤
│ 📊 Dự kiến                               │
│ • Vị trí trong hàng: #3                  │
│ • Thời gian chờ dự kiến: ~45 phút        │
│ • Điểm ưu tiên: 87/100                   │
│   - Hạng VIP: 40 điểm                    │
│   - Giá trị đơn: 28 điểm                 │
│   - Linh hoạt: 10 điểm                   │
├─────────────────────────────────────────┤
│          [Hủy]           [Thêm vào hàng] │
└─────────────────────────────────────────┘
```

### AddToWaitlistModal.tsx (Client Component)
**Purpose:** Form to add customer to waitlist
**State:**
- customer (selected from autocomplete)
- package (selected from dropdown)
- preferredDate, preferredTime
- durationMinutes, preferredKtvId
- isFlexible, notes

**Validation:**
- All required fields filled
- Date not in past
- Time valid (HH:MM)
- Customer + service + date not already in active waitlist

**Preview calculation:**
- Call API: `GET /api/waitlist?tenant_id=X&package_id=Y&preferred_date=Z` to get existing queue
- Calculate estimated position (client-side based on tier)
- Show preview before submitting

**Submit:**
- `POST /api/waitlist` with form data
- On success: Close modal, refresh table, show toast
- On error: Show error message (capacity full, duplicate, etc.)

---

## 📄 Page 3: Waitlist Detail (`/dashboard/waitlist/[entryId]`)

### Layout
```
┌───────────────────────────────────────────────────────┐
│ ← Danh sách chờ                                       │
├───────────────────────────────────────────────────────┤
│ Vị trí #3 • Đang chờ                        [Actions ▼]│
├───────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌────────────────────────┐  │
│ │ 👤 Khách hàng         │ │ 📦 Dịch vụ             │  │
│ │ Nguyễn Thị A          │ │ Premium Massage        │  │
│ │ 0901234567            │ │ 3.500.000 VNĐ          │  │
│ │ VIP                   │ │ 90 phút                │  │
│ └──────────────────────┘ └────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 📅 Lịch mong muốn                                │  │
│ │ Ngày: 12/07/2026                                 │  │
│ │ Giờ: 14:30                                       │  │
│ │ KTV ưu tiên: Lan                                 │  │
│ │ Linh hoạt: Có                                    │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 🎯 Phân tích ưu tiên (87/100)                    │  │
│ │                                                   │  │
│ │ Hạng VIP              ████████░░ 40/40           │  │
│ │ Giá trị đơn           ████████░░ 28/30           │  │
│ │ Thời gian chờ         ░░░░░░░░░░  0/20           │  │
│ │ Linh hoạt             ██████████ 10/10           │  │
│ │ Tổng cộng             ████████░░ 87/100          │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ ⏱️ Timeline                                       │  │
│ │                                                   │  │
│ │ 12/07 14:00 • Thêm vào hàng (vị trí #3)          │  │
│ │ 12/07 14:15 • Lên vị trí #2 (1 khách hủy)        │  │
│ │ 12/07 14:30 • Lên vị trí #1 (đã thông báo)       │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 📱 Thông báo                                      │  │
│ │                                                   │  │
│ │ 12/07 14:30 • Zalo - Đã gửi                      │  │
│ │ "Có chỗ trống cho Premium Massage..."            │  │
│ │ Trạng thái: Đã đọc (14:32)                       │  │
│ └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### WaitlistDetailView.tsx (Client Component)
**Sections:**
1. **Header:** Position, Status, Actions dropdown
2. **Customer Card:** Name, phone, tier, contact preferences
3. **Service Card:** Package name, price, duration
4. **Preferences Card:** Date, time, KTV, resource, flexibility
5. **Priority Breakdown:** Visual bars showing score components
6. **Position Timeline:** History of position changes
7. **Notification History:** All notifications sent (channel, status, time)

**Actions dropdown:**
- Send Notification (if status = active)
- Mark as Reserved (if status = notified)
- Convert to Booking (create new booking)
- Update Notes (internal admin notes)
- Cancel Entry (soft delete with reason)

---

## 📄 Widget: Waitlist Stats (Dashboard)

### Layout
```
┌─────────────────────────────────────┐
│ 📋 Danh sách chờ    [Tuần này ▼]   │
├─────────────────────────────────────┤
│ Tổng số: 47                          │
│ Đang chờ: 23 • Đã chuyển đổi: 18    │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ Tỷ lệ chuyển đổi                │ │
│ │ 62% ████████░░                  │ │
│ │ (mục tiêu: 60%)                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Thời gian chờ TB: 38 phút           │
│                                      │
│ Dịch vụ nhiều người chờ nhất:       │
│ • Premium Massage (12 người)        │
│ • Facial (8 người)                  │
│                                      │
│ [Xem chi tiết →]                    │
└─────────────────────────────────────┘
```

### WaitlistStatsWidget.tsx (Server Component)
**Data source:** `GET /api/waitlist/stats?tenant_id=X&period=week`
**Metrics:**
- Total entries (by status)
- Conversion rate (% notified → converted)
- Avg wait time (human readable)
- Top 3 services by waitlist size

---

## 🔧 Technical Implementation Notes

### Server Components (Data Fetching)
```typescript
// app/dashboard/waitlist/page.tsx
export default async function WaitlistPage({ searchParams }: {
  searchParams: { tenant_id: string; package_id?: string; status?: string; page?: string }
}) {
  const supabase = createClient();
  
  // Fetch waitlist entries
  const response = await fetch(`/api/waitlist?${new URLSearchParams(searchParams)}`);
  const data = await response.json();
  
  return <WaitlistTable entries={data.entries} total={data.total} />;
}
```

### Client Components (Interactivity)
```typescript
// components/waitlist/AddToWaitlistModal.tsx
'use client';

export function AddToWaitlistModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<AddToWaitlistInput>({...});
  
  const handleSubmit = async () => {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    
    if (response.ok) {
      toast.success('Đã thêm vào danh sách chờ');
      onClose();
      router.refresh(); // Refresh server component
    }
  };
  
  return <Dialog>...</Dialog>;
}
```

### URL State Management
Use Next.js searchParams for filters:
```
/dashboard/waitlist?package_id=abc&status=active,notified&page=2
```

### Optimistic UI Updates
```typescript
// When removing from waitlist
const optimisticRemove = (entryId: string) => {
  // Update UI immediately
  setEntries(prev => prev.filter(e => e.id !== entryId));
  
  // Then call API
  fetch(`/api/waitlist/${entryId}`, { method: 'DELETE' })
    .catch(() => {
      // Revert on error
      toast.error('Lỗi khi xóa');
      router.refresh();
    });
};
```

---

## ✅ Implementation Checklist

### Day 8 (Foundation)
- [ ] Create page structure (`/dashboard/waitlist/page.tsx`)
- [ ] WaitlistTable.tsx (server component with data fetching)
- [ ] WaitlistStatusBadge.tsx (status display)
- [ ] WaitlistPagination.tsx (pagination controls)

### Day 9 (Interactivity)
- [ ] WaitlistFilters.tsx (filter controls + URL params)
- [ ] WaitlistTableRow.tsx (actions dropdown)
- [ ] AddToWaitlistModal.tsx (form with validation + preview)

### Day 10 (Detail & Stats)
- [ ] WaitlistDetailView.tsx (detail page)
- [ ] WaitlistStatsWidget.tsx (dashboard widget)
- [ ] ProcessSlotModal.tsx (slot processing UI)
- [ ] Integration testing (full user flow)

---

**Last Updated:** 2026-07-12  
**Status:** Ready for implementation  
**Next:** Start Day 8 - Build foundation components
