'use client';

/**
 * Rules Filters Component
 * 
 * Provides filtering controls for the rules list:
 * - Provider filter (booking, discount, payroll, commission, inventory)
 * - Status filter (draft, active, disabled, pending_approval, approved, rejected, archived)
 * - Search input (name, description)
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface RulesFiltersProps {
  initialProvider?: string;
  initialStatus?: string;
  initialSearch?: string;
}

const PROVIDERS = [
  { value: 'all', label: 'All Providers' },
  { value: 'booking', label: 'Booking' },
  { value: 'discount', label: 'Discount' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'commission', label: 'Commission' },
  { value: 'inventory', label: 'Inventory' },
];

const STATUSES = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'disabled', label: 'Disabled', color: 'yellow' },
  { value: 'pending_approval', label: 'Pending Approval', color: 'blue' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'archived', label: 'Archived', color: 'gray' },
];

export function RulesFilters({
  initialProvider = 'all',
  initialStatus = 'all',
  initialSearch = '',
}: RulesFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
    params.delete('page');

    router.push(`/dashboard/rules?${params.toString()}`);
  };

  const handleProviderChange = (value: string) => {
    updateFilters({ provider: value });
  };

  const handleStatusChange = (value: string) => {
    updateFilters({ status: value });
  };

  const handleSearchChange = (value: string) => {
    updateFilters({ search: value });
  };

  const handleClearFilters = () => {
    router.push('/dashboard/rules');
  };

  const hasActiveFilters =
    initialProvider !== 'all' ||
    initialStatus !== 'all' ||
    initialSearch !== '';

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
        {/* Provider Filter */}
        <Select value={initialProvider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider.value} value={provider.value}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={initialStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            className="pl-9"
            defaultValue={initialSearch}
            onChange={(e) => {
              const value = e.target.value;
              // Debounce search
              const timeout = setTimeout(() => {
                handleSearchChange(value);
              }, 500);
              return () => clearTimeout(timeout);
            }}
          />
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={handleClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}
