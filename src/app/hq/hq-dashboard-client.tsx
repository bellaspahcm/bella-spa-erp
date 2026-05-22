'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, 
  DollarSign, 
  Activity, 
  MessageSquare, 
  Search, 
  Users, 
  MapPin, 
  Phone, 
  Lock, 
  Unlock, 
  RefreshCw, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent,
  CreditCard,
  CheckCircle2,
  X,
  Edit,
  Settings,
  AlertCircle,
  Calendar,
  ArrowLeftRight,
  Truck,
  Ban
} from 'lucide-react';
import { toggleTenantStatus, getHqDashboardStats, getAllTenants } from '@/services/hq-actions';
import { 
  getFranchiseRoyaltyInvoices, 
  updateFranchiseRoyaltyConfig, 
  payFranchiseRoyaltyInvoice,
  FranchiseRoyaltyInvoice
} from '@/services/franchise-actions';
import {
  getInterBranchClearingRecords,
  clearInterBranchRecord,
  updateTenantClearingRate,
  InterBranchClearingRecord
} from '@/services/clearing-actions';
import {
  getInventoryTransferOrders,
  approveAndShipTransfer,
  cancelTransferOrder,
  InventoryTransferOrder,
  TransferOrderItem
} from '@/services/inventory-transfer-actions';
import { createClient } from '@/lib/supabase-client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { HqDashboardStats, HqTenantRecord, CurrentUser } from '@/types/domain';

interface HqDashboardClientProps {
  initialStats: HqDashboardStats;
  initialTenants: HqTenantRecord[];
  currentUser: CurrentUser;
}

export default function HqDashboardClient({ 
  initialStats, 
  initialTenants, 
  currentUser 
}: HqDashboardClientProps) {
  const [stats, setStats] = useState<HqDashboardStats>(initialStats);
  const [tenants, setTenants] = useState<HqTenantRecord[]>(initialTenants);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Tab System
  const [activeTab, setActiveTab] = useState<'branches' | 'franchise' | 'clearing' | 'transfers'>('branches');
  
  // Inventory Transfer States
  const [transferOrders, setTransferOrders] = useState<InventoryTransferOrder[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransferOrder | null>(null);
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [refusingReason, setRefusingReason] = useState('');
  const [submittingTransferAction, setSubmittingTransferAction] = useState(false);
  const [transferFilterStatus, setTransferFilterStatus] = useState<'all' | 'pending' | 'shipped' | 'completed' | 'cancelled'>('all');
  const [transferFilterBranch, setTransferFilterBranch] = useState('all');
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // Franchise States
  const [invoices, setInvoices] = useState<FranchiseRoyaltyInvoice[]>([]);
  const [loadingRoyalty, setLoadingRoyalty] = useState(false);
  const [editingTenant, setEditingTenant] = useState<HqTenantRecord | null>(null);
  
  // Agreement Config Form States
  const [royaltyType, setRoyaltyType] = useState<'fixed' | 'percentage'>('percentage');
  const [royaltyRate, setRoyaltyRate] = useState<string>('0');
  const [royaltyFixedAmount, setRoyaltyFixedAmount] = useState<string>('0');
  const [submittingConfig, setSubmittingConfig] = useState(false);

  // Inter-branch Clearing States
  const [clearingRecords, setClearingRecords] = useState<InterBranchClearingRecord[]>([]);
  const [loadingClearing, setLoadingClearing] = useState(false);
  const [editingClearingRateTenant, setEditingClearingRateTenant] = useState<HqTenantRecord | null>(null);
  const [newClearingRate, setNewClearingRate] = useState<string>('150000');
  const [submittingClearingRate, setSubmittingClearingRate] = useState(false);

  // Sync data manually
  const refreshData = async () => {
    setLoading(true);
    try {
      const freshStats = await getHqDashboardStats() as HqDashboardStats;
      const freshTenants = await getAllTenants() as unknown as HqTenantRecord[];
      setStats(freshStats);
      setTenants(freshTenants);
      
      if (activeTab === 'franchise') {
        await loadRoyaltyData();
      } else if (activeTab === 'clearing') {
        await loadClearingData();
      } else if (activeTab === 'transfers') {
        await loadTransferData();
      }
      
      toast.success('Đồng bộ dữ liệu Bella HQ thành công!');
    } catch (err) {
      const errorObj = err as Error;
      toast.error('Lỗi khi tải lại dữ liệu: ' + errorObj.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRoyaltyData = async () => {
    setLoadingRoyalty(true);
    try {
      const data = await getFranchiseRoyaltyInvoices();
      setInvoices(data);
    } catch (err: any) {
      toast.error('Không thể tải hóa đơn nhượng quyền: ' + err.message);
    } finally {
      setLoadingRoyalty(false);
    }
  };

  const loadClearingData = async () => {
    setLoadingClearing(true);
    try {
      const data = await getInterBranchClearingRecords();
      setClearingRecords(data);
    } catch (err: any) {
      toast.error('Không thể tải đối soát liên chi nhánh: ' + err.message);
    } finally {
      setLoadingClearing(false);
    }
  };

  const loadTransferData = async () => {
    setLoadingTransfers(true);
    try {
      const data = await getInventoryTransferOrders();
      setTransferOrders(data);
    } catch (err: any) {
      toast.error('Không thể tải danh sách chuyển kho: ' + err.message);
    } finally {
      setLoadingTransfers(false);
    }
  };

  const handleOpenShipModal = (order: InventoryTransferOrder) => {
    setSelectedTransfer(order);
    setShippingCarrier('Giao Hàng Nhanh (GHN)');
    setTrackingNumber('');
    setShowShipModal(true);
  };

  const handleOpenCancelModal = (order: InventoryTransferOrder) => {
    setSelectedTransfer(order);
    setRefusingReason('');
    setShowCancelModal(true);
  };

  const handleApproveAndShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    if (!shippingCarrier.trim() || !trackingNumber.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin đơn vị vận chuyển và mã vận đơn');
      return;
    }

    setSubmittingTransferAction(true);
    try {
      const res = await approveAndShipTransfer(selectedTransfer.id, shippingCarrier, trackingNumber);
      if (res.success) {
        toast.success(`Đã duyệt và giao hàng thành công đơn ${selectedTransfer.order_number}!`);
        setShowShipModal(false);
        setSelectedTransfer(null);
        await loadTransferData();
      } else {
        toast.error(res.error || 'Duyệt giao hàng thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmittingTransferAction(false);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    setSubmittingTransferAction(true);
    try {
      const res = await cancelTransferOrder(selectedTransfer.id, refusingReason || 'Tổng bộ từ chối cấp hàng');
      if (res.success) {
        toast.success(`Đã từ chối cấp hàng cho đơn ${selectedTransfer.order_number}`);
        setShowCancelModal(false);
        setSelectedTransfer(null);
        await loadTransferData();
      } else {
        toast.error(res.error || 'Từ chối cấp hàng thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmittingTransferAction(false);
    }
  };

  const handleClearRecord = async (recordId: string, clearingNumber: string) => {
    if (!window.confirm(`Xác nhận GẠCH NỢ nội bộ cho đối soát ${clearingNumber}? Hành động này sẽ chuyển trạng thái sang Đã thanh toán.`)) return;
    try {
      const res = await clearInterBranchRecord(recordId, 'HQ Manual');
      if (res.success) {
        toast.success(`Đã gạch nợ đối soát ${clearingNumber} thành công!`);
        await loadClearingData();
      } else {
        toast.error(res.error || 'Thao tác gạch nợ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    }
  };

  const handleOpenClearingRate = (tenant: HqTenantRecord) => {
    setEditingClearingRateTenant(tenant);
    setNewClearingRate(String(tenant.internal_clearing_rate ?? 150000));
  };

  const handleSaveClearingRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClearingRateTenant) return;
    setSubmittingClearingRate(true);
    try {
      const rateNum = parseFloat(newClearingRate) || 0;
      const res = await updateTenantClearingRate(editingClearingRateTenant.id, rateNum);
      if (res.success) {
        toast.success(`Đã cấu hình đơn giá đối soát bù trừ nội bộ cho ${editingClearingRateTenant.name}!`);
        setEditingClearingRateTenant(null);
        const freshTenants = await getAllTenants() as unknown as HqTenantRecord[];
        setTenants(freshTenants);
      } else {
        toast.error(res.error || 'Cập nhật thất bại.');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmittingClearingRate(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'franchise') {
      loadRoyaltyData();
    } else if (activeTab === 'clearing') {
      loadClearingData();
    } else if (activeTab === 'transfers') {
      loadTransferData();
    }
  }, [activeTab]);

  const handleToggleStatus = async (tenantId: string, currentStatus: 'active' | 'suspended') => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMsg = newStatus === 'suspended' 
      ? 'Bạn có chắc chắn muốn TẠM NGƯNG chi nhánh này? Toàn bộ nhân sự và KTV của chi nhánh sẽ bị chặn truy cập ngay lập tức!'
      : 'Kích hoạt lại chi nhánh này để cho phép truy cập hoạt động bình thường?';

    if (!window.confirm(confirmMsg)) return;

    setUpdatingId(tenantId);
    try {
      const res = await toggleTenantStatus(tenantId, newStatus);
      if (res.success) {
        toast.success(newStatus === 'suspended' ? 'Đã khóa chi nhánh thành công!' : 'Đã mở khóa chi nhánh thành công!');
        
        // Update local state instantly
        setTenants(prev => prev.map(t => 
          t.id === tenantId ? { ...t, status: newStatus } : t
        ));
        
        // Refresh full stats
        const freshStats = await getHqDashboardStats() as HqDashboardStats;
        setStats(freshStats);
      } else {
        toast.error(res.error || 'Thao tác thất bại');
      }
    } catch (err) {
      const errorObj = err as Error;
      toast.error('Có lỗi xảy ra: ' + errorObj.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenConfig = (tenant: HqTenantRecord) => {
    setEditingTenant(tenant);
    setRoyaltyType(tenant.royalty_type || 'percentage');
    setRoyaltyRate(String(tenant.royalty_rate ?? 0));
    setRoyaltyFixedAmount(String(tenant.royalty_fixed_amount ?? 0));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    
    setSubmittingConfig(true);
    try {
      const rateNum = parseFloat(royaltyRate) || 0;
      const amountNum = parseFloat(royaltyFixedAmount) || 0;
      
      const res = await updateFranchiseRoyaltyConfig(
        editingTenant.id,
        royaltyType,
        rateNum,
        amountNum
      );
      
      if (res.success) {
        toast.success(`Đã cấu hình chính sách phí nhượng quyền cho ${editingTenant.name}!`);
        setEditingTenant(null);
        
        // Refresh local tenants data
        const freshTenants = await getAllTenants() as unknown as HqTenantRecord[];
        setTenants(freshTenants);
      } else {
        toast.error(res.error || 'Cập nhật chính sách thất bại.');
      }
    } catch (err: any) {
      toast.error('Lỗi lưu cấu hình: ' + err.message);
    } finally {
      setSubmittingConfig(false);
    }
  };

  const handleReconcileInvoice = async (invoiceNumber: string) => {
    if (!window.confirm(`Xác nhận DUYỆT THANH TOÁN (đối soát tiền mặt/chuyển khoản thủ công) cho hóa đơn nhượng quyền ${invoiceNumber}?`)) return;
    
    setLoadingRoyalty(true);
    try {
      const res = await payFranchiseRoyaltyInvoice(invoiceNumber, 'HQ Reconciled');
      if (res.success) {
        toast.success(`Hóa đơn ${invoiceNumber} đã được gạch nợ thành công!`);
        await loadRoyaltyData();
      } else {
        toast.error(res.error || 'Gạch nợ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi đối soát: ' + err.message);
    } finally {
      setLoadingRoyalty(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Đăng xuất thành công');
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = '/login';
    }
  };

  // Filtered tenants (excluding Headquarter itself)
  const filteredTenants = tenants.filter(t => {
    if (t.name === 'Bella Spa Headquarter') return false;
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (t.contact_phone && t.contact_phone.includes(searchTerm)) ||
                        (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate dynamic stats for SVG growth chart
  const maxGrowth = Math.max(...(stats.spaGrowthData || []).map((d) => d.spas), 1);

  // Franchise Billing aggregates
  const totalProjectedFees = invoices.reduce((acc, inv) => acc + Number(inv.calculated_amount), 0);
  const totalCollectedFees = invoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + Number(inv.calculated_amount), 0);
  const totalOutstandingFees = invoices.filter(inv => inv.status === 'pending').reduce((acc, inv) => acc + Number(inv.calculated_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans antialiased text-slate-800">
      {/* Super Top Premium Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 border-b border-slate-100 px-6 py-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="drop-shadow-lg"
          >
            <img src="/logo.png" alt="Bella Spa Logo" className="h-10 w-auto object-contain" />
          </motion.div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-wider uppercase flex items-center gap-1.5">
              Bella Spa Headquarter 
              <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">HQ Portal</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hệ thống Quản trị Cấp cao</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Active Admin Profile */}
          <div className="flex items-center gap-3 bg-white/90 border border-slate-100 rounded-full py-1.5 pl-3 pr-4 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center font-black text-xs text-primary">
              {currentUser.full_name?.charAt(0) || 'A'}
            </div>
            <div className="text-left leading-none">
              <p className="text-[11px] font-black text-slate-800">{currentUser.full_name || 'Super Admin'}</p>
              <span className="text-[8px] font-black text-primary uppercase tracking-widest">Cấp cao</span>
            </div>
          </div>

          {/* Regular Dashboard Redirect */}
          <a 
            href="/dashboard"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ExternalLink size={12} />
            Hồ sơ Spa Trụ sở
          </a>

          {/* Sync Button */}
          <button
            onClick={refreshData}
            disabled={loading}
            className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-primary transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            title="Đồng bộ lại"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-primary' : ''} />
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-all active:scale-95 shadow-sm"
            title="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Welcome Section */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-xl shadow-slate-200/50 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="bg-primary/20 text-rose-300 border border-primary/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block animate-pulse">
              HỆ THỐNG ĐIỀU HÀNH HOẠT ĐỘNG TOÀN SÀN
            </span>
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-none text-white">
              Xin chào, {currentUser.full_name || 'Super Admin'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              Chào mừng bạn đến với Tổng bộ Quản trị Cấp cao Bella HQ. Nơi bạn giám sát doanh số, cấu hình thỏa thuận tài chính nhượng quyền thương mại (franchise), duyệt đối soát royalty, và quản trị an toàn bảo mật toàn sàn.
            </p>
          </div>
        </section>

        {/* Tab Selection Navigation */}
        <div className="flex justify-center">
          <div className="flex bg-white/95 border border-slate-100 backdrop-blur-md rounded-3xl p-1.5 shadow-sm max-w-3xl w-full relative overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('branches')}
              className={`flex-1 py-3 px-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'branches'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Chi nhánh Spa
            </button>
            <button
              onClick={() => setActiveTab('franchise')}
              className={`flex-1 py-3 px-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'franchise'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Nhượng quyền & Royalty
            </button>
            <button
              onClick={() => setActiveTab('clearing')}
              className={`flex-1 py-3 px-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'clearing'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Bù trừ liên chi nhánh
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`flex-1 py-3 px-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'transfers'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Cung ứng & Chuyển kho
            </button>
          </div>
        </div>

        {activeTab === 'branches' ? (
          <>
            {/* 4 Cards KPI Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* SPA Count */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  <Store size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Số chi nhánh Spa</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.totalSpas} Spa</h3>
                  <p className="text-[10px] text-slate-500 font-bold">
                    <span className="text-emerald-600 font-black">{stats.activeSpas} Hoạt động</span> | <span>{stats.suspendedSpas} Khóa</span>
                  </p>
                </div>
              </div>

              {/* System Revenue */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <DollarSign size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Doanh thu toàn sàn</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{formatCurrency(stats.totalRevenue)}</h3>
                  <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <span className="text-emerald-600 font-black">100% Thực thu đối soát</span>
                  </p>
                </div>
              </div>

              {/* System Total Treatment sessions */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Activity size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng ca liệu trình</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.totalSessions} Ca</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Lưu lượng liệu trình thực tế</p>
                </div>
              </div>

              {/* Zalo SMS usage */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <MessageSquare size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Zalo SMS tiêu thụ</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.zaloSmsUsed} Tin</h3>
                  <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <span className="text-blue-600 font-black">ZNS Smart Reminders</span>
                  </p>
                </div>
              </div>
            </section>

            {/* Growth visualization (SVG chart) & Quick System Integrity Status */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Spa Growth Chart */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">
                    Xu hướng phát triển chi nhánh
                  </h4>
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-emerald-500" />
                    +Tăng trưởng hữu cơ
                  </span>
                </div>

                {/* Premium Custom SVG Bar Chart */}
                <div className="h-64 flex items-end justify-between gap-4 pt-6 px-4">
                  {(stats.spaGrowthData || []).map((data, idx) => {
                    const percentage = (data.spas / maxGrowth) * 80 + 20; // safe scale
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                        <div className="relative w-full flex justify-center items-end h-full">
                          {/* Tooltip on hover */}
                          <div className="absolute top-[-30px] opacity-0 group-hover:opacity-100 bg-slate-900 text-white font-black text-[9px] px-2 py-1 rounded-lg transition-all scale-95 group-hover:scale-100 z-10 uppercase tracking-widest">
                            {data.spas} Spa
                          </div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                            className={`w-full max-w-[40px] rounded-t-xl transition-all ${
                              idx === (stats.spaGrowthData || []).length - 1 
                                ? 'bg-gradient-to-t from-primary to-secondary shadow-lg shadow-pink-200' 
                                : 'bg-slate-100 group-hover:bg-indigo-50'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center truncate w-full">
                          {data.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick System Integrity Status */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 text-left">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Sức khỏe hệ thống toàn sàn
                </h4>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                    <div>
                      <h5 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">Cơ sở dữ liệu</h5>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">Supabase PostgreSQL 15</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black rounded-full uppercase">Tốt</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                    <div>
                      <h5 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">Zalo OA Gateway</h5>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">ZNS API & Access Token Auto-Refresh</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black rounded-full uppercase">Kết nối</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                    <div>
                      <h5 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">VietQR Webhook Gateway</h5>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">Tự động đối soát biến động số dư</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black rounded-full uppercase">Sẵn sàng</span>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-slate-400 font-bold italic text-center">
                    * Toàn bộ hệ thống chạy trên nền tảng Serverless Next.js.
                  </p>
                </div>
              </div>
            </section>

            {/* Filters and Search Area */}
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-left">
              <div className="relative w-full md:max-w-md group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                  placeholder="Tìm kiếm theo Tên Spa, hotline, email..."
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {([
                  { label: 'Tất cả chi nhánh', value: 'all' },
                  { label: 'Đang hoạt động', value: 'active' },
                  { label: 'Tạm khóa', value: 'suspended' }
                ] as const).map((btn) => (
                  <button
                    key={btn.value}
                    onClick={() => setStatusFilter(btn.value)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shrink-0 transition-all active:scale-95 cursor-pointer ${
                      statusFilter === btn.value
                        ? 'bg-primary text-white shadow-lg shadow-pink-100'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/50'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Tenant branches list Table */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Danh sách chi nhánh Spa Hệ thống ({filteredTenants.length})
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase">
                  Hệ thống Multi-Tenant
                </span>
              </div>

              <div className="overflow-x-auto">
                {filteredTenants.length === 0 ? (
                  <div className="p-12 text-center">
                    <span className="text-3xl mb-3 block">🏢</span>
                    <p className="text-slate-400 font-bold text-sm italic">Không tìm thấy chi nhánh nào phù hợp</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Tên chi nhánh Spa</th>
                        <th scope="col" className="px-6 py-5">Liên hệ & Địa chỉ</th>
                        <th scope="col" className="px-6 py-5 text-center">Nhân sự</th>
                        <th scope="col" className="px-6 py-5 text-center">Khách hàng</th>
                        <th scope="col" className="px-6 py-5 text-right">Doanh thu chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredTenants.map((t) => {
                        const isHeadquarter = t.name === 'Bella Spa Headquarter';
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* Spa Name & Logo Initial */}
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 ${
                                  isHeadquarter 
                                    ? 'bg-indigo-950 text-white' 
                                    : 'bg-rose-50 text-primary border border-rose-100'
                                }`}>
                                  {t.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-black text-slate-900 truncate max-w-[200px] flex items-center gap-1.5">
                                    {t.name}
                                    {isHeadquarter && (
                                      <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">HQ</span>
                                    )}
                                  </h5>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                    Ngày tham gia: {t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Contact & Address */}
                            <td className="px-6 py-5">
                              <div className="space-y-1 text-xs">
                                <p className="flex items-center gap-1.5 text-slate-600 truncate max-w-[220px]">
                                  <MapPin size={12} className="text-slate-400 shrink-0" />
                                  <span>{t.address || 'Chưa cập nhật'}</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-slate-500 font-bold">
                                  <Phone size={12} className="text-slate-400 shrink-0" />
                                  <span>{t.contact_phone || 'Chưa cập nhật'}</span>
                                </p>
                              </div>
                            </td>

                            {/* Staff count */}
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {t.staffCount}
                            </td>

                            {/* Customer count */}
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {t.customerCount}
                            </td>

                            {/* Branch Revenue */}
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(t.revenueSum)}
                            </td>

                            {/* Status Badge */}
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                t.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {t.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                              </span>
                            </td>

                            {/* Toggle Suspend Action */}
                            <td className="px-8 py-5 text-right">
                              {isHeadquarter ? (
                                <span className="text-[10px] text-slate-400 font-bold italic">Không thể khóa</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(t.id, t.status === 'suspended' ? 'suspended' : 'active')}
                                  disabled={updatingId === t.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                                    t.status === 'active'
                                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/50'
                                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100/50'
                                  }`}
                                >
                                  {updatingId === t.id ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : t.status === 'active' ? (
                                    <>
                                      <Lock size={12} />
                                      Khóa
                                    </>
                                  ) : (
                                    <>
                                      <Unlock size={12} />
                                      Mở khóa
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        ) : activeTab === 'franchise' ? (
          /* FRANCHISE AGREEMENT & ROYALTY LEDGER TAB */
          <div className="space-y-8">
            {/* Franchise Premium Quick Stats Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Projected royalty fee */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <DollarSign size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dự thu Royalty (Cộng dồn)</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{formatCurrency(totalProjectedFees)}</h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Tổng hóa đơn phát sinh</span>
                </div>
              </div>

              {/* Collected royalty fee */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 size={26} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã thu về HQ</p>
                  <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">{formatCurrency(totalCollectedFees)}</h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Doanh thu đã đối soát gạch nợ</span>
                </div>
              </div>

              {/* Outstanding royalty fee */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={26} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Còn nợ chờ thu</p>
                  <h3 className="text-2xl font-black text-amber-600 leading-none mb-1">{formatCurrency(totalOutstandingFees)}</h3>
                  <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Hóa đơn chưa thanh toán</span>
                </div>
              </div>
            </section>

            {/* Franchise Branch configuration ledger */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Cấu hình chính sách thu phí nhượng quyền ({tenants.filter(t => t.name !== 'Bella Spa Headquarter').length})
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase flex items-center gap-1">
                  <Settings size={10} /> Thỏa thuận kinh doanh
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th scope="col" className="px-8 py-5">Chi nhánh</th>
                      <th scope="col" className="px-6 py-5">Phương thức tính phí</th>
                      <th scope="col" className="px-6 py-5 text-right">Phí cố định hàng tháng</th>
                      <th scope="col" className="px-6 py-5 text-center">Tỷ lệ trích % doanh thu</th>
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
                          <td className="px-6 py-5">
                            {t.royalty_type === 'fixed' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                                <CreditCard size={10} /> Cố định hàng tháng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-primary text-[9px] font-black uppercase tracking-wider border border-rose-100">
                                <Percent size={10} /> Trích % Doanh thu
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-900">
                            {t.royalty_fixed_amount ? formatCurrency(t.royalty_fixed_amount) : '0đ'}
                          </td>
                          <td className="px-6 py-5 text-center font-black text-primary">
                            {t.royalty_rate ? `${t.royalty_rate}%` : '0%'}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button
                              onClick={() => handleOpenConfig(t)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <Edit size={12} />
                              Cấu hình
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Royalty Invoices Ledger */}
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

              {loadingRoyalty ? (
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
                                  onClick={() => handleReconcileInvoice(inv.invoice_number)}
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
          </div>
        ) : activeTab === 'clearing' ? (
          /* INTER-BRANCH CLEARING TAB */
          <div className="space-y-8 text-left">
            {/* Quick Stats for Clearing */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Total projected transfer fees */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <ArrowLeftRight size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng bù trừ liên chi nhánh</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {formatCurrency(clearingRecords.reduce((acc, r) => acc + Number(r.calculated_amount), 0))}
                  </h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    {clearingRecords.length} Giao dịch công nợ
                  </span>
                </div>
              </div>

              {/* Settled fees */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 size={26} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã gạch nợ bù trừ</p>
                  <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
                    {formatCurrency(clearingRecords.filter(r => r.status === 'cleared').reduce((acc, r) => acc + Number(r.calculated_amount), 0))}
                  </h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Đã thanh lý công nợ nội bộ
                  </span>
                </div>
              </div>

              {/* Pending fees */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={26} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dư nợ đang chờ</p>
                  <h3 className="text-2xl font-black text-amber-600 leading-none mb-1">
                    {formatCurrency(clearingRecords.filter(r => r.status === 'pending').reduce((acc, r) => acc + Number(r.calculated_amount), 0))}
                  </h3>
                  <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Đang đợi chi nhánh thanh toán
                  </span>
                </div>
              </div>
            </section>

            {/* Clearing configuration ledger */}
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
                              onClick={() => handleOpenClearingRate(t)}
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

            {/* Inter-branch Clearing Records Ledger */}
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

              {loadingClearing ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang đồng bộ hóa đơn bù trừ...</p>
                </div>
              ) : clearingRecords.length === 0 ? (
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
                      {clearingRecords.map((rec) => {
                        const monthDate = new Date(rec.month_year);
                        const formattedMonth = `Tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900 font-mono tracking-tight text-xs animate-fade-in">
                              {rec.clearing_number}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {rec.debtor_tenants?.name || 'Chi nhánh A'}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {rec.creditor_tenants?.name || 'Chi nhánh B'}
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
                              {formatCurrency(rec.internal_clearing_rate)}
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
                                  onClick={() => handleClearRecord(rec.id, rec.clearing_number)}
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
          </div>
        ) : (
          /* CUNG ỨNG & CHUYỂN KHO (TRANSFERS) TAB */
          <div className="space-y-8 text-left">
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
                    {transferOrders.length} Lệnh
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
                    {transferOrders.filter(o => o.status === 'pending').length} Yêu cầu
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
                    {transferOrders.filter(o => o.status === 'shipped').length} Đơn
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
                    {transferOrders.filter(o => o.status === 'completed').length} Đơn
                  </h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Cập nhật kho thành công
                  </span>
                </div>
              </div>
            </section>

            {/* Filters and Search for Transfers */}
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-4 w-full md:max-w-xl">
                {/* Status Filter */}
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái đơn</label>
                  <select
                    value={transferFilterStatus}
                    onChange={(e) => setTransferFilterStatus(e.target.value as any)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Chờ duyệt cấp hàng</option>
                    <option value="shipped">Đang vận chuyển</option>
                    <option value="completed">Đã nhận hàng (Hoàn tất)</option>
                    <option value="cancelled">Đã từ chối / Hủy đơn</option>
                  </select>
                </div>

                {/* Branch Filter */}
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chi nhánh yêu cầu</label>
                  <select
                    value={transferFilterBranch}
                    onChange={(e) => setTransferFilterBranch(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả chi nhánh</option>
                    {tenants
                      .filter(t => t.name !== 'Bella Spa Headquarter')
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-black uppercase tracking-wider">
                Tổng bộ điều phối kho vận
              </span>
            </section>

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

              {loadingTransfers ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang tải danh sách lệnh chuyển kho...</p>
                </div>
              ) : transferOrders.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">📦</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có lệnh chuyển kho nào được tạo.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Các chi nhánh có thể gửi yêu cầu xin cấp vật tư từ Tổng bộ trực tiếp từ trang quản lý kho của họ.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
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
                      {transferOrders
                        .filter(rec => {
                          const matchStatus = transferFilterStatus === 'all' || rec.status === transferFilterStatus;
                          const matchBranch = transferFilterBranch === 'all' || rec.tenant_id === transferFilterBranch;
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
                                {rec.tenants?.name || 'Chi nhánh'}
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
                                        SL: {item.quantity} {item.unit || 'cái'}
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
                                    <p className="text-[10px] font-bold italic mt-0.5">{rec.refusal_reason || 'Không nêu lý do'}</p>
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
                                      onClick={() => handleOpenCancelModal(rec)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-rose-100/50"
                                    >
                                      Từ chối
                                    </button>
                                    <button
                                      onClick={() => handleOpenShipModal(rec)}
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
                                    {rec.received_at && (
                                      <p className="font-mono text-[8px]">{new Date(rec.received_at).toLocaleDateString('vi-VN')}</p>
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
          </div>
        )}

      </main>

      {/* Configuration Modal */}
      <AnimatePresence>
        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">THỎA THUẬN ROYALTY</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">{editingTenant.name}</h3>
                </div>
                <button 
                  onClick={() => setEditingTenant(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSaveConfig} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại phí nhượng quyền</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRoyaltyType('percentage')}
                      className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        royaltyType === 'percentage'
                          ? 'bg-primary/5 text-primary border-primary shadow-sm shadow-pink-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Percent size={14} />
                      % Doanh thu
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoyaltyType('fixed')}
                      className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        royaltyType === 'fixed'
                          ? 'bg-primary/5 text-primary border-primary shadow-sm shadow-pink-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <CreditCard size={14} />
                      Phí cố định
                    </button>
                  </div>
                </div>

                {royaltyType === 'percentage' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ phí nhượng quyền (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={royaltyRate}
                        onChange={(e) => setRoyaltyRate(e.target.value)}
                        className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                        placeholder="Ví dụ: 3.5"
                        required
                      />
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">%</div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Tự động trích theo phần trăm tổng doanh thu thực thu hàng tháng khi khóa sổ.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mức phí cố định tháng (VND)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={royaltyFixedAmount}
                        onChange={(e) => setRoyaltyFixedAmount(e.target.value)}
                        className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                        placeholder="Ví dụ: 5000000"
                        required
                      />
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">đ</div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Áp dụng mức phí cố định cố định hàng tháng không đổi bất kể doanh thu của chi nhánh.</p>
                  </div>
                )}

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingConfig}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingConfig ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : 'Lưu cấu hình'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingClearingRateTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">CẤU HÌNH ĐỐI SOÁT LIỆU TRÌNH</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">{editingClearingRateTenant.name}</h3>
                </div>
                <button 
                  onClick={() => setEditingClearingRateTenant(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSaveClearingRate} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn giá bù trừ nội bộ (VND / ca điều trị)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={newClearingRate}
                      onChange={(e) => setNewClearingRate(e.target.value)}
                      className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                      placeholder="Ví dụ: 150000"
                      required
                    />
                    <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">đ</div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Đây là số tiền chi nhánh bán gói (debtor) phải bù đắp cho chi nhánh này (creditor) trên mỗi ca phục vụ khách liên chi nhánh hoàn thành.</p>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingClearingRateTenant(null)}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClearingRate}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingClearingRate ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : 'Lưu cấu hình'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showShipModal && selectedTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">QUY TRÌNH XUẤT KHO CUNG ỨNG</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">Đơn {selectedTransfer.order_number}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowShipModal(false);
                    setSelectedTransfer(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleApproveAndShip} className="p-8 space-y-6">
                <div className="bg-rose-50/50 border border-rose-100/50 rounded-3xl p-4 space-y-3">
                  <h5 className="text-[10px] font-black text-primary uppercase tracking-widest">Danh sách xuất cấp từ kho Tổng bộ:</h5>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {((selectedTransfer.items || []) as TransferOrderItem[]).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2 text-xs">
                        <div>
                          <p className="font-black text-slate-800">{item.name}</p>
                          <p className="font-mono text-[9px] text-slate-400 font-bold uppercase">{item.sku}</p>
                        </div>
                        <span className="font-black text-primary bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                          SL: {item.quantity} {item.unit || 'cái'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn vị vận chuyển</label>
                    <input
                      type="text"
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-xs transition-all"
                      placeholder="Ví dụ: Giao Hàng Nhanh, Viettel Post..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã vận đơn (Tracking Number)</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-mono text-xs font-black transition-all"
                      placeholder="Nhập mã vận đơn bưu cục"
                      required
                    />
                    <p className="text-[9px] text-slate-400 font-bold italic mt-1">* Khi duyệt giao hàng, hệ thống sẽ tự động trừ số lượng tồn kho tương ứng tại Tổng bộ.</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowShipModal(false);
                      setSelectedTransfer(null);
                    }}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTransferAction}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {submittingTransferAction ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Truck size={14} />
                        Duyệt & Giao hàng
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showCancelModal && selectedTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-rose-500/20">TỪ CHỐI CẤP VẬT TƯ</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">Đơn {selectedTransfer.order_number}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedTransfer(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleCancelOrder} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lý do từ chối cung ứng</label>
                  <textarea
                    rows={4}
                    value={refusingReason}
                    onChange={(e) => setRefusingReason(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-xs transition-all resize-none"
                    placeholder="Nhập lý do từ chối cấp hàng cho chi nhánh (ví dụ: Tồn kho Tổng bộ đang cạn, sản phẩm tạm ngừng sản xuất...)"
                    required
                  />
                  <p className="text-[9px] text-slate-400 font-bold italic mt-1">* Lý do từ chối sẽ hiển thị trực tiếp cho quản trị viên chi nhánh được biết.</p>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelModal(false);
                      setSelectedTransfer(null);
                    }}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTransferAction}
                    className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-100"
                  >
                    {submittingTransferAction ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : 'Xác nhận từ chối'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
