'use client';

/**
 * Customer Intelligence Landing Page
 * 
 * Overview of customer analytics and insights with real-time Quick Stats
 * 
 * UPDATED: 2026-06-22 - Added real Quick Stats using Intelligence Layer hooks
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserCheck, Users, TrendingDown, DollarSign, Target, PieChart, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useChurnRisk, useCustomerCLV, useCustomerSegmentation } from '@/hooks/intelligence';

export default function CustomerIntelligencePage() {
  const router = useRouter();

  // Fetch real-time Quick Stats using Intelligence Layer hooks
  // High churn risk: customers with churn probability > 0.7 (70%)
  const churnRiskQuery = useChurnRisk(0.7, { refetchOnMount: false });
  
  // Customer LTV: get all customers to calculate average
  const clvQuery = useCustomerCLV(undefined, { refetchOnMount: false });
  
  // Customer segments: all segments
  const segmentationQuery = useCustomerSegmentation(undefined, { refetchOnMount: false });

  // Calculate Quick Stats from fetched data
  const quickStats = useMemo(() => {
    const highRiskCount = churnRiskQuery.data?.data?.length ?? 0;
    
    let avgLTV = 0;
    if (clvQuery.data?.data) {
      const clvData = Array.isArray(clvQuery.data.data) 
        ? clvQuery.data.data 
        : [clvQuery.data.data];
      
      if (clvData.length > 0) {
        const totalCLV = clvData.reduce((sum, customer) => sum + (customer.currentCLV || 0), 0);
        avgLTV = Math.round(totalCLV / clvData.length);
      }
    }
    
    const segmentCount = segmentationQuery.data?.data?.length ?? 0;

    return { highRiskCount, avgLTV, segmentCount };
  }, [churnRiskQuery.data, clvQuery.data, segmentationQuery.data]);

  const isLoadingStats = churnRiskQuery.isLoading || clvQuery.isLoading || segmentationQuery.isLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const customerModules = [
    {
      icon: TrendingDown,
      title: 'Rủi ro rời đi',
      description: 'Dự báo khách hàng có nguy cơ rời bỏ',
      href: '/dashboard/customer/churn-risk',
      color: 'bg-red-100 text-red-600',
    },
    {
      icon: DollarSign,
      title: 'Giá trị vòng đời',
      description: 'Lifetime Value (LTV) của khách hàng',
      href: '/dashboard/customer/lifetime-value',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: Target,
      title: 'Phân khúc khách hàng',
      description: 'Nhóm khách hàng theo hành vi',
      href: '/dashboard/customer/segmentation',
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative">
      {/* Header */}
      <div className="flex items-center gap-4 pt-4">
        <div className="p-3 bg-rose-100 rounded-xl">
          <UserCheck className="h-8 w-8 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-rose-600 uppercase tracking-wide">Intelligence & Dự Báo</p>
          <h1 className="text-3xl font-bold text-slate-900">Phân Tích Khách Hàng</h1>
          <p className="text-slate-600 mt-1">Dự báo churn, LTV và phân khúc khách hàng thông minh</p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {customerModules.map((module, index) => {
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
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-[2rem] p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Khách có rủi ro cao</p>
              <p className="text-3xl font-bold text-red-900 mt-2">
                {isLoadingStats ? (
                  <RefreshCw className="h-6 w-6 animate-spin inline" />
                ) : (
                  quickStats.highRiskCount
                )}
              </p>
              <p className="text-xs text-red-600 mt-1">Churn risk &gt; 70%</p>
            </div>
            <TrendingDown className="h-10 w-10 text-red-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">LTV trung bình</p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {isLoadingStats ? (
                  <RefreshCw className="h-6 w-6 animate-spin inline" />
                ) : quickStats.avgLTV > 0 ? (
                  formatCurrency(quickStats.avgLTV)
                ) : (
                  '--'
                )}
              </p>
              <p className="text-xs text-green-600 mt-1">Lifetime value</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-[2rem] p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Phân khúc</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {isLoadingStats ? (
                  <RefreshCw className="h-6 w-6 animate-spin inline" />
                ) : (
                  quickStats.segmentCount
                )}
              </p>
              <p className="text-xs text-purple-600 mt-1">Customer segments</p>
            </div>
            <PieChart className="h-10 w-10 text-purple-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-6 bg-blue-50 rounded-[2rem] border border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Gợi ý:</strong> Chọn một module phía trên để xem chi tiết phân tích khách hàng. 
          Machine Learning sẽ tự động phân loại và dự báo hành vi khách hàng.
        </p>
      </div>
    </div>
  );
}
