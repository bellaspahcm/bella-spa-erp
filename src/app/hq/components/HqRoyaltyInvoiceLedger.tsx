import { Calendar, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@bella/shared';;
import type { FranchiseRoyaltyInvoice } from '@/services/franchise-actions';

interface HqRoyaltyInvoiceLedgerProps {
  invoices: FranchiseRoyaltyInvoice[];
  loading: boolean;
  onReconcileInvoice: (invoiceNumber: string) => void;
}

export function HqRoyaltyInvoiceLedger({
  invoices,
  loading,
  onReconcileInvoice,
}: HqRoyaltyInvoiceLedgerProps) {
  return (
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Sổ cái hóa đơn phí nhượng quyền (Royalty Invoices Ledger)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Hóa đơn công nợ nhượng quyền được tự động trích xuất khi chi nhánh khóa sổ tháng.</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase">
                  HQ Financial Audit
                </span>
              </div>

              {loading ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang đồng bộ hóa đơn từ máy chủ...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">📄</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có hóa đơn phí nhượng quyền nào được phát sinh.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">Khi quản trị viên chi nhánh thực hiện Khóa sổ tài chính tháng (lockMonth), hóa đơn nhượng quyền tự động sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Mã hóa đơn</th>
                        <th scope="col" className="px-6 py-5">Chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-center">Tháng đối soát</th>
                        <th scope="col" className="px-6 py-5 text-right">Doanh thu tháng</th>
                        <th scope="col" className="px-6 py-5">Phương thức tính</th>
                        <th scope="col" className="px-6 py-5 text-right">Phải thu HQ</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {invoices.map((inv) => {
                        const monthDate = new Date(inv.month_year);
                        const formattedMonth = `Tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900 font-mono tracking-tight">
                              {inv.invoice_number}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {inv.tenants?.name || 'Chi nhánh'}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                <Calendar size={11} className="text-slate-400" />
                                {formattedMonth}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right font-black text-slate-800">
                              {formatCurrency(inv.gross_revenue)}
                            </td>
                            <td className="px-6 py-5 text-xs">
                              {inv.royalty_type === 'percentage' ? (
                                <span className="text-rose-500 font-black">
                                  Trích % Doanh thu ({inv.royalty_rate}%)
                                </span>
                              ) : (
                                <span className="text-indigo-600 font-black">
                                  Cố định ({formatCurrency(inv.royalty_fixed_amount)})
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(inv.calculated_amount)}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  : inv.status === 'cancelled'
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {inv.status === 'paid' ? 'Đã thu tiền' : inv.status === 'cancelled' ? 'Hủy bỏ' : 'Chờ đối soát'}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              {inv.status === 'pending' ? (
                                <button
                                  onClick={() => onReconcileInvoice(inv.invoice_number)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-50"
                                >
                                  <CheckCircle2 size={12} />
                                  Duyệt thu
                                </button>
                              ) : inv.status === 'paid' ? (
                                <div className="text-left text-[9px] leading-tight text-slate-400">
                                  <p className="font-bold">Giao dịch thành công</p>
                                  <p className="font-mono text-[8px]">{inv.payment_method || 'VietQR'}</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold italic">Bị hủy</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
  );
}
