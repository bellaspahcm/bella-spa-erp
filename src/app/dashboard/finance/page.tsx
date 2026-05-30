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
  Search,
  PlusCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Check
} from 'lucide-react';
import { getFinancialOverview, confirmTransaction, getMonthlyPnL, getServicePerformance } from '@/services/finance-actions';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { TransactionModal } from '@/components/features/TransactionModal';
import { FinancePnLSummary } from '@/components/features/FinancePnLSummary';
import { createClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';
import PremiumExportButton from '@/components/ui/PremiumExportButton';

export default function FinancePage() {
  const [data, setData] = useState<any>({
    totalBalance: 0,
    totalRevenueMonth: 0,
    totalExpenseMonth: 0,
    transactions: []
  });
  const [pnlData, setPnlData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'transactions' | 'analysis'>('transactions');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense'>('all');

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const [isConfirmingId, setIsConfirmingId] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchData = async (month?: string) => {
    setIsRefreshing(true);
    try {
      const m = month || selectedMonth;
      const [overviewResult, pnlResult, perfResult] = await Promise.allSettled([
        getFinancialOverview(),
        getMonthlyPnL(m),
        getServicePerformance()
      ]);

      if (overviewResult.status === 'fulfilled' && overviewResult.value) {
        setData(overviewResult.value);
      } else if (overviewResult.status === 'rejected') {
        console.error('Overview failed:', overviewResult.reason);
        toast.error('Không thể tải dữ liệu tài chính. Vui lòng thử lại.');
      }

      if (pnlResult.status === 'fulfilled') {
        setPnlData(pnlResult.value);
      } else {
        console.error('P&L failed:', pnlResult.reason);
        toast.error('Không thể tải báo cáo P&L. Vui lòng thử lại.');
      }

      if (perfResult.status === 'fulfilled') {
        setPerformanceData(perfResult.value || []);
      } else {
        console.error('Service performance failed:', perfResult.reason);
        toast.error('Không thể tải phân tích hiệu quả dịch vụ.');
      }
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error('Không thể tải dữ liệu tài chính. Vui lòng thử lại.');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };


  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    fetchData(newMonth);
  };

  const handleConfirm = async (tx: any) => {
    if (!tx.dbId) {
      toast.info('Đây là giao dịch mẫu (Demo), không thể xác nhận vào Database thật.');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xác nhận giao dịch "${tx.category}" trị giá ${tx.amount} không?\nSau khi xác nhận, số tiền này sẽ được tính vào tổng doanh thu/chi phí.`)) {
      return;
    }

    setIsConfirmingId(tx.id);
    try {
      const result = await confirmTransaction(tx.dbId, tx.type);
      if (result.success) {
        toast.success('Giao dịch đã được xác nhận thành công');
        fetchData();
      }
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error('Lỗi khi xác nhận giao dịch. Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.');
    } finally {
      setIsConfirmingId(null);
    }
  };

  const sortData = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedTransactions = [...data.transactions].sort((a: any, b: any) => {
      let valA = a[key];
      let valB = b[key];
      
      if (key === 'amount') {
        valA = a.amountNum || 0;
        valB = b.amountNum || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setData({ ...data, transactions: sortedTransactions });
  };

  useEffect(() => {
    fetchData();

    // REALTIME SUBSCRIPTION
    const supabase = createClient();
    const channel = supabase
      .channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);



  const { totalBalance, totalRevenueMonth, totalExpenseMonth, transactions } = data;
  
  // Filtering & Search
  const filteredTransactions = transactions.filter((tx: any) => {
    const matchesSearch = searchTerm === '' || 
      tx.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.amount?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesFilter;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const currentTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  return (
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto relative">
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-primary/20 z-[100]">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-full bg-primary"
          />
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tài chính</h1>
          <p className="text-slate-500 font-medium mt-1">Theo dõi dòng tiền và hiệu quả kinh doanh</p>
        </div>
        <div className="flex items-center gap-3">
          <PremiumExportButton />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-pink-100 dark:shadow-none uppercase tracking-widest text-xs active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Ghi nhận thu chi</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit mb-8">
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'transactions' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Sổ nhật ký thu chi
        </button>
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'analysis' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Phân tích P&L & ROI
        </button>
      </div>

      {activeTab === 'analysis' ? (
        <FinancePnLSummary 
          pnl={pnlData} 
          performance={performanceData} 
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          onRefresh={() => fetchData(selectedMonth)}
        />
      ) : (
        <div className="space-y-10">
          {/* Financial Overview */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <SkeletonLoader variant="card" className="w-full h-48 bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-pink-500/10 border-pink-200/20 animate-pulse" />
          <SkeletonLoader variant="card" className="w-full h-48 bg-white/40 dark:bg-zinc-800/40 animate-pulse" />
          <SkeletonLoader variant="card" className="w-full h-48 bg-white/40 dark:bg-zinc-800/40 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <motion.div 
            whileHover={{ y: -5 }}
            className="luxury-card-pink p-8 rounded-[40px] relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-black text-white/90 uppercase tracking-widest mb-2">Số dư hiện tại</p>
              <h3 className="text-4xl font-black mb-4 text-white">{totalBalance.toLocaleString()}đ</h3>
              <div className="flex items-center gap-2 text-white/90 font-black text-sm">
                <TrendingUp className="w-4 h-4" />
                +12.5% so với tháng trước
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
                <ArrowUpRight className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng thu tháng</p>
                <h4 className="text-2xl font-black text-slate-900">{(totalRevenueMonth / 1000000).toFixed(1)}M</h4>
              </div>
            </div>
            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[70%] rounded-full"></div>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-3">Đạt 70% mục tiêu tháng</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card-white p-8 rounded-[40px] flex flex-col justify-center"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng chi tháng</p>
                <h4 className="text-2xl font-black text-slate-900">{(totalExpenseMonth / 1000000).toFixed(1)}M</h4>
              </div>
            </div>
            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full w-[35%] rounded-full"></div>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-3">Giảm 5% so với tháng trước</p>
          </motion.div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
            <CreditCard className="w-6 h-6 text-rose-500" />
            Giao dịch gần đây
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm giao dịch..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/10 w-full sm:w-64 transition-all" 
              />
            </div>
            <PremiumSelect
              value={filterType}
              onChange={(val) => { setFilterType(val === 'revenue' || val === 'expense' ? val : 'all'); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'revenue', label: 'Thu vào' },
                { value: 'expense', label: 'Chi ra' }
              ]}
              className="w-full sm:w-32"
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-8">
              <SkeletonTable />
            </div>
          ) : (
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="text-left bg-slate-50/50">
                  <th 
                    onClick={() => sortData('category')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Danh mục
                      {sortConfig?.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => sortData('details')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Chi tiết nghiệp vụ
                      {sortConfig?.key === 'details' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => sortData('timestamp')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Ngày
                      {sortConfig?.key === 'timestamp' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Phương thức</th>
                  <th 
                    onClick={() => sortData('amount')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Số tiền
                      {sortConfig?.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentTransactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                     <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === 'revenue' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {tx.type === 'revenue' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <span className="font-bold text-slate-900 whitespace-nowrap">{tx.category}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-700 whitespace-nowrap">{tx.details || 'N/A'}</p>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 whitespace-nowrap">{tx.date}</td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 whitespace-nowrap">{tx.method}</td>
                    <td className="px-8 py-5 font-black text-slate-900 whitespace-nowrap">{tx.amount}</td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                          tx.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {tx.status === 'confirmed' ? 'Đã xác nhận' : 'Đang chờ'}
                        </span>
                        {tx.status !== 'confirmed' && (
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleConfirm(tx)}
                            disabled={isConfirmingId === tx.id}
                            className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm shadow-slate-200 disabled:opacity-50"
                          >
                            {isConfirmingId === tx.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Duyệt thu chi
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-8 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
          <p className="text-xs font-bold text-slate-500">
            Hiển thị <span className="text-slate-900">{currentTransactions.length}</span> trên <span className="text-slate-900">{filteredTransactions.length}</span> giao dịch
          </p>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Trải về
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                    currentPage === i + 1 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-100 dark:shadow-none' 
                      : 'text-slate-400 hover:bg-white hover:text-slate-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Tiếp theo
            </button>
          </div>
        </div>
      </div>
    </div>
      )}
      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchData}
      />
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
