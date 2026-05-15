'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, AlertTriangle, PlusCircle, History,
  TrendingDown, TrendingUp, RefreshCw, Search,
  ArrowRightLeft, X, ShieldCheck
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase-client';
import { restockItem, addInventoryItem } from '@/services/inventory-actions';
import { toast } from 'sonner';
import { formatNumberWithSeparator } from '@/lib/utils';
import { cn } from '@/lib/utils';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

export default function InventoryPage() {
  const [items,    setItems]    = useState<any[]>([]);
  const [logs,     setLogs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [stockFilter, setStockFilter] = useState<'all'|'low'|'ok'>('all');

  // Month/Year dropdowns for log history
  const now = new Date();
  const [logMonth, setLogMonth] = useState(now.getMonth()); // 0-based
  const [logYear,  setLogYear]  = useState(now.getFullYear());

  // Derived date range
  const dateFrom = `${logYear}-${String(logMonth + 1).padStart(2,'0')}-01`;
  const dateTo   = new Date(logYear, logMonth + 1, 0).toISOString().slice(0, 10);

  // Restock modal
  const [restockTarget, setRestockTarget] = useState<any>(null);
  const [restockAmt,    setRestockAmt]    = useState(0);
  const [submitting,    setSubmitting]    = useState(false);

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
      // Direct browser client queries — Public Select: true, no auth needed
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

  useEffect(() => { fetchData(); }, []);

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
      const res = await restockItem(restockTarget.id, restockAmt);
      if (res.success) {
        toast.success(`Đã nhập ${restockAmt} ${restockTarget.unit} — ${restockTarget.name}`);
        setRestockTarget(null); setRestockAmt(0); fetchData();
      } else toast.error(res.error || 'Lỗi nhập kho');
    } finally { setSubmitting(false); }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.unit) { toast.error('Nhập tên và đơn vị'); return; }
    setSubmitting(true);
    try {
      const res = await addInventoryItem(newItem);
      if (res.success) {
        toast.success('Đã thêm vật tư mới');
        setShowAdd(false);
        setNewItem({ name:'', sku:'', unit:'cái', stock_level:0, min_stock_level:10, price_per_unit:0, category:'' });
        fetchData();
      } else toast.error(res.error || 'Lỗi thêm vật tư');
    } finally { setSubmitting(false); }
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
          <p className="text-slate-500 text-sm font-medium">Theo dõi tiêu hao vật tư và dự báo nhập hàng tự động.</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">

        {/* ── Inventory list ── */}
        <div className="xl:col-span-2">
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
                  <select value={stockFilter} onChange={e => setStockFilter(e.target.value as any)}
                    className="bg-slate-50 border-0 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                    <option value="all">Tất cả ({items.length})</option>
                    <option value="low">⚠️ Sắp hết ({lowCount})</option>
                    <option value="ok">✅ Còn hàng ({items.length - lowCount})</option>
                  </select>
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
                          <button onClick={() => { setRestockTarget(item); setRestockAmt(0); }}
                            className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest hover:underline">
                            <ArrowRightLeft className="w-4 h-4" /> Nhập hàng
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

        {/* ── Logs panel ── */}
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
                <select value={logMonth} onChange={e => setLogMonth(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20">
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select value={logYear} onChange={e => setLogYear(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
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
                      {lg.reason === 'session_consumption' ? 'Tiêu hao liệu trình' : 'Nhập kho bổ sung'}
                    </p>
                    <p className="text-[10px] text-slate-400">{new Date(lg.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Restock Modal ── */}
      <AnimatePresence>
        {restockTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setRestockTarget(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
              className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Nhập Kho Vật Tư</h3>
                <p className="text-slate-500 text-sm mt-1">{restockTarget.name}</p>
              </div>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                    Số lượng nhập ({restockTarget.unit})
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
                  <span className="text-[10px] font-black text-slate-400 uppercase">Sau khi nhập</span>
                  <span className="font-black text-emerald-500 text-lg">
                    {Number(restockTarget.stock_level) + restockAmt} {restockTarget.unit}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRestockTarget(null)}
                  className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
                <button onClick={handleRestock} disabled={submitting || restockAmt <= 0}
                  className="flex-[2] bg-primary text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Xác nhận nhập
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Add Item Modal ── */}
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
