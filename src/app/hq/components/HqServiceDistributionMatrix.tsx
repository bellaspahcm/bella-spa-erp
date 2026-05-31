import { RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { HqPackageTemplate } from '@/types/domain';
import type { HqDistributedPackageRecord } from './HqServiceStats';

interface HqServiceDistributionMatrixProps {
  templates: HqPackageTemplate[];
  distributedList: HqDistributedPackageRecord[];
  loading: boolean;
}

export function HqServiceDistributionMatrix({
  templates,
  distributedList,
  loading,
}: HqServiceDistributionMatrixProps) {
  return (
    <div className="lg:col-span-7 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
      <div className="border-b border-slate-50 pb-4">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
          Ma trận phân phối & Giá bán chi nhánh đại lý
        </h4>
        <p className="text-[9px] text-slate-400 font-bold mt-0.5">Giám sát giá bán thực tế và biên độ tự quyết tại chi nhánh nhượng quyền</p>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw size={20} className="animate-spin text-primary mx-auto" />
        </div>
      ) : distributedList.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-8">Chưa có liệu trình nào được phân phối xuống chi nhánh.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-xs text-left">
            <thead className="text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3">Liệu trình</th>
                <th className="px-4 py-3 text-right">Giá áp dụng</th>
                <th className="px-4 py-3 text-center">Biên độ kiểm soát</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {distributedList.map(item => {
                const template = templates.find(t => t.id === item.template_id);
                const floor = template?.price_floor ?? item.price;
                const cap = template?.price_cap ?? item.price;
                const localPrice = item.price;

                const sliderRange = cap - floor;
                const sliderPercentage = sliderRange > 0
                  ? Math.min(Math.max(((localPrice - floor) / sliderRange) * 100, 0), 100)
                  : 50;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 font-black text-slate-900">{item.tenant_name}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 text-[11px]">{item.name}</p>
                      <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.2 rounded uppercase">
                        ID: {item.id.slice(0, 5)}...
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-600 text-[11px]">{formatCurrency(localPrice)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 max-w-[200px] mx-auto text-left">
                        <div className="flex justify-between text-[8px] font-mono text-slate-400">
                          <span>Sàn: {floor / 1000}k</span>
                          <span>Trần: {cap / 1000}k</span>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-500 to-primary rounded-full transition-all"
                            style={{ width: `${sliderPercentage}%` }}
                          />
                          {template && template.price > floor && template.price < cap && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-350"
                              style={{ left: `${((template.price - floor) / sliderRange) * 100}%` }}
                              title="Giá chuẩn HQ"
                            />
                          )}
                        </div>
                        <p className="text-[8px] text-center font-bold text-slate-400 italic">
                          {localPrice === template?.price ? 'Chuẩn giá thương hiệu' : localPrice > (template?.price ?? 0) ? 'Đắt hơn tiêu chuẩn' : 'Rẻ hơn tiêu chuẩn'}
                        </p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
