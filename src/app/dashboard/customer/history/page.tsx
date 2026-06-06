'use client';

import { usePageRefresh } from '@/hooks/usePageRefresh';

export default function CustomerHistoryPage() {
  usePageRefresh(() => undefined);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-handwriting text-primary mb-8">Lịch sử liệu trình</h1>
      <div className="bg-white p-12 rounded-[3rem] border border-pink-50 text-center space-y-4 shadow-sm">
        <div className="bg-pink-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📜</span>
        </div>
        <p className="text-xl font-black text-slate-800 tracking-tight">Tính năng đang được hoàn thiện</p>
        <p className="text-slate-400 font-medium italic">Chị vui lòng quay lại sau nhé!</p>
      </div>
    </div>
  );
}
