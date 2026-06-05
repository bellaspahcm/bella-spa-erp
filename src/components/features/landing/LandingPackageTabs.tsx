'use client';

import type { LandingCategoryKey } from './landing-data';

type LandingPackageTabsProps = {
  activeTab: LandingCategoryKey;
  onActiveTabChange: (tab: LandingCategoryKey) => void;
};

const PACKAGE_TABS: Array<{ key: LandingCategoryKey; label: string }> = [
  { key: 'combo', label: 'Combo Mẹ & Bé' },
  { key: 'baby', label: 'Tắm & Massage Bé' },
  { key: 'sau-sinh', label: 'Phục hồi Sau Sinh' },
  { key: 'bau', label: 'Chăm sóc Mẹ Bầu' },
];

export function LandingPackageTabs({ activeTab, onActiveTabChange }: LandingPackageTabsProps) {
  return (
    <div className="inline-flex p-1.5 bg-rose-50/50 backdrop-blur rounded-3xl sm:rounded-full border border-rose-100/50 mb-16 flex-wrap justify-center">
      {PACKAGE_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onActiveTabChange(tab.key)}
          className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.key ? 'bg-primary text-white shadow-md' : 'text-slate-600 hover:text-primary'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
