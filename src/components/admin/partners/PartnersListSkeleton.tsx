/**
 * Partners List Skeleton Component
 * Loading state for partners list
 */

import { Skeleton } from '@/components/ui/skeleton';

export function PartnersListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Toolbar Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-[300px]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[130px]" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[130px]" />
        </div>
      </div>

      {/* Results Summary Skeleton */}
      <Skeleton className="h-5 w-[200px]" />

      {/* Table Skeleton */}
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-[120px]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[80px]" />
        </div>
      </div>
    </div>
  );
}
