'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Phone, Mail, Clock, Search, Filter, ShieldCheck,
  ChevronRight, ChevronLeft, CheckCircle2, PhoneCall, Eye, Award, Check,
  UserPlus, MessageSquare, Calendar, X, AlertTriangle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface AuditLog {
  id: string;
  leadId: string;
  eventType: string;
  actorId: string;
  actorName: string;
  description: string;
  timestamp: string;
}

interface SLATimer {
  id: string;
  leadId: string;
  stage: 'accept' | 'followup_1' | 'followup_2';
  startTime: string;
  deadlineTime: string;
  isBreached: boolean;
  isCompleted: boolean;
}

interface ManagedLead {
  id: string;
  tenantId: string;
  moduleKey: string;
  fullName: string;
  phone: string;
  email: string;
  source: string;
  interestedProject: string;
  budget: string;
  state: 'unassigned' | 'waiting_accept' | 'in_progress' | 'converted' | 'lost' | 'archived';
  currentOutcome: string;
  currentSaleId: string;
  currentSaleName: string;
  assignedAt: string;
  acceptedAt?: string;
  noAnswerCount: number;
  rotationCount: number;
  rotationHistory: any[];
  auditTimeline: AuditLog[];
  activeSLATimer?: SLATimer;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const INITIAL_MOCK_LEADS: ManagedLead[] = [
  {
    id: 'lead-001',
    tenantId: 'real_estate',
    moduleKey: 'real_estate',
    fullName: 'Nguyễn Văn Minh',
    phone: '0901234567',
    email: 'minh.nv@gmail.com',
    source: 'facebook',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '5 – 8 tỷ',
    state: 'waiting_accept',
    currentOutcome: 'NEW',
    currentSaleId: 'sale-001',
    currentSaleName: 'Nguyễn Văn A',
    assignedAt: new Date().toISOString(),
    noAnswerCount: 0,
    rotationCount: 0,
    rotationHistory: [],
    auditTimeline: [
      {
        id: 'evt-001',
        leadId: 'lead-001',
        eventType: 'lead_assigned',
        actorId: 'admin-01',
        actorName: 'Admin Hệ Thống',
        description: 'Đã phân bổ Lead cho Sale [Nguyễn Văn A]. Hạn chót nhận lead: 30 phút.',
        timestamp: new Date().toISOString(),
      },
    ],
    activeSLATimer: {
      id: 'sla-001',
      leadId: 'lead-001',
      stage: 'accept',
      startTime: new Date().toISOString(),
      deadlineTime: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      isBreached: false,
      isCompleted: false,
    },
    notes: 'Khách quan tâm căn góc tầng cao, cần tư vấn thêm pháp lý.',
    createdAt: '2026-07-28',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-002',
    tenantId: 'real_estate',
    moduleKey: 'real_estate',
    fullName: 'Trần Thị Lan',
    phone: '0912345678',
    email: 'lan.tt@outlook.com',
    source: 'zalo',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '3 – 5 tỷ',
    state: 'in_progress',
    currentOutcome: 'CONTACTED',
    currentSaleId: 'sale-002',
    currentSaleName: 'Trần Thị B',
    assignedAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    noAnswerCount: 0,
    rotationCount: 0,
    rotationHistory: [],
    auditTimeline: [
      {
        id: 'evt-002',
        leadId: 'lead-002',
        eventType: 'lead_accepted',
        actorId: 'sale-002',
        actorName: 'Trần Thị B',
        description: 'Sale [Trần Thị B] đã bấm Nhận Lead thành công.',
        timestamp: new Date().toISOString(),
      },
    ],
    activeSLATimer: {
      id: 'sla-002',
      leadId: 'lead-002',
      stage: 'followup_1',
      startTime: new Date().toISOString(),
      deadlineTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      isBreached: false,
      isCompleted: false,
    },
    notes: 'Đã gọi điện xác nhận. Hẹn gặp trực tiếp thứ 6.',
    createdAt: '2026-07-29',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-003',
    tenantId: 'real_estate',
    moduleKey: 'real_estate',
    fullName: 'Phạm Hùng Cường',
    phone: '0923456789',
    email: 'cuong.ph@company.vn',
    source: 'referral',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '8 – 12 tỷ',
    state: 'converted',
    currentOutcome: 'BOOKING',
    currentSaleId: 'sale-003',
    currentSaleName: 'Lê Hoàng C',
    assignedAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    noAnswerCount: 0,
    rotationCount: 0,
    rotationHistory: [],
    auditTimeline: [
      {
        id: 'evt-003',
        leadId: 'lead-003',
        eventType: 'lead_converted',
        actorId: 'sale-003',
        actorName: 'Lê Hoàng C',
        description: 'Chúc mừng! Lead đã chốt thành công Booking / Hợp đồng căn A1-301.',
        timestamp: new Date().toISOString(),
      },
    ],
    notes: 'Đã ký HĐMB căn A1-301. Khách VIP.',
    createdAt: '2026-07-25',
    updatedAt: new Date().toISOString(),
  },
];

export default function LeadsPipeline() {
  const [leads, setLeads] = useState<ManagedLead[]>([]);
  const [selectedTab, setSelectedTab] = useState<'waiting_accept' | 'in_progress' | 'converted' | 'lost'>('waiting_accept');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<ManagedLead | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'lost' | 'converted' | 'notes'>('accept');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bella_re_managed_leads');
    if (saved) {
      try {
        setLeads(JSON.parse(saved));
      } catch {
        setLeads(INITIAL_MOCK_LEADS);
      }
    } else {
      setLeads(INITIAL_MOCK_LEADS);
      localStorage.setItem('bella_re_managed_leads', JSON.stringify(INITIAL_MOCK_LEADS));
    }
  }, []);

  const saveLeads = (updatedLeads: ManagedLead[]) => {
    setLeads(updatedLeads);
    localStorage.setItem('bella_re_managed_leads', JSON.stringify(updatedLeads));
  };

  const handleAcceptLead = (leadId: string) => {
    const nextLeads = leads.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          state: 'in_progress' as const,
          acceptedAt: new Date().toISOString(),
          auditTimeline: [
            ...l.auditTimeline,
            {
              id: `evt-${Date.now()}`,
              leadId: l.id,
              eventType: 'lead_accepted',
              actorId: 'me',
              actorName: 'Tôi',
              description: 'Nhân viên kinh doanh đã bấm xác nhận nhận lead.',
              timestamp: new Date().toISOString()
            }
          ],
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    });
    saveLeads(nextLeads);
    toast.success('Đã nhận lead thành công! Bắt đầu liên hệ.');
  };

  const handleUpdateOutcome = (leadId: string, state: ManagedLead['state'], desc: string) => {
    const nextLeads = leads.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          state,
          notes: desc || l.notes,
          auditTimeline: [
            ...l.auditTimeline,
            {
              id: `evt-${Date.now()}`,
              leadId: l.id,
              eventType: state === 'converted' ? 'lead_converted' : state === 'lost' ? 'lead_lost' : 'lead_updated',
              actorId: 'me',
              actorName: 'Tôi',
              description: desc || `Cập nhật trạng thái lead thành ${state}.`,
              timestamp: new Date().toISOString()
            }
          ],
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    });
    saveLeads(nextLeads);
    setShowActionModal(false);
    setActionNotes('');
    toast.success('Cập nhật trạng thái lead thành công!');
  };

  const filteredLeads = leads.filter(l => {
    const matchesTab = l.state === selectedTab;
    const matchesSearch = l.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.phone.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  const getSlaStatus = (lead: ManagedLead) => {
    if (!lead.activeSLATimer) return null;
    const deadline = new Date(lead.activeSLATimer.deadlineTime).getTime();
    const now = Date.now();
    const diff = deadline - now;
    if (diff <= 0) return { label: 'Quá SLA', cls: 'text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-950/20' };
    const mins = Math.floor(diff / 60000);
    return { label: `SLA: ${mins}p`, cls: 'text-amber-600 bg-amber-50 border-amber-250 dark:bg-amber-950/20' };
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Quản Lý Leads</h2>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl py-3 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Swipe tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { value: 'waiting_accept', label: 'Chờ nhận' },
            { value: 'in_progress', label: 'Đang chăm' },
            { value: 'converted', label: 'Đã chốt' },
            { value: 'lost', label: 'Đã đóng' }
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setSelectedTab(t.value as any)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedTab === t.value ? 'bg-primary border-primary text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-850 hover:border-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIST OF LEADS */}
      <div className="p-5 space-y-3.5">
        {filteredLeads.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Không có Lead nào</p>
          </div>
        ) : (
          filteredLeads.map(lead => {
            const sla = getSlaStatus(lead);
            return (
              <div 
                key={lead.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm space-y-3.5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black text-slate-850 dark:text-slate-150">{lead.fullName}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{lead.interestedProject}</p>
                  </div>
                  {sla && (
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${sla.cls}`}>
                      {sla.label}
                    </span>
                  )}
                </div>

                <div className="text-[11px] space-y-1.5 text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800/60 pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lead.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ngân sách: <strong>{lead.budget}</strong></span>
                  </div>
                </div>

                {/* Lead Actions */}
                <div className="flex gap-2 pt-1 border-t border-slate-50 dark:border-slate-800/60">
                  <button 
                    onClick={() => { setSelectedLead(lead); setShowDetailModal(true); }}
                    className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Xem lịch sử
                  </button>

                  {lead.state === 'waiting_accept' && (
                    <button 
                      onClick={() => handleAcceptLead(lead.id)}
                      className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                    >
                      Nhận Lead
                    </button>
                  )}

                  {lead.state === 'in_progress' && (
                    <>
                      <button 
                        onClick={() => { setSelectedLead(lead); setActionType('lost'); setShowActionModal(true); }}
                        className="py-2.5 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                      >
                        Báo Hủy
                      </button>
                      <button 
                        onClick={() => { setSelectedLead(lead); setActionType('converted'); setShowActionModal(true); }}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                      >
                        Chốt Cọc
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DETAIL MODAL (TIMELINE & HISTORY) */}
      {showDetailModal && selectedLead && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[36px] p-6 pb-12 space-y-4 max-h-[85vh] overflow-y-auto animate-[slideUp_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedLead.fullName}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trục thời gian chăm sóc</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Notes Section */}
            {selectedLead.notes && (
              <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ghi chú hiện tại</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{selectedLead.notes}</p>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-4 pt-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhật ký hoạt động</h4>
              <div className="relative border-l border-slate-100 dark:border-slate-800 pl-4 ml-2 space-y-4">
                {selectedLead.auditTimeline.map(evt => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-slate-900" />
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 font-bold">
                        {new Date(evt.timestamp).toLocaleString('vi-VN')}
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-black">{evt.actorName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-450">{evt.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODAL (CONVERT / LOST) */}
      {showActionModal && selectedLead && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[36px] p-6 pb-12 space-y-4 animate-[slideUp_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {actionType === 'converted' ? 'Xác nhận Chốt Cọc' : 'Báo Hủy / Đóng Lead'}
              </h3>
              <button 
                onClick={() => setShowActionModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {actionType === 'converted' 
                  ? 'Cập nhật giao dịch thành công cho khách hàng. Vui lòng nhập số căn hộ chốt và thông tin bổ sung.' 
                  : 'Vui lòng điền lý do khách từ chối chăm sóc hoặc hủy giao dịch.'}
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ghi chú & Lý do *</label>
                <textarea
                  required
                  placeholder={actionType === 'converted' ? 'VD: Chốt thành công căn góc Block A2-105.' : 'VD: Khách báo không có nhu cầu nữa, hoặc giá quá cao...'}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                onClick={() => handleUpdateOutcome(selectedLead.id, actionType === 'converted' ? 'converted' : 'lost', actionNotes)}
                disabled={!actionNotes.trim()}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 text-white ${actionType === 'converted' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
