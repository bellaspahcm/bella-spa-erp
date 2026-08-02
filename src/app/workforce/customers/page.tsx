'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Search, Phone, Mail, MessageSquare, ChevronRight, 
  ChevronLeft, Award, UserCheck, Calendar, ShieldCheck, HelpCircle 
} from 'lucide-react';
import { ManagedLead } from '@/platform/lead-engine/types';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<ManagedLead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function loadCustomers() {
      setIsLoading(true);
      const saved = localStorage.getItem('bella_re_managed_leads');
      if (saved) {
        try {
          const parsed: ManagedLead[] = JSON.parse(saved);
          // Customers are leads that are converted (chốt cọc / đã ký HĐ)
          const convertedLeads = parsed.filter(l => l.state === 'converted');
          setCustomers(convertedLeads);
        } catch (e) {
          console.error('[CustomersPage] Failed to parse leads:', e);
        }
      }
      setIsLoading(false);
    }
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.fullName.toLowerCase().includes(q) || 
           c.phone.includes(q) || 
           (c.interestedProject || '').toLowerCase().includes(q);
  });

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-700 dark:from-indigo-900 dark:to-blue-900 px-6 pt-8 pb-5 text-white shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Khách hàng (CRM)
          </h1>
          <span className="text-xs font-bold text-indigo-100 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
            {customers.length} khách hàng
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, SĐT, dự án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/15 dark:bg-black/20 border border-white/20 rounded-2xl py-3 pl-10 pr-4 text-xs text-white placeholder-indigo-200 outline-none focus:ring-1 focus:ring-white/35 transition-all"
          />
          <Search className="w-4 h-4 text-indigo-300 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* CUSTOMERS LIST */}
      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-650 rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải danh sách...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1">Chưa có khách hàng</h3>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'Không tìm thấy kết quả phù hợp.' : 'Leads được chốt cọc (Converted) sẽ xuất hiện tại đây.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map(c => (
              <div 
                key={c.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col gap-3.5"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-850 dark:text-slate-150">{c.fullName}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Dự án mua: {c.interestedProject || 'Chưa cập nhật'}
                    </p>
                  </div>
                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
                    Đã giao dịch
                  </span>
                </div>

                <div className="border-t border-slate-50 dark:border-slate-800/60 pt-3 flex justify-between items-center">
                  <div className="flex gap-2">
                    <a 
                      href={`tel:${c.phone}`}
                      className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <a 
                      href={`https://zalo.me/${c.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-100/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  </div>

                  <Link 
                    href={`/workforce/leads/${c.id}`}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:underline"
                  >
                    <span>Hồ sơ chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
