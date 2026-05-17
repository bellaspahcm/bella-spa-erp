'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  DollarSign,
  Link as LinkIcon,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRightLeft,
  X,
  CheckCircle2,
  RefreshCw,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function FinancialReconciliationPage() {
  const [data, setData] = useState<{
    debt_alerts: any[];
    orphaned_revenue: any[];
    mismatch_alerts: any[];
    collection_history: any[];
  }>({
    debt_alerts: [],
    orphaned_revenue: [],
    mismatch_alerts: [],
    collection_history: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'debt' | 'orphan' | 'mismatch' | 'history'>('debt');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(''); // YYYY-MM-DD

  // Modal Allocation State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedOrphan, setSelectedOrphan] = useState<any>(null);
  const [targetBookingId, setTargetBookingId] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);

  // Debt Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash'>('bank_transfer');
  const [isPaying, setIsPaying] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Get current user and tenant
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Không tìm thấy phiên đăng nhập');
      
      // First try users table
      let { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', session.user.id)
        .single();
        
      if (profileErr || !profile?.tenant_id) {
         // Fallback to profiles table
         const { data: fallbackProfile } = await supabase
           .from('profiles')
           .select('tenant_id, role')
           .eq('id', session.user.id)
           .single();
         profile = fallbackProfile;
      }
        
      if (!profile?.tenant_id) throw new Error('Không tìm thấy thông tin cơ sở');

      // Fetch anomalies via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_financial_anomalies', {
        p_tenant_id: profile.tenant_id
      });

      if (rpcError) throw rpcError;

      // Fetch debt collection history
      const { data: historyData, error: historyError } = await supabase
        .from('revenue')
        .select(`
          id, amount, received_date, notes, payment_method, booking_id,
          bookings (
            customers (
              name_mother, name_baby
            )
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('revenue_type', 'additional')
        .order('received_date', { ascending: false });

      if (historyError) throw historyError;

      const historyFormatted = historyData?.map((item: any) => ({
        revenue_id: item.id,
        amount: item.amount,
        received_date: item.received_date,
        notes: item.notes,
        payment_method: item.payment_method,
        booking_id: item.booking_id,
        customer_name: item.bookings?.customers?.name_mother || item.bookings?.customers?.name_baby || 'Khách hàng'
      })) || [];

      if (rpcData) {
        setData({
          ...(rpcData as any),
          collection_history: historyFormatted
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Lỗi khi tải dữ liệu đối soát');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAllocate = async () => {
    if (!targetBookingId.trim() || !selectedOrphan) {
      toast.error('Vui lòng nhập Booking ID hợp lệ');
      return;
    }
    setIsAllocating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Chưa đăng nhập');

      let { data: profile } = await supabase.from('users').select('tenant_id, role').eq('id', session.user.id).single();
      if (!profile?.tenant_id) {
         const { data: fallbackProfile } = await supabase.from('profiles').select('tenant_id, role').eq('id', session.user.id).single();
         profile = fallbackProfile;
      }
      if (!profile || !['admin', 'accountant'].includes(profile.role)) {
        throw new Error('Bạn không có quyền phân bổ tiền');
      }

      const { error } = await supabase
        .from('revenue')
        .update({ booking_id: targetBookingId.trim(), status: 'confirmed' })
        .eq('id', selectedOrphan.revenue_id)
        .eq('tenant_id', profile.tenant_id)
        .is('booking_id', null);

      if (error) throw error;

      toast.success('Đã phân bổ khoản tiền thành công!');
      setShowAllocateModal(false);
      setSelectedOrphan(null);
      setTargetBookingId('');
      fetchData(); // Refresh
    } catch (error: any) {
      toast.error('Lỗi phân bổ: ' + error.message);
    }
    setIsAllocating(false);
  };

  const handlePayment = async () => {
    if (!paymentAmount || !selectedDebt) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    setIsPaying(true);
    try {
      const cleanAmount = Number(paymentAmount.replace(/\D/g, ''));
      if (!cleanAmount) throw new Error('Số tiền không hợp lệ');

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Chưa đăng nhập');

      let { data: profile } = await supabase.from('users').select('tenant_id, role').eq('id', session.user.id).single();
      if (!profile?.tenant_id) {
         const { data: fallbackProfile } = await supabase.from('profiles').select('tenant_id, role').eq('id', session.user.id).single();
         profile = fallbackProfile;
      }
      if (!profile || !['admin', 'accountant'].includes(profile.role)) {
        throw new Error('Bạn không có quyền thu tiền');
      }

      const customerStr = selectedDebt.customer_name || 'Khách hàng';
      const packageStr = selectedDebt.package_name || 'Gói Dịch Vụ';
      const shortBookingId = selectedDebt.booking_id?.split('-')[0]?.toUpperCase() || 'N/A';

      const { error } = await supabase.from('revenue').insert({
        tenant_id: profile.tenant_id,
        booking_id: selectedDebt.booking_id,
        amount: cleanAmount,
        revenue_type: 'additional',
        notes: `Thu nợ đối soát - KH: ${customerStr} - Gói: ${packageStr} (Booking: ${shortBookingId})`,
        status: 'confirmed',
        payment_method: paymentMethod,
        received_date: new Date().toISOString().split('T')[0],
        recorded_by_id: session.user.id
      });

      if (error) throw error;

      toast.success('Thu nợ thành công!');
      setShowPaymentModal(false);
      setSelectedDebt(null);
      setPaymentAmount('');
      fetchData(); // Refresh data
    } catch (error: any) {
      toast.error('Lỗi thu nợ: ' + error.message);
    }
    setIsPaying(false);
  };

  const totalDebt = data.debt_alerts.reduce((acc, item) => acc + Number(item.debt || 0), 0);
  const totalOrphaned = data.orphaned_revenue.reduce((acc, item) => acc + Number(item.amount || 0), 0);
  const totalMismatches = data.mismatch_alerts.length;

  const filteredDebt = data.debt_alerts.filter(d => 
    d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrphan = data.orphaned_revenue.filter(o => {
    const matchSearch = o.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.revenue_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = filterDate ? o.received_date === filterDate : true;
    return matchSearch && matchDate;
  });

  const filteredMismatch = data.mismatch_alerts.filter(m => 
    m.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = data.collection_history.filter(h => {
    const matchSearch = h.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        h.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = filterDate ? h.received_date === filterDate : true;
    return matchSearch && matchDate;
  });

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-24">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary/80 mb-2">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-black uppercase tracking-widest">Trung tâm Giám sát</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Đối soát Tài chính</h1>
          <p className="text-slate-500 mt-2 font-medium">Tự động phát hiện công nợ, tiền treo và chênh lệch doanh thu</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm w-full sm:w-auto transition-all hover:border-slate-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">LỌC NGÀY:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent border-none p-0 text-sm font-black text-slate-700 focus:ring-0 outline-none cursor-pointer w-full sm:w-auto"
            />
          </div>
          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="flex w-full sm:w-auto justify-center items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            QUÉT LẠI
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-[32px] p-6 text-white shadow-lg shadow-rose-200 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">{data.debt_alerts.length} khách</span>
            </div>
            <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Cần thu hồi nợ</p>
            <h3 className="text-3xl font-black">{formatCurrency(totalDebt)}</h3>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[32px] p-6 text-white shadow-lg shadow-amber-200 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <LinkIcon className="w-6 h-6 text-white" />
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">{data.orphaned_revenue.length} khoản</span>
            </div>
            <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Tiền thu bị treo</p>
            <h3 className="text-3xl font-black">{formatCurrency(totalOrphaned)}</h3>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[32px] p-6 text-white shadow-lg shadow-purple-200 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">Xử lý ngay</span>
            </div>
            <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Booking lệch giá trị</p>
            <h3 className="text-3xl font-black">{totalMismatches} <span className="text-lg opacity-80">vụ việc</span></h3>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-2 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex p-1 bg-slate-50 rounded-[24px] w-full md:w-auto">
          {[
            { id: 'debt', label: 'Công Nợ Khách Hàng', count: data.debt_alerts.length, color: 'text-rose-500', bg: 'bg-rose-50' },
            { id: 'orphan', label: 'Tiền Treo (Chưa gán)', count: data.orphaned_revenue.length, color: 'text-amber-500', bg: 'bg-amber-50' },
            { id: 'mismatch', label: 'Lệch Doanh Thu', count: data.mismatch_alerts.length, color: 'text-purple-500', bg: 'bg-purple-50' },
            { id: 'history', label: 'Lịch Sử Thu Nợ', count: data.collection_history.length, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative flex-1 md:flex-none px-6 py-4 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2",
                activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab.label}
              <span className={cn("px-2 py-0.5 rounded-lg text-[10px]", activeTab === tab.id ? tab.bg + ' ' + tab.color : "bg-slate-100 text-slate-400")}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        
        <div className="w-full md:w-auto px-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-[250px] pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLES */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Đang quét hệ thống tài chính...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  {activeTab === 'debt' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Khách hàng & Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Giá trị Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Đã Thu</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Còn Nợ</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thao tác</th>
                    </>
                  )}
                  {activeTab === 'orphan' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ID Khoản Thu & Loại</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ghi Chú</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Số Tiền</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thao tác</th>
                    </>
                  )}
                  {activeTab === 'mismatch' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Khách hàng & Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Giá trị Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tổng Đã Thu</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">Mức Lệch</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thao tác</th>
                    </>
                  )}
                  {activeTab === 'history' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày Thu</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Khách Hàng</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ghi Chú & Hình Thức</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Số Tiền Đã Thu</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* DEBT TAB */}
                {activeTab === 'debt' && filteredDebt.map((item, i) => (
                  <tr key={item.booking_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-sm text-slate-900">{item.customer_name}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{item.package_name || 'Gói Dịch Vụ'}</div>
                      <div className="text-[10px] text-slate-300 font-mono mt-1">ID: {item.booking_id?.split('-')[0]}...</div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-500">{formatCurrency(item.full_price)}</td>
                    <td className="px-8 py-6 text-right font-black text-emerald-600">{formatCurrency(item.total_paid)}</td>
                    <td className="px-8 py-6 text-right">
                      <span className="inline-block bg-rose-50 text-rose-600 font-black px-3 py-1.5 rounded-xl border border-rose-100">
                        {formatCurrency(item.debt)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={() => {
                          setSelectedDebt(item);
                          setPaymentAmount(item.debt?.toString() || '');
                          setPaymentMethod('bank_transfer');
                          setShowPaymentModal(true);
                        }}
                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-primary hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <DollarSign className="w-3 h-3" />
                        Thu Nợ
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* ORPHAN TAB */}
                {activeTab === 'orphan' && filteredOrphan.map((item, i) => (
                  <tr key={item.revenue_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-mono text-xs text-slate-900 bg-slate-100 inline-block px-2 py-1 rounded-lg">
                        {item.revenue_id?.split('-')[0]}...
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mt-2">
                        {item.revenue_type || 'UNKNOWN TYPE'} • {item.received_date}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm text-slate-600 font-medium max-w-xs">{item.notes || <span className="italic text-slate-300">Không có ghi chú</span>}</p>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-amber-600 text-lg">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={() => { setSelectedOrphan(item); setShowAllocateModal(true); }}
                        className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <ArrowRightLeft className="w-3 h-3" />
                        Phân bổ
                      </button>
                    </td>
                  </tr>
                ))}

                {/* MISMATCH TAB */}
                {activeTab === 'mismatch' && filteredMismatch.map((item, i) => (
                  <tr key={item.booking_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-sm text-slate-900">{item.customer_name}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{item.package_name || 'Gói Dịch Vụ'}</div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-500">{formatCurrency(item.full_price)}</td>
                    <td className="px-8 py-6 text-right font-black text-emerald-600">{formatCurrency(item.total_paid)}</td>
                    <td className="px-8 py-6 text-right">
                      <span className="inline-block bg-purple-50 text-purple-600 font-black px-3 py-1.5 rounded-xl border border-purple-100">
                        + {formatCurrency(item.mismatch)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <Link href={`/dashboard/customers/${item.customer_id}?bookingId=${item.booking_id}`}
                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <ExternalLink className="w-3 h-3" />
                        Điều Tra
                      </Link>
                    </td>
                  </tr>
                ))}

                {/* HISTORY TAB */}
                {activeTab === 'history' && filteredHistory.map((item, i) => (
                  <tr key={item.revenue_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 align-top">
                      <div className="font-black text-sm text-slate-900">{item.received_date}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">ID: {item.revenue_id?.split('-')[0]}</div>
                    </td>
                    <td className="px-8 py-6 align-top">
                      <div className="font-black text-sm text-slate-900">{item.customer_name}</div>
                    </td>
                    <td className="px-8 py-6 align-top">
                      <div className="text-sm font-medium text-slate-600">{item.notes}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                        {item.payment_method?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      <div className="font-black text-emerald-600 text-base mt-[-1px]">
                        + {formatCurrency(item.amount)}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* EMPTY STATES */}
                {activeTab === 'debt' && filteredDebt.length === 0 && (
                  <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium">Không tìm thấy công nợ nào cần xử lý. Tuyệt vời! 🎉</td></tr>
                )}
                {activeTab === 'orphan' && filteredOrphan.length === 0 && (
                  <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium">Mọi khoản tiền đều đã được phân bổ rõ ràng. ✨</td></tr>
                )}
                {activeTab === 'mismatch' && filteredMismatch.length === 0 && (
                  <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium">Không có sai lệch dữ liệu nào. Hệ thống an toàn! 🛡️</td></tr>
                )}
                {activeTab === 'history' && filteredHistory.length === 0 && (
                  <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium">Chưa có dữ liệu thu nợ nào trong bộ lọc này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: PHÂN BỔ TIỀN TREO */}
      <AnimatePresence>
        {showAllocateModal && selectedOrphan && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAllocateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900">Phân Bổ Tiền Treo</h3>
                </div>
                <button onClick={() => setShowAllocateModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền đang treo</p>
                  <p className="text-3xl font-black text-amber-600 mb-2">{formatCurrency(selectedOrphan.amount)}</p>
                  {selectedOrphan.notes && (
                    <p className="text-xs text-slate-600 font-medium italic border-l-2 border-amber-200 pl-2">
                      Ghi chú: {selectedOrphan.notes}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Nhập Booking ID cần phân bổ vào
                  </label>
                  <input
                    type="text"
                    value={targetBookingId}
                    onChange={(e) => setTargetBookingId(e.target.value)}
                    placeholder="VD: 123e4567-e89b-12d3..."
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    Lưu ý: Bạn có thể vào màn hình Hồ sơ khách hàng hoặc Bookings để copy chính xác ID của Booking.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleAllocate}
                    disabled={isAllocating || !targetBookingId.trim()}
                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isAllocating ? 'Đang Xử Lý...' : 'Xác Nhận Phân Bổ'}
                    {!isAllocating && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: THU NỢ */}
      <AnimatePresence>
        {showPaymentModal && selectedDebt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900">Thu Nợ Khách Hàng</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Khách hàng</p>
                      <p className="text-sm font-black text-slate-900 mb-2">{selectedDebt.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mã Booking</p>
                      <p className="text-sm font-mono font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {selectedDebt.booking_id?.split('-')[0]?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-3">Gói Dịch Vụ</p>
                  <p className="text-sm font-black text-slate-600">{selectedDebt.package_name || 'Chưa cập nhật tên gói'}</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Số tiền thu (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={paymentAmount ? Number(paymentAmount.toString().replace(/\D/g, '')).toLocaleString() : ''}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="VD: 5,000,000"
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all text-rose-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    Mặc định là số tiền khách còn nợ: <strong className="text-rose-500">{formatCurrency(selectedDebt.debt)}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Phương thức thanh toán
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={cn(
                        "py-3.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-center",
                        paymentMethod === 'bank_transfer'
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      Chuyển khoản
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        "py-3.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-center",
                        paymentMethod === 'cash'
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      Tiền mặt
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handlePayment}
                    disabled={isPaying || !paymentAmount}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-rose-200"
                  >
                    {isPaying ? 'Đang Xử Lý...' : 'Xác Nhận Thu Nợ'}
                    {!isPaying && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
