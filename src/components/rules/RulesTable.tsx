/**
 * Rules Table Component
 * 
 * Server component that fetches and displays rules list.
 * Features:
 * - Pagination
 * - Row actions (Edit, Test, Archive)
 * - Status badges
 * - Provider badges
 */

import Link from 'next/link';
import { createServerClient } from '@/lib/supabase-server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RuleActions } from '@/components/rules/RuleActions';
import { RulesTablePagination } from '@/components/rules/RulesTablePagination';
import { RuleStatusBadge } from '@/components/rules/RuleStatusBadge';
import { RuleProviderBadge } from '@/components/rules/RuleProviderBadge';
import { formatDistanceToNow } from 'date-fns';

interface RulesTableProps {
  provider?: string;
  status?: string;
  search?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function RulesTable({
  provider,
  status,
  search,
  page = 1,
}: RulesTableProps) {
  const supabase = createServerClient();

  // Build query
  let query = supabase
    .from('rules')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false });

  // Apply filters
  if (provider) {
    query = query.eq('provider', provider);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Apply pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  // Fetch data
  const { data: rules, error, count } = await query;

  if (error) {
    console.error('Failed to fetch rules:', error);
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p className="text-sm text-destructive">
          Failed to load rules. Please try again.
        </p>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-semibold">No rules found</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {search || provider || status
            ? 'Try adjusting your filters'
            : 'Get started by creating your first rule'}
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/50 bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/40">
            <TableRow className="border-b border-slate-200/60 dark:border-slate-800/50 hover:bg-transparent">
              <TableHead className="w-[300px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tên luật</TableHead>
              <TableHead className="w-[150px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Provider</TableHead>
              <TableHead className="w-[120px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phân loại</TableHead>
              <TableHead className="w-[120px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead className="w-[100px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Độ ưu tiên</TableHead>
              <TableHead className="w-[100px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phiên bản</TableHead>
              <TableHead className="w-[150px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cập nhật</TableHead>
              <TableHead className="w-[100px] text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                {/* Name */}
                <TableCell>
                  <Link
                    href={`/dashboard/rules/${rule.id}`}
                    className="font-semibold text-sm hover:underline text-slate-900 dark:text-slate-100"
                  >
                    {rule.name}
                  </Link>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {rule.description}
                    </p>
                  )}
                </TableCell>

                {/* Provider */}
                <TableCell>
                  <RuleProviderBadge provider={rule.provider} />
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-lg border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                    {rule.category}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <RuleStatusBadge status={rule.status} />
                </TableCell>

                {/* Priority */}
                <TableCell>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">{rule.priority}</span>
                </TableCell>

                {/* Version */}
                <TableCell>
                  <span className="text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">v{rule.version}</span>
                </TableCell>

                {/* Updated */}
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(rule.updated_at), {
                      addSuffix: true,
                    })}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <RuleActions rule={rule} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <RulesTablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={count || 0}
        />
      )}
    </div>
  );
}
