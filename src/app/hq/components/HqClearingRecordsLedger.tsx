import { Calendar, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { InterBranchClearingRecord } from '@/services/clearing-actions';

interface HqClearingRecordsLedgerProps {
  records: InterBranchClearingRecord[];
  loading: boolean;
  onClearRecord: (recordId: string, clearingNumber: string) => void;
}

export function HqClearingRecordsLedger({
  records,
  loading,
  onClearRecord,
}: HqClearingRecordsLedgerProps) {
  return (
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Sổ cái bù trừ nội bộ liên chi nhánh (Inter-branch Clearing Ledger)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    Hóa đơn bù trừ tự động được trích xuất khi chi nhánh bán (Debtor) và chi nhánh làm liệu trình (Creditor) phát sinh ca liệu trình liên chi nhánh trong tháng.
                  </p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase">
                  HQ Clearing Audit
                </span>
              </div>

              {loading ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang đồng bộ hóa đơn bù trừ...</p>
                </div>
              ) : records.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">🔄</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có công nợ liên chi nhánh nào phát sinh.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Khi khách hàng mua liệu trình tại Spa A nhưng thực hiện ca liệu trình thành công tại Spa B, hệ thống sẽ tự động tổng hợp bù trừ khi chi nhánh thực hiện khóa sổ tháng.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Mã bù trừ</th>
                        <th scope="col" className="px-6 py-5">Bên mua nợ (Debtor)</th>
                        <th scope="col" className="px-6 py-5">Bên làm thu (Creditor)</th>
                        <th scope="col" className="px-6 py-5 text-center">Tháng đối soát</th>
                        <th scope="col" className="px-6 py-5 text-center">Số ca liên chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-right">Đơn giá áp dụng</th>
                        <th scope="col" className="px-6 py-5 text-right">Số tiền bù trừ</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {records.map((rec) => {
                        const monthDate = new Date(rec.month_year);
                        const formattedMonth = `Tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900 font-mono tracking-tight text-xs animate-fade-in">
                              {rec.clearing_number}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {rec.debtor?.name || 'Chi nhánh A'}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {rec.creditor?.name || 'Chi nhánh B'}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                <Calendar size={11} className="text-slate-400" />
                                {formattedMonth}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {rec.session_count} ca
                            </td>
                            <td className="px-6 py-5 text-right text-slate-600">
                              {formatCurrency(rec.clearing_rate)}
                            </td>
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(rec.calculated_amount)}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                rec.status === 'cleared'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {rec.status === 'cleared' ? 'Đã bù trừ' : 'Chờ xử lý'}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              {rec.status === 'pending' ? (
                                <button
                                  onClick={() => onClearRecord(rec.id, rec.clearing_number)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-50"
                                >
                                  <CheckCircle2 size={12} />
                                  HQ Gạch nợ
                                </button>
                              ) : (
                                <div className="text-left text-[9px] leading-tight text-slate-400">
                                  <p className="font-bold">Đã gạch nợ thành công</p>
                                  <p className="font-mono text-[8px]">{rec.payment_method || 'HQ Manual'}</p>
                                </div>
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
