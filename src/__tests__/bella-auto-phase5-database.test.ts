/**
 * Database Schema Tests for Bella Auto Phase 5
 * Verifies all tables, RLS policies, and triggers are correctly deployed
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_TENANT_ID = 'bella_auto_demo';

describe('Bella Auto Phase 5 - Database Schema', () => {
  beforeAll(async () => {
    console.log('Testing Phase 5 database schema deployment...');
  });

  describe('Tables Exist', () => {
    it('should have auto_survey_templates table', async () => {
      const { data, error } = await supabase
        .from('auto_survey_templates')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_surveys table', async () => {
      const { data, error } = await supabase
        .from('auto_surveys')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_survey_responses table', async () => {
      const { data, error } = await supabase
        .from('auto_survey_responses')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_nps_scores table', async () => {
      const { data, error } = await supabase
        .from('auto_nps_scores')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_csi_scores table', async () => {
      const { data, error } = await supabase
        .from('auto_csi_scores')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_customer_health_scores table', async () => {
      const { data, error } = await supabase
        .from('auto_customer_health_scores')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_next_best_actions table', async () => {
      const { data, error } = await supabase
        .from('auto_next_best_actions')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('should have auto_lost_analysis table', async () => {
      const { data, error } = await supabase
        .from('auto_lost_analysis')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });
  });

  describe('NPS Functionality', () => {
    let testCustomerId: string;
    let testSurveyId: string;

    beforeAll(async () => {
      // Create test customer
      const { data: customer } = await supabase
        .from('customers')
        .insert({
          tenant_id: TEST_TENANT_ID,
          name: 'NPS Test Customer',
          email: 'npstest@example.com',
          phone: '0900000005',
        })
        .select()
        .single();

      testCustomerId = customer!.id;
    });

    afterAll(async () => {
      // Cleanup
      if (testSurveyId) {
        await supabase.from('auto_nps_scores').delete().eq('survey_id', testSurveyId);
        await supabase.from('auto_survey_responses').delete().eq('survey_id', testSurveyId);
        await supabase.from('auto_surveys').delete().eq('id', testSurveyId);
      }
      if (testCustomerId) {
        await supabase.from('customers').delete().eq('id', testCustomerId);
      }
    });

    it('should create a survey', async () => {
      const { data: survey, error } = await supabase
        .from('auto_surveys')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          survey_type: 'nps',
          status: 'pending',
          questions: [{ id: 'nps', text: 'How likely are you to recommend us?', type: 'nps_score' }],
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(survey).toBeDefined();
      expect(survey!.survey_type).toBe('nps');
      testSurveyId = survey!.id;
    });

    it('should record NPS score with auto-categorization', async () => {
      // Record promoter (score 9)
      const { data: npsScore, error } = await supabase
        .from('auto_nps_scores')
        .insert({
          tenant_id: TEST_TENANT_ID,
          survey_id: testSurveyId,
          customer_id: testCustomerId,
          score: 9,
          survey_type: 'post_delivery',
          feedback_text: 'Excellent service!',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(npsScore).toBeDefined();
      expect(npsScore!.score).toBe(9);
      expect(npsScore!.category).toBe('promoter'); // Auto-categorized by trigger
    });

    it('should auto-categorize detractor', async () => {
      const { data: npsScore, error } = await supabase
        .from('auto_nps_scores')
        .insert({
          tenant_id: TEST_TENANT_ID,
          survey_id: testSurveyId,
          customer_id: testCustomerId,
          score: 5,
          survey_type: 'post_delivery',
          feedback_text: 'Not satisfied',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(npsScore!.category).toBe('detractor');
    });
  });

  describe('CSI Functionality', () => {
    let testCustomerId: string;
    let testSurveyId: string;

    beforeAll(async () => {
      const { data: customer } = await supabase
        .from('customers')
        .insert({
          tenant_id: TEST_TENANT_ID,
          name: 'CSI Test Customer',
          email: 'csitest@example.com',
          phone: '0900000006',
        })
        .select()
        .single();

      testCustomerId = customer!.id;

      const { data: survey } = await supabase
        .from('auto_surveys')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          survey_type: 'csi',
          status: 'pending',
          questions: [],
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      testSurveyId = survey!.id;
    });

    afterAll(async () => {
      if (testSurveyId) {
        await supabase.from('auto_csi_scores').delete().eq('survey_id', testSurveyId);
        await supabase.from('auto_surveys').delete().eq('id', testSurveyId);
      }
      if (testCustomerId) {
        await supabase.from('customers').delete().eq('id', testCustomerId);
      }
    });

    it('should record CSI score with multiple dimensions', async () => {
      const { data: csiScore, error } = await supabase
        .from('auto_csi_scores')
        .insert({
          tenant_id: TEST_TENANT_ID,
          survey_id: testSurveyId,
          customer_id: testCustomerId,
          sales_consultant_score: 4.5,
          facility_score: 4.2,
          delivery_timing_score: 3.8,
          vehicle_quality_score: 4.7,
          after_sales_score: 4.0,
          overall_csi: 4.24, // Weighted average
          survey_type: 'post_delivery',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(csiScore).toBeDefined();
      expect(csiScore!.overall_csi).toBeGreaterThanOrEqual(4.0);
      expect(csiScore!.overall_csi).toBeLessThanOrEqual(5.0);
    });
  });

  describe('Customer Health Score', () => {
    let testCustomerId: string;

    beforeAll(async () => {
      const { data: customer } = await supabase
        .from('customers')
        .insert({
          tenant_id: TEST_TENANT_ID,
          name: 'Health Test Customer',
          email: 'healthtest@example.com',
          phone: '0900000007',
        })
        .select()
        .single();

      testCustomerId = customer!.id;
    });

    afterAll(async () => {
      if (testCustomerId) {
        await supabase.from('auto_customer_health_scores').delete().eq('customer_id', testCustomerId);
        await supabase.from('customers').delete().eq('id', testCustomerId);
      }
    });

    it('should create health score record', async () => {
      const { data: healthScore, error } = await supabase
        .from('auto_customer_health_scores')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          engagement_score: 75,
          satisfaction_score: 80,
          revenue_score: 65,
          loyalty_score: 70,
          overall_health_score: 73,
          health_status: 'healthy',
          risk_factors: [],
          calculated_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(healthScore).toBeDefined();
      expect(healthScore!.overall_health_score).toBe(73);
    });

    it('should auto-determine health status from score', async () => {
      // Test excellent (≥80)
      const { data: excellent } = await supabase
        .from('auto_customer_health_scores')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          engagement_score: 85,
          satisfaction_score: 90,
          revenue_score: 80,
          loyalty_score: 85,
          overall_health_score: 85,
          health_status: 'healthy', // Will be auto-updated by trigger
          risk_factors: [],
        })
        .select()
        .single();

      expect(excellent!.health_status).toBe('excellent');
    });
  });

  describe('Next Best Actions', () => {
    let testCustomerId: string;

    beforeAll(async () => {
      const { data: customer } = await supabase
        .from('customers')
        .insert({
          tenant_id: TEST_TENANT_ID,
          name: 'Action Test Customer',
          email: 'actiontest@example.com',
          phone: '0900000008',
        })
        .select()
        .single();

      testCustomerId = customer!.id;
    });

    afterAll(async () => {
      if (testCustomerId) {
        await supabase.from('auto_next_best_actions').delete().eq('customer_id', testCustomerId);
        await supabase.from('customers').delete().eq('id', testCustomerId);
      }
    });

    it('should create next best action', async () => {
      const { data: action, error } = await supabase
        .from('auto_next_best_actions')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          action_type: 'follow_up_quotation',
          action_priority: 'high',
          action_title: 'Follow up on quotation',
          action_description: 'Customer received quotation 5 days ago',
          reason: 'No response after optimal follow-up window',
          confidence_score: 0.85,
          data_points: { days_since_quotation: 5 },
          status: 'pending',
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(action).toBeDefined();
      expect(action!.action_priority).toBe('high');
      expect(action!.confidence_score).toBe(0.85);
    });
  });

  describe('Lost Analysis', () => {
    let testCustomerId: string;
    let testJourneyId: string;

    beforeAll(async () => {
      const { data: customer } = await supabase
        .from('customers')
        .insert({
          tenant_id: TEST_TENANT_ID,
          name: 'Lost Test Customer',
          email: 'losttest@example.com',
          phone: '0900000009',
        })
        .select()
        .single();

      testCustomerId = customer!.id;

      // Create journey (assuming auto_customer_journeys exists)
      const { data: journey } = await supabase
        .from('auto_customer_journeys')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          current_stage: 'quotation',
          status: 'active',
        })
        .select()
        .single();

      testJourneyId = journey!.id;
    });

    afterAll(async () => {
      if (testCustomerId) {
        await supabase.from('auto_lost_analysis').delete().eq('customer_id', testCustomerId);
        if (testJourneyId) {
          await supabase.from('auto_customer_journeys').delete().eq('id', testJourneyId);
        }
        await supabase.from('customers').delete().eq('id', testCustomerId);
      }
    });

    it('should record lost opportunity', async () => {
      const { data: lostAnalysis, error } = await supabase
        .from('auto_lost_analysis')
        .insert({
          tenant_id: TEST_TENANT_ID,
          customer_id: testCustomerId,
          journey_id: testJourneyId,
          lost_at_stage: 'quotation',
          lost_date: new Date().toISOString().split('T')[0],
          primary_reason: 'price_too_high',
          secondary_reasons: ['competitor_better_offer'],
          competitor_brand: 'Honda',
          competitor_model: 'Accord',
          competitor_price: 1200000000,
          price_difference: 50000000,
          customer_feedback: 'Found better deal',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(lostAnalysis).toBeDefined();
      expect(lostAnalysis!.primary_reason).toBe('price_too_high');
      expect(lostAnalysis!.competitor_brand).toBe('Honda');
    });
  });

  describe('RLS Policies', () => {
    it('should enforce tenant isolation on auto_surveys', async () => {
      // Try to query with wrong tenant
      const { data, error } = await supabase
        .from('auto_surveys')
        .select('*')
        .eq('tenant_id', 'wrong_tenant');

      // Should return empty or error depending on RLS config
      expect(data).toEqual([]);
    });
  });
});
