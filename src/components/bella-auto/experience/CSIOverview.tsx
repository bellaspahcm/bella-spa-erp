'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Award, AlertTriangle, PhoneCall } from 'lucide-react';

export function CSIOverview() {
  // Mock data
  const csiData = {
    overall: 4.3,
    totalResponses: 142,
    dimensions: [
      { name: 'Tư vấn bán hàng', score: 4.5, trend: 0.2 },
      { name: 'Cơ sở vật chất', score: 4.2, trend: 0.1 },
      { name: 'Thời gian giao xe', score: 3.9, trend: -0.1 },
      { name: 'Chất lượng xe', score: 4.6, trend: 0.3 },
      { name: 'Dịch vụ hậu mãi', score: 4.1, trend: 0.0 },
    ],
  };

  const consultants = [
    { name: 'Nguyễn Văn A', avgCSI: 4.7, surveys: 28 },
    { name: 'Trần Thị B', avgCSI: 4.5, surveys: 35 },
    { name: 'Lê Văn C', avgCSI: 4.2, surveys: 22 },
    { name: 'Phạm Thị D', avgCSI: 4.4, surveys: 31 },
    { name: 'Hoàng Văn E', avgCSI: 3.9, surveys: 26 },
  ];

  const lowCSICases = [
    {
      id: '1',
      customer: 'Khách hàng X',
      overallCSI: 2.8,
      lowestDimension: 'Thời gian giao xe',
      lowestScore: 2.0,
      feedback: 'Giao xe chậm hơn hẹn 2 tuần',
      consultant: 'Nguyễn Văn A',
    },
    {
      id: '2',
      customer: 'Khách hàng Y',
      overallCSI: 2.5,
      lowestDimension: 'Tư vấn bán hàng',
      lowestScore: 1.5,
      feedback: 'Tư vấn không nhiệt tình, thiếu kiến thức sản phẩm',
      consultant: 'Hoàng Văn E',
    },
  ];

  const getRatingColor = (score: number) => {
    if (score >= 4.5) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 4.0) return 'text-blue-600 dark:text-blue-400';
    if (score >= 3.5) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
      <Star
        key={star}
        className={`h-4 w-4 ${
          star <= Math.round(score)
            ? 'fill-amber-400 text-amber-400'
            : 'text-slate-200 dark:text-slate-700'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6" data-auto-layout>
      {/* Overall CSI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-600" />
              Customer Satisfaction Index (CSI)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Chỉ số hài lòng tổng hợp theo 5 tiêu chí trải nghiệm
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col lg:flex-row lg:items-center gap-8">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/20 border border-blue-100 dark:border-blue-900/30 text-center shrink-0 min-w-[180px]">
                <div className="text-6xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                  {csiData.overall}
                </div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {getStars(csiData.overall)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-2">
                  Thang điểm 5.0
                </div>
              </div>

              <div className="flex-1 space-y-3.5">
                {csiData.dimensions.map((dim) => (
                  <div key={dim.name}>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-600 dark:text-slate-300">{dim.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-extrabold ${getRatingColor(dim.score)}`}>
                          {dim.score}/5
                        </span>
                        {dim.trend !== 0 && (
                          <span
                            className={`text-[10px] font-bold ${
                              dim.trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {dim.trend > 0 ? '+' : ''}{dim.trend}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          dim.score >= 4.5
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : dim.score >= 4.0
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            : dim.score >= 3.5
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                            : 'bg-gradient-to-r from-rose-500 to-red-600'
                        }`}
                        style={{ width: `${(dim.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-medium">
              Tổng số khảo sát: <span className="font-bold text-slate-700 dark:text-slate-200">{csiData.totalResponses} phản hồi</span>
            </div>
          </CardContent>
        </Card>

        {/* CSI Interpretation */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Đánh giá chung</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300/50">
                ★ Khá tốt
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                CSI 4.3/5 đạt 86% chỉ số hài lòng khách hàng toàn diện.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Thang đánh giá:
              </div>
              <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-7 bg-emerald-500 rounded-full" />
                  4.5 - 5.0: Xuất sắc
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-7 bg-blue-500 rounded-full" />
                  4.0 - 4.4: Tốt
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-7 bg-amber-500 rounded-full" />
                  3.5 - 3.9: Trung bình
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-7 bg-rose-500 rounded-full" />
                  {'<'} 3.5: Kém
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-400">
                Mục tiêu hệ thống: <span className="font-bold text-slate-700 dark:text-slate-200">≥ 4.5/5</span>
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1">
                Cần cải thiện thêm +0.2 điểm
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultant Performance */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <CardHeader className="p-0 mb-5">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white">CSI theo Tư vấn viên (Top 5)</CardTitle>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Xếp hạng chuyên viên dựa trên điểm CSI trung bình
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3">
            {consultants.map((consultant, index) => (
              <div
                key={consultant.name}
                className="flex items-center gap-4 p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white font-extrabold text-xs shadow-sm">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">{consultant.name}</div>
                  <div className="text-xs text-slate-400">
                    {consultant.surveys} khảo sát
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-black ${getRatingColor(consultant.avgCSI)}`}>
                    {consultant.avgCSI}
                  </div>
                  <div className="flex items-center gap-0.5 justify-end mt-0.5">
                    {getStars(consultant.avgCSI)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Low CSI Alert */}
      <Card className="border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 rounded-3xl p-6 shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
        <CardHeader className="p-0 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-amber-950 dark:text-amber-200">
                Trường hợp CSI thấp cần xử lý
              </CardTitle>
              <CardDescription className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {lowCSICases.length} khách hàng đánh giá dưới 3.0/5
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3.5">
            {lowCSICases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="p-4 bg-white dark:bg-slate-900/80 border border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">{caseItem.customer}</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        CSI: {caseItem.overallCSI}/5
                      </span>
                    </div>
                    <div className="space-y-1 text-xs mt-2">
                      <div className="text-rose-600 dark:text-rose-400 font-bold">
                        ⚠ Chiều yếu nhất: {caseItem.lowestDimension} ({caseItem.lowestScore}/5)
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Phản hồi: "{caseItem.feedback}"
                      </div>
                      <div className="text-slate-400">
                        Tư vấn viên: {caseItem.consultant}
                      </div>
                    </div>
                  </div>
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-95 transition-all shrink-0">
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Liên hệ khắc phục</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
