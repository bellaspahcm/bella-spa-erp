/**
 * Distributed Trace Viewer Page (Sprint 1)
 * 
 * OpenTelemetry-style distributed tracing for business decisions.
 * 
 * KILLER FEATURE: Visualize decision workflow as a waterfall chart
 * showing how multiple decisions in a trace relate to each other.
 * 
 * Features:
 * - Timeline visualization (waterfall chart)
 * - Critical path highlighting (longest dependency chain)
 * - Decision hierarchy (parent-child relationships via spanId/parentSpanId)
 * - Trace statistics (total decisions, duration, success rate)
 * - Root entity detection (booking, session, leave request, etc.)
 * - Click decision to open detail drawer
 * - Export trace report
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import DecisionDetailDrawer from '@/components/decision-engine/DecisionDetailDrawer';

interface TraceDecision {
  id: string;
  decisionId: string;
  decisionType: string;
  provider: string;
  executionTimeMs: number;
  status: 'success' | 'error' | 'warning';
  confidenceScore?: number;
  summary: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: string;
  // Waterfall visualization
  startTimeOffset: number; // ms from trace start
  depth: number; // hierarchy level
  isOnCriticalPath: boolean;
}

interface TraceData {
  traceId: string;
  rootEntity?: {
    type: string;
    id: string;
  };
  timeline: TraceDecision[];
  stats: {
    totalDecisions: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
    totalDuration: number;
  };
  criticalPath: string[]; // Array of spanIds on critical path
}

export default function TraceViewerPage() {
  const params = useParams();
  const router = useRouter();
  const traceId = params.traceId as string;

  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Fetch trace data
  useEffect(() => {
    const fetchTrace = async () => {
      try {
        setLoading(true);
        setError(null);

        // TODO: Add tenantId from auth context
        const tenantId = 'default-tenant';
        const response = await fetch(
          `/api/decision-engine/trace/${traceId}?tenantId=${tenantId}`
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch trace');
        }

        setTraceData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (traceId) {
      fetchTrace();
    }
  }, [traceId]);

  // Export trace report
  const exportTraceReport = () => {
    if (!traceData) return;

    const report = `
# Distributed Trace Report
Trace ID: ${traceData.traceId}
${traceData.rootEntity ? `Root Entity: ${traceData.rootEntity.type}/${traceData.rootEntity.id}` : ''}
Generated: ${new Date().toISOString()}

## Statistics
- Total Decisions: ${traceData.stats.totalDecisions}
- Success: ${traceData.stats.successCount} (${((traceData.stats.successCount / traceData.stats.totalDecisions) * 100).toFixed(1)}%)
- Errors: ${traceData.stats.errorCount}
- Warnings: ${traceData.stats.warningCount}
- Total Duration: ${traceData.stats.totalDuration}ms

## Critical Path
${traceData.criticalPath.length} decisions on critical path

## Timeline
${traceData.timeline
  .map(
    (d, idx) =>
      `${idx + 1}. [${d.startTimeOffset}ms] ${d.decisionType} (${d.provider})
   Status: ${d.status}
   Execution: ${d.executionTimeMs}ms
   ${d.isOnCriticalPath ? '⚡ CRITICAL PATH' : ''}
   Summary: ${d.summary}
`
  )
  .join('\n')}
    `.trim();

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-${traceId}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trace data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">⚠️</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Failed to Load Trace</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!traceData || traceData.timeline.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">📭</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Decisions Found</h2>
          <p className="text-gray-600 mb-4">This trace has no decisions recorded</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                🔍 Distributed Trace Viewer
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                OpenTelemetry-style decision workflow visualization
              </p>
            </div>
            <button
              onClick={exportTraceReport}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-sm font-medium"
            >
              📥 Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Trace Info Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Trace ID</p>
              <p className="text-lg font-mono font-semibold text-gray-900">
                {traceData.traceId}
              </p>
            </div>
            {traceData.rootEntity && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Root Entity</p>
                <p className="text-lg font-semibold text-gray-900">
                  {traceData.rootEntity.type}
                  <span className="text-pink-600 font-mono ml-2">
                    {traceData.rootEntity.id}
                  </span>
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Duration</p>
              <p className="text-lg font-semibold text-gray-900">
                {traceData.stats.totalDuration}ms
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Decisions"
            value={traceData.stats.totalDecisions}
            icon="📊"
            color="blue"
          />
          <StatCard
            label="Success"
            value={traceData.stats.successCount}
            icon="✅"
            color="green"
            percentage={
              (traceData.stats.successCount / traceData.stats.totalDecisions) * 100
            }
          />
          <StatCard
            label="Errors"
            value={traceData.stats.errorCount}
            icon="❌"
            color="red"
          />
          <StatCard
            label="Warnings"
            value={traceData.stats.warningCount}
            icon="⚠️"
            color="yellow"
          />
        </div>

        {/* Critical Path Info */}
        {traceData.criticalPath.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-semibold text-gray-900">Critical Path</p>
                <p className="text-sm text-gray-600">
                  {traceData.criticalPath.length} decision
                  {traceData.criticalPath.length !== 1 ? 's' : ''} on the longest
                  dependency chain
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Waterfall Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Decision Timeline (Waterfall)
          </h2>
          <div className="space-y-2">
            {traceData.timeline.map((decision, idx) => (
              <WaterfallBar
                key={decision.id}
                decision={decision}
                maxDuration={traceData.stats.totalDuration}
                onClick={() => setSelectedDecisionId(decision.id)}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-gray-600">Success</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-gray-600">Error</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-gray-600">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded border-2 border-amber-700"></div>
              <span className="text-gray-600">Critical Path</span>
            </div>
          </div>
        </div>

        {/* Decision List */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Decisions ({traceData.timeline.length})
          </h2>
          <div className="space-y-3">
            {traceData.timeline.map((decision, idx) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                index={idx}
                onClick={() => setSelectedDecisionId(decision.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Decision Detail Drawer */}
      {selectedDecisionId && (
        <DecisionDetailDrawer
          decisionId={selectedDecisionId}
          onClose={() => setSelectedDecisionId(null)}
        />
      )}
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  label,
  value,
  icon,
  color,
  percentage,
}: {
  label: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'red' | 'yellow';
  percentage?: number;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-sm text-gray-600">{label}</p>
      {percentage !== undefined && (
        <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</p>
      )}
    </div>
  );
}

/**
 * Waterfall Bar Component
 */
function WaterfallBar({
  decision,
  maxDuration,
  onClick,
}: {
  decision: TraceDecision;
  maxDuration: number;
  onClick: () => void;
}) {
  const statusColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
  };

  // Calculate bar position and width as percentage
  const startPercent = (decision.startTimeOffset / maxDuration) * 100;
  const widthPercent = (decision.executionTimeMs / maxDuration) * 100;

  return (
    <div className="relative">
      {/* Timeline axis */}
      <div className="h-12 bg-gray-100 rounded relative overflow-hidden">
        {/* Indentation for hierarchy */}
        <div
          style={{ paddingLeft: `${decision.depth * 20}px` }}
          className="h-full flex items-center"
        >
          {/* Bar */}
          <div
            onClick={onClick}
            style={{
              marginLeft: `${startPercent}%`,
              width: `${Math.max(widthPercent, 1)}%`,
            }}
            className={`h-8 rounded cursor-pointer transition-all hover:opacity-80 hover:scale-105 ${
              statusColors[decision.status]
            } ${
              decision.isOnCriticalPath ? 'border-2 border-amber-700 shadow-lg' : ''
            }`}
            title={`${decision.decisionType} - ${decision.executionTimeMs}ms`}
          >
            {/* Label inside bar if wide enough */}
            {widthPercent > 15 && (
              <div className="px-2 h-full flex items-center justify-center text-white text-xs font-medium truncate">
                {decision.decisionType}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata below */}
      <div className="flex items-center justify-between mt-1 text-xs text-gray-600 px-2">
        <span className="font-mono">{decision.startTimeOffset}ms</span>
        <span className="truncate mx-2">{decision.summary}</span>
        <span className="font-mono">{decision.executionTimeMs}ms</span>
      </div>
    </div>
  );
}

/**
 * Decision Card Component
 */
function DecisionCard({
  decision,
  index,
  onClick,
}: {
  decision: TraceDecision;
  index: number;
  onClick: () => void;
}) {
  const statusColors = {
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
  };

  const statusIcons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };

  return (
    <div
      onClick={onClick}
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
        statusColors[decision.status]
      } ${decision.isOnCriticalPath ? 'ring-2 ring-amber-500' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusIcons[decision.status]}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500">#{index + 1}</span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                {decision.decisionType}
              </span>
              <span className="text-sm text-gray-600">{decision.provider}</span>
              {decision.isOnCriticalPath && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
                  ⚡ Critical Path
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 mt-1">{decision.summary}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(decision.timestamp), { addSuffix: true })}
          </p>
          {decision.confidenceScore !== undefined && (
            <p className="text-xs text-gray-600 mt-1">
              {(decision.confidenceScore * 100).toFixed(0)}% confidence
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="font-mono">Offset: {decision.startTimeOffset}ms</span>
        <span className="font-mono">Duration: {decision.executionTimeMs}ms</span>
        <span className="font-mono">Depth: {decision.depth}</span>
        {decision.parentSpanId && (
          <span className="font-mono text-purple-600">
            Parent: {decision.parentSpanId.slice(0, 8)}...
          </span>
        )}
      </div>
    </div>
  );
}
