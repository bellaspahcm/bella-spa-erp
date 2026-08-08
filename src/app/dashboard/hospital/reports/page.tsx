'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Bed,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Activity,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

// ─── Hospital BI Report Types ────────────────────────────────────────────────
interface WardStat {
  wardId: string;
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  avgLOS: number; // Average Length of Stay (days)
  admissionsThisMonth: number;
  dischargesThisMonth: number;
  mortalityRate: number;
  readmissionRate: number;
}

interface DailyMetric {
  date: string;
  admissions: number;
  discharges: number;
  occupancyRate: number;
  icuOccupancy: number;
}

const MOCK_WARD_STATS: WardStat[] = [
  {
    wardId: 'icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    totalBeds: 12,
    occupiedBeds: 10,
    avgLOS: 5.2,
    admissionsThisMonth: 28,
    dischargesThisMonth: 24,
    mortalityRate: 4.2,
    readmissionRate: 3.1,
  },
  {
    wardId: 'surgery',
    wardName: 'Khoa Ngoại Tổng Hợp',
    totalBeds: 30,
    occupiedBeds: 22,
    avgLOS: 4.8,
    admissionsThisMonth: 65,
    dischargesThisMonth: 62,
    mortalityRate: 0.8,
    readmissionRate: 2.5,
  },
  {
    wardId: 'internal',
    wardName: 'Khoa Nội Tổng Hợp',
    totalBeds: 40,
    occupiedBeds: 35,
    avgLOS: 6.1,
    admissionsThisMonth: 88,
    dischargesThisMonth: 81,
    mortalityRate: 1.2,
    readmissionRate: 4.0,
  },
  {
    wardId: 'cardio',
    wardName: 'Khoa Tim Mạch',
    totalBeds: 20,
    occupiedBeds: 18,
    avgLOS: 7.3,
    admissionsThisMonth: 42,
    dischargesThisMonth: 39,
    mortalityRate: 2.5,
    readmissionRate: 5.2,
  },
];

const MOCK_DAILY_METRICS: DailyMetric[] = [
  { date: '08/02', admissions: 12, discharges: 10, occupancyRate: 78, icuOccupancy: 82 },
  { date: '08/03', admissions: 9,  discharges: 11, occupancyRate: 76, icuOccupancy: 80 },
  { date: '08/04', admissions: 14, discharges: 8,  occupancyRate: 80, icuOccupancy: 83 },
  { date: '08/05', admissions: 11, discharges: 13, occupancyRate: 79, icuOccupancy: 85 },
  { date: '08/06', admissions: 15, discharges: 12, occupancyRate: 82, icuOccupancy: 88 },
  { date: '08/07', admissions: 10, discharges: 9,  occupancyRate: 83, icuOccupancy: 90 },
  { date: '08/08', admissions: 8,  discharges: 7,  occupancyRate: 84, icuOccupancy: 83 },
];

export default function HospitalReportsPage() {
  const [activeTab, setActiveTab] = useState<'occupancy' | 'clinical' | 'daily'>('occupancy');

  const totalBeds = MOCK_WARD_STATS.reduce((s, w) => s + w.totalBeds, 0);
  const totalOccupied = MOCK_WARD_STATS.reduce((s, w) => s + w.occupiedBeds, 0);
  const overallOccupancy = Math.round((totalOccupied / totalBeds) * 100);
  const totalAdmissions = MOCK_WARD_STATS.reduce((s, w) => s + w.admissionsThisMonth, 0);
  const avgLOS = (MOCK_WARD_STATS.reduce((s, w) => s + w.avgLOS, 0) / MOCK_WARD_STATS.length).toFixed(1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-violet-300 mb-1">
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Clinical Intelligence & Operational Analytics
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Báo Cáo Phân Tích Bệnh Viện</h1>
            <p className="text-violet-100 text-sm mt-1">
              Công suất giường bệnh, chỉ số lâm sàng, thời gian nằm viện trung bình và chất lượng chăm sóc.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Tổng giường', value: `${totalBeds}`, color: 'text-violet-200' },
              { label: 'Công suất', value: `${overallOccupancy}%`, color: 'text-emerald-300' },
              { label: 'NV tháng này', value: `${totalAdmissions}`, color: 'text-blue-300' },
              { label: 'LOS TB', value: `${avgLOS}d`, color: 'text-amber-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-white/10 rounded-xl px-3 py-2 border border-white/20">
                <div className={`text-xl font-black ${color}`}>{value}</div>
                <div className="text-[10px] text-white/70 font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'occupancy', label: 'Công Suất Giường Bệnh',     icon: Bed },
          { key: 'clinical',  label: 'Chỉ Số Lâm Sàng Khoa Phòng', icon: Activity },
          { key: 'daily',     label: 'Xu Hướng Nhập/Xuất Viện',  icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Occupancy Tab */}
      {activeTab === 'occupancy' && (
        <div className="space-y-4">
          {MOCK_WARD_STATS.map((ward) => {
            const rate = Math.round((ward.occupiedBeds / ward.totalBeds) * 100);
            const isHigh = rate >= 85;
            const isCritical = rate >= 95;
            return (
              <div key={ward.wardId} className={`bg-white border rounded-xl p-5 shadow-sm ${isCritical ? 'border-rose-300' : isHigh ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Bed className="w-4 h-4 text-violet-600" />
                      <span className="font-bold text-slate-800">{ward.wardName}</span>
                      {isCritical && <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded animate-pulse">QUÁ TẢI</span>}
                      {isHigh && !isCritical && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Gần đầy</span>}
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-3 mb-1">
                      <div
                        className={`h-3 rounded-full transition-all ${isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      {ward.occupiedBeds}/{ward.totalBeds} giường · Công suất {rate}%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="text-center bg-slate-50 rounded-lg px-4 py-2 border border-slate-200">
                      <div className="text-lg font-black text-slate-900">{ward.avgLOS}</div>
                      <div className="text-[10px] text-slate-500">ngày LOS</div>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg px-4 py-2 border border-slate-200">
                      <div className="text-lg font-black text-blue-700">{ward.admissionsThisMonth}</div>
                      <div className="text-[10px] text-slate-500">NV tháng</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clinical Indicators Tab */}
      {activeTab === 'clinical' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Khoa Phòng</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Nhập viện</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Xuất viện</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">LOS TB</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tỷ lệ tử vong</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tái nhập viện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_WARD_STATS.map((w) => (
                <tr key={w.wardId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{w.wardName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center space-x-1 text-blue-700">
                      <TrendingUp className="w-3 h-3" /><span>{w.admissionsThisMonth}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center space-x-1 text-emerald-700">
                      <TrendingDown className="w-3 h-3" /><span>{w.dischargesThisMonth}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-900">{w.avgLOS} ngày</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${w.mortalityRate > 3 ? 'text-rose-700' : 'text-slate-700'}`}>
                      {w.mortalityRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${w.readmissionRate > 4 ? 'text-amber-700' : 'text-slate-700'}`}>
                      {w.readmissionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily Trend Tab */}
      {activeTab === 'daily' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-4">Xu hướng nhập/xuất viện 7 ngày gần nhất</h3>
          <div className="space-y-3">
            {MOCK_DAILY_METRICS.map((m) => (
              <div key={m.date} className="grid grid-cols-5 gap-3 items-center">
                <span className="text-xs font-bold text-slate-500">{m.date}</span>
                <div className="col-span-2 flex items-center space-x-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(m.admissions / 20) * 100}%` }} />
                  </div>
                  <span className="text-xs text-blue-700 font-semibold w-10">NV:{m.admissions}</span>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(m.discharges / 20) * 100}%` }} />
                  </div>
                  <span className="text-xs text-emerald-700 font-semibold w-10">XV:{m.discharges}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <div className="text-sm font-bold text-blue-800">Công suất TB 7 ngày</div>
              <div className="text-2xl font-black text-blue-900 mt-1">
                {Math.round(MOCK_DAILY_METRICS.reduce((s, m) => s + m.occupancyRate, 0) / MOCK_DAILY_METRICS.length)}%
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
              <div className="text-sm font-bold text-rose-800">Công suất ICU TB</div>
              <div className="text-2xl font-black text-rose-900 mt-1">
                {Math.round(MOCK_DAILY_METRICS.reduce((s, m) => s + m.icuOccupancy, 0) / MOCK_DAILY_METRICS.length)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
