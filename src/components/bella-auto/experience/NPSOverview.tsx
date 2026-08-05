'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, PhoneCall, CheckCircle } from 'lucide-react';

export function NPSOverview() {
  // Mock data
  const npsData = {
    currentNPS: 42,
    previousNPS: 37,
    totalResponses: 156,
    promoters: 78,
    passives: 62,
    detractors: 16,
    promoterPercentage: 50.0,
    passivePercentage: 39.7,
    detractorPercentage: 10.3,
  };

  const trend = npsData.currentNPS - npsData.previousNPS;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600';

  const detractors = [
    {
      id: '1',
      customer: 'Nguyễn Văn A',
      score: 4,
      feedback: 'Giá hơi cao so với đối thủ',
      date: '2026-08-01',
      followedUp: false,
    },
    {
      id: '2',
      customer: 'Trần Thị B',
      score: 6,
      feedback: 'Thời gian giao xe lâu quá',
      date: '2026-07-30',
      followedUp: false,
    },
    {
      id: '3',
      customer: 'Lê Văn C',
      score: 5,
      feedback: 'Tư vấn viên chưa nhiệt tình',
      date: '2026-07-28',
      followedUp: true,
    },
  ];

  return (
    <div className="space-y-6" data-auto-layout>
      {/* NPS Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] transition-all duration-300">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Net Promoter Score (NPS)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Chỉ số đo lường mức độ sẵn sàng giới thiệu dịch vụ cho bạn bè & người thân
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col lg:flex-row lg:items-center gap-8">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center shrink-0 min-w-[180px]">
                <div className="text-6xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {npsData.currentNPS > 0 ? '+' : ''}{npsData.currentNPS}
                </div>
                <div className={`flex items-center justify-center gap-1.5 mt-2 ${trendColor} text-xs font-bold`}>
                  <TrendIcon className="h-4 w-4" />
                  <span>{trend > 0 ? '+' : ''}{trend} điểm so với tháng trước</span>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                {/* Promoters */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      Promoters (9-10)
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {npsData.promoters} ({npsData.promoterPercentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${npsData.promoterPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Passives */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                      Passives (7-8)
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {npsData.passives} ({npsData.passivePercentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500"
                      style={{ width: `${npsData.passivePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Detractors */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-rose-700 dark:text-rose-400 font-bold">
                      Detractors (0-6)
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {npsData.detractors} ({npsData.detractorPercentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full transition-all duration-500"
                      style={{ width: `${npsData.detractorPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
              <div>Công thức: NPS = % Promoters - % Detractors</div>
              <div className="font-bold text-slate-600 dark:text-slate-300">Tổng số phản hồi: {npsData.totalResponses} khách hàng</div>
            </div>
          </CardContent>
        </Card>

        {/* NPS Interpretation */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Đánh giá chung</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/50">
                ★ Tốt
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Chỉ số NPS +42 thuộc nhóm Tốt trong ngành Automotive tại Việt Nam (Benchmark 30 - 50).
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Thang đánh giá chuẩn:
              </div>
              <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between"><span>{'>'} 70 điểm</span><span className="font-bold text-emerald-600">Xuất sắc</span></div>
                <div className="flex items-center justify-between"><span>30 - 70 điểm</span><span className="font-bold text-emerald-500">Tốt</span></div>
                <div className="flex items-center justify-between"><span>0 - 30 điểm</span><span className="font-bold text-amber-500">Cần cải thiện</span></div>
                <div className="flex items-center justify-between"><span>{'<'} 0 điểm</span><span className="font-bold text-rose-500">Kém</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detractors Alert */}
      <Card className="border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 rounded-3xl p-6 shadow-[0_4px_20px_rgba(244,63,94,0.06)]">
        <CardHeader className="p-0 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-rose-950 dark:text-rose-200">
                Detractors cần follow-up ngay
              </CardTitle>
              <CardDescription className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                {detractors.filter(d => !d.followedUp).length} khách hàng chưa được liên hệ khắc phục
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3">
            {detractors.map((detractor) => (
              <div
                key={detractor.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900/80 rounded-2xl border border-rose-100 dark:border-rose-900/30 shadow-sm gap-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{detractor.customer}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      NPS: {detractor.score}/10
                    </span>
                    {detractor.followedUp && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50">
                        <CheckCircle className="h-3 w-3" /> Đã liên hệ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    "{detractor.feedback}"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(detractor.date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                {!detractor.followedUp && (
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md hover:shadow-rose-500/20 active:scale-95 transition-all shrink-0">
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Gọi ngay</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* NPS by Source */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white">NPS theo nguồn khảo sát</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sau giao xe</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">+45</div>
              <div className="text-xs text-slate-400 mt-1">98 phản hồi hoàn tất</div>
            </div>
            <div className="p-5 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sau bảo dưỡng</div>
              <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">+38</div>
              <div className="text-xs text-slate-400 mt-1">58 phản hồi hoàn tất</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
