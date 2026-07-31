'use client';

import React, { useState, useMemo } from 'react';
import {
  Megaphone, UserPlus, Phone, Mail, Clock,
  Filter, Search, ChevronRight,
  CheckCircle2, Zap, Settings, ArrowRightLeft, Eye, PhoneCall,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  LeadEngineFacade,
  ManagedLead,
  LeadOutcome,
  SalesAgent,
  LeadRuleConfig,
} from '@/platform/lead-engine';

import { LeadSLABadge } from '@/components/lead-engine/LeadSLABadge';
import { LeadTimelineDrawer } from '@/components/lead-engine/LeadTimelineDrawer';
import { LeadActionModal } from '@/components/lead-engine/LeadActionModal';
import { LeadRuleConfigTab } from '@/components/lead-engine/LeadRuleConfigTab';

// ─── Available Sales Agents ───────────────────────────────────────────────────
const AVAILABLE_SALES: SalesAgent[] = [
  { id: 'sale-001', name: 'Nguyễn Văn A', role: 'Senior Sales Specialist' },
  { id: 'sale-002', name: 'Trần Thị B', role: 'Real Estate Consultant' },
  { id: 'sale-003', name: 'Lê Hoàng C', role: 'Sales Executive' },
  { id: 'sale-004', name: 'Phạm Thanh D', role: 'Junior Agent' },
];

// ─── Mock Managed Leads ───────────────────────────────────────────────────────
const INITIAL_MANAGED_LEADS: ManagedLead[] = [
  {
    id: 'lead-001',
    tenantId: 'tenant-re-01',
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
    tenantId: 'tenant-re-01',
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
    tenantId: 'tenant-re-01',
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
        description: '🎉 Chúc mừng! Lead đã chốt thành công Booking / Hợp đồng căn A1-301.',
        timestamp: new Date().toISOString(),
      },
    ],
    notes: 'Đã ký HĐMB căn A1-301. Khách VIP.',
    createdAt: '2026-07-25',
    updatedAt: new Date().toISOString(),
  },
];

const SOURCE_LABELS: Record<string, string> = {
  facebook: '📘 Facebook Ads',
  zalo:     '💬 Zalo OA',
  referral: '🤝 Người giới thiệu',
  website:  '🌐 Website',
  event:    '🎪 Sự kiện',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RealEstateMarketingPage() {
  const [leadEngine] = useState(() => new LeadEngineFacade());
  const [leads, setLeads] = useState<ManagedLead[]>(INITIAL_MANAGED_LEADS);

  // Tab & View Controls
  const [activeTab, setActiveTab] = useState<'pipeline' | 'rules'>('pipeline');
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  
  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [timelineLead, setTimelineLead] = useState<ManagedLead | null>(null);
  const [actionLead, setActionLead] = useState<ManagedLead | null>(null);

  // Form State
  const [newLead, setNewLead] = useState({
    fullName: '',
    phone: '',
    email: '',
    source: 'facebook',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '',
    notes: '',
  });

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    return {
      total: leads.length,
      waiting: leads.filter(l => l.state === 'waiting_accept').length,
      inProgress: leads.filter(l => l.state === 'in_progress').length,
      converted: leads.filter(l => l.state === 'converted').length,
      rotated: leads.filter(l => l.rotationCount > 0).length,
    };
  }, [leads]);

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch =
        l.fullName.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search) ||
        (l.email && l.email.toLowerCase().includes(search.toLowerCase()));
      const matchState = filterState === 'all' || l.state === filterState;
      return matchSearch && matchState;
    });
  }, [leads, search, filterState]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newLead.fullName.trim() || !newLead.phone.trim()) {
      toast.error('Vui lòng nhập Họ tên và Số điện thoại');
      return;
    }

    const assignedSale = AVAILABLE_SALES[Math.floor(Math.random() * AVAILABLE_SALES.length)];

    let createdLead: ManagedLead = {
      id: `lead-${Date.now()}`,
      tenantId: 'tenant-re-01',
      moduleKey: 'real_estate',
      fullName: newLead.fullName.trim(),
      phone: newLead.phone.trim(),
      email: newLead.email.trim() || 'chua_co_email@domain.com',
      source: newLead.source,
      interestedProject: newLead.interestedProject,
      budget: newLead.budget.trim() || 'Chưa xác định',
      state: 'unassigned',
      currentOutcome: 'NEW',
      noAnswerCount: 0,
      rotationCount: 0,
      rotationHistory: [],
      auditTimeline: [],
      notes: newLead.notes.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };

    // Phân bổ Lead & Kích hoạt Accept SLA qua Engine
    createdLead = leadEngine.assignmentEngine.assignLead(
      createdLead,
      assignedSale,
      'admin-01',
      'Admin Marketing'
    );

    setLeads(prev => [createdLead, ...prev]);
    toast.success(`Đã tạo và phân lead cho Sale [${assignedSale.name}]! (SLA: 30 ph)`);
    setShowAddModal(false);
    setNewLead({
      fullName: '',
      phone: '',
      email: '',
      source: 'facebook',
      interestedProject: 'Elyse Island – Shophouse Marina',
      budget: '',
      notes: '',
    });
  }

  function handleAcceptLead(leadId: string) {
    setLeads(prev =>
      prev.map(lead => {
        if (lead.id !== leadId) return lead;
        const updated = leadEngine.workflowEngine.acceptLead(
          lead,
          lead.currentSaleId || 'sale-001',
          lead.currentSaleName || 'Sale'
        );
        toast.success(`Sale [${lead.currentSaleName}] đã xác nhận nhận lead! SLA Followup #1 được kích hoạt.`);
        return updated;
      })
    );
  }

  function handleSubmitOutcome(leadId: string, outcome: LeadOutcome, notes: string) {
    setLeads(prev =>
      prev.map(lead => {
        if (lead.id !== leadId) return lead;
        const updated = leadEngine.workflowEngine.submitOutcome(
          lead,
          outcome,
          notes,
          lead.currentSaleId || 'sale-001',
          lead.currentSaleName || 'Sale Specialist',
          AVAILABLE_SALES
        );

        if (updated.state === 'converted') {
          toast.success(`🎉 Tuyệt vời! Lead ${lead.fullName} đã chốt Booking thành công!`);
        } else if (updated.rotationCount > lead.rotationCount) {
          toast.warning(`🔄 Lead ${lead.fullName} đã tự động xoay sang Sale [${updated.currentSaleName}]!`);
        } else {
          toast.info(`Đã lưu kết quả [${outcome}] cho Lead ${lead.fullName}.`);
        }
        return updated;
      })
    );
  }

  function handleUpdateRulesConfig(newConfig: LeadRuleConfig) {
    leadEngine.ruleEngine.updateConfig(newConfig);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/40">
              <Megaphone className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </span>
            Marketing &amp; Lead Governance Subsystem
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Phân phối Lead • SLA Engine • Auto Rotation • Timelines Audit Trail
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Tab Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'pipeline'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Lead Pipeline
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'rules'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Cấu Hình SLA &amp; Rules
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            Thêm Lead
          </button>
        </div>
      </div>

      {/* ── Main Tab 1: Lead Pipeline ── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold">Tổng Số Lead</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-500/20 shadow-sm">
              <p className="text-xs text-amber-600 font-semibold">⏳ Chờ Sale Nhận</p>
              <p className="text-xl font-bold text-amber-600 mt-1">{stats.waiting}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-500/20 shadow-sm">
              <p className="text-xs text-blue-600 font-semibold">📞 Đang Chăm Sóc</p>
              <p className="text-xl font-bold text-blue-600 mt-1">{stats.inProgress}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
              <p className="text-xs text-emerald-600 font-semibold">🎉 Đã Chốt HĐ (Booking)</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{stats.converted}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-purple-500/20 shadow-sm col-span-2 sm:col-span-1">
              <p className="text-xs text-purple-600 font-semibold">🔄 Đã Xoay Vòng</p>
              <p className="text-xl font-bold text-purple-600 mt-1">{stats.rotated}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, SĐT, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterState}
                onChange={e => setFilterState(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-medium"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="waiting_accept">⏳ Chờ nhận lead</option>
                <option value="in_progress">📞 Đang chăm sóc</option>
                <option value="converted">🎉 Đã chốt HĐ</option>
                <option value="lost">❌ Thất bại / Đóng</option>
                <option value="archived">🔒 Đã xoay hết vòng (Archived)</option>
              </select>
            </div>
          </div>

          {/* Lead Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Khách Hàng</th>
                  <th className="p-4">Dự Án / Nguồn</th>
                  <th className="p-4">Sale Phụ Trách</th>
                  <th className="p-4">SLA Engine Status</th>
                  <th className="p-4">Kết Quả Cuối</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      Không tìm thấy Lead phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{lead.fullName}</p>
                        <p className="text-slate-500">{lead.phone} • {lead.email || 'N/A'}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{lead.interestedProject || 'Chưa chọn'}</p>
                        <span className="inline-block mt-0.5 text-[11px] text-slate-400">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-semibold text-violet-600 dark:text-violet-400">
                          <span>{lead.currentSaleName || 'Chưa phân'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <LeadSLABadge lead={lead} slaEngine={leadEngine.slaEngine} />
                      </td>
                      <td className="p-4 font-semibold">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                          {lead.currentOutcome}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {lead.state === 'waiting_accept' && (
                          <button
                            onClick={() => handleAcceptLead(lead.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition active:scale-95 inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Nhận Lead
                          </button>
                        )}
                        {lead.state === 'in_progress' && (
                          <button
                            onClick={() => setActionLead(lead)}
                            className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition active:scale-95 inline-flex items-center gap-1"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Chăm Sóc
                          </button>
                        )}
                        <button
                          onClick={() => setTimelineLead(lead)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          Timeline
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Main Tab 2: Admin SLA & Rules Config ── */}
      {activeTab === 'rules' && (
        <LeadRuleConfigTab
          initialConfig={leadEngine.ruleEngine.getConfig()}
          onSaveConfig={handleUpdateRulesConfig}
        />
      )}

      {/* ── Modal: Thêm Lead Mới ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-600" />
                Thêm Lead Khách Hàng Mới
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Họ và Tên *</label>
                  <input
                    type="text"
                    required
                    value={newLead.fullName}
                    onChange={e => setNewLead({ ...newLead, fullName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Số Điện Thoại *</label>
                  <input
                    type="text"
                    required
                    value={newLead.phone}
                    onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    placeholder="0912345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    placeholder="khachhang@email.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Nguồn Lead</label>
                  <select
                    value={newLead.source}
                    onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  >
                    <option value="facebook">📘 Facebook Ads</option>
                    <option value="zalo">💬 Zalo OA / Personal</option>
                    <option value="referral">🤝 Người giới thiệu</option>
                    <option value="website">🌐 Form Website</option>
                    <option value="event">🎪 Sự kiện mở bán</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Dự Án Quan Tâm</label>
                  <select
                    value={newLead.interestedProject}
                    onChange={e => setNewLead({ ...newLead, interestedProject: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  >
                    <option value="Elyse Island – Shophouse Marina">Elyse Island – Shophouse Marina</option>
                    <option value="Vinhomes Saigon Park">Vinhomes Saigon Park</option>
                    <option value="Bella Gold Tower">Bella Gold Tower</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Ngân Sách Dự Kiến</label>
                  <input
                    type="text"
                    value={newLead.budget}
                    onChange={e => setNewLead({ ...newLead, budget: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    placeholder="Ví dụ: 3 – 5 tỷ"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Ghi Chú Nhu Cầu</label>
                <textarea
                  value={newLead.notes}
                  onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 h-20 resize-none"
                  placeholder="Nhu cầu cụ thể: tầng cao, căn góc, xem nhà mẫu..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
                >
                  Xác Nhận Thêm Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Action Chăm Sóc / Nhận Lead ── */}
      <LeadActionModal
        lead={actionLead}
        onClose={() => setActionLead(null)}
        onAccept={handleAcceptLead}
        onSubmitOutcome={handleSubmitOutcome}
      />

      {/* ── Drawer: Timeline Events Audit Log ── */}
      <LeadTimelineDrawer
        lead={timelineLead}
        onClose={() => setTimelineLead(null)}
      />
    </div>
  );
}
