/**
 * Decision History Timeline Component (Sprint 1)
 * 
 * Vertical timeline showing all decisions for an entity.
 * "Git History cho Business Decision"
 * 
 * Features:
 * - Chronological timeline with visual flow
 * - Outcome type icons (✅ approved, ❌ rejected, ℹ️ info, ⚠️ modified)
 * - Decision type badges
 * - Provider names
 * - Summary text
 * - Relative timestamps
 * - Click node to open Decision Detail Drawer
 */

'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface TimelineEntry {
  id: string;
  decisionId: string;
  decisionType: string;
  provider: string;
  executionTimeMs: number;
  status: 'success' | 'error' | 'warning';
  summary: string;
  outcomeType: 'approved' | 'rejected' | 'modified' | 'info';
  timestamp: string;
  output: Record<string, unknown>;
  confidenceScore?: number;
}

interface DecisionHistoryTimelineProps {
  entityType: string;
  entityId: string;
  tenantId: string;
  onDecisionClick?: (decisionId: string) => void;
}

export default function DecisionHistoryTimeline({
  entityType,
  entityId,
  tenantId,
  onDecisionClick,
}: DecisionHistoryTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch timeline
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/decision-engine/history/${entityType}/${entityId}?tenantId=${tenantId}`
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch decision history');
        }

        setTimeline(result.timeline || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (entityType && entityId && tenantId) {
      fetchTimeline();
    }
  }, [entityType, entityId, tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">⚠️ {error}</p>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">📭 No decision history found for this entity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-6 text-gray-900">
        Decision History Timeline
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        {timeline.length} decision{timeline.length !== 1 ? 's' : ''} for {entityType}{' '}
        <code className="text-primary font-mono font-bold">{entityId}</code>
      </p>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Timeline entries */}
        <div className="space-y-6">
          {timeline.map((entry, index) => (
            <TimelineNode
              key={entry.id}
              entry={entry}
              isLast={index === timeline.length - 1}
              onClick={() => onDecisionClick?.(entry.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Timeline Node Component
 */
function TimelineNode({
  entry,
  isLast,
  onClick,
}: {
  entry: TimelineEntry;
  isLast: boolean;
  onClick: () => void;
}) {
  const outcomeIcons = {
    approved: '✅',
    rejected: '❌',
    info: 'ℹ️',
    modified: '⚠️',
  };

  const outcomeColors = {
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    info: 'bg-blue-500',
    modified: 'bg-yellow-500',
  };

  const statusColors = {
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
  };

  return (
    <div className="relative pl-16">
      {/* Icon node */}
      <div
        className={`absolute left-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
          outcomeColors[entry.outcomeType]
        }`}
      >
        <span className="text-lg">{outcomeIcons[entry.outcomeType]}</span>
      </div>

      {/* Content card */}
      <div
        onClick={onClick}
        className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
          statusColors[entry.status]
        } hover:scale-[1.02]`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg">
              {entry.decisionType}
            </span>
            <span className="text-sm text-gray-600">{entry.provider}</span>
            {entry.confidenceScore !== undefined && (
              <span className="text-xs text-gray-500">
                {(entry.confidenceScore * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
          </span>
        </div>

        {/* Summary */}
        <p className="text-sm text-gray-800 mb-2">{entry.summary}</p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-mono">{entry.decisionId}</span>
          <span>{entry.executionTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Timeline Variant (for embedding in other pages)
 */
export function CompactDecisionTimeline({
  entityType,
  entityId,
  tenantId,
  maxItems = 5,
  onDecisionClick,
}: DecisionHistoryTimelineProps & { maxItems?: number }) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch(
          `/api/decision-engine/history/${entityType}/${entityId}?tenantId=${tenantId}`
        );
        const result = await response.json();

        if (result.success) {
          // Take only recent items
          setTimeline((result.timeline || []).slice(0, maxItems));
        }
      } catch (err: unknown) {
        console.error('Failed to fetch timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    if (entityType && entityId && tenantId) {
      fetchTimeline();
    }
  }, [entityType, entityId, tenantId, maxItems]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading timeline...</div>;
  }

  if (timeline.length === 0) {
    return <div className="text-sm text-gray-500">No decision history</div>;
  }

  return (
    <div className="space-y-2">
      {timeline.map((entry) => (
        <div
          key={entry.id}
          onClick={() => onDecisionClick?.(entry.id)}
          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
        >
          <span className="text-lg">
            {entry.outcomeType === 'approved'
              ? '✅'
              : entry.outcomeType === 'rejected'
              ? '❌'
              : entry.outcomeType === 'modified'
              ? '⚠️'
              : 'ℹ️'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">{entry.summary}</p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
