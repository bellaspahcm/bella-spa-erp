'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  PlusCircle,
  RefreshCw,
  Zap,
  Filter,
  Phone,
  Mail,
  UserCheck,
  Compass,
  ArrowRight,
  TrendingUp,
  X,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Mock Sales Agents
const MOCK_AGENTS = [
  { id: 'u1', name: 'Trần Minh Quân', avatar: 'Q', conversionRate: '18%', totalLeads: 24 },
  { id: 'u2', name: 'Lê Thùy Chi',    avatar: 'C', conversionRate: '22%', totalLeads: 18 },
  { id: 'u3', name: 'Nguyễn Tiến Dũng', avatar: 'D', conversionRate: '15%', totalLeads: 30 },
];

// Mock Leads
const INITIAL_LEADS = [
  { id: 'ld1', name: 'Phạm Minh H', phone: '0901112222', source: 'Facebook Ads', variantName: 'BMW M4 Competition', color: 'São Paulo Yellow', budget: '5.6B', status: 'new', agentName: 'Chưa phân bổ', createdAt: '2026-08-03' },
  { id: 'ld2', name: 'Nguyễn Hoàng L', phone: '0912223333', source: 'Google Search', variantName: 'BMW X5 xDrive40i', color: 'Carbon Black', budget: '4.1B', status: 'contacted', agentName: 'Lê Thùy Chi', createdAt: '2026-08-02' },
  { id: 'ld3', name: 'Trịnh Quốc T', phone: '0983334444', source: 'Showroom Visit', variantName: 'BMW 330i Luxury Line', color: 'Portimao Blue', budget: '2.5B', status: 'test_drive', agentName: 'Trần Minh Quân', createdAt: '2026-08-01' },
  { id: 'ld4', name: 'Đỗ Hải Y',     phone: '0974445555', source: 'Website Bella', variantName: 'BMW 520i M Sport', color: 'Phytonic Blue', budget: '2.7B', status: 'negotiating', agentName: 'Nguyễn Tiến Dũng', createdAt: '2026-07-30' },
];

const SOURCE_BADGES: Record<string, string> = {
  'Facebook Ads': 'bg-blue-50 text-blue-600 dark:bg-blue-950/20',
  'Google Search': 'bg-teal-50 text-teal-600 dark:bg-teal-950/20',
  'Showroom Visit': 'bg-amber-50 text-amber-600 dark:bg-amber-950/20',
  'Website Bella': 'bg-purple-50 text-purple-600 dark:bg-purple-950/20',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Mới Nhận',    color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
  contacted:   { label: 'Đã Tiếp Cận', color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/20' },
  test_drive:  { label: 'Lái Thử',    color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20' },
  negotiating: { label: 'Thương Thảo', color: 'text-pink-600',   bg: 'bg-pink-50 dark:bg-pink-950/20' },
  won:         { label: 'Chốt Đơn',    color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
  lost:        { label: 'Thất Bại',    color: 'text-rose-600',   bg: 'bg-rose-50 dark:bg-rose-950/20' },
};

export default function LeadCenterPage() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Phân bổ Round Robin
  const handleRoundRobin = (leadId: string) => {
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 800));
      // Chọn ngẫu nhiên 1 agent làm demo xoay vòng
      const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, agentName: agent.name, status: 'contacted' } : l));
      toast.success(`Đã phân bổ Lead thành công cho ${agent.name} (Round Robin)`);
    });
  };

  // Phân bổ thông minh dựa trên Conversion Rate thắng đơn
  const handleSmartAllocation = (leadId: string) => {
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 800));
      // Chọn agent có conversion rate cao nhất (Lê Thùy Chi - 22%)
      const agent = MOCK_AGENTS[1]; 
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, agentName: agent.name, status: 'contacted' } : l));
      toast.success(`Phân bổ thông minh: ${agent.name} nhận Lead do có Conversion Rate tốt nhất (${agent.conversionRate})`);
    });
  };

  const filtered = leads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search) || l.variantName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Lead Center & Phân Bổ TVBH
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Sales Lead Center — Quản lý dòng lead và tự động phân bổ cơ hội bán hàng cho TVBH tốt nhất
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Bảng danh sách lead */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm tên, SĐT, dòng xe..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="new">Mới nhận</option>
                <option value="contacted">Đã tiếp cận</option>
                <option value="test_drive">Lái thử</option>
                <option value="negotiating">Thương thảo</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-4 px-5">Lead</th>
                    <th className="py-4 px-5">Xe Quan Tâm</th>
                    <th className="py-4 px-5">Nguồn</th>
                    <th className="py-4 px-5">TVBH Phụ Trách</th>
                    <th className="py-4 px-5">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length > 0 ? filtered.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all text-xs">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{l.name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{l.phone}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{l.variantName}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Màu: {l.color} · Hạn mức: {l.budget}</div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${SOURCE_BADGES[l.source] || 'bg-slate-100'}`}>
                          {l.source}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold text-[10px] ${l.agentName === 'Chưa phân bổ' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350'}`}>
                          {l.agentName}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {l.agentName === 'Chưa phân bổ' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleRoundRobin(l.id)}
                              disabled={isPending}
                              title="Xoay vòng tròn"
                              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200/60 dark:border-slate-700"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSmartAllocation(l.id)}
                              disabled={isPending}
                              title="Phân bổ thông minh"
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 rounded-lg transition-colors border border-indigo-200/30"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">Đã phân phối</span>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic">Không tìm thấy lead nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cấu hình & Bảng xếp hạng Sales Agent hiệu suất */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Bảng Hiệu Suất TVBH
            </h3>
            
            <div className="space-y-3.5">
              {MOCK_AGENTS.map(agent => (
                <div key={agent.id} className="flex items-center justify-between p-3.5 bg-slate-50/30 dark:bg-slate-950/10 rounded-2xl border border-slate-150/60 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {agent.avatar}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{agent.name}</h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">Conversion: {agent.conversionRate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-350">
                      {agent.totalLeads} leads
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
              <Zap className="w-48 h-48" />
            </div>
            <h3 className="font-black text-sm tracking-wide">Thuật toán Smart Allocation</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Hệ thống tự động chấm điểm hiệu suất chốt đơn hàng tháng của từng KTV tư vấn bán hàng. Lead mới sẽ được ưu tiên chuyển cho agent có tỷ lệ chốt Deal thành công cao nhất đối với dòng xe đó.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
