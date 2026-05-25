'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Clock,
  Settings
} from 'lucide-react';
import { getAccountingPeriods, closePeriodAction } from '@/services/accounting-actions';
import { toast } from 'sonner';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';

export default function PeriodsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periods, setPeriods] = useState<any[]>([]);

  const fetchPeriods = async () => {
    setRefreshing(true);
    try {
      const data = await getAccountingPeriods();
      setPeriods(data || []);
    } catch (err: any) {
      console.error('Error fetching periods:', err);
      toast.error('Không thể tải danh sách kỳ kế toán.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleClosePeriod = async (periodId: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ĐÓNG kỳ kế toán "${name}" không?\nSau khi đóng, bạn không thể ghi thêm bất kỳ bút toán nào vào kỳ này nữa.`)) {
      return;
    }

    setRefreshing(true);
    try {
      const res = await closePeriodAction(periodId);
      if (res.success) {
        toast.success(`Đóng kỳ kế toán "${name}" thành công!`);
        fetchPeriods();
      }
    } catch (err: any) {
      console.error('Failed to close period:', err);
      toast.error(err.message || 'Lỗi khi đóng kỳ kế toán. Hãy kiểm tra lại xem còn bút toán nháp (DRAFT) nào không.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Synchronization spinner loader */}
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-[#A67D44] animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang cập nhật...</span>
        </div>
      )}

      {/* ── INFO HEADER CARD ── */}
      <div className="p-6 md:p-8 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-[#5D1C34]/30 flex items-center justify-center text-primary dark:text-[#A67D44] shrink-0">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">Nguyên tắc Đóng/Mở kỳ kế toán</h4>
          <p className="text-xs font-medium text-slate-500 dark:text-[#CDBCAB]/70 mt-1 leading-relaxed">
            Mỗi kỳ kế toán được chia theo tháng dương lịch. Việc đóng kỳ nhằm đảm bảo dữ liệu quá khứ không bị thay đổi bất hợp lệ. 
            Để đóng kỳ, tất cả bút toán trong tháng đó phải được ghi sổ (<span className="text-emerald-500 font-bold font-mono">POSTED</span>) hoặc hủy (<span className="text-red-500 font-bold font-mono">CANCELED</span>).
          </p>
        </div>
      </div>

      {/* ── PERIODS LIST TABLE ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-5.5 h-5.5 text-primary" />
            Danh sách Kỳ kế toán
          </h4>
          <span className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60">
            Tổng cộng: <span className="text-slate-900 dark:text-[#EFE9E1] font-black">{periods.length}</span> kỳ
          </span>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : periods.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-extrabold uppercase text-xs tracking-wider">Không tìm thấy kỳ kế toán nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left bg-slate-50/50 dark:bg-[#11100F]/40 border-b border-slate-100 dark:border-[#3E3A35]/30">
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Kỳ kế toán (Tháng)</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Ngày bắt đầu</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Ngày kết thúc</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Hành động khóa sổ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#3E3A35]/20">
                {periods.map((p) => {
                  const isClosed = p.status === 'CLOSED';

                  return (
                    <motion.tr 
                      key={p.id} 
                      whileHover={{ backgroundColor: 'rgba(244,63,94,0.01)' }}
                      className="hover:bg-slate-50/20 dark:hover:bg-[#11100F]/10 transition-colors"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isClosed ? 'bg-slate-100 text-slate-400' : 'bg-pink-50 text-primary dark:bg-[#5D1C34]/40 dark:text-[#A67D44]'
                          }`}>
                            <Calendar className="w-4 h-4" />
                          </div>
                          <span className="font-mono font-black text-slate-800 dark:text-[#EFE9E1] text-sm">
                            Tháng {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/80 font-mono">
                        {p.start_date}
                      </td>
                      <td className="px-6 py-5 text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/80 font-mono">
                        {p.end_date}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-4xs font-black uppercase tracking-wider border ${
                          isClosed 
                            ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/20 dark:text-slate-500 border-slate-200/50' 
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100/50'
                        }`}>
                          {isClosed ? (
                            <>
                              <Lock className="w-3 h-3" />
                              Đã khóa sổ (CLOSED)
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-500" />
                              Đang mở (OPEN)
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {isClosed ? (
                          <div className="flex items-center justify-center gap-1.5 text-4xs font-black uppercase text-slate-400 dark:text-[#CDBCAB]/40 tracking-wider">
                            <Clock className="w-3.5 h-3.5" />
                            Đã chốt số liệu
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleClosePeriod(p.id, p.name)}
                            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 dark:bg-[#5D1C34] dark:hover:bg-[#5D1C34]/80 text-white dark:text-[#EFE9E1] px-4 py-2 rounded-xl text-3xs font-black uppercase tracking-widest transition-all cursor-pointer border-none active:scale-95"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Khóa sổ kỳ này
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
