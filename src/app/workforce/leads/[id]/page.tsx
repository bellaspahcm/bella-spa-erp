'use client';

import { use, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Phone, Mail, MessageSquare, Clock, Calendar, 
  User, CheckCircle, AlertTriangle, Send, Landmark, Trash2 
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ManagedLead, LeadOutcome, LeadState } from '@/platform/lead-engine/types';

const OUTCOME_OPTIONS: { value: LeadOutcome; label: string }[] = [
  { value: 'CONTACTED', label: 'Đã liên hệ thành công' },
  { value: 'NO_ANSWER', label: 'Không nghe máy' },
  { value: 'CALL_BACK', label: 'Hẹn gọi lại sau' },
  { value: 'INTERESTED', label: 'Quan tâm cao' },
  { value: 'VISIT', label: 'Hẹn đi xem nhà' },
  { value: 'BOOKING', label: 'Đặt cọc thành công' },
  { value: 'NOT_INTERESTED', label: 'Không quan tâm' },
  { value: 'INVALID', label: 'Sai số / Lead rác' },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params?.id as string;

  const [leads, setLeads] = useState<ManagedLead[]>([]);
  const [lead, setLead] = useState<ManagedLead | null>(null);
  const [newNote, setNewNote] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<LeadOutcome>('CONTACTED');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load leads from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bella_re_managed_leads');
    if (saved) {
      try {
        const parsed: ManagedLead[] = JSON.parse(saved);
        setLeads(parsed);
        const found = parsed.find(l => l.id === leadId);
        if (found) {
          setLead(found);
        } else {
          toast.error('Không tìm thấy thông tin Lead');
        }
      } catch (e) {
        console.error('[LeadDetail] Failed to parse leads:', e);
      }
    }
  }, [leadId]);

  const saveLeadUpdate = (updatedLead: ManagedLead) => {
    setLead(updatedLead);
    const nextLeads = leads.map(l => l.id === updatedLead.id ? updatedLead : l);
    setLeads(nextLeads);
    localStorage.setItem('bella_re_managed_leads', JSON.stringify(nextLeads));
  };

  // Submit outcome & log followup
  const handleLogFollowup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setIsSubmitting(true);

    const now = new Date().toISOString();
    
    // Determine next state based on outcome
    let nextState: LeadState = lead.state;
    if (selectedOutcome === 'BOOKING') {
      nextState = 'converted';
    } else if (['LOST', 'NOT_INTERESTED', 'INVALID', 'BLACKLIST'].includes(selectedOutcome)) {
      nextState = 'lost';
    } else if (lead.state === 'waiting_accept') {
      nextState = 'in_progress';
    }

    const eventDesc = `Ghi nhận chăm sóc: ${OUTCOME_OPTIONS.find(o => o.value === selectedOutcome)?.label || selectedOutcome}. Ghi chú: ${newNote || 'Không có ghi chú'}`;

    const updatedLead: ManagedLead = {
      ...lead,
      state: nextState,
      currentOutcome: selectedOutcome,
      noAnswerCount: selectedOutcome === 'NO_ANSWER' ? lead.noAnswerCount + 1 : lead.noAnswerCount,
      updatedAt: now,
      notes: newNote ? `${newNote}\n\n${lead.notes || ''}` : lead.notes,
      auditTimeline: [
        {
          id: `evt-${Date.now()}`,
          leadId: lead.id,
          eventType: 'followup_logged',
          actorId: 'sale-current',
          actorName: 'Bạn',
          description: eventDesc,
          timestamp: now,
        },
        ...lead.auditTimeline,
      ],
    };

    // Update SLA timer if stage changes
    if (updatedLead.activeSLATimer) {
      updatedLead.activeSLATimer = {
        ...updatedLead.activeSLATimer,
        isCompleted: selectedOutcome === 'BOOKING' || nextState === 'lost',
        completedAt: selectedOutcome === 'BOOKING' || nextState === 'lost' ? now : undefined,
      };
    }

    saveLeadUpdate(updatedLead);
    setNewNote('');
    setIsSubmitting(false);
    toast.success('Lịch sử cuộc gọi đã được ghi nhận!');
  };

  if (!lead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Đang tải thông tin chi tiết...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-12">
      {/* Top navbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-150 dark:border-gray-700 px-4 py-4 flex items-center gap-3 sticky top-0 z-50">
        <button 
          onClick={() => router.back()}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-md font-bold text-gray-900 dark:text-white truncate">
          Chi tiết: {lead.fullName}
        </h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                Nguồn: {lead.source}
              </span>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1.5">{lead.fullName}</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{lead.interestedProject || 'Chưa có dự án'}</p>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
              lead.state === 'converted' 
                ? 'bg-emerald-50 border-emerald-250 text-emerald-600'
                : lead.state === 'lost'
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>
              {lead.state === 'waiting_accept' ? 'Chờ nhận' : lead.state === 'in_progress' ? 'Đang chăm' : lead.state === 'converted' ? 'Đã chốt cọc' : 'Đã đóng'}
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-750 pt-4 text-xs">
            <div>
              <span className="text-gray-400 block font-semibold text-[10px] uppercase">Số điện thoại</span>
              <a href={`tel:${lead.phone}`} className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5" />
                {lead.phone}
              </a>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold text-[10px] uppercase">Email</span>
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5" />
                  {lead.email}
                </a>
              ) : (
                <span className="text-gray-500 mt-0.5 block">—</span>
              )}
            </div>
            <div>
              <span className="text-gray-400 block font-semibold text-[10px] uppercase">Ngân sách</span>
              <span className="font-bold text-gray-700 dark:text-gray-300 mt-0.5 block">
                {lead.budget || 'Chưa cung cấp'}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold text-[10px] uppercase">Ngày tạo</span>
              <span className="font-medium text-gray-600 dark:text-gray-400 mt-0.5 block">
                {lead.createdAt}
              </span>
            </div>
          </div>
        </div>

        {/* Action Form */}
        {lead.state !== 'converted' && lead.state !== 'lost' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Ghi nhận kết quả chăm sóc
            </h3>
            
            <form onSubmit={handleLogFollowup} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                  Kết quả cuộc gọi / sự kiện
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedOutcome(opt.value)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-all ${
                        selectedOutcome === opt.value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                  Ghi chú chăm sóc chi tiết
                </label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ví dụ: Khách hàng đồng ý tham quan nhà mẫu vào thứ Bảy tuần này..."
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-24 resize-none outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Lưu thông tin chăm sóc</span>
              </button>
            </form>
          </div>
        )}

        {/* Activity Stream (Timeline) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Trục hoạt động (Timeline)
          </h3>

          <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3.5 pl-6 space-y-6 text-sm">
            {lead.auditTimeline.map((evt, idx) => (
              <div key={evt.id || idx} className="relative">
                {/* Timeline node */}
                <div className="absolute -left-9.5 top-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 w-7 h-7 rounded-full flex items-center justify-center border border-white dark:border-gray-800 text-xs font-bold shadow-sm">
                  {idx + 1}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {evt.actorName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {new Date(evt.timestamp).toLocaleDateString('vi-VN')} {new Date(evt.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                    {evt.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
