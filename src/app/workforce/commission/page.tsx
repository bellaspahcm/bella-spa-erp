'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Banknote, Award, CheckCircle2, AlertCircle, Loader2, 
  ChevronLeft, ArrowUpRight, Clock, ShieldAlert, Sparkles
} from 'lucide-react';
import { getMyCommissionLedger, CommissionLedgerEntry } from '@/services/workforce-actions';
import { formatCurrency } from '@bella/shared';
import { toast } from 'sonner';
import Link from 'next/link';

export default function CommissionWallet() {
  const [ledger, setLedger] = useState<CommissionLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    try {
      const data = await getMyCommissionLedger();
      setLedger(data);
    } catch (err: unknown) {
      console.error('[CommissionWallet] Fetch failed:', err);
      toast.error('Lỗi khi tải ví hoa hồng');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Aggregate stats
  const pendingAmount = ledger.filter(item => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
  const approvedAmount = ledger.filter(item => item.status === 'approved').reduce((sum, item) => sum + item.amount, 0);
  const paidAmount = ledger.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900';
      case 'approved':
        return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900';
      default:
        return 'bg-amber-50 text-amber-600 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Đã thanh toán';
      case 'approved': return 'Đã duyệt';
      default: return 'Tạm tính';
    }
  };

  const getCommissionTypeLabel = (type: string) => {
    switch (type) {
      case 'booking': return 'Phát sinh từ Giữ chỗ';
      case 'contract': return 'Phát sinh từ Hợp đồng';
      case 'milestone': return 'Thanh toán đợt';
      default: return 'Khác';
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
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Ví Hoa Hồng</h2>
        </div>
      </div>

      {/* WALLET SUMMARY */}
      <div className="p-5 space-y-4">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-primary/20 rounded-full blur-3xl -mr-12 -mt-12" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-indigo-300">
              <Banknote className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Ví hoa hồng thực nhận</span>
            </div>
            <div>
              <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider">Tổng đã thực lĩnh</p>
              <h3 className="text-3xl font-black text-white mt-1">{formatCurrency(paidAmount)}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 mt-2 text-xs">
              <div>
                <span className="text-white/40 block text-[9px] font-bold uppercase tracking-wider">Đã duyệt chi</span>
                <span className="font-black text-blue-400 text-sm mt-0.5 block">{formatCurrency(approvedAmount)}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[9px] font-bold uppercase tracking-wider">Tạm tính (chờ duyệt)</span>
                <span className="font-black text-amber-400 text-sm mt-0.5 block">{formatCurrency(pendingAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* LEDGER DETAILS */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lịch sử giao dịch hoa hồng</h3>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải lịch sử ví...</p>
            </div>
          ) : ledger.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
              <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Chưa ghi nhận hoa hồng nào</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {ledger.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-850 dark:text-slate-150">Căn {item.deal_name}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${getStatusBadge(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      KH: {item.customer_name} • {getCommissionTypeLabel(item.commission_type)}
                    </p>
                    <p className="text-[9px] font-bold text-slate-350 dark:text-slate-500 uppercase tracking-wider">
                      Phát sinh: {new Date(item.earned_date).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-500">+{formatCurrency(item.amount)}</p>
                    {item.paid_date && (
                      <span className="text-[8px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 mt-1 inline-block">
                        Chi: {new Date(item.paid_date).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
