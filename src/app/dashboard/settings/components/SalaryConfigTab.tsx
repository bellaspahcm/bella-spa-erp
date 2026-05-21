"use client";

import React from "react";
import { Coins, Star, Zap } from "lucide-react";
import { TenantGeneralSettings } from "@/types/domain";

interface SalaryConfigTabProps {
  generalSettings: TenantGeneralSettings;
  setGeneralSettings: React.Dispatch<React.SetStateAction<TenantGeneralSettings>>;
}

export default function SalaryConfigTab({
  generalSettings,
  setGeneralSettings,
}: SalaryConfigTabProps) {
  const salaryConfig = generalSettings.salary_config || {
    bonus_5_star: 50000,
    bonus_4_5_star: 30000,
    bonus_4_star: 10000,
    kpi_target_sessions: 30,
    kpi_bonus_amount: 1000000,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Coins className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Cấu hình Lương & Thưởng
          </h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Tùy chỉnh các mốc thưởng chất lượng đánh giá và thưởng KPI
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Thưởng chất lượng */}
        <div className="p-8 bg-white/40 rounded-[2.5rem] border border-white shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-rose-500 fill-rose-500" />
            </div>
            <h3 className="font-black text-lg text-slate-900">Thưởng Chất lượng</h3>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <span>Mốc đạt 5.0 Sao</span>
                <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Cao nhất</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={(salaryConfig.bonus_5_star || 0).toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    setGeneralSettings({
                      ...generalSettings,
                      salary_config: { ...salaryConfig, bonus_5_star: isNaN(numericValue) ? 0 : numericValue }
                    });
                  }}
                  className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Mốc đạt 4.5 Sao
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={(salaryConfig.bonus_4_5_star || 0).toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    setGeneralSettings({
                      ...generalSettings,
                      salary_config: { ...salaryConfig, bonus_4_5_star: isNaN(numericValue) ? 0 : numericValue }
                    });
                  }}
                  className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Mốc đạt 4.0 Sao
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={(salaryConfig.bonus_4_star || 0).toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    setGeneralSettings({
                      ...generalSettings,
                      salary_config: { ...salaryConfig, bonus_4_star: isNaN(numericValue) ? 0 : numericValue }
                    });
                  }}
                  className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thưởng KPI */}
        <div className="p-8 bg-white/40 rounded-[2.5rem] border border-white shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            </div>
            <h3 className="font-black text-lg text-slate-900">Thưởng KPI (Số ca)</h3>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Chỉ tiêu số ca yêu cầu (Tháng)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={salaryConfig.kpi_target_sessions ?? 0}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    salary_config: { ...salaryConfig, kpi_target_sessions: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Ca</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <span>Mức thưởng khi vượt KPI</span>
                <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Cộng vào Lương</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={(salaryConfig.kpi_bonus_amount || 0).toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    setGeneralSettings({
                      ...generalSettings,
                      salary_config: { ...salaryConfig, kpi_bonus_amount: isNaN(numericValue) ? 0 : numericValue }
                    });
                  }}
                  className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-4">
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                * KTV hoàn thành lớn hơn <strong className="text-primary">{salaryConfig.kpi_target_sessions} ca</strong> trong tháng sẽ tự động được cộng <strong className="text-primary">{(salaryConfig.kpi_bonus_amount || 0).toLocaleString('vi-VN')}₫</strong> vào tổng nhận.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
