'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  Zap,
  ShieldCheck,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface MetricsResponse {
  success: boolean;
  data: {
    assignment: {
      total_assignments: number;
      successful_assignments: number;
      success_rate_percent: number;
      avg_confidence: number;
      auto_assigned: number;
      manual_assigned: number;
      auto_assignment_rate_percent: number;
      avg_execution_time_ms: number;
      p95_execution_time_ms: number;
      p99_execution_time_ms: number;
    };
    conflict: {
      total_checks: number;
      conflicts_detected: number;
      conflict_rate_percent: number;
      blocking_conflicts: number;
      warning_conflicts: number;
      blocking_rate_percent: number;
      avg_execution_time_ms: number;
      top_conflict_types: Array<{
        type: string;
        count: number;
        percentage: number;
      }>;
    };
    capacity: {
      total_checks: number;
      capacity_available: number;
      capacity_full: number;
      capacity_full_rate_percent: number;
      avg_utilization_percent: number;
      avg_buffer_used_percent: number;
      avg_execution_time_ms: number;
    };
    performance: {
      total_operations: number;
      avg_execution_time_ms: number;
      median_execution_time_ms: number;
      p95_execution_time_ms: number;
      p99_execution_time_ms: number;
      max_execution_time_ms: number;
      by_provider: Record<
        string,
        {
          count: number;
          avg_ms: number;
          p95_ms: number;
        }
      >;
    };
    overrides: {
      capacity_checks_skipped: number;
      conflict_checks_skipped: number;
      assignments_skipped: number;
      total_overrides: number;
      override_rate_percent: number;
    };
    date_range: {
      start: string;
      end: string;
    };
  };
  meta: {
    tenantId: string;
    startDate: string;
    endDate: string;
    fetchedAt: string;
  };
}

type DateRange = '24h' | '7d' | '30d';

// ============================================================================
// Main Component
// ============================================================================

export default function BookingEngineDashboardPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  // ========================================
  // Fetch Metrics
  // ========================================
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      });

      const response = await fetch(`/api/admin/booking-engine/metrics?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch metrics');
      }

      const data: MetricsResponse = await response.json();
      setMetrics(data);
      setLastRefreshAt(new Date());
    } catch (err) {
      console.error('[BookingEngineDashboard] Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  // ========================================
  // Auto-refresh every 30 seconds
  // ========================================
  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!isAutoRefresh) return;

    const intervalId = setInterval(() => {
      void fetchMetrics();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [isAutoRefresh, fetchMetrics]);

  // ========================================
  // Render Error State
  // ========================================
  if (error && !metrics) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Booking Engine Dashboard</h1>
            <p className="text-muted-foreground mt-1">Real-time Decision Engine metrics</p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>

        <Button onClick={() => void fetchMetrics()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // ========================================
  // Render Loading State
  // ========================================
  if (isLoading && !metrics) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Booking Engine Dashboard</h1>
            <p className="text-muted-foreground mt-1">Real-time Decision Engine metrics</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ========================================
  // Main Render
  // ========================================
  const data = metrics?.data;
  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Booking Engine Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time Decision Engine metrics
            {lastRefreshAt && (
              <span className="ml-2 text-xs">
                • Last updated {lastRefreshAt.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex gap-1 border rounded-lg p-1">
            {(['24h', '7d', '30d'] as DateRange[]).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
              </Button>
            ))}
          </div>

          {/* Auto-refresh Toggle */}
          <Button
            variant={isAutoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <Zap className="h-4 w-4 mr-2" />
            Auto-refresh {isAutoRefresh ? 'ON' : 'OFF'}
          </Button>

          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchMetrics()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert (if refetch failed) */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Assignment Success Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Assignment Success
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.assignment.success_rate_percent || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.assignment.successful_assignments}/{data.assignment.total_assignments} successful
            </p>
          </CardContent>
        </Card>

        {/* Auto-Assignment Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Auto-Assignment Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.assignment.auto_assignment_rate_percent || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.assignment.auto_assigned} auto / {data.assignment.manual_assigned} manual
            </p>
          </CardContent>
        </Card>

        {/* Conflict Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Conflict Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.conflict.conflict_rate_percent || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.conflict.blocking_conflicts} blocking / {data.conflict.warning_conflicts} warnings
            </p>
          </CardContent>
        </Card>

        {/* Capacity Full Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Capacity Full
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.capacity.capacity_full_rate_percent || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.capacity.capacity_full}/{data.capacity.total_checks} times full
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Performance Breakdown
          </CardTitle>
          <CardDescription>
            Execution time across all providers (last {dateRange})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Average</div>
              <div className="text-2xl font-bold">{data.performance.avg_execution_time_ms}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Median</div>
              <div className="text-2xl font-bold">{data.performance.median_execution_time_ms}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">P95</div>
              <div className="text-2xl font-bold">{data.performance.p95_execution_time_ms}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">P99</div>
              <div className="text-2xl font-bold">{data.performance.p99_execution_time_ms}ms</div>
            </div>
          </div>

          {/* By Provider */}
          {data.performance.by_provider && (
            <div className="mt-6 space-y-3">
              <h4 className="font-semibold text-sm">By Provider</h4>
              <div className="space-y-2">
                {Object.entries(data.performance.by_provider).map(([provider, stats]) => (
                  <div key={provider} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="font-medium capitalize">
                        {provider.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.count} operations
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {stats.avg_ms}ms avg
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.p95_ms}ms p95
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Conflict Types */}
      {data.conflict.top_conflict_types && data.conflict.top_conflict_types.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Top Conflict Types
            </CardTitle>
            <CardDescription>Most common booking conflicts detected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.conflict.top_conflict_types.map((conflict, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index + 1}</Badge>
                    <div>
                      <div className="font-medium capitalize">
                        {conflict.type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {conflict.count} occurrences
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold">{conflict.percentage}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Manager Overrides
          </CardTitle>
          <CardDescription>
            Times providers were skipped via manual override
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Override Rate</div>
              <div className="text-2xl font-bold">{data.overrides.override_rate_percent || 0}%</div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Capacity Skipped</div>
                <div className="text-xl font-semibold">{data.overrides.capacity_checks_skipped}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Conflict Skipped</div>
                <div className="text-xl font-semibold">{data.overrides.conflict_checks_skipped}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Assignment Skipped</div>
                <div className="text-xl font-semibold">{data.overrides.assignments_skipped}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Assignment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Confidence</span>
              <span className="font-semibold">{data.assignment.avg_confidence || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Time</span>
              <span className="font-semibold">{data.assignment.avg_execution_time_ms}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">P95 Time</span>
              <span className="font-semibold">{data.assignment.p95_execution_time_ms}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">P99 Time</span>
              <span className="font-semibold">{data.assignment.p99_execution_time_ms}ms</span>
            </div>
          </CardContent>
        </Card>

        {/* Conflict Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conflict Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Checks</span>
              <span className="font-semibold">{data.conflict.total_checks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conflicts Found</span>
              <span className="font-semibold">{data.conflict.conflicts_detected}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blocking Rate</span>
              <span className="font-semibold">{data.conflict.blocking_rate_percent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Time</span>
              <span className="font-semibold">{data.conflict.avg_execution_time_ms}ms</span>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Utilization</span>
              <span className="font-semibold">{data.capacity.avg_utilization_percent || 'N/A'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Buffer Used</span>
              <span className="font-semibold">{data.capacity.avg_buffer_used_percent || 'N/A'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-semibold">{data.capacity.capacity_available}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Time</span>
              <span className="font-semibold">{data.capacity.avg_execution_time_ms}ms</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
