/**
 * Rules Management - List Page
 * 
 * Main page for browsing and managing decision rules.
 * Features:
 * - List all rules with pagination
 * - Filter by provider, status
 * - Search by name/description
 * - Create new rule
 * - Row actions: Edit, Test, Archive
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RulesTable } from '@/components/rules/RulesTable';
import { RulesFilters } from '@/components/rules/RulesFilters';
import { RulesTableSkeleton } from '@/components/rules/RulesTableSkeleton';
import DecisionEngineHeader from '@/components/decision-engine/DecisionEngineHeader';

export const metadata = {
  title: 'Quy tắc Luật nghiệp vụ | Bella ERP',
  description: 'Quản lý các quy tắc luật tự động phân ca, tính lương, hoa hồng và các nghiệp vụ khác',
};

interface RulesPageProps {
  searchParams: Promise<{
    provider?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const resolvedParams = await searchParams;
  const provider = resolvedParams.provider || undefined;
  const status = resolvedParams.status || undefined;
  const search = resolvedParams.search || undefined;
  const page = Number(resolvedParams.page) || 1;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#11100F] transition-colors duration-300">
      {/* Shared Tabs Header */}
      <DecisionEngineHeader />

      <div className="flex flex-col gap-6 p-6 container mx-auto animate-in fade-in duration-500">
        {/* Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 p-4 rounded-xl shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Quy tắc & Luật nghiệp vụ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cấu hình các luật tự động phân ca, hoa hồng, tính lương và chiết khấu
            </p>
          </div>
          <Link href="/dashboard/rules/new">
            <Button size="sm" className="rounded-lg shadow-sm font-semibold h-9 px-4 active:scale-95 transition-all">
              <Plus className="mr-1.5 h-4 w-4" />
              Tạo Luật mới
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <RulesFilters
          initialProvider={provider}
          initialStatus={status}
          initialSearch={search}
        />

        {/* Table */}
        <Suspense fallback={<RulesTableSkeleton />}>
          <RulesTable
            provider={provider}
            status={status}
            search={search}
            page={page}
          />
        </Suspense>
      </div>
    </div>
  );
}
