'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Car, 
  GitCommit, 
  Smile, 
  TrendingUp, 
  Users, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  BarChart3,
  Search,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// Type definitions for mockup data
interface AutoStat {
  label: string;
  value: string;
  trend: number;
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
}

interface VehicleMock {
  id: string;
  model: string;
  vin: string;
  status: 'InTransit' | 'Warehouse' | 'Showroom' | 'Allocated' | 'Delivered';
  color: string;
  price: string;
}

interface JourneyMock {
  id: string;
  customerName: string;
  modelInterest: string;
  currentStage: string;
  score: number;
  prob: number;
  lastActivity: string;
}

export default function BellaAutoDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const stats: AutoStat[] = [
    { label: 'Tổng Xe Nhập Kho', value: '148 xe', trend: 12.5, icon: Car, color: 'text-blue-600', bg: 'bg-blue-50/50' },
    { label: 'Hành Trình Đang Chạy', value: '3,842 hành trình', trend: 8.4, icon: GitCommit, color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
    { label: 'Điểm NPS Hệ Thống', value: '78 / 100', trend: 2.1, icon: Smile, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
    { label: 'Lượt Sửa Chữa Hôm Nay', value: '42 ca', trend: -4.3, icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50/50' },
  ];

  const recentVehicles: VehicleMock[] = [
    { id: '1', model: 'BMW 330i Luxury Line', vin: 'WBAHF3C01L7D34567', status: 'Showroom', color: 'Alpine White', price: '2,439,000,000đ' },
    { id: '2', model: 'BMW X5 xDrive40i MSport', vin: 'WBACR6C09L7E98765', status: 'Allocated', color: 'Carbon Black', price: '4,019,000,000đ' },
    { id: '3', model: 'BMW M4 Competition Coupe', vin: 'WBA53AZ04M8F12345', status: 'Warehouse', color: 'Sao Paulo Yellow', price: '5,599,000,000đ' },
  ];

  const activeJourneys: JourneyMock[] = [
    { id: '1', customerName: 'Trần Văn Hoàng', modelInterest: 'BMW 330i', currentStage: 'Test Drive (Lái thử)', score: 94, prob: 87, lastActivity: 'Hôm nay, 10:15' },
    { id: '2', customerName: 'Lê Thị Mai', modelInterest: 'BMW X5 xDrive40i', currentStage: 'Negotiation (Thương thảo)', score: 82, prob: 75, lastActivity: 'Hôm qua' },
    { id: '3', customerName: 'Nguyễn Minh Triết', modelInterest: 'BMW M4', currentStage: 'Quotation (Báo giá V2)', score: 91, prob: 85, lastActivity: '3 ngày trước' },
  ];

  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-6 animate-pulse bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">BELLA AUTO EXECUTIVE</h1>
          <p className="text-muted-foreground font-semibold mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse" />
            AI-Powered Enterprise Intelligence Platform for Automotive
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toast.success('Đang đồng bộ dữ liệu từ hệ thống tổng bộ...')}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Đồng bộ AI
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex items-center justify-between"
            >
              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-400 block">{stat.label}</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white block">{stat.value}</span>
                <span className={`text-xs font-bold flex items-center gap-1 ${stat.trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  <TrendingUp className={`w-3.5 h-3.5 ${stat.trend < 0 ? 'rotate-180' : ''}`} />
                  {stat.trend > 0 ? `+${stat.trend}%` : `${stat.trend}%`} so với tháng trước
                </span>
              </div>
              <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center`}>
                <Icon className={`w-7 h-7 ${stat.color}`} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Active Customer Journeys */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">Hành Trình Khách Hàng Hoạt Động</h2>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Top 3 khách hàng có mức độ tương tác cao nhất</p>
            </div>
            <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {activeJourneys.map((journey) => (
              <div 
                key={journey.id} 
                className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                    {journey.customerName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-base">{journey.customerName}</h4>
                    <p className="text-xs font-semibold text-slate-400">{journey.modelInterest}</p>
                    <span className="inline-block mt-2 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-100/30">
                      {journey.currentStage}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">Tỷ lệ chốt (AI)</span>
                    <span className="text-base font-black text-emerald-500 block">{journey.prob}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">Điểm tương tác</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 block">{journey.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: AI Recommendations & Vehicles Catalog */}
        <div className="space-y-8">
          
          {/* AI Next Best Action Panel */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-900/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-300" />
              </div>
              <h3 className="font-black text-sm uppercase tracking-widest text-indigo-200">AI Next Best Action</h3>
            </div>
            <p className="text-sm font-semibold text-indigo-100 leading-relaxed mb-6">
              "Khách hàng Trần Văn Hoàng đã hoàn thành lái thử cách đây 2 ngày và có điểm tương tác 94. Hãy gửi Báo giá V2 kèm theo chương trình chiết khấu 2% đặc biệt của chi nhánh."
            </p>
            <button 
              onClick={() => toast.success('Đã gửi đề xuất báo giá tới Sale phụ trách!')}
              className="w-full py-3 bg-white text-indigo-950 font-extrabold rounded-xl hover:bg-indigo-50 active:scale-95 transition-all text-xs uppercase tracking-wider shadow-md"
            >
              Gửi Báo Giá Ngay
            </button>
          </div>

          {/* Recent Vehicles */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wide text-sm">Kho Xe Mới Nhập</h3>
              <button className="text-xs font-bold text-slate-400 hover:text-slate-600">Xem tất cả</button>
            </div>
            <div className="space-y-4">
              {recentVehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">{vehicle.model}</h4>
                    <p className="text-[10px] text-slate-400 font-mono font-semibold">{vehicle.vin}</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      vehicle.status === 'Showroom' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                      vehicle.status === 'Allocated' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    }`}>
                      {vehicle.status}
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-800 dark:text-white shrink-0">{vehicle.price}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
