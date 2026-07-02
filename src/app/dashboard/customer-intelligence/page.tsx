'use client';

/**
 * Customer Intelligence Landing Page
 * 
 * Overview of customer analytics and insights
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserCheck, Users, TrendingDown, DollarSign, Target, PieChart } from 'lucide-react';
import Link from 'next/link';

export default function CustomerIntelligencePage() {
  const router = useRouter();

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
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

      {/* Quick Stats (placeholder) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-[2rem] p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Khách có rủi ro cao</p>
              <p className="text-3xl font-bold text-red-900 mt-2">--</p>
            </div>
            <TrendingDown className="h-10 w-10 text-red-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">LTV trung bình</p>
              <p className="text-3xl font-bold text-green-900 mt-2">--</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-[2rem] p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Phân khúc</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">--</p>
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
