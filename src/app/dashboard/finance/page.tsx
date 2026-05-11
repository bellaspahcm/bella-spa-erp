'use client';

import { motion } from 'framer-motion';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  Wallet, 
  CreditCard,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  Search
} from 'lucide-react';

const transactions = [
  { id: '1', type: 'revenue', category: 'Dịch vụ', amount: '+2,400,000', date: '11/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
  { id: '2', type: 'expense', category: 'Vật tư', amount: '-850,000', date: '11/05/2026', method: 'Tiền mặt', status: 'pending' },
  { id: '3', type: 'revenue', category: 'Cọc gói', amount: '+5,000,000', date: '10/05/2026', method: 'ZaloPay', status: 'confirmed' },
  { id: '4', type: 'expense', category: 'Lương KTV', amount: '-12,000,000', date: '05/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
];

export default function FinancePage() {
  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tài chính</h1>
          <p className="text-slate-500 font-medium mt-1">Theo dõi dòng tiền và hiệu quả kinh doanh</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm">
            <Download className="w-5 h-5 text-slate-400" />
            <span>Xuất báo cáo</span>
          </button>
          <button className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-100">
            <PlusCircleIcon className="w-5 h-5" />
            <span>Ghi nhận thu chi</span>
          </button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl shadow-slate-200 relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-bold text-white/60 uppercase tracking-widest mb-2">Số dư hiện tại</p>
            <h3 className="text-4xl font-black mb-4">428,500,000đ</h3>
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
              <TrendingUp className="w-4 h-4" />
              +12.5% so với tháng trước
            </div>
          </div>
          <div className="absolute bottom-[-20%] right-[-10%] w-48 h-48 bg-rose-500/20 rounded-full blur-3xl"></div>
        </motion.div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng thu tháng</p>
              <h4 className="text-2xl font-black text-slate-900">156.2M</h4>
            </div>
          </div>
          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-[70%] rounded-full"></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Đạt 70% mục tiêu tháng</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
              <ArrowDownRight className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng chi tháng</p>
              <h4 className="text-2xl font-black text-slate-900">42.8M</h4>
            </div>
          </div>
          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full w-[35%] rounded-full"></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Giảm 5% so với tháng trước</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-rose-500" />
            Giao dịch gần đây
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Tìm giao dịch..." className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/10 w-48" />
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phương thức</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Số tiền</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.type === 'revenue' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {tx.type === 'revenue' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <span className="font-bold text-slate-900">{tx.category}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-500">{tx.date}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-500">{tx.method}</td>
                  <td className="px-8 py-5 font-black text-slate-900">{tx.amount}</td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      tx.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {tx.status === 'confirmed' ? 'Đã xác nhận' : 'Đang chờ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 text-center border-t border-slate-50">
          <button className="text-sm font-bold text-slate-500 hover:text-rose-500 transition-colors">
            Xem thêm lịch sử giao dịch
          </button>
        </div>
      </div>
    </div>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
