'use client';

import { CurrentUser,KtvSalaryRecord } from '@/types/domain';
import { motion } from 'framer-motion';
import {
AlertCircle,
CheckCircle2,
Download,
Filter,
Search,
ShieldCheck,
Star
} from 'lucide-react';

interface SalaryTableProps {
  filteredSalaries: KtvSalaryRecord[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentUser: CurrentUser | null;
  openEditModal: (s: KtvSalaryRecord) => void;
  handleApprove: (id: string, name: string) => void;
  handleExport: (s: KtvSalaryRecord) => void;
}

export default function SalaryTable({
  filteredSalaries,
  searchQuery,
  setSearchQuery,
  currentUser,
  openEditModal,
  handleApprove,
  handleExport,
}: SalaryTableProps) {
  const isNotKtv = currentUser?.role?.toLowerCase() !== 'ktv';

  return (
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
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Ngày công</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Đánh giá</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Lương cứng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Hoa hồng ca</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Thưởng chất lượng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Thưởng KPI</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Phạt</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Tạm ứng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[160px]">Tổng nhận</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Trạng thái</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[120px]">Thao tác</th>
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600">{s.actualDays ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-medium">/26</span>
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap">
                  {s.avgRating !== null && s.avgRating !== undefined ? (
                    <div className="flex items-center gap-1.5 text-amber-500 font-black">
                      <Star className="w-4 h-4 fill-current" />
                      {s.avgRating.toFixed(1)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-300 font-black" title="Chưa có dữ liệu trong tháng">
                      <Star className="w-4 h-4" />
                      <span>—</span>
                    </div>
                  )}
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
                  {isNotKtv && s.status !== 'approved' && (
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
                  {!isNotKtv && (
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
  );
}
