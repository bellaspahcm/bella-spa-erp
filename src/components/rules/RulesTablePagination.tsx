'use client';

/**
 * Rules Table Pagination Component
 * 
 * Pagination controls with:
 * - Page numbers
 * - Previous/Next buttons
 * - Total items count
 * - Jump to page input
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RulesTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export function RulesTablePagination({
  currentPage,
  totalPages,
  totalItems,
}: RulesTablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/dashboard/rules?${params.toString()}`);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      navigateToPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      navigateToPage(currentPage + 1);
    }
  };

  const handleFirst = () => {
    navigateToPage(1);
  };

  const handleLast = () => {
    navigateToPage(totalPages);
  };

  const handlePageSelect = (value: string) => {
    navigateToPage(Number(value));
  };

  // Generate page options (show max 100 pages in dropdown)
  const pageOptions = Array.from(
    { length: Math.min(totalPages, 100) },
    (_, i) => i + 1
  );

  return (
    <div className="flex items-center justify-between px-2">
      {/* Info */}
      <div className="text-sm text-muted-foreground">
        Showing page {currentPage} of {totalPages} ({totalItems} total rules)
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* First Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleFirst}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page Select */}
        <Select value={currentPage.toString()} onValueChange={handlePageSelect}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageOptions.map((page) => (
              <SelectItem key={page} value={page.toString()}>
                Page {page}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Next Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleLast}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
