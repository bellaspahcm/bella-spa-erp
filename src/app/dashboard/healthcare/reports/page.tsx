'use client';

import React from 'react';
import { BarChart3, TrendingUp, Users, Clock, AlertTriangle, ShieldCheck, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function HealthcareReportsPage() {
  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Báo Cáo Vận Hành Y Tế & SLA Bottleneck Report
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Phân tích Công suất Ghế khám, Thời gian Chờ SLA bệnh nhân & Tỷ lệ Quyết toán BHYT.
          </p>
        </div>

        <button
          onClick={() => toast.success('Đang xuất báo cáo y tế định dạng PDF/Excel...')}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md flex items-center gap-2 cursor-pointer w-fit"
        >
          <Download className="w-4 h-4" />
          Xuất Báo Cáo Y Tế
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Tổng Số Ca Khám Hôm Nay', value: '42 ca', trend: '+12% so với hôm qua', color: 'text-cyan-600' },
          { label: 'Thời Gian Chờ Trung Bình (SLA)', value: '11.5 phút', trend: 'Trong ngưỡng cam kết < 15p', color: 'text-emerald-600' },
          { label: 'Công Suất Ghế Khám (Capacity)', value: '84%', trend: '4/4 ghế hoạt động', color: 'text-indigo-600' },
          { label: 'Tỷ Lệ Quyết Toán BHYT Thành Công', value: '98.5%', trend: 'Duyệt cổng BHXH', color: 'text-blue-600' }
        ].map((m, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-bold block">{m.label}</span>
            <span className={`text-2xl font-black ${m.color} block`}>{m.value}</span>
            <span className="text-[11px] text-slate-500 font-medium">{m.trend}</span>
          </div>
        ))}
      </div>

      {/* Bottleneck Monitor */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-500" />
          Phân Tích Điểm Nghẽn Vận Hành (SLA Bottleneck Analysis)
        </h3>

        <div className="space-y-3 text-xs">
          {[
            { station: 'Trạm Tiếp Đón & Cấp Số STT', avgTime: '2.5 phút', status: 'optimal', label: 'Tối ưu' },
            { station: 'Trạm Đo Sinh Hiệu (Vitals)', avgTime: '3.0 phút', status: 'optimal', label: 'Tối ưu' },
            { station: 'Phòng Khám Bác Sĩ (Consultation)', avgTime: '14.2 phút', status: 'warning', label: 'Tải Cao' },
            { station: 'Phòng Xét Nghiệm (LIS)', avgTime: '22.0 phút', status: 'normal', label: 'Đạt SLA' },
            { station: 'Nhà Thuốc & Cấp Phát Thuốc', avgTime: '4.5 phút', status: 'optimal', label: 'Tối ưu' }
          ].map((s, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">{s.station}</span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-slate-500">{s.avgTime}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  s.status === 'warning' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                }`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
