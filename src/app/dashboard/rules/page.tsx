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

export const metadata = {
  title: 'Decision Rules | Bella ERP',
  description: 'Manage decision rules for booking, payroll, commission, and more',
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
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Decision Rules</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage business rules without code
          </p>
        </div>
        <Link href="/dashboard/rules/new">
          <Button size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
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
  );
}
