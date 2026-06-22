import { Edit, Settings } from 'lucide-react';
import { formatCurrency } from '@bella/shared';;
import type { HqTenantRecord } from '@/types/domain';

interface HqClearingRateLedgerProps {
  tenants: HqTenantRecord[];
  onOpenClearingRate: (tenant: HqTenantRecord) => void;
}

export function HqClearingRateLedger({
  tenants,
  onOpenClearingRate,
}: HqClearingRateLedgerProps) {
  return (
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Cấu hình Đơn giá Đối soát Liệu trình Nội bộ ({tenants.filter(t => t.name !== 'Bella Spa Headquarter').length})
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase flex items-center gap-1">
                  <Settings size={10} /> Đơn giá hoàn lại creditor
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th scope="col" className="px-8 py-5">Chi nhánh</th>
                      <th scope="col" className="px-6 py-5 text-right">Đơn giá đối soát liệu trình liên chi nhánh</th>
                      <th scope="col" className="px-8 py-5 text-right">Thiết lập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {tenants
                      .filter(t => t.name !== 'Bella Spa Headquarter')
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs uppercase shrink-0">
                                {t.name.charAt(0)}
                              </div>
                              <div>
                                <h5 className="font-black text-slate-900">{t.name}</h5>
                                <span className="text-[9px] text-slate-400 block mt-0.5">ID: {t.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-900">
                            {formatCurrency(t.internal_clearing_rate ?? 150000)} / ca điều trị hoàn thành
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button
                              onClick={() => onOpenClearingRate(t)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <Edit size={12} />
                              Thay đổi đơn giá
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
  );
}
