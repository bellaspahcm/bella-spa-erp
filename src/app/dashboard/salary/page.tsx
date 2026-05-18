'use client';

import { motion } from 'framer-motion';
import { 
  DollarSign, 
  Download, 
  TrendingUp, 
  Search, 
  Filter, 
  Edit2, 
  CheckCircle2, 
  ChevronRight, 
  User, 
  Calendar as CalendarIcon, 
  Briefcase, 
  Award, 
  AlertCircle, 
  ShieldCheck, 
  Star, 
  Zap,
  UserCog, 
  CalendarDays,
  FileSpreadsheet, 
  Send, 
  Lock, 
  UserCheck, 
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { useState, useEffect } from 'react';
import { getSalaryData, approveSalary, updateSalaryConfig, getKtvSessionMatrix, confirmKtvSessions, publishSalaryRecord, publishAllSalaryRecords, adminConfirmOnBehalf, finalizeSalaryRecord, finalizeAllSalaryRecords, checkAndAutoConfirm } from '@/services/salary-actions';
import { getMonthlyAttendanceSummary, adminOverrideAttendance, adminUpdateKtvHrProfile } from '@/services/attendance-actions';
import { exportSalaryToExcel, exportSessionMatrixToExcel } from '@/services/export-actions';
import { toast } from 'sonner';
import { getCurrentUser } from '@/services/user-actions';

export default function SalaryPage() {
  const [ktvSalaries, setKtvSalaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [matrixData, setMatrixData] = useState<{ ktvs: any[], packageNames: string[] } | null>(null);
  const [isExportingMatrix, setIsExportingMatrix] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'payroll' | 'attendance' | 'hr_profile'>('payroll');

  // Centered Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }) => {
    setConfirmModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await options.onConfirm();
        } catch (error) {
          console.error(error);
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
      confirmText: options.confirmText || 'Xác nhận',
      cancelText: options.cancelText || 'Hủy bỏ',
      isDanger: options.isDanger || false,
      isLoading: false
    });
  };
  const [attendanceData, setAttendanceData] = useState<any[]>([]);

  // Attendance Override Calendar States
  const [selectedKtv, setSelectedKtv] = useState<any>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [selectedDayLog, setSelectedDayLog] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'late' | 'absent' | 'half_day'>('present');
  const [overrideCheckin, setOverrideCheckin] = useState('');
  const [overrideCheckout, setOverrideCheckout] = useState('');

  // HR Profile Editor States
  const [isHrModalOpen, setIsHrModalOpen] = useState(false);
  const [hrKtvProfile, setHrKtvProfile] = useState<any>(null);
  const [hrBaseSalary, setHrBaseSalary] = useState(0);
  const [hrHireDate, setHrHireDate] = useState('');
  const [hrResignDate, setHrResignDate] = useState('');
  const [hrStatus, setHrStatus] = useState('active');
  const [isHrSaving, setIsHrSaving] = useState(false);
  
  const now = new Date();
  const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const prevMonthYear = now.getMonth() === 0 ? `12/${now.getFullYear() - 1}` : `${String(now.getMonth()).padStart(2, '0')}/${now.getFullYear()}`;

  useEffect(() => {
    async function fetchUser() {
      const user = await getCurrentUser();
      setCurrentUser(user);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Auto-confirm stale records on page load
        const autoRes = await checkAndAutoConfirm();
        if (autoRes.count > 0) toast.info(`Đã tự động xác nhận ${autoRes.count} bảng lương quá hạn 48h`);

        const currentMonthStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7);
        const [salaryData, matrix, attData] = await Promise.all([
          getSalaryData(),
          getKtvSessionMatrix(),
          getMonthlyAttendanceSummary(currentMonthStr)
        ]);
        setKtvSalaries(salaryData);
        setMatrixData(matrix);
        setAttendanceData(attData || []);
      } catch (error) {
        console.error('Fetch data error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleApprove = (id: string, name: string) => {
    showConfirm({
      title: 'Phê duyệt lương',
      message: `Bạn có chắc chắn muốn phê duyệt bảng lương tháng này cho kỹ thuật viên ${name}? Bảng lương sau khi duyệt sẽ chuyển sang trạng thái đã phê duyệt.`,
      confirmText: 'Phê duyệt',
      onConfirm: async () => {
        const result = await approveSalary(id);
        if (result.success) {
          toast.success('Đã phê duyệt lương thành công');
          setKtvSalaries(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
        } else {
          toast.error('Lỗi khi phê duyệt lương');
        }
      }
    });
  };

  const openEditModal = (s: any) => {
    setEditingSalary({ ...s });
    setIsEditModalOpen(true);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    const result = await updateSalaryConfig(editingSalary.id, {
      baseSalary: editingSalary.baseSalary,
      kpiBonus: editingSalary.kpiBonus,
      deductions: editingSalary.deductions,
      advances: editingSalary.advances
    });

    if (result.success) {
      toast.success('Đã cập nhật lương thành công');
      setKtvSalaries(prev => prev.map(s => {
        if (s.id === editingSalary.id) {
          return {
            ...s,
            baseSalary: editingSalary.baseSalary,
            kpiBonus: editingSalary.kpiBonus,
            deductions: editingSalary.deductions,
            advances: editingSalary.advances,
            status: 'pending', // Update status to reflect "Chờ duyệt"
            totalSalary: editingSalary.baseSalary + s.sessionBonus + (s.ratingBonus || 0) + editingSalary.kpiBonus - editingSalary.deductions - editingSalary.advances
          };
        }
        return s;
      }));
      setIsEditModalOpen(false);
    } else {
      toast.error('Lỗi khi cập nhật lương: ' + result.error);
    }
    setIsSaving(false);
  };

  const handleApproveAll = () => {
    showConfirm({
      title: 'Phê duyệt tất cả',
      message: 'Bạn có chắc chắn muốn chốt và phê duyệt lương cho tất cả nhân viên trong danh sách này không?',
      confirmText: 'Phê duyệt tất cả',
      onConfirm: async () => {
        setIsLoading(true);
        let successCount = 0;
        for (const s of filteredSalaries) {
          if (s.status !== 'approved') {
            const result = await approveSalary(s.id);
            if (result.success) successCount++;
          }
        }
        if (successCount > 0) {
          toast.success(`Đã chốt lương thành công cho ${successCount} nhân viên`);
          const data = await getSalaryData();
          setKtvSalaries(data);
        } else {
          toast.info('Không có bản ghi nào cần chốt lương.');
        }
        setIsLoading(false);
      }
    });
  };

  const handlePublishAll = () => {
    showConfirm({
      title: 'Gửi đối soát tất cả',
      message: 'Bạn có chắc chắn muốn gửi bảng lương dự thảo đến tất cả Kỹ thuật viên để họ xác nhận không?',
      confirmText: 'Gửi tất cả',
      onConfirm: async () => {
        setIsLoading(true);
        const res = await publishAllSalaryRecords();
        if (res.success) {
          toast.success(`Đã gửi đối soát cho ${res.count} KTV`);
          const [salary, matrix] = await Promise.all([getSalaryData(), getKtvSessionMatrix()]);
          setKtvSalaries(salary); setMatrixData(matrix);
        } else toast.error('Lỗi khi gửi đối soát');
        setIsLoading(false);
      }
    });
  };

  const handleFinalizeAll = () => {
    showConfirm({
      title: 'Chốt sổ tất cả',
      message: 'Bạn có chắc chắn muốn chốt sổ và khóa toàn bộ bảng lương đã được Kỹ thuật viên xác nhận không?',
      confirmText: 'Chốt sổ tất cả',
      onConfirm: async () => {
        setIsLoading(true);
        const res = await finalizeAllSalaryRecords();
        if (res.success) {
          toast.success(`Đã chốt sổ ${res.count} bảng lương`);
          const data = await getSalaryData(); setKtvSalaries(data);
        } else toast.error('Lỗi khi chốt sổ');
        setIsLoading(false);
      }
    });
  };

  const handlePublishOne = async (ktvId: string, ktvName: string) => {
    const res = await publishSalaryRecord(ktvId);
    if (res.success) {
      toast.success(`Đã gửi đối soát cho ${ktvName}`);
      const [salary, matrix] = await Promise.all([getSalaryData(), getKtvSessionMatrix()]);
      setKtvSalaries(salary); setMatrixData(matrix);
    } else toast.error('Lỗi: ' + res.error);
  };

  const handleConfirmOnBehalf = (ktvId: string, ktvName: string) => {
    showConfirm({
      title: 'Xác nhận đối soát thay',
      message: `Bạn có chắc chắn muốn thay mặt Kỹ thuật viên ${ktvName} để xác nhận bảng đối soát này không?`,
      confirmText: 'Xác nhận thay',
      onConfirm: async () => {
        const res = await adminConfirmOnBehalf(ktvId);
        if (res.success) {
          toast.success(`Đã xác nhận thay cho ${ktvName}`);
          const [salary, matrix] = await Promise.all([getSalaryData(), getKtvSessionMatrix()]);
          setKtvSalaries(salary); setMatrixData(matrix);
        } else toast.error('Lỗi: ' + res.error);
      }
    });
  };

  const handleFinalizeOne = (ktvId: string, ktvName: string) => {
    showConfirm({
      title: 'Chốt sổ lương KTV',
      message: `Bạn có chắc chắn muốn khóa và chốt sổ bảng lương của kỹ thuật viên ${ktvName}? Sau khi chốt sổ, các thông tin này sẽ không thể sửa đổi.`,
      confirmText: 'Chốt sổ',
      onConfirm: async () => {
        const res = await finalizeSalaryRecord(ktvId);
        if (res.success) {
          toast.success(`Đã chốt sổ lương cho ${ktvName}`);
          const data = await getSalaryData(); setKtvSalaries(data);
        } else toast.error(res.error || 'Lỗi khi chốt sổ');
      }
    });
  };

  const handleExport = async (s: any) => {
    try {
      const toastId = toast.loading(`Đang tạo báo cáo cho ${s.name}...`);
      const base64 = await exportSalaryToExcel(s.id, s.name);
      
      // Download the file
      const blob = await (await fetch(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`)).blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_luong_${s.name.replace(/\s+/g, '_')}_${currentMonthYear.replace('/', '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Đã xuất báo cáo thành công cho ${s.name}`, { id: toastId });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Lỗi khi xuất báo cáo Excel');
    }
  };

  const handleExportMatrix = async () => {
    if (!matrixData) return;
    setIsExportingMatrix(true);
    const toastId = toast.loading('Đang chuẩn bị bảng đối soát số buổi...');
    try {
      const base64 = await exportSessionMatrixToExcel(matrixData.ktvs, matrixData.packageNames);
      const blob = await (await fetch(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`)).blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bang_doi_soat_buoi_lam_KTV_${currentMonthYear.replace('/', '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Đã xuất bảng đối soát thành công', { id: toastId });
    } catch (error) {
      console.error('Matrix export failed:', error);
      toast.error('Lỗi khi xuất bảng đối soát', { id: toastId });
    } finally {
      setIsExportingMatrix(false);
    }
  };

  // Vietnam Timezone helper functions
  const toLocalISOString = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const tzOffset = 7 * 60; // Vietnam +7 hours in minutes
    const localTime = new Date(date.getTime() + tzOffset * 60 * 1000);
    return localTime.toISOString().substring(0, 16);
  };

  const formatTimeVN = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return 'Chưa ghi nhận';
    const date = new Date(dateInput);
    return date.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Calendar Override Handlers
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
    setOverrideCheckin(log?.checkin_time ? toLocalISOString(log.checkin_time) : '');
    setOverrideCheckout(log?.checkout_time ? toLocalISOString(log.checkout_time) : '');
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
      const currentMonthStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7);
      const [salaries, attSummary] = await Promise.all([
        getSalaryData(),
        getMonthlyAttendanceSummary(currentMonthStr)
      ]);
      setKtvSalaries(salaries);
      setAttendanceData(attSummary || []);
      
      // Update selected KTV to reflect changed day
      const updatedKtv = attSummary?.find(k => k.id === selectedKtv.id);
      if (updatedKtv) {
        setSelectedKtv(updatedKtv);
      }
      setSelectedDayLog(null);
    } else {
      toast.error('Lỗi: ' + res.error);
    }
  };

  // HR Profile Editor Handlers
  const openHrEditModal = (ktv: any) => {
    setHrKtvProfile(ktv);
    setHrBaseSalary(ktv.baseSalary);
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

  if (isLoading) {
    return (
      <div className="flex-1 p-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-primary uppercase tracking-[0.2em] text-xs">Đang tính toán lương realtime...</p>
        </div>
      </div>
    );
  }

  const filteredSalaries = ktvSalaries.filter((s: any) => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPayout = ktvSalaries.reduce((acc: number, curr: any) => acc + curr.totalSalary, 0);
  const totalSessions = ktvSalaries.reduce((acc: number, curr: any) => acc + curr.sessions, 0);

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">Kỳ lương: {currentMonthYear}</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Lương KTV</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý thu nhập và hiệu suất làm việc của kỹ thuật viên</p>
        </div>
        <div className="flex items-center gap-3">
          <PremiumExportButton />
          {currentUser?.role?.toLowerCase() !== 'ktv' && (
            <>
              <button
                onClick={handlePublishAll}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-4 rounded-2xl font-black transition-all shadow-lg shadow-amber-100 uppercase tracking-widest text-xs"
              >
                <Send className="w-4 h-4" />
                <span>Gửi đối soát</span>
              </button>
              <button
                onClick={handleFinalizeAll}
                className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-4 rounded-2xl font-black transition-all shadow-lg shadow-pink-100 uppercase tracking-widest text-xs"
              >
                <Lock className="w-4 h-4" />
                <span>Chốt sổ</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card-pink p-8 rounded-[40px] relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-black text-white/90 uppercase tracking-widest mb-2">
              {currentUser?.role?.toLowerCase() === 'ktv' ? 'Thu nhập của bạn' : 'Tổng quỹ lương tháng'}
            </p>
            <h3 className="text-4xl font-black mb-4">{totalPayout.toLocaleString()}đ</h3>
            <div className="flex items-center gap-2 text-white/90 font-black text-sm">
              <TrendingUp className="w-4 h-4" />
              So với tháng {prevMonthYear}
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card-white p-8 rounded-[40px] flex flex-col justify-center"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng buổi hoàn thành</p>
              <h4 className="text-2xl font-black text-slate-900">{totalSessions} Buổi</h4>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">Dựa trên dữ liệu thực tế hệ thống</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card-white p-8 rounded-[40px] flex flex-col justify-center"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Thu nhập cao nhất</p>
              <h4 className="text-2xl font-black text-slate-900">{(Math.max(...ktvSalaries.map((s: any) => s.totalSalary)) / 1000000).toFixed(1)}M</h4>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">Nhân viên đạt hiệu suất tốt nhất</p>
        </motion.div>
      </div>

      {/* Premium Tab Selector (Visible only to Admin/Owner, or KTV sees the standard layout) */}
      {currentUser?.role?.toLowerCase() !== 'ktv' && (
        <div className="flex bg-white/60 p-2 rounded-2xl border border-slate-100 gap-2 mb-10 w-fit backdrop-blur-md">
          <button
            onClick={() => setActiveTab('payroll')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'payroll'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
            )}
          >
            <DollarSign className="w-4 h-4" />
            Bảng Lương realtime
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'attendance'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Chấm Công Thực Tế
          </button>
          <button
            onClick={() => setActiveTab('hr_profile')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'hr_profile'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
            )}
          >
            <UserCog className="w-4 h-4" />
            Hồ Sơ Nhân Sự (HR)
          </button>
        </div>
      )}

      {/* Salary Table (Realtime Payroll) */}
      {(activeTab === 'payroll' || currentUser?.role?.toLowerCase() === 'ktv') && (
        <>
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-10">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Bảng tính lương chi tiết
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm tên KTV..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 w-64 font-bold" 
              />
            </div>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[220px]">Kỹ thuật viên</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Số buổi</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Đánh giá</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Lương cứng</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Hoa hồng ca</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Thưởng chất lượng</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Thưởng KPI</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Phạt</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Tạm ứng</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[160px]">Tổng nhận</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Trạng thái</th>
                {currentUser?.role?.toLowerCase() !== 'ktv' && (
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[120px]">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSalaries.map((s, index) => (
                <motion.tr 
                  key={s.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-black shadow-sm group-hover:scale-110 transition-transform">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600">{s.sessions}</span>
                      {s.isConfirmed && (
                        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter animate-in fade-in zoom-in duration-300">
                          <ShieldCheck className="w-3 h-3" />
                          Đã Chốt
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-amber-500 font-black">
                      <Star className="w-4 h-4 fill-current" />
                      {s.avgRating?.toFixed(1) || '5.0'}
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-slate-600 whitespace-nowrap">{s.baseSalary.toLocaleString()}đ</td>
                  <td className="px-8 py-6 font-bold text-emerald-600 whitespace-nowrap">+{s.sessionBonus.toLocaleString()}đ</td>
                  <td className="px-8 py-6 font-bold text-amber-600 whitespace-nowrap">+{s.ratingBonus?.toLocaleString() || 0}đ</td>
                  <td className="px-8 py-6 font-bold text-primary whitespace-nowrap">+{s.kpiBonus.toLocaleString()}đ</td>
                  <td className="px-8 py-6 font-bold text-rose-500 whitespace-nowrap">-{s.deductions.toLocaleString()}đ</td>
                  <td className="px-8 py-6 font-bold text-rose-500 whitespace-nowrap">-{s.advances.toLocaleString()}đ</td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <span className="text-lg font-black text-slate-900">{s.totalSalary.toLocaleString()}đ</span>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex ${
                      s.status === 'finalized' || s.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      s.status === 'confirmed' ? 'bg-blue-50 text-blue-600' :
                      s.status === 'disputed' ? 'bg-rose-50 text-rose-600' :
                      s.status === 'published' || s.status === 'pending' || s.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {(s.status === 'finalized' || s.status === 'approved') ? <CheckCircle2 className="w-3 h-3" /> :
                       s.status === 'confirmed' ? <CheckCircle2 className="w-3 h-3" /> :
                       s.status === 'disputed' ? <AlertCircle className="w-3 h-3" /> :
                       <AlertCircle className="w-3 h-3" />}
                      {s.status === 'finalized' ? 'Đã chốt sổ' :
                       s.status === 'approved' ? 'Đã duyệt' :
                       s.status === 'confirmed' ? 'KTV đã xác nhận' :
                       s.status === 'disputed' ? 'KTV phản hồi' :
                       s.status === 'published' || s.status === 'pending_approval' ? 'Chờ KTV xác nhận' :
                       'Bản nháp'}
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    {currentUser?.role?.toLowerCase() !== 'ktv' && s.status !== 'approved' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openEditModal(s)}
                          className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl transition-all shadow-sm"
                          title="Chỉnh sửa lương"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleApprove(s.id, s.name)}
                          className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-all shadow-sm"
                          title="Phê duyệt"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleExport(s)}
                          className="p-3 bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-sm"
                          title="Xuất báo cáo chi tiết"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {currentUser?.role?.toLowerCase() === 'ktv' && (
                      <button 
                        onClick={() => handleExport(s)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all font-bold text-xs"
                      >
                        <Download className="w-4 h-4" />
                        Xuất báo cáo
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex items-start gap-4 mb-10">
        <div className="p-3 bg-amber-100 rounded-2xl">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h4 className="font-black text-amber-900 uppercase tracking-widest text-xs mb-1">Quy định tính lương</h4>
          <p className="text-amber-800/80 text-sm font-medium">
            Lương KTV được tính dựa trên số buổi thực tế hoàn thành (Hoa hồng theo từng loại dịch vụ) + Lương cứng + Thưởng hiệu suất KPI. 
            Giá tiền công được khóa tại thời điểm tạo hợp đồng để đảm bảo quyền lợi KTV. Hạn chốt lương cuối cùng là ngày 05 hàng tháng.
          </p>
        </div>
      </div>

      {/* Session Matrix Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-10">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
              <CalendarIcon className="w-8 h-8 text-primary" />
              Đối soát số buổi làm chi tiết
            </h2>

            <p className="text-slate-500 font-medium text-sm mt-1">Chi tiết số buổi thực hiện theo từng kỹ thuật viên và gói dịch vụ</p>
          </div>
          <button 
            onClick={handleExportMatrix}
            disabled={isExportingMatrix || !matrixData}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-6 py-3 rounded-2xl font-black transition-all text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Xuất file đối soát</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px] sticky left-0 z-20 bg-slate-50">Kỹ thuật viên</th>
                {matrixData?.packageNames.map((pkg: string) => (
                  <th key={pkg} className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px] text-center">{pkg}</th>
                ))}
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[120px] text-center bg-slate-100/50">Tổng buổi</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[180px] text-center">Trạng thái đối soát</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px] text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matrixData?.ktvs.filter((ktv: any) => ktv.name.toLowerCase().includes(searchQuery.toLowerCase())).map((ktv: any, index: number) => (
                <motion.tr 
                  key={ktv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors group",
                    ktv.isConfirmed && "bg-emerald-50/30 opacity-90"
                  )}
                >
                  <td className="px-8 py-6 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                        {ktv.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{ktv.name}</span>
                    </div>
                  </td>
                  {matrixData?.packageNames.map((pkg: string) => (
                    <td key={pkg} className="px-8 py-6 text-center whitespace-nowrap">
                      <span className={`font-black text-sm ${ktv[pkg] > 0 ? 'text-primary' : 'text-slate-300'}`}>
                        {ktv[pkg] || 0}
                      </span>
                    </td>
                  ))}
                  <td className="px-8 py-6 text-center whitespace-nowrap bg-slate-50/30">
                    <span className="font-black text-slate-900 text-lg">
                      {matrixData.packageNames.reduce((acc: number, pkg: string) => acc + (ktv[pkg] || 0), 0)}
                    </span>
                  </td>
                  {/* Status column */}
                  <td className="px-8 py-6 text-center whitespace-nowrap">
                    {(() => {
                      const salaryRow = ktvSalaries.find((s: any) => s.id === ktv.id);
                      const st = salaryRow?.status;
                      if (st === 'finalized' || st === 'approved') return <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black"><Lock className="w-3 h-3" />Đã chốt sổ</span>;
                      if (st === 'confirmed') return <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black"><CheckCircle2 className="w-3 h-3" />KTV đã xác nhận</span>;
                      if (st === 'disputed') return (
                        <div className="text-left">
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black mb-1"><AlertCircle className="w-3 h-3" />KTV phản hồi</span>
                          {salaryRow?.disputeReason && <p className="text-[10px] text-rose-500 max-w-[160px] truncate" title={salaryRow.disputeReason}>{salaryRow.disputeReason}</p>}
                        </div>
                      );
                      if (st === 'published' || st === 'pending_approval') return (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          <Clock className="w-3 h-3" />Chờ KTV xác nhận
                        </span>
                      );
                      return <span className="text-slate-300 text-[10px]">—</span>;
                    })()}
                  </td>
                  {/* Action column */}
                  <td className="px-8 py-6 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      {(() => {
                        const salaryRow = ktvSalaries.find((s: any) => s.id === ktv.id);
                        const st = salaryRow?.status;
                        if (st === 'finalized' || st === 'approved') return <span className="text-slate-300 text-[10px]">Hoàn tất</span>;
                        if (st === 'confirmed') return (
                          <button onClick={() => handleFinalizeOne(ktv.id, ktv.name)}
                            className="flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            <Lock className="w-3 h-3" />Chốt sổ
                          </button>
                        );
                        if (st === 'published' || st === 'pending_approval') return (
                          <button onClick={() => handleConfirmOnBehalf(ktv.id, ktv.name)}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            <UserCheck className="w-3 h-3" />Xác nhận thay
                          </button>
                        );
                        if (st === 'disputed') return (
                          <button onClick={() => handlePublishOne(ktv.id, ktv.name)}
                            className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            <Send className="w-3 h-3" />Gửi lại
                          </button>
                        );
                        return (
                          <button onClick={() => handlePublishOne(ktv.id, ktv.name)}
                            className="flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            <Send className="w-3 h-3" />Gửi đối soát
                          </button>
                        );
                      })()}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
    )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && currentUser?.role?.toLowerCase() !== 'ktv' && (
        <div className="space-y-10">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                  <CalendarDays className="w-8 h-8 text-primary" />
                  Bảng tổng hợp công thực tế
                </h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Giám sát chuyên cần, đi muộn, nghỉ phép và số ca hoàn thành</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 backdrop-blur-md">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px]">Nhân viên</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Tổng công</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-emerald-600">Đúng giờ</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-amber-600">Đi muộn</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-rose-600">Nghỉ</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Nửa ngày</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Lương cơ bản</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {attendanceData.map((ktv: any, idx: number) => (
                    <motion.tr
                      key={ktv.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                            {ktv.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{ktv.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{ktv.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center whitespace-nowrap font-black text-slate-700">{ktv.totalDays}</td>
                      <td className="px-8 py-6 text-center whitespace-nowrap font-black text-emerald-600">+{ktv.present}</td>
                      <td className="px-8 py-6 text-center whitespace-nowrap font-black text-amber-600">+{ktv.late}</td>
                      <td className="px-8 py-6 text-center whitespace-nowrap font-black text-rose-500">-{ktv.absent}</td>
                      <td className="px-8 py-6 text-center whitespace-nowrap font-black text-blue-500">+{ktv.halfDay}</td>
                      <td className="px-8 py-6 text-center whitespace-nowrap font-black text-slate-900">
                        {ktv.baseSalary ? `${ktv.baseSalary.toLocaleString()}đ` : 'Chưa thiết lập'}
                      </td>
                      <td className="px-8 py-6 text-center whitespace-nowrap">
                        <button
                          onClick={() => openKtvCalendar(ktv)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Chi tiết & Sửa
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* HR Profile Tab */}
      {activeTab === 'hr_profile' && currentUser?.role?.toLowerCase() !== 'ktv' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <UserCog className="w-8 h-8 text-primary" />
                Quản lý hồ sơ nhân sự (HR)
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Cấu hình lương cứng cơ bản, ngày nhận việc, ngày thôi việc và trạng thái hoạt động</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 backdrop-blur-md">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px]">Kỹ thuật viên</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lương cơ bản (Cứng)</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày nhận việc</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày thôi việc</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Trạng thái</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ktvSalaries.map((s: any, idx: number) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap font-black text-slate-700">{s.baseSalary?.toLocaleString()}đ</td>
                    <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-slate-500">{s.hireDate ? new Date(s.hireDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-slate-500">{s.resignationDate ? new Date(s.resignationDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-8 py-6 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        s.status !== 'inactive' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {s.status !== 'inactive' ? 'Đang hoạt động' : 'Đã nghỉ việc'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center whitespace-nowrap">
                      <button
                        onClick={() => openHrEditModal(s)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                      >
                        Thiết lập HR
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar Override Modal */}
      {isCalendarModalOpen && selectedKtv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[600px]"
          >
            {/* Left Panel: Calendar Grid */}
            <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-slate-900">Chấm công: {selectedKtv.name}</h3>
                <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest">{currentMonthYear}</span>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {/* Headers */}
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(h => (
                  <div key={h} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">{h}</div>
                ))}
                
                {/* Generate Calendar Days */}
                {(() => {
                  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                  const firstDayIndex = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7; // Align Monday as 0
                  
                  const cells = [];
                  for (let i = 0; i < firstDayIndex; i++) {
                    cells.push(<div key={`empty-${i}`} className="aspect-square bg-slate-50/50 rounded-xl"></div>);
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const log = selectedKtv.logs?.find((a: any) => a.date === dateStr);
                    
                    let bgClass = "bg-slate-50 hover:bg-slate-100 text-slate-700";
                    let dotColor = "";
                    
                    if (log?.status === 'present') { bgClass = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"; dotColor = "bg-emerald-500"; }
                    else if (log?.status === 'late') { bgClass = "bg-amber-50 text-amber-700 hover:bg-amber-100"; dotColor = "bg-amber-500"; }
                    else if (log?.status === 'absent') { bgClass = "bg-rose-50 text-rose-700 hover:bg-rose-100"; dotColor = "bg-rose-500"; }
                    else if (log?.status === 'half_day') { bgClass = "bg-blue-50 text-blue-700 hover:bg-blue-100"; dotColor = "bg-blue-500"; }

                    const isToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) === dateStr;

                    cells.push(
                      <button
                        key={day}
                        onClick={() => handleDayClick(dateStr, log)}
                        className={cn(
                          "aspect-square rounded-2xl flex flex-col justify-between p-3 transition-all relative font-black",
                          bgClass,
                          isToday && "ring-2 ring-primary"
                        )}
                      >
                        <span className="text-xs">{day}</span>
                        {log?.status && (
                          <div className="flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)}></span>
                            <span className="text-[8px] uppercase tracking-tighter hidden md:inline">
                              {log.status === 'present' ? 'Đúng giờ' : log.status === 'late' ? 'Muộn' : log.status === 'half_day' ? 'Nửa ngày' : 'Nghỉ'}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>

            {/* Right Panel: Detail & Override Form */}
            <div className="w-full md:w-80 bg-slate-50 p-8 flex flex-col justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-wider text-xs text-slate-400">Chi tiết ngày chọn</h4>
                
                {selectedDayLog ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ngày</p>
                      <p className="text-sm font-bold text-slate-800">{new Date(selectedDayLog.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    {selectedDayLog.log && (
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Thời gian KTV đã kích hoạt</p>
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Thực tế vào:</span>
                            <span className="text-slate-800">{formatTimeVN(selectedDayLog.log.checkin_time)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Thực tế ra:</span>
                            <span className="text-slate-800">{formatTimeVN(selectedDayLog.log.checkout_time)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Trạng thái chấm công</label>
                      <select
                        value={overrideStatus}
                        onChange={e => setOverrideStatus(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                      >
                        <option value="present">Đúng giờ (Có mặt)</option>
                        <option value="late">Đi muộn</option>
                        <option value="absent">Vắng mặt (Nghỉ)</option>
                        <option value="half_day">Nửa ngày</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời gian vào ca</label>
                      <input
                        type="datetime-local"
                        value={overrideCheckin}
                        onChange={e => setOverrideCheckin(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời gian ra ca</label>
                      <input
                        type="datetime-local"
                        value={overrideCheckout}
                        onChange={e => setOverrideCheckout(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 font-medium italic">Chọn một ngày trong lịch để xem chi tiết hoặc thay đổi dữ liệu chấm công</p>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-100 transition-all"
                >
                  Đóng
                </button>
                {selectedDayLog && (
                  <button
                    onClick={handleSaveOverride}
                    className="flex-1 py-3 bg-primary text-white font-black rounded-xl text-xs uppercase tracking-wider hover:bg-primary-hover transition-all"
                  >
                    Lưu công
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* HR Profile Editor Modal */}
      {isHrModalOpen && hrKtvProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-8">
              <h3 className="text-2xl font-black text-slate-900 mb-6">Thiết lập nhân sự (HR)</h3>
              <p className="text-slate-500 font-bold text-sm mb-6">Hồ sơ kỹ thuật viên: <span className="text-primary font-black">{hrKtvProfile.name}</span></p>
              
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Lương cứng cơ bản (Cố định)</label>
                  <input
                    type="number"
                    value={hrBaseSalary}
                    onChange={e => setHrBaseSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Ngày nhận việc chính thức</label>
                  <input
                    type="date"
                    value={hrHireDate}
                    onChange={e => setHrHireDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Ngày thôi việc</label>
                  <input
                    type="date"
                    value={hrResignDate}
                    onChange={e => setHrResignDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Trạng thái nhân sự</label>
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
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveHrProfile}
                disabled={isHrSaving}
                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-pink-100 transition-all disabled:opacity-50 text-sm"
              >
                {isHrSaving ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Salary Modal */}
      {isEditModalOpen && editingSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-8">
              <h3 className="text-2xl font-black text-slate-900 mb-6">Chỉnh sửa Lương</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Lương cứng (đ)</label>
                  <input type="number" 
                    value={editingSalary.baseSalary} 
                    onChange={e => setEditingSalary({...editingSalary, baseSalary: Number(e.target.value)})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Thưởng KPI (đ)</label>
                  <input type="number" 
                    value={editingSalary.kpiBonus} 
                    onChange={e => setEditingSalary({...editingSalary, kpiBonus: Number(e.target.value)})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Phạt (đ)</label>
                  <input type="number" 
                    value={editingSalary.deductions} 
                    onChange={e => setEditingSalary({...editingSalary, deductions: Number(e.target.value)})}
                    className="w-full bg-rose-50 border-none rounded-xl px-4 py-3 font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Tạm ứng (đ)</label>
                  <input type="number" 
                    value={editingSalary.advances} 
                    onChange={e => setEditingSalary({...editingSalary, advances: Number(e.target.value)})}
                    className="w-full bg-rose-50 border-none rounded-xl px-4 py-3 font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-pink-100 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Centered Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100"
          >
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  confirmModal.isDanger ? "bg-rose-50 text-rose-600" : "bg-primary/10 text-primary"
                )}>
                  {confirmModal.isDanger ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : (
                    <ShieldCheck className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-none">{confirmModal.title}</h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mt-1.5">Yêu cầu xác nhận</span>
                </div>
              </div>
              <p className="text-slate-600 text-sm font-bold leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                disabled={confirmModal.isLoading}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
              >
                {confirmModal.cancelText}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.isLoading}
                className={cn(
                  "flex-1 py-4 text-white font-black rounded-2xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2",
                  confirmModal.isDanger 
                    ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100" 
                    : "bg-primary hover:bg-primary-hover shadow-lg shadow-pink-100"
                )}
              >
                {confirmModal.isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  confirmModal.confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
