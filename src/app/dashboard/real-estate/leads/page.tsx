'use client';

/**
 * @module app/dashboard/real-estate/leads/page
 *
 * Consolidated Lead Directory & SLA Governance Subsystem.
 * Combines lead list management, manual overrides, dynamic SLA rules, and audit timelines.
 *
 * Data synchronization:
 * - Reads/Writes from localStorage ('bella_re_managed_leads') to sync states.
 * - Loads dynamic Sales Agents list from Foundation using `getAllInScopeAction`.
 */

import React, { useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import {
  getAllInScopeAction,
  getLeadCandidatesAction,
} from '@/modules/real_estate/actions/leadAssignmentActions';
import {
  Users, Phone, Mail, Clock, Search, Filter, ShieldCheck,
  ChevronDown, CheckCircle2, PhoneCall, Eye, Award, Check,
  UserPlus, Settings, ArrowRightLeft, Globe, MessageSquare, Calendar, X
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
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ─── Constants & Fallbacks ───────────────────────────────────────────────────

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

const FALLBACK_SALES: SalesAgent[] = [
  { id: 'sale-001', name: 'Nguyễn Văn A', role: 'Senior Sales Specialist' },
  { id: 'sale-002', name: 'Trần Thị B', role: 'Real Estate Consultant' },
  { id: 'sale-003', name: 'Lê Hoàng C', role: 'Sales Executive' },
  { id: 'sale-004', name: 'Phạm Thanh D', role: 'Junior Agent' },
];

const STATE_CONFIG: Record<ManagedLead['state'], { label: string; color: string }> = {
  unassigned: { label: 'Chưa Phân Phối', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400' },
  waiting_accept: { label: 'Chờ Sale Nhận', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' },
  in_progress: { label: 'Đang Chăm Sóc', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' },
  converted: { label: 'Đã Chốt Cọc', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' },
  lost: { label: 'Đã Đóng / Mất', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400' },
  archived: { label: 'Đã Lưu Trữ', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-500' },
};

const SOURCE_OPTIONS = [
  { value: 'facebook', label: 'Facebook Ads' },
  { value: 'zalo', label: 'Zalo OA' },
  { value: 'referral', label: 'Người giới thiệu' },
  { value: 'website', label: 'Form Website' },
  { value: 'event', label: 'Sự kiện mở bán' },
];

const PROJECT_OPTIONS = [
  { value: 'Elyse Island – Shophouse Marina', label: 'Elyse Island – Shophouse Marina' },
  { value: 'Vinhomes Saigon Park', label: 'Vinhomes Saigon Park' },
  { value: 'Bella Gold Tower', label: 'Bella Gold Tower' },
];

const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook Ads',
  zalo:     'Zalo OA',
  referral: 'Người giới thiệu',
  website:  'Website',
  event:    'Sự kiện',
};

const getSourceIcon = (source: string) => {
  const sizeClass = "w-3.5 h-3.5 shrink-0";
  switch (source) {
    case 'facebook':
      return <Globe className={`${sizeClass} text-blue-600 dark:text-blue-400`} />;
    case 'zalo':
      return <MessageSquare className={`${sizeClass} text-cyan-500`} />;
    case 'referral':
      return <Users className={`${sizeClass} text-teal-500`} />;
    case 'website':
      return <Globe className={`${sizeClass} text-indigo-500`} />;
    case 'event':
      return <Calendar className={`${sizeClass} text-rose-500`} />;
    default:
      return <Globe className={`${sizeClass} text-slate-400`} />;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsManagementPage() {
  const tenantCtx = useContext(TenantContextContext);
  const tenantId = tenantCtx?.tenantId ?? 'real_estate';

  const [leadEngine] = useState(() => new LeadEngineFacade());
  const [leads, setLeads] = useState<ManagedLead[]>([]);
  const [liveAgents, setLiveAgents] = useState<SalesAgent[]>(FALLBACK_SALES);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'pipeline' | 'rules'>('pipeline');
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [activeDropdownLeadId, setActiveDropdownLeadId] = useState<string | null>(null);

  // Modals / Drawer
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLead, setActionLead] = useState<ManagedLead | null>(null);
  const [timelineLead, setTimelineLead] = useState<ManagedLead | null>(null);

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

  // ── Load Leads from localStorage & dynamic Sales agents ────────────────────

  useEffect(() => {
    // Load leads
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

    // Load agents
    getAllInScopeAction({ tenantId }).then(result => {
      if (result.success && result.candidates && result.candidates.length > 0) {
        const mapped = result.candidates.map(c => ({
          id: c.id,
          name: c.displayName,
          role: c.type,
        }));
        setLiveAgents(mapped);
      }
    }).catch(() => {});
  }, [tenantId]);

  // Persist leads whenever they change
  const updateLeadsState = (updater: (prev: ManagedLead[]) => ManagedLead[]) => {
    setLeads(prev => {
      const next = updater(prev);
      localStorage.setItem('bella_re_managed_leads', JSON.stringify(next));
      return next;
    });
  };

  // ── Lead Operations ────────────────────────────────────────────────────────

  const handleManualAssign = (leadId: string, agent: SalesAgent) => {
    updateLeadsState(prev =>
      prev.map(lead => {
        if (lead.id !== leadId) return lead;
        // Assign using the engine to ensure SLA timers and event tracking are run correctly
        const updated = leadEngine.assignmentEngine.assignLead(
          lead,
          agent,
          'admin-01',
          'Admin Manual Override'
        );
        toast.success(`Đã phân bổ Lead [${lead.fullName}] cho Sale [${agent.name}]!`);
        return updated;
      })
    );
    setActiveDropdownLeadId(null);
  };

  const handleAcceptLead = (leadId: string) => {
    updateLeadsState(prev =>
      prev.map(lead => {
        if (lead.id !== leadId) return lead;
        const updated = leadEngine.workflowEngine.acceptLead(
          lead,
          lead.currentSaleId || 'sale-001',
          lead.currentSaleName || 'Sale'
        );
        toast.success(`Xác nhận nhận Lead thành công!`);
        return updated;
      })
    );
  };

  const handleSubmitOutcome = (leadId: string, outcome: LeadOutcome, notes: string) => {
    updateLeadsState(prev =>
      prev.map(lead => {
        if (lead.id !== leadId) return lead;
        const updated = leadEngine.workflowEngine.submitOutcome(
          lead,
          outcome,
          notes,
          lead.currentSaleId || 'sale-001',
          lead.currentSaleName || 'Sale Specialist',
          liveAgents
        );
        if (updated.state === 'converted') {
          toast.success(`Đã chốt Booking thành công!`);
        } else {
          toast.info(`Đã lưu kết quả cuộc gọi.`);
        }
        return updated;
      })
    );
  };

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newLead.fullName.trim() || !newLead.phone.trim()) {
      toast.error('Vui lòng nhập Họ tên và Số điện thoại');
      return;
    }

    // Dynamic assignment from Foundation pool
    let assignedSale: SalesAgent;
    try {
      const pool = await getLeadCandidatesAction({
        tenantId,
        excludeOnLeave: true,
      });

      if (pool.success && pool.topCandidate) {
        assignedSale = {
          id: pool.topCandidate.id,
          name: pool.topCandidate.displayName,
          role: pool.topCandidate.type,
        };
      } else if (pool.success && pool.bridgedAgents && pool.bridgedAgents.length > 0) {
        assignedSale = pool.bridgedAgents[0];
      } else {
        assignedSale = liveAgents[Math.floor(Math.random() * liveAgents.length)];
      }
    } catch {
      assignedSale = liveAgents[Math.floor(Math.random() * liveAgents.length)];
    }

    let createdLead: ManagedLead = {
      id: `lead-${Date.now()}`,
      tenantId,
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

    createdLead = leadEngine.assignmentEngine.assignLead(
      createdLead,
      assignedSale,
      'admin-01',
      'Admin Marketing'
    );

    updateLeadsState(prev => [createdLead, ...prev]);
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

  function handleUpdateRulesConfig(newConfig: LeadRuleConfig) {
    leadEngine.ruleEngine.updateConfig(newConfig);
    toast.success('Đã lưu cấu hình SLA & Rules thành công!');
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        l.fullName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.email ?? '').toLowerCase().includes(q);
      const matchState = filterState === 'all' || l.state === filterState;
      return matchSearch && matchState;
    });
  }, [leads, search, filterState]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    return {
      total: leads.length,
      unassigned: leads.filter(l => l.state === 'unassigned').length,
      waiting: leads.filter(l => l.state === 'waiting_accept').length,
      inProgress: leads.filter(l => l.state === 'in_progress').length,
      converted: leads.filter(l => l.state === 'converted').length,
      rotated: leads.filter(l => l.rotationCount > 0).length,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            Quản Lý Lead & SLA Governance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý tập trung Lead, giám sát thời gian xử lý và cấu hình phân phối tự động/thủ công
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
              <Users className="w-3.5 h-3.5" />
              Danh Sách Lead
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
              Cấu Hình SLA & Rules
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

      {/* Tab 1: Lead Pipeline */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Tổng số Lead</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Chờ nhận lead</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 text-amber-600">{stats.waiting}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Đang chăm sóc</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 text-blue-600">{stats.inProgress}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Đã chốt cọc</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 text-emerald-600">{stats.converted}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Đã xoay vòng</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 text-purple-600">{stats.rotated}</p>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Tìm theo tên, SĐT..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <PremiumSelect
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'waiting_accept', label: 'Chờ nhận lead' },
                  { value: 'in_progress', label: 'Đang chăm sóc' },
                  { value: 'converted', label: 'Đã chốt cọc' },
                  { value: 'lost', label: 'Đã đóng / Mất' },
                ]}
                value={filterState}
                onChange={setFilterState}
                className="min-w-[180px]"
                buttonClassName="py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl"
              />
            </div>
          </div>

          {/* Bảng Lead */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Khách Hàng</th>
                    <th className="p-4">Dự Án / Nguồn</th>
                    <th className="p-4">Sale Phụ Trách (Manual Override)</th>
                    <th className="p-4">Trạng Thái SLA</th>
                    <th className="p-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        Không tìm thấy Lead phù hợp
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        {/* Lead Info */}
                        <td className="p-4">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{lead.fullName}</p>
                          <p className="text-slate-500">{lead.phone} • {lead.email || 'N/A'}</p>
                        </td>

                        {/* Project Info */}
                        <td className="p-4">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{lead.interestedProject || 'Chưa chọn'}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {getSourceIcon(lead.source)}
                            <span>{SOURCE_LABELS[lead.source] || lead.source}</span>
                            <span>• Ngân sách: {lead.budget || 'Chưa xác định'}</span>
                          </div>
                        </td>

                        {/* Sale manual assignment selector */}
                        <td className="p-4 relative">
                          <div className="inline-block text-left">
                            <button
                              onClick={() => setActiveDropdownLeadId(
                                activeDropdownLeadId === lead.id ? null : lead.id
                              )}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                lead.currentSaleName
                                  ? 'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/20'
                              }`}
                              id={`sale-selector-${lead.id}`}
                            >
                              {lead.currentSaleName || 'Chưa phân phối'}
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeDropdownLeadId === lead.id && (
                              <div className="absolute left-4 mt-2 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="p-2 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                  Phân Sale phụ trách
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                                  {liveAgents.map(agent => (
                                    <button
                                      key={agent.id}
                                      onClick={() => handleManualAssign(lead.id, agent)}
                                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-left text-xs transition"
                                    >
                                      <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{agent.name}</p>
                                        <p className="text-[10px] text-slate-400">{agent.role}</p>
                                      </div>
                                      {lead.currentSaleId === agent.id && (
                                        <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* SLA Badge */}
                        <td className="p-4">
                          <LeadSLABadge lead={lead} slaEngine={leadEngine.slaEngine} />
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
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
        </div>
      )}

      {/* Tab 2: Rules Config */}
      {activeTab === 'rules' && (
        <LeadRuleConfigTab
          initialConfig={leadEngine.ruleEngine.getConfig()}
          onSaveConfig={handleUpdateRulesConfig}
        />
      )}

      {/* ── Modal: Thêm Lead Mới ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 space-y-5">
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
                <X className="w-5 h-5" />
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
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Nguồn Lead</label>
                  <PremiumSelect
                    options={SOURCE_OPTIONS}
                    value={newLead.source}
                    onChange={val => setNewLead({ ...newLead, source: val })}
                    placeholder="Nguồn lead..."
                    buttonClassName="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Dự Án Quan Tâm</label>
                  <PremiumSelect
                    options={PROJECT_OPTIONS}
                    value={newLead.interestedProject}
                    onChange={val => setNewLead({ ...newLead, interestedProject: val })}
                    placeholder="Dự án quan tâm..."
                    buttonClassName="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl"
                  />
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
