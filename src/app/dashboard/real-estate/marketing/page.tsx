'use client';

import React, { useState } from 'react';
import {
  Megaphone, UserPlus, Phone, Mail, MapPin, Calendar,
  TrendingUp, Filter, Search, ChevronRight,
  CheckCircle2, Clock, XCircle, Zap, Star,
  BarChart2, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

interface MarketingLead {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  source: 'facebook' | 'zalo' | 'referral' | 'website' | 'event';
  interestedProject: string;
  budget: string;
  status: LeadStatus;
  createdAt: string;
  notes: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const INITIAL_LEADS: MarketingLead[] = [
  {
    id: 'lead-001', fullName: 'Nguyễn Văn Minh', phone: '0901234567',
    email: 'minh.nv@gmail.com', source: 'facebook',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '5 – 8 tỷ', status: 'qualified', createdAt: '2026-07-28',
    notes: 'Khách quan tâm căn góc tầng cao, cần tư vấn thêm pháp lý.',
  },
  {
    id: 'lead-002', fullName: 'Trần Thị Lan', phone: '0912345678',
    email: 'lan.tt@outlook.com', source: 'zalo',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '3 – 5 tỷ', status: 'contacted', createdAt: '2026-07-29',
    notes: 'Đã gọi điện xác nhận. Hẹn gặp trực tiếp thứ 6.',
  },
  {
    id: 'lead-003', fullName: 'Phạm Hùng Cường', phone: '0923456789',
    email: 'cuong.ph@company.vn', source: 'referral',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '8 – 12 tỷ', status: 'converted', createdAt: '2026-07-25',
    notes: 'Đã ký HĐMB căn A1-301. Khách VIP.',
  },
  {
    id: 'lead-004', fullName: 'Lê Thị Hoa', phone: '0934567890',
    email: 'hoa.lt@gmail.com', source: 'website',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '2 – 3 tỷ', status: 'new', createdAt: '2026-07-31',
    notes: 'Vừa điền form đăng ký trên website.',
  },
  {
    id: 'lead-005', fullName: 'Đặng Quốc Bảo', phone: '0945678901',
    email: 'bao.dq@mail.com', source: 'event',
    interestedProject: 'Elyse Island – Shophouse Marina',
    budget: '4 – 6 tỷ', status: 'lost', createdAt: '2026-07-20',
    notes: 'Đã mua dự án khác. Lưu để follow up dự án mới.',
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; icon: React.ElementType }> = {
  new:       { label: 'Khách Mới',     color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30',     icon: Zap },
  contacted: { label: 'Đã Liên Hệ',   color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30',  icon: Clock },
  qualified: { label: 'Tiềm Năng',    color: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30', icon: Star },
  converted: { label: 'Đã Chuyển Đổi', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30', icon: CheckCircle2 },
  lost:      { label: 'Không Tiếp',   color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30',     icon: XCircle },
};

const SOURCE_LABELS: Record<MarketingLead['source'], string> = {
  facebook: '📘 Facebook',
  zalo:     '💬 Zalo',
  referral: '🤝 Giới thiệu',
  website:  '🌐 Website',
  event:    '🎪 Sự kiện',
};

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function RealEstateMarketingPage() {
  const [leads, setLeads] = useState<MarketingLead[]>(INITIAL_LEADS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [view, setView] = useState<'list' | 'pipeline'>('list');

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total:     leads.length,
    new:       leads.filter(l => l.status === 'new').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
    convRate:  leads.length > 0
      ? Math.round((leads.filter(l => l.status === 'converted').length / leads.length) * 100)
      : 0,
  };

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filtered = leads.filter(l => {
    const matchSearch = l.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      l.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ─── Advance status ───────────────────────────────────────────────────────
  function handleAdvanceStatus(leadId: string) {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      const currentIdx = STATUS_ORDER.indexOf(l.status);
      if (currentIdx >= STATUS_ORDER.length - 2) {
        toast.info('Lead đã ở trạng thái cuối, không thể tiến thêm.');
        return l;
      }
      const next = STATUS_ORDER[currentIdx + 1];
      toast.success(`Cập nhật ${l.fullName}: ${STATUS_CONFIG[l.status].label} → ${STATUS_CONFIG[next].label}`);
      return { ...l, status: next };
    }));
  }

  function handleMarkLost(leadId: string) {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      toast.warning(`Đã đánh dấu ${l.fullName} là "Không Tiếp Tục"`);
      return { ...l, status: 'lost' };
    }));
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
            Marketing &amp; Lead Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý khách hàng tiềm năng và chiến dịch Marketing BĐS</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Danh Sách
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'pipeline'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Pipeline
            </button>
          </div>
          <button
            onClick={() => toast.info('Tính năng thêm lead thủ công đang phát triển')}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Thêm Lead
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng Lead',       value: stats.total,     icon: Megaphone, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/60' },
          { label: 'Khách Mới',       value: stats.new,       icon: Zap,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
          { label: 'Tiềm Năng',       value: stats.qualified, icon: Star,      color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
          { label: 'Tỷ Lệ Chuyển Đổi', value: `${stats.convRate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`p-5 rounded-2xl border border-slate-200 dark:border-slate-800 ${bg} flex items-center gap-4`}>
            <div className="flex-shrink-0">
              <Icon className={`w-7 h-7 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, SĐT, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {(['all', ...STATUS_ORDER] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                filterStatus === s
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-violet-400'
              }`}
            >
              {s === 'all' ? 'Tất Cả' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content: List View ── */}
      {view === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <BarChart2 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Không tìm thấy lead phù hợp</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(lead => {
                const cfg = STATUS_CONFIG[lead.status];
                const StatusIcon = cfg.icon;
                return (
                  <div
                    key={lead.id}
                    className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Lead info */}
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                          {lead.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{lead.fullName}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.interestedProject}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                            <span className="text-slate-500">Ngân sách: <span className="font-semibold text-slate-700 dark:text-slate-300">{lead.budget}</span></span>
                            <span className="text-slate-400">{SOURCE_LABELS[lead.source]}</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{lead.createdAt}
                            </span>
                          </div>
                          {lead.notes && (
                            <p className="mt-1.5 text-xs text-slate-500 italic truncate max-w-lg">"{lead.notes}"</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {lead.status !== 'converted' && lead.status !== 'lost' && (
                          <>
                            <button
                              onClick={() => handleAdvanceStatus(lead.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-all"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Tiến Bước
                            </button>
                            <button
                              onClick={() => handleMarkLost(lead.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold rounded-lg transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Bỏ Qua
                            </button>
                          </>
                        )}
                        {lead.status === 'converted' && (
                          <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 text-xs font-bold rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã Chốt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Content: Pipeline View ── */}
      {view === 'pipeline' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {STATUS_ORDER.map(status => {
            const cfg = STATUS_CONFIG[status];
            const StatusIcon = cfg.icon;
            const statusLeads = leads.filter(l => l.status === status);
            return (
              <div key={status} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-3">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${cfg.color} bg-opacity-60`}>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{cfg.label}</span>
                  </div>
                  <span className="text-xs font-bold opacity-70">{statusLeads.length}</span>
                </div>
                {/* Cards */}
                {statusLeads.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">Trống</p>
                ) : (
                  statusLeads.map(lead => (
                    <div
                      key={lead.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {lead.fullName.charAt(0)}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{lead.fullName}</p>
                      </div>
                      <p className="text-xs text-slate-500">{lead.budget}</p>
                      <p className="text-xs text-slate-400">{SOURCE_LABELS[lead.source]}</p>
                      {status !== 'converted' && status !== 'lost' && (
                        <button
                          onClick={() => handleAdvanceStatus(lead.id)}
                          className="w-full flex items-center justify-center gap-1 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 rounded-lg transition-colors"
                        >
                          Tiến <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
