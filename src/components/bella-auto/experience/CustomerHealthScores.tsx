'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Heart, Activity, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

export function CustomerHealthScores() {
  const atRiskCustomers = [
    {
      id: '1',
      name: 'Nguyễn Văn A',
      healthScore: 35,
      status: 'at_risk',
      riskFactors: ['Không tương tác 60 ngày', 'NPS detractor (4/10)'],
      lastPurchase: '2025-01-15',
    },
    {
      id: '2',
      name: 'Trần Thị B',
      healthScore: 52,
      status: 'needs_attention',
      riskFactors: ['CSI thấp (2.8/5)', 'Không dùng dịch vụ 6 tháng'],
      lastPurchase: '2025-11-20',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Xuất sắc</span>;
      case 'healthy':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Khỏe mạnh</span>;
      case 'needs_attention':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Cần chú ý</span>;
      case 'at_risk':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Nguy cơ cao</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" data-auto-layout>
      {/* Health Score Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="p-0 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <Heart className="h-4 w-4" />
              </div>
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xuất sắc</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">45</div>
            <p className="text-xs text-slate-400 mt-1">≥ 80 điểm tổng hợp</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_24px_rgba(59,130,246,0.12)] hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="p-0 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                <Activity className="h-4 w-4" />
              </div>
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khỏe mạnh</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">78</div>
            <p className="text-xs text-slate-400 mt-1">60 - 79 điểm</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_24px_rgba(245,158,11,0.12)] hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="p-0 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cần chú ý</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">32</div>
            <p className="text-xs text-slate-400 mt-1">40 - 59 điểm</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_24px_rgba(244,63,94,0.12)] hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="p-0 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nguy cơ cao</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400">12</div>
            <p className="text-xs text-slate-400 mt-1">{'<'} 40 điểm</p>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Customers */}
      <Card className="border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 rounded-3xl p-6 shadow-[0_4px_20px_rgba(244,63,94,0.06)]">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Khách hàng cần chăm sóc khẩn cấp
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4">
            {atRiskCustomers.map((customer) => (
              <div
                key={customer.id}
                className="p-4 bg-white dark:bg-slate-900/80 border border-rose-100 dark:border-rose-900/30 rounded-2xl shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">{customer.name}</span>
                      {getStatusBadge(customer.status)}
                      <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {customer.healthScore} <span className="text-xs font-normal text-slate-400">đpt</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-400">
                        Yếu tố rủi ro:
                      </div>
                      {customer.riskFactors.map((factor, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                        >
                          <span className="text-rose-500 font-bold">•</span>
                          {factor}
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1">
                      Lần giao dịch cuối: {new Date(customer.lastPurchase).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-rose-500/20 active:scale-95 transition-all shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Tạo kế hoạch chăm sóc</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health Score Components */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <CardHeader className="p-0 mb-6">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-cyan-600" />
            Các thành phần Health Score
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 p-4 border border-slate-100 dark:border-slate-800/60 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Engagement (25%)</h4>
              <p className="text-xs text-slate-400">
                Tần suất tương tác, touchpoints, active journey
              </p>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 w-3/4 rounded-full" />
              </div>
            </div>

            <div className="space-y-2 p-4 border border-slate-100 dark:border-slate-800/60 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Satisfaction (35%)</h4>
              <p className="text-xs text-slate-400">
                Chỉ số NPS và CSI scores trực tiếp
              </p>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-4/5 rounded-full" />
              </div>
            </div>

            <div className="space-y-2 p-4 border border-slate-100 dark:border-slate-800/60 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Revenue (25%)</h4>
              <p className="text-xs text-slate-400">
                Mua xe, dịch vụ bảo dưỡng, tần suất chi tiêu
              </p>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-2/3 rounded-full" />
              </div>
            </div>

            <div className="space-y-2 p-4 border border-slate-100 dark:border-slate-800/60 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Loyalty (15%)</h4>
              <p className="text-xs text-slate-400">
                Thâm niên, repeat business, giới thiệu người thân
              </p>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 w-1/2 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
