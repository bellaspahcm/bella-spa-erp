import { WaitlistTableRow } from './WaitlistTableRow';
import { WaitlistPagination } from './WaitlistPagination';
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
  // Empty state
  if (entries.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <span className="text-3xl">📋</span>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          Chưa có khách trong danh sách chờ
        </h3>
        <p className="text-sm text-gray-600">
          Thêm khách hàng vào danh sách chờ để quản lý lịch hẹn hiệu quả hơn
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                #
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Khách hàng
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Dịch vụ
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Ngày mong muốn
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Giờ
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Ưu tiên
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Trạng thái
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                Thời gian chờ
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-700">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((entry) => (
              <WaitlistTableRow
                key={entry.id}
                entry={entry}
                onRefresh={onRefresh}
              />
            ))}
          </tbody>
        </table>

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
