'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Crown, Award, Sparkles, Info } from 'lucide-react';
import type { ConsolidatedPnLRow } from '@/services/hq-actions';
import { HqExecutiveOverview } from '../components/HqExecutiveOverview';
import { HqSubscriptionPackageReference } from '../components/HqSubscriptionPackageReference';
import { HqBranchFilters, type BranchTypeFilter, type BranchStatusFilter, type BranchModuleFilter } from '../components/HqBranchFilters';
import { HqBranchTable } from '../components/HqBranchTable';
import type { HqTenantRecord } from '@/types/domain';
import { getDefaultTenantModuleKey } from '@/lib/business-rules/tenant-modules';

interface Props {
  initialRows: ConsolidatedPnLRow[];
  initialFromDate: string;
  initialToDate: string;
  errorMessage: string | null;
}

export default function FinancialOverviewClient({
  initialRows,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BranchStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<BranchTypeFilter>('all');
  const [moduleFilter, setModuleFilter] = useState<BranchModuleFilter>('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const tenantsFromRows: HqTenantRecord[] = useMemo(() => {
    if (!initialRows || initialRows.length === 0) return [];
    return initialRows.map((r) => ({
      id: r.tenant_id,
      name: r.tenant_name.replace(/^Bella\s+Spa\s+/i, ''),
      status: null,
      revenueSum: Number(r.net_revenue) || 0,
      customerCount: Number(r.total_bookings_count) || 0,
      staffCount: 0,
      address: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      franchise_agreement_date: null,
      royalty_type: null,
      royalty_rate: null,
      royalty_fixed_amount: null,
      internal_clearing_rate: null,
      subscription_tier: null,
      subscription_expires_at: null,
      enabled_modules: null,
      contact_phone: null,
      email: null,
    }));
  }, [initialRows]);

  const filteredTenants = useMemo(() => {
    return tenantsFromRows.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.contact_phone && t.contact_phone.includes(searchTerm));
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const hasBranchMetadata =
        t.status !== null ||
        t.enabled_modules !== null ||
        t.subscription_tier !== null ||
        t.address !== null ||
        t.contact_phone !== null ||
        t.staffCount > 0;
      const isFranchise = t.franchise_agreement_date !== null || t.royalty_type !== null;
      const matchType =
        typeFilter === 'all' ||
        (hasBranchMetadata && typeFilter === 'direct' && !isFranchise) ||
        (hasBranchMetadata && typeFilter === 'franchise' && isFranchise);
      const tenantModule = t.enabled_modules ? getDefaultTenantModuleKey(t.enabled_modules, t.name) : null;
      const matchModule = moduleFilter === 'all' || tenantModule === moduleFilter;
      const matchTier = tierFilter === 'all' || t.subscription_tier === tierFilter;
      const matchRegion = regionFilter === 'all' || (t.address && t.address.includes(regionFilter));

      return matchSearch && matchStatus && matchType && matchModule && matchTier && matchRegion;
    });
  }, [tenantsFromRows, searchTerm, statusFilter, typeFilter, moduleFilter, tierFilter, regionFilter]);

  const getTierBadge = (tier?: string | null) => {
    if (!tier) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/50 select-none">
          <Info size={10} className="text-slate-400" />
          Chưa có gói
        </span>
      );
    }

    const activeTier = tier || 'free_trial';
    switch (activeTier) {
      case 'enterprise':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-500 text-white shadow-md shadow-purple-100 border border-white/20 select-none animate-pulse">
            <Crown size={10} className="text-yellow-300 fill-yellow-300" />
            Diamond / Franchise
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 shadow-sm shadow-yellow-100 border border-amber-300/30 select-none">
            <Award size={10} className="fill-amber-950/20 text-amber-950" />
            Gold / Pro
          </span>
        );
      case 'basic':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 border border-slate-350 select-none">
            <Sparkles size={10} className="text-slate-600 fill-slate-600/10" />
            Silver / Basic
          </span>
        );
      case 'free_trial':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/50 select-none">
            <Info size={10} className="text-slate-400" />
            Dùng thử
          </span>
        );
    }
  };

  const getExpirationInfo = (expiryStr?: string | null, tier?: string | null) => {
    if (tier === 'enterprise') return <span className="text-[9px] text-slate-400 font-bold block mt-0.5 select-none">Không thời hạn</span>;
    if (!expiryStr) return <span className="text-[9px] text-slate-400 font-bold block mt-0.5 select-none">Không giới hạn</span>;
    const date = new Date(expiryStr);
    const isExpired = date < new Date();
    return (
      <span className={`text-[9px] font-bold block mt-0.5 select-none ${isExpired ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
        Hạn: {date.toLocaleDateString('vi-VN')} {isExpired && '(Hết hạn)'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#11100F] pb-20 font-sans antialiased text-slate-800 dark:text-[#EFE9E1]">
      <div className="max-w-7xl mx-auto pt-6 px-6 sm:px-8 space-y-8">
        <Link
          href="/hq"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary dark:text-[#CDBCAB]/70 dark:hover:text-[#A67D44] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại HQ Dashboard
        </Link>

        {/* Section 1: HqSubscriptionPackageReference (Arrow 1 in Image 2 matching Image 1) */}
        <HqSubscriptionPackageReference onSelectTierFilter={(tier) => setTierFilter(tier)} />

        {/* Section 2: HqBranchFilters */}
        <HqBranchFilters
          searchTerm={searchTerm}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          moduleFilter={moduleFilter}
          tierFilter={tierFilter}
          regionFilter={regionFilter}
          onSearchTermChange={setSearchTerm}
          onTypeFilterChange={setTypeFilter}
          onStatusFilterChange={setStatusFilter}
          onModuleFilterChange={setModuleFilter}
          onTierFilterChange={setTierFilter}
          onRegionFilterChange={setRegionFilter}
          onClearAllFilters={() => {
            setTierFilter('all');
            setRegionFilter('all');
          }}
        />

        {/* Section 3: HqBranchTable (Arrow 2 in Image 2 matching Image 1) */}
        <HqBranchTable
          tenants={filteredTenants}
          updatingId={null}
          onToggleStatus={() => {}}
          onOpenBranchRegistration={() => {}}
          getTierBadge={getTierBadge}
          getExpirationInfo={getExpirationInfo}
        />

        {/* Section 4: HqExecutiveOverview */}
        <HqExecutiveOverview tenants={tenantsFromRows.length > 0 ? tenantsFromRows : undefined} />
      </div>
    </div>
  );
}
