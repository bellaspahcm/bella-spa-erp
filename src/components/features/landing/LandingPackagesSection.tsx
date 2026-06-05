'use client';

import { AnimatePresence } from 'framer-motion';

import { FeaturedPackageCard, StandardPackageCard } from './LandingPackageCards';
import { LandingPackageTabs } from './LandingPackageTabs';
import type { LandingCategories, LandingCategoryKey } from './landing-data';

type LandingPackagesSectionProps = {
  activeTab: LandingCategoryKey;
  categories: LandingCategories | null;
  serviceCategories: LandingCategories;
  dataStatus?: 'loaded' | 'fallback';
  dataError?: string | null;
  onActiveTabChange: (tab: LandingCategoryKey) => void;
  onClaimOffer: (packageName: string) => void;
  onRequestMoreDetails: (packageName: string, remainingCount: number) => void;
  onSelectPackage: (packageName: string) => void;
};

export function LandingPackagesSection({
  activeTab,
  categories,
  serviceCategories,
  dataStatus = 'loaded',
  dataError,
  onActiveTabChange,
  onClaimOffer,
  onRequestMoreDetails,
  onSelectPackage,
}: LandingPackagesSectionProps) {
  const activeCategories = categories || serviceCategories;

  return (
    <section id="services" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Các Gói Liệu Trình</span>
        <h2 className="text-3xl sm:text-4xl font-serif font-black text-slate-800 tracking-tight mb-4">
          Bảng Giá Dịch Vụ Chăm Sóc Cao Cấp
        </h2>
        <p className="text-slate-500 text-sm font-semibold max-w-xl mx-auto mb-12">
          Rõ ràng, minh bạch, trọn gói không phát sinh thêm chi phí. Lựa chọn gói chăm sóc phù hợp để trao tặng món quà sức khỏe tốt nhất.
        </p>

        {dataStatus === 'fallback' && (
          <p role="status" className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-4 py-2 inline-flex mb-8">
            Đang hiển thị bảng giá mẫu của Bella Spa. {dataError ? 'Dữ liệu mới nhất sẽ được cập nhật lại sau.' : ''}
          </p>
        )}

        <LandingPackageTabs activeTab={activeTab} onActiveTabChange={onActiveTabChange} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left max-w-5xl mx-auto">
          <AnimatePresence>
            {activeCategories[activeTab].packages.map((pkg) => {
              if (pkg.name.includes('Hạnh Phúc')) {
                return (
                  <FeaturedPackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onClaimOffer={onClaimOffer}
                    onRequestMoreDetails={onRequestMoreDetails}
                    onSelectPackage={onSelectPackage}
                  />
                );
              }

              return (
                <StandardPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onClaimOffer={onClaimOffer}
                  onRequestMoreDetails={onRequestMoreDetails}
                  onSelectPackage={onSelectPackage}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
