'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  Award, 
  Users, 
  RefreshCw, 
  Lock, 
  Unlock,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle,
  ChevronRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase-client';
import { HealthcarePayrollAdapter, type HealthcarePayrollVM } from '@/modules/bella-healthcare/adapters/healthcare-adapter';

export default function HealthcareSalaryPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Database states
  const [dbSalaryRecords, setDbSalaryRecords] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  
  // ViewModels
  const [salaries, setSalaries] = useState<HealthcarePayrollVM[]>([]);
  
  // Selected staff member for adjustments
  const [selectedStaff, setSelectedStaff] = useState<HealthcarePayrollVM | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  const fetchData = useCallback(async (month = selectedMonth) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Chưa đăng nhập');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        toast.error('Không tìm thấy thông tin tenant');
        return;
      }

      const tenantId = profile.tenant_id;

      // 1. Fetch Users (Doctors & Nurses) for this tenant
      const { data: staffMembers, error: uErr } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('role', 'admin'); // Don't list the admin in payroll sheet

      if (uErr) throw uErr;
      setDbUsers(staffMembers || []);

      // 2. Fetch Salary Records for this month
      const { data: salaryRecs, error: salErr } = await supabase
        .from('salary_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('month_year', month);

      if (salErr) throw salErr;
      setDbSalaryRecords(salaryRecs || []);

    } catch (err: any) {
      console.error('Error fetching salary records:', err);
      toast.error('Lỗi tải bảng lương: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Combine Users and Salary Records to build view model
  useEffect(() => {
    const payrollAdapter = new HealthcarePayrollAdapter();
    const isDbEmpty = dbSalaryRecords.length === 0;

    const mapped = dbUsers.map(user => {
      const savedRecord = dbSalaryRecords.find(r => r.ktv_id === user.id);
      
      // If db has no salary record yet for this month, calculate on the fly for draft state
      const baseSalary = savedRecord ? savedRecord.base_salary : (user.base_salary || 5000000);
      const commission = savedRecord ? savedRecord.service_percentage_bonus : 2000000;
      const totalSalary = savedRecord ? savedRecord.total_salary : (baseSalary + commission);
      const status = savedRecord ? savedRecord.status : 'draft';

      return payrollAdapter.map({
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        positionTier: user.position_tier,
        hire_date: user.hire_date,
        base_salary: baseSalary,
        service_percentage_bonus: commission,
        total_salary: totalSalary,
        status: status
      });
    });

    setSalaries(mapped);
  }, [dbUsers, dbSalaryRecords]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast.success('Đã cập nhật bảng lương mới nhất');
  };

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const amount = Number(adjustmentAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Số tiền điều chỉnh không hợp lệ');
      return;
    }

    if (!adjustmentReason.trim()) {
      toast.error('Vui lòng điền lý do điều chỉnh');
      return;
    }

    // CRITICAL: Block all modifications at source if status is finalized or locked
    if (selectedStaff.status === 'finalized') {
      toast.error('Không thể điều chỉnh: Bảng lương đã hoàn tất (finalized) và đã xuất chi.');
      return;
    }
    if (selectedStaff.status === 'locked') {
      toast.error('Không thể điều chỉnh: Bảng lương đã bị khóa (month-end close). Liên hệ kế toán.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      const tenantId = profile!.tenant_id;

      // Upsert salary record
      const existing = dbSalaryRecords.find(r => r.ktv_id === selectedStaff.employeeId);
      const base = selectedStaff.baseSalary;
      const originalCommission = selectedStaff.procedureBonus;
      const newCommission = originalCommission + amount;
      const newTotal = base + newCommission;

      const payload = {
        tenant_id: tenantId,
        ktv_id: selectedStaff.employeeId,
        month_year: selectedMonth,
        base_salary: base,
        service_percentage_bonus: newCommission,
        kpi_bonus: existing?.kpi_bonus || 0,
        total_salary: newTotal,
        status: existing?.status || 'draft',
      };

      const { error } = await supabase
        .from('salary_records')
        .upsert(payload, { onConflict: 'tenant_id,ktv_id,month_year' });

      if (error) throw error;

      toast.success(`Đã áp dụng điều chỉnh ${amount > 0 ? '+' : ''}${formatVnd(amount)} cho ${selectedStaff.employeeName}`);
      setSelectedStaff(null);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu điều chỉnh: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeSheet = async () => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      const tenantId = profile!.tenant_id;

      // Loop and insert all draft records as finalized
      const recordsToUpsert = salaries.map(sal => ({
        tenant_id: tenantId,
        ktv_id: sal.employeeId,
        month_year: selectedMonth,
        base_salary: sal.baseSalary,
        service_percentage_bonus: sal.procedureBonus,
        kpi_bonus: 0,
        total_salary: sal.totalSalary,
        status: 'finalized', // Make them finalized
      }));

      const { error } = await supabase
        .from('salary_records')
        .upsert(recordsToUpsert, { onConflict: 'tenant_id,ktv_id,month_year' });

      if (error) throw error;

      toast.success('Chốt bảng lương thành công. Tất cả bản ghi đã được chuyển sang trạng thái ĐÃ HOÀN TẤT.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi chốt bảng lương: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatVnd = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm text-left">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Tính Lương Bác Sĩ & Điều Dưỡng</h1>
            <p className="text-xs text-slate-500 font-medium">Bảng kê chi tiết lương cứng, phụ cấp ca lâm sàng & thủ thuật y tế</p>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={selectedMonth.substring(0, 7)}
              onChange={(e) => setSelectedMonth(`${e.target.value}-01`)}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100/60 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleFinalizeSheet}
              disabled={isSubmitting || salaries.every(s => s.status === 'finalized')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              Chốt lương tháng
            </button>
          </div>
        </div>

        {/* Salary List Table */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6 text-left">
          <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-850/80 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Nhân viên y tế</th>
                  <th className="px-6 py-4 whitespace-nowrap">Chức vụ / Cấp bậc</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Trạng thái</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Lương cơ bản</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Thù lao lâm sàng</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Tổng thu nhập</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-bold text-slate-700 dark:text-slate-350">
                {salaries.map((sal) => {
                  // Resolve role-specific avatar initials and color schemes
                  let avatarInitials = 'TL';
                  let avatarBg = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
                  let badgeStyle = 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-450 border-slate-200 dark:border-slate-800';

                  if (sal.role === 'doctor') {
                    avatarInitials = 'BS';
                    avatarBg = 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40';
                    badgeStyle = 'bg-teal-50/50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-100/60 dark:border-teal-900/40';
                  } else if (sal.role === 'nurse') {
                    avatarInitials = 'ĐD';
                    avatarBg = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40';
                    badgeStyle = 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/40';
                  }

                  return (
                    <tr key={sal.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 align-middle">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black tracking-wider shadow-inner ${avatarBg}`}>
                            {avatarInitials}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-850 dark:text-slate-100 whitespace-nowrap">{sal.employeeName}</div>
                            <div className="text-[9px] text-slate-400 font-medium whitespace-nowrap">Hợp đồng ngày: {sal.hireDate}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}>
                          {sal.positionTier}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] uppercase font-black tracking-wider whitespace-nowrap ${
                          sal.status === 'finalized'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/80'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/80'
                        }`}>
                          {sal.status === 'finalized' ? '🔒 Đã chốt' : '📝 Dự thảo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-800 dark:text-slate-150 whitespace-nowrap">{formatVnd(sal.baseSalary)}</td>
                      <td className="px-6 py-4 text-right text-teal-600 dark:text-teal-400 whitespace-nowrap">+{formatVnd(sal.procedureBonus)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">{formatVnd(sal.totalSalary)}</td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedStaff(sal)}
                          disabled={sal.status === 'finalized'}
                          className="px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/60 transition-all text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Điều chỉnh
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal / Drawers for adjustment */}
        <AnimatePresence>
          {selectedStaff && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl space-y-6 text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Điều chỉnh thù lao thủ thuật</h3>
                    <p className="text-xs text-slate-500 font-medium">Nhân viên: {selectedStaff.employeeName}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedStaff(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleApplyAdjustment} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Số tiền điều chỉnh (VND)</label>
                    <input
                      type="number"
                      placeholder="VD: 500000 hoặc -200000"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-350 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Lý do điều chỉnh</label>
                    <textarea
                      placeholder="VD: Thưởng phụ ca lâm sàng cấy ghép Implant phức tạp"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-350 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="flex-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                    >
                      {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
