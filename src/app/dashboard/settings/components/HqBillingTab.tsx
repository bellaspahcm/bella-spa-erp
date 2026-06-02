'use client';

import { useState, useEffect } from 'react';
import { 
  Receipt, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  QrCode,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { 
  getFranchiseRoyaltyInvoices, 
  simulateFranchiseRoyaltyPayment, 
  FranchiseRoyaltyInvoice 
} from '@/services/franchise-actions';

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

export default function HqBillingTab() {
  const [invoices, setInvoices] = useState<FranchiseRoyaltyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Payment Modal States
  const [activeInvoice, setActiveInvoice] = useState<FranchiseRoyaltyInvoice | null>(null);
  const [paying, setPaying] = useState(false);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await getFranchiseRoyaltyInvoices();
      setInvoices(data);
    } catch (err: unknown) {
      toast.error('Không thể tải danh sách hóa đơn: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialInvoices() {
      try {
        const data = await getFranchiseRoyaltyInvoices();
        if (!cancelled) setInvoices(data);
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error('Không thể tải danh sách hóa đơn: ' + getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialInvoices();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSimulatePayment = async () => {
    if (!activeInvoice) return;
    setPaying(true);
    try {
      // Delay to simulate real scan
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const res = await simulateFranchiseRoyaltyPayment(activeInvoice.invoice_number);
      if (res.success) {
        toast.success(`Thanh toán thành công hóa đơn ${activeInvoice.invoice_number}!`);
        setActiveInvoice(null);
        await loadInvoices();
      } else {
        toast.error(res.error || 'Thanh toán thất bại.');
      }
    } catch (err: unknown) {
      toast.error('Lỗi cổng thanh toán sandbox: ' + getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  // Aggregates
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const totalDebt = pendingInvoices.reduce((sum, inv) => sum + Number(inv.calculated_amount), 0);

  return (
    <div className="space-y-8 text-left">
      <div>
        <h3 className="text-xl font-bold text-foreground uppercase flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Hóa đơn Tổng bộ HQ & Phí Nhượng quyền
        </h3>
        <p className="text-sm text-muted-foreground font-medium mt-1">
          Theo dõi các hóa đơn phát sinh, quản lý thỏa thuận phí nhượng quyền thương mại (royalty fee) định kỳ với Tổng bộ Bella Spa HQ.
        </p>
      </div>

      {/* Aggregate Widget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-md relative overflow-hidden flex items-center justify-between">
          <div className="absolute right-[-10%] top-[-30%] w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-primary/20">CÔNG NỢ CHỜ THANH TOÁN</span>
            <h4 className="text-3xl font-black mt-2 tracking-tight">{formatCurrency(totalDebt)}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{pendingInvoices.length} hóa đơn đang treo nợ</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-primary">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] bg-slate-100 text-slate-500 font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-slate-200/50">LƯU Ý QUAN TRỌNG</span>
            <p className="text-xs text-slate-600 font-semibold mt-3 max-w-[320px] leading-relaxed">
              Hóa đơn nhượng quyền được tự động kết xuất dựa trên chính sách thỏa thuận đã ký với HQ ngay khi bạn thực hiện **Khóa sổ tài chính tháng** tại trang Quản lý Tài chính.
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lịch sử hóa đơn nhượng quyền ({invoices.length})</h4>
          <button 
            onClick={loadInvoices}
            disabled={loading}
            className="text-xs font-black text-primary uppercase tracking-widest hover:text-primary-hover flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
            <p className="text-xs text-slate-400 font-bold italic">Đang tải lịch sử công nợ...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <span className="text-4xl block">🍃</span>
            <p className="text-slate-400 font-bold text-sm italic">Tuyệt vời! Không có hóa đơn nhượng quyền nào ở chi nhánh của bạn.</p>
            <p className="text-[10px] text-slate-400">Các hóa đơn sẽ tự động phát sinh khi bạn thực hiện Khóa sổ tháng đầu tiên.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Mã hóa đơn</th>
                  <th className="px-6 py-5 text-center">Tháng P&L</th>
                  <th className="px-6 py-5 text-right">Doanh thu tháng</th>
                  <th className="px-6 py-5">Chính sách áp dụng</th>
                  <th className="px-6 py-5 text-right">Phí nhượng quyền</th>
                  <th className="px-6 py-5 text-center">Trạng thái</th>
                  <th className="px-8 py-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {invoices.map((inv) => {
                  const m = new Date(inv.month_year);
                  const monthStr = `Tháng ${m.getMonth() + 1}/${m.getFullYear()}`;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 font-mono tracking-tight">{inv.invoice_number}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Calendar size={11} className="text-slate-400" />
                          {monthStr}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-slate-800">{formatCurrency(inv.gross_revenue)}</td>
                      <td className="px-6 py-5 text-xs font-bold">
                        {inv.royalty_type === 'percentage' ? (
                          <span className="text-rose-500">Trích {inv.royalty_rate}% Doanh thu</span>
                        ) : (
                          <span className="text-indigo-600">Phí cố định {formatCurrency(inv.royalty_fixed_amount)}</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">{formatCurrency(inv.calculated_amount)}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : inv.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                        }`}>
                          {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'cancelled' ? 'Đã hủy' : 'Chờ thanh toán'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        {inv.status === 'pending' ? (
                          <button
                            onClick={() => setActiveInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-sm shadow-slate-100"
                          >
                            <QrCode size={12} />
                            Thanh toán
                          </button>
                        ) : inv.status === 'paid' ? (
                          <div className="text-right text-[10px] font-bold text-slate-400 leading-tight">
                            <p>Đã gạch nợ thành công</p>
                            <p className="text-[8px] font-mono mt-0.5">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('vi-VN') : ''}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Không khả dụng</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Premium VietQR simulated Modal Dialog */}
      <AnimatePresence>
        {activeInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden text-left"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-5 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-primary/20">CỔNG THANH TOÁN VIETQR MOCK</span>
                  <h3 className="text-sm font-black uppercase mt-1">Quét mã chuyển khoản HQ</h3>
                </div>
                <button
                  onClick={() => setActiveInvoice(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 flex flex-col items-center">
                
                {/* Simulated Bank Info Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full text-center space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Đơn vị thụ hưởng (Tổng bộ HQ)</p>
                  <p className="text-xs font-black text-slate-800">BELLA SPA HEADQUARTER JOINT STOCK COMPANY</p>
                  <p className="text-[10px] text-slate-500 font-bold">Vietcombank (VCB) | Số tài khoản: <span className="font-mono text-slate-800">0071000999888</span></p>
                </div>

                {/* Simulated VietQR dynamic image with overlay design elements */}
                <div className="relative p-4 bg-white border-2 border-dashed border-slate-200 rounded-[2rem] shadow-inner flex flex-col items-center group">
                  <div className="w-48 h-48 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 relative overflow-hidden">
                    {/* Simulated QR Code patterns */}
                    <div className="absolute inset-4 grid grid-cols-4 gap-2 opacity-15">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="bg-slate-950 rounded-sm" />
                      ))}
                    </div>
                    
                    <QrCode size={64} className="text-slate-600 z-10" />
                    
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-2 z-10">VIETQR DYNAMIC</span>
                  </div>

                  {/* Dynamic VietQR Watermarks */}
                  <span className="text-[9px] font-black text-primary tracking-widest uppercase mt-3 flex items-center gap-1">
                    NAPAS 247 <ArrowRight size={10} className="text-slate-400" /> VIETQR
                  </span>
                </div>

                {/* Amount and notes details */}
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Số tiền nộp</span>
                    <span className="text-lg font-black text-primary">{formatCurrency(activeInvoice.calculated_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nội dung chuyển khoản</span>
                    <span className="text-xs font-mono font-black text-slate-800">{activeInvoice.invoice_number}</span>
                  </div>
                </div>

                {/* Alert reminder */}
                <div className="flex gap-2.5 bg-rose-50/50 border border-rose-100/50 rounded-2xl p-3 text-left w-full">
                  <AlertCircle size={16} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    * Vui lòng chuyển đúng số tiền và nội dung chính xác để hệ thống cổng thanh toán AI tự động gạch nợ tức thì.
                  </p>
                </div>

                {/* Sandbox Payment Simulator Controls */}
                <div className="flex gap-3 w-full pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setActiveInvoice(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleSimulatePayment}
                    disabled={paying}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-100"
                  >
                    {paying ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Gạch nợ...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={12} />
                        Simulate Scan
                      </>
                    )}
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
