'use client';

import Link from 'next/link';
import { Calendar as CalendarIcon, Clock, DollarSign } from 'lucide-react';

export function KtvBottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50">
      <Link href="/ktv/dashboard" className="text-rose-700 flex flex-col items-center gap-1">
        <Clock className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase">Lịch ca</span>
      </Link>
      <Link href="/ktv/earnings" className="text-slate-900 flex flex-col items-center gap-1">
        <DollarSign className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase">Thu nhập</span>
      </Link>
      <Link href="/ktv/leaderboard" className="text-slate-900 flex flex-col items-center gap-1">
        <CalendarIcon className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase">Cá nhân</span>
      </Link>
    </div>
  );
}
