'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ConsolidatedPnLRow } from '@/services/hq-actions';
import { HqExecutiveOverview } from '../components/HqExecutiveOverview';
import type { HqTenantRecord } from '@/types/domain';

interface Props {
  initialRows: ConsolidatedPnLRow[];
  initialFromDate: string;
  initialToDate: string;
  errorMessage: string | null;
}

export default function FinancialOverviewClient({
  initialRows,
}: Props) {
  const tenantsFromRows: HqTenantRecord[] = useMemo(() => {
    if (!initialRows || initialRows.length === 0) return [];
    return initialRows.map((r) => ({
      id: r.tenant_id,
      name: r.tenant_name.replace(/^Bella\s+Spa\s+/i, ''),
      status: 'active',
      revenueSum: Number(r.net_revenue) || 0,
      customerCount: Number(r.total_bookings_count) || 0,
      staffCount: 15,
      address: 'TP. HCM',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      franchise_agreement_date: null,
      royalty_type: null,
      royalty_rate: null,
      royalty_fixed_amount: null,
      internal_clearing_rate: 150000,
      subscription_tier: 'enterprise',
      subscription_expires_at: null,
      enabled_modules: ['beauty_spa'],
      contact_phone: null,
      email: null,
    }));
  }, [initialRows]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#11100F] pb-20 font-sans antialiased text-slate-800 dark:text-[#EFE9E1]">
      <div className="max-w-7xl mx-auto pt-6 px-6">
        <Link
          href="/hq"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary dark:text-[#CDBCAB]/70 dark:hover:text-[#A67D44] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại HQ Dashboard
        </Link>
      </div>

      <HqExecutiveOverview tenants={tenantsFromRows.length > 0 ? tenantsFromRows : undefined} />
    </div>
  );
}
