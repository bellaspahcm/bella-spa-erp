'use client';

/**
 * @module app/dashboard/real-estate/leads/page
 *
 * Dedicated Lead Management Page.
 * Displays all managed leads with their states, SLA timers, and provides a manual assignment UI.
 *
 * Data synchronization:
 * - Reads/Writes from localStorage ('bella_re_managed_leads') to sync with Marketing tab.
 * - Loads dynamic Sales Agents list from Foundation using `getAllInScopeAction`.
 */

import React, { useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import {
  getAllInScopeAction,
} from '@/modules/real_estate/actions/leadAssignmentActions';
import {
  Users, Phone, Mail, Clock, Search, Filter, ShieldCheck,
  ChevronDown, CheckCircle2, PhoneCall, Eye, Award, Check
} from 'lucide-react';
import { toast } from 'sonner';

import {
  LeadEngineFacade,
  ManagedLead,
  LeadOutcome,
  SalesAgent,
} from '@/platform/lead-engine';

import { LeadSLABadge } from '@/components/lead-engine/LeadSLABadge';
import { LeadTimelineDrawer } from '@/components/lead-engine/LeadTimelineDrawer';
import { LeadActionModal } from '@/components/lead-engine/LeadActionModal';

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsManagementPage() {
  const tenantCtx = useContext(TenantContextContext);
  const tenantId = tenantCtx?.tenantId ?? 'real_estate';

  const [leadEngine] = useState(() => new LeadEngineFacade());
  const [leads, setLeads] = useState<ManagedLead[]>([]);
  const [liveAgents, setLiveAgents] = useState<SalesAgent[]>(FALLBACK_SALES);
  
  // UI states
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [activeDropdownLeadId, setActiveDropdownLeadId] = useState<string | null>(null);

  // Modals / Drawer
  const [actionLead, setActionLead] = useState<ManagedLead | null>(null);
  const [timelineLead, setTimelineLead] = useState<ManagedLead | null>(null);

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
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            Lead Directory & SLA Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý tập trung Lead, giám sát thời gian xử lý và phân phối Sale thủ công
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Tổng số Lead</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Chưa phân phối</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.unassigned}</p>
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
          <select
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="unassigned">Chưa Phân Phối</option>
            <option value="waiting_accept">Chờ Sale Nhận</option>
            <option value="in_progress">Đang Chăm Sóc</option>
            <option value="converted">Đã Chốt Cọc</option>
            <option value="lost">Đã Đóng / Mất</option>
          </select>
        </div>
      </div>

      {/* Bảng Lead */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="p-4">Khách Hàng</th>
              <th className="p-4">Dự Án / Nhu Cầu</th>
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
                    <p className="text-slate-400 mt-0.5">Ngân sách: {lead.budget || 'Chưa xác định'}</p>
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

      {/* Modals & Drawer */}
      <LeadActionModal
        lead={actionLead}
        onClose={() => setActionLead(null)}
        onAccept={handleAcceptLead}
        onSubmitOutcome={handleSubmitOutcome}
      />

      <LeadTimelineDrawer
        lead={timelineLead}
        onClose={() => setTimelineLead(null)}
      />
    </div>
  );
}
