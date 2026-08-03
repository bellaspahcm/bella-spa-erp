'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommit,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sliders,
  Filter,
  Layers,
  Activity,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Compass,
  ArrowRight,
  Flame,
  Calendar,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

// 22 Giai đoạn Hành Trình Ô Tô chuẩn EIP
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

const MOCK_FUNNEL_DATA = [
  { stage: 'Awareness (Nhận diện)', count: 320, percent: 100, color: 'bg-indigo-500' },
  { stage: 'Consideration (Cân nhắc)', count: 180, percent: 56, color: 'bg-violet-500' },
  { stage: 'Intent (Đặt cọc)', count: 90, percent: 28, color: 'bg-purple-500' },
  { stage: 'Purchase (Bàn giao)', count: 45, percent: 14, color: 'bg-fuchsia-500' },
  { stage: 'Retention (Loyalty)', count: 28, percent: 8, color: 'bg-pink-500' },
];

// Thời gian nghẽn trung bình tại từng Stage (Giờ) để vẽ Heatmap
const MOCK_HEATMAP_DATA = [
  { stage: 'Thương Thảo', hours: 84, status: 'high' },
  { stage: 'Giải Ngân', hours: 112, status: 'high' },
  { stage: 'Phân Bổ VIN', hours: 12, status: 'low' },
  { stage: 'Hẹn Lái Thử', hours: 38, status: 'medium' },
  { stage: 'Xác Định Nhu Cầu', hours: 45, status: 'medium' },
  { stage: 'Đóng Thuế & ĐK', hours: 68, status: 'medium' },
];

// Dòng sự kiện hành trình chi tiết của 1 khách hàng tiêu biểu
const MOCK_TIMELINE_EVENTS = [
  { id: '1', type: 'stage_change', title: 'Khởi tạo hành trình', desc: 'Hệ thống tự động nhận dạng Lead mới từ Website Facebook Lead Ads', date: '2026-07-01 08:30', duration: null, icon: GitCommit, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' },
  { id: '2', type: 'touchpoint', channel: 'call', title: 'Cuộc gọi kết nối đầu tiên', desc: 'KTV tư vấn xác nhận thông tin đăng ký quan tâm dòng BMW M4. Khách mong muốn tìm hiểu bản Competition.', date: '2026-07-01 10:15', icon: Phone, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { id: '3', type: 'stage_change', title: 'Chuyển sang: Lựa Chọn Xe', desc: 'Khách hàng đồng ý nhận tài liệu chi tiết kỹ thuật qua Zalo', date: '2026-07-02 09:00', duration: '24.5 giờ', icon: GitCommit, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  { id: '4', type: 'touchpoint', channel: 'zalo', title: 'Gửi báo giá & thông số', desc: 'Đã gửi file PDF thông số kỹ thuật M4 Competition Coupe São Paulo Yellow.', date: '2026-07-02 09:10', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
  { id: '5', type: 'stage_change', title: 'Chuyển sang: Hẹn Lái Thử', desc: 'Chốt lịch lái thử tại nhà riêng khách hàng vào thứ Bảy', date: '2026-07-04 14:00', duration: '53 giờ', icon: GitCommit, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/30' },
  { id: '6', type: 'touchpoint', channel: 'test_drive', title: 'Hoàn tất lái thử xe', desc: 'Trải nghiệm lái thử M4 15km đường hỗn hợp. Khách đánh giá phản hồi chân ga cực nhạy, hài lòng 9.5/10.', date: '2026-07-05 10:30', icon: Compass, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  { id: '7', type: 'stage_change', title: 'Chuyển sang: Thương Thảo', desc: 'Đàm phán về gói ưu đãi bảo hiểm và phụ kiện đi kèm', date: '2026-07-06 16:00', duration: '29.5 giờ', icon: GitCommit, color: 'text-pink-500 bg-pink-50 dark:bg-pink-950/30' },
  { id: '8', type: 'stage_change', title: 'Chuyển sang: Đặt Cọc', desc: 'Khách ký thỏa thuận đặt cọc 200 triệu đồng.', date: '2026-07-10 11:00', duration: '91 giờ', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { id: '9', type: 'stage_change', title: 'Chuyển sang: Phân Bổ VIN (Thành công)', desc: 'Khớp thành công VIN WBA53AZ04M8F12345 từ tổng kho.', date: '2026-07-12 15:30', duration: '52.5 giờ', icon: Sparkles, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
];

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
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            Hành Trình Khách Hàng & SLA Engine
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Customer Journey Engine — Theo dõi phễu 22 giai đoạn và giám sát thời hạn SLA thời gian thực
          </p>
        </div>
        <button 
          onClick={handleTriggerSLAMonitor}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-bold transition-all text-xs shadow-sm"
        >
          <Clock className="w-4 h-4" /> 
          {isPending ? 'Đang quét SLA...' : 'Quét & Đồng Bộ SLA'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('funnel')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 ${activeTab === 'funnel' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Phễu Chuyển Đổi (Funnel)
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 ${activeTab === 'heatmap' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Biểu Đồ Tắc Nghẽn (Heatmap)
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 ${activeTab === 'timeline' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Timeline Khách Hàng (CEO View)
        </button>
      </div>

      {/* Tab Contents */}
      <div className="min-h-[450px]">
        {activeTab === 'funnel' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Phễu trực quan */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                Tỷ lệ rơi rụng qua 5 nhóm Giai Đoạn lớn
              </h3>
              
              <div className="space-y-5 pt-4">
                {MOCK_FUNNEL_DATA.map((f, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">{f.stage}</span>
                      <span className="text-slate-900 dark:text-white">{f.count} leads ({f.percent}%)</span>
                    </div>
                    <div className="h-6.5 w-full bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${f.percent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`${f.color} h-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chú thích 22 giai đoạn EIP */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider">Mô hình 22 Giai đoạn chuẩn EIP</h3>
              <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                {JOURNEY_STAGES.map((s, idx) => (
                  <div key={s.code} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold text-[10px]">{idx + 1}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{s.name}</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 rounded px-1.5 py-0.5 font-bold">SLA: {s.sla}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                Các điểm nóng dễ gây Breach SLA (Tắc nghẽn)
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {MOCK_HEATMAP_DATA.map((h, idx) => (
                  <div 
                    key={idx} 
                    className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-all ${
                      h.status === 'high' 
                        ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50' 
                        : h.status === 'medium'
                        ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
                        : 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-850 dark:text-slate-200">{h.stage}</span>
                    <div>
                      <span className="text-2xl font-black block mt-1">{h.hours}h</span>
                      <span className="text-[10px] text-slate-400 font-bold">Thời gian chờ TB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Khách hàng có nguy cơ cao (At Risk / Breached)
              </h3>
              <div className="space-y-3 pt-2">
                <div className="p-3.5 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-150/50 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs">Vương Đình H (BMW M4)</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Giai đoạn: Ngân hàng giải ngân</p>
                  </div>
                  <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-1 rounded-lg">Breached +36h</span>
                </div>
                <div className="p-3.5 bg-amber-50/30 dark:bg-amber-950/10 border border-amber-150/50 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs">Trần Hoàng D (BMW X5)</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Giai đoạn: Thương Thảo</p>
                  </div>
                  <span className="text-[10px] bg-amber-600 text-white font-black px-2 py-1 rounded-lg">At Risk (Còn 4h)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Đang xem:</span>
                <select 
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="px-3 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none"
                >
                  <option value="Nguyễn Văn A">Nguyễn Văn A (BMW M4)</option>
                  <option value="Trần Thị B">Trần Thị B (BMW 330i)</option>
                </select>
              </div>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg">Đang hoạt động</span>
            </div>

            {/* Dòng sự kiện */}
            <div className="relative pl-6 space-y-8 border-l border-slate-200 dark:border-slate-800 ml-4 py-2">
              {MOCK_TIMELINE_EVENTS.map(ev => {
                const Icon = ev.icon;
                return (
                  <div key={ev.id} className="relative group">
                    {/* Circle icon marker */}
                    <span className={`absolute -left-9 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border border-white dark:border-slate-900 ${ev.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    
                    <div className="space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{ev.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {ev.date}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{ev.desc}</p>
                      {ev.duration && (
                        <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-indigo-500">
                          <Clock className="w-3 h-3" />
                          Thời gian ở giai đoạn trước: {ev.duration}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
