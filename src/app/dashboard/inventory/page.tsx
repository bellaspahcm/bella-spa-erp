'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  AlertTriangle, 
  PlusCircle, 
  History, 
  TrendingDown, 
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  MoreVertical,
  X,
  FileText
} from 'lucide-react';
import { getInventoryItems, getInventoryLogs, restockItem } from '@/services/inventory-actions';
import { toast } from 'sonner';
import { formatNumberWithSeparator } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [restockAmount, setRestockAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsData, logsData] = await Promise.all([
        getInventoryItems(),
        getInventoryLogs()
      ]);
      setItems(itemsData);
      setLogs(logsData);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu kho');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestock = async () => {
    if (!selectedItem || restockAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await restockItem(selectedItem.id, restockAmount);
      toast.success(`Đã nhập thêm ${restockAmount} ${selectedItem.unit} cho ${selectedItem.name}`);
      setSelectedItem(null);
      setRestockAmount(0);
      fetchData();
    } catch (error) {
      toast.error('Lỗi khi cập nhật kho');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const lowStockItems = items.filter(item => Number(item.stock_level) <= Number(item.min_stock_level));

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/30">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto space-y-10">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl font-black text-slate-900 mb-2">Quản Lý Kho Vật Tư</h1>
           <p className="text-slate-500 font-medium text-sm">Theo dõi tiêu hao vật tư và dự báo nhập hàng tự động.</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="bg-white p-4 rounded-[2rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 min-w-[200px]">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
                 <Package className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tổng mặt hàng</p>
                 <p className="text-xl font-black text-slate-900">{items.length}</p>
              </div>
           </div>

           <div className="bg-white p-4 rounded-[2rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 min-w-[200px]">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                lowStockItems.length > 0 ? "bg-amber-50 text-amber-500 animate-pulse" : "bg-emerald-50 text-emerald-500"
              )}>
                 <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sắp hết hàng</p>
                 <p className="text-xl font-black text-slate-900">{lowStockItems.length}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Main Inventory List */}
        <div className="xl:col-span-2 space-y-6">
           <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div className="relative flex-grow max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm vật tư, SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                 </div>
                 <div className="flex items-center gap-3">
                    <button className="p-3.5 bg-slate-50 rounded-2xl text-slate-500 hover:bg-slate-100 transition-all">
                       <Filter className="w-5 h-5" />
                    </button>
                    <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                       <PlusCircle className="w-4 h-4" />
                       Thêm Vật Tư
                    </button>
                 </div>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="bg-slate-50/50">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vật tư</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn kho</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn giá</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hành động</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {filteredItems.map((item) => {
                         const isLow = Number(item.stock_level) <= Number(item.min_stock_level);
                         const progress = Math.min(100, (Number(item.stock_level) / (Number(item.min_stock_level) * 3)) * 100);
                         
                         return (
                           <tr key={item.id} className="hover:bg-slate-50/30 transition-all group">
                              <td className="px-8 py-6">
                                 <div className="flex items-center gap-4">
                                    <div className={cn(
                                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                                      isLow ? "bg-amber-50 text-amber-500" : "bg-rose-50 text-primary"
                                    )}>
                                       <Package className="w-6 h-6" />
                                    </div>
                                    <div>
                                       <p className="text-sm font-black text-slate-900">{item.name}</p>
                                       <p className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-6">
                                 <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{item.sku || 'N/A'}</span>
                              </td>
                              <td className="px-8 py-6 min-w-[180px]">
                                 <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                       <p className={cn("text-sm font-black", isLow ? "text-amber-500" : "text-slate-900")}>
                                          {item.stock_level} <span className="text-[10px] text-slate-400">{item.unit}</span>
                                       </p>
                                       {isLow && <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Sắp hết!</span>}
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                       <div 
                                         className={cn("h-full transition-all duration-1000", isLow ? "bg-amber-400" : "bg-primary")} 
                                         style={{ width: `${progress}%` }} 
                                       />
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-6">
                                 <p className="text-sm font-black text-slate-700">{formatNumberWithSeparator(item.price_per_unit)}đ</p>
                              </td>
                              <td className="px-8 py-6">
                                 <button 
                                   onClick={() => setSelectedItem(item)}
                                   className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
                                 >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Nhập hàng
                                 </button>
                              </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* Inventory Logs */}
        <div className="xl:col-span-1 space-y-6">
           <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 h-full">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                    <History className="text-primary w-6 h-6" />
                    Lịch sử Kho
                 </h3>
                 <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Tất cả</button>
              </div>

              <div className="space-y-6">
                 {logs.map((log) => (
                   <div key={log.id} className="flex gap-4 relative">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 z-10",
                        log.change_amount > 0 ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-primary"
                      )}>
                         {log.change_amount > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      </div>
                      
                      <div className="flex-grow min-w-0 pb-6 border-b border-slate-50 last:border-0">
                         <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-black text-slate-900 truncate pr-2">{log.inventory_items?.name}</h4>
                            <span className={cn(
                              "text-xs font-black whitespace-nowrap",
                              log.change_amount > 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                               {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                            </span>
                         </div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                            {log.reason === 'session_consumption' ? 'Tiêu hao buổi liệu trình' : 'Nhập kho bổ sung'}
                         </p>
                         <p className="text-[10px] text-slate-500 font-medium">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Restock Modal */}
      <AnimatePresence>
         {selectedItem && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedItem(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-md rounded-[3rem] p-10 relative z-10 shadow-2xl overflow-hidden"
              >
                 <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                 
                 <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl shadow-rose-100">
                       <RefreshCw className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">Nhập Kho Vật Tư</h3>
                    <p className="text-slate-500 text-sm mt-2">{selectedItem.name}</p>
                 </div>

                 <div className="space-y-6 mb-10">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Số lượng nhập ({selectedItem.unit})</label>
                       <input 
                         type="number" 
                         value={restockAmount}
                         onChange={(e) => setRestockAmount(Number(e.target.value))}
                         className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xl font-black outline-none focus:ring-2 focus:ring-primary/20 transition-all text-center"
                         autoFocus
                       />
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-400 uppercase text-[10px]">Tồn hiện tại</span>
                          <span className="font-black text-slate-900">{selectedItem.stock_level} {selectedItem.unit}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-400 uppercase text-[10px]">Sau khi nhập</span>
                          <span className="font-black text-emerald-500 text-lg">{Number(selectedItem.stock_level) + restockAmount} {selectedItem.unit}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedItem(null)}
                      className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all"
                    >
                       Hủy bỏ
                    </button>
                    <button 
                      onClick={handleRestock}
                      disabled={isSubmitting || restockAmount <= 0}
                      className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                       Xác nhận nhập
                    </button>
                 </div>
              </motion.div>
           </div>
         )}
      </AnimatePresence>
    </div>
  );
}
