'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getSupabase } from '@/lib/supabase-client';
import { getLocalDateString } from '@/lib/utils';
import {
  createInventoryRequest,
  getInventoryTransferOrders,
  confirmTransferReceipt,
  cancelTransferOrder,
  type InventoryTransferOrder,
} from '@/services/inventory-transfer-actions';
import {
  addInventoryItem,
  getMonthlyReconciliation,
  restockItem,
  saveMonthlyReconciliation,
} from '@/services/inventory-actions';

import type {
  ActiveInventoryTab,
  InventoryItem,
  InventoryLog,
  NewInventoryItem,
  ReconRow,
  RequestCartItem,
  StockFilter,
} from '../types';

const createBlankInventoryItem = (): NewInventoryItem => ({
  name: '',
  sku: '',
  unit: 'cái',
  stock_level: 0,
  min_stock_level: 10,
  price_per_unit: 0,
  category: '',
});

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

export function useInventoryPageState() {
  const [activeTab, setActiveTab] = useState<ActiveInventoryTab>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  const [orders, setOrders] = useState<InventoryTransferOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [requestCart, setRequestCart] = useState<RequestCartItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const [requestQty, setRequestQty] = useState(0);
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const now = new Date();
  const [logMonth, setLogMonth] = useState(now.getMonth());
  const [logYear, setLogYear] = useState(now.getFullYear());

  const dateFrom = `${logYear}-${String(logMonth + 1).padStart(2, '0')}-01`;
  const dateTo = getLocalDateString(new Date(logYear, logMonth + 1, 0));

  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null);
  const [restockAmt, setRestockAmt] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<NewInventoryItem>(createBlankInventoryItem);

  const [reconMonth, setReconMonth] = useState(now.getMonth());
  const [reconYear, setReconYear] = useState(now.getFullYear());
  const [reconRows, setReconRows] = useState<ReconRow[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconSaving, setReconSaving] = useState(false);

  const fetchData = useCallback(async () => {
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
          .limit(200),
      ]);

      if (itemsRes.error) throw new Error(`[inventory] items: ${itemsRes.error.message}`);
      if (logsRes.error) throw new Error(`[inventory] logs: ${logsRes.error.message}`);

      setItems(itemsRes.data || []);
      setLogs((logsRes.data || []) as InventoryLog[]);
    } catch (error) {
      console.error('[fetchData]', error);
      toast.error(getErrorMessage(error, 'Lỗi tải dữ liệu kho'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const fetched = await getInventoryTransferOrders();
      setOrders(fetched);
    } catch (error) {
      console.error('[fetchOrders]', error);
      toast.error(getErrorMessage(error, 'Lỗi tải danh sách yêu cầu cấp vật tư'));
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchReconciliation = useCallback(async () => {
    setReconLoading(true);
    try {
      const res = await getMonthlyReconciliation(reconYear, reconMonth + 1);
      if (!res.success) {
        toast.error(res.error || 'Lỗi tải báo cáo kiểm kê');
        setReconRows([]);
        return;
      }
      setReconRows(res.items.map(it => ({
        ...it,
        actual: '',
        notes: '',
      })));
    } catch (error) {
      console.error('[fetchReconciliation]', error);
      toast.error(getErrorMessage(error, 'Lỗi tải báo cáo kiểm kê'));
    } finally {
      setReconLoading(false);
    }
  }, [reconMonth, reconYear]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'requests') {
      const timer = window.setTimeout(() => {
        void fetchOrders();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, fetchOrders]);

  useEffect(() => {
    if (activeTab === 'reconciliation') {
      const timer = window.setTimeout(() => {
        void fetchReconciliation();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, fetchReconciliation]);

  const handleSaveReconciliation = useCallback(async () => {
    const entries = reconRows
      .filter(r => r.actual !== '' && r.actual !== null && r.actual !== undefined)
      .map(r => ({
        item_id: r.item_id,
        actual_stock: Number(r.actual),
        notes: r.notes || undefined,
      }));

    if (entries.length === 0) {
      toast.error('Vui lòng nhập tồn thực tế cho ít nhất 1 mặt hàng');
      return;
    }

    if (!confirm(`Bạn xác nhận lưu kết quả kiểm kê cho ${entries.length} mặt hàng (tháng ${reconMonth + 1}/${reconYear})?\nHệ thống sẽ điều chỉnh tồn kho về số thực tế và ghi log chênh lệch.`)) {
      return;
    }

    setReconSaving(true);
    try {
      const res = await saveMonthlyReconciliation(reconYear, reconMonth + 1, entries);
      if (res.success) {
        toast.success(`Đã lưu kiểm kê ${res.processed} mặt hàng`);
        if (res.error) toast.warning(res.error);
        await Promise.all([fetchData(), fetchReconciliation()]);
      } else {
        toast.error(res.error || 'Lỗi lưu kiểm kê');
        if (res.processed > 0) {
          await Promise.all([fetchData(), fetchReconciliation()]);
        }
      }
    } catch (error) {
      console.error('[handleSaveReconciliation]', error);
      toast.error(getErrorMessage(error, 'Lỗi hệ thống'));
    } finally {
      setReconSaving(false);
    }
  }, [fetchData, fetchReconciliation, reconMonth, reconRows, reconYear]);

  const updateReconRow = useCallback((idx: number, patch: Partial<ReconRow>) => {
    setReconRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

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

  const filteredLogs = useMemo(() =>
    logs.filter(lg => {
      const d = lg.created_at?.slice(0, 10);
      return Boolean(d && d >= dateFrom && d <= dateTo);
    }), [logs, dateFrom, dateTo]);

  const lowCount = useMemo(
    () => items.filter(it => Number(it.stock_level) <= Number(it.min_stock_level)).length,
    [items],
  );

  const handleRestock = async () => {
    if (!restockTarget || restockAmt <= 0) return;

    setSubmitting(true);
    try {
      const result = await restockItem(
        restockTarget.id,
        restockAmt,
        `Điều chỉnh kho: +${restockAmt} ${restockTarget.unit}`,
      );
      if (!result.success) throw new Error(result.error || 'Lỗi điều chỉnh kho');

      toast.success(`Đã cập nhật +${restockAmt} ${restockTarget.unit} cho mặt hàng ${restockTarget.name}`);
      setRestockTarget(null);
      setRestockAmt(0);
      await fetchData();
    } catch (error) {
      console.error('[handleRestock]', error);
      toast.error(getErrorMessage(error, 'Lỗi điều chỉnh kho'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.unit) {
      toast.error('Nhập tên và đơn vị');
      return;
    }

    setSubmitting(true);
    try {
      const result = await addInventoryItem(newItem);
      if (!result.success) throw new Error(result.error || 'Lỗi thêm vật tư');

      toast.success('Đã thêm vật tư mới');
      setShowAdd(false);
      setNewItem(createBlankInventoryItem());
      await fetchData();
    } catch (error) {
      console.error('[handleAddItem]', error);
      toast.error(getErrorMessage(error, 'Lỗi thêm vật tư'));
    } finally {
      setSubmitting(false);
    }
  };

  const addToCart = useCallback(() => {
    if (selectedItemIndex === -1 || requestQty <= 0) {
      toast.error('Vui lòng chọn vật tư và nhập số lượng hợp lệ');
      return;
    }
    const selectedItem = items[selectedItemIndex];
    if (!selectedItem) {
      toast.error('Không tìm thấy vật tư đã chọn');
      return;
    }

    const exists = requestCart.some(c => c.sku === selectedItem.sku && c.name === selectedItem.name);
    if (exists) {
      toast.error('Vật tư này đã có trong danh sách yêu cầu');
      return;
    }

    setRequestCart(prev => [...prev, {
      name: selectedItem.name,
      sku: selectedItem.sku || '',
      qty: requestQty,
      unit: selectedItem.unit,
    }]);

    setSelectedItemIndex(-1);
    setRequestQty(0);
  }, [items, requestCart, requestQty, selectedItemIndex]);

  const removeFromCart = useCallback((index: number) => {
    setRequestCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const submitTransferOrder = useCallback(async () => {
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
        await Promise.all([fetchOrders(), fetchData()]);
      } else {
        toast.error(res.error || 'Lỗi gửi yêu cầu');
      }
    } catch (error) {
      console.error('[submitTransferOrder]', error);
      toast.error(getErrorMessage(error, 'Lỗi hệ thống'));
    } finally {
      setSubmittingOrder(false);
    }
  }, [fetchData, fetchOrders, requestCart, requestNotes]);

  const handleConfirmReceipt = useCallback(async (orderId: string) => {
    if (!confirm('Bạn có chắc chắn xác nhận đã nhận đủ hàng và cộng kho vật tư?')) return;
    try {
      const res = await confirmTransferReceipt(orderId);
      if (res.success) {
        toast.success('Xác nhận nhận hàng thành công. Tồn kho đã được cập nhật và ghi log!');
        await Promise.all([fetchOrders(), fetchData()]);
      } else {
        toast.error(res.error || 'Lỗi xác nhận nhận hàng');
      }
    } catch (error) {
      console.error('[handleConfirmReceipt]', error);
      toast.error(getErrorMessage(error, 'Lỗi hệ thống'));
    }
  }, [fetchData, fetchOrders]);

  const handleCancelOrder = useCallback(async (orderId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy yêu cầu cấp vật tư này?')) return;
    try {
      const res = await cancelTransferOrder(orderId, 'Chi nhánh chủ động hủy yêu cầu');
      if (res.success) {
        toast.success('Đã hủy yêu cầu cấp vật tư');
        await fetchOrders();
      } else {
        toast.error(res.error || 'Lỗi hủy yêu cầu');
      }
    } catch (error) {
      console.error('[handleCancelOrder]', error);
      toast.error(getErrorMessage(error, 'Lỗi hệ thống'));
    }
  }, [fetchOrders]);

  return {
    activeTab,
    setActiveTab,
    items,
    loading,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    orders,
    loadingOrders,
    showCreateRequest,
    setShowCreateRequest,
    requestCart,
    setRequestCart,
    selectedItemIndex,
    setSelectedItemIndex,
    requestQty,
    setRequestQty,
    requestNotes,
    setRequestNotes,
    submittingOrder,
    logMonth,
    setLogMonth,
    logYear,
    setLogYear,
    restockTarget,
    setRestockTarget,
    restockAmt,
    setRestockAmt,
    submitting,
    showAdd,
    setShowAdd,
    newItem,
    setNewItem,
    reconMonth,
    setReconMonth,
    reconYear,
    setReconYear,
    reconRows,
    reconLoading,
    reconSaving,
    filteredItems,
    filteredLogs,
    lowCount,
    handleSaveReconciliation,
    updateReconRow,
    handleRestock,
    handleAddItem,
    addToCart,
    removeFromCart,
    submitTransferOrder,
    handleConfirmReceipt,
    handleCancelOrder,
  };
}
