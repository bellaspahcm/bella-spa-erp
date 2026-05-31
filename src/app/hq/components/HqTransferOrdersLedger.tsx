import { Ban, RefreshCw, Truck } from 'lucide-react';
import type { InventoryTransferOrder, TransferOrderItem } from '@/services/inventory-transfer-actions';

type TransferFilterStatus = 'all' | 'pending' | 'shipped' | 'completed' | 'cancelled';

interface HqTransferOrdersLedgerProps {
  orders: InventoryTransferOrder[];
  loading: boolean;
  filterStatus: TransferFilterStatus;
  filterBranch: string;
  onOpenCancelModal: (order: InventoryTransferOrder) => void;
  onOpenShipModal: (order: InventoryTransferOrder) => void;
}

export function HqTransferOrdersLedger({
  orders,
  loading,
  filterStatus,
  filterBranch,
  onOpenCancelModal,
  onOpenShipModal,
}: HqTransferOrdersLedgerProps) {
  return (
    <>
      {/* Inventory Transfer Orders Ledger Table */}
      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Sổ cái lệnh chuyển kho cung ứng nội bộ
          </h4>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
            Các chi nhánh không được tùy ý điều chỉnh tồn kho vật tư mà phải thông qua lệnh yêu cầu cấp kho dưới đây.
          </p>
        </div>
        <span className="text-[10px] bg-rose-50 text-primary px-3 py-1 rounded-full font-black uppercase border border-rose-100">
          HQ Logistics Portal
        </span>
      </div>

      {loading ? (
        <div className="p-16 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
          <p className="text-xs text-slate-400 font-bold italic">Đang tải danh sách lệnh chuyển kho...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-16 text-center">
          <span className="text-4xl mb-3 block">📦</span>
          <p className="text-slate-400 font-bold text-sm italic">Chưa có lệnh chuyển kho nào được tạo.</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
            Các chi nhánh có thể gửi yêu cầu xin cấp vật tư từ Tổng bộ trực tiếp từ trang quản lý kho của họ.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th scope="col" className="px-8 py-5">Mã lệnh</th>
                <th scope="col" className="px-6 py-5">Chi nhánh yêu cầu</th>
                <th scope="col" className="px-6 py-5">Danh sách vật tư y/c</th>
                <th scope="col" className="px-6 py-5">Ghi chú chi nhánh</th>
                <th scope="col" className="px-6 py-5">Thông tin vận chuyển</th>
                <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                <th scope="col" className="px-8 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {orders
                .filter(rec => {
                  const matchStatus = filterStatus === 'all' || rec.status === filterStatus;
                  const matchBranch = filterBranch === 'all' || rec.requester_tenant_id === filterBranch;
                  return matchStatus && matchBranch;
                })
                .map((rec) => {
                  const orderItems = (rec.items || []) as TransferOrderItem[];
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Order Number & Time */}
                      <td className="px-8 py-5">
                        <div className="font-black text-slate-900 font-mono text-xs">
                          {rec.order_number}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                          {rec.created_at ? new Date(rec.created_at).toLocaleString('vi-VN') : 'N/A'}
                        </span>
                      </td>

                      {/* Branch Name */}
                      <td className="px-6 py-5 font-black text-slate-800">
                        {rec.requester?.name || 'Chi nhánh'}
                      </td>

                      {/* Items Requested */}
                      <td className="px-6 py-5">
                        <div className="space-y-1.5 max-w-md">
                          {orderItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center gap-4 bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-1.5 text-xs">
                              <div className="min-w-0">
                                <p className="font-black text-slate-800 truncate max-w-[180px]">{item.name}</p>
                                <p className="font-mono text-[9px] text-slate-400 font-bold uppercase">{item.sku}</p>
                              </div>
                              <span className="font-black text-primary bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg shrink-0">
                                SL: {item.qty} {item.unit || 'cái'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-5 text-xs text-slate-600 max-w-[200px] truncate" title={rec.notes || ''}>
                        {rec.notes || <span className="text-slate-400 font-bold italic">Không có ghi chú</span>}
                      </td>

                      {/* Shipping Details */}
                      <td className="px-6 py-5 text-xs">
                        {rec.status === 'shipped' || rec.status === 'completed' ? (
                          <div className="space-y-1 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-2.5 max-w-[240px]">
                            <p className="font-black text-slate-800 flex items-center gap-1.5">
                              <Truck size={12} className="text-indigo-500" />
                              {rec.shipping_carrier}
                            </p>
                            <p className="font-mono text-[9px] text-slate-500 font-black flex items-center gap-1.5 uppercase">
                              <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-md font-bold shrink-0">TRACKING</span>
                              {rec.tracking_number}
                            </p>
                            {rec.shipped_at && (
                              <p className="text-[9px] text-slate-400 font-bold">
                                Xuất kho: {new Date(rec.shipped_at).toLocaleString('vi-VN')}
                              </p>
                            )}
                          </div>
                        ) : rec.status === 'cancelled' ? (
                          <div className="bg-slate-100 rounded-2xl p-2.5 max-w-[240px] text-slate-500 leading-tight">
                            <p className="font-black text-[10px] text-slate-700 flex items-center gap-1">
                              <Ban size={10} className="text-slate-400" /> Lý do hủy:
                            </p>
                            <p className="text-[10px] font-bold italic mt-0.5">{rec.rejection_reason || 'Không nêu lý do'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold italic">Chưa giao hàng</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          rec.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : rec.status === 'shipped'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : rec.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {rec.status === 'completed' 
                            ? 'Hoàn tất' 
                            : rec.status === 'shipped' 
                            ? 'Đang vận chuyển' 
                            : rec.status === 'cancelled' 
                            ? 'Từ chối' 
                            : 'Chờ duyệt'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="px-8 py-5 text-right">
                        {rec.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onOpenCancelModal(rec)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-rose-100/50"
                            >
                              Từ chối
                            </button>
                            <button
                              onClick={() => onOpenShipModal(rec)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              Giao hàng (Ship)
                            </button>
                          </div>
                        ) : rec.status === 'shipped' ? (
                          <span className="text-[10px] text-slate-400 font-bold italic">Đang đợi chi nhánh nhận hàng...</span>
                        ) : rec.status === 'completed' ? (
                          <div className="text-right text-[9px] leading-tight text-slate-400">
                            <p className="font-bold">Đã nhận hàng</p>
                            {rec.completed_at && (
                              <p className="font-mono text-[8px]">{new Date(rec.completed_at).toLocaleDateString('vi-VN')}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Đã hủy bỏ</span>
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
    </>
  );
}
