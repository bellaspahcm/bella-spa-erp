/**
 * @fileoverview Branch Selector Component
 * 
 * Dropdown for selecting English Center branch.
 * Used in enrollment forms, reports, dashboards.
 */

'use client';

import { useEffect, useState } from 'react';
import type { OrgUnit } from '@/platform';

interface BranchSelectorProps {
  tenantId: string;
  value?: string;
  onChange: (branchId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function BranchSelector({
  tenantId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select branch...',
  className = '',
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBranches() {
      try {
        setLoading(true);
        const response = await fetch(`/api/english-center/branches?tenantId=${tenantId}`);
        
        if (!response.ok) {
          throw new Error('Failed to load branches');
        }

        const data = await response.json();
        setBranches(data.branches || []);
      } catch (err) {
        console.error('[BranchSelector] Load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load branches');
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      loadBranches();
    }
  }, [tenantId]);

  if (loading) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Loading branches...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select disabled className={`${className} border-red-300`}>
        <option>Error loading branches</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name} ({branch.code})
        </option>
      ))}
    </select>
  );
}
