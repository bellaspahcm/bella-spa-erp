'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, AlertTriangle, PlusCircle, History,
  TrendingDown, TrendingUp, RefreshCw, Search,
  ArrowRightLeft, X, ShieldCheck, Truck, ClipboardList,
  CheckCircle2, ShoppingCart, Trash2, ArrowRight
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { cn, formatNumberWithSeparator, getLocalDateString } from '@/lib/utils';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import {
  createInventoryRequest,
  getInventoryTransferOrders,
  confirmTransferReceipt,
  cancelTransferOrder,
  InventoryTransferOrder
} from '@/services/inventory-transfer-actions';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'requests'>('stock');
  const [items,    setItems]    = useState<any[]>([]);
  const [logs,     setLogs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [stockFilter, setStockFilter] = useState<'all'|'low'|'ok'>('all');

  // Transfer Orders State
  const [orders, setOrders] = useState<InventoryTransferOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [requestCart, setRequestCart] = useState<any[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);
  const [requestQty, setRequestQty] = useState<number>(0);
  const [requestNotes, setRequestNotes] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Month/Year dropdowns for log history
  const now = new Date();
  const [logMonth, setLogMonth] = useState(now.getMonth()); // 0-based
  const [logYear,  setLogYear]  = useState(now.getFullYear());

  // Derived date range
  const dateFrom = `${logYear}-${String(logMonth + 1).padStart(2,'0')}-01`;
  const dateTo   = getLocalDateString(new Date(logYear, logMonth + 1, 0));

  // Restock modal (Local Adjustment)
  const [restockTarget, setRestockTarget] = useState<any>(null);
  const [restockAmt,    setRestockAmt]    = useState(0);
  const [submitting,    setSubmitting]    = useState(false);

  // Auth context — fetched once, used for writes
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Add item modal
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', sku: '', unit: 'cái', stock_level: 0,
    min_stock_level: 10, price_per_unit: 0, category: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const sb = getSupabase();
      const [itemsRes, logsRes] = await Promise.all([
        sb.from('inventory_items').select('*').order('name'),
        sb.from('inventory_logs')
          .select(`
            id, change_amount, reason, notes, created_at, tenant_id,
            inventory_items!inventory_logs_item_id_fkey(name, unit)
          `)
          .order('created_at', { ascending: false })
          .limit(200)
      ]);

      if (itemsRes.error) console.error('[inventory] items error:', itemsRes.error);
      if (logsRes.error)  console.error('[inventory] logs error:',  logsRes.error);

      setItems(itemsRes.data || []);
      setLogs(logsRes.data   || []);
    } catch (e) {
      console.error('[fetchData]', e);
      toast.error('Lỗi tải dữ liệu kho');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const fetched = await getInventoryTransferOrders();
      setOrders(fetched);
    } catch (e) {
      console.error('[fetchOrders]', e);
      toast.error('Lỗi tải danh sách yêu cầu cấp vật tư');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    // Fetch tenant_id from browser auth session (for writes)
    const sb = getSupabase();
    sb.auth.getSession().then((res: any) => {
      const uid = res?.data?.session?.user?.id;
      if (uid) {
        sb.from('users').select('tenant_id').eq('id', uid).single()
          .then(({ data }: any) => setTenantId(data?.tenant_id || null));
      }
    });
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchOrders();
    }
  }, [activeTab]);

  // Filter items by search + stock status
  const filteredItems = useMemo(() =>
    items.filter(it => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        it.name?.toLowerCase().includes(q) ||
        (it.sku && it.sku.toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q));
      const isLow = Number(it.stock_level) <= Number(it.min_stock_level);
      const matchStatus = stockFilter === 'all' || (stockFilter === 'low' ? isLow : !isLow);
      return matchSearch && matchStatus;
    }), [items, search, stockFilter]);

  // Filter logs by selected month/year
  const filteredLogs = useMemo(() =>
    logs.filter(lg => {
      const d = lg.created_at?.slice(0, 10);
      return d >= dateFrom && d <= dateTo;
    }), [logs, dateFrom, dateTo]);

  const lowCount = items.filter(it => Number(it.stock_level) <= Number(it.min_stock_level)).length;

  const handleRestock = async () => {
    if (!restockTarget || restockAmt <= 0) return;
    setSubmitting(true);
    try {
      const sb = getSupabase();

      // 1. Get current stock
      const { data: item, error: fetchErr } = await sb
        .from('inventory_items').select('stock_level').eq('id', restockTarget.id).single();
      if (fetchErr) throw fetchErr;

      const newStock = Number(item.stock_level || 0) + restockAmt;

      // 2. Update stock level
      const { error: updateErr } = await sb
        .from('inventory_items')
        .update({ stock_level: newStock, updated_at: new Date().toISOString() })
        .eq('id', restockTarget.id);
      if (updateErr) throw updateErr;

      // 3. Insert log
      await sb.from('inventory_logs').insert({
        item_id:       restockTarget.id,
        change_amount: restockAmt,
        reason:        'restock',
        notes:         `Điều chỉnh kho: +${restockAmt} ${restockTarget.unit}`,
        tenant_id:     tenantId as string,
      });

      toast.success(`Đã cập nhật +${restockAmt} ${restockTarget.unit} cho mặt hàng ${restockTarget.name}`);
      setRestockTarget(null); setRestockAmt(0); fetchData();
    } catch (e: any) {
      console.error('[handleRestock]', e);
      toast.error(e?.message || 'Lỗi điều chỉnh kho');
    } finally { setSubmitting(false); }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.unit) { toast.error('Nhập tên và đơn vị'); return; }
    setSubmitting(true);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('inventory_items').insert({
        ...newItem,
        tenant_id: tenantId as string,
      });
      if (error) throw error;

      // Log initial stock if > 0
      if (newItem.stock_level > 0) {
        const { data: created } = await sb.from('inventory_items')
          .select('id').order('created_at', { ascending: false }).limit(1).single();
        if (created) {
          await sb.from('inventory_logs').insert({
            item_id:       created.id,
            change_amount: newItem.stock_level,
            reason:        'initial',
            notes:         'Tồn kho ban đầu',
            tenant_id:     tenantId as string,
          });
        }
      }

      toast.success('Đã thêm vật tư mới');
      setShowAdd(false);
      setNewItem({ name:'', sku:'', unit:'cái', stock_level:0, min_stock_level:10, price_per_unit:0, category:'' });
      fetchData();
    } catch (e: any) {
      console.error('[handleAddItem]', e);
      toast.error(e?.message || 'Lỗi thêm vật tư');
    } finally { setSubmitting(false); }
  };

  // Cart Management
  const addToCart = () => {
    if (selectedItemIndex === -1 || requestQty <= 0) {
      toast.error('Vui lòng chọn vật tư và nhập số lượng hợp lệ');
      return;
    }
    const selectedItem = items[selectedItemIndex];
    
    // Check duplicate
    const exists = requestCart.some(c => c.sku === selectedItem.sku && c.name === selectedItem.name);
    if (exists) {
      toast.error('Vật tư này đã có trong danh sách yêu cầu');
      return;
    }

    setRequestCart(prev => [...prev, {
      name: selectedItem.name,
      sku: selectedItem.sku || '',
      qty: requestQty,
      unit: selectedItem.unit
    }]);

    setSelectedItemIndex(-1);
    setRequestQty(0);
  };

  const removeFromCart = (index: number) => {
    setRequestCart(prev => prev.filter((_, i) => i !== index));
  };

  const submitTransferOrder = async () => {
    if (requestCart.length === 0) {
      toast.error('Vui lòng thêm ít nhất một vật tư vào yêu cầu');
      return;
    }
    setSubmittingOrder(true);
    try {
      const res = await createInventoryRequest(requestCart, requestNotes);
      if (res.success) {
        toast.success('Đã gửi yêu cầu cấp vật tư lên Tổng bộ phê duyệt!');
        setShowCreateRequest(false);
        setRequestCart([]);
        setRequestNotes('');
        fetchOrders();
        fetchData();
      } else {
        toast.error(res.error || 'Lỗi gửi yêu cầu');
      }
    } catch (e: any) {
      console.error('[submitTransferOrder]', e);
      toast.error(e.message || 'Lỗi hệ thống');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleConfirmReceipt = async (orderId: string) => {
    if (!confirm('Bạn có chắc chắn xác nhận đã nhận đủ hàng và cộng kho vật tư?')) return;
    try {
      const res = await confirmTransferReceipt(orderId);
      if (res.success) {
        toast.success('Xác nhận nhận hàng thành công. Tồn kho đã được cập nhật và ghi log!');
        fetchOrders();
        fetchData();
      } else {
        toast.error(res.error || 'Lỗi xác nhận nhận hàng');
      }
    } catch (e: any) {
      console.error('[handleConfirmReceipt]', e);
      toast.error(e.message || 'Lỗi hệ thống');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy yêu cầu cấp vật tư này?')) return;
    try {
      const res = await cancelTransferOrder(orderId, 'Chi nhánh chủ động hủy yêu cầu');
      if (res.success) {
        toast.success('Đã hủy yêu cầu cấp vật tư');
        fetchOrders();
      } else {
        toast.error(res.error || 'Lỗi hủy yêu cầu');
      }
    } catch (e: any) {
      console.error('[handleCancelOrder]', e);
      toast.error(e.message || 'Lỗi hệ thống');
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <RefreshCw className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto space-y-10">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-1">Quản Lý Kho Vật Tư</h1>
          <p className="text-slate-500 text-sm font-medium">Theo dõi tiêu hao vật tư, yêu cầu cấp hàng từ Tổng bộ và điều chỉnh tồn kho.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-[2rem] shadow-lg border border-slate-100 flex items-center gap-3 min-w-[160px]">
            <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng mặt hàng</p>
              <p className="text-xl font-black text-slate-900">{items.length}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[2rem] shadow-lg border border-slate-100 flex items-center gap-3 min-w-[160px]">
            <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center',
              lowCount > 0 ? 'bg-amber-50 text-amber-500 animate-pulse' : 'bg-emerald-50 text-emerald-500')}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sắp hết hàng</p>
              <p className="text-xl font-black text-slate-900">{lowCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn(
            "pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
            activeTab === 'stock' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <Package className="w-4 h-4" /> Tồn kho Chi nhánh
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
            activeTab === 'requests' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <Truck className="w-4 h-4" /> Yêu cầu cấp từ HQ
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">

        {/* ── Main View Panel ── */}
        <div className="xl:col-span-2">
          {activeTab === 'stock' ? (
            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
              {/* toolbar */}
              <div className="p-8 border-b border-slate-50 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-grow max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text" placeholder="Tìm vật tư, SKU, danh mục..."
                      value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full bg-slate-50 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <PremiumSelect 
                      value={stockFilter}
                      onChange={(val) => setStockFilter(val as any)}
                      options={[
                        { value: 'all', label: `Tất cả (${items.length})` },
                        { value: 'low', label: `⚠️ Sắp hết (${lowCount})` },
                        { value: 'ok', label: `✅ Còn hàng (${items.length - lowCount})` }
                      ]}
                      className="w-52"
                    />
                    <button
                      onClick={() => setShowAdd(true)}
                      className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-lg whitespace-nowrap"
                    >
                      <PlusCircle className="w-4 h-4" /> Thêm Vật Tư
                    </button>
                  </div>
                </div>
              </div>

              {/* table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      {['Vật tư','SKU','Tồn kho','Đơn giá','Hành động'].map(h => (
                        <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-semibold">Không có vật tư nào</td></tr>
                    ) : filteredItems.map(item => {
                      const isLow = Number(item.stock_level) <= Number(item.min_stock_level);
                      const pct   = Math.min(100, (Number(item.stock_level) / (Number(item.min_stock_level) * 3)) * 100);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-all group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center',
                                isLow ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-primary')}>
                                <Package className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{item.sku || 'N/A'}</span>
                          </td>
                          <td className="px-8 py-5 min-w-[160px]">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-end">
                                <p className={cn('text-sm font-black', isLow ? 'text-amber-500' : 'text-slate-900')}>
                                  {item.stock_level} <span className="text-[10px] text-slate-400">{item.unit}</span>
                                </p>
                                {isLow && <span className="text-[8px] font-black text-amber-500 uppercase">Sắp hết!</span>}
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn('h-full transition-all duration-700', isLow ? 'bg-amber-400' : 'bg-primary')}
                                     style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-sm font-black text-slate-700">{formatNumberWithSeparator(item.price_per_unit)}đ</p>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex gap-4">
                              <button onClick={() => { setRestockTarget(item); setRestockAmt(0); }}
                                className="flex items-center gap-1.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-slate-800 transition-colors">
                                <ArrowRightLeft className="w-3.5 h-3.5" /> Điều chỉnh
                              </button>
                              <button onClick={() => {
                                setRequestCart([{ name: item.name, sku: item.sku || '', qty: 10, unit: item.unit }]);
                                setShowCreateRequest(true);
                              }}
                                className="flex items-center gap-1.5 text-primary font-black text-[10px] uppercase tracking-widest hover:underline transition-all">
                                <Truck className="w-3.5 h-3.5" /> Yêu cầu cấp
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── Transfer Orders Sub-View ── */
            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <ClipboardList className="text-primary w-5 h-5" /> Danh sách Lệnh chuyển kho
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Các yêu cầu cấp vật tư gửi lên Tổng bộ HQ.</p>
                </div>
                <button
                  onClick={() => {
                    setRequestCart([]);
                    setSelectedItemIndex(-1);
                    setRequestQty(0);
                    setRequestNotes('');
                    setShowCreateRequest(true);
                  }}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 active:scale-95 transition-all shadow-lg"
                >
                  <ShoppingCart className="w-4 h-4" /> Tạo Yêu cầu mới
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      {['Mã yêu cầu','Ngày tạo','Chi tiết vật tư','Trạng thái','Vận chuyển','Hành động'].map(h => (
                        <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-16 text-center">
                          <RefreshCw className="w-6 h-6 mx-auto text-slate-400 animate-spin mb-2" />
                          <p className="text-slate-400 text-sm font-bold">Đang tải danh sách lệnh chuyển kho...</p>
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-semibold">
                          Không có lệnh chuyển kho nào.
                        </td>
                      </tr>
                    ) : orders.map(ord => (
                      <tr key={ord.id} className="hover:bg-slate-50/20 transition-all text-xs font-bold text-slate-600">
                        <td className="px-6 py-4">
                          <span className="font-mono font-black text-slate-800">{ord.order_number}</span>
                          {ord.notes && <p className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[120px]">{ord.notes}</p>}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(ord.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 max-w-[200px]">
                          <div className="space-y-1">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-md text-[10px]">
                                <span className="font-black text-slate-700 truncate pr-2 max-w-[110px]">{it.name}</span>
                                <span className="text-primary font-black whitespace-nowrap">x{it.qty} {it.unit}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider',
                            ord.status === 'pending' && 'bg-blue-50 text-blue-500',
                            ord.status === 'approved' && 'bg-indigo-50 text-indigo-500',
                            ord.status === 'shipped' && 'bg-amber-50 text-amber-500 animate-pulse',
                            ord.status === 'completed' && 'bg-emerald-50 text-emerald-500',
                            ord.status === 'cancelled' && 'bg-rose-50 text-rose-500'
                          )}>
                            {ord.status === 'pending' && 'Chờ duyệt'}
                            {ord.status === 'approved' && 'Đã duyệt'}
                            {ord.status === 'shipped' && 'Đang giao'}
                            {ord.status === 'completed' && 'Hoàn thành'}
                            {ord.status === 'cancelled' && 'Đã hủy'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px]">
                          {ord.shipping_carrier ? (
                            <div>
                              <p className="font-black text-slate-800">{ord.shipping_carrier}</p>
                              <p className="text-slate-400 font-mono mt-0.5">{ord.tracking_number}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {ord.status === 'pending' && (
                              <button onClick={() => handleCancelOrder(ord.id)}
                                className="text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-widest text-[9px] font-black">
                                Hủy đơn
                              </button>
                            )}
                            {ord.status === 'shipped' && (
                              <button onClick={() => handleConfirmReceipt(ord.id)}
                                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl transition-all shadow-md text-[9px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3" /> Đã Nhận
                              </button>
                            )}
                            {ord.status === 'completed' && (
                              <span className="text-emerald-500 flex items-center gap-0.5 text-[10px] font-black uppercase">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Thành công
                              </span>
                            )}
                            {ord.status === 'cancelled' && (
                              <span className="text-slate-400 italic text-[10px] font-medium">
                                {ord.rejection_reason || 'Đã hủy'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Logs / Info Panel (Right Column) ── */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <History className="text-primary w-5 h-5" /> Lịch sử Kho
              </h3>
            </div>

            {/* Month/Year dropdown filter */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lọc theo tháng</p>
              <div className="grid grid-cols-2 gap-2">
                <PremiumSelect 
                  value={String(logMonth)}
                  onChange={(val) => setLogMonth(Number(val))}
                  options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
                />
                <PremiumSelect 
                  value={String(logYear)}
                  onChange={(val) => setLogYear(Number(val))}
                  options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
                />
              </div>
              <p className="text-[9px] text-slate-400 font-medium text-right">{filteredLogs.length} giao dịch</p>
            </div>

            {/* Log list */}
            <div className="space-y-4 overflow-y-auto flex-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">Không có giao dịch trong khoảng này</p>
                </div>
              ) : filteredLogs.map(lg => (
                <div key={lg.id} className="flex gap-3 pb-4 border-b border-slate-50 last:border-0">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    lg.change_amount > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-primary')}>
                    {lg.change_amount > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-black text-slate-900 truncate pr-2">{lg.inventory_items?.name}</p>
                      <span className={cn('text-xs font-black whitespace-nowrap',
                        lg.change_amount > 0 ? 'text-emerald-500' : 'text-rose-500')}>
                        {lg.change_amount > 0 ? '+' : ''}{lg.change_amount}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {lg.reason === 'session_consumption' && 'Tiêu hao liệu trình'}
                      {lg.reason === 'restock' && 'Điều chỉnh cục bộ'}
                      {lg.reason === 'transfer_receipt' && 'Nhận từ Tổng bộ'}
                      {lg.reason === 'transfer_shipment' && 'Xuất chuyển kho'}
                      {lg.reason === 'initial' && 'Tồn kho ban đầu'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[190px]">{lg.notes || ''}</p>
                    <p className="text-[10px] text-slate-400">{new Date(lg.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Local Restock / Adjustment Modal ── */}
      <AnimatePresence>
        {restockTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setRestockTarget(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
              className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-slate-600">
                  <ArrowRightLeft className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Điều Chỉnh Tồn Kho</h3>
                <p className="text-slate-500 text-sm mt-1">{restockTarget.name}</p>
                <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 mt-4 text-[10px] text-amber-600 font-bold uppercase tracking-wider text-center">
                  ⚠️ Chỉ dùng để hiệu chỉnh hao hụt thực tế cục bộ.
                </div>
              </div>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                    Số lượng điều chỉnh tăng ({restockTarget.unit})
                  </label>
                  <input type="number"
                    value={restockAmt === 0 ? '' : restockAmt}
                    min={1}
                    placeholder="0"
                    onFocus={e => e.target.select()}
                    onChange={e => setRestockAmt(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-slate-50 rounded-2xl p-4 text-xl font-black text-center outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Tồn kho mới</span>
                  <span className="font-black text-emerald-500 text-lg">
                    {Number(restockTarget.stock_level) + restockAmt} {restockTarget.unit}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRestockTarget(null)}
                  className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
                <button onClick={handleRestock} disabled={submitting || restockAmt <= 0}
                  className="flex-[2] bg-slate-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create Supply Request Modal ── */}
      <AnimatePresence>
        {showCreateRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setShowCreateRequest(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
              className="bg-white w-full max-w-lg rounded-[3rem] p-10 relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Truck className="text-primary w-5 h-5" /> Yêu Cầu Cấp Vật Tư từ HQ
                </h3>
                <button onClick={() => setShowCreateRequest(false)} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {/* Cart Form */}
                <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thêm vật tư vào yêu cầu</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Chọn vật tư trong kho</label>
                      <PremiumSelect
                        value={String(selectedItemIndex)}
                        onChange={(val) => setSelectedItemIndex(Number(val))}
                        options={[
                          { value: '-1', label: '-- Chọn vật tư --' },
                          ...items.map((it, idx) => ({ value: String(idx), label: `${it.name} (${it.sku || 'Không mã SKU'})` }))
                        ]}
                      />
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-grow">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Số lượng yêu cầu</label>
                        <input
                          type="number"
                          value={requestQty === 0 ? '' : requestQty}
                          min={1}
                          placeholder="Số lượng"
                          onChange={e => setRequestQty(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full bg-white rounded-xl px-4 py-2.5 text-sm font-bold border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={addToCart}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> Danh sách cấp vật tư ({requestCart.length})
                  </h4>
                  {requestCart.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-2xl text-slate-400 text-xs font-semibold italic">
                      Chưa có vật tư nào được chọn.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {requestCart.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                          <div>
                            <p className="text-xs font-black text-slate-800">{c.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{c.sku || 'N/A'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-primary font-black text-sm">x{c.qty} {c.unit}</span>
                            <button onClick={() => removeFromCart(idx)} className="text-rose-500 hover:text-rose-700 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Ghi chú yêu cầu</label>
                  <textarea
                    rows={2}
                    value={requestNotes}
                    onChange={e => setRequestNotes(e.target.value)}
                    placeholder="VD: Cần gấp phục vụ khách hàng cuối tuần..."
                    className="w-full bg-slate-50 rounded-2xl p-4 text-xs font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100 flex-shrink-0">
                <button onClick={() => setShowCreateRequest(false)}
                  className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
                <button onClick={submitTransferOrder} disabled={submittingOrder || requestCart.length === 0}
                  className="flex-[2] bg-primary text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {submittingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Gửi yêu cầu cung ứng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Add New Item Modal ── */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setShowAdd(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
              className="bg-white w-full max-w-md rounded-[3rem] p-10 relative z-10 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900">Thêm Vật Tư Mới</h3>
                <button onClick={() => setShowAdd(false)} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4 mb-8">
                {[
                  { label: 'Tên vật tư *', key: 'name', type: 'text', placeholder: 'VD: Tinh dầu massage...' },
                  { label: 'Mã SKU', key: 'sku', type: 'text', placeholder: 'VD: OIL-LAV-001' },
                  { label: 'Đơn vị *', key: 'unit', type: 'text', placeholder: 'ml, g, cái, chai...' },
                  { label: 'Tồn kho ban đầu', key: 'stock_level', type: 'number', placeholder: '0' },
                  { label: 'Ngưỡng sắp hết', key: 'min_stock_level', type: 'number', placeholder: '10' },
                  { label: 'Đơn giá (VND)', key: 'price_per_unit', type: 'number', placeholder: '0' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      min={f.type === 'number' ? 0 : undefined}
                      value={f.type === 'number'
                        ? ((newItem as any)[f.key] === 0 ? '' : (newItem as any)[f.key])
                        : (newItem as any)[f.key]
                      }
                      onFocus={f.type === 'number' ? e => e.target.select() : undefined}
                      onChange={e => setNewItem(prev => ({
                        ...prev,
                        [f.key]: f.type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value
                      }))}
                      className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
                <button onClick={handleAddItem} disabled={submitting}
                  className="flex-[2] bg-primary text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Lưu Vật Tư
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
