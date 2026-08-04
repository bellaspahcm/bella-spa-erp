'use client';

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  RefreshCw,
  Zap,
  Phone,
  TrendingUp,
  X,
  CheckCircle2,
  AlertCircle,
  Target,
  ChevronRight,
  Sparkles,
  UserCheck,
  Filter,
  Car,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';

// Mock Sales Agents
const MOCK_AGENTS = [
  { id: 'u1', name: 'Trần Minh Quân', initials: 'Q', conversionRate: 18, totalLeads: 24, gradient: 'from-indigo-500 to-blue-600' },
  { id: 'u2', name: 'Lê Thùy Chi',    initials: 'C', conversionRate: 22, totalLeads: 18, gradient: 'from-violet-500 to-purple-600' },
  { id: 'u3', name: 'Nguyễn Tiến Dũng', initials: 'D', conversionRate: 15, totalLeads: 30, gradient: 'from-pink-500 to-rose-600' },
];

const SOURCE_CONFIG: Record<string, { bg: string; dot: string }> = {
  'Facebook Ads':    { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', dot: 'bg-blue-500' },
  'Google Search':   { bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border-teal-100 dark:border-teal-900/30', dot: 'bg-teal-500' },
  'Showroom Visit':  { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/30', dot: 'bg-amber-500' },
  'Website Bella':   { bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-100 dark:border-purple-900/30', dot: 'bg-purple-500' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  new:         { label: 'Mới Nhận',    bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  contacted:   { label: 'Đã Tiếp Cận', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  test_drive:  { label: 'Lái Thử',     bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400' },
  negotiating: { label: 'Thương Thảo', bg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400' },
  won:         { label: 'Chốt Đơn',    bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  lost:        { label: 'Thất Bại',    bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
};

type Lead = {
  id: string;
  customer_name: string;
  phone: string;
  email?: string;
  status: string;
  source: string;
  created_at: string;
  assigned_to?: string;
};

export default function LeadCenterPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      if (!supabase) { setIsLoading(false); return; }
      const { data, error } = await supabase.from('auto_leads').select('*').order('created_at', { ascending: false });
      if (error) { toast.error('Không thể tải danh sách lead'); setLeads([]); }
      else { setLeads(data || []); }
    } catch { toast.error('Không thể tải danh sách lead'); setLeads([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleRoundRobin = (leadId: string) => {
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 800));
      const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, agentName: agent.name, status: 'contacted' } : l));
      toast.success(`Đã phân bổ Lead thành công cho ${agent.name} (Round Robin)`);
    });
  };

  const handleSmartAllocation = (leadId: string) => {
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 800));
      const agent = MOCK_AGENTS[1]; // highest conv rate
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, agentName: agent.name, status: 'contacted' } : l));
      toast.success(`Phân bổ thông minh: ${agent.name} nhận Lead — Conversion Rate ${agent.conversionRate}%`);
    });
  };

  const filtered = leads.filter(l => {
    const matchSearch = (l.name ?? '').toLowerCase().includes(search.toLowerCase()) || (l.phone ?? '').includes(search) || (l.variantName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 dark:border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/15 dark:from-blue-500/20 dark:to-indigo-500/5 border border-blue-100/50 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Lead Center & Phân Bổ TVBH</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sales Lead Center — Quản lý dòng lead và tự động phân bổ cơ hội bán hàng cho TVBH tốt nhất</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Lead Table ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm tên, SĐT, dòng xe..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs font-semibold placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all shadow-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-xs font-bold outline-none text-slate-700 dark:text-slate-300 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">Mới nhận</option>
              <option value="contacted">Đã tiếp cận</option>
              <option value="test_drive">Lái thử</option>
              <option value="negotiating">Thương thảo</option>
              <option value="won">Chốt đơn</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-900 text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">
                    <th className="py-4 px-5">Lead</th>
                    <th className="py-4 px-5">Xe Quan Tâm</th>
                    <th className="py-4 px-5">Nguồn</th>
                    <th className="py-4 px-5">Trạng Thái</th>
                    <th className="py-4 px-5">TVBH Phụ Trách</th>
                    <th className="py-4 px-5">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-900/80">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-slate-400 font-semibold">Đang tải leads...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length > 0 ? filtered.map((l, idx) => {
                    const srcCfg = SOURCE_CONFIG[l.source] ?? { bg: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
                    const stsCfg = STATUS_CONFIG[l.status] ?? { label: l.status, bg: 'bg-slate-100 text-slate-600' };
                    return (
                      <motion.tr
                        key={l.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-all text-xs group"
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                              {(l.name ?? 'L').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{l.name}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />{l.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <Car className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{l.variantName}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">Màu: {l.color} · {l.budget}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${srcCfg.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${srcCfg.dot}`} />
                            {l.source}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${stsCfg.bg}`}>
                            {stsCfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[10px] ${l.agentName === 'Chưa phân bổ' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                            {l.agentName !== 'Chưa phân bổ' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            {l.agentName}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {l.agentName === 'Chưa phân bổ' ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleRoundRobin(l.id)}
                                disabled={isPending}
                                title="Phân bổ xoay vòng"
                                className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-all border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-none hover:-translate-y-0.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleSmartAllocation(l.id)}
                                disabled={isPending}
                                title="Phân bổ thông minh AI"
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all border border-indigo-100/30 dark:border-indigo-900/20 shadow-sm hover:shadow-none hover:-translate-y-0.5"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic">Đã phân bổ</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <AlertCircle className="w-10 h-10 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                        <p className="text-xs text-slate-400 font-bold italic">Không tìm thấy lead nào</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Agent Performance + Smart Card ── */}
        <div className="space-y-5">

          {/* Agent Leaderboard */}
          <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100/30 dark:border-violet-900/20 shadow-sm">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bảng Hiệu Suất TVBH</h3>
            </div>

            <div className="space-y-4">
              {MOCK_AGENTS.map((agent, idx) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-900">
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.gradient} text-white text-xs font-extrabold flex items-center justify-center shadow-sm`}>
                      {agent.initials}
                    </div>
                    {idx === 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full text-[8px] flex items-center justify-center text-white font-extrabold shadow-sm">★</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{agent.name}</p>
                      <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 shrink-0 ml-2">{agent.totalLeads} leads</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.conversionRate * 4}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full rounded-full bg-gradient-to-r ${agent.gradient}`}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Conversion: {agent.conversionRate}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Smart Allocation info card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 border border-slate-800/60 p-6 shadow-lg">
            {/* BG decoration */}
            <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
              <Sparkles className="w-40 h-40 text-white" />
            </div>
            <div className="relative space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 border border-white/10">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="font-extrabold text-sm text-white tracking-wide">Smart Allocation AI</h3>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-300">
                Hệ thống tự động chấm điểm hiệu suất chốt đơn hàng tháng của từng TVBH. Lead mới ưu tiên cho agent có tỷ lệ chốt cao nhất với dòng xe tương ứng.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Engine đang hoạt động</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-2xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{leads.length}</div>
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Tổng Lead</div>
            </div>
            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-2xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {leads.filter(l => l.agentName === 'Chưa phân bổ').length}
              </div>
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Chờ Phân Bổ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
