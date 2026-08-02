'use client';

import { useState, useEffect } from 'react';
import { CurrentUser } from '@/types/domain';
import { 
  Phone, Mail, MessageSquare, AlertTriangle, CheckCircle, 
  Clock, Calendar, User, Search, Filter, ShieldCheck, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { WorkforceBottomNav } from '../../components/WorkforceBottomNav';
import { ManagedLead, LeadState } from '@/platform/lead-engine/types';
import { toast } from 'sonner';

interface WorkforceLeadsProps {
  user: CurrentUser;
}

const TABS: { value: string; label: string; countKey: LeadState }[] = [
  { value: 'waiting_accept', label: 'Chờ nhận', countKey: 'waiting_accept' },
  { value: 'in_progress', label: 'Đang chăm', countKey: 'in_progress' },
  { value: 'converted', label: 'Đã chốt', countKey: 'converted' },
  { value: 'lost', label: 'Đã đóng', countKey: 'lost' },
];

export function WorkforceLeads({ user }: WorkforceLeadsProps) {
  const [leads, setLeads] = useState<ManagedLead[]>([]);
  const [activeTab, setActiveTab] = useState<string>('in_progress');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMine, setFilterMine] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load leads from localStorage (synchronized with admin dashboard)
  useEffect(() => {
    function loadLeads() {
      setIsLoading(true);
      const saved = localStorage.getItem('bella_re_managed_leads');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLeads(parsed);
        } catch (e) {
          console.error('[WorkforceLeads] Failed to parse leads:', e);
        }
      }
      setIsLoading(false);
    }
    loadLeads();
  }, []);

  const saveLeads = (updatedLeads: ManagedLead[]) => {
    setLeads(updatedLeads);
    localStorage.setItem('bella_re_managed_leads', JSON.stringify(updatedLeads));
  };

  // Check if lead is assigned to current user
  const isLeadOfUser = (lead: ManagedLead) => {
    return lead.currentSaleId === user.id || 
           lead.currentSaleName === user.full_name || 
           lead.currentSaleId === 'sale-001'; // Mock fallback for demo
  };

  // Actions
  const handleAcceptLead = (leadId: string) => {
    const updated = leads.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          state: 'in_progress' as LeadState,
          acceptedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          auditTimeline: [
            {
              id: `evt-${Date.now()}`,
              leadId: l.id,
              eventType: 'lead_accepted' as const,
              actorId: user.id,
              actorName: user.full_name || 'Sale Specialist',
              description: `Sale [${user.full_name || 'Agent'}] đã xác nhận nhận Lead thành công qua Mobile Portal.`,
              timestamp: new Date().toISOString(),
            },
            ...l.auditTimeline
          ]
        };
      }
      return l;
    });
    saveLeads(updated);
    toast.success('Nhận Lead thành công!');
    setActiveTab('in_progress');
  };

  const handleReportLost = (leadId: string) => {
    const updated = leads.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          state: 'lost' as LeadState,
          currentOutcome: 'LOST' as const,
          updatedAt: new Date().toISOString(),
          auditTimeline: [
            {
              id: `evt-${Date.now()}`,
              leadId: l.id,
              eventType: 'lead_closed' as const,
              actorId: user.id,
              actorName: user.full_name || 'Sale Specialist',
              description: `Báo cáo mất Lead / Đóng Lead thành công qua Mobile Portal.`,
              timestamp: new Date().toISOString(),
            },
            ...l.auditTimeline
          ]
        };
      }
      return l;
    });
    saveLeads(updated);
    toast.info('Đã ghi nhận báo cáo mất Lead');
  };

  // Filter leads based on active tab, search, and "Mine" filter
  const filteredLeads = leads.filter(l => {
    // 1. Tab check
    if (l.state !== activeTab) return false;

    // 2. Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = l.fullName.toLowerCase().includes(q);
      const matchPhone = l.phone.includes(q);
      const matchProject = (l.interestedProject || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchProject) return false;
    }

    // 3. User assignment filter (only show user's leads if toggled, or fallback to demo leads)
    if (filterMine) {
      return isLeadOfUser(l);
    }

    return true;
  });

  // Calculate counts for each tab
  const getTabCount = (tabValue: string) => {
    return leads.filter(l => {
      if (l.state !== tabValue) return false;
      if (filterMine) return isLeadOfUser(l);
      return true;
    }).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-24">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-900 dark:to-indigo-900 px-6 pt-8 pb-5 text-white">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Danh sách Lead</h1>
          <button 
            onClick={() => setFilterMine(!filterMine)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              filterMine 
                ? 'bg-white text-blue-700 border-white' 
                : 'bg-transparent text-blue-100 border-blue-400 hover:bg-white/10'
            }`}
          >
            {filterMine ? 'Lead của tôi' : 'Tất cả lead'}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
          <input
            type="text"
            placeholder="Tìm kiếm lead theo tên, SĐT, dự án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/15 dark:bg-black/20 text-white placeholder-blue-200 border border-white/20 rounded-xl text-sm focus:outline-none focus:bg-white/25 transition-all outline-none"
          />
        </div>
      </div>

      {/* Tabs segment */}
      <div className="flex bg-white dark:bg-gray-800 border-b border-gray-150 dark:border-gray-700 sticky top-0 z-40 overflow-x-auto">
        {TABS.map((tab) => {
          const count = getTabCount(tab.value);
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 py-3 text-center border-b-2 font-bold text-xs uppercase tracking-wider transition-all min-w-[80px] flex items-center justify-center gap-1.5 ${
                isActive 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                  isActive 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-750 dark:text-gray-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lead Cards List */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm">Đang tải danh sách Lead...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3">👥</div>
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-1">
              Không có lead nào
            </h3>
            <p className="text-xs text-gray-500">
              Không có lead nào trong mục này khớp với bộ lọc của bạn.
            </p>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const hasSLA = lead.activeSLATimer && !lead.activeSLATimer.isCompleted;
            const isBreached = lead.activeSLATimer?.isBreached;
            
            return (
              <div 
                key={lead.id} 
                className="bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-750 rounded-2xl p-5 shadow-md active:scale-[0.99] transition-all hover:shadow-lg flex flex-col relative"
              >
                {/* SLA Warning Badge */}
                {hasSLA && (
                  <div className={`absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                    isBreached 
                      ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400' 
                      : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400'
                  }`}>
                    <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
                    <span>SLA: {isBreached ? 'Trễ hạn' : 'Đang chạy'}</span>
                  </div>
                )}

                {/* Lead Info */}
                <div className="pr-20 mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                    {lead.source}
                  </span>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1.5 leading-tight">
                    {lead.fullName}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    {lead.interestedProject || 'Chưa đăng ký dự án'}
                  </p>
                </div>

                {/* Contact and details grid */}
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 border-t border-b border-gray-100 dark:border-gray-700 py-3.5 my-3.5 text-xs">
                  <div>
                    <span className="text-gray-400 block font-semibold text-[10px] uppercase">Số điện thoại</span>
                    <a href={`tel:${lead.phone}`} className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" />
                      {lead.phone}
                    </a>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-semibold text-[10px] uppercase">Ngân sách</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300 block mt-0.5">
                      {lead.budget || 'Chưa khai báo'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block font-semibold text-[10px] uppercase">Phụ trách</span>
                    <span className="font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      {lead.currentSaleName || 'Chưa gán'}
                    </span>
                  </div>
                </div>

                {/* Quick actions row */}
                <div className="flex gap-2 items-center justify-between mt-1">
                  <div className="flex gap-2">
                    {/* Zalo quick message */}
                    <a 
                      href={`https://zalo.me/${lead.phone}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                    >
                      <MessageSquare className="w-4.5 h-4.5" />
                    </a>
                    
                    {/* Email quick send */}
                    {lead.email && (
                      <a 
                        href={`mailto:${lead.email}`}
                        className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                      >
                        <Mail className="w-4.5 h-4.5" />
                      </a>
                    )}
                  </div>

                  {/* Accept / Detail buttons */}
                  <div className="flex items-center gap-2">
                    {lead.state === 'waiting_accept' ? (
                      <button
                        onClick={() => handleAcceptLead(lead.id)}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 hover:shadow-green-500/15 transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Nhận Lead
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleReportLost(lead.id)}
                          className="px-3.5 py-2 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold rounded-xl text-xs active:scale-95 transition-all"
                        >
                          Báo mất
                        </button>
                        <Link
                          href={`/workforce/leads/${lead.id}`}
                          className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs active:scale-95 transition-all flex items-center gap-1"
                        >
                          <span>Chi tiết</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <WorkforceBottomNav />
    </div>
  );
}
