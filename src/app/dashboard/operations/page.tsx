'use client';

/**
 * Operations Intelligence Landing Page
 * 
 * Overview of operational analytics and performance metrics with real-time Quick Stats
 * 
 * UPDATED: 2026-06-22 - Added real Quick Stats using Intelligence Layer hooks
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, Package, Users, Calendar, TrendingUp, Star, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useInventoryOptimization, useKTVPerformance, useSessionUtilization } from '@/hooks/intelligence';

export default function OperationsIntelligencePage() {
  const router = useRouter();

  // Get current month/year and date range for queries
  const dateParams = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    
    // Last 30 days for session utilization
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return { month, year, startDate, endDate };
  }, []);

  // Fetch real-time Quick Stats using Intelligence Layer hooks
  const inventoryQuery = useInventoryOptimization(undefined, { refetchOnMount: false });
  const ktvQuery = useKTVPerformance(dateParams.month, dateParams.year, { refetchOnMount: false });
  const sessionQuery = useSessionUtilization(dateParams.startDate, dateParams.endDate, { refetchOnMount: false });

  // Calculate Quick Stats from fetched data
  const quickStats = useMemo(() => {
    const inventoryCount = inventoryQuery.data?.data?.length ?? 0;
    const activeKTVs = ktvQuery.data?.data?.length ?? 0;
    
    // Calculate average session completion rate
    let sessionCompletionRate = 0;
    if (sessionQuery.data?.data && sessionQuery.data.data.length > 0) {
      const totalUtilization = sessionQuery.data.data.reduce(
        (sum, day) => sum + (day.utilizationRate || 0), 
        0
      );
      sessionCompletionRate = totalUtilization / sessionQuery.data.data.length;
    }

    return { inventoryCount, activeKTVs, sessionCompletionRate };
  }, [inventoryQuery.data, ktvQuery.data, sessionQuery.data]);

  const isLoadingStats = inventoryQuery.isLoading || ktvQuery.isLoading || sessionQuery.isLoading;

  const operationModules = [
    {
      icon: Package,
      title: 'Quản lý kho',
      description: 'Tồn kho, nhập xuất, cảnh báo hết hàng',
      href: '/dashboard/operations/inventory',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: Star,
      title: 'Hiệu suất KTV',
      description: 'Đánh giá, xếp hạng, thưởng KTV',
      href: '/dashboard/operations/ktv-performance',
      color: 'bg-pink-100 text-pink-600',
    },
    {
      icon: Calendar,
      title: 'Phân tích ca làm',
      description: 'Lịch làm việc, số ca, tỷ lệ hoàn thành',
      href: '/dashboard/operations/sessions',
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative">
      {/* Header */}
      <div className="flex items-center gap-4 pt-4">
        <div className="p-3 bg-rose-100 rounded-xl">
          <Activity className="h-8 w-8 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-rose-600 uppercase tracking-wide">Intelligence & Dự Báo</p>
          <h1 className="text-3xl font-bold text-slate-900">Phân Tích Vận Hành</h1>
          <p className="text-slate-600 mt-1">Kho hàng, hiệu suất KTV và quản lý ca làm việc</p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {operationModules.map((module, index) => {
          const Icon = module.icon;
          return (
            <motion.div
              key={module.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={module.href}>
                <div className="bg-white rounded-[2rem] border border-rose-100 shadow-sm p-8 hover:shadow-lg transition-all cursor-pointer group">
                  <div className={`w-14 h-14 rounded-2xl ${module.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{module.title}</h3>
                  <p className="text-slate-600 text-sm">{module.description}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Stats (real-time data) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-[2rem] p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 font-medium">Sản phẩm tồn kho</p>
              <p className="text-3xl font-bold text-orange-900 mt-2">
                {isLoadingStats ? (
                  <RefreshCw className="h-6 w-6 animate-spin inline" />
                ) : (
                  quickStats.inventoryCount
                )}
              </p>
              <p className="text-xs text-orange-600 mt-1">Inventory items</p>
            </div>
            <Package className="h-10 w-10 text-orange-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-[2rem] p-6 border border-pink-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-pink-700 font-medium">KTV hoạt động</p>
              <p className="text-3xl font-bold text-pink-900 mt-2">
                {isLoadingStats ? (
                  <RefreshCw className="h-6 w-6 animate-spin inline" />
                ) : (
                  quickStats.activeKTVs
                )}
              </p>
              <p className="text-xs text-pink-600 mt-1">Tháng {dateParams.month}/{dateParams.year}</p>
            </div>
            <Users className="h-10 w-10 text-pink-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-[2rem] p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Ca hoàn thành</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {isLoadingStats ? (
                  <RefreshCw className="h-6 w-6 animate-spin inline" />
                ) : (
                  `${quickStats.sessionCompletionRate.toFixed(1)}%`
                )}
              </p>
              <p className="text-xs text-blue-600 mt-1">30 ngày qua</p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-6 bg-blue-50 rounded-[2rem] border border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Gợi ý:</strong> Chọn một module phía trên để xem chi tiết phân tích vận hành. 
          Dữ liệu được tổng hợp từ kho hàng, lịch KTV và ca làm việc.
        </p>
      </div>
    </div>
  );
}
