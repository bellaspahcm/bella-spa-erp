'use client';

import React, { useState, useEffect } from 'react';
import {
  getAiAgentsAction,
  updateAgentStatusAction,
  testRunAgentPromptAction,
  getPromptLedgerAction,
  type AiAgentConfig,
  type PromptExecutionLog,
} from '@/services/platform/ai-platform-actions';

export default function AiPlatformPortalPage() {
  const [agents, setAgents] = useState<AiAgentConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AiAgentConfig | null>(null);
  const [promptText, setPromptText] = useState('Hãy chạy đối soát lương KTV chi tiết cho tháng hiện tại.');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    responseText: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    latencyMs: number;
    error: string | null;
  } | null>(null);
  const [runningPrompt, setRunningPrompt] = useState(false);
  const [ledgerLogs, setLedgerLogs] = useState<PromptExecutionLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [agentsRes, ledgerRes] = await Promise.all([
      getAiAgentsAction(),
      getPromptLedgerAction(),
    ]);
    setAgents(agentsRes.data);
    setLedgerLogs(ledgerRes.data);
    if (agentsRes.data.length > 0) {
      setSelectedAgent(agentsRes.data[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleTestPrompt = async () => {
    if (!selectedAgent) return;
    setRunningPrompt(true);
    const res = await testRunAgentPromptAction({
      agentCode: selectedAgent.agentCode,
      promptText,
    });
    setTestResult(res);
    setRunningPrompt(false);
    void loadData(); // Reload stats and logs
  };

  const handleToggleStatus = async (agent: AiAgentConfig) => {
    const nextStatus = agent.status === 'active' ? 'disabled' : 'active';
    await updateAgentStatusAction(agent.id, nextStatus);
    void loadData();
  };

  // Helper type badge color
  const agentTypeColor = (type: AiAgentConfig['agentType']) => {
    const map: Record<AiAgentConfig['agentType'], string> = {
      assistant: '#3b82f6', // blue
      autopilot: '#10b981', // emerald
      copilot: '#06b6d4', // cyan
      evaluator: '#8b5cf6', // purple
      orchestrator: '#d946ef', // fuchsia
      classifier: '#f59e0b', // amber
    };
    return map[type] || '#6b7280';
  };

  return (
    <div className="min-h-screen text-slate-100" style={{ background: 'linear-gradient(135deg, #090816 0%, #0d0a21 50%, #110e2c 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
            >
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">EIP Autonomous AI Platform</h1>
              <p className="text-sm text-purple-400">Agent Runtime Registry · Prompt Token Ledgers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 border border-purple-500/40 text-purple-300">
              ⚡ Status: Autopilot Ready
            </span>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-3xl mb-2 animate-spin">⚙️</div>
            <p>Đang tải AI Platform Dashboard...</p>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Agent List */}
            <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                🤖 AI Agents Registry ({agents.length})
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`w-full p-4 rounded-xl border transition-all ${
                      selectedAgent?.id === agent.id
                        ? 'bg-purple-600/20 border-purple-500/50'
                        : 'bg-white/5 border-white/5 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <button
                        onClick={() => {
                          setSelectedAgent(agent);
                          setTestResult(null);
                        }}
                        className="text-left flex-1 min-w-0"
                      >
                        <span className="text-xs font-mono font-bold" style={{ color: agentTypeColor(agent.agentType) }}>
                          {agent.agentType.toUpperCase()}
                        </span>
                        <div className="text-sm font-semibold text-white truncate mt-0.5">{agent.agentName}</div>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(agent)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                          agent.status === 'active'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20'
                        }`}
                      >
                        {agent.status === 'active' ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{agent.description}</p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500 border-t border-white/5 pt-2 font-mono">
                      <span>📞 {agent.totalCalls.toLocaleString()} calls</span>
                      <span>💵 ${agent.monthlyCostUsd.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt Studio & Ledger */}
            <div className="lg:col-span-2 space-y-6">
              {selectedAgent && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">AI Agent Prompt Lab</h3>
                      <p className="text-xs text-gray-400">Testing model: {selectedAgent.model}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-slate-300 capitalize">
                      {selectedAgent.agentType}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={3}
                      placeholder="Gửi prompt test cho Agent..."
                      className="w-full font-mono text-sm px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-purple-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleTestPrompt}
                        disabled={runningPrompt || !promptText.trim() || selectedAgent.status !== 'active'}
                        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-sm transition-all"
                      >
                        {runningPrompt ? 'Running Prompt...' : 'Send Prompt'}
                      </button>
                    </div>
                  </div>

                  {testResult && (
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          Response State:{' '}
                          {testResult.success
                            ? `Success (${testResult.latencyMs}ms)`
                            : 'Error'}
                        </span>
                        {testResult.success && (
                          <span className="font-mono text-[10px] text-purple-400">
                            Tokens: {testResult.promptTokens} in / {testResult.completionTokens} out · Cost: ${testResult.costUsd}
                          </span>
                        )}
                      </div>

                      {!testResult.success && (
                        <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-300 font-mono">
                          {testResult.error}
                        </div>
                      )}

                      {testResult.success && (
                        <div className="p-4 rounded-xl bg-slate-950 border border-white/5 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {testResult.responseText}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prompt Token Ledger Logs */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  📊 EIP Prompt Audit Ledger (Latest Transactions)
                </h3>
                <div className="overflow-x-auto border border-white/5 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 font-mono text-[10px] text-purple-300 uppercase border-b border-white/10">
                      <tr>
                        <th className="p-3">Agent</th>
                        <th className="p-3">Latency</th>
                        <th className="p-3">Prompt Tokens</th>
                        <th className="p-3">Completion Tokens</th>
                        <th className="p-3">Cost USD</th>
                        <th className="p-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                      {ledgerLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5">
                          <td className="p-3 font-semibold text-slate-200">{log.agentCode}</td>
                          <td className="p-3 text-cyan-400">{log.latencyMs}ms</td>
                          <td className="p-3 text-slate-400">{log.promptTokens}</td>
                          <td className="p-3 text-slate-400">{log.completionTokens}</td>
                          <td className="p-3 text-amber-400 font-semibold">${log.costUsd.toFixed(6)}</td>
                          <td className="p-3 text-right text-gray-500">
                            {new Date(log.executedAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
