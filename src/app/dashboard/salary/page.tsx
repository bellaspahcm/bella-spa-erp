'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  Send, 
  Lock, 
  CalendarDays,
  UserCog, 
  ShieldCheck, 
  Search, 
  Filter,
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
import { exportSalaryToExcel, exportSessionMatrixToExcel } from '@/services/export-actions';
import { toast } from 'sonner';
import { getCurrentUser } from '@/services/user-actions';
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

  async function refreshData() {
    try {
      const currentMonthStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7);
      const [salaryData, matrix, attData] = await Promise.all([
        getSalaryData(),
        getKtvSessionMatrix(),
        getMonthlyAttendanceSummary(currentMonthStr)
      ]);
      setKtvSalaries(salaryData || []);
      setMatrixData(matrix || null);
      setAttendanceData(attData || []);
    } catch (error) {
      console.error('Refresh data error:', error);
    }
  }

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
        const filteredSalaries = ktvSalaries.filter((s) => 
          s.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        for (const s of filteredSalaries) {
          if (s.status !== 'approved') {
            const result = await approveSalary(s.id);
            if (result.success) successCount++;
          }
        }
        if (successCount > 0) {
          toast.success(`Đã chốt lương thành công cho ${successCount} nhân viên`);
          const data = await getSalaryData();
          setKtvSalaries(data || []);
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
          setKtvSalaries(salary || []);
          setMatrixData(matrix || null);
        } else {
          toast.error('Lỗi khi gửi đối soát');
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
          toast.error('Lỗi khi chốt sổ');
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
    try {
      const toastId = toast.loading(`Đang tạo báo cáo cho ${s.name}...`);
      const base64 = await exportSalaryToExcel(s.id, s.name);
      
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
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
              Kỳ lương: {currentMonthYear}
            </span>
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
        <div className="overflow-x-auto custom-scrollbar w-full max-w-full mb-10">
          <div className="flex bg-white/60 p-2 rounded-2xl border border-slate-100 gap-2 w-fit backdrop-blur-md whitespace-nowrap">
            <button
              onClick={() => setActiveTab('payroll')}
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
              onClick={() => setActiveTab('attendance')}
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
              onClick={() => setActiveTab('hr_profile')}
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
            <div className="bg-white/80 dark:bg-zinc-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm mb-10">
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
          {isLoading ? (
            <div className="bg-white/80 dark:bg-zinc-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
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
        isLoading ? (
          <div className="bg-white/80 dark:bg-zinc-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
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
          <div className="bg-white/80 dark:bg-zinc-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
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
        onSaveSuccess={refreshData}
      />

      {/* HR Profile Editor Modal */}
      <HrProfileEditor
        isOpen={isHrModalOpen}
        onClose={() => setIsHrModalOpen(false)}
        hrKtvProfile={hrKtvProfile}
        onSaveSuccess={refreshData}
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
