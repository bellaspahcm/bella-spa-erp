/**
 * Package Recommendation Engine
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Implements package recommendations using:
 * - Best-fit package based on customer preferences
 * - Budget optimization (best value for money)
 * - RFM segment matching
 */

import { createClient } from '@/lib/supabase-server';
import type {
  PackageRecommendationInput,
  PackageRecommendationResult,
  PackageRecommendationItem,
  RecommendationContext,
} from './types';
import { calculateDiversityScore, getRfmWeight } from './utils';

interface PopularPackageRow {
  package_id: string;
  purchase_count: number;
}

interface PackageServiceRow {
  service_id: string;
  quantity: number;
  services: { name: string; price: number } | null;
}

interface BookingRow {
  sessions: {
    reviews: { overall_rating: number }[];
  } | null;
}

interface SegmentBookingRow {
  customer_id: string;
  mv_customer_segments: { segment: string | null } | null;
}

interface FitScore {
  overall: number;
  budgetFit: number;
  preferenceFit: number;
  valueFit: number;
  similarCustomerAdoption: number;
}

interface PackageRow {
  id: string;
  name: string;
  price: number;
  total_sessions: number;
}

interface ServiceItem {
  price: number;
  quantity: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALGORITHM_VERSION = 'v1.0';
const DEFAULT_LIMIT = 3;

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

export async function getPackageRecommendations(
  input: PackageRecommendationInput
): Promise<PackageRecommendationResult> {
  const supabase = await createClient();
  
  // Fetch customer context
  const context = await fetchCustomerContext(supabase, input.tenantId, input.customerId);
  
  // Get customer's favorite services
  const favoriteServices = await fetchFavoriteServices(
    supabase,
    input.tenantId,
    input.customerId
  );
  
  // Fetch all active packages
  let query = supabase
    .from('packages')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('status', 'active');
  
  // Apply filters
  if (input.filters?.minPrice) {
    query = query.gte('price', input.filters.minPrice);
  }
  if (input.filters?.maxPrice) {
    query = query.lte('price', input.filters.maxPrice);
  }
  if (input.filters?.minSessions) {
    query = query.gte('total_sessions', input.filters.minSessions);
  }
  if (input.filters?.maxSessions) {
    query = query.lte('total_sessions', input.filters.maxSessions);
  }
  
  const { data: packages, error } = await query;
  
  if (error || !packages || packages.length === 0) {
    throw new Error('No packages found matching criteria');
  }
  
  // Get package details (services, ratings)
  const packageDetails = await Promise.all(
    packages.map((pkg) => enrichPackageDetails(supabase, input.tenantId, pkg))
  );
  
  // Determine algorithm (default to hybrid)
  const algorithm = input.algorithm || 'hybrid';
  
  let recommendations: PackageRecommendationItem[];
  
  switch (algorithm) {
    case 'content_based':
      recommendations = contentBasedPackageRecommendations(
        packageDetails,
        favoriteServices,
        context
      );
      break;
    
    case 'rfm_based':
      recommendations = rfmBasedPackageRecommendations(
        packageDetails,
        context
      );
      break;
    
    case 'collaborative_filtering':
      recommendations = await collaborativePackageRecommendations(
        supabase,
        input.tenantId,
        packageDetails,
        context
      );
      break;
    
    case 'hybrid':
    default:
      recommendations = await hybridPackageRecommendations(
        supabase,
        input.tenantId,
        packageDetails,
        favoriteServices,
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
    recommendations.flatMap((r) => r.metadata.includedServices.map((s) => s.serviceName))
  );
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
  
  return {
    tenantId: input.tenantId,
    customerId: input.customerId,
    recommendationType: 'package',
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
// CONTENT-BASED PACKAGE RECOMMENDATIONS
// ============================================================================

function contentBasedPackageRecommendations(
  packages: EnrichedPackage[],
  favoriteServices: Set<string>,
  context: RecommendationContext
): PackageRecommendationItem[] {
  const recommendations: PackageRecommendationItem[] = [];
  
  for (const pkg of packages) {
    // Calculate preference fit (how many favorite services are in this package)
    const matchingServices = pkg.services.filter((s) => favoriteServices.has(s.serviceId));
    const preferenceFit = pkg.services.length > 0
      ? matchingServices.length / pkg.services.length
      : 0;
    
    // Calculate budget fit based on customer's avg order value
    const avgOrderValue = context.purchaseHistory?.avgOrderValue || pkg.price;
    const budgetFit = 1 - Math.abs(pkg.price - avgOrderValue) / Math.max(pkg.price, avgOrderValue);
    
    // Calculate value fit (price per session vs. individual service prices)
    const pricePerSession = pkg.totalSessions > 0 ? pkg.price / pkg.totalSessions : pkg.price;
    const individualServicePrice = pkg.services.reduce((sum, s) => sum + s.price, 0) / pkg.services.length;
    const valueFit = individualServicePrice > 0
      ? Math.min(1, (individualServicePrice - pricePerSession) / individualServicePrice)
      : 0.5;
    
    // Overall score
    const score = (preferenceFit * 0.5 + budgetFit * 0.3 + valueFit * 0.2);
    
    const fitScore: FitScore = {
      overall: Math.round(score * 100) / 100,
      budgetFit: Math.round(budgetFit * 100) / 100,
      preferenceFit: Math.round(preferenceFit * 100) / 100,
      valueFit: Math.round(valueFit * 100) / 100,
      similarCustomerAdoption: 0,
    };
    
    recommendations.push(
      buildPackageRecommendation(pkg, score, 0.7, fitScore, context, 'content_based')
    );
  }
  
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// RFM-BASED PACKAGE RECOMMENDATIONS
// ============================================================================

function rfmBasedPackageRecommendations(
  packages: EnrichedPackage[],
  context: RecommendationContext
): PackageRecommendationItem[] {
  const recommendations: PackageRecommendationItem[] = [];
  const segment = context.customerSegment || 'Unknown';
  const segmentWeight = getRfmWeight(segment);
  
  for (const pkg of packages) {
    // Score based on segment popularity
    const segmentAdoption = pkg.segmentPurchases.get(segment) || 0;
    const totalPurchases = Array.from(pkg.segmentPurchases.values()).reduce((sum, v) => sum + v, 0);
    const segmentPopularity = totalPurchases > 0 ? segmentAdoption / totalPurchases : 0;
    
    // Calculate budget alignment
    const avgOrderValue = context.purchaseHistory?.avgOrderValue || pkg.price;
    const budgetFit = 1 - Math.abs(pkg.price - avgOrderValue) / Math.max(pkg.price, avgOrderValue);
    
    // Overall score
    const score = (segmentPopularity * 0.6 + budgetFit * 0.4) * segmentWeight;
    
    const fitScore: FitScore = {
      overall: Math.round(score * 100) / 100,
      budgetFit: Math.round(budgetFit * 100) / 100,
      preferenceFit: 0,
      valueFit: 0,
      similarCustomerAdoption: Math.round(segmentPopularity * 100) / 100,
    };
    
    recommendations.push(
      buildPackageRecommendation(pkg, score, 0.6, fitScore, context, 'rfm_based')
    );
  }
  
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// COLLABORATIVE FILTERING PACKAGE RECOMMENDATIONS
// ============================================================================

async function collaborativePackageRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  packages: EnrichedPackage[],
  context: RecommendationContext
): Promise<PackageRecommendationItem[]> {
  const recommendations: PackageRecommendationItem[] = [];
  const segment = context.customerSegment || 'Unknown';
  
  // Get popular packages in segment
  const { data: popularPackages } = await (supabase as any).rpc('get_popular_packages_by_segment', {
    p_tenant_id: tenantId,
    p_segment: segment,
    p_limit: 20,
  }) as { data: PopularPackageRow[] | null, error: any };
  
  if (!popularPackages || popularPackages.length === 0) {
    // Fallback to content-based
    return [];
  }
  
  const popularityMap = new Map<string, { purchaseCount: number; rank: number }>(
    popularPackages.map((p, index: number) => [
      p.package_id,
      { purchaseCount: p.purchase_count, rank: index },
    ])
  );
  
  for (const pkg of packages) {
    const popularity = popularityMap.get(pkg.id);
    if (!popularity) continue;
    
    // Score based on popularity rank
    const score = 1 - (popularity.rank / popularPackages.length) * 0.5;
    const confidence = Math.min(1.0, popularity.purchaseCount / 20);
    
    const fitScore: FitScore = {
      overall: Math.round(score * 100) / 100,
      budgetFit: 0,
      preferenceFit: 0,
      valueFit: 0,
      similarCustomerAdoption: Math.round(confidence * 100) / 100,
    };
    
    recommendations.push(
      buildPackageRecommendation(pkg, score, confidence, fitScore, context, 'collaborative_filtering')
    );
  }
  
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// ============================================================================
// HYBRID PACKAGE RECOMMENDATIONS
// ============================================================================

async function hybridPackageRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  packages: EnrichedPackage[],
  favoriteServices: Set<string>,
  context: RecommendationContext
): Promise<PackageRecommendationItem[]> {
  // Combine content-based (50%), RFM (30%), collaborative (20%)
  const cbRecs = contentBasedPackageRecommendations(packages, favoriteServices, context);
  const rfmRecs = rfmBasedPackageRecommendations(packages, context);
  const cfRecs = await collaborativePackageRecommendations(supabase, tenantId, packages, context);
  
  // Merge recommendations
  const mergedMap = new Map<string, PackageRecommendationItem>();
  
  // Content-based (50%)
  for (const rec of cbRecs) {
    mergedMap.set(rec.itemId, {
      ...rec,
      score: rec.score * 0.5,
      fitScore: {
        ...rec.fitScore,
        overall: rec.fitScore.overall * 0.5,
      },
      reasoning: {
        ...rec.reasoning,
        primaryFactor: 'hybrid',
      },
    });
  }
  
  // RFM-based (30%)
  for (const rec of rfmRecs) {
    if (mergedMap.has(rec.itemId)) {
      const existing = mergedMap.get(rec.itemId)!;
      existing.score += rec.score * 0.3;
      existing.fitScore.overall += rec.fitScore.overall * 0.3;
      existing.fitScore.similarCustomerAdoption = Math.max(
        existing.fitScore.similarCustomerAdoption,
        rec.fitScore.similarCustomerAdoption
      );
    } else {
      mergedMap.set(rec.itemId, {
        ...rec,
        score: rec.score * 0.3,
        fitScore: {
          ...rec.fitScore,
          overall: rec.fitScore.overall * 0.3,
        },
        reasoning: {
          ...rec.reasoning,
          primaryFactor: 'hybrid',
        },
      });
    }
  }
  
  // Collaborative (20%)
  for (const rec of cfRecs) {
    if (mergedMap.has(rec.itemId)) {
      const existing = mergedMap.get(rec.itemId)!;
      existing.score += rec.score * 0.2;
      existing.fitScore.overall += rec.fitScore.overall * 0.2;
      existing.confidence = Math.max(existing.confidence, rec.confidence);
    } else {
      mergedMap.set(rec.itemId, {
        ...rec,
        score: rec.score * 0.2,
        fitScore: {
          ...rec.fitScore,
          overall: rec.fitScore.overall * 0.2,
        },
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

interface EnrichedPackage {
  id: string;
  name: string;
  price: number;
  totalSessions: number;
  avgRating: number;
  totalReviews: number;
  savingsPercentage: number;
  services: Array<{
    serviceId: string;
    serviceName: string;
    quantity: number;
    price: number;
  }>;
  segmentPurchases: Map<string, number>;
}

async function enrichPackageDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  pkg: PackageRow
): Promise<EnrichedPackage> {
  // Get package services
  const { data: packageServices } = await (supabase as any)
    .from('package_services')
    .select(`
      service_id,
      quantity,
      services (name, price)
    `)
    .eq('package_id', pkg.id) as { data: PackageServiceRow[] | null, error: any };
  
  const services = (packageServices || []).map(ps => ({
    serviceId: ps.service_id,
    serviceName: ps.services?.name || 'Unknown',
    quantity: ps.quantity,
    price: Number(ps.services?.price) || 0,
  }));
  
  // Calculate savings
  const individualTotal = services.reduce((sum: number, s: ServiceItem) => sum + s.price * s.quantity, 0);
  const savingsPercentage = individualTotal > 0
    ? ((individualTotal - Number(pkg.price)) / individualTotal) * 100
    : 0;
  
  // Get ratings
  const { data: ratings } = await (supabase as any)
    .from('bookings')
    .select(`
      sessions!inner (
        reviews (overall_rating)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('package_id', pkg.id) as { data: BookingRow[] | null, error: any };
  
  let totalRating = 0;
  let totalReviews = 0;
  
  if (ratings) {
    for (const booking of ratings) {
      if (booking.sessions && booking.sessions.reviews) {
        for (const review of booking.sessions.reviews) {
          totalRating += review.overall_rating;
          totalReviews++;
        }
      }
    }
  }
  
  const avgRating = totalReviews > 0 ? totalRating / totalReviews : 0;
  
  // Get segment purchases
  const { data: segmentData } = await supabase
    .from('bookings')
    .select(`
      customer_id,
      mv_customer_segments!inner (segment)
    `)
    .eq('tenant_id', tenantId)
    .eq('package_id', pkg.id)
    .in('status', ['confirmed', 'completed']);
  
  const segmentPurchases = new Map<string, number>();
  if (segmentData) {
    for (const booking of segmentData as unknown as SegmentBookingRow[]) {
      const segment = booking.mv_customer_segments?.segment || 'Unknown';
      segmentPurchases.set(segment, (segmentPurchases.get(segment) || 0) + 1);
    }
  }
  
  return {
    id: pkg.id,
    name: pkg.name,
    price: Number(pkg.price) || 0,
    totalSessions: pkg.total_sessions || 0,
    avgRating: Math.round(avgRating * 100) / 100,
    totalReviews,
    savingsPercentage: Math.round(savingsPercentage * 100) / 100,
    services,
    segmentPurchases,
  };
}

function buildPackageRecommendation(
  pkg: EnrichedPackage,
  score: number,
  confidence: number,
  fitScore: FitScore,
  context: RecommendationContext,
  algorithm: string
): PackageRecommendationItem {
  const pricePerSession = pkg.totalSessions > 0 ? pkg.price / pkg.totalSessions : 0;
  
  return {
    itemId: pkg.id,
    itemName: pkg.name,
    itemType: 'package',
    score: Math.round(score * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    reason: `Gói phù hợp với sở thích và ngân sách của bạn (tiết kiệm ${pkg.savingsPercentage.toFixed(0)}%)`,
    reasoning: {
      primaryFactor: algorithm,
      factors: [
        { name: 'preference_fit', weight: 0.5, contribution: fitScore.preferenceFit * 0.5 },
        { name: 'budget_fit', weight: 0.3, contribution: fitScore.budgetFit * 0.3 },
        { name: 'value_fit', weight: 0.2, contribution: fitScore.valueFit * 0.2 },
      ],
      customerSegment: context.customerSegment,
    },
    metadata: {
      price: pkg.price,
      totalSessions: pkg.totalSessions,
      pricePerSession: Math.round(pricePerSession),
      avgRating: pkg.avgRating,
      totalReviews: pkg.totalReviews,
      savingsPercentage: pkg.savingsPercentage,
      includedServices: pkg.services,
    },
    fitScore,
  };
}

async function fetchCustomerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<RecommendationContext> {
  // Note: View not in generated types yet, using type cast
  const { data: segment } = await (supabase as any)
    .from('mv_customer_segments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .single() as { data: any, error: any };
  
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

async function fetchFavoriteServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<Set<string>> {
  // Note: View not in generated types yet, using type cast
  const { data: interactions } = await (supabase as any)
    .from('mv_customer_item_interactions')
    .select('item_id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('item_type', 'service')
    .eq('is_top_interaction', true) as { data: any[] | null, error: any };
  
  if (!interactions) {
    return new Set();
  }
  
  return new Set(interactions.map((i: Record<string, unknown>) => i.item_id));
}
