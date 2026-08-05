'use client';

/**
 * Experience Dashboard Component
 * Main dashboard for customer experience metrics
 * Redesigned with Ocean Clean luxury aesthetics & elevated container shadows
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NPSOverview } from './NPSOverview';
import { CSIOverview } from './CSIOverview';
import { CustomerHealthScores } from './CustomerHealthScores';
import { NextBestActionsPanel } from './NextBestActionsPanel';
import { LostAnalyticsPanel } from './LostAnalyticsPanel';
import { TrendChart } from './TrendChart';
import {
  RefreshCw,
  LayoutDashboard,
  TrendingUp,
  Award,
  Activity,
  Zap,
  ShieldAlert,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ExperienceDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<string>('overview');

  const handleRefresh = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLastRefresh(new Date());
    }, 1000);
  };

  return (
    <div className="space-y-8" data-auto-layout>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span>Cập nhật lần cuối:</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{lastRefresh.toLocaleTimeString('vi-VN')}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới dữ liệu
        </Button>
      </div>

      {/* Main Tabs — Synchronized Luxury Segmented Bar with Equal-Width Tab Boxes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex items-center justify-start">
          <div className="p-1.5 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] backdrop-blur-md inline-flex max-w-full overflow-x-auto">
            <TabsList className="inline-flex items-center justify-start bg-transparent p-0 gap-1.5 h-auto w-auto group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:w-auto border-none shadow-none">
              <TabsTrigger
                value="overview"
                className="inline-flex items-center justify-center gap-2 h-10 py-2 w-32 sm:w-36 md:w-40 rounded-xl text-xs font-bold transition-all duration-200 after:hidden after:content-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_2px_10px_rgba(8,145,178,0.15)] data-[state=active]:border data-[state=active]:border-cyan-200/60 dark:data-[state=active]:border-cyan-900/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40 cursor-pointer shrink-0 text-center"
              >
                <LayoutDashboard className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <span>Tổng quan</span>
              </TabsTrigger>

              <TabsTrigger
                value="nps"
                className="inline-flex items-center justify-center gap-2 h-10 py-2 w-32 sm:w-36 md:w-40 rounded-xl text-xs font-bold transition-all duration-200 after:hidden after:content-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_2px_10px_rgba(16,185,129,0.15)] data-[state=active]:border data-[state=active]:border-emerald-200/60 dark:data-[state=active]:border-emerald-900/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40 cursor-pointer shrink-0 text-center"
              >
                <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>NPS</span>
              </TabsTrigger>

              <TabsTrigger
                value="csi"
                className="inline-flex items-center justify-center gap-2 h-10 py-2 w-32 sm:w-36 md:w-40 rounded-xl text-xs font-bold transition-all duration-200 after:hidden after:content-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_2px_10px_rgba(59,130,246,0.15)] data-[state=active]:border data-[state=active]:border-blue-200/60 dark:data-[state=active]:border-blue-900/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40 cursor-pointer shrink-0 text-center"
              >
                <Award className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>CSI</span>
              </TabsTrigger>

              <TabsTrigger
                value="health"
                className="inline-flex items-center justify-center gap-2 h-10 py-2 w-32 sm:w-36 md:w-40 rounded-xl text-xs font-bold transition-all duration-200 after:hidden after:content-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:shadow-[0_2px_10px_rgba(245,158,11,0.15)] data-[state=active]:border data-[state=active]:border-amber-200/60 dark:data-[state=active]:border-amber-900/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40 cursor-pointer shrink-0 text-center"
              >
                <Activity className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Sức khỏe KH</span>
              </TabsTrigger>

              <TabsTrigger
                value="actions"
                className="inline-flex items-center justify-center gap-2 h-10 py-2 w-32 sm:w-36 md:w-40 rounded-xl text-xs font-bold transition-all duration-200 after:hidden after:content-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-[0_2px_10px_rgba(147,51,234,0.15)] data-[state=active]:border data-[state=active]:border-purple-200/60 dark:data-[state=active]:border-purple-900/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40 cursor-pointer shrink-0 text-center"
              >
                <Zap className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>Hành động</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-8 outline-none">
          {/* Key Metrics — Elevated Cards with Shadows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* NPS Score Card */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  NPS Score
                </span>
                <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                +42
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/30 px-2 py-0.5 rounded-full">
                  <ArrowUpRight className="h-3 w-3" /> +5 điểm
                </span>
                <span className="text-xs text-slate-400">so với tháng trước</span>
              </div>
            </Card>

            {/* CSI Average Card */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(59,130,246,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  CSI Average
                </span>
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 group-hover:scale-110 transition-transform">
                  <Award className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                4.3<span className="text-lg font-bold text-slate-400">/5</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/30 px-2 py-0.5 rounded-full">
                  86% hài lòng
                </span>
                <span className="text-xs text-slate-400">142 khảo sát</span>
              </div>
            </Card>

            {/* At Risk Customers Card */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(245,158,11,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  At Risk Customers
                </span>
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 group-hover:scale-110 transition-transform">
                  <ShieldAlert className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                12
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/30 px-2 py-0.5 rounded-full">
                  Cần chăm sóc ngay
                </span>
              </div>
            </Card>

            {/* Pending Actions Card */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(147,51,234,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pending Actions
                </span>
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
                28
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center text-[11px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-900/30 px-2 py-0.5 rounded-full">
                  8 ưu tiên cao
                </span>
              </div>
            </Card>
          </div>

          {/* Charts Row — Elevated Shadow Boxes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] transition-all duration-300">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  NPS Trend (6 tháng)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Xu hướng biến động Net Promoter Score
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <TrendChart
                  data={[
                    { month: 'T1', value: 35 },
                    { month: 'T2', value: 38 },
                    { month: 'T3', value: 37 },
                    { month: 'T4', value: 40 },
                    { month: 'T5', value: 37 },
                    { month: 'T6', value: 42 },
                  ]}
                  color="green"
                />
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] transition-all duration-300">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-600" />
                  CSI by Dimension
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Điểm hài lòng chi tiết theo 5 tiêu chí trải nghiệm
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-4">
                  {[
                    { label: 'Tư vấn bán hàng', score: 4.5 },
                    { label: 'Cơ sở vật chất', score: 4.2 },
                    { label: 'Thời gian giao xe', score: 3.9 },
                    { label: 'Chất lượng xe', score: 4.6 },
                    { label: 'Dịch vụ hậu mãi', score: 4.1 },
                  ].map((dim) => (
                    <div key={dim.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-300">{dim.label}</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{dim.score}<span className="text-slate-400 font-normal">/5</span></span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${(dim.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Best Actions Preview — Elevated Container Box */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] transition-all duration-300">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" />
                Hành động ưu tiên cao (Top 5)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Gợi ý AI (Next Best Actions) cần xử lý ngay lập tức
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <NextBestActionsPanel limit={5} priorityFilter="high" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* NPS Tab */}
        <TabsContent value="nps" className="space-y-6 outline-none">
          <NPSOverview />
        </TabsContent>

        {/* CSI Tab */}
        <TabsContent value="csi" className="space-y-6 outline-none">
          <CSIOverview />
        </TabsContent>

        {/* Health Scores Tab */}
        <TabsContent value="health" className="space-y-6 outline-none">
          <CustomerHealthScores />
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" />
                Next Best Actions
              </h3>
              <NextBestActionsPanel />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Lost Analysis
              </h3>
              <LostAnalyticsPanel />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
