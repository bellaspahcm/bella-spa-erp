'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { verticalRegistry, OrganizationTreeProvider, OrganizationMetricProvider, OrganizationUnit, MetricDefinition, MetricValue } from '@/platform/registry/vertical-registry';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import { Building2, ChevronDown, ChevronRight, Search, Users, BarChart3, Target, Trophy, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Core Organization Engine Facade ───
class OrganizationEngine {
  constructor(
    private readonly treeProvider: OrganizationTreeProvider,
    private readonly metricProvider: OrganizationMetricProvider,
    private readonly tenantId: string
  ) {}

  getTerminology() {
    return this.treeProvider.getTerminology();
  }

  getMetrics(): MetricDefinition[] {
    return this.metricProvider.getMetrics();
  }

  async getRootNode(): Promise<OrganizationUnit> {
    return this.treeProvider.getRoot();
  }

  async getChildNodes(nodeId: string): Promise<OrganizationUnit[]> {
    return this.treeProvider.getChildren(nodeId);
  }

  async getNodeDetail(nodeId: string): Promise<OrganizationUnit | null> {
    return this.treeProvider.getNode(nodeId);
  }

  async getMetricsSummary(nodeId: string): Promise<MetricValue[]> {
    return this.treeProvider.getSummary(nodeId);
  }
}

// Helper formatting functions
function formatMetricValue(val: number, format: 'number' | 'currency' | 'percent') {
  if (format === 'currency') {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} tỷ`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} triệu`;
    return `${val.toLocaleString('vi-VN')} đ`;
  }
  if (format === 'percent') return `${val}%`;
  return val.toLocaleString('vi-VN');
}

export default function EIPOrganizationDashboardPage() {
  const [engine, setEngine] = useState<OrganizationEngine | null>(null);
  const [rootNode, setRootNode] = useState<OrganizationUnit | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrganizationUnit | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [loadedChildren, setLoadedChildren] = useState<Record<string, OrganizationUnit[]>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'ranking' | 'kpis'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize engine and load root company node
  useEffect(() => {
    async function initEngine() {
      try {
        setIsLoading(true);
        const settings = await getCachedTenantSettings();
        if (!settings) {
          throw new Error('Không thể tải cấu hình tenant.');
        }

        const brand = resolveTenantBrandIdentity({
          enabledModules: settings.enabled_modules,
          tenantName: settings.name,
        });

        const manifest = verticalRegistry.get(brand.moduleKey);
        if (!manifest || !manifest.enabledCapabilities.includes('organization_center') || !manifest.providers?.organization) {
          setErrorMsg('Phân hệ của bạn chưa được kích hoạt tính năng Sơ đồ tổ chức (organization_center).');
          setIsLoading(false);
          return;
        }

        const ctx = {
          tenantId: settings.id,
          locale: 'vi-VN',
          timezone: 'Asia/Ho_Chi_Minh',
        };

        const treeProvider = manifest.providers.organization.tree(ctx);
        const metricProvider = manifest.providers.organization.metric(ctx);

        const newEngine = new OrganizationEngine(treeProvider, metricProvider, settings.id);
        setEngine(newEngine);

        const root = await newEngine.getRootNode();
        setRootNode(root);
        setSelectedNode(root);
        setExpandedNodes({ [root.id]: true });

        // Eager load root children
        if (root.hasChildren) {
          const children = await newEngine.getChildNodes(root.id);
          setLoadedChildren(prev => ({ ...prev, [root.id]: children }));
        }
      } catch (err: unknown) {
        console.error('[OrganizationCenter] Init error:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Hệ thống gặp sự cố khi khởi tạo sơ đồ tổ chức.');
      } finally {
        setIsLoading(false);
      }
    }

    initEngine();
  }, []);

  // Expand node and lazily fetch children
  const handleToggleExpand = useCallback(async (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!engine) return;

    const isExpanded = !!expandedNodes[nodeId];
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !isExpanded }));

    // Fetch children if not already loaded
    if (!isExpanded && !loadedChildren[nodeId]) {
      try {
        const children = await engine.getChildNodes(nodeId);
        setLoadedChildren(prev => ({ ...prev, [nodeId]: children }));
      } catch (err) {
        console.error(`[OrganizationCenter] Failed to load children for ${nodeId}:`, err);
      }
    }
  }, [engine, expandedNodes, loadedChildren]);

  const handleSelectNode = useCallback(async (node: OrganizationUnit) => {
    setSelectedNode(node);
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="md:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-6 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Tính Năng Chưa Kích Hoạt</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
            <div className="pt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Chế độ vận hành opt-in của Bella EIP đảm bảo bảo mật và zero-regression.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!engine || !rootNode || !selectedNode) return null;

  const terminology = engine.getTerminology();
  const metricsList = engine.getMetrics();

  // Helper to format kind labels dynamically based on vertical presets
  const getKindLabel = (kind: string) => {
    if (kind === 'company') return terminology.root;
    if (kind === 'branch') return terminology.level1;
    if (kind === 'team') return terminology.level2;
    if (kind === 'member') return terminology.member;
    return kind;
  };

  // Build recursive JSX organization tree view
  const renderTreeNode = (node: OrganizationUnit, depth = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedNode.id === node.id;
    const children = loadedChildren[node.id] || [];
    const hasChildren = node.hasChildren;

    return (
      <div key={node.id} className="space-y-1">
        <div 
          onClick={() => handleSelectNode(node)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all border text-sm group",
            isSelected 
              ? "bg-[#1E3A8A]/10 text-[#1E3A8A] border-[#1E3A8A]/30 dark:bg-amber-500/10 dark:text-[#C8A97A] dark:border-amber-500/30"
              : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
          )}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => handleToggleExpand(node.id, e)}
              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:scale-105 transition-transform">
            <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-[#C8A97A]" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{node.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
              {getKindLabel(node.kind)}
            </p>
          </div>
        </div>

        {hasChildren && isExpanded && children.length > 0 && (
          <div className="relative">
            {/* Soft vertical hierarchy line */}
            <div 
              className="absolute left-4 top-0 bottom-2 w-px bg-slate-200 dark:bg-slate-800"
              style={{ left: `${Math.max(20, depth * 16 + 10)}px` }}
            />
            <div className="space-y-1">
              {children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Collect flat members lists for selected node
  const collectFlatMembers = (node: OrganizationUnit): OrganizationUnit[] => {
    const list: OrganizationUnit[] = [];
    if (node.kind === 'member') list.push(node);
    const children = loadedChildren[node.id] || [];
    children.forEach(child => {
      list.push(...collectFlatMembers(child));
    });
    return list;
  };

  const flatMembers = collectFlatMembers(selectedNode);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1 min-h-full">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A8A]/10 dark:bg-amber-500/10 text-[#1E3A8A] dark:text-[#C8A97A] rounded-2xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Sơ Đồ Tổ Chức
              <span className="text-[10px] bg-[#1E3A8A]/10 dark:bg-amber-500/10 text-[#1E3A8A] dark:text-[#C8A97A] px-2 py-0.5 rounded-full uppercase font-black tracking-wider">
                EIP Framework
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản trị và phân tích kết quả kinh doanh đa phân khu theo mô hình Lazy-Loading.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Tree Panel */}
        <div className="bg-white/70 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 backdrop-blur-md space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm phòng ban, sale..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1E3A8A] dark:focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[500px]">
            {renderTreeNode(rootNode)}
          </div>
        </div>

        {/* Right Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selected node card summary */}
          <div className="bg-gradient-to-br from-[#1E3A8A]/10 to-slate-50 dark:from-slate-900 dark:to-slate-950/80 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md uppercase font-bold tracking-wider">
                  {getKindLabel(selectedNode.kind)}
                </span>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-2">{selectedNode.name}</h2>
                {selectedNode.managerName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Quản lý bộ phận: <span className="font-bold">{selectedNode.managerName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Dynamic Metric Widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              {metricsList.map(metric => {
                const nodeMetric = selectedNode.metricValues.find(mv => mv.metricId === metric.id);
                const rawVal = nodeMetric ? nodeMetric.value : 0;
                return (
                  <div key={metric.id} className="bg-white/60 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/30 dark:border-slate-800/30 space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      {metric.label}
                    </span>
                    <p className="text-base font-bold text-slate-800 dark:text-white">
                      {formatMetricValue(rawVal, metric.format)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Tabs Section */}
          <div className="bg-white/70 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 backdrop-blur-md space-y-6">
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
              <button 
                onClick={() => setActiveTab('overview')}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                  activeTab === 'overview'
                    ? "border-[#1E3A8A] text-[#1E3A8A] dark:border-amber-500 dark:text-[#C8A97A]"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Tổng Quan
              </button>
              <button 
                onClick={() => setActiveTab('members')}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                  activeTab === 'members'
                    ? "border-[#1E3A8A] text-[#1E3A8A] dark:border-amber-500 dark:text-[#C8A97A]"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Nhân Sự ({flatMembers.length})
              </button>
              <button 
                onClick={() => setActiveTab('kpis')}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                  activeTab === 'kpis'
                    ? "border-[#1E3A8A] text-[#1E3A8A] dark:border-amber-500 dark:text-[#C8A97A]"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Target className="w-3.5 h-3.5" />
                Chỉ Tiêu KPI
              </button>
              <button 
                onClick={() => setActiveTab('ranking')}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                  activeTab === 'ranking'
                    ? "border-[#1E3A8A] text-[#1E3A8A] dark:border-amber-500 dark:text-[#C8A97A]"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Trophy className="w-3.5 h-3.5" />
                Vinh Danh
              </button>
            </div>

            {/* Overview Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
                  <Info className="w-4.5 h-4.5 text-[#1E3A8A] dark:text-[#C8A97A] shrink-0 mt-0.5" />
                  <p>
                    Thông tin hiệu suất kinh doanh phía trên được tổng hợp thời gian thực từ cơ cấu tổ chức bên trái. Khi nhấn chọn từng đơn vị hoặc nhân sự, toàn bộ báo cáo sẽ tự động drill-down để hiển thị tương ứng.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {metricsList.map(metric => {
                    const nodeMetric = selectedNode.metricValues.find(mv => mv.metricId === metric.id);
                    const val = nodeMetric ? nodeMetric.value : 0;
                    const maxVal = metric.id === 'leads' ? 2000 : metric.id === 'revenue' ? 200000000000 : 250;
                    const percentage = Math.min(100, Math.round((val / maxVal) * 100));

                    return (
                      <div key={metric.id} className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-xl border border-slate-200/30 dark:border-slate-800/30 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{metric.label}</span>
                          <span className="font-extrabold text-[#1E3A8A] dark:text-[#C8A97A]">{formatMetricValue(val, metric.format)}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#1E3A8A] dark:bg-amber-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Mức tối thiểu: 0</span>
                          <span>Mục tiêu: {formatMetricValue(maxVal, metric.format)} ({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Members Tab Content */}
            {activeTab === 'members' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-4">Tên Nhân Sự</th>
                      <th className="py-3 px-4">Chức Danh</th>
                      <th className="py-3 px-4 text-right">Lead Cấp</th>
                      <th className="py-3 px-4 text-right">Cọc Căn</th>
                      <th className="py-3 px-4 text-right">Ký HĐMB</th>
                      <th className="py-3 px-4 text-right">Doanh Số</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {flatMembers.length > 0 ? (
                      flatMembers.map(member => {
                        const leads = member.metricValues.find(mv => mv.metricId === 'leads')?.value || 0;
                        const bookings = member.metricValues.find(mv => mv.metricId === 'bookings')?.value || 0;
                        const sales = member.metricValues.find(mv => mv.metricId === 'sales')?.value || 0;
                        const revenue = member.metricValues.find(mv => mv.metricId === 'revenue')?.value || 0;

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{member.name}</td>
                            <td className="py-3.5 px-4 text-slate-400 uppercase tracking-widest text-[9px] font-extrabold">
                              {getKindLabel(member.kind)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium">{leads}</td>
                            <td className="py-3.5 px-4 text-right font-medium">{bookings}</td>
                            <td className="py-3.5 px-4 text-right font-medium">{sales}</td>
                            <td className="py-3.5 px-4 text-right text-[#1E3A8A] dark:text-[#C8A97A] font-bold">
                              {formatMetricValue(revenue, 'currency')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Không có nhân sự trực thuộc phòng ban này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* KPIs Tab Content */}
            {activeTab === 'kpis' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Theo Dõi Hiệu Quả Chỉ Tiêu (KPIs)</h3>
                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {metricsList.filter(m => m.id !== 'conversion').map(metric => {
                    const nodeMetric = selectedNode.metricValues.find(mv => mv.metricId === metric.id);
                    const val = nodeMetric ? nodeMetric.value : 0;
                    const targetVal = metric.id === 'leads' ? 1000 : metric.id === 'revenue' ? 100000000000 : 100;
                    const progress = Math.min(100, Math.round((val / targetVal) * 100));

                    return (
                      <div key={metric.id} className="pt-4 first:pt-0 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-white">{metric.label}</p>
                            <p className="text-[10px] text-slate-400">{metric.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-[#1E3A8A] dark:text-[#C8A97A]">
                              {formatMetricValue(val, metric.format)}
                            </span>
                            <span className="text-slate-400"> / {formatMetricValue(targetVal, metric.format)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              progress >= 100 ? "bg-emerald-500" : progress >= 50 ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ranking Tab Content */}
            {activeTab === 'ranking' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Bảng Xếp Hạng Doanh Số Nhân Sự</h3>
                <div className="space-y-2">
                  {flatMembers.length > 0 ? (
                    flatMembers
                      .map(m => ({
                        node: m,
                        revenue: m.metricValues.find(mv => mv.metricId === 'revenue')?.value || 0
                      }))
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((item, index) => (
                        <div key={item.node.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-200/35 dark:border-slate-800/35 hover:scale-[1.005] transition-all">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                              index === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                              index === 1 ? "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400" :
                              index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" :
                              "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            )}>
                              {index + 1}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white text-xs">{item.node.name}</span>
                          </div>
                          <span className="font-extrabold text-xs text-[#1E3A8A] dark:text-[#C8A97A]">
                            {formatMetricValue(item.revenue, 'currency')}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-6">Không có nhân sự trực thuộc.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
