'use client';

import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Clock, 
  Gift, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Search, 
  Users, 
  Percent, 
  Send, 
  Smartphone, 
  Info,
  Settings,
  Bell,
  RefreshCw,
  TrendingUp,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  getCRMStats, 
  getUpcomingSessions, 
  triggerZaloReminder, 
  triggerBatchReminders,
  getBirthdayCustomers,
  sendBirthdayGreeting,
  getZaloZnsLogs,
  CRMStats,
  getZaloConfig,
  saveZaloConfig,
  type ZaloConfig
} from '@/services/crm-actions';
import { formatCurrency } from '@/lib/utils';

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'reminders' | 'marketing' | 'logs'>('overview');
  const [stats, setStats] = useState<CRMStats>({
    totalRemindersSent: 0,
    pendingRemindersToday: 0,
    totalBirthdaysToday: 0,
    totalBirthdaysMonth: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [birthdayCustomers, setBirthdayCustomers] = useState<any[]>([]);
  const [znsLogs, setZnsLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Zalo OA Config state
  const [zaloConfig, setZaloConfig] = useState<ZaloConfig>({
    zalo_app_id: '',
    zalo_secret_key: '',
    zalo_oa_id: '',
    zalo_access_token: '',
    zalo_refresh_token: '',
    zalo_token_expires_at: '',
    zalo_template_reminder_id: '',
    zalo_template_birthday_id: '',
    zalo_auto_scan: true
  });

  // Voucher Campaign Form state
  const [vouchers, setVouchers] = useState([
    { code: 'BELLA_BABY_1ST', discount: 10, target: 'Bé tròn 1 tuổi', status: 'active', usage: 12 },
    { code: 'MATERNITY_CARE_15', discount: 15, target: 'Mẹ bầu sắp sinh', status: 'active', usage: 8 },
    { code: 'WELCOME_NEWBORN', discount: 5, target: 'Trẻ sơ sinh', status: 'active', usage: 24 }
  ]);
  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
  const [newVoucher, setNewVoucher] = useState({
    code: '',
    discount: 10,
    target: 'Bé tròn 1 tuổi',
    status: 'active'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, sessions, bdays, logs, config] = await Promise.all([
        getCRMStats(),
        getUpcomingSessions(),
        getBirthdayCustomers(),
        getZaloZnsLogs(),
        getZaloConfig()
      ]);
      setStats(s);
      setUpcomingSessions(sessions);
      setBirthdayCustomers(bdays);
      setZnsLogs(logs);
      setZaloConfig(config);
    } catch (err) {
      console.error('Error loading CRM data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualScan = async () => {
    setScanning(true);
    try {
      const res = await triggerBatchReminders();
      if ('error' in res && res.error) {
        alert('Lỗi khi quét lịch hẹn: ' + res.error);
      } else {
        const successRes = res as { count: number; messages: string[]; info: string };
        alert(successRes.info + (successRes.count > 0 ? `\n\nDanh sách tin đã gửi:\n` + successRes.messages.join('\n') : ''));
        await loadData();
      }
    } catch (e) {
      console.error(e);
      alert('Không thể hoàn tất quét lịch hẹn.');
    } finally {
      setScanning(false);
    }
  };

  const handleSendSingleReminder = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const res = await triggerZaloReminder(sessionId);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Đã gửi thông báo nhắc lịch qua Zalo OA thành công!\n\nNội dung:\n' + res.message);
        await loadData();
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi khi gửi thông báo nhắc lịch.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendBirthday = async (customerId: string, babyName: string) => {
    const voucherCode = 'BELLA_BABY_1ST';
    setActionLoading(customerId);
    try {
      const res = await sendBirthdayGreeting(customerId, voucherCode);
      if (res.error) {
        alert(res.error);
      } else {
        alert(`Đã gửi lời chúc mừng sinh nhật bé ${babyName} và gửi kèm voucher ${voucherCode} thành công!`);
        await loadData();
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi khi gửi tin chúc mừng sinh nhật.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucher.code.trim()) return;
    setVouchers(prev => [...prev, { ...newVoucher, usage: 0 }]);
    setShowNewVoucherModal(false);
    setNewVoucher({ code: '', discount: 10, target: 'Bé tròn 1 tuổi', status: 'active' });
  };

  const handleSaveConfig = async () => {
    setActionLoading('save_zalo_config');
    try {
      const res = await saveZaloConfig(zaloConfig);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Cập nhật cấu hình kết nối Zalo thành công!');
        await loadData();
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi hệ thống khi lưu cấu hình.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-auto p-4 lg:p-8 space-y-8 custom-scrollbar bg-slate-50/50">
      
      {/* ── Title Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
            <Megaphone className="w-10 h-10 text-primary" />
            CRM & Zalo Marketing
          </h1>
          <p className="text-slate-400 font-medium mt-1">Hệ thống gửi tin Zalo ZNS tự động, quản lý tệp khách hàng và chiến dịch khuyến mãi</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            disabled={loading}
            className="p-3 bg-white hover:bg-rose-50 text-slate-600 hover:text-primary rounded-2xl transition-all border border-rose-100 flex items-center gap-2 shadow-sm font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            LÀM MỚI
          </button>
          <button 
            onClick={handleManualScan}
            disabled={scanning || loading}
            className="px-6 py-3 bg-gradient-to-r from-primary to-rose-500 hover:from-primary/95 hover:to-rose-600 text-white rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-rose-200 dark:shadow-none font-black text-xs uppercase tracking-widest disabled:opacity-75"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            QUÉT LỊCH HẸN HÔM NAY
          </button>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex border-b border-rose-100 bg-white p-2.5 rounded-[1.8rem] shadow-sm gap-2">
        {[
          { id: 'overview', label: 'TỔNG QUAN & CÀI ĐẶT ZALO', icon: Settings },
          { id: 'reminders', label: 'THÔNG BÁO NHẮC HẸN', icon: Bell },
          { id: 'marketing', label: 'SINH NHẬT & CHIẾN DỊCH', icon: Gift },
          { id: 'logs', label: 'NHẬT KÝ GỬI TIN', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'overview' | 'reminders' | 'marketing' | 'logs')}
            className={`flex items-center gap-2.5 px-6 py-3.5 rounded-[1.25rem] transition-all duration-300 font-black text-xs uppercase tracking-wider ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <tab.icon className="w-4.5 h-4.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 opacity-60">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-primary">Đang đồng bộ dữ liệu CRM...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* ──────────────── TAB 1: OVERVIEW & CONFIG ──────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Stats & Cron Status */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Đã gửi ZNS thành công</p>
                      <h3 className="text-3xl font-black text-slate-800">{stats.totalRemindersSent}</h3>
                      <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Tự động 100%
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-primary shadow-inner">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lịch chưa nhắc hôm nay</p>
                      <h3 className="text-3xl font-black text-slate-800">{stats.pendingRemindersToday}</h3>
                      <p className="text-[10px] text-rose-500 font-bold">
                        Quét tự động trước 2.5 giờ
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sinh nhật hôm nay</p>
                      <h3 className="text-3xl font-black text-slate-800">{stats.totalBirthdaysToday}</h3>
                      <p className="text-[10px] text-slate-400 font-bold">
                        Bé sinh ngày này
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center text-rose-400 shadow-inner">
                      <Gift className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sinh nhật trong tháng</p>
                      <h3 className="text-3xl font-black text-slate-800">{stats.totalBirthdaysMonth}</h3>
                      <p className="text-[10px] text-primary font-bold">
                        Tặng mã BELLA_BABY_1ST
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-inner">
                      <Calendar className="w-6 h-6" />
                    </div>
                  </div>

                </div>

                {/* Automation info */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Tiến trình Quét tự động & Tích hợp Zalo
                  </h3>
                  <div className="space-y-4 text-sm text-slate-600 font-medium">
                    <p>Hệ thống Bella Spa ERP hỗ trợ đồng bộ hoàn toàn với Zalo OA và cổng Zalo Notification Service (ZNS). Khi kích hoạt, một tiến trình chạy ngầm (cron job) sẽ thực hiện:</p>
                    <ul className="list-disc pl-5 space-y-2 text-slate-500">
                      <li>Quét các buổi chăm sóc mẹ & bé (`session_logs`) có trạng thái `scheduled` trong ngày.</li>
                      <li>So sánh thời gian bắt đầu hẹn với giờ Việt Nam hiện tại.</li>
                      <li>Nếu còn chính xác **2.5 giờ** đến lịch hẹn, hệ thống tự động soạn mẫu ZNS, gọi API Zalo OA để gửi tin nhắn đến số điện thoại đăng ký của mẹ.</li>
                      <li>Sau khi API phản hồi thành công, đánh dấu `zalo_reminder_sent = true` để tránh trùng lặp.</li>
                    </ul>

                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 mt-4">
                      <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-primary text-xs uppercase tracking-wider mb-0.5">Lưu ý bảo mật & RLS</h4>
                        <p className="text-xs text-slate-500">Cơ sở dữ liệu đảm bảo an toàn tuyệt đối. Bất cứ hành động gửi tin Zalo ZNS nào đều được ghi lại trong Nhật ký hệ thống để đối soát.</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Zalo Configuration Form */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Cấu hình Zalo OA
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Cài đặt kết nối API Zalo Notification Service (ZNS)</p>
                </div>

                <div className="space-y-4">
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Zalo App ID</label>
                    <input 
                      type="text" 
                      value={zaloConfig.zalo_app_id || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_app_id: e.target.value })}
                      placeholder="Nhập Zalo App ID"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Secret Key (Khóa bảo mật)</label>
                    <input 
                      type="password" 
                      value={zaloConfig.zalo_secret_key || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_secret_key: e.target.value })}
                      placeholder="••••••••••••••••••••••••"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Zalo Official Account ID</label>
                    <input 
                      type="text" 
                      value={zaloConfig.zalo_oa_id || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_oa_id: e.target.value })}
                      placeholder="Nhập Zalo OA ID"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Access Token</label>
                    <input 
                      type="password" 
                      value={zaloConfig.zalo_access_token || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_access_token: e.target.value })}
                      placeholder="••••••••••••••••••••••••"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Refresh Token</label>
                    <input 
                      type="password" 
                      value={zaloConfig.zalo_refresh_token || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_refresh_token: e.target.value })}
                      placeholder="••••••••••••••••••••••••"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mẫu ZNS nhắc lịch hẹn</label>
                    <input 
                      type="text" 
                      value={zaloConfig.zalo_template_reminder_id || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_template_reminder_id: e.target.value })}
                      placeholder="ZNS_REMINDER_V2"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mẫu ZNS chúc mừng sinh nhật</label>
                    <input 
                      type="text" 
                      value={zaloConfig.zalo_template_birthday_id || ''}
                      onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_template_birthday_id: e.target.value })}
                      placeholder="ZNS_BIRTHDAY_GIFT_V1"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Tự động gửi tin (Cronjob)</p>
                      <p className="text-[10px] text-slate-400 font-medium">Bật quét tự động trước giờ chăm sóc</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setZaloConfig({ ...zaloConfig, zalo_auto_scan: !zaloConfig.zalo_auto_scan })}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${zaloConfig.zalo_auto_scan ? 'bg-primary flex justify-end' : 'bg-slate-200 flex justify-start'}`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                    </button>
                  </div>

                  <button 
                    onClick={handleSaveConfig}
                    disabled={actionLoading === 'save_zalo_config'}
                    className="w-full py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all pt-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === 'save_zalo_config' && <Loader2 className="w-4 h-4 animate-spin" />}
                    LƯU CẤU HÌNH KẾT NỐI
                  </button>

                </div>
              </div>

            </div>
          )}

          {/* ──────────────── TAB 2: REMINDERS LIST ──────────────── */}
          {activeTab === 'reminders' && (
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-md">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Danh sách Lịch hẹn Nhắc nhở Zalo</h3>
                  <p className="text-xs text-slate-400 font-medium">Buổi chăm sóc mẹ & bé hôm nay và ngày mai</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thời gian đồng bộ: Mới nhất</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-4 px-6">Mã Booking</th>
                      <th className="py-4 px-6">Mẹ & Bé</th>
                      <th className="py-4 px-6">KTV phụ trách</th>
                      <th className="py-4 px-6">Thời gian hẹn (GMT+7)</th>
                      <th className="py-4 px-6">Địa chỉ</th>
                      <th className="py-4 px-6">Gửi Zalo (ZNS)</th>
                      <th className="py-4 px-6 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 font-medium italic">
                          Không tìm thấy buổi chăm sóc nào hôm nay và ngày mai.
                        </td>
                      </tr>
                    ) : (
                      upcomingSessions.map((session) => {
                        const customer = session.bookings?.customers;
                        const ktvName = session.bookings?.assigned_ktv?.full_name || 'Chưa phân công';
                        const isSent = session.zalo_reminder_sent;

                        return (
                          <tr key={session.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                            <td className="py-4 px-6">
                              <span className="font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                                {session.bookings?.booking_number || 'N/A'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-black text-sm text-slate-800">{customer?.name_mother || 'Khách hàng'}</span>
                                <span className="text-[11px] text-slate-400 font-bold">
                                  Bé: {customer?.name_baby || 'Chưa ghi nhận'} • SĐT: {customer?.phone || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-xs font-bold text-slate-600">{ktvName}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-black text-xs text-primary">{session.assigned_time?.substring(0, 5) || '08:00'}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{session.assigned_date}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 max-w-xs truncate">
                              <span className="text-xs font-medium text-slate-500">{session.address || 'Tại nhà'}</span>
                            </td>
                            <td className="py-4 px-6">
                              {isSent ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  ĐÃ GỬI
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  <Clock className="w-3.5 h-3.5" />
                                  CHỜ GỬI (2.5H)
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {isSent ? (
                                <button 
                                  onClick={() => handleSendSingleReminder(session.id)}
                                  disabled={actionLoading === session.id}
                                  className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest p-2 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                  {actionLoading === session.id ? 'GỬI LẠI...' : 'GỬI LẠI TIN'}
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleSendSingleReminder(session.id)}
                                  disabled={actionLoading === session.id}
                                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-100 dark:shadow-none hover:shadow-lg transition-all"
                                >
                                  {actionLoading === session.id ? 'ĐANG GỬI...' : 'GỬI NGAY'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ──────────────── TAB 3: BIRTHDAYS & CAMPAIGNS ──────────────── */}
          {activeTab === 'marketing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Side: Birthday customers */}
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
                <div className="p-6 border-b border-slate-50">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Kỷ niệm Sinh nhật của Bé trong tháng</h3>
                  <p className="text-xs text-slate-400 font-medium">Chiến dịch gửi tin nhắn chúc mừng & Voucher tự động</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="py-4 px-6">Tên mẹ & Bé</th>
                        <th className="py-4 px-6">Ngày sinh của Bé</th>
                        <th className="py-4 px-6">Tuổi của bé</th>
                        <th className="py-4 px-6">Khoảng cách</th>
                        <th className="py-4 px-6 text-center">Gửi chúc mừng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {birthdayCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">
                            Không tìm thấy bé nào có sinh nhật trong tháng này.
                          </td>
                        </tr>
                      ) : (
                        birthdayCustomers.map((c) => (
                          <tr key={c.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-black text-sm text-slate-800">{c.name_baby || 'Bé cưng'}</span>
                                <span className="text-[11px] text-slate-400 font-bold">Mẹ: {c.name_mother} • SĐT: {c.phone}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-xs font-bold text-slate-600">{c.dobFormatted}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-xs font-black text-primary uppercase tracking-wide">
                                Tròn {c.ageYears} Tuổi
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              {c.isToday ? (
                                <span className="inline-block px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                                  HÔM NAY 🎂
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-slate-500">
                                  Còn {c.daysUntil} ngày
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <button 
                                onClick={() => handleSendBirthday(c.id, c.name_baby)}
                                disabled={actionLoading === c.id}
                                className="px-4 py-2 bg-gradient-to-r from-primary to-rose-500 hover:from-primary/95 hover:to-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-100 dark:shadow-none hover:shadow-lg transition-all flex items-center gap-1.5 mx-auto"
                              >
                                <Gift className="w-3.5 h-3.5" />
                                {actionLoading === c.id ? 'ĐANG GỬI...' : 'TẶNG VOUCHER'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: Active Vouchers & Voucher Campaign Manager */}
              <div className="space-y-8">
                
                {/* Vouchers lists */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        Danh sách Voucher
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">Các mã giảm giá áp dụng trong chiến dịch</p>
                    </div>
                    <button 
                      onClick={() => setShowNewVoucherModal(true)}
                      className="p-2 bg-rose-50 hover:bg-primary hover:text-white rounded-xl text-primary transition-all active:scale-95 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {vouchers.map((v) => (
                      <div key={v.code} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                        <div className="space-y-1">
                          <span className="text-xs font-black text-primary bg-rose-50 px-2 py-0.5 rounded border border-rose-100/50">
                            {v.code}
                          </span>
                          <p className="text-[11px] font-bold text-slate-600 mt-1">{v.target}</p>
                          <p className="text-[9px] text-slate-400 font-medium">Đã dùng: {v.usage} lần</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-800">-{v.discount}%</span>
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">Đang chạy</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Campaign Demo builder */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6 relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mb-16 -mr-16" />
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                      <Percent className="w-5 h-5 text-primary" />
                      Chiến dịch Tiếp thị Targeted
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Tiếp cận các nhóm khách hàng mục tiêu để tối ưu chuyển đổi</p>
                  </div>
                  <div className="space-y-4 text-xs font-medium text-slate-300">
                    <p>ERP tự động phân nhóm tệp khách hàng dựa trên dữ liệu sản phụ khoa và tuổi của bé:</p>
                    <div className="space-y-2.5">
                      <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                        <span>Mẹ bầu sắp sinh (dob_expected &lt; 30 ngày)</span>
                        <span className="text-[10px] font-black text-primary uppercase">12 khách hàng</span>
                      </div>
                      <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                        <span>Bé sơ sinh (dob_baby &lt; 3 tháng)</span>
                        <span className="text-[10px] font-black text-primary uppercase">18 khách hàng</span>
                      </div>
                      <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                        <span>Bé thôi nôi (dob_baby từ 11 - 12 tháng)</span>
                        <span className="text-[10px] font-black text-primary uppercase">9 khách hàng</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ──────────────── TAB 4: ZNS NOTIFICATION LOGS ──────────────── */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
              <div className="p-6 border-b border-slate-50">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Nhật ký tin nhắn gửi qua Zalo (ZNS)</h3>
                <p className="text-xs text-slate-400 font-medium">Được lưu trữ để kiểm tra đối soát chất lượng dịch vụ chăm sóc</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-4 px-6">Thời gian gửi (GMT+7)</th>
                      <th className="py-4 px-6">Loại tin nhắn</th>
                      <th className="py-4 px-6">Tiêu đề log</th>
                      <th className="py-4 px-6">Nội dung tin nhắn</th>
                      <th className="py-4 px-6">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {znsLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">
                          Không tìm thấy nhật ký gửi tin nhắn nào.
                        </td>
                      </tr>
                    ) : (
                      znsLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                          <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                            {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                              log.type === 'zalo_zns' 
                                ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                : 'bg-pink-50 text-pink-600 border border-pink-100'
                            }`}>
                              {log.type === 'zalo_zns' ? 'Zalo ZNS' : 'Sinh nhật / Quà tặng'}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-xs text-slate-700">
                            {log.title}
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-600 font-medium max-w-md break-words">
                            {log.message}
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Thành công
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Voucher Creation Modal ── */}
      {showNewVoucherModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Tạo chiến dịch Voucher mới</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Tạo mã quà tặng kích thích mua hàng cho khách hàng thân thiết</p>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mã Code Voucher</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: WELCOME_BABY_15"
                  required
                  value={newVoucher.code}
                  onChange={(e) => setNewVoucher({ ...newVoucher, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Phần trăm giảm giá (%)</label>
                <input 
                  type="number" 
                  min={1}
                  max={100}
                  required
                  value={newVoucher.discount}
                  onChange={(e) => setNewVoucher({ ...newVoucher, discount: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tệp khách hàng mục tiêu</label>
                <select 
                  value={newVoucher.target}
                  onChange={(e) => setNewVoucher({ ...newVoucher, target: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
                >
                  <option value="Bé tròn 1 tuổi">Bé tròn 1 tuổi (Sinh nhật)</option>
                  <option value="Mẹ bầu sắp sinh">Mẹ bầu sắp sinh (Thai sản)</option>
                  <option value="Trẻ sơ sinh">Trẻ sơ sinh (Newborn)</option>
                  <option value="Khách hàng cũ kích hoạt lại">Khách hàng cũ kích hoạt lại</option>
                </select>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewVoucherModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  HỦY BỎ
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  TẠO CHIẾN DỊCH
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
