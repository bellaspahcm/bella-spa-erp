'use client';

import { motion } from 'framer-motion';
import { DollarSign, Download, TrendingUp, Search, Filter, Edit2, CheckCircle2, ChevronRight, User, Calendar as CalendarIcon, Briefcase, Award, AlertCircle, ShieldCheck, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { useState, useEffect } from 'react';
import { getSalaryData, approveSalary, updateSalaryConfig, getKtvSessionMatrix, confirmKtvSessions } from '@/services/salary-actions';
import { exportSalaryToExcel, exportSessionMatrixToExcel } from '@/services/export-actions';
import { toast } from 'sonner';
import { getCurrentUser } from '@/services/user-actions';
import { FileSpreadsheet } from 'lucide-react';

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
        const [salaryData, matrix] = await Promise.all([
          getSalaryData(),
          getKtvSessionMatrix()
        ]);
        setKtvSalaries(salaryData);
        setMatrixData(matrix);
      } catch (error) {
        console.error('Fetch data error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleApprove = async (id: string) => {
    const result = await approveSalary(id);
    if (result.success) {
      toast.success('Đã phê duyệt lương thành công');
      // Update local state
      setKtvSalaries(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
    } else {
      toast.error('Lỗi khi phê duyệt lương');
    }
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

  const handleApproveAll = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn chốt lương cho tất cả nhân viên trong danh sách này không?')) return;
    
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
      toast.info('Không có bản ghi nào cần chốt lương hoặc đã xảy ra lỗi.');
    }
    setIsLoading(false);
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
      a.download = `Bao_cao_luong_${s.name.replace(/\s+/g, '_')}_05_2026.xlsx`;
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
      a.download = `Bang_doi_soat_buoi_lam_KTV_05_2026.xlsx`;
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
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">Kỳ lương: 05/2026</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Lương KTV</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý thu nhập và hiệu suất làm việc của kỹ thuật viên</p>
        </div>
        <div className="flex items-center gap-3">
          <PremiumExportButton />
          {currentUser?.role !== 'ktv' && (
            <button 
              onClick={handleApproveAll}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg shadow-pink-100 uppercase tracking-widest text-xs"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Chốt lương toàn bộ</span>
            </button>
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
              {currentUser?.role === 'ktv' ? 'Thu nhập của bạn' : 'Tổng quỹ lương tháng'}
            </p>
            <h3 className="text-4xl font-black mb-4">{totalPayout.toLocaleString()}đ</h3>
            <div className="flex items-center gap-2 text-white/90 font-black text-sm">
              <TrendingUp className="w-4 h-4" />
              Tăng 8% so với tháng 04/2026
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
          <p className="text-xs font-bold text-slate-500">Hiệu suất trung bình 1.2 buổi/ngày/KTV</p>
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
          <p className="text-xs font-bold text-slate-500">KTV Nguyễn Thị Hoa (Top 1)</p>
        </motion.div>
      </div>

      {/* Salary Table */}
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
                {currentUser?.role !== 'ktv' && (
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
                      s.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                      s.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {s.status === 'approved' ? 'Đã duyệt' : s.status === 'pending' ? 'Chờ duyệt' : 'Bản nháp'}
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    {currentUser?.role !== 'ktv' && s.status !== 'approved' && (
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
                          onClick={() => handleApprove(s.id)}
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
                    {currentUser?.role === 'ktv' && (
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
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px] sticky left-0 z-20 bg-slate-50">Kỹ thuật viên</th>
                {matrixData?.packageNames.map((pkg: string) => (
                  <th key={pkg} className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px] text-center">{pkg}</th>
                ))}
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[120px] text-center bg-slate-100/50">Tổng buổi</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px] text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matrixData?.ktvs.filter((ktv: any) => ktv.name.toLowerCase().includes(searchQuery.toLowerCase())).map((ktv: any, index: number) => (
                <motion.tr 
                  key={ktv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-slate-50/50 transition-colors group"
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
                  <td className="px-8 py-6 text-center whitespace-nowrap">
                    <button 
                      onClick={async () => {
                        const total = matrixData.packageNames.reduce((acc: number, pkg: string) => acc + (ktv[pkg] || 0), 0);
                        if (confirm(`Xác nhận đối soát ${total} buổi làm cho KTV ${ktv.name}?`)) {
                          const res = await confirmKtvSessions(ktv.id);
                          if (res.success) {
                            toast.success(`Đã duyệt dữ liệu cho ${ktv.name}`);
                            // Refresh both datasets to sync UI
                            const [matrix, salary] = await Promise.all([
                              getKtvSessionMatrix(),
                              getSalaryData()
                            ]);
                            setMatrixData(matrix);
                            setKtvSalaries(salary);
                          } else {
                            toast.error('Lỗi khi duyệt dữ liệu: ' + res.error);
                          }
                        }
                      }}
                      disabled={ktv.isConfirmed}
                      className={cn(
                        "group/btn flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest mx-auto shadow-sm active:scale-95",
                        ktv.isConfirmed 
                          ? "bg-emerald-50 text-emerald-600 cursor-default shadow-none border border-emerald-100" 
                          : "bg-rose-50 text-primary hover:bg-primary hover:text-white border border-rose-100"
                      )}
                    >
                      {ktv.isConfirmed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Đã Duyệt
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                          Duyệt Số Buổi
                        </>
                      )}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
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
    </div>
  );
}
