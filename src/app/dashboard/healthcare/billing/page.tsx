'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Receipt, ShieldCheck, CheckCircle, ArrowUpRight, DollarSign, Wallet, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { 
  getInvoicesAction, 
  createInvoiceAction, 
  payInvoiceAction 
} from '@/services/healthcare/healthcare-actions';
import { createClient } from '@/lib/supabase-client';

interface BillingRecord {
  id: string;
  encounterId: string;
  patientName: string;
  bhytCode: string;
  benefitRate: number;
  totalAmount: number;
  bhytCovered: number;
  patientPay: number;
  status: 'unpaid' | 'paid';
  itemsCount: number;
}

export default function BillingPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<BillingRecord[]>([]);

  const [newInvoice, setNewInvoice] = useState({
    patientName: '',
    bhytCode: 'DN4018889990000',
    benefitRate: 80,
    totalAmount: 1500000,
  });

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await getInvoicesAction();
      if (res.success && res.data) {
        setRecords(res.data as BillingRecord[]);
      } else {
        toast.error('Lỗi tải hóa đơn viện phí: ' + res.error);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();

    const supabase = createClient();
    const channel = supabase
      .channel('hc-billing-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue' }, () => {
        void loadInvoices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.patientName.trim()) {
      toast.error('Vui lòng nhập tên bệnh nhân lập hóa đơn!');
      return;
    }

    const dbRes = await createInvoiceAction({
      patientName: newInvoice.patientName.trim(),
      bhytCode: newInvoice.bhytCode,
      benefitRate: newInvoice.benefitRate,
      totalAmount: newInvoice.totalAmount,
    });

    if (!dbRes.success) {
      toast.error('Lỗi tạo hóa đơn viện phí: ' + dbRes.error);
      return;
    }

    setIsAddModalOpen(false);
    toast.success(`🎉 Đã lập thành công hóa đơn viện phí cho BN ${newInvoice.patientName.trim()}!`);
    setNewInvoice({ patientName: '', bhytCode: 'DN4018889990000', benefitRate: 80, totalAmount: 1500000 });
    loadInvoices();
  };

  const handleProcessPayment = async (id: string, method: string) => {
    const dbRes = await payInvoiceAction(id, method);
    if (!dbRes.success) {
      toast.error('Lỗi thanh toán: ' + dbRes.error);
      return;
    }

    toast.success(`🎉 Đã thanh toán viện phí thành công qua ${method}! Đã đẩy Event Outbox sang Sổ cái Kế toán (TK 1111/131_BHYT -> 5113).`);
    loadInvoices();
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Receipt className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Phân Hệ Viện Phí & BHYT (Medical Billing Engine)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Phân tách Mức hưởng BHYT (80/20), Xuất Hóa đơn Viện phí & Kết nối Event Outbox Kế toán.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all w-fit"
        >
          <Receipt className="w-4 h-4" />
          + Lập Hóa Đơn Viện Phí Mới
        </button>
      </div>

      {/* Quick Summary Cards - Dynamic Computation */}
      {(() => {
        const totalRev = records.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        const bhytTotal = records.reduce((sum, r) => sum + (r.bhytCovered || 0), 0);
        const patientPayTotal = records.reduce((sum, r) => sum + (r.patientPay || 0), 0);

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block">Tổng Doanh Thu Viện Phí</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {totalRev.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block">BHYT Chi Trả (TK 131_BHYT)</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {bhytTotal.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block">Bệnh Nhân Đồng Chi Trả</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {patientPayTotal.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Billing Records Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="p-4">Bệnh Nhân / Lượt Khám</th>
                <th className="p-4">Mã Thẻ BHYT / Mức Hưởng</th>
                <th className="p-4">Tổng Chi Phí</th>
                <th className="p-4">BHYT Chi Trả (80%)</th>
                <th className="p-4">Bệnh Nhân Trả (20%)</th>
                <th className="p-4">Trạng Thái</th>
                <th className="p-4 text-right">Thao Tác Thu Tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono block">
                      {r.encounterId}
                    </span>
                    {r.patientName}
                  </td>

                  <td className="p-4">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">{r.bhytCode}</span>
                    <span className="text-[10px] text-emerald-600 font-extrabold">Mức hưởng BHYT: {r.benefitRate}%</span>
                  </td>

                  <td className="p-4 font-black text-slate-900 dark:text-white">
                    {r.totalAmount.toLocaleString('vi-VN')} VNĐ
                  </td>

                  <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">
                    {r.bhytCovered.toLocaleString('vi-VN')} VNĐ
                  </td>

                  <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {r.patientPay.toLocaleString('vi-VN')} VNĐ
                  </td>

                  <td className="p-4">
                    {r.status === 'paid' ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" /> Đã Thanh Toán
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 font-bold text-[10px] flex items-center gap-1 w-fit animate-pulse">
                        Chờ Thu Tiền
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-right">
                    {r.status === 'unpaid' ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleProcessPayment(r.id, 'Tiền Mặt')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          Thu Tiền Mặt
                        </button>
                        <button
                          onClick={() => handleProcessPayment(r.id, 'Chuyển Khoản / QR')}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
                        >
                          Chuyển Khoản
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toast.info('Đã in hóa đơn viện phí điện tử!')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1 ml-auto"
                      >
                        <FileCheck className="w-3.5 h-3.5" /> In Hóa Đơn
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lập Hóa Đơn Viện Phí Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Lập Hóa Đơn Viện Phí & Phân Tách BHYT
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Thí dụ: Nguyễn Văn Hùng..."
                  value={newInvoice.patientName}
                  onChange={(e) => setNewInvoice({ ...newInvoice, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mã Thẻ BHYT</label>
                  <input
                    type="text"
                    value={newInvoice.bhytCode}
                    onChange={(e) => setNewInvoice({ ...newInvoice, bhytCode: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-mono text-emerald-600 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mức Hưởng BHYT (%)</label>
                  <select
                    value={newInvoice.benefitRate}
                    onChange={(e) => setNewInvoice({ ...newInvoice, benefitRate: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold"
                  >
                    <option value={80}>80% (Chuẩn BHYT)</option>
                    <option value={95}>95% (Cận nghèo / Thân nhân)</option>
                    <option value={100}>100% (Công thần / Sĩ quan)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tổng Chi Phí Khám Bệnh & Y Lệnh (VNĐ) *</label>
                <input
                  type="number"
                  required
                  min="10000"
                  step="10000"
                  value={newInvoice.totalAmount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, totalAmount: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-black text-slate-900 dark:text-white text-sm"
                />
              </div>

              {/* Calculated Split Preview Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 font-semibold">
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span>BHYT Chi Trả ({newInvoice.benefitRate}%):</span>
                  <span className="font-black">{(Math.round(newInvoice.totalAmount * (newInvoice.benefitRate / 100))).toLocaleString('vi-VN')} VNĐ</span>
                </div>
                <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400">
                  <span>Bệnh Nhân Trả ({100 - newInvoice.benefitRate}%):</span>
                  <span className="font-black">{(newInvoice.totalAmount - Math.round(newInvoice.totalAmount * (newInvoice.benefitRate / 100))).toLocaleString('vi-VN')} VNĐ</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + Lập Hóa Đơn Viện Phí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
