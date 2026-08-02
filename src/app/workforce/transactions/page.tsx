'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, ArrowDownRight, ArrowUpRight, Search, Loader2, ChevronLeft,
  DollarSign, Landmark, Calendar, Eye, ShieldAlert, BadgePercent
} from 'lucide-react';
import { getWorkforceTransactions, WorkforceTransaction } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function MyTransactions() {
  const [transactions, setTransactions] = useState<WorkforceTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await getWorkforceTransactions();
      setTransactions(data);
    } catch (err) {
      toast.error('Lỗi khi tải lịch sử giao dịch');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTx = transactions.filter(tx => {
    const matchesSearch = (tx.notes?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          tx.transaction_type.includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || tx.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getFormatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20';
      case 'approved':
        return 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20';
      case 'pending':
        return 'text-amber-600 bg-amber-50 border-amber-250 dark:bg-amber-950/20';
      default:
        return 'text-rose-600 bg-rose-50 border-rose-250 dark:bg-rose-950/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Đã thanh toán';
      case 'approved': return 'Đã duyệt chi';
      case 'pending': return 'Đang xử lý';
      default: return 'Đã hủy';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'booking': return 'Giữ chỗ';
      case 'deposit': return 'Đặt cọc';
      case 'contract': return 'Hợp đồng';
      case 'payment_milestone': return 'Đợt thanh toán';
      default: return 'Điều chỉnh';
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Lịch Sử Giao Dịch</h2>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo ghi chú, mã dự án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl py-3 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { value: 'all', label: 'Tất cả' },
            { value: 'pending', label: 'Chờ xử lý' },
            { value: 'approved', label: 'Đã duyệt' },
            { value: 'paid', label: 'Đã chi trả' }
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setSelectedStatus(t.value)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedStatus === t.value ? 'bg-primary border-primary text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-850 hover:border-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TRANSACTION LIST */}
      <div className="p-5 space-y-3.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải lịch sử giao dịch...</p>
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-405 font-bold uppercase tracking-wider">Không tìm thấy giao dịch nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTx.map(tx => (
              <div 
                key={tx.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {getTypeLabel(tx.transaction_type)}
                    </span>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-snug">
                      {tx.notes || 'Giao dịch hoa hồng kinh doanh'}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${getStatusBadge(tx.status)}`}>
                    {getStatusLabel(tx.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/80 pt-3">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Giá trị giao dịch</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{getFormatCurrency(tx.base_amount)}</span>
                  </div>
                  
                  {tx.commission_rate && (
                    <div className="space-y-0.5 text-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tỷ lệ</span>
                      <span className="text-xs font-black text-indigo-600 flex items-center gap-0.5 justify-center">
                        <BadgePercent className="w-3.5 h-3.5" /> {tx.commission_rate}%
                      </span>
                    </div>
                  )}

                  <div className="space-y-0.5 text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Hoa hồng nhận</span>
                    <span className="text-xs font-black text-emerald-600">{getFormatCurrency(tx.commission_amount)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold border-t border-slate-50 dark:border-slate-800/50 pt-2.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Ngày ghi nhận: {new Date(tx.earned_date).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
