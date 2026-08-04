'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommit,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Layers,
  Activity,
  Phone,
  MessageSquare,
  Users,
  Compass,
  Flame,
  Calendar,
  Sparkles,
  ChevronRight,
  Zap,
  RefreshCw,
  Target,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

// 22 Giai đoạn Hành Trình Ô Tô chuẩn EIP — phân cụm theo category
const JOURNEY_STAGES = [
  { code: 'lead_new', name: 'Lead Mới', category: 'Awareness', sla: 12 },
  { code: 'initial_contact', name: 'Liên Hệ Đầu', category: 'Awareness', sla: 24 },
  { code: 'needs_assessment', name: 'Xác Định Nhu Cầu', category: 'Awareness', sla: 48 },
  { code: 'product_selection', name: 'Lựa Chọn Xe', category: 'Consideration', sla: 72 },
  { code: 'first_quote', name: 'Báo Giá Lần 1', category: 'Consideration', sla: 24 },
  { code: 'test_drive_scheduled', name: 'Hẹn Lái Thử', category: 'Consideration', sla: 48 },
  { code: 'test_drive_completed', name: 'Đã Lái Thử', category: 'Consideration', sla: 48 },
  { code: 'negotiation', name: 'Thương Thảo', category: 'Intent', sla: 96 },
  { code: 'deposit_received', name: 'Đặt Cọc', category: 'Intent', sla: 72 },
  { code: 'vin_allocated', name: 'Phân Bổ VIN', category: 'Purchase', sla: 48 },
  { code: 'bank_disbursement', name: 'Giải Ngân', category: 'Purchase', sla: 120 },
  { code: 'tax_and_registration', name: 'Đóng Thuế & ĐK', category: 'Purchase', sla: 72 },
  { code: 'pdi_check', name: 'Kiểm Tra PDI', category: 'Purchase', sla: 24 },
  { code: 'delivered', name: 'Bàn Giao Xe', category: 'Purchase', sla: 48 },
  { code: 'csi_survey', name: 'Khảo Sát CSI', category: 'Retention', sla: 72 },
  { code: 'service_1k', name: 'Bảo Dưỡng 1K Km', category: 'Retention', sla: 720 },
  { code: 'service_10k', name: 'Bảo Dưỡng 10K Km', category: 'Retention', sla: 2160 },
  { code: 'warranty_care', name: 'Bảo Hành', category: 'Retention', sla: 1440 },
  { code: 'event_invitation', name: 'Sự Kiện Tri Ân', category: 'Loyalty', sla: 720 },
  { code: 'accessory_upgrade', name: 'Nâng Cấp Đồ Chơi', category: 'Loyalty', sla: 1440 },
  { code: 'trade_in_evaluation', name: 'Định Giá Trade-In', category: 'Loyalty', sla: 120 },
  { code: 'repurchase', name: 'Mua Lại / Lên Đời', category: 'Loyalty', sla: 720 },
];

const CATEGORY_CONFIG: Record<string, { color: string; dot: string; badge: string; label: string }> = {
  Awareness:     { color: 'text-blue-600 dark:text-blue-400',    dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',    label: 'Awareness' },
  Consideration: { color: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border-violet-100 dark:border-violet-900/30', label: 'Consideration' },
  Intent:        { color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-100 dark:border-purple-900/30', label: 'Intent' },
  Purchase:      { color: 'text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500', badge: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 border-fuchsia-100 dark:border-fuchsia-900/30', label: 'Purchase' },
  Retention:     { color: 'text-pink-600 dark:text-pink-400',     dot: 'bg-pink-500',    badge: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400 border-pink-100 dark:border-pink-900/30',    label: 'Retention' },
  Loyalty:       { color: 'text-rose-600 dark:text-rose-400',     dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',    label: 'Loyalty' },
};

const MOCK_FUNNEL_DATA = [
  { stage: 'Awareness', label: 'Nhận diện', count: 320, percent: 100, fromPrev: null, gradient: 'from-blue-500 to-indigo-600' },
  { stage: 'Consideration', label: 'Cân nhắc', count: 180, percent: 56, fromPrev: -44, gradient: 'from-violet-500 to-purple-600' },
  { stage: 'Intent', label: 'Đặt cọc', count: 90, percent: 28, fromPrev: -50, gradient: 'from-purple-500 to-fuchsia-600' },
  { stage: 'Purchase', label: 'Bàn giao', count: 45, percent: 14, fromPrev: -50, gradient: 'from-fuchsia-500 to-pink-600' },
  { stage: 'Retention', label: 'Loyalty', count: 28, percent: 8, fromPrev: -38, gradient: 'from-pink-500 to-rose-600' },
];

const MOCK_HEATMAP_DATA = [
  { stage: 'Thương Thảo', hours: 84, status: 'high', desc: 'Vượt SLA 96h trung bình' },
  { stage: 'Giải Ngân', hours: 112, status: 'high', desc: 'Phụ thuộc ngân hàng đối tác' },
  { stage: 'Hẹn Lái Thử', hours: 38, status: 'medium', desc: 'Cần tối ưu lịch KTV' },
  { stage: 'Xác Định Nhu Cầu', hours: 45, status: 'medium', desc: 'Thiếu tài liệu sản phẩm' },
  { stage: 'Đóng Thuế & ĐK', hours: 68, status: 'medium', desc: 'Phụ thuộc cơ quan nhà nước' },
  { stage: 'Phân Bổ VIN', hours: 12, status: 'low', desc: 'Xử lý tốt dưới SLA 48h' },
];

const MOCK_TIMELINE_EVENTS = [
  { id: '1', type: 'stage_change', title: 'Khởi tạo hành trình', desc: 'Hệ thống tự động nhận dạng Lead mới từ Website Facebook Lead Ads', date: '2026-07-01 08:30', duration: null, icon: GitCommit, dotColor: 'from-blue-500 to-indigo-600', iconBg: 'bg-blue-50 dark:bg-blue-950/30', iconColor: 'text-blue-600 dark:text-blue-400' },
  { id: '2', type: 'touchpoint', channel: 'call', title: 'Cuộc gọi kết nối đầu tiên', desc: 'KTV tư vấn xác nhận thông tin đăng ký quan tâm dòng BMW M4. Khách mong muốn tìm hiểu bản Competition.', date: '2026-07-01 10:15', icon: Phone, dotColor: 'from-cyan-500 to-blue-600', iconBg: 'bg-cyan-50 dark:bg-cyan-950/30', iconColor: 'text-cyan-600 dark:text-cyan-400' },
  { id: '3', type: 'stage_change', title: 'Chuyển sang: Lựa Chọn Xe', desc: 'Khách hàng đồng ý nhận tài liệu chi tiết kỹ thuật qua Zalo', date: '2026-07-02 09:00', duration: '24.5 giờ', icon: GitCommit, dotColor: 'from-violet-500 to-purple-600', iconBg: 'bg-violet-50 dark:bg-violet-950/30', iconColor: 'text-violet-600 dark:text-violet-400' },
  { id: '4', type: 'touchpoint', channel: 'zalo', title: 'Gửi báo giá & thông số', desc: 'Đã gửi file PDF thông số kỹ thuật M4 Competition Coupe São Paulo Yellow.', date: '2026-07-02 09:10', icon: MessageSquare, dotColor: 'from-emerald-500 to-teal-600', iconBg: 'bg-emerald-50 dark:bg-emerald-950/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { id: '5', type: 'stage_change', title: 'Chuyển sang: Hẹn Lái Thử', desc: 'Chốt lịch lái thử tại nhà riêng khách hàng vào thứ Bảy', date: '2026-07-04 14:00', duration: '53 giờ', icon: GitCommit, dotColor: 'from-purple-500 to-fuchsia-600', iconBg: 'bg-purple-50 dark:bg-purple-950/30', iconColor: 'text-purple-600 dark:text-purple-400' },
  { id: '6', type: 'touchpoint', channel: 'test_drive', title: 'Hoàn tất lái thử xe', desc: 'Trải nghiệm lái thử M4 15km đường hỗn hợp. Khách đánh giá phản hồi chân ga cực nhạy, hài lòng 9.5/10.', date: '2026-07-05 10:30', icon: Compass, dotColor: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-600 dark:text-amber-400' },
  { id: '7', type: 'stage_change', title: 'Chuyển sang: Thương Thảo', desc: 'Đàm phán về gói ưu đãi bảo hiểm và phụ kiện đi kèm', date: '2026-07-06 16:00', duration: '29.5 giờ', icon: GitCommit, dotColor: 'from-fuchsia-500 to-pink-600', iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', iconColor: 'text-fuchsia-600 dark:text-fuchsia-400' },
  { id: '8', type: 'stage_change', title: 'Chuyển sang: Đặt Cọc', desc: 'Khách ký thỏa thuận đặt cọc 200 triệu đồng.', date: '2026-07-10 11:00', duration: '91 giờ', icon: CheckCircle2, dotColor: 'from-emerald-500 to-green-600', iconBg: 'bg-emerald-50 dark:bg-emerald-950/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { id: '9', type: 'stage_change', title: 'Phân Bổ VIN — Thành công', desc: 'Khớp thành công VIN WBA53AZ04M8F12345 từ tổng kho.', date: '2026-07-12 15:30', duration: '52.5 giờ', icon: Sparkles, dotColor: 'from-amber-500 to-yellow-500', iconBg: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-600 dark:text-amber-400' },
];

// Group stages by category
const GROUPED_STAGES = JOURNEY_STAGES.reduce((acc, s) => {
  if (!acc[s.category]) acc[s.category] = [];
  acc[s.category].push(s);
  return acc;
}, {} as Record<string, typeof JOURNEY_STAGES>);

const CATEGORY_ORDER = ['Awareness', 'Consideration', 'Intent', 'Purchase', 'Retention', 'Loyalty'];

export default function CustomerJourneyPage() {
  const [activeTab, setActiveTab] = useState<'funnel' | 'heatmap' | 'timeline'>('funnel');
  const [selectedCustomerId, setSelectedCustomerId] = useState('Nguyễn Văn A');
  const [isPending, startTransition] = useTransition();

  const handleTriggerSLAMonitor = () => {
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 1000));
      toast.success('Hệ thống JourneySLAMonitorService đã hoàn tất quét 320 hành trình. Phát hiện 4 hành trình Breach SLA.');
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 dark:border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/15 dark:from-indigo-500/20 dark:to-purple-500/5 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">
              Hành Trình Khách Hàng & SLA Engine
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customer Journey Engine — Theo dõi phễu 22 giai đoạn và giám sát thời hạn SLA thời gian thực
            </p>
          </div>
        </div>

        <button 
          onClick={handleTriggerSLAMonitor}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white rounded-xl font-bold transition-all text-xs shadow-md hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
        >
          {isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isPending ? 'Đang quét SLA...' : 'Quét & Đồng Bộ SLA'}
        </button>
      </div>

      {/* Tabs (Segmented Control style) */}
      <div className="flex justify-start">
        <nav className="flex p-1.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl gap-1.5 shadow-sm">
          {[
            { key: 'funnel', label: 'Phễu Chuyển Đổi', icon: Layers },
            { key: 'heatmap', label: 'Biểu Đồ Tắc Nghẽn', icon: Flame },
            { key: 'timeline', label: 'Timeline CEO View', icon: Activity },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="min-h-[500px]"
        >

          {/* ── FUNNEL TAB ── */}
          {activeTab === 'funnel' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Left: Funnel progress */}
              <div className="lg:col-span-3 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/20 shadow-sm">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tỷ lệ rơi rụng qua 5 nhóm Giai Đoạn lớn</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Theo dõi conversion rate theo từng cụm hành trình</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {MOCK_FUNNEL_DATA.map((f, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${f.gradient}`} />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {f.stage}
                            <span className="text-slate-400 dark:text-slate-500 font-medium ml-1.5">({f.label})</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {f.fromPrev !== null && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-md">
                              ↓ {Math.abs(f.fromPrev)}%
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {f.count.toLocaleString()} leads
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 text-right">
                            {f.percent}%
                          </span>
                        </div>
                      </div>
                      <div className="h-4 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${f.percent}%` }}
                          transition={{ duration: 0.9, delay: idx * 0.1, ease: 'easeOut' }}
                          className={`h-full rounded-full bg-gradient-to-r ${f.gradient} opacity-90`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary stat row */}
                <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-900 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">8.8%</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Tỷ lệ chuyển đổi tổng</div>
                  </div>
                  <div className="text-center border-x border-slate-100 dark:border-slate-900">
                    <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">91h</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Thời gian TB mỗi phễu</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">4</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Breach SLA hiện tại</div>
                  </div>
                </div>
              </div>

              {/* Right: 22 giai đoạn phân cụm */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Mô hình 22 Giai đoạn chuẩn EIP</h3>
                <div className="space-y-4 overflow-y-auto max-h-[480px] pr-1">
                  {CATEGORY_ORDER.map(cat => {
                    const stages = GROUPED_STAGES[cat] || [];
                    const cfg = CATEGORY_CONFIG[cat];
                    let stageCounter = CATEGORY_ORDER.slice(0, CATEGORY_ORDER.indexOf(cat)).reduce((sum, c) => sum + (GROUPED_STAGES[c]?.length || 0), 0);
                    return (
                      <div key={cat}>
                        {/* Category header */}
                        <div className={`flex items-center gap-1.5 mb-2`}>
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[9px] text-slate-300 dark:text-slate-700 font-bold ml-auto">{stages.length} giai đoạn</span>
                        </div>
                        {/* Stage rows */}
                        <div className="space-y-1 mb-1">
                          {stages.map((s) => {
                            stageCounter++;
                            const num = stageCounter;
                            return (
                              <div key={s.code} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-4 h-4 rounded-full flex items-center justify-center font-extrabold text-[9px] shrink-0 border ${cfg.badge}`}>
                                    {num}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">{s.name}</span>
                                </div>
                                <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded px-1.5 py-0.5 shrink-0 ml-2 tabular-nums">{s.sla}h</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── HEATMAP TAB ── */}
          {activeTab === 'heatmap' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Heatmap cards */}
              <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100/30 dark:border-rose-900/20 shadow-sm">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Các điểm nóng gây Breach SLA</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Phân tích tắc nghẽn theo thời gian chờ trung bình</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {MOCK_HEATMAP_DATA.map((h, idx) => {
                    const isHigh = h.status === 'high';
                    const isMed = h.status === 'medium';
                    const cardStyle = isHigh
                      ? 'from-rose-50/60 to-red-100/20 dark:from-rose-950/25 dark:to-rose-900/10 border-rose-200/50 dark:border-rose-900/30'
                      : isMed
                      ? 'from-amber-50/60 to-yellow-100/20 dark:from-amber-950/25 dark:to-amber-900/10 border-amber-200/50 dark:border-amber-900/30'
                      : 'from-emerald-50/60 to-teal-100/20 dark:from-emerald-950/25 dark:to-emerald-900/10 border-emerald-200/50 dark:border-emerald-900/30';
                    const numColor = isHigh ? 'text-rose-600 dark:text-rose-400' : isMed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
                    const badgeStyle = isHigh ? 'bg-rose-600' : isMed ? 'bg-amber-500' : 'bg-emerald-600';
                    const statusLabel = isHigh ? '🔴 Nguy hiểm' : isMed ? '🟡 Cảnh báo' : '🟢 Ổn định';
                    return (
                      <div
                        key={idx}
                        className={`bg-gradient-to-br ${cardStyle} border rounded-2xl p-4 flex flex-col justify-between min-h-[130px] transition-all hover:-translate-y-0.5 hover:shadow-md`}
                      >
                        <div>
                          <span className={`text-[10px] font-extrabold inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white ${badgeStyle} mb-2.5`}>
                            {statusLabel}
                          </span>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{h.stage}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{h.desc}</p>
                        </div>
                        <div className="mt-3">
                          <span className={`text-2xl font-black ${numColor}`}>{h.hours}h</span>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Thời gian chờ trung bình</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* At-risk customers */}
              <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100/30 dark:border-amber-900/20 shadow-sm">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Khách hàng có nguy cơ cao</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Đang Breach SLA hoặc sắp vượt hạn xử lý</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Breached */}
                  <div className="p-4 bg-gradient-to-r from-rose-50/50 to-red-100/20 dark:from-rose-950/20 dark:to-rose-900/10 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">VĐH</div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Vương Đình H</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">BMW M4 — Ngân hàng giải ngân</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-rose-600 text-white font-extrabold px-2.5 py-1.5 rounded-xl shrink-0 shadow-sm">Breach +36h</span>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-amber-50/50 to-yellow-100/20 dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">THD</div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Trần Hoàng D</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">BMW X5 — Thương thảo</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-500 text-white font-extrabold px-2.5 py-1.5 rounded-xl shrink-0 shadow-sm">At Risk · còn 4h</span>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-amber-50/30 to-yellow-100/10 dark:from-amber-950/10 dark:to-amber-900/5 border border-amber-100/50 dark:border-amber-900/20 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">LTA</div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Lê Thị Anh</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">BMW 530i — Đóng thuế & ĐK</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-400 text-white font-extrabold px-2.5 py-1.5 rounded-xl shrink-0 shadow-sm">At Risk · còn 12h</span>
                  </div>

                  {/* Summary */}
                  <div className="mt-2 pt-5 border-t border-slate-100 dark:border-slate-900 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">1</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Breached</div>
                    </div>
                    <div className="border-x border-slate-100 dark:border-slate-900">
                      <div className="text-xl font-extrabold text-amber-500">2</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">At Risk</div>
                    </div>
                    <div>
                      <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">317</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">On Track</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TIMELINE TAB ── */}
          {activeTab === 'timeline' && (
            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">

              {/* Timeline header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-900 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/20 shadow-sm">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Timeline Hành Trình — CEO View</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Lịch sử toàn bộ sự kiện và điểm chạm của khách hàng</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Xem hành trình:</span>
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
                  >
                    <option value="Nguyễn Văn A">Nguyễn Văn A (BMW M4)</option>
                    <option value="Trần Thị B">Trần Thị B (BMW 330i)</option>
                  </select>
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/30 dark:border-emerald-900/20 px-2.5 py-1.5 rounded-xl">Đang hoạt động</span>
                </div>
              </div>

              {/* Event timeline */}
              <div className="relative pl-8 ml-4">
                {/* Dashed vertical line */}
                <div className="absolute left-0 top-0 bottom-0 w-px border-l-2 border-dashed border-slate-200/70 dark:border-slate-800/60" />

                <div className="space-y-7">
                  {MOCK_TIMELINE_EVENTS.map((ev, idx) => {
                    const Icon = ev.icon;
                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        className="relative group"
                      >
                        {/* Circle icon marker */}
                        <span className={`absolute -left-[41px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-950 bg-gradient-to-br ${ev.dotColor}`}>
                          <Icon className="w-3 h-3 text-white" />
                        </span>

                        {/* Event card */}
                        <div className="bg-slate-50/60 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/60 border border-slate-100/80 dark:border-slate-800/40 rounded-2xl p-4 transition-all duration-300 hover:shadow-sm hover:border-slate-200/50 dark:hover:border-slate-800/60">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-tight">{ev.title}</h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold shrink-0 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">
                              <Calendar className="w-3 h-3" />
                              {ev.date}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{ev.desc}</p>
                          {ev.duration && (
                            <div className="inline-flex items-center gap-1.5 mt-2.5 text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/30 dark:border-indigo-900/20 px-2.5 py-1 rounded-lg">
                              <Clock className="w-3 h-3" />
                              Thời gian ở giai đoạn trước: <span className="ml-0.5">{ev.duration}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
