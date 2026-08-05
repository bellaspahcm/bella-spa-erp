'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, AlertTriangle, ShieldAlert } from 'lucide-react';

export function LostAnalyticsPanel() {
  const lostStats = {
    totalLost: 24,
    byStage: {
      quotation: 8,
      negotiation: 6,
      test_drive: 4,
      commitment: 3,
      other: 3,
    },
    topReasons: [
      { reason: 'price_too_high', count: 9, percentage: 37.5 },
      { reason: 'competitor_better_offer', count: 7, percentage: 29.2 },
      { reason: 'not_ready', count: 5, percentage: 20.8 },
    ],
    topCompetitors: [
      { brand: 'Toyota', count: 5 },
      { brand: 'Honda', count: 3 },
      { brand: 'Mazda', count: 2 },
    ],
  };

  return (
    <div className="space-y-4" data-auto-layout>
      <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-600" />
            Mất khách theo giai đoạn
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-2">
            {Object.entries(lostStats.byStage).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60">
                <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{stage}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">{count} khách</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Nguyên nhân chính
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3">
            {lostStats.topReasons.map((reason) => (
              <div key={reason.reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{reason.reason}</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{reason.count} ({reason.percentage}%)</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full transition-all duration-500"
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl p-5 shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-sm font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Đối thủ cạnh tranh
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-2">
            {lostStats.topCompetitors.map((competitor) => (
              <div key={competitor.brand} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm text-xs">
                <span className="font-extrabold text-slate-900 dark:text-white">{competitor.brand}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">{competitor.count} khách</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
