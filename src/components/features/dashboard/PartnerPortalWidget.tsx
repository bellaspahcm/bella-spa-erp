'use client';

import { motion } from 'framer-motion';
import { Briefcase, ArrowRight, Users, DollarSign, TrendingUp, Building2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PartnerPortalWidgetProps {
  className?: string;
  delay?: number;
}

export function PartnerPortalWidget({ className, delay = 0 }: PartnerPortalWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "glass-pink luxury-box-hover rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-white/50 relative overflow-hidden",
        className
      )}
    >
      {/* Decorative gradient bar */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-500/20 via-indigo-300/30 to-blue-500/20" />
      
      {/* Header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200/50 dark:shadow-none transform -rotate-3 hover:rotate-0 transition-transform">
          <Briefcase className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-3xl md:text-4xl font-black text-foreground uppercase tracking-tighter">
            Partner Portal
          </h3>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Quản lý đối tác & môi giới BĐS
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-base text-muted-foreground mb-8 leading-relaxed">
        Truy cập portal dành cho đối tác và môi giới bất động sản. Quản lý leads, 
        theo dõi hoa hồng, xem kho hàng, và phối hợp với đội ngũ kinh doanh.
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-white/40">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-500 uppercase">Leads</span>
          </div>
          <p className="text-2xl font-black text-foreground">Quản lý</p>
        </div>

        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-white/40">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-500 uppercase">Hoa hồng</span>
          </div>
          <p className="text-2xl font-black text-foreground">Theo dõi</p>
        </div>

        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-white/40">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold text-slate-500 uppercase">Kho hàng</span>
          </div>
          <p className="text-2xl font-black text-foreground">Xem sản phẩm</p>
        </div>

        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-white/40">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-slate-500 uppercase">Analytics</span>
          </div>
          <p className="text-2xl font-black text-foreground">Dashboard</p>
        </div>
      </div>

      {/* Features List */}
      <div className="space-y-3 mb-8">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Quản lý lead với bảo vệ 30 ngày</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Theo dõi hoa hồng real-time</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Truy cập kho hàng & giữ chỗ nhanh</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Tài liệu marketing & hỗ trợ</span>
        </div>
      </div>

      {/* CTA Button */}
      <Link 
        href="/partner/dashboard"
        className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 uppercase tracking-wider group"
      >
        <span>Mở Partner Portal</span>
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Footer Note */}
      <p className="mt-6 text-xs text-center text-slate-400 font-semibold">
        Dành cho đối tác & môi giới BĐS được ủy quyền
      </p>
    </motion.div>
  );
}
