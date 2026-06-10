'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Calendar, CheckCircle2, Clock, Gift, Info, Loader2, Settings, TrendingUp } from 'lucide-react';
import type { CrmStatsSnapshot, CrmZaloConfig } from '../types';

interface CrmOverviewTabProps {
  stats: CrmStatsSnapshot;
  zaloConfig: CrmZaloConfig;
  setZaloConfig: Dispatch<SetStateAction<CrmZaloConfig>>;
  actionLoading: string | null;
  onSaveConfig: () => void;
}

export function CrmOverviewTab({
  stats,
  zaloConfig,
  setZaloConfig,
  actionLoading,
  onSaveConfig,
}: CrmOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            label="Đã gửi ZNS thành công"
            value={stats.totalRemindersSent}
            helper="Tự động 100%"
            icon={<CheckCircle2 className="w-6 h-6" />}
            helperIcon={<TrendingUp className="w-3 h-3" />}
            colorClass="text-primary bg-rose-50"
          />
          <StatCard
            label="Lịch chưa nhắc hôm nay"
            value={stats.pendingRemindersToday}
            helper="Quét tự động trước 2.5 giờ"
            icon={<Clock className="w-6 h-6" />}
            colorClass="text-amber-500 bg-amber-50"
          />
          <StatCard
            label="Sinh nhật hôm nay"
            value={stats.totalBirthdaysToday}
            helper="Khách hàng sinh ngày này"
            icon={<Gift className="w-6 h-6" />}
            colorClass="text-rose-400 bg-pink-50"
          />
          <StatCard
            label="Sinh nhật trong tháng"
            value={stats.totalBirthdaysMonth}
            helper="Tặng mã khuyến mãi sinh nhật"
            icon={<Calendar className="w-6 h-6" />}
            colorClass="text-slate-500 bg-slate-50"
          />
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16" />
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Tiến trình quét tự động & tích hợp Zalo
          </h3>
          <div className="space-y-4 text-sm text-slate-600 font-medium">
            <p>
              Hệ thống đồng bộ với Zalo OA và Zalo Notification Service để nhắc lịch dịch vụ cho khách hàng.
              Khi bật tự động, hệ thống quét các ca dịch vụ sắp diễn ra và gửi ZNS theo mốc 2.5 giờ trước lịch hẹn.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-500">
              <li>Quét các lịch dịch vụ có trạng thái chờ thực hiện trong ngày.</li>
              <li>Đối chiếu thời gian hẹn theo múi giờ Việt Nam.</li>
              <li>Gửi mẫu ZNS qua Zalo OA và đánh dấu đã gửi để tránh trùng lặp.</li>
            </ul>
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 mt-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-primary text-xs uppercase tracking-wider mb-0.5">Lưu ý bảo mật & RLS</h4>
                <p className="text-xs text-slate-500">
                  Mọi hành động gửi tin Zalo ZNS đều được ghi nhật ký để đối soát và kiểm tra chất lượng chăm sóc.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Cấu hình Zalo OA
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">Cài đặt kết nối API Zalo Notification Service</p>
        </div>

        <div className="space-y-4">
          <TextInput label="Zalo App ID" value={zaloConfig.zalo_app_id} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_app_id: value })} placeholder="Nhập Zalo App ID" />
          <TextInput label="Secret Key" value={zaloConfig.zalo_secret_key} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_secret_key: value })} placeholder="••••••••••••••••••••••••" type="password" />
          <TextInput label="Zalo Official Account ID" value={zaloConfig.zalo_oa_id} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_oa_id: value })} placeholder="Nhập Zalo OA ID" />
          <TextInput label="Access Token" value={zaloConfig.zalo_access_token} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_access_token: value })} placeholder="••••••••••••••••••••••••" type="password" />
          <TextInput label="Refresh Token" value={zaloConfig.zalo_refresh_token} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_refresh_token: value })} placeholder="••••••••••••••••••••••••" type="password" />
          <TextInput label="Mẫu ZNS nhắc lịch hẹn" value={zaloConfig.zalo_template_reminder_id} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_template_reminder_id: value })} placeholder="ZNS_REMINDER_V2" />
          <TextInput label="Mẫu ZNS chúc mừng sinh nhật" value={zaloConfig.zalo_template_birthday_id} onChange={(value) => setZaloConfig({ ...zaloConfig, zalo_template_birthday_id: value })} placeholder="ZNS_BIRTHDAY_GIFT_V1" />

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-700">Tự động gửi tin</p>
              <p className="text-[10px] text-slate-400 font-medium">Bật quét tự động trước giờ chăm sóc</p>
            </div>
            <button
              type="button"
              onClick={() => setZaloConfig({ ...zaloConfig, zalo_auto_scan: !zaloConfig.zalo_auto_scan })}
              className={`w-12 h-6 rounded-full p-1 transition-all ${zaloConfig.zalo_auto_scan ? 'bg-primary flex justify-end' : 'bg-slate-200 flex justify-start'}`}
            >
              <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </button>
          </div>

          <button
            onClick={onSaveConfig}
            disabled={actionLoading === 'save_zalo_config'}
            className="w-full py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all pt-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'save_zalo_config' && <Loader2 className="w-4 h-4 animate-spin" />}
            Lưu cấu hình kết nối
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon,
  helperIcon,
  colorClass,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
  helperIcon?: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <h3 className="text-3xl font-black text-slate-800">{value}</h3>
        <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
          {helperIcon}
          {helper}
        </p>
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${colorClass}`}>
        {icon}
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'password';
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
      />
    </div>
  );
}
