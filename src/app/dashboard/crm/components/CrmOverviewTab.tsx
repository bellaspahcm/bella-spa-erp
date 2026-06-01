'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Gift,
  Info,
  Loader2,
  Settings,
  TrendingUp,
} from 'lucide-react';
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
          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ÄÃ£ gá»­i ZNS thÃ nh cÃ´ng</p>
              <h3 className="text-3xl font-black text-slate-800">{stats.totalRemindersSent}</h3>
              <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Tá»± Ä‘á»™ng 100%
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-primary shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lá»‹ch chÆ°a nháº¯c hÃ´m nay</p>
              <h3 className="text-3xl font-black text-slate-800">{stats.pendingRemindersToday}</h3>
              <p className="text-[10px] text-rose-500 font-bold">QuÃ©t tá»± Ä‘á»™ng trÆ°á»›c 2.5 giá»</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sinh nháº­t hÃ´m nay</p>
              <h3 className="text-3xl font-black text-slate-800">{stats.totalBirthdaysToday}</h3>
              <p className="text-[10px] text-slate-400 font-bold">BÃ© sinh ngÃ y nÃ y</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center text-rose-400 shadow-inner">
              <Gift className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 luxury-box-hover flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sinh nháº­t trong thÃ¡ng</p>
              <h3 className="text-3xl font-black text-slate-800">{stats.totalBirthdaysMonth}</h3>
              <p className="text-[10px] text-primary font-bold">Táº·ng mÃ£ BELLA_BABY_1ST</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-inner">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16" />
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Tiáº¿n trÃ¬nh QuÃ©t tá»± Ä‘á»™ng & TÃ­ch há»£p Zalo
          </h3>
          <div className="space-y-4 text-sm text-slate-600 font-medium">
            <p>Há»‡ thá»‘ng Bella Spa ERP há»— trá»£ Ä‘á»“ng bá»™ hoÃ n toÃ n vá»›i Zalo OA vÃ  cá»•ng Zalo Notification Service (ZNS). Khi kÃ­ch hoáº¡t, má»™t tiáº¿n trÃ¬nh cháº¡y ngáº§m (cron job) sáº½ thá»±c hiá»‡n:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-500">
              <li>QuÃ©t cÃ¡c buá»•i chÄƒm sÃ³c máº¹ & bÃ© (`session_logs`) cÃ³ tráº¡ng thÃ¡i `scheduled` trong ngÃ y.</li>
              <li>So sÃ¡nh thá»i gian báº¯t Ä‘áº§u háº¹n vá»›i giá» Viá»‡t Nam hiá»‡n táº¡i.</li>
              <li>Náº¿u cÃ²n chÃ­nh xÃ¡c **2.5 giá»** Ä‘áº¿n lá»‹ch háº¹n, há»‡ thá»‘ng tá»± Ä‘á»™ng soáº¡n máº«u ZNS, gá»i API Zalo OA Ä‘á»ƒ gá»­i tin nháº¯n Ä‘áº¿n sá»‘ Ä‘iá»‡n thoáº¡i Ä‘Äƒng kÃ½ cá»§a máº¹.</li>
              <li>Sau khi API pháº£n há»“i thÃ nh cÃ´ng, Ä‘Ã¡nh dáº¥u `zalo_reminder_sent = true` Ä‘á»ƒ trÃ¡nh trÃ¹ng láº·p.</li>
            </ul>

            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 mt-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-primary text-xs uppercase tracking-wider mb-0.5">LÆ°u Ã½ báº£o máº­t & RLS</h4>
                <p className="text-xs text-slate-500">CÆ¡ sá»Ÿ dá»¯ liá»‡u Ä‘áº£m báº£o an toÃ n tuyá»‡t Ä‘á»‘i. Báº¥t cá»© hÃ nh Ä‘á»™ng gá»­i tin Zalo ZNS nÃ o Ä‘á»u Ä‘Æ°á»£c ghi láº¡i trong Nháº­t kÃ½ há»‡ thá»‘ng Ä‘á»ƒ Ä‘á»‘i soÃ¡t.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Cáº¥u hÃ¬nh Zalo OA
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">CÃ i Ä‘áº·t káº¿t ná»‘i API Zalo Notification Service (ZNS)</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Zalo App ID</label>
            <input
              type="text"
              value={zaloConfig.zalo_app_id || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_app_id: e.target.value })}
              placeholder="Nháº­p Zalo App ID"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Secret Key (KhÃ³a báº£o máº­t)</label>
            <input
              type="password"
              value={zaloConfig.zalo_secret_key || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_secret_key: e.target.value })}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Zalo Official Account ID</label>
            <input
              type="text"
              value={zaloConfig.zalo_oa_id || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_oa_id: e.target.value })}
              placeholder="Nháº­p Zalo OA ID"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Access Token</label>
            <input
              type="password"
              value={zaloConfig.zalo_access_token || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_access_token: e.target.value })}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Refresh Token</label>
            <input
              type="password"
              value={zaloConfig.zalo_refresh_token || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_refresh_token: e.target.value })}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Máº«u ZNS nháº¯c lá»‹ch háº¹n</label>
            <input
              type="text"
              value={zaloConfig.zalo_template_reminder_id || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_template_reminder_id: e.target.value })}
              placeholder="ZNS_REMINDER_V2"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Máº«u ZNS chÃºc má»«ng sinh nháº­t</label>
            <input
              type="text"
              value={zaloConfig.zalo_template_birthday_id || ''}
              onChange={(e) => setZaloConfig({ ...zaloConfig, zalo_template_birthday_id: e.target.value })}
              placeholder="ZNS_BIRTHDAY_GIFT_V1"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-transparent focus:border-rose-100 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-700">Tá»± Ä‘á»™ng gá»­i tin (Cronjob)</p>
              <p className="text-[10px] text-slate-400 font-medium">Báº­t quÃ©t tá»± Ä‘á»™ng trÆ°á»›c giá» chÄƒm sÃ³c</p>
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
            LÆ¯U Cáº¤U HÃŒNH Káº¾T Ná»I
          </button>
        </div>
      </div>
    </div>
  );
}
