/**
 * Recommendation Engine Types
 * Phase 7: Forecast Intelligence & Recommendation Engine
 */

// ============================================================================
// ENUMS
// ============================================================================

export type RecommendationType = 'service' | 'upsell' | 'package';

export type RecommendationAlgorithm =
  | 'collaborative_filtering'
  | 'content_based'
  | 'market_basket'
  | 'rfm_based'
  | 'hybrid';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// RECOMMENDATION RESULTS
// ============================================================================

export interface RecommendationItem {
  itemId: string;
  itemName: string;
  itemType: 'service' | 'package';
  score: number; // 0-1, relevance score
  confidence: number; // 0-1, confidence in recommendation
  reason: string; // Human-readable explanation
  reasoning: RecommendationReasoning;
  metadata?: {
    price?: number;
    avgRating?: number;
    popularity?: number;
    seasonality?: string;
  };
}

export interface RecommendationReasoning {
  primaryFactor: string;
  factors: Array<{
    name: string;
    weight: number;
    contribution: number;
  }>;
  similarCustomers?: number;
  coPurchaseRate?: number;
  customerSegment?: string;
}

export interface RecommendationResult {
  tenantId: string;
  customerId: string;
  recommendationType: RecommendationType;
  algorithmName: RecommendationAlgorithm;
  algorithmVersion: string;
  recommendations: RecommendationItem[];
  relevanceScore: number; // Overall relevance (0-1)
  confidenceScore: number; // Overall confidence (0-1)
  diversityScore: number; // Diversity of recommendations (0-1)
  context: RecommendationContext;
  generatedAt: string;
  expiresAt: string;
}

export interface RecommendationContext {
  customerSegment?: string;
  rfmScores?: {
    recency: number;
    frequency: number;
    monetary: number;
  };
  purchaseHistory?: {
    totalOrders: number;
    avgOrderValue: number;
    lastPurchaseDate: string;
    topCategories: string[];
  };
  preferences?: {
    favoriteServices: string[];
    priceRange: { min: number; max: number };
    preferredTimeSlots: string[];
  };
  churnRisk?: number;
}

// ============================================================================
// SERVICE RECOMMENDATIONS (Next Service to Try)
// ============================================================================

export interface ServiceRecommendationInput {
  tenantId: string;
  customerId: string;
  limit?: number; // Default: 5
  algorithm?: RecommendationAlgorithm;
  excludeServices?: string[]; // Services to exclude
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    category?: string;
    minRating?: number;
  };
}

export interface ServiceRecommendationResult extends RecommendationResult {
  recommendationType: 'service';
  recommendations: ServiceRecommendationItem[];
}

export interface ServiceRecommendationItem extends RecommendationItem {
  itemType: 'service';
  metadata: {
    price: number;
    duration: number; // minutes
    avgRating: number;
    totalReviews: number;
    popularity: number; // 0-100
    category: string;
    availableKtvCount: number;
  };
  matchFactors: {
    similarCustomersPurchased: boolean;
    matchesPreferences: boolean;
    complementaryToPrevious: boolean;
    trending: boolean;
  };
}

// ============================================================================
// UPSELL RECOMMENDATIONS (Complementary Items)
// ============================================================================

export interface UpsellRecommendationInput {
  tenantId: string;
  customerId: string;
  currentItems: Array<{
    itemId: string;
    itemType: 'service' | 'package';
  }>;
  limit?: number; // Default: 3
  algorithm?: RecommendationAlgorithm;
}

export interface UpsellRecommendationResult extends RecommendationResult {
  recommendationType: 'upsell';
  recommendations: UpsellRecommendationItem[];
  currentItems: Array<{
    itemId: string;
    itemName: string;
    itemType: 'service' | 'package';
  }>;
}

export interface UpsellRecommendationItem extends RecommendationItem {
  metadata: {
    price: number;
    avgRating: number;
    coPurchaseRate: number; // Percentage of customers who bought this with current items
    avgRevenueIncrease: number; // Average revenue increase when upselling this item
    acceptanceRate: number; // Historical acceptance rate (0-1)
  };
  basketAnalysis: {
    support: number; // P(A ∩ B)
    confidence: number; // P(B|A)
    lift: number; // Confidence / P(B)
  };
}

// ============================================================================
// PACKAGE RECOMMENDATIONS (Best-Fit Package)
// ============================================================================

export interface PackageRecommendationInput {
  tenantId: string;
  customerId: string;
  limit?: number; // Default: 3
  algorithm?: RecommendationAlgorithm;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    minSessions?: number;
    maxSessions?: number;
  };
}

export interface PackageRecommendationResult extends RecommendationResult {
  recommendationType: 'package';
  recommendations: PackageRecommendationItem[];
}

export interface PackageRecommendationItem extends RecommendationItem {
  itemType: 'package';
  metadata: {
    price: number;
    totalSessions: number;
    pricePerSession: number;
    avgRating: number;
    totalReviews: number;
    savingsPercentage: number; // Compared to buying services individually
    includedServices: Array<{
      serviceId: string;
      serviceName: string;
      quantity: number;
    }>;
  };
  fitScore: {
    overall: number; // 0-1
    budgetFit: number; // 0-1
    preferenceFit: number; // 0-1
    valueFit: number; // 0-1
    similarCustomerAdoption: number; // 0-1
  };
}

// ============================================================================
// RECOMMENDATION CACHE
// ============================================================================

export interface RecommendationCache {
  id: string;
  tenantId: string;
  recommendationType: RecommendationType;
  customerId: string;
  algorithmName: RecommendationAlgorithm;
  algorithmVersion: string;
  recommendations: unknown; // JSONB
  relevanceScore: number;
  confidenceScore: number;
  diversityScore: number;
  context: unknown; // JSONB
  cacheKey: string;
  expiresAt: string;
  hitCount: number;
  createdAt: string;
  createdBy?: string;
  lastAccessedAt: string;
}

// ============================================================================
// CUSTOMER ITEM INTERACTIONS
// ============================================================================

export interface CustomerItemInteraction {
  tenantId: string;
  customerId: string;
  itemId: string;
  itemType: 'service' | 'package';
  itemName: string;
  interactionCount: number;
  totalQuantity: number;
  totalRevenue: number;
  avgRating: number | null;
  ratingCount: number;
  lastInteractionDate: string;
  firstInteractionDate: string;
  recencyDays: number;
  frequencyPerMonth: number;
  interactionScore: number; // 0-1
  interactionPercentile: number; // 0-1
  isTopInteraction: boolean;
}

export interface SimilarCustomer {
  similarCustomerId: string;
  similarityScore: number; // Cosine similarity (0-1)
  commonItems: number;
  totalInteractions: number;
}

export interface CoPurchasedItem {
  coItemId: string;
  coItemType: 'service' | 'package';
  coItemName: string;
  coPurchaseCount: number;
  support: number; // P(A ∩ B)
  confidence: number; // P(B|A)
  lift: number; // Confidence / P(B)
}

// ============================================================================
// ALGORITHM CONFIGURATION
// ============================================================================

export interface CollaborativeFilteringConfig {
  minSimilarCustomers: number; // Default: 5
  minCommonItems: number; // Default: 2
  similarityThreshold: number; // Default: 0.3
  diversityWeight: number; // Default: 0.2
}

export interface MarketBasketConfig {
  minSupport: number; // Default: 0.01
  minConfidence: number; // Default: 0.3
  minLift: number; // Default: 1.5
  minCoPurchases: number; // Default: 3
}

export interface RfmBasedConfig {
  championWeight: number; // Default: 1.0
  loyalWeight: number; // Default: 0.9
  potentialWeight: number; // Default: 0.7
  atRiskWeight: number; // Default: 0.5
  lostWeight: number; // Default: 0.2
}

export interface HybridConfig {
  collaborativeWeight: number; // Default: 0.4
  contentBasedWeight: number; // Default: 0.3
  marketBasketWeight: number; // Default: 0.2
  rfmBasedWeight: number; // Default: 0.1
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface RecommendationAnalytics {
  tenantId: string;
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  metrics: {
    totalRecommendations: number;
    totalAccepted: number;
    acceptanceRate: number; // Percentage
    avgRelevanceScore: number;
    avgConfidenceScore: number;
    cacheHitRate: number; // Percentage
    avgResponseTime: number; // ms
  };
  byType: {
    service: RecommendationTypeMetrics;
    upsell: RecommendationTypeMetrics;
    package: RecommendationTypeMetrics;
  };
  byAlgorithm: Record<RecommendationAlgorithm, RecommendationAlgorithmMetrics>;
  topRecommendedItems: Array<{
    itemId: string;
    itemName: string;
    itemType: 'service' | 'package';
    recommendationCount: number;
    acceptanceCount: number;
    acceptanceRate: number;
    revenueGenerated: number;
  }>;
}

export interface RecommendationTypeMetrics {
  totalRecommendations: number;
  totalAccepted: number;
  acceptanceRate: number;
  avgRelevanceScore: number;
  avgConfidenceScore: number;
  revenueGenerated: number;
}

export interface RecommendationAlgorithmMetrics {
  totalRecommendations: number;
  totalAccepted: number;
  acceptanceRate: number;
  avgRelevanceScore: number;
  avgResponseTime: number; // ms
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface RecommendationResponse<T extends RecommendationResult> {
  success: boolean;
  data: T;
  meta: {
    generatedAt: string;
    algorithmName: RecommendationAlgorithm;
    algorithmVersion: string;
    dataSource: 'cache' | 'computation';
    computationTime?: number; // ms
    cacheExpiry?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
