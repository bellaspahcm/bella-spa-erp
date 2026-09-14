/**
 * @fileoverview Branch Hierarchy Tree Component
 * 
 * Displays company → region → branch hierarchy.
 * Used in chain management dashboard.
 */

'use client';

import { useEffect, useState } from 'react';
import type { OrgUnitHierarchy } from '@/platform/org-unit';

interface BranchHierarchyTreeProps {
  tenantId: string;
  rootId?: string | null;
  onSelectBranch?: (branchId: string) => void;
  className?: string;
}

interface TreeNodeProps {
  node: OrgUnitHierarchy;
  onSelect?: (branchId: string) => void;
}

function TreeNode({ node, onSelect }: TreeNodeProps) {
  const unit = node.unit;
  const indent = `${node.depth * 1.5}rem`;
  const icon = unit.unitType === 'company' ? '🏢' : unit.unitType === 'region' ? '📍' : '🏫';

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded cursor-pointer"
        style={{ paddingLeft: indent }}
        onClick={() => {
          if (unit.unitType === 'branch' && onSelect) {
            onSelect(unit.id);
          }
        }}
      >
        <span className="w-3" />
        <span className="text-lg">{icon}</span>
        <span className="font-medium">{unit.name}</span>
        <span className="text-sm text-gray-500">({unit.code})</span>
        {!unit.isActive && (
          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Inactive</span>
        )}
      </div>
    </div>
  );
}

export function BranchHierarchyTree({
  tenantId,
  rootId = null,
  onSelectBranch,
  className = '',
}: BranchHierarchyTreeProps) {
  const [hierarchy, setHierarchy] = useState<OrgUnitHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHierarchy() {
      try {
        setLoading(true);
        const params = new URLSearchParams({ tenantId });
        if (rootId) params.set('rootId', rootId);
        
        const response = await fetch(`/api/english-center/branches/hierarchy?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to load hierarchy');
        }

        const data = await response.json();
        setHierarchy(data.hierarchy || []);
      } catch (err) {
        console.error('[BranchHierarchyTree] Load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      loadHierarchy();
    }
  }, [tenantId, rootId]);

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="text-gray-500">Loading hierarchy...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (hierarchy.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="text-gray-500">No branches found</div>
      </div>
    );
  }

  return (
    <div className={`${className} border rounded-lg bg-white`}>
      {hierarchy.map((node) => (
        <TreeNode
          key={node.unit.id}
          node={node}
          onSelect={onSelectBranch}
        />
      ))}
    </div>
  );
}
