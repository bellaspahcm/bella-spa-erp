'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationSetting {
  title: string;
  desc: string;
  active: boolean;
}

export default function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      title: 'Lịch hẹn mới',
      desc: 'Nhận thông báo khi có khách hàng đặt lịch qua App',
      active: true,
    },
    {
      title: 'Báo cáo doanh thu',
      desc: 'Gửi báo cáo tổng hợp vào cuối ngày qua Email',
      active: true,
    },
    {
      title: 'Cảnh báo tồn kho',
      desc: 'Thông báo khi vật tư spa sắp hết',
      active: false,
    },
    {
      title: 'Sinh nhật khách hàng',
      desc: 'Nhắc nhở chúc mừng sinh nhật khách hàng thân thiết',
      active: true,
    },
  ]);

  const toggleActive = (idx: number) => {
    setSettings((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, active: !item.active } : item))
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500">
          <Bell className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Thông báo</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Tùy chỉnh các kênh nhận thông báo hệ thống
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {settings.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-6 bg-white/40 rounded-3xl border border-white group hover:bg-white/60 transition-all"
          >
            <div>
              <p className="font-black text-slate-900">{item.title}</p>
              <p className="text-sm text-muted-foreground font-semibold mt-1">
                {item.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(idx)}
              className={cn(
                "w-14 h-8 rounded-full p-1 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20",
                item.active ? 'bg-primary' : 'bg-slate-200'
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 bg-white rounded-full shadow-sm transition-all",
                  item.active ? 'ml-6' : 'ml-0'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
