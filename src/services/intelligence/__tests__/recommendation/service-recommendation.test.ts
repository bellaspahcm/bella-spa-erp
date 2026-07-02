/**
 * Service Recommendation Unit Tests
 * Intelligence Layer Phase 8 Task #3
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateCollaborativeFiltering,
  calculateContentBasedFiltering,
  calculateRFMBasedRecommendations,
  calculateHybridRecommendations
} from '../../recommendation/service-recommendation';
import { generateMockCustomerInteractions } from '../helpers/test-utils';

describe('Service Recommendation - Unit Tests', () => {
  describe('Collaborative Filtering', () => {
    it('should recommend items based on similar customers', () => {
      const interactions = [
        // Customer 1 likes items A, B, C
        { customer_id: 'customer_1', item_id: 'item_a', interaction_score: 0.9 },
        { customer_id: 'customer_1', item_id: 'item_b', interaction_score: 0.8 },
        { customer_id: 'customer_1', item_id: 'item_c', interaction_score: 0.7 },
        
        // Customer 2 likes items A, B (similar to customer 1)
        { customer_id: 'customer_2', item_id: 'item_a', interaction_score: 0.9 },
        { customer_id: 'customer_2', item_id: 'item_b', interaction_score: 0.8 },
        
        // Customer 2 also likes item D
        { customer_id: 'customer_2', item_id: 'item_d', interaction_score: 0.85 },
      ];
      
      // Customer 1 should be recommended item D (from similar customer 2)
      const recommendations = calculateCollaborativeFiltering('customer_1', interactions, 3);
      
      expect(recommendations).toHaveLength(1); // Only item D (not already interacted with)
      expect(recommendations[0].recommended_item_id).toBe('item_d');
      expect(recommendations[0].relevance_score).toBeGreaterThan(0.5);
      expect(recommendations[0].algorithm_used).toBe('collaborative_filtering');
    });

    it('should return empty array for customer with no interactions', () => {
      const interactions = [
        { customer_id: 'customer_1', item_id: 'item_a', interaction_score: 0.9 },
      ];
      
      const recommendations = calculateCollaborativeFiltering('customer_2', interactions, 5);
      expect(recommendations).toHaveLength(0);
    });

    it('should limit recommendations to specified count', () => {
      const interactions = generateMockCustomerInteractions(20, 10);
      
      const recommendations = calculateCollaborativeFiltering('customer_0', interactions, 5);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should rank recommendations by relevance score', () => {
      const interactions = generateMockCustomerInteractions(50, 20);
      
      const recommendations = calculateCollaborativeFiltering('customer_0', interactions, 10);
      
      // Recommendations should be sorted by relevance (descending)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].relevance_score).toBeLessThanOrEqual(recommendations[i - 1].relevance_score);
      }
    });

    it('should assign rank positions correctly', () => {
      const interactions = generateMockCustomerInteractions(30, 15);
      
      const recommendations = calculateCollaborativeFiltering('customer_0', interactions, 5);
      
      recommendations.forEach((rec, index) => {
        expect(rec.rank_position).toBe(index + 1);
      });
    });
  });

  describe('Content-Based Filtering', () => {
    it('should recommend similar items based on attributes', () => {
      const itemAttributes = [
        { item_id: 'item_a', category: 'massage', duration: 60, price: 500000 },
        { item_id: 'item_b', category: 'massage', duration: 90, price: 700000 },
        { item_id: 'item_c', category: 'facial', duration: 60, price: 600000 },
      ];
      
      const customerHistory = ['item_a']; // Customer liked massage
      
      const recommendations = calculateContentBasedFiltering(
        customerHistory,
        itemAttributes,
        5
      );
      
      // Should recommend item_b (similar massage service) higher than item_c (different category)
      expect(recommendations[0].recommended_item_id).toBe('item_b');
      expect(recommendations[0].relevance_score).toBeGreaterThan(recommendations[1]?.relevance_score || 0);
    });

    it('should calculate similarity based on multiple attributes', () => {
      const itemAttributes = [
        { item_id: 'item_a', category: 'massage', duration: 60, price: 500000, rating: 4.5 },
        { item_id: 'item_b', category: 'massage', duration: 60, price: 550000, rating: 4.6 }, // Very similar
        { item_id: 'item_c', category: 'facial', duration: 120, price: 1000000, rating: 3.5 }, // Very different
      ];
      
      const customerHistory = ['item_a'];
      
      const recommendations = calculateContentBasedFiltering(
        customerHistory,
        itemAttributes,
        5
      );
      
      // Item B should have much higher similarity than item C
      const itemB = recommendations.find(r => r.recommended_item_id === 'item_b');
      const itemC = recommendations.find(r => r.recommended_item_id === 'item_c');
      
      expect(itemB).toBeDefined();
      expect(itemC).toBeDefined();
      expect(itemB!.relevance_score).toBeGreaterThan(itemC!.relevance_score * 1.5);
    });

    it('should not recommend items already in history', () => {
      const itemAttributes = [
        { item_id: 'item_a', category: 'massage', duration: 60, price: 500000 },
        { item_id: 'item_b', category: 'massage', duration: 90, price: 700000 },
      ];
      
      const customerHistory = ['item_a', 'item_b'];
      
      const recommendations = calculateContentBasedFiltering(
        customerHistory,
        itemAttributes,
        5
      );
      
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('RFM-Based Recommendations', () => {
    it('should recommend based on customer RFM segment', () => {
      const customerRFM = {
        customer_id: 'customer_1',
        rfm_score: 555, // Champions (high recency, frequency, monetary)
        segment: 'champions',
        recency_days: 5,
        frequency: 10,
        monetary: 10000000
      };
      
      const availableItems = [
        { item_id: 'item_a', category: 'premium', price: 2000000 },
        { item_id: 'item_b', category: 'standard', price: 500000 },
      ];
      
      const recommendations = calculateRFMBasedRecommendations(
        customerRFM,
        availableItems,
        5
      );
      
      // Champions should be recommended premium items
      expect(recommendations[0].recommended_item_id).toBe('item_a');
      expect(recommendations[0].relevance_score).toBeGreaterThan(0.7);
    });

    it('should adjust recommendations for at-risk customers', () => {
      const customerRFM = {
        customer_id: 'customer_1',
        rfm_score: 144, // At-risk (low recency, low frequency, high monetary)
        segment: 'at_risk',
        recency_days: 90,
        frequency: 2,
        monetary: 5000000
      };
      
      const availableItems = [
        { item_id: 'item_a', category: 'retention_promo', price: 500000 },
        { item_id: 'item_b', category: 'premium', price: 2000000 },
      ];
      
      const recommendations = calculateRFMBasedRecommendations(
        customerRFM,
        availableItems,
        5
      );
      
      // At-risk customers should be shown retention promotions
      expect(recommendations[0].recommended_item_id).toBe('item_a');
      expect(recommendations[0].metadata).toHaveProperty('retention_strategy');
    });

    it('should handle new customers appropriately', () => {
      const customerRFM = {
        customer_id: 'customer_1',
        rfm_score: 555,
        segment: 'new_customers',
        recency_days: 1,
        frequency: 1,
        monetary: 500000
      };
      
      const availableItems = [
        { item_id: 'item_a', category: 'introductory', price: 300000 },
        { item_id: 'item_b', category: 'premium', price: 2000000 },
      ];
      
      const recommendations = calculateRFMBasedRecommendations(
        customerRFM,
        availableItems,
        5
      );
      
      // New customers should see introductory offers
      expect(recommendations[0].recommended_item_id).toBe('item_a');
    });
  });

  describe('Hybrid Recommendations', () => {
    it('should combine multiple algorithms', () => {
      const interactions = [
        { customer_id: 'customer_1', item_id: 'item_a', interaction_score: 0.9 },
        { customer_id: 'customer_2', item_id: 'item_a', interaction_score: 0.8 },
        { customer_id: 'customer_2', item_id: 'item_b', interaction_score: 0.85 },
      ];
      
      const itemAttributes = [
        { item_id: 'item_b', category: 'massage', duration: 60 },
        { item_id: 'item_c', category: 'massage', duration: 90 },
      ];
      
      const customerRFM = {
        customer_id: 'customer_1',
        rfm_score: 555,
        segment: 'champions',
        recency_days: 5,
        frequency: 10,
        monetary: 10000000
      };
      
      const recommendations = calculateHybridRecommendations(
        'customer_1',
        interactions,
        itemAttributes,
        customerRFM,
        5
      );
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].algorithm_used).toBe('hybrid');
      expect(recommendations[0].metadata).toHaveProperty('algorithm_scores');
      expect(recommendations[0].metadata.algorithm_scores).toHaveProperty('collaborative_filtering');
      expect(recommendations[0].metadata.algorithm_scores).toHaveProperty('content_based');
      expect(recommendations[0].metadata.algorithm_scores).toHaveProperty('rfm_based');
    });

    it('should weight algorithms based on data availability', () => {
      // Scenario: Lots of collaborative data, little content data
      const interactions = generateMockCustomerInteractions(100, 50);
      const itemAttributes = [
        { item_id: 'item_0', category: 'unknown' },
        { item_id: 'item_1', category: 'unknown' },
      ];
      
      const customerRFM = {
        customer_id: 'customer_0',
        rfm_score: 555,
        segment: 'champions',
        recency_days: 5,
        frequency: 10,
        monetary: 10000000
      };
      
      const recommendations = calculateHybridRecommendations(
        'customer_0',
        interactions,
        itemAttributes,
        customerRFM,
        5
      );
      
      // Collaborative filtering should have higher weight
      const cfScore = recommendations[0].metadata.algorithm_scores.collaborative_filtering;
      const cbScore = recommendations[0].metadata.algorithm_scores.content_based;
      
      expect(cfScore).toBeGreaterThan(cbScore);
    });

    it('should deduplicate recommendations from different algorithms', () => {
      // Setup scenario where multiple algorithms recommend same item
      const interactions = [
        { customer_id: 'customer_1', item_id: 'item_a', interaction_score: 0.9 },
        { customer_id: 'customer_2', item_id: 'item_a', interaction_score: 0.8 },
        { customer_id: 'customer_2', item_id: 'item_b', interaction_score: 0.9 },
      ];
      
      const itemAttributes = [
        { item_id: 'item_a', category: 'massage', duration: 60 },
        { item_id: 'item_b', category: 'massage', duration: 60 }, // Similar to item_a
      ];
      
      const customerRFM = {
        customer_id: 'customer_1',
        rfm_score: 555,
        segment: 'champions',
        recency_days: 5,
        frequency: 10,
        monetary: 10000000
      };
      
      const recommendations = calculateHybridRecommendations(
        'customer_1',
        interactions,
        itemAttributes,
        customerRFM,
        10
      );
      
      // Each item should appear only once
      const itemIds = recommendations.map(r => r.recommended_item_id);
      const uniqueItemIds = [...new Set(itemIds)];
      expect(itemIds.length).toBe(uniqueItemIds.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle customers with no data', () => {
      const cfRecommendations = calculateCollaborativeFiltering('unknown_customer', [], 5);
      expect(cfRecommendations).toHaveLength(0);
      
      const cbRecommendations = calculateContentBasedFiltering([], [], 5);
      expect(cbRecommendations).toHaveLength(0);
    });

    it('should handle very sparse interaction matrix', () => {
      const interactions = [
        { customer_id: 'customer_1', item_id: 'item_1', interaction_score: 0.5 },
      ];
      
      const recommendations = calculateCollaborativeFiltering('customer_1', interactions, 5);
      expect(recommendations).toHaveLength(0); // No similar customers
    });

    it('should handle items with incomplete attributes', () => {
      const itemAttributes = [
        { item_id: 'item_a', category: 'massage' }, // Missing price, duration
        { item_id: 'item_b', category: 'facial', price: 500000 }, // Missing duration
      ];
      
      const customerHistory = ['item_a'];
      
      const recommendations = calculateContentBasedFiltering(
        customerHistory,
        itemAttributes,
        5
      );
      
      // Should still work, just with available attributes
      expect(recommendations).toHaveLength(1);
    });

    it('should handle negative interaction scores', () => {
      const interactions = [
        { customer_id: 'customer_1', item_id: 'item_a', interaction_score: -0.5 }, // Disliked
        { customer_id: 'customer_2', item_id: 'item_a', interaction_score: 0.9 },
        { customer_id: 'customer_2', item_id: 'item_b', interaction_score: 0.8 },
      ];
      
      const recommendations = calculateCollaborativeFiltering('customer_1', interactions, 5);
      
      // Should avoid recommending items with negative scores
      expect(recommendations.every(r => r.relevance_score > 0)).toBe(true);
    });
  });
});
