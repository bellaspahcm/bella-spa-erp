/**
 * Decision Time Machine Component (Sprint 1)
 * 
 * KILLER FEATURE that Drools/AWS Rules Engine don't have!
 * 
 * Allows replaying past decisions with different policy versions
 * and comparing the results side-by-side.
 * 
 * Features:
 * - Replay decision with original or different policy version
 * - Side-by-side diff viewer (Original vs Replayed)
 * - Highlight changed fields, rules, confidence, execution time
 * - Policy version selector with timestamps
 * - Copy diff report to clipboard
 * - Timeline of version changes
 * 
 * Use Cases:
 * - "What if we used last month's policy for this decision?"
 * - "How did the policy change affect this customer's approval?"
 * - "Why did the same input produce different outputs?"
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface PolicyVersion {
  version: string;
  timestamp: string;
  description?: string;
  author?: string;
}

interface ReplayResult {
  originalResult: {
    output: Record<string, any>;
    matchedRules: Array<{ ruleId: string; ruleName: string; priority: number }>;
    confidenceScore?: number;
    executionTimeMs: number;
  };
  replayedResult: {
    output: Record<string, any>;
    matchedRules: Array<{ ruleId: string; ruleName: string; priority: number }>;
    confidenceScore?: number;
    executionTimeMs: number;
  };
  diff: {
    outputChanged: boolean;
    changedFields: string[];
    rulesChanged: boolean;
    addedRules: string[];
    removedRules: string[];
    confidenceChanged: boolean;
    confidenceDelta?: number;
    executionTimeChanged: boolean;
    executionTimeDelta?: number;
  };
  snapshot: {
    version: string;
    timestamp: string;
    description?: string;
  };
}

interface DecisionTimeMachineProps {
  decisionId: string;
  originalVersion: string;
  onClose: () => void;
}

export default function DecisionTimeMachine({
  decisionId,
  originalVersion,
  onClose,
}: DecisionTimeMachineProps) {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>(originalVersion);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available policy versions
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        // TODO: Implement GET /api/decision-engine/policy-versions endpoint
        // For now, mock data
        setVersions([
          {
            version: originalVersion,
            timestamp: new Date().toISOString(),
            description: 'Current version',
            author: 'System',
          },
          {
            version: 'v1.2.0',
            timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            description: 'Tightened approval criteria',
            author: 'Admin',
          },
          {
            version: 'v1.1.0',
            timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            description: 'Added new KPI rules',
            author: 'Manager',
          },
        ]);
      } catch (err) {
        console.error('Failed to fetch versions:', err);
      }
    };

    fetchVersions();
  }, [originalVersion]);

  // Replay decision with selected version
  const handleReplay = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/decision-engine/replay/${decisionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyVersion: selectedVersion !== originalVersion ? selectedVersion : undefined,
          compareWithOriginal: true,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to replay decision');
      }

      setReplayResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Copy diff report
  const copyDiffReport = async () => {
    if (!replayResult) return;

    const report = `
# Decision Time Machine Report
Decision ID: ${decisionId}
Original Version: ${originalVersion}
Replayed Version: ${selectedVersion}
Generated: ${new Date().toISOString()}

## Changes Detected
- Output Changed: ${replayResult.diff.outputChanged ? '✅ YES' : '❌ NO'}
- Rules Changed: ${replayResult.diff.rulesChanged ? '✅ YES' : '❌ NO'}
- Confidence Changed: ${replayResult.diff.confidenceChanged ? '✅ YES' : '❌ NO'}
- Execution Time Changed: ${replayResult.diff.executionTimeChanged ? '✅ YES' : '❌ NO'}

## Changed Fields
${replayResult.diff.changedFields.length > 0 ? replayResult.diff.changedFields.map(f => `- ${f}`).join('\n') : '(none)'}

## Rule Changes
Added Rules: ${replayResult.diff.addedRules.length > 0 ? replayResult.diff.addedRules.join(', ') : '(none)'}
Removed Rules: ${replayResult.diff.removedRules.length > 0 ? replayResult.diff.removedRules.join(', ') : '(none)'}

## Metrics
Confidence Delta: ${replayResult.diff.confidenceDelta !== undefined ? `${(replayResult.diff.confidenceDelta * 100).toFixed(1)}%` : 'N/A'}
Execution Time Delta: ${replayResult.diff.executionTimeDelta !== undefined ? `${replayResult.diff.executionTimeDelta}ms` : 'N/A'}

## Original Output
${JSON.stringify(replayResult.originalResult.output, null, 2)}

## Replayed Output
${JSON.stringify(replayResult.replayedResult.output, null, 2)}
    `.trim();

    const success = await copyToClipboard(report);
    if (success) {
      toast.success('Đã sao chép báo cáo so sánh');
    } else {
      toast.error('Không thể tự động sao chép báo cáo');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-60 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary/5 to-accent/5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                🔄 Decision Time Machine
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Replay decisions with different policy versions
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Decision ID: {decisionId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-full transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Version Selector */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Select Policy Version
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {versions.map((version) => (
                  <button
                    key={version.version}
                    onClick={() => setSelectedVersion(version.version)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      selectedVersion === version.version
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">
                        {version.version}
                      </span>
                      {version.version === originalVersion && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                          Original
                        </span>
                      )}
                    </div>
                    {version.description && (
                      <p className="text-sm text-gray-600 mb-2">{version.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{format(new Date(version.timestamp), 'MMM d, yyyy')}</span>
                      {version.author && <span>• {version.author}</span>}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleReplay}
                disabled={loading || selectedVersion === originalVersion}
                className="mt-4 w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all font-semibold text-lg active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-3 border-white border-t-transparent"></div>
                    Replaying...
                  </span>
                ) : (
                  `🔄 Replay with ${selectedVersion}`
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">⚠️ {error}</p>
              </div>
            )}

            {/* Diff Results */}
            {replayResult && (
              <>
                {/* Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Comparison Summary
                    </h3>
                    <button
                      onClick={copyDiffReport}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      📋 Copy Report
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <DiffStat
                      label="Output"
                      changed={replayResult.diff.outputChanged}
                      count={replayResult.diff.changedFields.length}
                    />
                    <DiffStat
                      label="Rules"
                      changed={replayResult.diff.rulesChanged}
                      count={
                        replayResult.diff.addedRules.length +
                        replayResult.diff.removedRules.length
                      }
                    />
                    <DiffStat
                      label="Confidence"
                      changed={replayResult.diff.confidenceChanged}
                      delta={replayResult.diff.confidenceDelta}
                      unit="%"
                      multiplier={100}
                    />
                    <DiffStat
                      label="Execution"
                      changed={replayResult.diff.executionTimeChanged}
                      delta={replayResult.diff.executionTimeDelta}
                      unit="ms"
                    />
                  </div>
                </div>

                {/* Side-by-side Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Original */}
                  <ResultPanel
                    title="Original Result"
                    version={originalVersion}
                    result={replayResult.originalResult}
                  />

                  {/* Replayed */}
                  <ResultPanel
                    title="Replayed Result"
                    version={selectedVersion}
                    result={replayResult.replayedResult}
                    highlight
                  />
                </div>

                {/* Changed Fields Detail */}
                {replayResult.diff.changedFields.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Changed Fields
                    </h3>
                    <ul className="space-y-2">
                      {replayResult.diff.changedFields.map((field) => (
                        <li key={field} className="flex items-center gap-2">
                          <span className="text-yellow-600">⚠️</span>
                          <code className="text-sm font-mono text-gray-800">{field}</code>
                          <span className="text-sm text-gray-600">
                            {JSON.stringify(
                              getNestedValue(replayResult.originalResult.output, field)
                            )}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm text-gray-800 font-semibold">
                            {JSON.stringify(
                              getNestedValue(replayResult.replayedResult.output, field)
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rule Changes Detail */}
                {replayResult.diff.rulesChanged && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Rule Changes
                    </h3>
                    {replayResult.diff.addedRules.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-green-700 mb-2">
                          ✅ Added Rules ({replayResult.diff.addedRules.length})
                        </p>
                        <ul className="space-y-1">
                          {replayResult.diff.addedRules.map((rule) => (
                            <li key={rule} className="text-sm text-gray-700 ml-4">
                              • {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {replayResult.diff.removedRules.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-red-700 mb-2">
                          ❌ Removed Rules ({replayResult.diff.removedRules.length})
                        </p>
                        <ul className="space-y-1">
                          {replayResult.diff.removedRules.map((rule) => (
                            <li key={rule} className="text-sm text-gray-700 ml-4">
                              • {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Diff Stat Component
 */
function DiffStat({
  label,
  changed,
  count,
  delta,
  unit,
  multiplier = 1,
}: {
  label: string;
  changed: boolean;
  count?: number;
  delta?: number;
  unit?: string;
  multiplier?: number;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      <div className="flex items-center justify-center gap-2">
        {changed ? (
          <span className="text-2xl">⚠️</span>
        ) : (
          <span className="text-2xl">✅</span>
        )}
        {count !== undefined && (
          <span className="text-lg font-bold text-gray-900">{count}</span>
        )}
        {delta !== undefined && (
          <span
            className={`text-lg font-bold ${
              delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {(delta * multiplier).toFixed(multiplier === 100 ? 1 : 0)}
            {unit}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {changed ? 'Changed' : 'No change'}
      </p>
    </div>
  );
}

/**
 * Result Panel Component
 */
function ResultPanel({
  title,
  version,
  result,
  highlight = false,
}: {
  title: string;
  version: string;
  result: ReplayResult['originalResult'];
  highlight?: boolean;
}) {
  return (
    <div
      className={`border-2 rounded-xl p-5 ${
        highlight
          ? 'border-primary/30 bg-primary/5'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
          {version}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Confidence</p>
          <p className="text-lg font-bold text-gray-900">
            {result.confidenceScore !== undefined
              ? `${(result.confidenceScore * 100).toFixed(0)}%`
              : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Execution Time</p>
          <p className="text-lg font-bold text-gray-900">{result.executionTimeMs}ms</p>
        </div>
      </div>

      {/* Rules */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Matched Rules ({result.matchedRules.length})
        </p>
        <ul className="space-y-1">
          {result.matchedRules.slice(0, 5).map((rule, idx) => (
            <li
              key={idx}
              className="text-sm text-gray-600 flex items-center justify-between"
            >
              <span className="truncate">{rule.ruleName || rule.ruleId}</span>
              <span className="text-xs text-gray-500 ml-2">P{rule.priority}</span>
            </li>
          ))}
          {result.matchedRules.length > 5 && (
            <li className="text-xs text-gray-500">
              +{result.matchedRules.length - 5} more...
            </li>
          )}
        </ul>
      </div>

      {/* Output */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Output</p>
        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
          {JSON.stringify(result.output, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Helper: Get nested value from object by dot-notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}
