'use client';

import React, { useState, useEffect } from 'react';
import {
  getDataCatalogAction,
  getDataLineageAction,
  executeLakehouseQueryAction,
  type DataCatalogTable,
  type DataLineageNode,
} from '@/services/platform/data-platform-actions';

export default function DataPlatformPortalPage() {
  const [catalog, setCatalog] = useState<DataCatalogTable[]>([]);
  const [lineage, setLineage] = useState<DataLineageNode[]>([]);
  const [activeTable, setActiveTable] = useState<DataCatalogTable | null>(null);
  const [querySql, setQuerySql] = useState('SELECT * FROM analytics_finance_journals_fact LIMIT 10;');
  const [queryResult, setQueryResult] = useState<{
    success: boolean;
    durationMs: number;
    rowCount: number;
    columns: string[];
    rows: Record<string, string | number | boolean | null>[];
    error: string | null;
  } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [catRes, linRes] = await Promise.all([
      getDataCatalogAction(),
      getDataLineageAction(),
    ]);
    setCatalog(catRes.data);
    setLineage(linRes.data);
    if (catRes.data.length > 0) {
      setActiveTable(catRes.data[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleExecuteQuery = async () => {
    setExecuting(true);
    const res = await executeLakehouseQueryAction(querySql);
    setQueryResult(res);
    setExecuting(false);
  };

  // Helper domain color
  const domainColor = (domain: DataCatalogTable['domain']) => {
    const map: Record<DataCatalogTable['domain'], string> = {
      finance: '#ef4444', // Red/Orange
      healthcare: '#10b981', // Emerald
      operations: '#3b82f6', // Blue
      crm: '#f59e0b', // Amber
      hr: '#8b5cf6', // Purple
    };
    return map[domain] || '#6b7280';
  };

  return (
    <div className="min-h-screen text-slate-100" style={{ background: 'linear-gradient(135deg, #050b14 0%, #0a1120 50%, #0b1528 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}
            >
              📡
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Host Analytics Lakehouse Portal</h1>
              <p className="text-sm text-cyan-400">ClickHouse OLAP Engine · Unified Semantic Layer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              ⚡ Multi-Tenant Isolation: Active
            </span>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-3xl mb-2 animate-spin">⚙️</div>
            <p>Đang tải Data Platform Catalogue...</p>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Catalog Browser */}
            <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                📂 Data Catalog Browser
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {catalog.map((tbl) => (
                  <button
                    key={tbl.id}
                    onClick={() => {
                      setActiveTable(tbl);
                      setQuerySql(`SELECT * FROM ${tbl.tableName} LIMIT 10;`);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      activeTable?.id === tbl.id
                        ? 'bg-cyan-600/20 border-cyan-500/50'
                        : 'bg-white/5 border-white/5 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold" style={{ color: domainColor(tbl.domain) }}>
                        {tbl.domain.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-500">{(tbl.dataSizeMb).toFixed(1)} MB</span>
                    </div>
                    <div className="text-sm font-semibold text-white truncate">{tbl.tableName}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">{tbl.description}</div>
                  </button>
                ))}
              </div>

              {activeTable && (
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-400">Table Schema</h4>
                    <span className="text-[10px] text-gray-500">{(activeTable.rowCount).toLocaleString()} rows</span>
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {activeTable.columns.map((col) => (
                      <div key={col.name} className="flex items-start justify-between text-xs bg-white/5 p-2 rounded-lg">
                        <div className="min-w-0">
                          <span className="font-mono text-cyan-300 font-semibold">{col.name}</span>
                          {col.isPrimary && <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded ml-1.5">PK</span>}
                          <p className="text-[10px] text-gray-400 mt-0.5">{col.description}</p>
                        </div>
                        <span className="font-mono text-slate-500 text-[10px] whitespace-nowrap">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Query Studio & Lineage */}
            <div className="lg:col-span-2 space-y-6">
              {/* Data Lineage Visualizer */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  🧬 Consolidated Data Lineage (EIP Schema)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {lineage.map((node) => {
                    const nodeColors: Record<string, string> = {
                      raw_table: 'bg-blue-600/10 border-blue-500/30 text-blue-300',
                      semantic_view: 'bg-purple-600/10 border-purple-500/30 text-purple-300',
                      report: 'bg-emerald-600/10 border-emerald-500/30 text-emerald-300',
                      dashboard: 'bg-rose-600/10 border-rose-500/30 text-rose-300',
                    };
                    return (
                      <div
                        key={node.id}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                          nodeColors[node.type]
                        }`}
                      >
                        <span className="opacity-70">
                          {node.type === 'raw_table'
                            ? '💾'
                            : node.type === 'semantic_view'
                              ? '🔄'
                              : node.type === 'report'
                                ? '📊'
                                : '👑'}
                        </span>
                        <span>{node.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-3">
                  💡 Pipeline is fully automated. Raw operational tables from PostgreSQL replicate downstream in real-time to ClickHouse semantic view layers.
                </p>
              </div>

              {/* OLAP Query Studio */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  ⚡ ClickHouse OLAP Query Studio
                </h3>
                <div className="space-y-2">
                  <textarea
                    value={querySql}
                    onChange={(e) => setQuerySql(e.target.value)}
                    rows={4}
                    className="w-full font-mono text-sm px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-y"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Supports standard SQL SELECT statements.
                    </span>
                    <button
                      onClick={handleExecuteQuery}
                      disabled={executing || !querySql.trim()}
                      className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold text-sm transition-all"
                    >
                      {executing ? 'Executing Query...' : 'Execute SQL'}
                    </button>
                  </div>
                </div>

                {/* Query Result */}
                {queryResult && (
                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        Result:{' '}
                        {queryResult.success
                          ? `Success (${(queryResult.durationMs)}ms)`
                          : 'Failed'}
                      </span>
                      {queryResult.success && (
                        <span>Showing mock preview of {(queryResult.rowCount).toLocaleString()} total rows</span>
                      )}
                    </div>

                    {!queryResult.success && (
                      <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-300 font-mono">
                        {queryResult.error}
                      </div>
                    )}

                    {queryResult.success && queryResult.rows.length > 0 && (
                      <div className="overflow-x-auto border border-white/5 rounded-lg max-h-[300px]">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-white/5 font-mono text-[10px] text-cyan-300 uppercase border-b border-white/10">
                            <tr>
                              {queryResult.columns.map((col) => (
                                <th key={col} className="p-3 whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                            {queryResult.rows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-white/5">
                                {queryResult.columns.map((col) => (
                                  <td key={col} className="p-3 whitespace-nowrap">
                                    {String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
