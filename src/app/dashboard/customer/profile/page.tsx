'use client';

import { usePageRefresh } from '@/hooks/usePageRefresh';

export default function CustomerProfilePage() {
  usePageRefresh(() => undefined);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-handwriting text-primary mb-8">Hồ sơ cá nhân</h1>
      <div className="bg-white p-12 rounded-[3rem] border border-pink-50 text-center space-y-4 shadow-sm">
        <div className="bg-pink-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">👤</span>
        </div>
        <p className="text-xl font-black text-slate-800 tracking-tight">Cập nhật thông tin cá nhân</p>
        <p className="text-slate-400 font-medium italic">Tính năng này giúp chị quản lý thông tin liên lạc và địa chỉ nhận dịch vụ.</p>
      </div>
    </div>
  );
}
