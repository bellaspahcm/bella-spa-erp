# Báo Cáo Điểm Yếu Cần Khắc Phục - Bella Auto Module
**Ngày tạo:** 04/08/2026  
**Người viết:** AI Development Team  
**Mục đích:** Xác định rõ 2 phần chưa hoàn thiện và đưa ra hướng khắc phục

---

## 🎯 Tổng Quan

Bella Auto Module hiện đã hoàn thành **10/12 tính năng chính** (83%). Tuy nhiên, có **2 phần còn dùng dữ liệu giả (mock)** và cần tích hợp thực tế để đưa vào production.

### 📊 Tình Trạng Hiện Tại

| **Tính Năng**                      | **Trạng Thái**         | **Đánh Giá** | **Vấn Đề**                                    |
|------------------------------------|------------------------|--------------|-----------------------------------------------|
| Dashboard & Analytics              | Mock Data              | 75%          | Biểu đồ dùng dữ liệu giả, chưa kết nối Supabase thực |
| Booking & Đặt Cọc Hub              | Mock Integration       | 70%          | Database có sẵn nhưng thiếu giao diện quản lý |

---

## 🔴 Phần 1: Dashboard & Analytics (Mock Data - 75%)

### ❓ Vấn Đề Hiện Tại

**File:** `src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx`

Dashboard Analytics đã được xây dựng đẹp với 6 biểu đồ tương tác:
- ✅ Giao diện hoàn chỉnh với Recharts (Area, Bar, Pie charts)
- ✅ Design hệ thống hiện đại (glassmorphism, gradient, dark mode)
- ✅ Responsive layout (mobile + desktop)

**NHƯNG:**

❌ **Dữ liệu hiển thị là GIẢI (mock)**, không phản ánh thực tế:

```typescript
// ❌ Ví dụ: Xu hướng 6 tháng - dữ liệu ngẫu nhiên
const generateMonthlyTrend = () => {
  const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  return months.map((month, idx) => ({
    month,
    nhap: Math.floor(Math.random() * 30) + 20,  // ❌ Random
    xuat: Math.floor(Math.random() * 25) + 15,  // ❌ Random
    ton: Math.floor(Math.random() * 50) + 30 + idx * 5, // ❌ Random
  }));
};

// ❌ Top 5 xe bán chạy - dữ liệu cố định
const topModels = [
  { model: 'VinFast VF 8', sold: 45, revenue: 40500000000 },  // ❌ Hardcoded
  { model: 'VinFast VF 9', sold: 32, revenue: 48000000000 },  // ❌ Hardcoded
  // ...
];
```

### 🎯 Tác Động

1. **Quản lý không đưa ra quyết định chính xác** vì số liệu không thật
2. **Báo cáo cho giám đốc sai lệch** (doanh thu, tồn kho, xu hướng sai)
3. **Mất niềm tin của người dùng** khi phát hiện số liệu giả

### ✅ Hướng Khắc Phục

#### Bước 1: Tạo RPC functions trong Supabase

Tạo các hàm database để tính toán thống kê thực tế:

**File:** `supabase/migrations/20260804300000_analytics_rpcs.sql`

```sql
-- RPC 1: Xu hướng nhập/xuất/tồn kho theo tháng (6 tháng qua)
CREATE OR REPLACE FUNCTION get_auto_inventory_trend(p_tenant_id UUID)
RETURNS TABLE (
  month TEXT,
  nhap INTEGER,
  xuat INTEGER,
  ton INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT 
      generate_series(
        date_trunc('month', NOW()) - INTERVAL '5 months',
        date_trunc('month', NOW()),
        INTERVAL '1 month'
      )::DATE AS month_date
  ),
  -- Nhập kho: đếm xe created trong tháng
  nhap_kho AS (
    SELECT 
      date_trunc('month', created_at)::DATE AS month_date,
      COUNT(*) AS nhap_count
    FROM auto_vehicles
    WHERE tenant_id = p_tenant_id
      AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY date_trunc('month', created_at)::DATE
  ),
  -- Xuất kho: đếm xe status=delivered trong tháng
  xuat_kho AS (
    SELECT 
      date_trunc('month', updated_at)::DATE AS month_date,
      COUNT(*) AS xuat_count
    FROM auto_vehicles
    WHERE tenant_id = p_tenant_id
      AND status = 'delivered'
      AND updated_at >= NOW() - INTERVAL '6 months'
    GROUP BY date_trunc('month', updated_at)::DATE
  )
  SELECT 
    TO_CHAR(m.month_date, 'TMon') AS month,  -- T1, T2, T3...
    COALESCE(n.nhap_count, 0)::INTEGER AS nhap,
    COALESCE(x.xuat_count, 0)::INTEGER AS xuat,
    (
      SELECT COUNT(*)::INTEGER
      FROM auto_vehicles
      WHERE tenant_id = p_tenant_id
        AND status IN ('warehouse', 'showroom', 'allocated', 'in_transit')
        AND created_at <= m.month_date + INTERVAL '1 month'
    ) AS ton  -- Tồn kho cuối tháng
  FROM months m
  LEFT JOIN nhap_kho n ON m.month_date = n.month_date
  LEFT JOIN xuat_kho x ON m.month_date = x.month_date
  ORDER BY m.month_date;
END;
$$;

-- RPC 2: Top 5 dòng xe bán chạy nhất
CREATE OR REPLACE FUNCTION get_auto_top_models(p_tenant_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  model TEXT,
  sold BIGINT,
  revenue NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.model AS model,
    COUNT(*) AS sold,
    SUM(s.final_price) AS revenue
  FROM auto_vehicles v
  INNER JOIN auto_sales s ON s.vehicle_id = v.id
  WHERE v.tenant_id = p_tenant_id
    AND s.status = 'completed'
  GROUP BY v.model
  ORDER BY sold DESC
  LIMIT p_limit;
END;
$$;

-- RPC 3: Doanh thu theo tháng (6 tháng qua)
CREATE OR REPLACE FUNCTION get_auto_revenue_by_month(p_tenant_id UUID)
RETURNS TABLE (
  month TEXT,
  revenue NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date_trunc('month', s.sale_date), 'TMon') AS month,
    SUM(s.final_price) AS revenue
  FROM auto_sales s
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'completed'
    AND s.sale_date >= NOW() - INTERVAL '6 months'
  GROUP BY date_trunc('month', s.sale_date)
  ORDER BY date_trunc('month', s.sale_date);
END;
$$;
```

#### Bước 2: Cập nhật component để gọi RPC

**File:** `src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx`

Thay thế hàm `loadAnalytics()`:

```typescript
const loadAnalytics = async () => {
  setLoading(true);
  try {
    // ✅ Gọi RPC thực tế
    const [trendResult, modelsResult, revenueResult] = await Promise.all([
      supabase.rpc('get_auto_inventory_trend', { p_tenant_id: tenantId }),
      supabase.rpc('get_auto_top_models', { p_tenant_id: tenantId, p_limit: 5 }),
      supabase.rpc('get_auto_revenue_by_month', { p_tenant_id: tenantId }),
    ]);

    if (trendResult.error) throw trendResult.error;
    if (modelsResult.error) throw modelsResult.error;
    if (revenueResult.error) throw revenueResult.error;

    setAnalytics({
      monthlyTrend: trendResult.data || [],
      topModels: modelsResult.data || [],
      revenueByMonth: revenueResult.data || [],
      // ... các field khác
    });
  } catch (error) {
    console.error('Error loading analytics:', error);
  } finally {
    setLoading(false);
  }
};
```

#### Bước 3: Test với dữ liệu thật

```bash
# Deploy migration
supabase db push

# Test RPC trên SQL Editor
SELECT * FROM get_auto_inventory_trend('bella_auto_demo');
SELECT * FROM get_auto_top_models('bella_auto_demo', 5);
SELECT * FROM get_auto_revenue_by_month('bella_auto_demo');
```

### 📈 Kết Quả Mong Đợi

- ✅ Dashboard hiển thị dữ liệu **thực tế từ database**
- ✅ Quản lý có thể **tin tưởng số liệu** để ra quyết định
- ✅ Báo cáo tự động cập nhật khi có giao dịch mới

### ⏱️ Thời Gian Ước Tính

- Viết 3 RPC functions: **2 giờ**
- Cập nhật component: **1 giờ**
- Testing & debugging: **1 giờ**
- **Tổng:** 4 giờ

---

## 🔴 Phần 2: Booking & Đặt Cọc Hub (Mock Integration - 70%)

### ❓ Vấn Đề Hiện Tại

Database đã sẵn sàng:
- ✅ Bảng `auto_bookings` đã có đầy đủ schema
- ✅ Bảng `auto_deposits` để tracking cọc (unpaid/partial/full)
- ✅ Service `AutoSalesProvider.ts` đã implement logic

**NHƯNG:**

❌ **Thiếu giao diện quản lý** để:
1. Xem danh sách booking (số `BK-AUTO-YYYY-XXXX`)
2. Theo dõi trạng thái đặt cọc (chưa cọc / cọc 1 phần / đã cọc đủ)
3. Xác nhận khách hàng đã đóng tiền cọc
4. Tìm kiếm booking theo khách hàng / VIN / ngày
5. Thống kê tổng cọc chưa thu

### 🎯 Tác Động

1. **Nhân viên sales không biết booking nào chưa cọc** → Mất doanh thu
2. **Kế toán không track được công nợ cọc** → Lộn xộn sổ sách
3. **Giám đốc không giám sát được hiệu suất sales** → Thiếu kiểm soát

### ✅ Hướng Khắc Phục

#### Bước 1: Tạo trang quản lý Booking Hub

**File:** `src/app/dashboard/bella-auto/bookings/page.tsx`

```tsx
import { Suspense } from 'react';
import { BookingListTable } from '@/components/bella-auto/BookingListTable';
import { BookingStats } from '@/components/bella-auto/BookingStats';

export const metadata = {
  title: 'Quản Lý Booking & Đặt Cọc | Bella Auto',
};

export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản Lý Booking & Đặt Cọc</h1>
        <button className="btn-primary">+ Tạo Booking Mới</button>
      </div>

      <Suspense fallback={<StatsLoading />}>
        <BookingStats />
      </Suspense>

      <Suspense fallback={<TableLoading />}>
        <BookingListTable />
      </Suspense>
    </div>
  );
}
```


#### Bước 2: Tạo component thống kê Booking

**File:** `src/components/bella-auto/BookingStats.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

export function BookingStats() {
  const [stats, setStats] = useState({
    total: 0,
    unpaid: 0,      // Chưa cọc
    partial: 0,     // Cọc 1 phần
    full: 0,        // Đã cọc đủ
    totalDepositReceived: 0,  // Tổng tiền cọc đã thu
    totalDepositPending: 0,   // Tổng cọc chưa thu
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const supabase = createClient();
    
    // Lấy tất cả booking active (chưa delivered)
    const { data: bookings } = await supabase
      .from('auto_bookings')
      .select('id, deposit_amount, deposit_paid, status')
      .neq('status', 'delivered')
      .neq('status', 'cancelled');

    if (!bookings) return;

    const total = bookings.length;
    const unpaid = bookings.filter(b => b.deposit_paid === 0).length;
    const partial = bookings.filter(b => 
      b.deposit_paid > 0 && b.deposit_paid < b.deposit_amount
    ).length;
    const full = bookings.filter(b => b.deposit_paid >= b.deposit_amount).length;
    
    const totalDepositReceived = bookings.reduce((sum, b) => sum + b.deposit_paid, 0);
    const totalDepositPending = bookings.reduce((sum, b) => 
      sum + (b.deposit_amount - b.deposit_paid), 0
    );

    setStats({ total, unpaid, partial, full, totalDepositReceived, totalDepositPending });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard 
        label="Tổng Booking" 
        value={stats.total} 
        color="blue"
      />
      <StatCard 
        label="Chưa Cọc" 
        value={stats.unpaid} 
        color="red"
        alert={stats.unpaid > 0}
      />
      <StatCard 
        label="Cọc 1 Phần" 
        value={stats.partial} 
        color="yellow"
      />
      <StatCard 
        label="Đã Cọc Đủ" 
        value={stats.full} 
        color="green"
      />
      <StatCard 
        label="Đã Thu" 
        value={formatCurrency(stats.totalDepositReceived)} 
        color="green"
        suffix="VNĐ"
      />
      <StatCard 
        label="Chưa Thu" 
        value={formatCurrency(stats.totalDepositPending)} 
        color="red"
        suffix="VNĐ"
      />
    </div>
  );
}
```

#### Bước 3: Tạo bảng danh sách Booking

**File:** `src/components/bella-auto/BookingListTable.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

export function BookingListTable() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unpaid, partial, full

  useEffect(() => {
    loadBookings();
  }, [filter]);

  const loadBookings = async () => {
    const supabase = createClient();
    
    let query = supabase
      .from('auto_bookings')
      .select(`
        id,
        booking_number,
        customer_id,
        customers (full_name, phone),
        auto_vehicles (vin, model, color),
        deposit_amount,
        deposit_paid,
        status,
        created_at
      `)
      .order('created_at', { ascending: false });

    // Apply filter
    if (filter === 'unpaid') {
      query = query.eq('deposit_paid', 0);
    } else if (filter === 'partial') {
      query = query.gt('deposit_paid', 0).lt('deposit_paid', 'deposit_amount');
    } else if (filter === 'full') {
      query = query.gte('deposit_paid', 'deposit_amount');
    }

    const { data } = await query;
    setBookings(data || []);
  };

  return (
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <FilterTab label="Tất cả" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterTab label="Chưa cọc" active={filter === 'unpaid'} onClick={() => setFilter('unpaid')} />
        <FilterTab label="Cọc 1 phần" active={filter === 'partial'} onClick={() => setFilter('partial')} />
        <FilterTab label="Đã cọc đủ" active={filter === 'full'} onClick={() => setFilter('full')} />
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="text-left p-3">Số Booking</th>
            <th className="text-left p-3">Khách Hàng</th>
            <th className="text-left p-3">Xe</th>
            <th className="text-right p-3">Cọc Yêu Cầu</th>
            <th className="text-right p-3">Đã Cọc</th>
            <th className="text-center p-3">Trạng Thái</th>
            <th className="text-center p-3">Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="border-b border-slate-100 dark:border-slate-900">
              <td className="p-3 font-mono text-sm">{booking.booking_number}</td>
              <td className="p-3">
                <div className="font-semibold">{booking.customers.full_name}</div>
                <div className="text-xs text-slate-500">{booking.customers.phone}</div>
              </td>
              <td className="p-3">
                <div className="font-semibold">{booking.auto_vehicles.model}</div>
                <div className="text-xs text-slate-500">VIN: {booking.auto_vehicles.vin}</div>
              </td>
              <td className="p-3 text-right font-bold">
                {formatCurrency(booking.deposit_amount)}
              </td>
              <td className="p-3 text-right font-bold text-green-600">
                {formatCurrency(booking.deposit_paid)}
              </td>
              <td className="p-3 text-center">
                <DepositStatusBadge booking={booking} />
              </td>
              <td className="p-3 text-center">
                <button 
                  className="btn-sm btn-primary"
                  onClick={() => confirmDeposit(booking.id)}
                >
                  Xác Nhận Cọc
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepositStatusBadge({ booking }) {
  const { deposit_amount, deposit_paid } = booking;
  
  if (deposit_paid === 0) {
    return <span className="badge badge-red">Chưa cọc</span>;
  }
  if (deposit_paid < deposit_amount) {
    return <span className="badge badge-yellow">Cọc 1 phần</span>;
  }
  return <span className="badge badge-green">Đã cọc đủ</span>;
}
```


#### Bước 4: Tạo API route xác nhận cọc

**File:** `src/app/api/bella-auto/bookings/[id]/confirm-deposit/route.ts`

```tsx
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { amount, payment_method, notes } = await request.json();

    // 1. Lấy booking hiện tại
    const { data: booking, error: fetchError } = await supabase
      .from('auto_bookings')
      .select('id, deposit_amount, deposit_paid')
      .eq('id', params.id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: 'Booking không tồn tại' },
        { status: 404 }
      );
    }

    // 2. Kiểm tra số tiền hợp lệ
    const newDepositPaid = booking.deposit_paid + amount;
    if (newDepositPaid > booking.deposit_amount) {
      return NextResponse.json(
        { error: 'Số tiền cọc vượt quá yêu cầu' },
        { status: 400 }
      );
    }

    // 3. Cập nhật deposit_paid
    const { error: updateError } = await supabase
      .from('auto_bookings')
      .update({ deposit_paid: newDepositPaid })
      .eq('id', params.id);

    if (updateError) throw updateError;

    // 4. Tạo record trong auto_deposits
    const { error: depositError } = await supabase
      .from('auto_deposits')
      .insert({
        booking_id: params.id,
        amount: amount,
        payment_method: payment_method,
        payment_date: new Date().toISOString(),
        notes: notes,
        status: newDepositPaid >= booking.deposit_amount ? 'full' : 'partial',
      });

    if (depositError) throw depositError;

    return NextResponse.json({ 
      success: true, 
      message: 'Xác nhận cọc thành công',
      newDepositPaid 
    });

  } catch (error: any) {
    console.error('Confirm deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi server' },
      { status: 500 }
    );
  }
}
```

#### Bước 5: Thêm menu vào Sidebar

**File:** `src/modules/bella-auto/manifest.ts`

```typescript
menus: [
  { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/bella-auto', icon: 'LayoutDashboard' },
  { id: 'vehicles', label: 'Quản lý kho xe', href: '/dashboard/bella-auto/vehicles', icon: 'Car' },
  { id: 'bookings', label: 'Booking & Đặt Cọc', href: '/dashboard/bella-auto/bookings', icon: 'FileText' }, // ← NEW
  { id: 'journey', label: 'Hành trình khách hàng', href: '/dashboard/bella-auto/journey', icon: 'GitCommit' },
  // ... các menu khác
]
```

### 📈 Kết Quả Mong Đợi

- ✅ Sales nhìn thấy **danh sách booking chưa cọc** và nhắc khách
- ✅ Kế toán theo dõi **công nợ cọc chưa thu** theo thời gian thực
- ✅ Giám đốc xem **báo cáo hiệu suất sales** (tỷ lệ cọc đúng hạn)
- ✅ Hệ thống **tự động cập nhật trạng thái** booking khi cọc đủ

### ⏱️ Thời Gian Ước Tính

- Tạo UI components (Stats + Table): **3 giờ**
- API route xác nhận cọc: **1 giờ**
- Integration với sidebar: **30 phút**
- Testing với data thật: **1.5 giờ**
- **Tổng:** 6 giờ

---

## 📊 Tổng Kết & Ưu Tiên

### 🎯 Độ Ưu Tiên

| **Phần**                     | **Độ Quan Trọng** | **Thời Gian** | **Ưu Tiên** |
|------------------------------|-------------------|---------------|-------------|
| Dashboard Analytics (RPC)    | ⭐⭐⭐⭐           | 4 giờ         | **P1 - Cao**  |
| Booking & Đặt Cọc Hub (UI)   | ⭐⭐⭐⭐⭐         | 6 giờ         | **P0 - Khẩn cấp** |

**Lý do ưu tiên Booking Hub trước:**
- ❗ Ảnh hưởng trực tiếp đến **doanh thu** (mất cọc = mất khách)
- ❗ Kế toán **không thể vận hành** nếu không track cọc
- ❗ Đã có database sẵn, chỉ thiếu giao diện

### 🚀 Kế Hoạch Triển Khai

**Tuần 1 (Ưu tiên cao):**
- Ngày 1-2: Xây dựng Booking Hub UI (Stats + Table)
- Ngày 3: API route xác nhận cọc + Testing
- Ngày 4: Deploy và training nhân viên sử dụng

**Tuần 2 (Ưu tiên trung bình):**
- Ngày 1: Viết 3 RPC functions cho Analytics
- Ngày 2: Cập nhật Dashboard component
- Ngày 3: Testing và deploy Analytics

### 📝 Checklist Hoàn Thành

**Booking & Đặt Cọc Hub:**
- [ ] Tạo `/dashboard/bella-auto/bookings/page.tsx`
- [ ] Component `BookingStats.tsx` (6 metrics)
- [ ] Component `BookingListTable.tsx` (filter + table)
- [ ] API route `/api/bella-auto/bookings/[id]/confirm-deposit`
- [ ] Thêm menu vào `manifest.ts`
- [ ] Test với data thật (bella_auto_demo tenant)
- [ ] Training video cho nhân viên sales

**Dashboard Analytics:**
- [ ] Migration file với 3 RPC functions
- [ ] Deploy migration: `supabase db push`
- [ ] Cập nhật `BellaAutoAnalyticsDashboard.tsx`
- [ ] Xóa tất cả mock data functions
- [ ] Test với production data
- [ ] Verify số liệu chính xác với kế toán

---

## 💡 Lưu Ý Quan Trọng

### ⚠️ Điều Cần Tránh

1. **KHÔNG dùng mock data trong production** - Gây mất niềm tin nghiêm trọng
2. **KHÔNG triển khai thiếu tính năng tracking cọc** - Kế toán lộn xộn sổ sách
3. **KHÔNG quên test với data thật** - Mock test pass không có nghĩa production chạy đúng

### ✅ Best Practices

1. **Luôn có error handling** cho RPC calls (network timeout, database down)
2. **Hiển thị loading states** khi fetch data (skeleton loaders)
3. **Có empty states** khi chưa có dữ liệu (hướng dẫn user tạo booking đầu tiên)
4. **Log mọi thao tác cọc** trong `auto_deposits` để audit trail

---

## 📞 Hỗ Trợ

Nếu gặp khó khăn khi triển khai:
1. Check logs trong Supabase Dashboard → Logs → PostgreSQL
2. Test RPC functions trực tiếp trong SQL Editor
3. Verify RLS policies cho `auto_bookings` và `auto_deposits`
4. Liên hệ Tech Lead nếu cần review code

---

**Báo cáo này được tạo tự động bởi AI Development Team**  
**Cập nhật lần cuối:** 04/08/2026  
**Người duyệt:** [Tech Lead Name]

