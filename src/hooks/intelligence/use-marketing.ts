/**
 * Marketing Intelligence API Hooks
 * 
 * React Query hooks for consuming Marketing Intelligence Layer APIs:
 * - Campaign performance analytics
 * - Marketing ROI calculations
 * - Ad spend optimization
 * - Channel effectiveness
 * 
 * CRITICAL: These hooks use React Query with properly configured staleTime 
 * matching backend TTL to prevent redundant API calls and respect cache-first strategy.
 * 
 * AGENTS.MD COMPLIANCE:
 * - Never use `any` type without proper type guards
 * - Cache-first strategy with appropriate TTL
 * - Tenant isolation at all layers
 * - IntelligenceResponse format for APIs
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Standard Intelligence Layer Response format
 */
interface IntelligenceResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  metadata: {
    computedAt: string
    cached: boolean
    cacheAge?: number
    executionTime?: number
  }
}

/**
 * Campaign Performance Metrics
 */
interface CampaignPerformance {
  campaignId: string
  campaignName: string
  channel: 'facebook' | 'google' | 'zalo' | 'tiktok' | 'sms' | 'email'
  startDate: string
  endDate: string
  budget: number
  spent: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  ctr: number // Click-through rate
  cpc: number // Cost per click
  cpa: number // Cost per acquisition
  roas: number // Return on ad spend
  roi: number // Return on investment
  performanceScore: number
}

/**
 * Marketing ROI Analysis
 */
interface MarketingROI {
  period: string
  totalSpent: number
  totalRevenue: number
  roi: number
  roas: number
  customerAcquisitionCost: number
  customerLifetimeValue: number
  breakdownByChannel: Array<{
    channel: string
    spent: number
    revenue: number
    roi: number
    conversions: number
  }>
}

/**
 * Ad Spend Optimization Recommendations
 */
interface AdSpendOptimization {
  channel: string
  currentSpend: number
  recommendedSpend: number
  expectedROI: number
  expectedRevenue: number
  confidenceScore: number
  reasoning: string
}

/**
 * Channel Effectiveness Metrics
 */
interface ChannelEffectiveness {
  channel: string
  totalCampaigns: number
  avgROI: number
  avgROAS: number
  avgCPA: number
  totalConversions: number
  totalRevenue: number
  effectivenessScore: number
  trend: 'up' | 'down' | 'stable'
}

// ============================================================================
// QUERY KEYS (for cache management)
// ============================================================================

export const marketingKeys = {
  all: ['intelligence', 'marketing'] as const,
  campaignPerformance: (startDate?: string, endDate?: string) => 
    [...marketingKeys.all, 'campaign-performance', startDate, endDate] as const,
  marketingROI: (month: string, year: string) => 
    [...marketingKeys.all, 'marketing-roi', month, year] as const,
  adSpendOptimization: (budget: number) => 
    [...marketingKeys.all, 'ad-spend-optimization', budget] as const,
  channelEffectiveness: (period: string) => 
    [...marketingKeys.all, 'channel-effectiveness', period] as const,
}

// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

async function fetchCampaignPerformance(
  startDate?: string,
  endDate?: string
): Promise<IntelligenceResponse<CampaignPerformance[]>> {
  let url = '/api/intelligence/marketing/campaign-performance'
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  if (params.toString()) url += `?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchMarketingROI(
  month: string,
  year: string
): Promise<IntelligenceResponse<MarketingROI>> {
  const response = await fetch(
    `/api/intelligence/marketing/roi?month=${month}&year=${year}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchAdSpendOptimization(
  budget: number
): Promise<IntelligenceResponse<AdSpendOptimization[]>> {
  const response = await fetch(
    `/api/intelligence/marketing/ad-spend-optimization?budget=${budget}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchChannelEffectiveness(
  period: string
): Promise<IntelligenceResponse<ChannelEffectiveness[]>> {
  const response = await fetch(
    `/api/intelligence/marketing/channel-effectiveness?period=${period}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook: Campaign Performance Analytics
 * 
 * Fetches performance metrics for all marketing campaigns in a date range.
 * 
 * Cache Strategy:
 * - staleTime: 6 hours (campaign data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @param options - React Query options
 */
export function useCampaignPerformance(
  startDate?: string,
  endDate?: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<CampaignPerformance[]>, Error> {
  return useQuery({
    queryKey: marketingKeys.campaignPerformance(startDate, endDate),
    queryFn: () => fetchCampaignPerformance(startDate, endDate),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 12 * 60 * 60 * 1000, // 12 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Marketing ROI Analysis
 * 
 * Fetches ROI analysis for all marketing activities in a month.
 * 
 * Cache Strategy:
 * - staleTime: 12 hours (ROI data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param month - Month string (e.g., '01', '12')
 * @param year - Year string (e.g., '2026')
 * @param options - React Query options
 */
export function useMarketingROI(
  month: string,
  year: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<MarketingROI>, Error> {
  return useQuery({
    queryKey: marketingKeys.marketingROI(month, year),
    queryFn: () => fetchMarketingROI(month, year),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Ad Spend Optimization
 * 
 * Fetches AI recommendations for optimal ad spend allocation across channels.
 * 
 * Cache Strategy:
 * - staleTime: 24 hours (optimization recommendations are strategic, change slowly)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param budget - Total marketing budget
 * @param options - React Query options
 */
export function useAdSpendOptimization(
  budget: number,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<AdSpendOptimization[]>, Error> {
  return useQuery({
    queryKey: marketingKeys.adSpendOptimization(budget),
    queryFn: () => fetchAdSpendOptimization(budget),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Channel Effectiveness
 * 
 * Fetches effectiveness metrics for all marketing channels (Facebook, Google, Zalo, etc.).
 * 
 * Cache Strategy:
 * - staleTime: 12 hours (channel effectiveness data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param period - Period for analysis (e.g., 'last_30_days', 'last_quarter')
 * @param options - React Query options
 */
export function useChannelEffectiveness(
  period: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<ChannelEffectiveness[]>, Error> {
  return useQuery({
    queryKey: marketingKeys.channelEffectiveness(period),
    queryFn: () => fetchChannelEffectiveness(period),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Fetch All Marketing Data in Parallel
 * 
 * Convenience hook to fetch all marketing intelligence data at once.
 * Uses React Query's parallel query execution for optimal performance.
 * 
 * @param params - Parameters for all queries
 */
export function useAllMarketingData(params: {
  campaignStartDate?: string
  campaignEndDate?: string
  roiMonth: string
  roiYear: string
  budget: number
  effectivenessPeriod: string
}) {
  const campaignPerformance = useCampaignPerformance(
    params.campaignStartDate,
    params.campaignEndDate
  )
  const marketingROI = useMarketingROI(params.roiMonth, params.roiYear)
  const adSpendOptimization = useAdSpendOptimization(params.budget)
  const channelEffectiveness = useChannelEffectiveness(params.effectivenessPeriod)

  return {
    campaignPerformance,
    marketingROI,
    adSpendOptimization,
    channelEffectiveness,
    isLoading: 
      campaignPerformance.isLoading || 
      marketingROI.isLoading || 
      adSpendOptimization.isLoading || 
      channelEffectiveness.isLoading,
    isError: 
      campaignPerformance.isError || 
      marketingROI.isError || 
      adSpendOptimization.isError || 
      channelEffectiveness.isError,
    errors: {
      campaignPerformance: campaignPerformance.error,
      marketingROI: marketingROI.error,
      adSpendOptimization: adSpendOptimization.error,
      channelEffectiveness: channelEffectiveness.error,
    },
  }
}

/**
 * Hook: Refresh Marketing Data Cache
 * 
 * Mutation to manually trigger cache invalidation and refetch for marketing data.
 * Useful for "Refresh" buttons in dashboards.
 * 
 * Usage:
 * ```tsx
 * const { mutate: refresh, isPending } = useRefreshMarketingData()
 * <button onClick={() => refresh('all')} disabled={isPending}>
 *   Làm mới
 * </button>
 * ```
 */
export function useRefreshMarketingData(): UseMutationResult<
  void,
  Error,
  'all' | 'campaign-performance' | 'marketing-roi' | 'ad-spend-optimization' | 'channel-effectiveness',
  unknown
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      target: 'all' | 'campaign-performance' | 'marketing-roi' | 'ad-spend-optimization' | 'channel-effectiveness'
    ) => {
      if (target === 'all') {
        await queryClient.invalidateQueries({ queryKey: marketingKeys.all })
      } else {
        await queryClient.invalidateQueries({ 
          queryKey: [...marketingKeys.all, target] 
        })
      }
    },
    onSuccess: () => {
      // Optional: Show toast notification
      console.log('[Marketing Intelligence] Cache invalidated, refetching...')
    },
  })
}

/**
 * Hook: Check Marketing Cache Status
 * 
 * Utility hook to check if marketing data is cached and fresh.
 * Useful for showing cache indicators in UI.
 * 
 * @returns Cache status for all marketing queries
 */
export function useMarketingCacheStatus() {
  const queryClient = useQueryClient()

  const getQueryCacheStatus = (queryKey: readonly unknown[]) => {
    const queryState = queryClient.getQueryState(queryKey)
    return {
      isCached: !!queryState,
      isFresh: queryState ? Date.now() - queryState.dataUpdatedAt < 6 * 60 * 60 * 1000 : false,
      lastUpdated: queryState?.dataUpdatedAt,
    }
  }

  return {
    campaignPerformance: (startDate?: string, endDate?: string) => 
      getQueryCacheStatus(marketingKeys.campaignPerformance(startDate, endDate)),
    marketingROI: (month: string, year: string) => 
      getQueryCacheStatus(marketingKeys.marketingROI(month, year)),
    adSpendOptimization: (budget: number) => 
      getQueryCacheStatus(marketingKeys.adSpendOptimization(budget)),
    channelEffectiveness: (period: string) => 
      getQueryCacheStatus(marketingKeys.channelEffectiveness(period)),
  }
}
