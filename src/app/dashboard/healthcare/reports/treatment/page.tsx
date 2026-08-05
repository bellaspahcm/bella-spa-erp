'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, 
  TrendingUp, 
  Clock,
  Users,
  Star,
  ThumbsUp,
  AlertTriangle,
  CheckCircle2,
  Smile
} from 'lucide-react';

export default function TreatmentStatisticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - Treatment stats
  const treatmentStats = {
    totalProcedures: 312,
    avgDuration: 45, // minutes
    patientSatisfaction: 4.7, // out of 5
    successRate: 94.5,
    complicationRate: 2.3,
    followUpRate: 87.5,
  };

  // Mock data - Patient satisfaction breakdown
  const satisfactionBreakdown = [
    { rating: 5, count: 142, percentage: 68.3, label: 'Xuất sắc' },
    { rating: 4, count: 48, percentage: 23.1, label: 'Tốt' },
    { rating: 3, count: 14, percentage: 6.7, label: 'Khá' },
    { rating: 2, count: 3, percentage: 1.4, label: 'Cần cải thiện' },
    { rating: 1, count: 1, percentage: 0.5, label: 'Không hài lòng' },
  ];

  // Mock data - Treatment complexity
  const treatmentComplexity = [
    { level: 'Đơn giản', count: 156, avgDuration: 25, successRate: 98.1, color: 'bg-emerald-500' },
    { level: 'Trung bình', count: 98, avgDuration: 45, successRate: 95.9, color: 'bg-blue-500' },
    { level: 'Phức tạp', count: 42, avgDuration: 75, successRate: 90.5, color: 'bg-amber-500' },
    { level: 'Rất phức tạp', count: 16, avgDuration: 120, successRate: 87.5, color: 'bg-red-500' },
  ];

  // Mock data - Patient age distribution
  const ageDistribution = [
    { range: '0-17', count: 24, percentage: 15.4 },
    { range: '18-30', count: 45, percentage: 28.8 },
    { range: '31-45', count: 52, percentage: 33.3 },
    { range: '46-60', count: 28, percentage: 17.9 },
    { range: '60+', count: 7, percentage: 4.5 },
  ];

  // Mock data - Common complications
  const complications = [
    { type: 'Nhiễm trùng nhẹ', count: 4, severity: 'low', treatment: 'Kháng sinh' },
    { type: 'Đau kéo dài', count: 3, severity: 'low', treatment: 'Giảm đau' },
    { type: 'Chảy máu', count: 2, severity: 'medium', treatment: 'Cầm máu' },
    { type: 'Phản ứng vật liệu', count: 1, severity: 'medium', treatment: 'Thay thế' },
  ];

  // Mock data - Follow-up status
  const followUpStatus = [
    { status: 'Đúng hẹn', count: 112, percentage: 71.8, color: 'text-emerald-600' },
    { status: 'Trễ hẹn', count: 25, percentage: 16.0, color: 'text-amber-600' },
    { status: 'Chưa tái khám', count: 19, percentage: 12.2, color: 'text-slate-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-teal-600" />
              Thống kê Điều trị
            </h1>
            <p className="text-slate-600 mt-1">
              Treatment outcomes, patient satisfaction, complications tracking
            </p>
          </div>
          <div className="flex gap-2">
            {['week', 'month', 'quarter', 'year'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-teal-600 text-white shadow-md'
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
          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tổng thủ thuật</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {treatmentStats.totalProcedures}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +8% so tháng trước
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-teal-600" />
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
                    {treatmentStats.avgDuration}m
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Mỗi thủ thuật
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-br from-white to-yellow-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Hài lòng TB</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 flex items-center gap-2">
                    {treatmentStats.patientSatisfaction}
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    208 đánh giá
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Smile className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tỷ lệ thành công</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">
                    {treatmentStats.successRate}%
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Biến chứng: {treatmentStats.complicationRate}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Patient Satisfaction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                Mức độ Hài lòng Bệnh nhân
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {satisfactionBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: item.rating }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          ))}
                          {Array.from({ length: 5 - item.rating }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-slate-300" />
                          ))}
                        </div>
                        <span className="text-slate-700 font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-900 font-semibold">{item.count}</span>
                        <span className="text-slate-600 min-w-[50px] text-right">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.rating >= 4 ? 'bg-emerald-500' : 
                          item.rating === 3 ? 'bg-blue-500' : 
                          item.rating === 2 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-800">
                  <ThumbsUp className="w-5 h-5" />
                  <span className="font-medium">Tổng kết:</span>
                </div>
                <p className="text-sm text-emerald-700 mt-2">
                  <span className="font-semibold">91.4%</span> bệnh nhân đánh giá 4-5 sao (Tốt & Xuất sắc). 
                  Điểm trung bình <span className="font-semibold">4.7/5.0</span>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Treatment Complexity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                Độ phức tạp Điều trị
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {treatmentComplexity.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="font-medium text-slate-900">{item.level}</span>
                      </div>
                      <span className="text-slate-900 font-semibold">{item.count} ca</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-slate-600">Thời gian TB</p>
                        <p className="font-semibold text-slate-900">{item.avgDuration} phút</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Tỷ lệ thành công</p>
                        <p className="font-semibold text-emerald-600">{item.successRate}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Age Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Phân bố Độ tuổi Bệnh nhân
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ageDistribution.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-medium">{item.range} tuổi</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-900 font-semibold">{item.count}</span>
                        <span className="text-slate-600 min-w-[50px] text-right">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Follow-up Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                Tình trạng Tái khám
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {followUpStatus.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <span className={`font-medium ${item.color}`}>{item.status}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-900 font-semibold">{item.count}</span>
                      <span className="text-slate-600 text-sm min-w-[50px] text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">
                  Tỷ lệ tái khám: <span className="font-semibold">{treatmentStats.followUpRate}%</span>
                  {' '}({followUpStatus[0].count + followUpStatus[1].count} bệnh nhân)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Complications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Biến chứng Thường gặp ({treatmentStats.complicationRate}% tổng số ca)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {complications.length > 0 ? (
              <div className="space-y-3">
                {complications.map((comp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        comp.severity === 'low' ? 'bg-amber-500' : 
                        comp.severity === 'medium' ? 'bg-orange-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium text-slate-900">{comp.type}</p>
                        <p className="text-xs text-slate-600">Xử lý: {comp.treatment}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{comp.count} ca</p>
                      <p className="text-xs text-slate-600">
                        {((comp.count / treatmentStats.totalProcedures) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                <p>Không có biến chứng nghiêm trọng trong kỳ này</p>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Đánh giá:</span>
              </div>
              <p className="text-sm text-emerald-700 mt-2">
                Tỷ lệ biến chứng <span className="font-semibold">{treatmentStats.complicationRate}%</span> thấp hơn 
                mức trung bình ngành (3-5%). Tất cả các trường hợp đã được xử lý kịp thời và hiệu quả.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
