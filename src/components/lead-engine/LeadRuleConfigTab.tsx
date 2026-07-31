'use client';

import React, { useState } from 'react';
import { LeadRuleConfig, DEFAULT_LEAD_RULE_CONFIG } from '@/platform/lead-engine';
import { Settings, Save, Clock, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface LeadRuleConfigTabProps {
  initialConfig?: LeadRuleConfig;
  onSaveConfig?: (newConfig: LeadRuleConfig) => void;
}

export function LeadRuleConfigTab({ initialConfig, onSaveConfig }: LeadRuleConfigTabProps) {
  const [config, setConfig] = useState<LeadRuleConfig>(initialConfig || DEFAULT_LEAD_RULE_CONFIG);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSaveConfig) {
      onSaveConfig(config);
    }
    toast.success('Đã cập nhật cấu hình Lead SLA & Rotation Rules thành công!');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-600" />
            Cấu Hình Lead SLA & Rotation Engine (Admin Rules)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quy định hạn chót nhận lead, chu kỳ follow-up, số lần không nghe máy và số vòng xoay tự động.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
        >
          <Save className="w-4 h-4" />
          Lưu Quy Tắc
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* SLA Timers Card */}
        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-700 pb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            1. Cấu Hình Thời Gian SLA (SLA Timers)
          </h3>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Thời gian chờ Sale nhận lead (Accept SLA)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={1440}
                value={config.acceptWindowMinutes}
                onChange={e => setConfig({ ...config, acceptWindowMinutes: Number(e.target.value) })}
                className="w-28 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
              />
              <span className="text-slate-500 font-medium">phút (Ví dụ: 30 phút)</span>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Hạn chót Cập Nhật Phản Hồi Lần 1 (Follow-up #1 SLA)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={72}
                value={config.followup1WindowHours}
                onChange={e => setConfig({ ...config, followup1WindowHours: Number(e.target.value) })}
                className="w-28 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
              />
              <span className="text-slate-500 font-medium">giờ kể từ khi nhận lead (Ví dụ: 2 giờ)</span>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Hạn chót Cập Nhật Phản Hồi Lần 2 (Follow-up #2 SLA)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={168}
                value={config.followup2WindowHours}
                onChange={e => setConfig({ ...config, followup2WindowHours: Number(e.target.value) })}
                className="w-28 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
              />
              <span className="text-slate-500 font-medium">giờ kể từ lần 1 (Ví dụ: 24 giờ)</span>
            </div>
          </div>
        </div>

        {/* Rotation Rules Card */}
        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-700 pb-2">
            <ArrowRightLeft className="w-4 h-4 text-purple-500" />
            2. Cấu Hình Xoay Vòng Lead (Rotation Engine)
          </h3>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Số lần gọi không nghe máy tối đa trước khi xoay lead
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxNoAnswerAttempts}
                onChange={e => setConfig({ ...config, maxNoAnswerAttempts: Number(e.target.value) })}
                className="w-28 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
              />
              <span className="text-slate-500 font-medium">lần liên tiếp (Ví dụ: 2 lần)</span>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Số vòng xoay tối đa giữa các Sale (Max Rotations)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxRotations}
                onChange={e => setConfig({ ...config, maxRotations: Number(e.target.value) })}
                className="w-28 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
              />
              <span className="text-slate-500 font-medium">vòng (Ví dụ: 3 vòng)</span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoRotateOnTimeout}
                onChange={e => setConfig({ ...config, autoRotateOnTimeout: e.target.checked })}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Tự động xoay lead sang Sale khác khi quá hạn SLA chờ nhận
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.escalateToManagerOnMaxRotations}
                onChange={e => setConfig({ ...config, escalateToManagerOnMaxRotations: e.target.checked })}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Chuyển cho Quản lý sàn khi xoay hết số vòng tối đa
              </span>
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}
