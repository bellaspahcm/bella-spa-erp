'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ClipboardList, Loader2, RefreshCw, TrendingUp } from 'lucide-react';

interface CommandCenterTotals {
  branchCount: number;
  activeEnrollments: number;
  activeClasses: number;
  teacherCount: number;
  scheduledSessions: number;
  completedSessions: number;
  attendanceRate: number;
  attendanceRiskCount: number;
  learningSupportCount: number;
  outstandingTuitionMinor: string;
  overdueInvoiceCount: number;
  pendingAcknowledgements: number;
  failedDeliveries: number;
}

interface BranchKpi {
  branchId: string;
  branchCode: string;
  branchName: string;
  activeEnrollments: number;
  activeClasses: number;
  teacherCount: number;
  scheduledSessions: number;
  attendanceRate: number;
  outstandingTuitionMinor: string;
  overdueInvoiceCount: number;
  pendingAcknowledgements: number;
  failedDeliveries: number;
}

interface WorkQueueItem {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  branchName: string;
  title: string;
  reason: string;
  metric: number | string;
}

interface CommandCenterDashboard {
  tenantId: string;
  asOf: string;
  totals: CommandCenterTotals;
  branches: BranchKpi[];
  workQueue: WorkQueueItem[];
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function severityTone(severity: WorkQueueItem['severity']) {
  if (severity === 'high') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function EnglishCenterCommandCenterPage() {
  const [dashboard, setDashboard] = useState<CommandCenterDashboard | null>(null);
  const [branchIds, setBranchIds] = useState('');
  const [rootOrgUnitId, setRootOrgUnitId] = useState('');
  const [asOf, setAsOf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchIds) params.set('branchIds', branchIds);
      if (rootOrgUnitId) params.set('rootOrgUnitId', rootOrgUnitId);
      if (asOf) params.set('asOf', new Date(asOf).toISOString());
      const response = await fetch(`/api/english-center/command-center?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load command center');
      setDashboard(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // Initial load only; filters are applied by the explicit Load action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = dashboard?.totals;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Chain Command Center</h1>
              <p className="text-sm font-semibold text-slate-500">Branch KPIs and operational work queue</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:border-slate-400 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        )}

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_220px_auto]">
          <input value={branchIds} onChange={(event) => setBranchIds(event.target.value)} placeholder="Branch IDs, comma separated" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" />
          <input value={rootOrgUnitId} onChange={(event) => setRootOrgUnitId(event.target.value)} placeholder="Root org unit ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" />
          <input type="datetime-local" value={asOf} onChange={(event) => setAsOf(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" />
          <button type="button" onClick={loadDashboard} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-black text-white hover:bg-slate-700">
            <RefreshCw className="h-4 w-4" />
            Load
          </button>
        </section>

        {totals && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400">
                Branches <Building2 className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-3xl font-black">{totals.branchCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400">
                Enrollments <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-3xl font-black">{totals.activeEnrollments}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400">
                Attendance <CheckCircle2 className="h-4 w-4 text-sky-600" />
              </div>
              <p className="mt-2 text-3xl font-black">{formatPercent(totals.attendanceRate)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400">
                Outstanding <ClipboardList className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-3xl font-black">{totals.outstandingTuitionMinor}</p>
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 text-sm font-black uppercase text-slate-500">Branch KPI</div>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Enrollments</th>
                    <th className="px-4 py-3">Classes</th>
                    <th className="px-4 py-3">Sessions</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Overdue</th>
                    <th className="px-4 py-3">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(dashboard?.branches || []).map((branch) => (
                    <tr key={branch.branchId}>
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900">{branch.branchName}</div>
                        <div className="text-xs font-semibold text-slate-500">{branch.branchCode}</div>
                      </td>
                      <td className="px-4 py-3 font-bold">{branch.activeEnrollments}</td>
                      <td className="px-4 py-3 font-bold">{branch.activeClasses}</td>
                      <td className="px-4 py-3 font-bold">{branch.scheduledSessions}</td>
                      <td className="px-4 py-3 font-bold">{formatPercent(branch.attendanceRate)}</td>
                      <td className="px-4 py-3 font-bold">{branch.overdueInvoiceCount}</td>
                      <td className="px-4 py-3 font-bold">{branch.failedDeliveries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black">
              <ClipboardList className="h-4 w-4 text-slate-700" />
              Work Queue
            </h2>
            <div className="space-y-2">
              {(dashboard?.workQueue || []).map((item) => (
                <div key={item.id} className={`rounded-lg border p-3 text-sm ${severityTone(item.severity)}`}>
                  <div className="font-black">{item.title}</div>
                  <div className="mt-1 font-semibold">{item.branchName} · {item.reason}</div>
                  <div className="mt-1 text-xs font-black uppercase">{item.type} · {item.metric}</div>
                </div>
              ))}
              {dashboard && dashboard.workQueue.length === 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  Queue clear
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
