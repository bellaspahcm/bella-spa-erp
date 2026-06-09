'use client';

import { useCallback, useState, useEffect } from 'react';
import { 
  DollarSign, 
  Send, 
  Lock, 
  CalendarDays,
  UserCog, 
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { getSalaryData, getKtvSessionMatrix } from '@/modules/hr-salary/actions/query-salary-actions';
import { 
  approveSalary, 
  updateSalaryConfig, 
  publishSalaryRecord, 
  publishAllSalaryRecords, 
  adminConfirmOnBehalf, 
  finalizeSalaryRecord, 
  finalizeAllSalaryRecords, 
  checkAndAutoConfirm 
} from '@/modules/hr-salary/actions/admin-salary-actions';
import { getMonthlyAttendanceSummary } from '@/services/attendance-actions';
import { exportSalaryToExcelResult, exportSessionMatrixToExcelResult } from '@/services/export-actions';
import { toast } from 'sonner';
import { getCurrentUser } from '@/services/user-actions';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { calculateSalaryTotal } from '@/lib/business-rules/salary';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';

// Types
import { 
  KtvSalaryRecord, 
  KtvAttendanceSummary, 
  KtvSessionMatrix, 
  CurrentUser 
} from '@/types/domain';

// Subcomponents
import SalaryStats from './components/SalaryStats';
import SalaryTable from './components/SalaryTable';
import EditSalaryModal from './components/EditSalaryModal';
import AttendanceCalendar from './components/AttendanceCalendar';
import HrProfileEditor from './components/HrProfileEditor';
import SessionMatrixTable from './components/SessionMatrixTable';
import AttendanceSummaryTable from './components/AttendanceSummaryTable';
import HrProfileTable from './components/HrProfileTable';
import ConfirmModal from './components/ConfirmModal';

function getCurrentMonthString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Lỗi không xác định';
}

export default function SalaryPage() {
  const [ktvSalaries, setKtvSalaries] = useState<KtvSalaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<KtvSalaryRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [matrixData, setMatrixData] = useState<KtvSessionMatrix | null>(null);
  const [isExportingMatrix, setIsExportingMatrix] = useState(false);
  const [attendanceData, setAttendanceData] = useState<KtvAttendanceSummary[]>([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [hasLoadedAttendance, setHasLoadedAttendance] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'payroll' | 'attendance' | 'hr_profile'>('payroll');

  // Attendance Override Calendar States
  const [selectedKtv, setSelectedKtv] = useState<KtvAttendanceSummary | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // HR Profile Editor States
  const [isHrModalOpen, setIsHrModalOpen] = useState(false);
  const [hrKtvProfile, setHrKtvProfile] = useState<KtvSalaryRecord | null>(null);

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
          toast.error(getErrorMessage(error));
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

  const now = new Date();
  const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const prevMonthYear = now.getMonth() === 0 ? `12/${now.getFullYear() - 1}` : `${String(now.getMonth()).padStart(2, '0')}/${now.getFullYear()}`;

  useEffect(() => {
    async function fetchUser() {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || '',
          full_name: user.full_name,
          role: user.role || 'ktv',
          avatar_url: user.avatar_url,
          tenant_id: user.tenant_id || null
        });
      }
    }
    fetchUser();
  }, []);

  const loadAttendanceData = useCallback(async () => {
    setIsAttendanceLoading(true);
    try {
      const attData = await getMonthlyAttendanceSummary(getCurrentMonthString());
      setAttendanceData(attData || []);
      setHasLoadedAttendance(true);
    } catch (error) {
      console.error('Attendance data error:', error);
    } finally {
      setIsAttendanceLoading(false);
    }
  }, []);

  const refreshData = useCallback(async (options: { includeAttendance?: boolean } = {}) => {
    try {
      const [salaryData, matrix] = await Promise.all([
        getSalaryData(),
        getKtvSessionMatrix(),
      ]);
      setKtvSalaries(salaryData || []);
      setMatrixData(matrix || null);

      if (options.includeAttendance) {
        await loadAttendanceData();
      }
    } catch (error) {
      console.error('Refresh data error:', error);
    }
  }, [loadAttendanceData]);

  const handleTabChange = useCallback((tab: 'payroll' | 'attendance' | 'hr_profile') => {
    setActiveTab(tab);
    if (tab === 'attendance' && !hasLoadedAttendance && !isAttendanceLoading) {
      void loadAttendanceData();
    }
  }, [hasLoadedAttendance, isAttendanceLoading, loadAttendanceData]);

  const handleSoftRefresh = useCallback(async () => {
    await refreshData({
      includeAttendance: hasLoadedAttendance || activeTab === 'attendance',
    });
  }, [activeTab, hasLoadedAttendance, refreshData]);

  usePageRefresh(handleSoftRefresh);

  useEffect(() => {
    async function fetchData() {
      try {
        // Auto-confirm stale records on page load
        const autoRes = await checkAndAutoConfirm();
        if (autoRes.count > 0) {
          toast.info(`Đã tự động xác nhận ${autoRes.count} bảng lương quá hạn 48h`);
        }
        await refreshData();
      } catch (error) {
        console.error('Fetch data error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [refreshData]);

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
          toast.error(result.error || 'Lỗi khi phê duyệt lương');
        }
      }
    });
  };

  const openEditModal = (s: KtvSalaryRecord) => {
    setEditingSalary({ ...s });
    setIsEditModalOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!editingSalary) return;
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
            status: 'pending',
            totalSalary: calculateSalaryTotal({
              baseSalary: editingSalary.baseSalary,
              sessionBonus: s.sessionBonus,
              ratingBonus: s.ratingBonus,
              kpiBonus: editingSalary.kpiBonus,
              deductions: editingSalary.deductions,
              advances: editingSalary.advances,
            }),
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
          setKtvSalaries(salary || []);
          setMatrixData(matrix || null);
        } else {
          toast.error(res.error || 'Lỗi khi gửi đối soát');
          if (res.count > 0) {
            const [salary, matrix] = await Promise.all([getSalaryData(), getKtvSessionMatrix()]);
            setKtvSalaries(salary || []);
            setMatrixData(matrix || null);
          }
        }
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
          const data = await getSalaryData();
          setKtvSalaries(data || []);
        } else {
          toast.error(res.error || 'Lỗi khi chốt sổ');
          if (res.count > 0) {
            const data = await getSalaryData();
            setKtvSalaries(data || []);
          }
        }
        setIsLoading(false);
      }
    });
  };

  const handlePublishOne = async (ktvId: string, ktvName: string) => {
    const res = await publishSalaryRecord(ktvId);
    if (res.success) {
      toast.success(`Đã gửi đối soát cho ${ktvName}`);
      const [salary, matrix] = await Promise.all([getSalaryData(), getKtvSessionMatrix()]);
      setKtvSalaries(salary || []);
      setMatrixData(matrix || null);
    } else {
      toast.error('Lỗi: ' + res.error);
    }
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
          setKtvSalaries(salary || []);
          setMatrixData(matrix || null);
        } else {
          toast.error('Lỗi: ' + res.error);
        }
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
          const data = await getSalaryData();
          setKtvSalaries(data || []);
        } else {
          toast.error(res.error || 'Lỗi khi chốt sổ');
        }
      }
    });
  };

  const handleExport = async (s: KtvSalaryRecord) => {
    const toastId = toast.loading(`Đang tạo báo cáo cho ${s.name}...`);
    try {
      const result = await exportSalaryToExcelResult(s.id, s.name, `${getCurrentMonthString()}-01`, {
        ktvId: s.id,
        baseSalary: s.baseSalary,
        sessionBonus: s.sessionBonus,
        ratingBonus: s.ratingBonus,
        kpiBonus: s.kpiBonus,
        deductions: s.deductions,
        advances: s.advances,
        totalSalary: s.totalSalary,
        sessions: s.sessions,
        status: s.status,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const base64 = result.data;
      
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
      toast.error('Lỗi khi xuất báo cáo Excel: ' + getErrorMessage(error), { id: toastId });
    }
  };

  const handleExportMatrix = async () => {
    if (!matrixData) return;
    setIsExportingMatrix(true);
    const toastId = toast.loading('Đang chuẩn bị bảng đối soát số buổi...');
    try {
      const result = await exportSessionMatrixToExcelResult(matrixData.ktvs, matrixData.packageNames);
      if (!result.success) {
        throw new Error(result.error);
      }

      const base64 = result.data;
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
      toast.error('Lỗi khi xuất bảng đối soát: ' + getErrorMessage(error), { id: toastId });
    } finally {
      setIsExportingMatrix(false);
    }
  };

  // Calendar Override Handlers
  const openKtvCalendar = (ktv: KtvAttendanceSummary) => {
    setSelectedKtv(ktv);
    setIsCalendarModalOpen(true);
  };

  // HR Profile Editor Handlers
  const openHrEditModal = (ktv: KtvSalaryRecord) => {
    setHrKtvProfile(ktv);
    setIsHrModalOpen(true);
  };

  const filteredSalaries = ktvSalaries.filter((s) => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPayout = ktvSalaries.reduce((acc, curr) => acc + curr.totalSalary, 0);
  const totalSessions = ktvSalaries.reduce((acc, curr) => acc + curr.sessions, 0);

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
              Kỳ lương: {currentMonthYear}
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter sm:text-4xl">Lương KTV</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý thu nhập và hiệu suất làm việc của kỹ thuật viên</p>
        </div>
        <div className="bella-toolbar flex flex-col gap-3 sm:flex-row sm:items-center">
          <PremiumExportButton />
          {currentUser?.role?.toLowerCase() !== 'ktv' && (
            <>
              <button
                onClick={handlePublishAll}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-amber-100 transition-all hover:bg-amber-600 sm:px-6 sm:py-4"
              >
                <Send className="w-4 h-4" />
                <span>Gửi đối soát</span>
              </button>
              <button
                onClick={handleFinalizeAll}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-pink-100 transition-all hover:bg-primary-hover dark:shadow-none sm:px-6 sm:py-4"
              >
                <Lock className="w-4 h-4" />
                <span>Chốt sổ</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SalaryStats
        totalPayout={totalPayout}
        totalSessions={totalSessions}
        ktvSalaries={ktvSalaries}
        currentUser={currentUser}
        prevMonthYear={prevMonthYear}
        isLoading={isLoading}
      />

      {/* Premium Tab Selector */}
      {currentUser?.role?.toLowerCase() !== 'ktv' && (
        <div className="mb-6 w-full max-w-full overflow-x-auto overscroll-x-contain custom-scrollbar md:mb-10">
          <div className="flex bg-white/60 p-2 rounded-2xl border border-slate-100 gap-2 w-fit backdrop-blur-md whitespace-nowrap">
            <button
              onClick={() => handleTabChange('payroll')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === 'payroll'
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
              )}
            >
              <DollarSign className="w-4 h-4" />
              Bảng Lương realtime
            </button>
            <button
              onClick={() => handleTabChange('attendance')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === 'attendance'
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
              )}
            >
              <CalendarDays className="w-4 h-4" />
              Chấm Công Thực Tế
            </button>
            <button
              onClick={() => handleTabChange('hr_profile')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === 'hr_profile'
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
              )}
            >
              <UserCog className="w-4 h-4" />
              Hồ Sơ Nhân Sự (HR)
            </button>
          </div>
        </div>
      )}

      {/* Salary Table (Realtime Payroll) */}
      {(activeTab === 'payroll' || currentUser?.role?.toLowerCase() === 'ktv') && (
        <>
          {isLoading ? (
            <div className="mb-6 rounded-[2rem] border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800/60 dark:bg-zinc-900/60 sm:p-6 md:mb-10 md:rounded-[2.5rem] md:p-8">
              <SkeletonTable />
            </div>
          ) : (
            <SalaryTable
              filteredSalaries={filteredSalaries}
              currentUser={currentUser}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              openEditModal={openEditModal}
              handleApprove={handleApprove}
              handleExport={handleExport}
            />
          )}

          {/* Info Banner */}
          <div className="mb-6 flex items-start gap-3 rounded-[24px] border border-amber-100 bg-amber-50 p-4 md:mb-10 md:gap-4 md:rounded-[32px] md:p-6">
            <div className="shrink-0 rounded-2xl bg-amber-100 p-3">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-amber-900 uppercase tracking-widest text-xs mb-1">Quy định tính lương</h4>
              <p className="text-amber-800/80 text-sm font-medium">
                Lương KTV được tính dựa trên số buổi thực tế hoàn thành (Hoa hồng theo từng loại dịch vụ) + Lương cứng + Thưởng hiệu suất KPI. 
                Giá tiền công được khóa tại thời điểm tạo hợp đồng để đảm bảo quyền lợi KTV. Hạn chốt lương cuối cùng là ngày 05 hàng tháng.
              </p>
            </div>
          </div>

          {/* Session Matrix Table */}
          {isLoading ? (
            <div className="rounded-[2rem] border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800/60 dark:bg-zinc-900/60 sm:p-6 md:rounded-[2.5rem] md:p-8">
              <div className="h-6 w-48 mb-6"><SkeletonLoader variant="text" width={200} height={20} /></div>
              <SkeletonTable />
            </div>
          ) : (
            <SessionMatrixTable
              matrixData={matrixData}
              searchQuery={searchQuery}
              ktvSalaries={ktvSalaries}
              isExportingMatrix={isExportingMatrix}
              handleExportMatrix={handleExportMatrix}
              handleFinalizeOne={handleFinalizeOne}
              handleConfirmOnBehalf={handleConfirmOnBehalf}
              handlePublishOne={handlePublishOne}
            />
          )}
        </>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && currentUser?.role?.toLowerCase() !== 'ktv' && (
        isLoading || isAttendanceLoading || !hasLoadedAttendance ? (
          <div className="rounded-[2rem] border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800/60 dark:bg-zinc-900/60 sm:p-6 md:rounded-[2.5rem] md:p-8">
            <SkeletonTable />
          </div>
        ) : (
          <AttendanceSummaryTable
            attendanceData={attendanceData}
            openKtvCalendar={openKtvCalendar}
          />
        )
      )}

      {/* HR Profile Tab */}
      {activeTab === 'hr_profile' && currentUser?.role?.toLowerCase() !== 'ktv' && (
        isLoading ? (
          <div className="rounded-[2rem] border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800/60 dark:bg-zinc-900/60 sm:p-6 md:rounded-[2.5rem] md:p-8">
            <SkeletonTable />
          </div>
        ) : (
          <HrProfileTable
            ktvSalaries={ktvSalaries}
            openHrEditModal={openHrEditModal}
          />
        )
      )}

      {/* Attendance Override Calendar Modal */}
      <AttendanceCalendar
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        selectedKtv={selectedKtv}
        onSaveSuccess={() => refreshData({ includeAttendance: true })}
      />

      {/* HR Profile Editor Modal */}
      <HrProfileEditor
        isOpen={isHrModalOpen}
        onClose={() => setIsHrModalOpen(false)}
        hrKtvProfile={hrKtvProfile}
        onSaveSuccess={() => refreshData({ includeAttendance: hasLoadedAttendance })}
      />

      {/* Edit Salary Modal */}
      <EditSalaryModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editingSalary={editingSalary}
        setEditingSalary={setEditingSalary}
        handleSaveConfig={handleSaveConfig}
        isSaving={isSaving}
      />

      {/* Centered Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        isDanger={confirmModal.isDanger}
        isLoading={confirmModal.isLoading}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
