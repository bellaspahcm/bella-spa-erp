'use client';

import { motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronRight, Clock, Gift, Sparkles, Star } from 'lucide-react';

import type { ServicePackage } from './landing-data';

type PackageCardHandlers = {
  onClaimOffer: (packageName: string) => void;
  onRequestMoreDetails: (packageName: string, remainingCount: number) => void;
  onSelectPackage: (packageName: string) => void;
};

type PackageCardProps = PackageCardHandlers & {
  pkg: ServicePackage;
};

const MAX_VISIBLE_BENEFITS = 7;

function LandingPackageBenefits({
  benefits,
  iconSize = 'standard',
}: {
  benefits: string[];
  iconSize?: 'standard' | 'compact';
}) {
  return (
    <ul className={iconSize === 'standard' ? 'space-y-3.5' : 'space-y-3'}>
      {benefits.map((benefit, index) => (
        <li
          key={index}
          className={iconSize === 'standard'
            ? 'flex gap-3 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium'
            : 'flex gap-3 text-slate-600 dark:text-slate-300 text-xs font-medium'}
        >
          <div className={iconSize === 'standard'
            ? 'w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mt-0.5 shrink-0'
            : 'w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mt-0.5 shrink-0'}
          >
            <Check className={iconSize === 'standard' ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
          </div>
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

function MoreDetailsButton({
  packageName,
  remainingCount,
  compact = false,
  onRequestMoreDetails,
}: {
  packageName: string;
  remainingCount: number;
  compact?: boolean;
  onRequestMoreDetails: (packageName: string, remainingCount: number) => void;
}) {
  if (remainingCount <= 0) return null;

  return (
    <div className={compact
      ? 'mt-4 pt-4 border-t border-dashed border-rose-200 dark:border-rose-900/50'
      : 'mt-5 pt-5 border-t border-dashed border-rose-200 dark:border-rose-900/50'}
    >
      <button
        onClick={() => onRequestMoreDetails(packageName, remainingCount)}
        className={compact
          ? 'flex items-center gap-3 text-primary dark:text-rose-300 font-extrabold text-xs cursor-pointer hover:underline underline-offset-4 transition-all'
          : 'flex items-center gap-3 text-primary dark:text-rose-300 font-extrabold text-xs sm:text-sm cursor-pointer hover:underline underline-offset-4 transition-all group/more'}
      >
        <div className={compact
          ? 'w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950 text-primary dark:text-rose-400 flex items-center justify-center shrink-0'
          : 'w-5 h-5 rounded-full bg-pink-100 dark:bg-pink-950 text-primary dark:text-rose-400 flex items-center justify-center shrink-0'}
        >
          <Sparkles className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        </div>
        {compact ? (
          <span>...và {remainingCount}+ quy trình khác → Liên hệ để xem chi tiết</span>
        ) : (
          <span>
            ...và {remainingCount}+ quy trình khác →{' '}
            <span className="underline group-hover/more:text-primary-hover">Liên hệ để xem chi tiết gói</span>
          </span>
        )}
      </button>
    </div>
  );
}

export function FeaturedPackageCard({
  pkg,
  onClaimOffer,
  onRequestMoreDetails,
  onSelectPackage,
}: PackageCardProps) {
  const visibleBenefits = pkg.benefits.slice(0, MAX_VISIBLE_BENEFITS);
  const remainingCount = pkg.benefits.length - MAX_VISIBLE_BENEFITS;

  return (
    <motion.div
      key={pkg.id}
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="lg:col-span-2 rounded-[2.5rem] overflow-hidden relative group"
    >
      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-amber-400 via-rose-500 to-primary p-[3px] z-0">
        <div className="absolute inset-[3px] bg-white dark:bg-[#1C1B19] rounded-[calc(2.5rem-3px)]" />
      </div>

      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden rounded-[2.5rem]">
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative z-[2] flex flex-col">
        <div className="h-2 bg-gradient-to-r from-amber-400 via-rose-500 to-primary" />

        <div className="px-8 sm:px-12 pt-8 sm:pt-10">
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-primary text-white shadow-lg shadow-rose-200/50 dark:shadow-none">
            <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
            GÓI BÁN CHẠY / ĐƯỢC YÊU THÍCH NHẤT
            <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
          </span>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="lg:w-[45%] p-8 sm:p-12 flex flex-col justify-between">
            <div>
              <h4 className="text-2xl sm:text-3xl font-serif font-black text-primary dark:text-rose-400 tracking-tight leading-tight mb-2">
                {pkg.name}
              </h4>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <Clock className="w-3.5 h-3.5" /> {pkg.duration}
              </span>

              <div className="mt-6 mb-6">
                <span className="text-3xl sm:text-4xl font-serif font-black text-primary dark:text-rose-400">{pkg.price}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider ml-2">Trọn gói</span>
              </div>

              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold leading-relaxed mb-6">
                {pkg.description || `Liệu trình ${pkg.total_sessions || 20} buổi chăm sóc chuyên sâu chuẩn y khoa của Bella Spa.`}
              </p>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onClaimOffer(pkg.name);
                }}
                className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 rounded-xl border-2 border-amber-300/60 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all cursor-pointer animate-pulse shadow-sm"
              >
                <Gift className="w-4 h-4 text-amber-500" />
                Nhận Ưu đãi độc quyền
              </button>
            </div>

            <button
              onClick={() => onSelectPackage(pkg.name)}
              className="w-full mt-8 bg-primary hover:bg-primary-hover text-white dark:bg-rose-900/60 dark:hover:bg-rose-800 text-xs font-black uppercase tracking-widest py-4.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-200/50 dark:shadow-none hover:shadow-pink-300/40 dark:hover:shadow-none"
            >
              Đặt lịch gói này ngay <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-rose-200 dark:via-rose-900/50 to-transparent my-8" />

          <div className="lg:w-[55%] p-8 sm:p-12 lg:pl-10">
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Quy trình liệu trình gồm:
            </h5>
            <LandingPackageBenefits benefits={visibleBenefits} />
            <MoreDetailsButton packageName={pkg.name} remainingCount={remainingCount} onRequestMoreDetails={onRequestMoreDetails} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function StandardPackageCard({
  pkg,
  onClaimOffer,
  onRequestMoreDetails,
  onSelectPackage,
}: PackageCardProps) {
  const visibleBenefits = pkg.benefits.slice(0, MAX_VISIBLE_BENEFITS);
  const remainingCount = pkg.benefits.length - MAX_VISIBLE_BENEFITS;

  return (
    <motion.div
      key={pkg.id}
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -10 }}
      transition={{ duration: 0.4 }}
      className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] shadow-xl border border-rose-50 dark:border-[#2E2B27] overflow-hidden flex flex-col justify-between hover:border-primary/20 transition-all group hover:shadow-2xl relative"
    >
      <div className="p-6 sm:p-10">
        {pkg.tag && (
          <span className="inline-block bg-pink-100 dark:bg-pink-950/30 text-primary dark:text-rose-300 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-rose-200/50 dark:border-rose-900/50 mb-3 w-fit">
            {pkg.tag}
          </span>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
          <div>
            <h4 className="text-xl font-serif font-black text-slate-800 dark:text-slate-200 tracking-tight group-hover:text-primary transition-colors">{pkg.name}</h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
              <Clock className="w-3 h-3" /> {pkg.duration}
            </span>
          </div>
          <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0 flex flex-col items-start sm:items-end">
            <span className="text-2xl font-serif font-black text-primary dark:text-rose-400 block">{pkg.price}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-2">Trọn gói</span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onClaimOffer(pkg.name);
              }}
              className="inline-flex items-center gap-1.5 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-all cursor-pointer animate-pulse shadow-xs"
            >
              <Gift className="w-3 h-3 text-amber-500" />
              Nhận Ưu đãi độc quyền
            </button>
          </div>
        </div>

        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-relaxed mb-6 pb-6 border-b border-rose-50 dark:border-rose-950/20">
          {pkg.description || `Liệu trình ${pkg.total_sessions || 20} buổi chăm sóc chuyên sâu chuẩn y khoa của Bella Spa.`}
        </p>

        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest mb-4">Quy trình liệu trình gồm:</h5>
        <LandingPackageBenefits benefits={visibleBenefits} iconSize="compact" />
        <MoreDetailsButton packageName={pkg.name} remainingCount={remainingCount} compact onRequestMoreDetails={onRequestMoreDetails} />
      </div>

      <div className="p-6 sm:p-10 pt-0">
        <button
          onClick={() => onSelectPackage(pkg.name)}
          className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-primary hover:text-white text-slate-700 dark:text-slate-300 dark:hover:bg-primary text-xs font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm group-hover:shadow-md"
        >
          Đặt lịch gói này ngay <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
