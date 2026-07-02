/**
 * Upsell Recommendation Engine
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Implements upsell recommendations using:
 * - Market Basket Analysis (Association Rules)
 * - Co-purchase patterns (Support, Confidence, Lift)
 * - Complementary item detection
 */

import { createClient } from '@/lib/supabase-server';
import type {
  UpsellRecommendationInput,
  UpsellRecommendationResult,
  UpsellRecommendationItem,
  RecommendationContext,
  CoPurchasedItem,
} from './types';
import { generateCacheKey, calculateDiversityScore } from './utils';

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

// Typed extension for Supabase client with missing RPCs
// Note: These RPCs exist in the database but are not in the generated types yet
interface SupabaseClientWithUpsellRPCs {
  rpc(
    fn: 'get_similar_transactions',
    args: {
      p_tenant_id: string;
      p_item_ids: string[];
      p_limit: number;
    }
  ): Promise<{
    data: Array<{ item_ids: string[]; item_type?: string; [key: string]: unknown }> | null;
    error: unknown | null;
  }>;
  rpc(
    fn: 'get_co_purchased_items',
    args: {
      p_tenant_id: string;
      p_item_id: string;
      p_item_type: string;
      p_limit: number;
    }
  ): Promise<{
    data: CoPurchasedItem[] | null;
    error: unknown | null;
  }>;
  rpc(
    fn: 'get_service_ratings',
    args: {
      p_tenant_id: string;
      p_service_ids: string[];
    }
  ): Promise<{
    data: Array<{ service_id: string; avg_rating: number; total_reviews: number }> | null;
    error: unknown | null;
  }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALGORITHM_VERSION = 'v1.0';
const DEFAULT_LIMIT = 3;
const MIN_SUPPORT = 0.01; // 1% of transactions
const MIN_CONFIDENCE = 0.3; // 30% confidence
const MIN_LIFT = 1.5; // 50% more likely than random
const MIN_CO_PURCHASES = 3; // At least 3 co-purchases

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

export async function getUpsellRecommendations(
  input: UpsellRecommendationInput
): Promise<UpsellRecommendationResult> {
  const supabase = await createClient();
  
  if (!input.currentItems || input.currentItems.length === 0) {
    throw new Error('Current items are required for upsell recommendations');
  }
  
  // Fetch customer context
  const context = await fetchCustomerContext(supabase, input.tenantId, input.customerId);
  
  // Determine algorithm (default to market_basket)
  const algorithm = input.algorithm || 'market_basket';
  
  let recommendations: UpsellRecommendationItem[];
  
  switch (algorithm) {
    case 'market_basket':
      recommendations = await marketBasketRecommendations(
        supabase,
        input,
        context
      );
      break;
    
    case 'collaborative_filtering':
      recommendations = await collaborativeUpsellRecommendations(
        supabase,
        input,
        context
      );
      break;
    
    case 'hybrid':
    default:
      recommendations = await hybridUpsellRecommendations(
        supabase,
        input,
        context
      );
      break;
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
    recommendations.map((r) => r.itemType)
  );
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
  
  // Get full item details for current items
  const currentItemsWithDetails = await fetchItemDetails(
    supabase,
    input.tenantId,
    input.currentItems
  );
  
  return {
    tenantId: input.tenantId,
    customerId: input.customerId,
    recommendationType: 'upsell',
    algorithmName: algorithm,
    algorithmVersion: ALGORITHM_VERSION,
    recommendations,
    relevanceScore: Math.round(relevanceScore * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    diversityScore: Math.round(diversityScore * 100) / 100,
    context,
    currentItems: currentItemsWithDetails,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// ============================================================================
// MARKET BASKET ANALYSIS
// ============================================================================

async function marketBasketRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: UpsellRecommendationInput,
  context: RecommendationContext
): Promise<UpsellRecommendationItem[]> {
  const recommendations: UpsellRecommendationItem[] = [];
  
  // For each current item, find co-purchased items
  for (const currentItem of input.currentItems) {
    const coPurchased = await findCoPurchasedItems(
      supabase,
      input.tenantId,
      currentItem.itemId,
      currentItem.itemType
    );
    
    for (const coItem of coPurchased) {
      // Skip if already in current items
      if (input.currentItems.some((ci) => ci.itemId === coItem.coItemId)) {
        continue;
      }
      
      // Skip if already recommended
      if (recommendations.some((r) => r.itemId === coItem.coItemId)) {
        continue;
      }
      
      // Apply thresholds
      if (
        coItem.support < MIN_SUPPORT ||
        coItem.confidence < MIN_CONFIDENCE ||
        coItem.lift < MIN_LIFT ||
        coItem.coPurchaseCount < MIN_CO_PURCHASES
      ) {
        continue;
      }
      
      // Fetch full item details
      const itemDetails = await fetchSingleItemDetails(
        supabase,
        input.tenantId,
        coItem.coItemId,
        coItem.coItemType
      );
      
      if (!itemDetails) continue;
      
      // Calculate score based on lift and confidence
      const score = (coItem.lift * 0.6 + coItem.confidence * 0.4);
      
      // Calculate confidence based on co-purchase count
      const confidence = Math.min(1.0, coItem.coPurchaseCount / 10);
      
      recommendations.push({
        itemId: coItem.coItemId,
        itemName: coItem.coItemName,
        itemType: coItem.coItemType,
        score: Math.round(score * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        reason: `Thường được mua cùng với ${currentItem.itemType === 'service' ? 'dịch vụ' : 'gói'} hiện tại`,
        reasoning: {
          primaryFactor: 'market_basket',
          factors: [
            { name: 'lift', weight: 0.6, contribution: coItem.lift * 0.6 },
            { name: 'confidence', weight: 0.4, contribution: coItem.confidence * 0.4 },
          ],
          coPurchaseRate: coItem.confidence,
          customerSegment: context.customerSegment,
        },
        metadata: {
          price: itemDetails.price,
          avgRating: itemDetails.avgRating,
          coPurchaseRate: Math.round(coItem.confidence * 100),
          avgRevenueIncrease: Math.round(itemDetails.price * coItem.confidence),
          acceptanceRate: coItem.confidence, // Use confidence as proxy
        },
        basketAnalysis: {
          support: coItem.support,
          confidence: coItem.confidence,
          lift: coItem.lift,
        },
      });
    }
  }
  
  // Sort by score (lift-based)
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// COLLABORATIVE FILTERING FOR UPSELL
// ============================================================================

async function collaborativeUpsellRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: UpsellRecommendationInput,
  context: RecommendationContext
): Promise<UpsellRecommendationItem[]> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithUpsellRPCs;
  
  // Find customers who purchased the same items
  const { data: similarTransactions } = await supabaseWithRPC.rpc(
    'get_similar_transactions',
    {
      p_tenant_id: input.tenantId,
      p_item_ids: input.currentItems.map((i) => i.itemId),
      p_limit: 50,
    }
  );
  
  if (!similarTransactions || similarTransactions.length === 0) {
    // Fallback to market basket
    return await marketBasketRecommendations(supabase, input, context);
  }
  
  // Count additional items purchased in similar transactions
  const itemCounts = new Map<string, {
    count: number;
    itemType: string;
    itemName: string;
  }>();
  
  for (const transaction of similarTransactions) {
    const additionalItems = transaction.item_ids.filter(
      (itemId: string) => !input.currentItems.some((ci) => ci.itemId === itemId)
    );
    
    for (const itemId of additionalItems) {
      if (!itemCounts.has(itemId)) {
        itemCounts.set(itemId, {
          count: 0,
          itemType: transaction.item_type || 'service',
          itemName: '',
        });
      }
      itemCounts.get(itemId)!.count++;
    }
  }
  
  // Build recommendations
  const recommendations: UpsellRecommendationItem[] = [];
  
  for (const [itemId, data] of itemCounts.entries()) {
    if (data.count < 2) continue; // At least 2 occurrences
    
    const itemDetails = await fetchSingleItemDetails(
      supabase,
      input.tenantId,
      itemId,
      data.itemType as 'service' | 'package'
    );
    
    if (!itemDetails) continue;
    
    const frequency = data.count / similarTransactions.length;
    const score = frequency;
    const confidence = Math.min(1.0, frequency * 1.5);
    
    recommendations.push({
      itemId,
      itemName: itemDetails.name,
      itemType: data.itemType as 'service' | 'package',
      score: Math.round(score * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      reason: `${data.count} khách hàng khác cũng mua thêm ${data.itemType === 'service' ? 'dịch vụ' : 'gói'} này`,
      reasoning: {
        primaryFactor: 'collaborative_filtering',
        factors: [
          { name: 'co_occurrence', weight: 1.0, contribution: frequency },
        ],
        similarCustomers: similarTransactions.length,
        customerSegment: context.customerSegment,
      },
      metadata: {
        price: itemDetails.price,
        avgRating: itemDetails.avgRating,
        coPurchaseRate: Math.round(frequency * 100),
        avgRevenueIncrease: Math.round(itemDetails.price * frequency),
        acceptanceRate: frequency,
      },
      basketAnalysis: {
        support: 0,
        confidence: frequency,
        lift: 0,
      },
    });
  }
  
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// HYBRID UPSELL RECOMMENDATIONS
// ============================================================================

async function hybridUpsellRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: UpsellRecommendationInput,
  context: RecommendationContext
): Promise<UpsellRecommendationItem[]> {
  // Combine market basket (70%) and collaborative (30%)
  const [mbRecs, cfRecs] = await Promise.all([
    marketBasketRecommendations(supabase, input, context),
    collaborativeUpsellRecommendations(supabase, input, context),
  ]);
  
  // Merge recommendations
  const mergedMap = new Map<string, UpsellRecommendationItem>();
  
  // Add market basket recommendations (70% weight)
  for (const rec of mbRecs) {
    mergedMap.set(rec.itemId, {
      ...rec,
      score: rec.score * 0.7,
      reasoning: {
        ...rec.reasoning,
        primaryFactor: 'hybrid',
      },
    });
  }
  
  // Add/merge collaborative recommendations (30% weight)
  for (const rec of cfRecs) {
    if (mergedMap.has(rec.itemId)) {
      const existing = mergedMap.get(rec.itemId)!;
      existing.score += rec.score * 0.3;
      existing.confidence = Math.max(existing.confidence, rec.confidence);
    } else {
      mergedMap.set(rec.itemId, {
        ...rec,
        score: rec.score * 0.3,
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
// HELPER FUNCTIONS
// ============================================================================

async function findCoPurchasedItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  itemId: string,
  itemType: 'service' | 'package'
): Promise<CoPurchasedItem[]> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithUpsellRPCs;
  
  const { data, error } = await supabaseWithRPC.rpc('get_co_purchased_items', {
    p_tenant_id: tenantId,
    p_item_id: itemId,
    p_item_type: itemType,
    p_limit: 20,
  });
  
  if (error || !data) {
    return [];
  }
  
  return data as CoPurchasedItem[];
}

async function fetchCustomerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<RecommendationContext> {
  // Note: View not in generated types yet, cast query builder to any
  const { data: segment } = await (supabase.from as (table: string) => any)('mv_customer_segments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .single();
  
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
      topCategories: [],
    },
  };
}

async function fetchItemDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  items: Array<{ itemId: string; itemType: 'service' | 'package' }>
): Promise<Array<{ itemId: string; itemName: string; itemType: 'service' | 'package' }>> {
  const result: Array<{ itemId: string; itemName: string; itemType: 'service' | 'package' }> = [];
  
  for (const item of items) {
    const details = await fetchSingleItemDetails(supabase, tenantId, item.itemId, item.itemType);
    if (details) {
      result.push({
        itemId: item.itemId,
        itemName: details.name,
        itemType: item.itemType,
      });
    }
  }
  
  return result;
}

async function fetchSingleItemDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  itemId: string,
  itemType: 'service' | 'package'
): Promise<{ name: string; price: number; avgRating: number } | null> {
  // Type extension helper for missing RPCs
  const supabaseWithRPC = supabase as Awaited<ReturnType<typeof createClient>> & SupabaseClientWithUpsellRPCs;
  
  if (itemType === 'service') {
    // Note: 'services' table exists but not in generated types yet, cast query builder
    const { data: service } = await (supabase.from as (table: string) => any)('services')
      .select('name, price')
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .eq('is_active', true)
      .single();
    
    if (!service) return null;
    
    // Get rating
    const { data: ratings } = await supabaseWithRPC.rpc('get_service_ratings', {
      p_tenant_id: tenantId,
      p_service_ids: [itemId],
    });
    
    const rating = ratings && ratings.length > 0 ? ratings[0] : null;
    
    return {
      name: service.name,
      price: Number(service.price) || 0,
      avgRating: rating ? Number(rating.avg_rating) : 0,
    };
  } else {
    // Package
    const { data: pkg } = await supabase
      .from('packages')
      .select('name, price')
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .eq('status', 'active')
      .single();
    
    if (!pkg) return null;
    
    // Get rating (from associated sessions)
    const { data: ratings } = await supabase
      .from('bookings')
      .select(`
        sessions!inner (
          reviews (overall_rating)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('package_id', itemId);
    
    let avgRating = 0;
    let totalRatings = 0;
    
    if (ratings) {
      for (const booking of ratings as any[]) {
        if (booking.sessions && booking.sessions.reviews) {
          for (const review of booking.sessions.reviews) {
            avgRating += review.overall_rating;
            totalRatings++;
          }
        }
      }
    }
    
    avgRating = totalRatings > 0 ? avgRating / totalRatings : 0;
    
    return {
      name: pkg.name,
      price: Number(pkg.price) || 0,
      avgRating: Math.round(avgRating * 100) / 100,
    };
  }
}
