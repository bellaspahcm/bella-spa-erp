# HR Profile & Daily Attendance Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a robust, real-time HR Profile directory and Daily Attendance logging system for KTVs, using actual check-in/out days to calculate pro-rated KTV base salaries, with an interactive visual calendar and override tools in the Admin Dashboard.

**Architecture:** We will build a new service file `src/services/attendance-actions.ts` containing Server Actions for check-in/out, monthly matrices, and HR edits. We will integrate a Check-in/out UI widget on the KTV Mobile Dashboard, modify `src/services/salary-actions.ts` to count attendance days and apply a pro-rata base salary formula with a 0-day safeguard, and refactor the Admin Salary Page `src/app/dashboard/salary/page.tsx` into a high-fidelity Triple-Tab Dashboard.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion, Lucide Icons, Sonner, Supabase Postgres.

---

### Task 1: Attendance Server Actions & Database Operations

**Files:**
- Create: `src/services/attendance-actions.ts`
- Test: `scratch/test-attendance.js`

**Step 1: Write the minimal implementation**

Create `src/services/attendance-actions.ts` with server actions for KTV check-in, check-out, fetch today's attendance, fetch monthly KTV attendance logs, and Admin overrides:

```typescript
'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from './audit-actions';

/** Fetch today's local date string in YYYY-MM-DD format (Vietnam Timezone) */
export async function getVNTodayString(): Promise<string> {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Get KTV's attendance status for today */
export async function getKTVTodayAttendance() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return null;

  const todayStr = await getVNTodayString();

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today attendance:', error);
    return null;
  }
  return data;
}

/** KTV daily Check-in */
export async function ktvCheckIn() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Không có quyền truy cập' };

  let tenantId = user.tenant_id;
  if (!tenantId) tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';

  const todayStr = await getVNTodayString();
  const now = new Date();

  // Determine status (Late if check-in is after 08:30:00 local time)
  const currentHour = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
  const isLate = currentHour > '08:30:00';
  const status = isLate ? 'late' : 'present';

  // Check if already checked in
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Bạn đã check-in ngày hôm nay rồi!' };
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      ktv_id: user.id,
      date: todayStr,
      checkin_time: now.toISOString(),
      status,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'attendance',
    record_id: data.id,
    new_data: { ktv_id: user.id, date: todayStr, checkin_time: now.toISOString(), status }
  });

  revalidatePath('/ktv/dashboard');
  return { success: true, data };
}

/** KTV daily Check-out */
export async function ktvCheckOut() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Không có quyền truy cập' };

  const todayStr = await getVNTodayString();
  const now = new Date();

  const { data: existing, error: fetchErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: 'Bạn cần check-in trước khi check-out!' };
  }

  if (existing.checkout_time) {
    return { success: false, error: 'Bạn đã check-out ngày hôm nay rồi!' };
  }

  const { data, error } = await supabase
    .from('attendance')
    .update({
      checkout_time: now.toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'attendance',
    record_id: data.id,
    new_data: { checkout_time: now.toISOString() }
  });

  revalidatePath('/ktv/dashboard');
  return { success: true, data };
}

/** Admin Action: Get all KTVs with their attendance count for a given month */
export async function getMonthlyAttendanceSummary(monthStr: string) {
  const supabase = await createClient();
  const startOfMonth = `${monthStr}-01`;
  const endOfMonth = new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 1).toISOString().split('T')[0];

  // 1. Fetch all KTVs
  const { data: ktvs } = await supabase
    .from('users')
    .select('id, full_name, base_salary, status')
    .eq('role', 'ktv');

  if (!ktvs) return [];

  // 2. Fetch all attendance logs this month
  const { data: logs } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', startOfMonth)
    .lt('date', endOfMonth);

  const logsList = logs || [];

  return ktvs.map((ktv: any) => {
    const ktvLogs = logsList.filter((l: any) => l.ktv_id === ktv.id);
    
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;

    ktvLogs.forEach((l: any) => {
      if (l.status === 'present') presentCount++;
      else if (l.status === 'late') lateCount++;
      else if (l.status === 'absent') absentCount++;
      else if (l.status === 'half_day') halfDayCount++;
    });

    const totalDaysWorked = presentCount + lateCount + (halfDayCount * 0.5);

    return {
      id: ktv.id,
      name: ktv.full_name,
      baseSalary: ktv.base_salary || 6000000,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      halfDay: halfDayCount,
      totalDays: totalDaysWorked,
      status: ktv.status,
      logs: ktvLogs,
    };
  });
}

/** Admin Action: Override or create an attendance log */
export async function adminOverrideAttendance(payload: {
  ktvId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
  checkinTime?: string;
  checkoutTime?: string;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  let tenantId = currentUser.tenant_id;
  if (!tenantId) tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';

  // Check if existing record
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('ktv_id', payload.ktvId)
    .eq('date', payload.date)
    .maybeSingle();

  const recordData = {
    ktv_id: payload.ktvId,
    date: payload.date,
    status: payload.status,
    checkin_time: payload.checkinTime ? new Date(payload.checkinTime).toISOString() : null,
    checkout_time: payload.checkoutTime ? new Date(payload.checkoutTime).toISOString() : null,
    tenant_id: tenantId,
  };

  let result;
  if (existing) {
    result = await supabase
      .from('attendance')
      .update(recordData)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('attendance')
      .insert(recordData)
      .select()
      .single();
  }

  if (result.error) return { success: false, error: result.error.message };

  await recordAuditLog({
    action: existing ? 'UPDATE' : 'INSERT',
    table_name: 'attendance',
    record_id: result.data.id,
    new_data: recordData,
  });

  revalidatePath('/dashboard/salary');
  return { success: true, data: result.data };
}

/** Admin Action: Update HR parameters on user profile */
export async function adminUpdateKtvHrProfile(
  ktvId: string,
  payload: {
    base_salary: number;
    hire_date: string | null;
    resignation_date: string | null;
    status: string;
  }
) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  const { error } = await supabase
    .from('users')
    .update({
      base_salary: payload.base_salary,
      hire_date: payload.hire_date || null,
      resignation_date: payload.resignation_date || null,
      status: payload.status,
    })
    .eq('id', ktvId);

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'users',
    record_id: ktvId,
    new_data: payload,
  });

  revalidatePath('/dashboard/salary');
  return { success: true };
}
```

**Step 2: Verification of DB Actions**

Create a temporary script `scratch/test-attendance.js` to run inside node to ensure these server actions operate error-free:
```javascript
const { getVNTodayString } = require('../src/services/attendance-actions');
console.log('Vietnam Today Date:', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
```
Run the script to verify.

---

### Task 2: Pro-rated Base Salary & Attendance Safeguard

**Files:**
- Modify: `src/services/salary-actions.ts`

**Step 1: Modify calculation logic**

Locate `publishSalaryRecord` around line 29 of `src/services/salary-actions.ts`. Change the code to read:

```diff
     // 1. Get KTV info (base_salary, resignation_date)
     const { data: ktv } = await supabase
       .from('users')
       .select('id, full_name, base_salary, resignation_date')
       .eq('id', ktvId)
       .single();
 
+    // 1.1 Fetch actual attendance records this month for pro-rata calculation
+    const startOfMonthStr = monthYear;
+    const endOfMonthStr = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
+
+    const { data: attendanceList } = await supabase
+      .from('attendance')
+      .select('status, date')
+      .eq('ktv_id', ktvId)
+      .gte('date', startOfMonthStr)
+      .lt('date', endOfMonthStr);
+
+    let actualDays = 0;
+    if (attendanceList && attendanceList.length > 0) {
+      attendanceList.forEach((att: any) => {
+        if (att.status === 'present' || att.status === 'late') {
+          actualDays += 1.0;
+        } else if (att.status === 'half_day') {
+          actualDays += 0.5;
+        }
+        // 'absent' adds 0
+      });
+    }
+
     // 2. Fetch completed sessions this month
     const startOfMonth = monthYear;
     const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
```

And continue editing inside `publishSalaryRecord` around line 82:

```diff
-    const rawBaseSalary = existing?.base_salary ?? ktv?.base_salary ?? 6000000;
+    const rawBaseSalary = existing?.base_salary ?? ktv?.base_salary ?? 6000000;
     const kpiBonus = existing?.kpi_bonus ?? (sessionsCount > 30 ? 1000000 : 0);
     const deductions = existing?.violations_deduction ?? 0;
     const advances = existing?.service_percentage_bonus ?? 0;
 
     // 5. Pro-rata if resigned
-    let finalBaseSalary = rawBaseSalary;
+    let finalBaseSalary = rawBaseSalary;
     let finalKpiBonus = kpiBonus;
     let finalRatingBonus = ratingBonus;
     let proRataNote = '';
 
+    if (attendanceList && attendanceList.length > 0) {
+      // Pro-rata based on actual working days (Target = 26 days)
+      finalBaseSalary = Math.round((rawBaseSalary / 26) * actualDays);
+      proRataNote = `📊 Công thực tế: ${actualDays}/26 ngày. `;
+    } else {
+      // Fallback safeguard: if exactly 0 attendance records, pay full base salary
+      finalBaseSalary = rawBaseSalary;
+      proRataNote = `ℹ️ Áp dụng lương cứng mặc định (Chưa có dữ liệu chấm công). `;
+    }
+
     if (ktv?.resignation_date) {
       const resignDate = new Date(ktv.resignation_date);
       const monthDate = new Date(monthYear);
       if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
-        finalBaseSalary = calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
+        // Cap the final base salary by resignation pro-rata if resignation occurs
+        const resignCap = calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
+        if (finalBaseSalary > resignCap) {
+          finalBaseSalary = resignCap;
+        }
         finalKpiBonus = 0;
         finalRatingBonus = 0;
         const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
         const daysWorked = resignDate.getDate();
-        proRataNote = `⚠️ KTV nghỉ ngày ${resignDate.toLocaleDateString('vi-VN')} — Lương cứng tính ${daysWorked}/${daysInMonth} ngày`;
+        proRataNote += `⚠️ KTV nghỉ việc từ ngày ${resignDate.toLocaleDateString('vi-VN')} (Giới hạn tối đa ${daysWorked}/${daysInMonth} ngày)`;
       }
     }
```

Verify that editing these formulas compiles correctly and runs.

---

### Task 3: Interactive KTV Check-in/Check-out Mobile Dashboard Widget

**Files:**
- Modify: `src/app/ktv/dashboard/page.tsx`

**Step 1: Implement the UI Component**

Open `src/app/ktv/dashboard/page.tsx`. Import the new action and set up state. Around line 14:

```diff
 import { useState, useEffect } from 'react';
 import { getSalaryData, approveSalary, ... } from '@/services/salary-actions';
+import { getKTVTodayAttendance, ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
 import { toast } from 'sonner';
```

Add states inside the `KtvDashboard` component:
```typescript
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
```

Add fetch helper and load on initial render:
```typescript
  const fetchAttendance = async () => {
    try {
      const att = await getKTVTodayAttendance();
      setTodayAttendance(att);
    } catch (e) {
      console.error(e);
    }
  };
```

Update `fetchData` to include `fetchAttendance()`:
```typescript
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [u, active, upcoming] = await Promise.all([
        getCurrentUser(),
        getKTVActiveSessions(),
        getKTVUpcomingSessions()
      ]);
      
      setUser(u);
      setActiveSessions(active);
      setUpcomingSessions(upcoming);
      
      if (u) {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [earn, notifs] = await Promise.all([
          getKTVEarnings(monthStr),
          getKTVNotifications(),
          fetchAttendance(), // Load attendance records
        ]);
        setEarnings(earn);
        setNotifications(notifs);
      }
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };
```

Add check-in and check-out handlers:
```typescript
  const handleCheckIn = async () => {
    setIsAttendanceLoading(true);
    const res = await ktvCheckIn();
    if (res.success) {
      toast.success(res.data.status === 'late' ? 'Check-in thành công (Trễ giờ)!' : 'Check-in thành công!');
      fetchAttendance();
    } else {
      toast.error(res.error || 'Check-in thất bại');
    }
    setIsAttendanceLoading(false);
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn Check-out ca làm việc hôm nay?')) return;
    setIsAttendanceLoading(true);
    const res = await ktvCheckOut();
    if (res.success) {
      toast.success('Check-out thành công!');
      fetchAttendance();
    } else {
      toast.error(res.error || 'Check-out thất bại');
    }
    setIsAttendanceLoading(false);
  };
```

Render this gorgeous mobile Check-in/out card below the system clock/header and before the active sessions lists. Insert inside the main `return`:

```jsx
      {/* Attendance Clock Card */}
      <div className="px-6 mb-6">
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100/50 relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Điểm danh ngày hôm nay</h4>
              <p className="text-sm font-bold text-slate-500 mt-0.5">Thời gian vào ca tiêu chuẩn: 08:30 sáng</p>
            </div>
            
            {todayAttendance && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                todayAttendance.status === 'present' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                todayAttendance.status === 'late' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                todayAttendance.status === 'half_day' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                'bg-rose-50 text-rose-600 border border-rose-100'
              }`}>
                {todayAttendance.status === 'present' ? 'Đúng giờ' :
                 todayAttendance.status === 'late' ? 'Đi trễ' :
                 todayAttendance.status === 'half_day' ? 'Nửa ngày' :
                 'Vắng mặt'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Giờ Check-in</span>
              <span className="text-lg font-black text-slate-700">
                {todayAttendance?.checkin_time 
                  ? new Date(todayAttendance.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Giờ Check-out</span>
              <span className="text-lg font-black text-slate-700">
                {todayAttendance?.checkout_time 
                  ? new Date(todayAttendance.checkout_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {!todayAttendance ? (
              <button
                onClick={handleCheckIn}
                disabled={isAttendanceLoading}
                className="flex-1 py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl transition-all shadow-lg shadow-pink-100 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isAttendanceLoading ? 'Đang gửi...' : 'Đầu ca: CHECK-IN'}
              </button>
            ) : !todayAttendance.checkout_time ? (
              <button
                onClick={handleCheckOut}
                disabled={isAttendanceLoading}
                className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-lg shadow-slate-100 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isAttendanceLoading ? 'Đang gửi...' : 'Cuối ca: CHECK-OUT'}
              </button>
            ) : (
              <div className="flex-1 py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 font-black rounded-2xl text-xs uppercase tracking-widest text-center">
                🎉 Bạn đã hoàn thành chấm công hôm nay
              </div>
            )}
          </div>
        </div>
      </div>
```

---

### Task 4: Admin Salary Dashboard: Multi-Tab Restructuring

**Files:**
- Modify: `src/app/dashboard/salary/page.tsx`

**Step 1: Implement Tabs State and Headers**

Import the attendance actions and state hooks:
```typescript
import { getMonthlyAttendanceSummary, adminOverrideAttendance, adminUpdateKtvHrProfile } from '@/services/attendance-actions';
import { UserCog, CalendarDays } from 'lucide-react';
```

Inside the `SalaryPage` component, initialize `activeTab` state:
```typescript
  const [activeTab, setActiveTab] = useState<'payroll' | 'attendance' | 'hr_profile'>('payroll');
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
```

On mount, call `getMonthlyAttendanceSummary(currentMonth)` to fetch attendance data alongside salary data:
```typescript
  useEffect(() => {
    async function fetchData() {
      try {
        const autoRes = await checkAndAutoConfirm();
        if (autoRes.count > 0) toast.info(`Đã tự động xác nhận ${autoRes.count} bảng lương quá hạn 48h`);

        const [salaryData, matrix, attData] = await Promise.all([
          getSalaryData(),
          getKtvSessionMatrix(),
          getMonthlyAttendanceSummary(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7))
        ]);
        setKtvSalaries(salaryData);
        setMatrixData(matrix);
        setAttendanceData(attData);
      } catch (error) {
        console.error('Fetch data error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);
```

Add a beautiful Tab Navigation bar just below the three Summary Cards and above the tables:

```jsx
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-8 gap-6">
        <button
          onClick={() => setActiveTab('payroll')}
          className={cn(
            "pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
            activeTab === 'payroll' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <DollarSign className="w-4 h-4" />
          <span>Bảng tính lương</span>
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={cn(
            "pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
            activeTab === 'attendance' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Quản lý chấm công</span>
        </button>
        <button
          onClick={() => setActiveTab('hr_profile')}
          className={cn(
            "pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
            activeTab === 'hr_profile' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <UserCog className="w-4 h-4" />
          <span>Hồ sơ nhân sự</span>
        </button>
      </div>
```

---

### Task 5: Tab 2: Monthly Attendance Grid & Visual Calendar Overrides

**Files:**
- Modify: `src/app/dashboard/salary/page.tsx`

**Step 1: Design Calendar Modal UI**

When `activeTab === 'attendance'`, display a premium grid showing each KTV, their total attendance counts, and a visual override modal.

Add state variables for the Calendar View modal inside `SalaryPage`:
```typescript
  const [selectedKtv, setSelectedKtv] = useState<any>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [selectedDayLog, setSelectedDayLog] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'late' | 'absent' | 'half_day'>('present');
  const [overrideCheckin, setOverrideCheckin] = useState('');
  const [overrideCheckout, setOverrideCheckout] = useState('');
```

Add calendar click handler:
```typescript
  const openKtvCalendar = (ktv: any) => {
    setSelectedKtv(ktv);
    setIsCalendarModalOpen(true);
  };

  const handleDayClick = (dateStr: string, log: any) => {
    setSelectedDayLog({
      date: dateStr,
      log: log || null
    });
    setOverrideStatus(log?.status || 'present');
    setOverrideCheckin(log?.checkin_time ? new Date(log.checkin_time).toISOString().substring(0, 16) : '');
    setOverrideCheckout(log?.checkout_time ? new Date(log.checkout_time).toISOString().substring(0, 16) : '');
  };

  const handleSaveOverride = async () => {
    if (!selectedKtv || !selectedDayLog) return;
    const res = await adminOverrideAttendance({
      ktvId: selectedKtv.id,
      date: selectedDayLog.date,
      status: overrideStatus,
      checkinTime: overrideCheckin || undefined,
      checkoutTime: overrideCheckout || undefined
    });

    if (res.success) {
      toast.success('Cập nhật chấm công thành công!');
      // Reload attendance & salaries
      const [salaries, attSummary] = await Promise.all([
        getSalaryData(),
        getMonthlyAttendanceSummary(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7))
      ]);
      setKtvSalaries(salaries);
      setAttendanceData(attSummary);
      
      // Update selected KTV to reflect changed day
      const updatedKtv = attSummary.find(k => k.id === selectedKtv.id);
      setSelectedKtv(updatedKtv);
      setSelectedDayLog(null);
    } else {
      toast.error('Lỗi: ' + res.error);
    }
  };
```

Render Tab 2 view when `activeTab === 'attendance'`:

```jsx
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-10">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <CalendarDays className="w-8 h-8 text-primary" />
                Bảng tổng hợp chấm công tháng {currentMonthYear}
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Chốt ngày công thực tế để làm căn cứ tính lương cứng cơ bản.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kỹ thuật viên</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Đúng giờ (1.0)</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Đi trễ (1.0)</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nửa ngày (0.5)</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Vắng (0.0)</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center bg-slate-50">Ngày công thực tế</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {attendanceData.map((ktv) => (
                  <tr key={ktv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 font-bold text-slate-900">{ktv.name}</td>
                    <td className="px-8 py-6 font-black text-emerald-600 text-center">{ktv.present} ngày</td>
                    <td className="px-8 py-6 font-black text-amber-500 text-center">{ktv.late} ngày</td>
                    <td className="px-8 py-6 font-black text-blue-500 text-center">{ktv.halfDay} ngày</td>
                    <td className="px-8 py-6 font-black text-rose-500 text-center">{ktv.absent} ngày</td>
                    <td className="px-8 py-6 font-black text-slate-900 text-lg text-center bg-slate-50/50">{ktv.totalDays} / 26</td>
                    <td className="px-8 py-6 text-center">
                      <button
                        onClick={() => openKtvCalendar(ktv)}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm shadow-pink-50"
                      >
                        Chi tiết & Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

Render the beautiful Calendar Override Modal at the end of the page body:

```jsx
      {/* Calendar Modal */}
      {isCalendarModalOpen && selectedKtv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto">
            
            {/* Left: Monthly Calendar Matrix */}
            <div className="flex-1 p-8 border-r border-slate-100 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{selectedKtv.name}</h3>
                  <p className="text-slate-500 text-sm font-bold">Chấm công tháng {currentMonthYear}</p>
                </div>
                <button
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 border text-slate-400 font-bold hover:bg-slate-100 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Attendance Matrix Grid */}
              <div className="grid grid-cols-7 gap-2 text-center font-black text-xs text-slate-400 mb-2">
                <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {(() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth(); // 0-indexed
                  const firstDayIndex = new Date(year, month, 1).getDay(); // Sun = 0
                  const adjustedStart = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Mon = 0
                  
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const grid = [];
                  
                  // Empty slots before 1st of month
                  for (let i = 0; i < adjustedStart; i++) {
                    grid.push(<div key={`empty-${i}`} className="aspect-square bg-slate-50/20 rounded-xl"></div>);
                  }
                  
                  // Actual calendar days
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const log = selectedKtv.logs.find((l: any) => l.date === dateStr);
                    
                    let bgStyle = 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100/50';
                    if (log) {
                      if (log.status === 'present') bgStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100';
                      else if (log.status === 'late') bgStyle = 'bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100';
                      else if (log.status === 'half_day') bgStyle = 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100';
                      else if (log.status === 'absent') bgStyle = 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100';
                    }

                    grid.push(
                      <button
                        key={dateStr}
                        onClick={() => handleDayClick(dateStr, log)}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all ${bgStyle}`}
                      >
                        <span className="text-sm font-black">{day}</span>
                        {log && (
                          <span className="text-[8px] font-black uppercase mt-0.5 opacity-80">
                            {log.status === 'present' ? 'Đủ' :
                             log.status === 'late' ? 'Trễ' :
                             log.status === 'half_day' ? '0.5' :
                             'Vắng'}
                          </span>
                        )}
                      </button>
                    );
                  }
                  return grid;
                })()}
              </div>
            </div>

            {/* Right: Override form */}
            <div className="w-full md:w-80 bg-slate-50/50 p-8 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Hiệu chỉnh ngày công</h4>
                
                {selectedDayLog ? (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-4 border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ngày hiệu chỉnh</span>
                      <span className="text-sm font-black text-slate-800">
                        {new Date(selectedDayLog.date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Trạng thái công</label>
                      <select
                        value={overrideStatus}
                        onChange={(e: any) => setOverrideStatus(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="present">Đúng giờ (1.0 công)</option>
                        <option value="late">Đi trễ (1.0 công)</option>
                        <option value="half_day">Nửa ngày (0.5 công)</option>
                        <option value="absent">Vắng mặt (0.0 công)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Giờ vào thực tế</label>
                      <input
                        type="datetime-local"
                        value={overrideCheckin}
                        onChange={(e) => setOverrideCheckin(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Giờ ra thực tế</label>
                      <input
                        type="datetime-local"
                        value={overrideCheckout}
                        onChange={(e) => setOverrideCheckout(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-100/50 rounded-2xl p-6 text-center text-slate-400 border border-dashed border-slate-200 font-bold text-sm">
                    💡 Hãy nhấn vào một ngày trên lịch để thiết lập hoặc sửa đổi thông tin chấm công!
                  </div>
                )}
              </div>

              {selectedDayLog && (
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setSelectedDayLog(null)}
                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveOverride}
                    className="flex-1 py-3 bg-primary text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-pink-100"
                  >
                    Lưu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
```

---

### Task 6: Tab 3: HR Profile Directory & Base Salary Override Drawer

**Files:**
- Modify: `src/app/dashboard/salary/page.tsx`

**Step 1: Add HR Directory rendering & Edit Modal**

Add states for HR Profile update modal inside `SalaryPage`:
```typescript
  const [isHrModalOpen, setIsHrModalOpen] = useState(false);
  const [hrKtvProfile, setHrKtvProfile] = useState<any>(null);
  const [hrBaseSalary, setHrBaseSalary] = useState(0);
  const [hrHireDate, setHrHireDate] = useState('');
  const [hrResignDate, setHrResignDate] = useState('');
  const [hrStatus, setHrStatus] = useState('active');
  const [isHrSaving, setIsHrSaving] = useState(false);
```

Add HR editing handlers:
```typescript
  const openHrEditModal = (ktv: any) => {
    setHrKtvProfile(ktv);
    setHrBaseSalary(ktv.baseSalary);
    
    // Find matching profile logs or default
    const matchingLog = attendanceData.find(k => k.id === ktv.id);
    
    // Fetch detailed profile columns by executing server retrieval or matching from state
    // Let's configure initial states based on state
    setHrHireDate(ktv.hireDate || '');
    setHrResignDate(ktv.resignationDate || '');
    setHrStatus(ktv.status || 'active');
    
    setIsHrModalOpen(true);
  };

  const handleSaveHrProfile = async () => {
    if (!hrKtvProfile) return;
    setIsHrSaving(true);
    const res = await adminUpdateKtvHrProfile(hrKtvProfile.id, {
      base_salary: hrBaseSalary,
      hire_date: hrHireDate || null,
      resignation_date: hrResignDate || null,
      status: hrStatus
    });

    if (res.success) {
      toast.success('Cập nhật thông tin nhân sự thành công!');
      // Reload salary data
      const data = await getSalaryData();
      setKtvSalaries(data);
      setIsHrModalOpen(false);
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsHrSaving(false);
  };
```

Render Tab 3 when `activeTab === 'hr_profile'`:

```jsx
      {activeTab === 'hr_profile' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-10">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <UserCog className="w-8 h-8 text-primary" />
                Danh mục hồ sơ & Hợp đồng nhân sự KTV
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Cấu hình lương cơ bản cứng (26 ngày công), ngày nhận việc, ngày nghỉ việc để tính toán lương tự động.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mức lương cứng mặc định (26 ngày)</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày nhận việc</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày nghỉ việc</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ktvSalaries.map((ktv) => (
                  <tr key={ktv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 font-bold text-slate-900">{ktv.name}</td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        ktv.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {ktv.status === 'active' ? 'Đang hoạt động' : 'Đã nghỉ việc'}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-black text-slate-700">{ktv.baseSalary.toLocaleString()}đ</td>
                    <td className="px-8 py-6 font-bold text-slate-500">{ktv.hireDate ? new Date(ktv.hireDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</td>
                    <td className="px-8 py-6 font-bold text-rose-500">{ktv.resignationDate ? new Date(ktv.resignationDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-8 py-6 text-center">
                      <button
                        onClick={() => openHrEditModal(ktv)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        Thiết lập HR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

Render the beautiful HR update modal at the end of the body:

```jsx
      {/* HR Profile Modal */}
      {isHrModalOpen && hrKtvProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-8">
              <h3 className="text-2xl font-black text-slate-900 mb-6">Hiệu chỉnh Hồ sơ HR</h3>
              <p className="text-slate-500 text-sm font-bold mb-4">Cấu hình cho KTV: {hrKtvProfile.name}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Mức lương cứng tiêu chuẩn (26 ngày công)</label>
                  <input type="number" 
                    value={hrBaseSalary} 
                    onChange={e => setHrBaseSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Ngày bắt đầu nhận việc</label>
                  <input type="date" 
                    value={hrHireDate} 
                    onChange={e => setHrHireDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Ngày nghỉ việc (nếu có)</label>
                  <input type="date" 
                    value={hrResignDate} 
                    onChange={e => setHrResignDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Trạng thái làm việc</label>
                  <select
                    value={hrStatus}
                    onChange={e => setHrStatus(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="active">Đang làm việc (Active)</option>
                    <option value="inactive">Đã nghỉ việc (Inactive)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsHrModalOpen(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSaveHrProfile}
                disabled={isHrSaving}
                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-pink-100 transition-all disabled:opacity-50"
              >
                {isHrSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
```

---

### Step 2: Final Integration and Build Check
Finally, verify that the application compiles perfectly by running:
`npm run build` or running Next.js lint validation. Ensure all TypeScript variables are well declared.
