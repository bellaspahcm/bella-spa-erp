'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Phone, Mail, Award, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function RealEstateCustomersPage() {
  const [investors, setInvestors] = useState([
    { id: 'inv-1', fullName: 'Lê Văn C', phone: '0901234567', email: 'vanc@gmail.com', budget: '3 - 5 tỷ', status: 'contacted' },
    { id: 'inv-2', fullName: 'Phạm Thị D', phone: '0912345678', email: 'thid@gmail.com', budget: '5 - 10 tỷ', status: 'lead' },
  ]);

  function handleInteraction(investorId: string) {
    setInvestors(prev => prev.map(inv => {
      if (inv.id === investorId) {
        toast.success(`Đã ghi nhận tương tác chăm sóc với ${inv.fullName}`);
        return { ...inv, status: 'contacted' as const };
      }
      return inv;
    }));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-primary w-7 h-7" />
            Khách Hàng & Nhà Đầu Tư
          </h1>
          <p className="text-sm text-slate-500">Danh sách dữ liệu khách hàng tiềm năng đầu tư BĐS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {investors.map((inv) => (
          <div key={inv.id} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">{inv.fullName}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                inv.status === 'contacted' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                'bg-slate-100 text-slate-700 dark:bg-slate-800/30'
              }`}>
                {inv.status === 'contacted' ? 'Đã Tương Tác' : 'Khách Mới'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-slate-500">
              <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {inv.phone}</p>
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {inv.email}</p>
              <p className="flex items-center gap-2"><Award className="w-4 h-4 text-slate-400" /> Ngân sách: {inv.budget}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => handleInteraction(inv.id)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ghi Nhận Tương Tác
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
