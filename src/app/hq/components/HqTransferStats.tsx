import { AlertCircle, ArrowLeftRight, CheckCircle2, Truck } from 'lucide-react';
import type { InventoryTransferOrder } from '@/services/inventory-transfer-actions';

interface HqTransferStatsProps {
  orders: InventoryTransferOrder[];
}

export function HqTransferStats({ orders }: HqTransferStatsProps) {
  return (
    <>
      {/* Quick Stats for Transfers */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-6">
      {/* Total transfer requests */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
          <ArrowLeftRight size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng lệnh chuyển kho</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
            {orders.length} Lệnh
          </h3>
          <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            Toàn hệ thống
          </span>
        </div>
      </div>

      {/* Pending requests */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <AlertCircle size={26} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Yêu cầu chờ duyệt</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
            {orders.filter(o => o.status === 'pending').length} Yêu cầu
          </h3>
          <span className="text-[9px] bg-rose-50 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            Cần HQ xử lý
          </span>
        </div>
      </div>

      {/* Shipped / Transit requests */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
          <Truck size={26} className="text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đang vận chuyển</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
            {orders.filter(o => o.status === 'shipped').length} Đơn
          </h3>
          <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            Chờ chi nhánh nhận
          </span>
        </div>
      </div>

      {/* Completed requests */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
          <CheckCircle2 size={26} className="text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã hoàn tất</p>
          <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
            {orders.filter(o => o.status === 'completed').length} Đơn
          </h3>
          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            Cập nhật kho thành công
          </span>
        </div>
      </div>
      </section>
    </>
  );
}
