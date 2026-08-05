'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  CheckCircle,
  AlertCircle,
  Clock,
  Activity
} from 'lucide-react';

export default function ClinicalReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - Thống kê lâm sàng
  const clinicalStats = {
    totalEncounters: 234,
    completedTreatments: 198,
    successRate: 94.5,
    avgTreatmentTime: 45, // phút
    activePatients: 156,
    newPatients: 42,
  };

  // Mock data - Top procedures
  const topProcedures = [
    { name: 'Tẩy trắng răng', count: 45, revenue: 67500000, avgDuration: 60 },
    { name: 'Nhổ răng khôn', count: 38, revenue: 45600000, avgDuration: 30 },
    { name: 'Bọc sứ thẩm mỹ', count: 32, revenue: 128000000, avgDuration: 90 },
    { name: 'Cấy ghép Implant', count: 28, revenue: 224000000, avgDuration: 120 },
    { name: 'Điều trị tủy', count: 24, revenue: 19200000, avgDuration: 45 },
    { name: 'Niềng răng invisalign', count: 18, revenue: 216000000, avgDuration: 30 },
    { name: 'Trám răng sâu', count: 67, revenue: 20100000, avgDuration: 20 },
  ];

  // Mock data - Case mix by category
  const caseMixData = [
    { category: 'Thẩm mỹ', count: 95, percentage: 40.6, color: 'bg-cyan-500' },
    { category: 'Phục hồi', count: 76, percentage: 32.5, color: 'bg-blue-500' },
    { category: 'Nha chu', count: 38, percentage: 16.2, color: 'bg-teal-500' },
    { category: 'Nội nha', count: 25, percentage: 10.7, color: 'bg-emerald-500' },
  ];

  // Mock data - Treatment outcomes
  const treatmentOutcomes = [
    { status: 'Hoàn thành xuất sắc', count: 156, percentage: 78.8, color: 'text-emerald-600' },
    { status: 'Hoàn thành tốt', count: 31, percentage: 15.7, color: 'text-blue-600' },
    { status: 'Cần theo dõi', count: 8, percentage: 4.0, color: 'text-amber-600' },
    { status: 'Cần điều chỉnh', count: 3, percentage: 1.5, color: 'text-red-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-cyan-600" />
              Báo cáo Lâm sàng
            </h1>
            <p className="text-slate-600 mt-1">
              Thống kê ca điều trị, tỷ lệ thành công, case mix
            </p>
          </div>
          <div className="flex gap-2">
            {['week', 'month', 'quarter', 'year'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {period === 'week' && 'Tuần'}
                {period === 'month' && 'Tháng'}
                {period === 'quarter' && 'Quý'}
                {period === 'year' && 'Năm'}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tổng lượt khám</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {clinicalStats.totalEncounters}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +12% so với tháng trước
                  </p>
                </div>
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Ca hoàn thành</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {clinicalStats.completedTreatments}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {clinicalStats.totalEncounters - clinicalStats.completedTreatments} đang điều trị
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tỷ lệ thành công</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {clinicalStats.successRate}%
                  </p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +2.3% so với tháng trước
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Thời gian TB</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {clinicalStats.avgTreatmentTime}m
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Mỗi ca điều trị
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Procedures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-600" />
              Top Thủ thuật Điều trị
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProcedures.map((proc, idx) => {
                const maxCount = Math.max(...topProcedures.map(p => p.count));
                const widthPercent = (proc.count / maxCount) * 100;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-900 w-6">#{idx + 1}</span>
                        <span className="text-slate-700">{proc.name}</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-slate-600">
                          <span className="font-semibold text-slate-900">{proc.count}</span> ca
                        </span>
                        <span className="text-slate-600">
                          <span className="font-semibold text-cyan-600">
                            {(proc.revenue / 1000000).toFixed(1)}M
                          </span>
                        </span>
                        <span className="text-slate-600">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {proc.avgDuration}m
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Case Mix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" />
                Phân bố Ca bệnh (Case Mix)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {caseMixData.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-900 font-semibold">{item.count} ca</span>
                        <span className="text-slate-600">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Treatment Outcomes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Kết quả Điều trị
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {treatmentOutcomes.map((outcome, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      {outcome.status.includes('xuất sắc') && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                      {outcome.status.includes('tốt') && <CheckCircle className="w-5 h-5 text-blue-600" />}
                      {outcome.status.includes('theo dõi') && <AlertCircle className="w-5 h-5 text-amber-600" />}
                      {outcome.status.includes('điều chỉnh') && <AlertCircle className="w-5 h-5 text-red-600" />}
                      <span className={`font-medium ${outcome.color}`}>{outcome.status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-900 font-semibold">{outcome.count}</span>
                      <span className="text-slate-600 text-sm min-w-[50px] text-right">
                        {outcome.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Tổng kết:</span>
                </div>
                <p className="text-sm text-emerald-700 mt-2">
                  <span className="font-semibold">94.5%</span> ca điều trị đạt kết quả tốt và xuất sắc. 
                  Tỷ lệ cần can thiệp thấp (<span className="font-semibold">5.5%</span>).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
