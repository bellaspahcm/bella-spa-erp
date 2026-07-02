'use client';

/**
 * HR Intelligence Landing Page
 * 
 * Overview of HR analytics and workforce intelligence
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Users, TrendingUp, Calendar, Clock, Award } from 'lucide-react';
import Link from 'next/link';

export default function HRIntelligencePage() {
  const router = useRouter();

  const hrModules = [
    {
      icon: Calendar,
      title: 'Chấm công & Lương',
      description: 'Theo dõi chấm công, tính lương tự động',
      href: '/dashboard/hr/attendance-payroll',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: Award,
      title: 'Đánh giá hiệu suất',
      description: 'KPI, đánh giá nhân viên theo tháng',
      href: '/dashboard/hr/performance',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: Users,
      title: 'Phân tích lực lượng',
      description: 'Cơ cấu nhân sự, tỷ lệ giữ chân',
      href: '/dashboard/hr/workforce',
      color: 'bg-green-100 text-green-600',
    },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative">
      {/* Header */}
      <div className="flex items-center gap-4 pt-4">
        <div className="p-3 bg-rose-100 rounded-xl">
          <Building2 className="h-8 w-8 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-rose-600 uppercase tracking-wide">Intelligence & Dự Báo</p>
          <h1 className="text-3xl font-bold text-slate-900">Phân Tích Nhân Sự</h1>
          <p className="text-slate-600 mt-1">Chấm công, lương, KPI và phân tích lực lượng lao động</p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {hrModules.map((module, index) => {
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
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-[2rem] p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Tổng nhân viên</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">--</p>
            </div>
            <Users className="h-10 w-10 text-blue-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-[2rem] p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Tỷ lệ chấm công</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">--%</p>
            </div>
            <Clock className="h-10 w-10 text-purple-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">KPI trung bình</p>
              <p className="text-3xl font-bold text-green-900 mt-2">--</p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-6 bg-blue-50 rounded-[2rem] border border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Gợi ý:</strong> Chọn một module phía trên để xem chi tiết phân tích nhân sự. 
          Dữ liệu được cập nhật tự động từ hệ thống chấm công và bảng lương.
        </p>
      </div>
    </div>
  );
}
