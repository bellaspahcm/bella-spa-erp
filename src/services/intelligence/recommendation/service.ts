/**
 * Recommendation Service - Unified Interface
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Provides a unified interface for all recommendation operations with caching
 */

import { createClient } from '@/lib/supabase-server';
import { getServiceRecommendations } from './service-recommendation';
import { getUpsellRecommendations } from './upsell-recommendation';
import { getPackageRecommendations } from './package-recommendation';
import { generateCacheKey } from './utils';
import type {
  ServiceRecommendationInput,
  UpsellRecommendationInput,
  PackageRecommendationInput,
  ServiceRecommendationResult,
  UpsellRecommendationResult,
  PackageRecommendationResult,
  RecommendationResponse,
  RecommendationCache,
} from './types';

interface RecommendationResultBase {
  algorithmName?: string;
  algorithmVersion?: string;
  relevanceScore?: number;
  confidenceScore?: number;
  diversityScore?: number;
  context?: unknown;
}

interface CacheRecordRow {
  relevance_score?: number | null;
  confidence_score?: number | null;
  hit_count?: number | null;
  recommendation_type?: string | null;
}


// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

// Typed extension for Supabase client with missing RPCs
// Note: These RPCs exist in the database but are not in the generated types yet
interface SupabaseClientWithCacheRPCs {
  rpc(
    fn: 'get_cached_recommendations',
    args: {
      p_tenant_id: string;
      p_cache_key: string;
    }
  ): Promise<{
    data: RecommendationCache | null;
    error: unknown | null;
  }>;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class RecommendationService {
  private static instance: RecommendationService;
  
  private constructor() {}
  
  public static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
  }
  
  // ==========================================================================
  // SERVICE RECOMMENDATIONS
  // ==========================================================================
  
  async getServiceRecommendations(
    input: ServiceRecommendationInput
  ): Promise<RecommendationResponse<ServiceRecommendationResult>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = generateCacheKey(
        input.tenantId,
        input.customerId,
        'service',
        { algorithm: input.algorithm, filters: input.filters }
      );
      
      const cached = await this.getCachedRecommendations<ServiceRecommendationResult>(
        input.tenantId,
        cacheKey
      );
      
      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            generatedAt: new Date().toISOString(),
            algorithmName: cached.algorithmName,
            algorithmVersion: cached.algorithmVersion,
            dataSource: 'cache',
            cacheExpiry: cached.expiresAt,
          },
        };
      }
      
      // Generate new recommendations
      const result = await getServiceRecommendations(input);
      
      // Cache the result
      await this.cacheRecommendations(
        input.tenantId,
        input.customerId,
        'service',
        cacheKey,
        result
      );
      
      const computationTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          generatedAt: new Date().toISOString(),
          algorithmName: result.algorithmName,
          algorithmVersion: result.algorithmVersion,
          dataSource: 'computation',
          computationTime,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        data: {} as ServiceRecommendationResult,
        meta: {
          generatedAt: new Date().toISOString(),
          algorithmName: input.algorithm || 'hybrid',
          algorithmVersion: 'v1.0',
          dataSource: 'computation',
          computationTime: Date.now() - startTime,
        },
        error: {
          code: 'RECOMMENDATION_ERROR',
          message: errorMessage || 'Failed to generate service recommendations',
          details: error instanceof Error ? error : new Error(String(error)),
        },
      };
    }
  }
  
  // ==========================================================================
  // UPSELL RECOMMENDATIONS
  // ==========================================================================
  
  async getUpsellRecommendations(
    input: UpsellRecommendationInput
  ): Promise<RecommendationResponse<UpsellRecommendationResult>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = generateCacheKey(
        input.tenantId,
        input.customerId,
        'upsell',
        { currentItems: input.currentItems, algorithm: input.algorithm }
      );
      
      const cached = await this.getCachedRecommendations<UpsellRecommendationResult>(
        input.tenantId,
        cacheKey
      );
      
      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            generatedAt: new Date().toISOString(),
            algorithmName: cached.algorithmName,
            algorithmVersion: cached.algorithmVersion,
            dataSource: 'cache',
            cacheExpiry: cached.expiresAt,
          },
        };
      }
      
      // Generate new recommendations
      const result = await getUpsellRecommendations(input);
      
      // Cache the result
      await this.cacheRecommendations(
        input.tenantId,
        input.customerId,
        'upsell',
        cacheKey,
        result
      );
      
      const computationTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          generatedAt: new Date().toISOString(),
          algorithmName: result.algorithmName,
          algorithmVersion: result.algorithmVersion,
          dataSource: 'computation',
          computationTime,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        data: {} as UpsellRecommendationResult,
        meta: {
          generatedAt: new Date().toISOString(),
          algorithmName: input.algorithm || 'market_basket',
          algorithmVersion: 'v1.0',
          dataSource: 'computation',
          computationTime: Date.now() - startTime,
        },
        error: {
          code: 'RECOMMENDATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate upsell recommendations',
          details: error,
        },
      };
    }
  }
  
  // ==========================================================================
  // PACKAGE RECOMMENDATIONS
  // ==========================================================================
  
  async getPackageRecommendations(
    input: PackageRecommendationInput
  ): Promise<RecommendationResponse<PackageRecommendationResult>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = generateCacheKey(
        input.tenantId,
        input.customerId,
        'package',
        { algorithm: input.algorithm, filters: input.filters }
      );
      
      const cached = await this.getCachedRecommendations<PackageRecommendationResult>(
        input.tenantId,
        cacheKey
      );
      
      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            generatedAt: new Date().toISOString(),
            algorithmName: cached.algorithmName,
            algorithmVersion: cached.algorithmVersion,
            dataSource: 'cache',
            cacheExpiry: cached.expiresAt,
          },
        };
      }
      
      // Generate new recommendations
      const result = await getPackageRecommendations(input);
      
      // Cache the result
      await this.cacheRecommendations(
        input.tenantId,
        input.customerId,
        'package',
        cacheKey,
        result
      );
      
      const computationTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          generatedAt: new Date().toISOString(),
          algorithmName: result.algorithmName,
          algorithmVersion: result.algorithmVersion,
          dataSource: 'computation',
          computationTime,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        data: {} as PackageRecommendationResult,
        meta: {
          generatedAt: new Date().toISOString(),
          algorithmName: input.algorithm || 'hybrid',
          algorithmVersion: 'v1.0',
          dataSource: 'computation',
          computationTime: Date.now() - startTime,
        },
        error: {
          code: 'RECOMMENDATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate package recommendations',
          details: error,
        },
      };
    }
  }
  
  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================
  
  private async getCachedRecommendations<T>(
    tenantId: string,
    cacheKey: string
  ): Promise<T | null> {
    const supabase = await createClient();
    const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithCacheRPCs;
    
    // Query recommendation_cache table
    const { data, error } = await supabaseWithRPC.rpc('get_cached_recommendations', {
      p_tenant_id: tenantId,
      p_cache_key: cacheKey,
    });
    
    if (error || !data) {
      return null;
    }
    
    return data as T;
  }
  
  private async cacheRecommendations<T>(
    tenantId: string,
    customerId: string,
    recommendationType: 'service' | 'upsell' | 'package',
    cacheKey: string,
    result: T
  ): Promise<void> {
    const supabase = await createClient();
    
    const expiresAt = new Date(Date.now() + CACHE_TTL).toISOString();
    const resultBase = result as unknown as RecommendationResultBase;
    
    const cacheRecord = {
      tenant_id: tenantId,
      recommendation_type: recommendationType,
      customer_id: customerId,
      algorithm_name: resultBase.algorithmName,
      algorithm_version: resultBase.algorithmVersion,
      recommendations: result,
      relevance_score: resultBase.relevanceScore,
      confidence_score: resultBase.confidenceScore,
      diversity_score: resultBase.diversityScore,
      context: resultBase.context,
      cache_key: cacheKey,
      expires_at: expiresAt,
    };
    
    const { error } = await supabase.from('recommendation_cache' as never)
      .upsert(cacheRecord as never, {
        onConflict: 'tenant_id,cache_key',
      });
    
    if (error) {
      console.error('Failed to cache recommendations:', error);
      // Non-critical error, don't throw
    }
  }
  
  async invalidateCache(
    tenantId: string,
    customerId?: string,
    recommendationType?: 'service' | 'upsell' | 'package'
  ): Promise<void> {
    const supabase = await createClient();
    
    let query = supabase.from('recommendation_cache' as never)
      .delete()
      .eq('tenant_id', tenantId);
    
    if (customerId) {
      query = query.eq('customer_id', customerId) as never;
    }
    
    if (recommendationType) {
      query = query.eq('recommendation_type', recommendationType) as never;
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }
  
  // ==========================================================================
  // ANALYTICS
  // ==========================================================================
  
  async getRecommendationAnalytics(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<unknown> {
    const supabase = await createClient();
    
    // Query recommendation cache for analytics
    const { data, error } = await supabase.from('recommendation_cache' as never)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    
    if (error || !data) {
      return null;
    }
    
    // Calculate metrics
    const totalRecommendations = (data as unknown[]).length;
    const typedData = data as unknown as CacheRecordRow[];
    const avgRelevance = typedData.reduce((sum: number, r: CacheRecordRow) => sum + (r.relevance_score || 0), 0) / totalRecommendations;
    const avgConfidence = typedData.reduce((sum: number, r: CacheRecordRow) => sum + (r.confidence_score || 0), 0) / totalRecommendations;
    const cacheHitRate = typedData.reduce((sum: number, r: CacheRecordRow) => sum + ((r.hit_count ?? 0) > 0 ? 1 : 0), 0) / totalRecommendations;
    
    const byType = {
      service: typedData.filter((r) => r.recommendation_type === 'service').length,
      upsell: typedData.filter((r) => r.recommendation_type === 'upsell').length,
      package: typedData.filter((r) => r.recommendation_type === 'package').length,
    };
    
    return {
      totalRecommendations,
      avgRelevanceScore: Math.round(avgRelevance * 100) / 100,
      avgConfidenceScore: Math.round(avgConfidence * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100),
      byType,
    };
  }
}

// Export singleton instance
export const recommendationService = RecommendationService.getInstance();
