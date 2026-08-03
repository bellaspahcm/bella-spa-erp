/**
 * Bella Auto - CEO Dashboard
 * Phase 15: Multi-level rollup analytics with drill-down
 */

'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

export interface OrgUnit {
  id: string;
  name: string;
  type: 'holding' | 'group' | 'country' | 'region' | 'branch' | 'journey';
  metrics: {
    revenue?: number;
    bookings?: number;
    leads?: number;
    conversion_rate?: number;
  };
  previousPeriodMetrics?: {
    revenue?: number;
    bookings?: number;
  };
  growthRates?: {
    revenue_growth?: number;
    bookings_growth?: number;
  };
  children?: OrgUnit[];
}

export interface CEODashboardProps {
  tenantId: string;
  periodType: 'month' | 'quarter' | 'year' | 'ytd';
  periodStart: string;
  periodEnd: string;
}

export function CEODashboard({
  tenantId,
  periodType,
  periodStart,
  periodEnd,
}: CEODashboardProps) {
  const [rootUnit, setRootUnit] = useState<OrgUnit | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRollupData();
  }, [tenantId, periodType, periodStart, periodEnd]);

  const fetchRollupData = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual RPC call
      // const { data } = await supabase.rpc('get_rollup_analytics', {
      //   p_tenant_id: tenantId,
      //   p_org_unit_id: rootUnitId,
      //   p_period_type: periodType,
      //   p_period_start: periodStart,
      //   p_period_end: periodEnd,
      //   p_include_children: true
      // });

      // Mock hierarchical data
      const mockData: OrgUnit = {
        id: 'holding-1',
        name: 'Bella Auto Holdings',
        type: 'holding',
        metrics: {
          revenue: 15000000000,
          bookings: 450,
          leads: 2500,
          conversion_rate: 18,
        },
        growthRates: {
          revenue_growth: 25.5,
          bookings_growth: 15.2,
        },
        children: [
          {
            id: 'group-1',
            name: 'Vietnam Group',
            type: 'group',
            metrics: {
              revenue: 15000000000,
              bookings: 450,
              leads: 2500,
            },
            growthRates: {
              revenue_growth: 25.5,
            },
            children: [
              {
                id: 'country-1',
                name: 'Vietnam',
                type: 'country',
                metrics: {
                  revenue: 15000000000,
                  bookings: 450,
                },
                children: [
                  {
                    id: 'region-1',
                    name: 'North Vietnam',
                    type: 'region',
                    metrics: {
                      revenue: 9000000000,
                      bookings: 270,
                    },
                    children: [
                      {
                        id: 'branch-1',
                        name: 'Hanoi Showroom',
                        type: 'branch',
                        metrics: {
                          revenue: 6000000000,
                          bookings: 180,
                        },
                      },
                      {
                        id: 'branch-2',
                        name: 'Hai Phong Showroom',
                        type: 'branch',
                        metrics: {
                          revenue: 3000000000,
                          bookings: 90,
                        },
                      },
                    ],
                  },
                  {
                    id: 'region-2',
                    name: 'South Vietnam',
                    type: 'region',
                    metrics: {
                      revenue: 6000000000,
                      bookings: 180,
                    },
                    children: [
                      {
                        id: 'branch-3',
                        name: 'Ho Chi Minh Showroom',
                        type: 'branch',
                        metrics: {
                          revenue: 4500000000,
                          bookings: 135,
                        },
                      },
                      {
                        id: 'branch-4',
                        name: 'Can Tho Showroom',
                        type: 'branch',
                        metrics: {
                          revenue: 1500000000,
                          bookings: 45,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      setRootUnit(mockData);
      setExpandedUnits(new Set(['holding-1'])); // Expand root by default
    } catch (error) {
      console.error('Failed to fetch rollup data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const renderGrowthIndicator = (growth?: number) => {
    if (!growth) return null;
    const isPositive = growth > 0;
    return (
      <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        {Math.abs(growth).toFixed(1)}%
      </span>
    );
  };

  const renderUnit = (unit: OrgUnit, depth: number = 0) => {
    const isExpanded = expandedUnits.has(unit.id);
    const hasChildren = unit.children && unit.children.length > 0;
    const indentClass = `pl-${depth * 8}`;

    return (
      <div key={unit.id}>
        <div
          className={`flex items-center gap-4 p-4 hover:bg-gray-50 border-b border-gray-200 ${indentClass}`}
          onClick={() => hasChildren && toggleExpand(unit.id)}
        >
          {/* Expand/Collapse */}
          <div className="w-6">
            {hasChildren && (
              <button className="text-gray-500 hover:text-gray-700">
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            )}
          </div>

          {/* Org Unit Name */}
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{unit.name}</div>
            <div className="text-xs text-gray-500 uppercase">{unit.type}</div>
          </div>

          {/* Revenue */}
          <div className="w-48 text-right">
            <div className="font-semibold">{formatCurrency(unit.metrics.revenue || 0)}</div>
            {renderGrowthIndicator(unit.growthRates?.revenue_growth)}
          </div>

          {/* Bookings */}
          <div className="w-32 text-right">
            <div className="font-semibold">{unit.metrics.bookings || 0}</div>
            {renderGrowthIndicator(unit.growthRates?.bookings_growth)}
          </div>

          {/* Leads (only for top levels) */}
          {unit.metrics.leads !== undefined && (
            <div className="w-32 text-right">
              <div className="font-semibold">{unit.metrics.leads}</div>
            </div>
          )}

          {/* Conversion Rate */}
          {unit.metrics.conversion_rate !== undefined && (
            <div className="w-32 text-right">
              <div className="font-semibold">{unit.metrics.conversion_rate}%</div>
            </div>
          )}
        </div>

        {/* Render Children */}
        {isExpanded && hasChildren && unit.children!.map((child) => renderUnit(child, depth + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Đang tải dữ liệu tổng hợp...</span>
      </div>
    );
  }

  if (!rootUnit) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
        <p className="text-gray-600">Không có dữ liệu</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">CEO Dashboard - Consolidated View</h2>
        <p className="text-sm text-gray-600 mt-1">
          Tổng hợp dữ liệu đa cấp từ Holding → Branch
        </p>
      </div>

      {/* Period Selector */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-blue-900">
              <strong>Kỳ:</strong> {periodType === 'month' && 'Tháng'}
              {periodType === 'quarter' && 'Quý'}
              {periodType === 'year' && 'Năm'}
              {periodType === 'ytd' && 'Year-to-Date'}
            </span>
            <span className="text-sm text-blue-700 ml-4">
              {periodStart} → {periodEnd}
            </span>
          </div>
        </div>
      </div>

      {/* Hierarchical Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center gap-4 p-4 bg-gray-100 border-b border-gray-300 font-semibold text-gray-700">
          <div className="w-6"></div>
          <div className="flex-1">Đơn vị</div>
          <div className="w-48 text-right">Doanh thu</div>
          <div className="w-32 text-right">Bookings</div>
          <div className="w-32 text-right">Leads</div>
          <div className="w-32 text-right">Tỷ lệ chuyển đổi</div>
        </div>

        {/* Data Rows */}
        {renderUnit(rootUnit)}
      </div>
    </div>
  );
}
