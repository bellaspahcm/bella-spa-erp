'use client';

import React, { useState, useEffect } from 'react';
import {
  getArchDecisionsAction,
  getTechDebtAction,
  getMaturityScoresAction,
  getIndustryPacksAction,
  getAiAgentsAction,
  getAiPlatformSummaryAction,
  updateAdrStatusAction,
  submitArbReviewAction,
  updateDebtStatusAction,
  type ArchDecision,
  type TechDebt,
  type MaturityScore,
  type IndustryPack,
  type AiAgent,
} from '@/services/architecture/arb-actions';

// ─── Status Badge ───────────────────────────────────────────────────────────
function Badge({
  label,
  color,
}: {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple' | 'indigo' | 'cyan';
}) {
  const colorMap: Record<string, string> = {
    green: 'rgba(34,197,94,0.15) border border-green-500/40 text-green-300',
    blue: 'rgba(59,130,246,0.15) border border-blue-500/40 text-blue-300',
    yellow: 'rgba(234,179,8,0.15) border border-yellow-500/40 text-yellow-300',
    red: 'rgba(239,68,68,0.15) border border-red-500/40 text-red-300',
    gray: 'rgba(107,114,128,0.15) border border-gray-500/40 text-gray-400',
    purple: 'rgba(168,85,247,0.15) border border-purple-500/40 text-purple-300',
    indigo: 'rgba(99,102,241,0.15) border border-indigo-500/40 text-indigo-300',
    cyan: 'rgba(6,182,212,0.15) border border-cyan-500/40 text-cyan-300',
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: colorMap[color]?.split(' ')[0] || 'rgba(107,114,128,0.15)' }}
    >
      {label}
    </span>
  );
}

// ─── Tab types ───────────────────────────────────────────────────────────────
type Tab = 'adr' | 'debt' | 'maturity' | 'packs' | 'ai';

// ─── ADR Status helpers ───────────────────────────────────────────────────────
function adrStatusColor(status: ArchDecision['status']): 'green' | 'blue' | 'gray' | 'yellow' {
  const map: Record<ArchDecision['status'], 'green' | 'blue' | 'gray' | 'yellow'> = {
    accepted: 'green',
    proposed: 'blue',
    deprecated: 'gray',
    superseded: 'yellow',
  };
  return map[status] ?? 'gray';
}

function debtSeverityColor(s: TechDebt['severity']): 'red' | 'yellow' | 'blue' | 'gray' {
  const map: Record<TechDebt['severity'], 'red' | 'yellow' | 'blue' | 'gray'> = {
    critical: 'red',
    high: 'yellow',
    medium: 'blue',
    low: 'gray',
  };
  return map[s];
}

function debtStatusColor(s: TechDebt['status']): 'green' | 'blue' | 'yellow' | 'gray' | 'red' {
  const map: Record<TechDebt['status'], 'green' | 'blue' | 'yellow' | 'gray' | 'red'> = {
    resolved: 'green',
    in_progress: 'blue',
    open: 'yellow',
    accepted_risk: 'gray',
    wont_fix: 'red',
  };
  return map[s];
}

// ─── Maturity Radar Card ──────────────────────────────────────────────────────
function MaturityRadarCard({ scores }: { scores: MaturityScore[] }) {
  // Get latest score per dimension
  const latestByDimension = scores.reduce<Record<string, MaturityScore>>((acc, s) => {
    if (!acc[s.dimension] || s.assessment_date > acc[s.dimension].assessment_date) {
      acc[s.dimension] = s;
    }
    return acc;
  }, {});

  const dimensions = Object.values(latestByDimension);
  const avgScore =
    dimensions.length > 0
      ? (dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length).toFixed(1)
      : '–';

  const dimensionIcons: Record<string, string> = {
    architecture: '🏛️',
    security: '🔒',
    performance: '⚡',
    quality: '✅',
    observability: '📡',
    ai: '🤖',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Platform Maturity Scorecard</h3>
          <p className="text-xs text-gray-400 mt-0.5">TOGAF Capability Assessment</p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400">{avgScore}</div>
          <div className="text-xs text-gray-500">/ 10 avg</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {dimensions.map((d) => (
          <div key={d.dimension} className="flex items-center gap-3">
            <span className="text-lg">{dimensionIcons[d.dimension] ?? '📊'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 capitalize">{d.dimension}</span>
                <span className="text-xs font-bold text-white">{d.score}/10</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(d.score / 10) * 100}%`,
                    background:
                      d.score >= 9
                        ? 'linear-gradient(to right, #10b981, #34d399)'
                        : d.score >= 7
                          ? 'linear-gradient(to right, #3b82f6, #60a5fa)'
                          : 'linear-gradient(to right, #f59e0b, #fbbf24)',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ArchitectureGovernancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('adr');
  const [adrs, setAdrs] = useState<ArchDecision[]>([]);
  const [debts, setDebts] = useState<TechDebt[]>([]);
  const [maturityScores, setMaturityScores] = useState<MaturityScore[]>([]);
  const [packs, setPacks] = useState<IndustryPack[]>([]);
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [aiSummary, setAiSummary] = useState<{
    totalAgents: number;
    activeAgents: number;
    totalCallsThisMonth: number;
    totalTokensUsed: number;
    estimatedMonthlyCostUsd: number;
    error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // ARB Review Modal state
  const [reviewModal, setReviewModal] = useState<{
    adr: ArchDecision | null;
    reviewer: string;
    verdict: 'approved' | 'rejected' | 'needs_revision' | 'abstain';
    comments: string;
  }>({ adr: null, reviewer: '', verdict: 'approved', comments: '' });

  const loadData = async () => {
    setLoading(true);
    const [adrRes, debtRes, matRes, packsRes, agentsRes, aiSumRes] = await Promise.all([
      getArchDecisionsAction(),
      getTechDebtAction(),
      getMaturityScoresAction(),
      getIndustryPacksAction(),
      getAiAgentsAction(),
      getAiPlatformSummaryAction(),
    ]);
    setAdrs(adrRes.data);
    setDebts(debtRes.data);
    setMaturityScores(matRes.data);
    setPacks(packsRes.data);
    setAgents(agentsRes.data);
    setAiSummary(aiSumRes);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleArbSubmit = async () => {
    if (!reviewModal.adr) return;
    await submitArbReviewAction({
      adrId: reviewModal.adr.id,
      reviewerName: reviewModal.reviewer,
      verdict: reviewModal.verdict,
      comments: reviewModal.comments,
    });
    setReviewModal({ adr: null, reviewer: '', verdict: 'approved', comments: '' });
    void loadData();
  };

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: 'adr', label: 'Architecture Decisions', icon: '🏛️', count: adrs.length },
    { id: 'debt', label: 'Tech Debt Register', icon: '⚠️', count: debts.filter((d) => d.status === 'open' || d.status === 'in_progress').length },
    { id: 'maturity', label: 'Platform Maturity', icon: '📊' },
    { id: 'packs', label: 'Industry Packs', icon: '📦', count: packs.length },
    { id: 'ai', label: 'AI Platform', icon: '🤖', count: agents.filter((a) => a.status === 'active').length },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #0f2027 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              🏛️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Enterprise Architecture Repository</h1>
              <p className="text-sm text-gray-400">TOGAF 10 · ISO/IEC/IEEE 42010 · BELLA v3.2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
              ✅ Reference Architecture FROZEN v1.0.0
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 border border-purple-500/40 text-purple-300">
              ARB Active
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-500/40 text-blue-300">
              {adrs.filter((a) => a.status === 'accepted').length} ADRs Accepted
            </span>
          </div>
        </div>

        {/* Maturity Scorecard always visible */}
        <MaturityRadarCard scores={maturityScores} />

        {/* Tabs */}
        <div className="flex gap-1 mt-6 mb-6 bg-white/5 rounded-xl p-1 border border-white/10 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-2 animate-spin">⚙️</div>
            <p>Đang tải Architecture Repository...</p>
          </div>
        )}

        {/* Tab: ADR List */}
        {!loading && activeTab === 'adr' && (
          <div className="space-y-3">
            {adrs.map((adr) => (
              <div
                key={adr.id}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 hover:bg-white/8 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-indigo-400 font-bold">{adr.adr_code}</span>
                      <Badge label={adr.decision_type} color="indigo" />
                      <Badge label={adr.status} color={adrStatusColor(adr.status)} />
                    </div>
                    <h3 className="text-white font-semibold text-base">{adr.title}</h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{adr.context}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {adr.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {adr.reviewed_by.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Reviewed by: {adr.reviewed_by.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {adr.status === 'proposed' && (
                      <button
                        onClick={() =>
                          setReviewModal((prev) => ({ ...prev, adr, verdict: 'approved' }))
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all"
                      >
                        ARB Review
                      </button>
                    )}
                    {adr.status === 'proposed' && (
                      <button
                        onClick={() => updateAdrStatusAction(adr.id, 'accepted').then(() => loadData())}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all"
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Tech Debt */}
        {!loading && activeTab === 'debt' && (
          <div>
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const count = debts.filter((d) => d.severity === sev && d.status !== 'resolved').length;
                const colorMap: Record<string, string> = {
                  critical: '#ef4444',
                  high: '#f59e0b',
                  medium: '#3b82f6',
                  low: '#6b7280',
                };
                return (
                  <div
                    key={sev}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                  >
                    <div className="text-3xl font-bold" style={{ color: colorMap[sev] }}>
                      {count}
                    </div>
                    <div className="text-xs capitalize text-gray-400 mt-1">{sev}</div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              {debts.map((debt) => (
                <div
                  key={debt.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-amber-400">{debt.debt_code}</span>
                        <Badge label={debt.severity.toUpperCase()} color={debtSeverityColor(debt.severity)} />
                        <Badge label={debt.category} color="purple" />
                        <Badge label={debt.status.replace('_', ' ')} color={debtStatusColor(debt.status)} />
                      </div>
                      <h3 className="text-white font-semibold">{debt.title}</h3>
                      <p className="text-gray-400 text-sm mt-1">{debt.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>⏱️ {debt.effort_days}d effort</span>
                        {debt.affected_module && <span>📦 {debt.affected_module}</span>}
                        {debt.target_quarter && <span>🎯 {debt.target_quarter}</span>}
                      </div>
                      {debt.remediation_plan && (
                        <p className="text-xs text-indigo-300 mt-2 italic">💡 {debt.remediation_plan}</p>
                      )}
                    </div>
                    <div>
                      {debt.status === 'open' && (
                        <button
                          onClick={() =>
                            updateDebtStatusAction(debt.id, 'in_progress').then(() => loadData())
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/80 hover:bg-blue-600 text-white transition-all"
                        >
                          Start
                        </button>
                      )}
                      {debt.status === 'in_progress' && (
                        <button
                          onClick={() =>
                            updateDebtStatusAction(debt.id, 'resolved').then(() => loadData())
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Maturity */}
        {!loading && activeTab === 'maturity' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-white font-semibold text-lg mb-4">
                Platform Maturity Detail – All Dimensions
              </h2>
              {maturityScores.map((s) => (
                <div key={s.id} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-300 capitalize font-medium">{s.dimension}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{s.score}/10</span>
                      <span className="text-xs text-gray-500">{s.assessment_date}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(s.score / 10) * 100}%`,
                        background:
                          s.score >= 9
                            ? 'linear-gradient(to right, #10b981, #6ee7b7)'
                            : s.score >= 7
                              ? 'linear-gradient(to right, #3b82f6, #93c5fd)'
                              : 'linear-gradient(to right, #f59e0b, #fde68a)',
                      }}
                    />
                  </div>
                  {s.notes && <p className="text-xs text-gray-500 mt-1 italic">{s.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Industry Packs */}
        {!loading && activeTab === 'packs' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-cyan-400">{pack.pack_code}</span>
                      <span className="text-xs text-gray-500">v{pack.version}</span>
                      {pack.is_frozen && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🔒 Frozen
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold">{pack.pack_name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{pack.description}</p>
                  </div>
                  <Badge
                    label={pack.status}
                    color={pack.status === 'active' ? 'green' : pack.status === 'deprecated' ? 'gray' : 'yellow'}
                  />
                </div>

                {/* Maturity Level */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Maturity:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-4 h-4 rounded-sm ${
                          level <= pack.maturity_level
                            ? 'bg-emerald-500'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">Level {pack.maturity_level}/5</span>
                </div>

                {/* Capabilities */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Capabilities ({pack.enabled_capabilities.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {pack.enabled_capabilities.slice(0, 5).map((cap) => (
                      <span key={cap} className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
                        {cap}
                      </span>
                    ))}
                    {pack.enabled_capabilities.length > 5 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-400">
                        +{pack.enabled_capabilities.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Compliance */}
                {pack.compliance_standards.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pack.compliance_standards.map((std) => (
                      <span key={std} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        ✓ {std}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab: AI Platform */}
        {!loading && activeTab === 'ai' && (
          <div>
            {/* AI Summary KPIs */}
            {aiSummary && (
              <div className="grid grid-cols-5 gap-4 mb-6">
                {[
                  { label: 'Total Agents', value: aiSummary.totalAgents, icon: '🤖', color: '#6366f1' },
                  { label: 'Active', value: aiSummary.activeAgents, icon: '✅', color: '#10b981' },
                  { label: 'Total Calls', value: aiSummary.totalCallsThisMonth.toLocaleString(), icon: '📞', color: '#3b82f6' },
                  { label: 'Total Tokens', value: (aiSummary.totalTokensUsed / 1000).toFixed(1) + 'K', icon: '🔢', color: '#f59e0b' },
                  { label: 'Monthly Cost', value: `$${aiSummary.estimatedMonthlyCostUsd.toFixed(2)}`, icon: '💵', color: '#ef4444' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-2xl mb-1">{kpi.icon}</div>
                    <div className="text-xl font-bold" style={{ color: kpi.color }}>
                      {kpi.value}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-purple-400">{agent.agent_code}</span>
                        <Badge label={agent.agent_type} color="purple" />
                        <Badge label={agent.status} color={agent.status === 'active' ? 'green' : 'gray'} />
                      </div>
                      <h3 className="text-white font-semibold">{agent.agent_name}</h3>
                      <p className="text-gray-400 text-sm mt-1">{agent.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>🧠 {agent.model}</span>
                        <span>📞 {agent.total_calls.toLocaleString()} calls</span>
                        <span>🔢 {(agent.total_tokens_used / 1000).toFixed(1)}K tokens</span>
                        <span>💵 ${Number(agent.monthly_cost_usd).toFixed(2)}/mo</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {agent.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-400"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Tenants:{' '}
                        {agent.enabled_for_tenants.includes('*')
                          ? 'All tenants'
                          : agent.enabled_for_tenants.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ARB Review Modal */}
      {reviewModal.adr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/20 bg-[#0f1a2e] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">
              ARB Review – {reviewModal.adr.adr_code}
            </h2>
            <p className="text-gray-400 text-sm mb-4">{reviewModal.adr.title}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reviewer Name</label>
                <input
                  type="text"
                  value={reviewModal.reviewer}
                  onChange={(e) =>
                    setReviewModal((prev) => ({ ...prev, reviewer: e.target.value }))
                  }
                  placeholder="Tên reviewer..."
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Verdict</label>
                <select
                  value={reviewModal.verdict}
                  onChange={(e) =>
                    setReviewModal((prev) => ({
                      ...prev,
                      verdict: e.target.value as typeof reviewModal.verdict,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="approved">✅ Approved</option>
                  <option value="rejected">❌ Rejected</option>
                  <option value="needs_revision">📝 Needs Revision</option>
                  <option value="abstain">⏸️ Abstain</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Comments</label>
                <textarea
                  value={reviewModal.comments}
                  onChange={(e) =>
                    setReviewModal((prev) => ({ ...prev, comments: e.target.value }))
                  }
                  rows={3}
                  placeholder="Nhận xét ARB..."
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() =>
                  setReviewModal({ adr: null, reviewer: '', verdict: 'approved', comments: '' })
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleArbSubmit}
                disabled={!reviewModal.reviewer}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-all"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
