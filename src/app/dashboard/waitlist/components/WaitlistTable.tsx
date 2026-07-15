import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
} from '@/components/ui/table';
import { WaitlistTableRow } from './WaitlistTableRow';
import { WaitlistPagination } from './WaitlistPagination';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export function WaitlistTable({
  entries,
  total,
  page,
  limit,
  isLoading,
  onRefresh,
}: WaitlistTableProps) {
  const vocab = useModuleVocabulary();

  // Empty state
  if (entries.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/50 bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100/50 dark:bg-slate-900/40 text-slate-400">
          <span className="text-3xl">📋</span>
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          Chưa có {vocab.customer.singular.toLowerCase()} trong danh sách chờ
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Thêm {vocab.customer.singular.toLowerCase()} vào danh sách chờ để quản lý lịch hẹn hiệu quả hơn
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/50 bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800/50">
            <TableRow className="hover:bg-transparent border-0">
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">#</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{vocab.customer.singular}</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{vocab.package.singular}</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngày mong muốn</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Giờ</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ưu tiên</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thời gian chờ</TableHead>
              <TableHead className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <WaitlistTableRow
                key={entry.id}
                entry={entry}
                onRefresh={onRefresh}
              />
            ))}
          </TableBody>
        </Table>

        {/* Loading overlay */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Pagination */}
      <WaitlistPagination
        currentPage={page}
        totalItems={total}
        itemsPerPage={limit}
      />
    </div>
  );
}
