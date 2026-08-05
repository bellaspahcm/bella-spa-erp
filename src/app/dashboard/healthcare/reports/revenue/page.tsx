'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Calendar,
  PieChart,
  Target
} from 'lucide-react';

export default function RevenueAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - Revenue stats
  const revenueStats = {
    totalRevenue: 920500000,
    revenueGrowth: 15.3,
    avgRevenuePerPatient: 5900000,
    avgRevenuePerEncounter: 3932000,
    totalPatients: 156,
    totalEncounters: 234,
  };

  // Mock data - Revenue by service category
  const revenueByCategory = [
    { category: 'Cấy ghép Implant', revenue: 224000000, count: 28, percentage: 24.3, color: 'bg-cyan-600' },
    { category: 'Niềng răng Invisalign', revenue: 216000000, count: 18, percentage: 23.5, color: 'bg-blue-600' },
    { category: 'Bọc sứ thẩm mỹ', revenue: 128000000, count: 32, percentage: 13.9, color: 'bg-teal-600' },
    { category: 'Tẩy trắng răng', revenue: 67500000, count: 45, percentage: 7.3, color: 'bg-emerald-600' },
    { category: 'Nhổ răng khôn', revenue: 45600000, count: 38, percentage: 5.0, color: 'bg-sky-600' },
    { category: 'Trám răng', revenue: 20100000, count: 67, percentage: 2.2, color: 'bg-indigo-600' },
    { category: 'Điều trị tủy', revenue: 19200000, count: 24, percentage: 2.1, color: 'bg-violet-600' },
    { category: 'Khác', revenue: 200100000, count: 82, percentage: 21.7, color: 'bg-slate-500' },
  ];

  // Mock data - Revenue by doctor
  const revenueByDoctor = [
    { name: 'BS. Lê Minh', title: 'Nha sĩ Trưởng', revenue: 380000000, patients: 68, avgPerPatient: 5588235, growth: 18.2 },
    { name: 'BS. Trần Thảo', title: 'Chuyên gia Phục hình', revenue: 340000000, patients: 52, avgPerPatient: 6538461, growth: 22.5 },
    { name: 'BS. Nguyễn An', title: 'Bác sĩ Nội nha', revenue: 200500000, patients: 36, avgPerPatient: 5569444, growth: 8.3 },
  ];

  // Mock data - Monthly trend
  const monthlyTrend = [
    { month: 'T1', revenue: 680000000, target: 750000000 },
    { month: 'T2', revenue: 720000000, target: 750000000 },
    { month: 'T3', revenue: 780000000, target: 750000000 },
    { month: 'T4', revenue: 850000000, target: 800000000 },
    { month: 'T5', revenue: 920500000, target: 850000000 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-blue-600" />
              Phân tích Doanh thu
            </h1>
            <p className="text-slate-600 mt-1">
              Doanh thu theo dịch vụ, bác sĩ, thời gian
            </p>
          </div>
          <div className="flex gap-2">
            {['week', 'month', 'quarter', 'year'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white shadow-md'
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
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tổng doanh thu</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {(revenueStats.totalRevenue / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{revenueStats.revenueGrowth}% so tháng trước
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">TB/Bệnh nhân</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {(revenueStats.avgRevenuePerPatient / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {revenueStats.totalPatients} bệnh nhân
                  </p>
                </div>
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">TB/Lượt khám</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {(revenueStats.avgRevenuePerEncounter / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {revenueStats.totalEncounters} lượt khám
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tăng trưởng</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2 flex items-center gap-2">
                    <TrendingUp className="w-7 h-7" />
                    {revenueStats.revenueGrowth}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    So với tháng trước
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Target className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue by Service Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-600" />
              Doanh thu theo Loại dịch vụ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueByCategory.map((item, idx) => {
                const maxRevenue = Math.max(...revenueByCategory.map(c => c.revenue));
                const widthPercent = (item.revenue / maxRevenue) * 100;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-slate-700 font-medium">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-slate-600">
                          <span className="font-semibold text-slate-900">{item.count}</span> ca
                        </span>
                        <span className="text-slate-600 min-w-[60px] text-right">
                          <span className="font-semibold text-blue-600">
                            {(item.revenue / 1000000).toFixed(1)}M
                          </span>
                        </span>
                        <span className="text-slate-600 min-w-[50px] text-right">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Doctor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Doanh thu theo Bác sĩ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {revenueByDoctor.map((doctor, idx) => (
                <div key={idx} className="p-4 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{doctor.name}</h3>
                      <p className="text-sm text-slate-600">{doctor.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {(doctor.revenue / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-emerald-600 flex items-center gap-1 justify-end mt-1">
                        <TrendingUp className="w-3 h-3" />
                        +{doctor.growth}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                    <div>
                      <p className="text-xs text-slate-600">Số bệnh nhân</p>
                      <p className="text-lg font-semibold text-slate-900">{doctor.patients}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">TB/Bệnh nhân</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {(doctor.avgPerPatient / 1000000).toFixed(1)}M
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Xu hướng Doanh thu (5 tháng gần nhất)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyTrend.map((month, idx) => {
                const achievementRate = (month.revenue / month.target) * 100;
                const isAboveTarget = month.revenue >= month.target;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 w-12">{month.month}</span>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-slate-600">
                          Thực tế: <span className="font-semibold text-blue-600">
                            {(month.revenue / 1000000).toFixed(0)}M
                          </span>
                        </span>
                        <span className="text-slate-600">
                          Mục tiêu: <span className="font-semibold text-slate-900">
                            {(month.target / 1000000).toFixed(0)}M
                          </span>
                        </span>
                        <span className={`font-semibold ${isAboveTarget ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {achievementRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAboveTarget 
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500' 
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${Math.min(achievementRate, 100)}%` }}
                      />
                      {/* Target line marker */}
                      <div className="absolute top-0 right-0 w-0.5 h-full bg-red-500 opacity-50" />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 text-blue-800">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Nhận xét:</span>
              </div>
              <p className="text-sm text-blue-700 mt-2">
                Doanh thu tăng đều qua các tháng. Tháng 5 đạt{' '}
                <span className="font-semibold">920.5M</span> (+15.3% so tháng trước), 
                vượt mục tiêu <span className="font-semibold">108.3%</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
