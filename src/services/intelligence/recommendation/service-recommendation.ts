/**
 * Service Recommendation Engine
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Implements service recommendations using:
 * - Collaborative Filtering (user-based)
 * - Content-Based Filtering (RFM segment matching)
 * - Hybrid approach combining both
 */

import { createClient } from '@/lib/supabase-server';
import type {
  ServiceRecommendationInput,
  ServiceRecommendationResult,
  ServiceRecommendationItem,
  RecommendationContext,
  SimilarCustomer,
  CustomerItemInteraction,
} from './types';
import { calculateDiversityScore } from './utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ServiceRating {
  service_id: string;
  avg_rating: number;
  total_reviews: number;
}

// Typed extension for Supabase client with missing RPCs
// Note: These RPCs exist in the database but are not in the generated types yet
// For missing views, we cast entire supabase client since we cannot extend .from() without conflicts
interface SupabaseClientWithRPCs {
  rpc(
    fn: 'get_similar_customers',
    args: {
      p_tenant_id: string;
      p_customer_id: string;
      p_limit: number;
    }
  ): Promise<{
    data: SimilarCustomer[] | null;
    error: unknown | null;
  }>;
  rpc(
    fn: 'get_service_ratings',
    args: {
      p_tenant_id: string;
      p_service_ids: string[];
    }
  ): Promise<{
    data: ServiceRating[] | null;
    error: unknown | null;
  }>;
  rpc(
    fn: 'get_popular_services_by_segment',
    args: {
      p_tenant_id: string;
      p_segment: string;
      p_limit: number;
    }
  ): Promise<{
    data: PopularServiceBySegment[] | null;
    error: unknown | null;
  }>;
  rpc(
    fn: 'get_popular_services',
    args: {
      p_tenant_id: string;
      p_limit: number;
    }
  ): Promise<{
    data: PopularService[] | null;
    error: unknown | null;
  }>;
}

interface PopularServiceBySegment {
  service_id: string;
  service_name: string;
  price: number;
  duration: number;
  category: string;
  avg_rating: number;
  total_reviews: number;
  purchase_count: number;
}

interface PopularService {
  service_id: string;
  service_name: string;
  price: number;
  duration: number;
  category: string;
  avg_rating: number;
  total_reviews: number;
}

// Partial definition for missing 'services' table
// Note: Full table exists in database but not in generated types yet
interface ServiceRow {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string | null;
  is_active: boolean;
  tenant_id?: string;
  [key: string]: unknown; // Allow additional fields
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALGORITHM_VERSION = 'v1.0';
const DEFAULT_LIMIT = 5;
const MIN_SIMILAR_CUSTOMERS = 3;
const _MIN_COMMON_ITEMS = 2;
const _SIMILARITY_THRESHOLD = 0.3;

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

export async function getServiceRecommendations(
  input: ServiceRecommendationInput
): Promise<ServiceRecommendationResult> {
  const supabase = await createClient();
  
  // Fetch customer context
  const context = await fetchCustomerContext(supabase, input.tenantId, input.customerId);
  
  // Get customer's purchase history
  const customerInteractions = await fetchCustomerInteractions(
    supabase,
    input.tenantId,
    input.customerId
  );
  
  // Determine algorithm (default to hybrid)
  const algorithm = input.algorithm || 'hybrid';
  
  let recommendations: ServiceRecommendationItem[];
  
  switch (algorithm) {
    case 'collaborative_filtering':
      recommendations = await collaborativeFilteringRecommendations(
        supabase,
        input,
        customerInteractions,
        context
      );
      break;
    
    case 'content_based':
      recommendations = await contentBasedRecommendations(
        supabase,
        input,
        context
      );
      break;
    
    case 'rfm_based':
      recommendations = await rfmBasedRecommendations(
        supabase,
        input,
        context
      );
      break;
    
    case 'hybrid':
    default:
      recommendations = await hybridRecommendations(
        supabase,
        input,
        customerInteractions,
        context
      );
      break;
  }
  
  // Apply filters
  recommendations = applyFilters(recommendations, input.filters);
  
  // Exclude already purchased services
  const purchasedServiceIds = new Set(
    customerInteractions
      .filter((i) => i.itemType === 'service')
      .map((i) => i.itemId)
  );
  recommendations = recommendations.filter((r) => !purchasedServiceIds.has(r.itemId));
  
  // Exclude user-specified services
  if (input.excludeServices && input.excludeServices.length > 0) {
    const excludeSet = new Set(input.excludeServices);
    recommendations = recommendations.filter((r) => !excludeSet.has(r.itemId));
  }
  
  // Limit results
  recommendations = recommendations.slice(0, input.limit || DEFAULT_LIMIT);
  
  // Calculate overall metrics
  const relevanceScore = recommendations.length > 0
    ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
    : 0;
  
  const confidenceScore = recommendations.length > 0
    ? recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
    : 0;
  
  const diversityScore = calculateDiversityScore(
    recommendations.map((r) => r.metadata.category)
  );
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
  
  return {
    tenantId: input.tenantId,
    customerId: input.customerId,
    recommendationType: 'service',
    algorithmName: algorithm,
    algorithmVersion: ALGORITHM_VERSION,
    recommendations,
    relevanceScore: Math.round(relevanceScore * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    diversityScore: Math.round(diversityScore * 100) / 100,
    context,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// ============================================================================
// COLLABORATIVE FILTERING
// ============================================================================

async function collaborativeFilteringRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ServiceRecommendationInput,
  customerInteractions: CustomerItemInteraction[],
  context: RecommendationContext
): Promise<ServiceRecommendationItem[]> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithRPCs;
  
  // Find similar customers
  // Note: RPC not in generated types yet, using typed extension for RPC only
  const { data: similarCustomers, error } = await supabaseWithRPC.rpc('get_similar_customers', {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_limit: 20,
  });
  
  if (error || !similarCustomers || similarCustomers.length < MIN_SIMILAR_CUSTOMERS) {
    // Fall back to popular services if no similar customers found
    return await popularServicesRecommendations(supabase, input.tenantId, input.limit || DEFAULT_LIMIT);
  }
  
  const typedSimilarCustomers = similarCustomers as SimilarCustomer[];
  
  // Get services purchased by similar customers (that target customer hasn't purchased)
  const purchasedServiceIds = new Set(
    customerInteractions
      .filter((i) => i.itemType === 'service')
      .map((i) => i.itemId)
  );
  
  const candidateServices = new Map<string, {
    service: unknown;
    weightedScore: number;
    similaritySum: number;
    purchaseCount: number;
  }>();
  
  for (const similarCustomer of typedSimilarCustomers) {
    // Get services purchased by this similar customer
    // Note: View not in generated types yet, cast query builder to any but type-assert result
    const { data: rawInteractions } = await supabase.from('mv_customer_item_interactions' as never)
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('customer_id', similarCustomer.similarCustomerId)
      .eq('item_type', 'service')
      .gte('interaction_score', 0.5); // Only strong preferences
    
    const interactions = rawInteractions as unknown as CustomerItemInteraction[] | null;
    
    if (!interactions) continue;
    
    for (const interaction of interactions) {
      if (purchasedServiceIds.has(interaction.item_id)) continue;
      
      const key = interaction.item_id;
      if (!candidateServices.has(key)) {
        candidateServices.set(key, {
          service: interaction,
          weightedScore: 0,
          similaritySum: 0,
          purchaseCount: 0,
        });
      }
      
      const candidate = candidateServices.get(key)!;
      candidate.weightedScore += similarCustomer.similarityScore * interaction.interaction_score;
      candidate.similaritySum += similarCustomer.similarityScore;
      candidate.purchaseCount++;
    }
  }
  
  // Fetch full service details
  // Note: 'services' table exists but not in generated types yet, cast query builder
  const serviceIds = Array.from(candidateServices.keys());
  const { data: services } = await supabase.from('services' as never)
    .select('id, name, price, duration, category, is_active')
    .eq('tenant_id', input.tenantId)
    .in('id', serviceIds)
    .eq('is_active', true) as { data: ServiceRow[] | null };
  
  if (!services || services.length === 0) {
    return [];
  }
  
  // Get service ratings
  const { data: ratings } = await supabaseWithRPC.rpc('get_service_ratings', {
    p_tenant_id: input.tenantId,
    p_service_ids: serviceIds,
  });
  
  const ratingMap = new Map(
    (ratings || []).map((r: ServiceRating) => [r.service_id, { avg_rating: r.avg_rating, total_reviews: r.total_reviews }])
  );
  
  // Build recommendations
  const recommendations: ServiceRecommendationItem[] = services.map((service) => {
    const candidate = candidateServices.get(service.id)!;
    const rating = ratingMap.get(service.id);
    
    // Normalize score by similarity sum
    const normalizedScore = candidate.similaritySum > 0
      ? candidate.weightedScore / candidate.similaritySum
      : 0;
    
    // Confidence based on number of similar customers who purchased this
    const confidence = Math.min(
      1.0,
      (candidate.purchaseCount / typedSimilarCustomers.length) * 1.5
    );
    
    return {
      itemId: service.id,
      itemName: service.name,
      itemType: 'service',
      score: Math.round(normalizedScore * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      reason: `${candidate.purchaseCount} khách hàng tương tự đã sử dụng dịch vụ này`,
      reasoning: {
        primaryFactor: 'collaborative_filtering',
        factors: [
          { name: 'similarity', weight: 0.6, contribution: normalizedScore * 0.6 },
          { name: 'popularity', weight: 0.4, contribution: confidence * 0.4 },
        ],
        similarCustomers: candidate.purchaseCount,
        customerSegment: context.customerSegment,
      },
      metadata: {
        price: Number(service.price) || 0,
        duration: Number(service.duration) || 60,
        avgRating: rating ? Number(rating.avg_rating) : 0,
        totalReviews: rating ? Number(rating.total_reviews) : 0,
        popularity: Math.round((candidate.purchaseCount / typedSimilarCustomers.length) * 100),
        category: service.category || 'Uncategorized',
        availableKtvCount: 0, // Would need separate query
      },
      matchFactors: {
        similarCustomersPurchased: true,
        matchesPreferences: context.preferences?.favoriteServices?.includes(service.category || '') || false,
        complementaryToPrevious: false,
        trending: candidate.purchaseCount >= 3,
      },
    };
  });
  
  // Sort by score
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// CONTENT-BASED FILTERING
// ============================================================================

async function contentBasedRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ServiceRecommendationInput,
  context: RecommendationContext
): Promise<ServiceRecommendationItem[]> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithRPCs;
  
  // Recommend based on customer's favorite categories and price range
  const favoriteCategories = context.preferences?.favoriteServices || [];
  const priceRange = context.preferences?.priceRange || { min: 0, max: 10000000 };
  
  // Note: 'services' table exists but not in generated types yet, cast query builder
  let query = supabase.from('services' as never)
    .select('id, name, price, duration, category, is_active')
    .eq('tenant_id', input.tenantId)
    .eq('is_active', true)
    .gte('price', priceRange.min)
    .lte('price', priceRange.max)
    .limit(20);
  
  if (favoriteCategories.length > 0) {
    query = query.in('category', favoriteCategories);
  }
  
  const result = await query;
  const { data: services, error } = result as { data: ServiceRow[] | null; error: unknown };
  
  if (error || !services || services.length === 0) {
    return [];
  }
  
  // Get ratings
  const serviceIds = services.map((s) => s.id);
  const { data: ratings } = await supabaseWithRPC.rpc('get_service_ratings', {
    p_tenant_id: input.tenantId,
    p_service_ids: serviceIds,
  });
  
  const ratingMap = new Map(
    (ratings || []).map((r: ServiceRating) => [r.service_id, { avg_rating: r.avg_rating, total_reviews: r.total_reviews }])
  );
  
  // Build recommendations
  const recommendations: ServiceRecommendationItem[] = services.map((service) => {
    const rating = ratingMap.get(service.id);
    const matchesCategory = favoriteCategories.includes(service.category || '');
    const priceScore = 1 - (Math.abs(Number(service.price) - (priceRange.min + priceRange.max) / 2) / (priceRange.max - priceRange.min));
    
    const score = (matchesCategory ? 0.7 : 0.3) + (priceScore * 0.3);
    const confidence = rating && Number(rating.total_reviews) >= 5 ? 0.8 : 0.5;
    
    return {
      itemId: service.id,
      itemName: service.name,
      itemType: 'service',
      score: Math.round(score * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      reason: matchesCategory
        ? `Phù hợp với danh mục yêu thích của bạn: ${service.category}`
        : `Phù hợp với mức giá và sở thích của bạn`,
      reasoning: {
        primaryFactor: 'content_based',
        factors: [
          { name: 'category_match', weight: 0.7, contribution: matchesCategory ? 0.7 : 0 },
          { name: 'price_fit', weight: 0.3, contribution: priceScore * 0.3 },
        ],
        customerSegment: context.customerSegment,
      },
      metadata: {
        price: Number(service.price) || 0,
        duration: Number(service.duration) || 60,
        avgRating: rating ? Number(rating.avg_rating) : 0,
        totalReviews: rating ? Number(rating.total_reviews) : 0,
        popularity: 0,
        category: service.category || 'Uncategorized',
        availableKtvCount: 0,
      },
      matchFactors: {
        similarCustomersPurchased: false,
        matchesPreferences: matchesCategory,
        complementaryToPrevious: false,
        trending: false,
      },
    };
  });
  
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// RFM-BASED RECOMMENDATIONS
// ============================================================================

async function rfmBasedRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ServiceRecommendationInput,
  context: RecommendationContext
): Promise<ServiceRecommendationItem[]> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithRPCs;
  
  // Recommend services based on RFM segment
  const segment = context.customerSegment || 'Unknown';
  
  // Get popular services among customers in the same segment
  const { data: segmentServices } = await supabaseWithRPC.rpc('get_popular_services_by_segment', {
    p_tenant_id: input.tenantId,
    p_segment: segment,
    p_limit: 20,
  });
  
  if (!segmentServices || segmentServices.length === 0) {
    return await popularServicesRecommendations(supabase, input.tenantId, input.limit || DEFAULT_LIMIT);
  }
  
  // Build recommendations
  const recommendations: ServiceRecommendationItem[] = segmentServices.map((item: PopularServiceBySegment, index: number) => {
    const score = 1 - (index / segmentServices.length) * 0.5; // Decay score
    
    return {
      itemId: item.service_id,
      itemName: item.service_name,
      itemType: 'service',
      score: Math.round(score * 100) / 100,
      confidence: Math.round(Math.min(1, item.purchase_count / 10) * 100) / 100,
      reason: `Phổ biến trong nhóm khách hàng ${segment}`,
      reasoning: {
        primaryFactor: 'rfm_based',
        factors: [
          { name: 'segment_popularity', weight: 1.0, contribution: score },
        ],
        customerSegment: segment,
      },
      metadata: {
        price: Number(item.price) || 0,
        duration: Number(item.duration) || 60,
        avgRating: Number(item.avg_rating) || 0,
        totalReviews: Number(item.total_reviews) || 0,
        popularity: Math.round((item.purchase_count / 100) * 100), // Normalize to 0-100
        category: item.category || 'Uncategorized',
        availableKtvCount: 0,
      },
      matchFactors: {
        similarCustomersPurchased: true,
        matchesPreferences: false,
        complementaryToPrevious: false,
        trending: item.purchase_count >= 10,
      },
    };
  });
  
  return recommendations;
}

// ============================================================================
// HYBRID RECOMMENDATIONS
// ============================================================================

async function hybridRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ServiceRecommendationInput,
  customerInteractions: CustomerItemInteraction[],
  context: RecommendationContext
): Promise<ServiceRecommendationItem[]> {
  // Combine collaborative filtering (60%) and content-based (40%)
  const [cfRecs, cbRecs] = await Promise.all([
    collaborativeFilteringRecommendations(supabase, input, customerInteractions, context),
    contentBasedRecommendations(supabase, input, context),
  ]);
  
  // Merge and re-score
  const mergedMap = new Map<string, ServiceRecommendationItem>();
  
  // Add collaborative filtering recommendations (60% weight)
  for (const rec of cfRecs) {
    mergedMap.set(rec.itemId, {
      ...rec,
      score: rec.score * 0.6,
      reasoning: {
        ...rec.reasoning,
        primaryFactor: 'hybrid',
      },
    });
  }
  
  // Add/merge content-based recommendations (40% weight)
  for (const rec of cbRecs) {
    if (mergedMap.has(rec.itemId)) {
      const existing = mergedMap.get(rec.itemId)!;
      existing.score += rec.score * 0.4;
      existing.confidence = Math.max(existing.confidence, rec.confidence);
    } else {
      mergedMap.set(rec.itemId, {
        ...rec,
        score: rec.score * 0.4,
        reasoning: {
          ...rec.reasoning,
          primaryFactor: 'hybrid',
        },
      });
    }
  }
  
  const recommendations = Array.from(mergedMap.values());
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// FALLBACK: POPULAR SERVICES
// ============================================================================

async function popularServicesRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  limit: number
): Promise<ServiceRecommendationItem[]> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithRPCs;
  
  const { data: services } = await supabaseWithRPC.rpc('get_popular_services', {
    p_tenant_id: tenantId,
    p_limit: limit,
  });
  
  if (!services || services.length === 0) {
    return [];
  }
  
  return services.map((item: PopularService, index: number) => ({
    itemId: item.service_id,
    itemName: item.service_name,
    itemType: 'service' as const,
    score: 1 - (index / services.length) * 0.3,
    confidence: 0.7,
    reason: 'Dịch vụ phổ biến nhất',
    reasoning: {
      primaryFactor: 'popularity',
      factors: [{ name: 'popularity', weight: 1.0, contribution: 1.0 }],
    },
    metadata: {
      price: Number(item.price) || 0,
      duration: Number(item.duration) || 60,
      avgRating: Number(item.avg_rating) || 0,
      totalReviews: Number(item.total_reviews) || 0,
      popularity: 100 - index * 5,
      category: item.category || 'Uncategorized',
      availableKtvCount: 0,
    },
    matchFactors: {
      similarCustomersPurchased: false,
      matchesPreferences: false,
      complementaryToPrevious: false,
      trending: true,
    },
  }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchCustomerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<RecommendationContext> {
  // Fetch from mv_customer_segments
  // Note: View not in generated types yet, cast query builder to any but type-assert result
  interface CustomerSegmentRow {
    segment?: string | null;
    recency_score?: number | null;
    frequency_score?: number | null;
    monetary_score?: number | null;
    total_orders?: number | null;
    avg_order_value?: number | string | null;
    last_purchase_date?: string | null;
  }

  const { data: segment } = await supabase.from('mv_customer_segments' as never)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .single() as unknown as { data: CustomerSegmentRow | null };
  
  if (!segment) {
    return {};
  }
  
  return {
    customerSegment: segment.segment || 'Unknown',
    rfmScores: {
      recency: segment.recency_score,
      frequency: segment.frequency_score,
      monetary: segment.monetary_score,
    },
    purchaseHistory: {
      totalOrders: segment.total_orders,
      avgOrderValue: Number(segment.avg_order_value) || 0,
      lastPurchaseDate: segment.last_purchase_date,
      topCategories: [], // Would need separate query
    },
    churnRisk: undefined, // Would need separate query from churn forecast
  };
}

async function fetchCustomerInteractions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<CustomerItemInteraction[]> {
  // Note: View not in generated types yet, cast query builder to any but type-assert result
  const { data } = await supabase.from('mv_customer_item_interactions' as never)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);
  
  return (data || []) as CustomerItemInteraction[];
}

function applyFilters(
  recommendations: ServiceRecommendationItem[],
  filters?: ServiceRecommendationInput['filters']
): ServiceRecommendationItem[] {
  if (!filters) return recommendations;
  
  return recommendations.filter((rec) => {
    if (filters.minPrice && rec.metadata.price < filters.minPrice) return false;
    if (filters.maxPrice && rec.metadata.price > filters.maxPrice) return false;
    if (filters.category && rec.metadata.category !== filters.category) return false;
    if (filters.minRating && rec.metadata.avgRating < filters.minRating) return false;
    return true;
  });
}
