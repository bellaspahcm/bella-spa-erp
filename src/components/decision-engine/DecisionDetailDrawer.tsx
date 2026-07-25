/**
 * Decision Detail Drawer Component (Sprint 1)
 * 
 * Slide-out panel showing full decision details including:
 * - Input Context (JSON viewer)
 * - Policies Executed
 * - Matched Rules with conditions
 * - Output (JSON viewer)
 * - Audit Log timeline
 * - Metadata (versions, correlation, metrics)
 * 
 * Features:
 * - Click outside or ESC to close
 * - Copy JSON button
 * - Replay button (opens Time Machine interface)
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';
import DecisionTimeMachine from './DecisionTimeMachine';

interface DecisionDetail {
  id: string;
  decisionId: string;
  decisionType: string;
  provider: string;
  executionTimeMs: number;
  status: 'success' | 'error' | 'warning';
  inputContext: Record<string, unknown>;
  policiesExecuted: string[];
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    priority: number;
    conditions?: string[];
  }>;
  output: Record<string, unknown>;
  auditLog: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
  tenantId: string;
  userId?: string;
  confidenceScore?: number;
  // Sprint 1 additions
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  versionSnapshot?: Record<string, unknown>;
  resourceMetrics?: Record<string, unknown>;
  businessOutcome?: Record<string, unknown>;
  aiMetadata?: Record<string, unknown>;
  createdAt: string;
}

interface DecisionDetailDrawerProps {
  decisionId: string;
  onClose: () => void;
  onReplay?: (decisionId: string) => void;
}

export default function DecisionDetailDrawer({
  decisionId,
  onClose,
  onReplay,
}: DecisionDetailDrawerProps) {
  const [data, setData] = useState<DecisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTimeMachine, setShowTimeMachine] = useState(false);

  // Fetch decision detail
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/decision-engine/audit/${decisionId}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch decision detail');
        }

        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [decisionId]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Copy JSON to clipboard
  const copyJSON = async (obj: Record<string, unknown>) => {
    const success = await copyToClipboard(JSON.stringify(obj, null, 2));
    if (success) {
      toast.success('Đã sao chép dữ liệu JSON');
    } else {
      toast.error('Không thể tự động sao chép JSON');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Chi tiết Quyết định</h2>
            {data && (
              <p className="text-sm text-gray-600 mt-1 font-mono">{data.decisionId}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">⚠️ {error}</p>
            </div>
          ) : data ? (
            <>
              {/* Summary Card */}
              <SummaryCard data={data} />

              {/* Input Context */}
              <Section title="Dữ liệu đầu vào (Input)" copyButton={() => copyJSON(data.inputContext)}>
                <JSONViewer data={data.inputContext} />
              </Section>

              {/* Policies Executed */}
              {data.policiesExecuted.length > 0 && (
                <Section title="Chính sách đã thực thi">
                  <ul className="space-y-2">
                    {data.policiesExecuted.map((policy, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        <span className="font-medium">{policy}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Matched Rules */}
              {data.matchedRules.length > 0 && (
                <Section title="Quy tắc phù hợp">
                  <div className="space-y-4">
                    {data.matchedRules.map((rule, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{rule.ruleName || rule.ruleId}</h4>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            Độ ưu tiên: {rule.priority}
                          </span>
                        </div>
                        {rule.conditions && rule.conditions.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600 mb-1">Điều kiện khớp:</p>
                            <ul className="space-y-1">
                              {rule.conditions.map((condition, cidx) => (
                                <li key={cidx} className="flex items-start gap-2 text-sm">
                                  <span className="text-green-500 mt-0.5">✓</span>
                                  <code className="text-gray-700">{condition}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Output */}
              <Section title="Kết quả đầu ra (Output)" copyButton={() => copyJSON(data.output)}>
                <JSONViewer data={data.output} />
              </Section>

              {/* Audit Log */}
              {data.auditLog.length > 0 && (
                <Section title="Nhật ký kiểm toán">
                  <div className="space-y-3">
                    {data.auditLog.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <LogLevelBadge level={log.level} />
                        <div className="flex-1">
                          <p className="text-sm text-gray-800">{log.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Metadata */}
              <Section title="Dữ liệu hệ thống (Metadata)">
                <MetadataGrid data={data} />
              </Section>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowTimeMachine(true)}
                  className="flex-1 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all font-semibold text-sm"
                >
                  🔄 Chạy lại quyết định (Time Machine)
                </button>
                {data.traceId && (
                  <button
                    onClick={() => {
                      // TODO: Navigate to trace viewer (Task #11)
                      window.location.href = `/dashboard/decision-engine/trace/${data.traceId}`;
                    }}
                    className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all font-semibold text-sm"
                  >
                    🔍 Xem toàn bộ Trace
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Time Machine Modal */}
      {showTimeMachine && data && data.versionSnapshot?.version && (
        <DecisionTimeMachine
          decisionId={data.id}
          originalVersion={String(data.versionSnapshot.version)}
          onClose={() => setShowTimeMachine(false)}
        />
      )}
    </>
  );
}

/**
 * Section Component
 */
function Section({
  title,
  children,
  copyButton,
}: {
  title: string;
  children: React.ReactNode;
  copyButton?: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {copyButton && (
          <button
            onClick={copyButton}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Sao chép JSON"
          >
            📋 Sao chép
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Summary Card Component
 */
function SummaryCard({ data }: { data: DecisionDetail }) {
  return (
    <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-2xl p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Phân loại</p>
          <span className="px-2.5 py-1 text-sm font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg">
            {data.decisionType}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Trạng thái</p>
          <StatusBadge status={data.status} />
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Nhà cung cấp</p>
          <p className="font-medium text-gray-900">{data.provider}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Thời gian xử lý</p>
          <p className="font-medium text-gray-900">{data.executionTimeMs}ms</p>
        </div>
        {data.confidenceScore !== undefined && (
          <div>
            <p className="text-xs text-gray-600 mb-1">Độ tin cậy</p>
            <p className="font-medium text-gray-900">
              {(data.confidenceScore * 100).toFixed(0)}%
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-600 mb-1">Thời gian tạo</p>
          <p className="font-medium text-gray-900 text-sm">
            {format(new Date(data.createdAt), 'yyyy-MM-dd HH:mm:ss')}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Metadata Grid Component
 */
function MetadataGrid({ data }: { data: DecisionDetail }) {
  const metadata = [
    { label: 'Tenant ID', value: data.tenantId },
    { label: 'User ID', value: data.userId || 'N/A' },
    { label: 'Correlation ID', value: data.correlationId || 'N/A' },
    { label: 'Trace ID', value: data.traceId || 'N/A' },
    { label: 'Span ID', value: data.spanId || 'N/A' },
    { label: 'Parent Span ID', value: data.parentSpanId || 'N/A' },
  ];

  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metadata.map((item) => (
        <div key={item.label}>
          <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
          <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * JSON Viewer Component
 */
function JSONViewer({ data }: { data: Record<string, unknown> | null | undefined }) {
  return (
    <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">
      <code className="text-gray-800">{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: 'success' | 'error' | 'warning' }) {
  const colors = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded inline-flex items-center gap-1 ${colors[status]}`}
    >
      <span>{icons[status]}</span>
      <span className="capitalize">{status === 'success' ? 'Thành công' : status === 'warning' ? 'Cảnh báo' : 'Thất bại'}</span>
    </span>
  );
}

/**
 * Log Level Badge Component
 */
function LogLevelBadge({ level }: { level: 'info' | 'warn' | 'error' }) {
  const colors = {
    info: 'bg-blue-100 text-blue-800',
    warn: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  const icons = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded inline-flex items-center gap-1 ${colors[level]}`}
    >
      <span>{icons[level]}</span>
      <span className="uppercase">{level === 'info' ? 'Thông tin' : level === 'warn' ? 'Cảnh báo' : 'Lỗi'}</span>
    </span>
  );
}
