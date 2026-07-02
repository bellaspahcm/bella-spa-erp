/**
 * Recommendation Engine Utilities
 * Phase 7: Forecast Intelligence & Recommendation Engine
 */

import crypto from 'crypto';

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

export function generateCacheKey(
  tenantId: string,
  customerId: string,
  recommendationType: string,
  context?: Record<string, unknown>
): string {
  const components = [
    tenantId,
    customerId,
    recommendationType,
    context ? JSON.stringify(context) : '',
  ];
  
  const input = components.join('|');
  return crypto.createHash('md5').update(input).digest('hex');
}

// ============================================================================
// DIVERSITY SCORE CALCULATION
// ============================================================================

/**
 * Calculates diversity score based on category distribution
 * Higher score = more diverse recommendations
 * Score range: 0-1
 */
export function calculateDiversityScore(categories: string[]): number {
  if (categories.length === 0) return 0;
  if (categories.length === 1) return 0;
  
  // Count frequency of each category
  const categoryCount = new Map<string, number>();
  for (const category of categories) {
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
  }
  
  // Calculate entropy (Shannon entropy)
  const n = categories.length;
  let entropy = 0;
  
  for (const count of categoryCount.values()) {
    const probability = count / n;
    entropy -= probability * Math.log2(probability);
  }
  
  // Normalize by maximum possible entropy (log2 of number of items)
  const maxEntropy = Math.log2(n);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  
  return Math.round(normalizedEntropy * 100) / 100;
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Calculates cosine similarity between two vectors
 * Used for customer similarity and item similarity
 */
export function cosineSimilarity(
  vectorA: number[],
  vectorB: number[]
): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

// ============================================================================
// RECOMMENDATION SCORE NORMALIZATION
// ============================================================================

/**
 * Normalizes recommendation scores to 0-1 range using min-max normalization
 */
export function normalizeScores<T extends { score: number }>(
  items: T[]
): T[] {
  if (items.length === 0) return items;
  
  const scores = items.map((item) => item.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  
  if (maxScore === minScore) {
    // All scores are the same
    return items.map((item) => ({ ...item, score: 1.0 }));
  }
  
  return items.map((item) => ({
    ...item,
    score: Math.round(((item.score - minScore) / (maxScore - minScore)) * 100) / 100,
  }));
}

// ============================================================================
// RECOMMENDATION FILTERING
// ============================================================================

/**
 * Filters out duplicate recommendations (keeps highest score)
 */
export function deduplicateRecommendations<T extends { itemId: string; score: number }>(
  items: T[]
): T[] {
  const seenIds = new Map<string, T>();
  
  for (const item of items) {
    const existing = seenIds.get(item.itemId);
    if (!existing || item.score > existing.score) {
      seenIds.set(item.itemId, item);
    }
  }
  
  return Array.from(seenIds.values());
}

/**
 * Applies diversity filtering to ensure recommendations are not too similar
 * Removes items from same category until diversity target is reached
 */
export function applyDiversityFilter<T extends { itemId: string; metadata: { category: string }; score: number }>(
  items: T[],
  targetDiversity: number = 0.7
): T[] {
  if (items.length <= 2) return items; // Too few items to diversify
  
  let filtered = [...items];
  let diversity = calculateDiversityScore(filtered.map((i) => i.metadata.category));
  
  while (diversity < targetDiversity && filtered.length > 2) {
    // Find most common category
    const categoryCount = new Map<string, number>();
    for (const item of filtered) {
      categoryCount.set(
        item.metadata.category,
        (categoryCount.get(item.metadata.category) || 0) + 1
      );
    }
    
    const mostCommonCategory = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Remove lowest-scoring item from most common category
    const categoryItems = filtered.filter((i) => i.metadata.category === mostCommonCategory);
    if (categoryItems.length === 1) break; // Can't remove more from this category
    
    const lowestScoreItem = categoryItems.sort((a, b) => a.score - b.score)[0];
    filtered = filtered.filter((i) => i.itemId !== lowestScoreItem.itemId);
    
    // Recalculate diversity
    diversity = calculateDiversityScore(filtered.map((i) => i.metadata.category));
  }
  
  return filtered;
}

// ============================================================================
// RECOMMENDATION MERGING
// ============================================================================

/**
 * Merges recommendations from multiple algorithms with weights
 */
export function mergeRecommendations<T extends { itemId: string; score: number; confidence: number }>(
  recommendationSets: Array<{ items: T[]; weight: number }>,
  limit: number
): T[] {
  const mergedMap = new Map<string, T & { mergedScore: number }>();
  
  for (const { items, weight } of recommendationSets) {
    for (const item of items) {
      const key = item.itemId;
      
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        existing.mergedScore += item.score * weight;
        existing.confidence = Math.max(existing.confidence, item.confidence);
      } else {
        mergedMap.set(key, {
          ...item,
          mergedScore: item.score * weight,
        });
      }
    }
  }
  
  const merged = Array.from(mergedMap.values());
  merged.sort((a, b) => b.mergedScore - a.mergedScore);
  
  // Update score to mergedScore
  return merged.slice(0, limit).map(({ mergedScore, ...rest }) => ({
    ...rest,
    score: Math.round(mergedScore * 100) / 100,
  })) as unknown as T[];
}

// ============================================================================
// ASSOCIATION RULES HELPERS
// ============================================================================

/**
 * Calculates support for an itemset
 * Support = P(A ∩ B) = transactions containing both items / total transactions
 */
export function calculateSupport(
  itemA: string,
  itemB: string,
  transactions: string[][]
): number {
  let countAandB = 0;
  
  for (const transaction of transactions) {
    if (transaction.includes(itemA) && transaction.includes(itemB)) {
      countAandB++;
    }
  }
  
  return countAandB / transactions.length;
}

/**
 * Calculates confidence for a rule A -> B
 * Confidence = P(B|A) = transactions containing both / transactions containing A
 */
export function calculateConfidence(
  itemA: string,
  itemB: string,
  transactions: string[][]
): number {
  let countA = 0;
  let countAandB = 0;
  
  for (const transaction of transactions) {
    const hasA = transaction.includes(itemA);
    const hasB = transaction.includes(itemB);
    
    if (hasA) countA++;
    if (hasA && hasB) countAandB++;
  }
  
  return countA > 0 ? countAandB / countA : 0;
}

/**
 * Calculates lift for a rule A -> B
 * Lift = Confidence / P(B) = how much more likely B is purchased given A
 * Lift > 1: positive correlation, Lift = 1: independent, Lift < 1: negative correlation
 */
export function calculateLift(
  itemA: string,
  itemB: string,
  transactions: string[][]
): number {
  const confidence = calculateConfidence(itemA, itemB, transactions);
  
  // Calculate P(B)
  let countB = 0;
  for (const transaction of transactions) {
    if (transaction.includes(itemB)) countB++;
  }
  const probabilityB = countB / transactions.length;
  
  return probabilityB > 0 ? confidence / probabilityB : 0;
}

// ============================================================================
// RFM SEGMENT MATCHING
// ============================================================================

/**
 * Gets weight multiplier based on RFM segment
 * Champions and Loyal customers get higher weights
 */
export function getRfmWeight(segment: string): number {
  const weights: Record<string, number> = {
    'Champion': 1.0,
    'Loyal Customer': 0.9,
    'Potential Loyalist': 0.8,
    'New Customer': 0.7,
    'Promising': 0.7,
    'Need Attention': 0.6,
    'About to Sleep': 0.5,
    'At Risk': 0.4,
    'Cannot Lose Them': 0.8,
    'Hibernating': 0.3,
    'Lost': 0.2,
  };
  
  return weights[segment] || 0.5;
}

// ============================================================================
// CONTEXT SIMILARITY
// ============================================================================

/**
 * Calculates similarity between two customer contexts
 * Used for finding similar customers based on behavior patterns
 */
export function calculateContextSimilarity(
  contextA: {
    rfmScores?: { recency: number; frequency: number; monetary: number };
    segment?: string;
  },
  contextB: {
    rfmScores?: { recency: number; frequency: number; monetary: number };
    segment?: string;
  }
): number {
  let similarity = 0;
  let factors = 0;
  
  // Segment similarity (exact match = 1.0, different = 0.0)
  if (contextA.segment && contextB.segment) {
    similarity += contextA.segment === contextB.segment ? 1.0 : 0.0;
    factors++;
  }
  
  // RFM scores similarity (cosine similarity)
  if (contextA.rfmScores && contextB.rfmScores) {
    const vectorA = [
      contextA.rfmScores.recency,
      contextA.rfmScores.frequency,
      contextA.rfmScores.monetary,
    ];
    const vectorB = [
      contextB.rfmScores.recency,
      contextB.rfmScores.frequency,
      contextB.rfmScores.monetary,
    ];
    
    similarity += cosineSimilarity(vectorA, vectorB);
    factors++;
  }
  
  return factors > 0 ? similarity / factors : 0;
}
