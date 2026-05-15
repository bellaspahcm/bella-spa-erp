'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart, BarChart3, Calendar, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { lockMonth } from '@/services/finance-actions';
import { toast } from 'sonner';
import { useState } from 'react';

interface PnLData {
  month_year: string;
  total_revenue: number;
  total_operating_expenses: number;
  total_ktv_salaries: number;
  net_profit: number;
  total_bookings: number;
  total_sessions_completed: number;
  is_locked: boolean;
}

interface ServicePerformance {
  package_name: string;
  total_bookings: number;
  total_revenue: number;
  total_ktv_cost: number;
  net_service_profit: number;
  profit_margin_percent: number;
}

interface FinancePnLSummaryProps {
  pnl: PnLData | null;
  performance: ServicePerformance[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
}

export function FinancePnLSummary({ pnl, performance, selectedMonth, onMonthChange, onRefresh }: FinancePnLSummaryProps) {
  const [isLocking, setIsLocking] = useState(false);

  const handleLock = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn CHỐT SỔ tháng ${selectedMonth.substring(0, 7)} không?\nSau khi chốt, toàn bộ giao dịch và lương sẽ được khóa để ngăn chặn thay đổi.`)) {
      return;
    }

    setIsLocking(true);
    try {
      const result = await lockMonth(selectedMonth);
      if (result.success) {
        toast.success('Tháng đã được chốt sổ thành công!');
        onRefresh();
      }
    } catch (error) {
      console.error('Lock error:', error);
      toast.error('Lỗi khi chốt sổ tháng.');
    } finally {
      setIsLocking(false);
    }
  };

  if (!pnl) return (
    <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] border border-dashed border-slate-200">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <Activity className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-500 font-bold">Chưa có dữ liệu tài chính cho tháng này</p>
      <input 
        type="month" 
        value={selectedMonth.substring(0, 7)}
        onChange={(e) => onMonthChange(`${e.target.value}-01`)}
        className="mt-4 px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );

  return (
    <div className="space-y-8 mb-10">
      {/* Month Selection Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Chi tiết báo cáo tháng</h3>
           {pnl.is_locked ? (
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-in fade-in zoom-in">
                 <ShieldCheck className="w-3.5 h-3.5" />
                 Số liệu đã chốt
              </span>
           ) : (
              <button 
                onClick={handleLock}
                disabled={isLocking}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isLocking ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Chốt sổ tháng
              </button>
           )}
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <input 
            type="month" 
            value={selectedMonth.substring(0, 7)}
            onChange={(e) => onMonthChange(`${e.target.value}-01`)}
            className="px-3 py-1.5 text-sm font-bold text-slate-700 outline-none border-none bg-transparent"
          />
        </div>
      </div>

      {/* P&L Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu ròng</span>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{Number(pnl.total_revenue).toLocaleString()}đ</h4>
          <p className="text-[10px] font-bold text-slate-500 mt-2">Dựa trên các giao dịch đã xác nhận</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi phí vận hành</span>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{Number(pnl.total_operating_expenses).toLocaleString()}đ</h4>
          <p className="text-[10px] font-bold text-slate-500 mt-2">Marketing, mặt bằng, điện nước...</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quỹ lương KTV</span>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{Number(pnl.total_ktv_salaries).toLocaleString()}đ</h4>
          <p className="text-[10px] font-bold text-slate-500 mt-2">Lương cứng + Hoa hồng + Thưởng</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-primary p-6 rounded-[32px] shadow-lg shadow-pink-100 relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">Lợi nhuận ròng</span>
            </div>
            <h4 className="text-2xl font-black text-white">{Number(pnl.net_profit).toLocaleString()}đ</h4>
            <div className="flex items-center gap-1 mt-2">
               <span className="text-[10px] font-bold text-white/80">Tỷ suất:</span>
               <span className="text-[10px] font-black text-white bg-white/20 px-2 py-0.5 rounded-full">
                  {pnl.total_revenue > 0 ? ((pnl.net_profit / pnl.total_revenue) * 100).toFixed(1) : 0}%
               </span>
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </motion.div>
      </div>

      {/* Service Performance Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-primary" />
            Hiệu quả kinh doanh theo Gói dịch vụ
          </h2>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100">
            Phân tích ROI & Margin
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gói dịch vụ</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Số lượng</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi phí KTV</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lợi nhuận gộp</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Biên lợi nhuận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {performance.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 font-bold text-slate-900">{item.package_name}</td>
                  <td className="px-8 py-4 font-black text-slate-700 text-center">{item.total_bookings}</td>
                  <td className="px-8 py-4 font-black text-emerald-600">{Number(item.total_revenue).toLocaleString()}đ</td>
                  <td className="px-8 py-4 font-black text-rose-500">{Number(item.total_ktv_cost).toLocaleString()}đ</td>
                  <td className="px-8 py-4 font-black text-slate-900">{Number(item.net_service_profit).toLocaleString()}đ</td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${Math.min(100, Math.max(0, item.profit_margin_percent))}%` }}
                          ></div>
                       </div>
                       <span className="text-xs font-black text-slate-900 min-w-[40px] text-right">
                          {Number(item.profit_margin_percent).toFixed(1)}%
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
