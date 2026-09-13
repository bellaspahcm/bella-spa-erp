/**
 * @fileoverview Branch Hierarchy Tree Component
 * 
 * Displays company → region → branch hierarchy.
 * Used in chain management dashboard.
 */

'use client';

import { useEffect, useState } from 'react';
import type { OrgUnitHierarchy } from '@/platform';

interface BranchHierarchyTreeProps {
  tenantId: string;
  rootId?: string | null;
  onSelectBranch?: (branchId: string) => void;
  className?: string;
}

interface TreeNodeProps {
  node: OrgUnitHierarchy;
  onSelect?: (branchId: string) => void;
  level: number;
}

function TreeNode({ node, onSelect, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  
  const indent = `${level * 1.5}rem`;
  const icon = node.unitType === 'company' ? '🏢' : node.unitType === 'region' ? '📍' : '🏫';

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded cursor-pointer"
        style={{ paddingLeft: indent }}
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          }
          if (node.unitType === 'branch' && onSelect) {
            onSelect(node.id);
          }
        }}
      >
        {hasChildren && (
          <span className="text-gray-400 text-sm">
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="text-lg">{icon}</span>
        <span className="font-medium">{node.name}</span>
        <span className="text-sm text-gray-500">({node.code})</span>
        {!node.isActive && (
          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Inactive</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
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
          key={node.id}
          node={node}
          onSelect={onSelectBranch}
          level={0}
        />
      ))}
    </div>
  );
}
