/**
 * Integration Tests for Bella Auto Phase 5 - Experience Center
 * Tests NPS, CSI, Health Scores, Next Best Actions, and Lost Analysis
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { NPSSurveyService } from '@/modules/bella-auto/services/NPSSurveyService';
import { CSISurveyService } from '@/modules/bella-auto/services/CSISurveyService';
import { CustomerHealthScoreService } from '@/modules/bella-auto/services/CustomerHealthScoreService';
import { NextBestActionEngine } from '@/modules/bella-auto/services/NextBestActionEngine';
import { LostAnalysisAIService } from '@/modules/bella-auto/services/LostAnalysisAIService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

jest.setTimeout(30000);

const TEST_TENANT_ID = 'da9e610b-88c5-4901-8ab9-5439f4931467';
let testCustomerId: string;
let testJourneyId: string;
let testVehicleId: string;
let testNpsTemplateId: string;
let testCsiTemplateId: string;

describe('Bella Auto Phase 5 - Experience Center', () => {
  beforeAll(async () => {
    // Set tenant context
    await supabase.rpc('set_tenant_context', { tenant_id: TEST_TENANT_ID });

    // Create test customer
    const { data: customer } = await supabase
      .from('customers')
      .insert({
        tenant_id: TEST_TENANT_ID,
        name_mother: 'Test Customer Phase 5',
        phone: '09' + Math.floor(10000000 + Math.random() * 90000000).toString(),
      })
      .select()
      .single();

    testCustomerId = customer!.id;

    // Query an existing vehicle to bypass complex variant foreign keys
    const { data: vehicle } = await supabase
      .from('auto_vehicles')
      .select('id')
      .limit(1)
      .single();

    testVehicleId = vehicle!.id;

    // Create test NPS template
    const { data: npsTemplate } = await supabase
      .from('auto_survey_templates')
      .insert({
        tenant_id: TEST_TENANT_ID,
        name: 'Test NPS Template',
        survey_type: 'nps',
        trigger_event: 'vehicle_delivered',
        questions: [
          {
            id: 'nps_score',
            text: 'How likely are you to recommend us to a friend or colleague?',
            type: 'nps_score',
          }
        ],
        is_active: true,
        auto_send: true,
        send_delay_hours: 0,
      })
      .select()
      .single();
    testNpsTemplateId = npsTemplate!.id;

    // Create test CSI template
    const { data: csiTemplate } = await supabase
      .from('auto_survey_templates')
      .insert({
        tenant_id: TEST_TENANT_ID,
        name: 'Test CSI Template',
        survey_type: 'csi',
        trigger_event: 'vehicle_delivered',
        questions: [
          { id: 'sales_consultant', text: 'Chất lượng phục vụ của tư vấn bán hàng', type: 'rating' },
          { id: 'facility', text: 'Cơ sở vật chất showroom', type: 'rating' },
          { id: 'delivery_timing', text: 'Thời gian giao xe', type: 'rating' },
          { id: 'vehicle_quality', text: 'Chất lượng xe khi nhận', type: 'rating' },
          { id: 'after_sales', text: 'Dịch vụ hậu mãi', type: 'rating' },
        ],
        is_active: true,
        auto_send: true,
        send_delay_hours: 0,
      })
      .select()
      .single();
    testCsiTemplateId = csiTemplate!.id;

    // Create test journey
    const { data: journey, error: journeyErr } = await supabase
      .from('auto_customer_journeys')
      .insert({
        tenant_id: TEST_TENANT_ID,
        customer_id: testCustomerId,
        current_stage_id: '5af246ac-cb07-4d31-b13f-3631237891f1', // Stage: 'delivered'
        entered_stage_at: new Date().toISOString(),
        sla_status: 'normal',
        metadata: {},
      })
      .select()
      .single();

    if (journeyErr) {
      console.error('Journey Insert Error:', journeyErr);
    }

    testJourneyId = journey!.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('auto_nps_scores').delete().eq('customer_id', testCustomerId);
    await supabase.from('auto_csi_scores').delete().eq('customer_id', testCustomerId);
    await supabase.from('auto_surveys').delete().eq('customer_id', testCustomerId);
    await supabase.from('auto_customer_health_scores').delete().eq('customer_id', testCustomerId);
    await supabase.from('auto_next_best_actions').delete().eq('customer_id', testCustomerId);
    await supabase.from('auto_lost_analysis').delete().eq('customer_id', testCustomerId);
    await supabase.from('auto_customer_journeys').delete().eq('id', testJourneyId);
    await supabase.from('auto_survey_templates').delete().in('id', [testNpsTemplateId, testCsiTemplateId]);
    await supabase.from('customers').delete().eq('id', testCustomerId);
  });

  describe('NPS Survey Service', () => {
    it('should create NPS survey after vehicle delivery', async () => {
      const survey = await NPSSurveyService.createAutoSurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
        vehicleId: testVehicleId,
        deliveryId: '00000000-0000-0000-0000-000000000001',
        triggerEvent: 'vehicle_delivered',
      });

      expect(survey).toBeDefined();
      expect(survey.survey_type).toBe('nps');
      expect(survey.customer_id).toBe(testCustomerId);
    });

    it('should record NPS response and categorize correctly', async () => {
      // Create survey first
      const survey = await NPSSurveyService.createAutoSurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
        triggerEvent: 'vehicle_delivered',
      });

      // Record promoter response
      const npsScore = await NPSSurveyService.recordNPSResponse(
        survey.id,
        {
          score: 9,
          feedbackText: 'Excellent service!',
        },
        TEST_TENANT_ID
      );

      expect(npsScore.score).toBe(9);
      expect(npsScore.category).toBe('promoter');
      expect(npsScore.follow_up_required).toBe(false);
    });

    it('should auto-flag detractors for follow-up', async () => {
      const survey = await NPSSurveyService.createAutoSurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
        triggerEvent: 'vehicle_delivered',
      });

      const npsScore = await NPSSurveyService.recordNPSResponse(
        survey.id,
        {
          score: 4,
          feedbackText: 'Price too high',
        },
        TEST_TENANT_ID
      );

      expect(npsScore.category).toBe('detractor');
      expect(npsScore.follow_up_required).toBe(true);

      // Check next best action was created
      const { data: actions } = await supabase
        .from('auto_next_best_actions')
        .select('*')
        .eq('customer_id', testCustomerId)
        .eq('action_type', 'follow_up_detractor');

      expect(actions).toBeDefined();
      expect(actions!.length).toBeGreaterThan(0);
    });

    it('should calculate NPS correctly', async () => {
      const nps = await NPSSurveyService.calculateNPS(
        TEST_TENANT_ID,
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(nps).toBeDefined();
      expect(nps.nps).toBeGreaterThanOrEqual(-100);
      expect(nps.nps).toBeLessThanOrEqual(100);
      expect(nps.promoters + nps.passives + nps.detractors).toBe(nps.totalResponses);
    });
  });

  describe('CSI Survey Service', () => {
    it('should create CSI survey after delivery', async () => {
      const survey = await CSISurveyService.createCSISurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
        vehicleId: testVehicleId,
        deliveryId: '00000000-0000-0000-0000-000000000002',
      });

      expect(survey).toBeDefined();
      expect(survey.survey_type).toBe('csi');
    });

    it('should record CSI response with all dimensions', async () => {
      const survey = await CSISurveyService.createCSISurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
      });

      const csiScore = await CSISurveyService.recordCSIResponse(
        survey.id,
        {
          salesConsultantScore: 4.5,
          facilityScore: 4.0,
          deliveryTimingScore: 3.5,
          vehicleQualityScore: 5.0,
          afterSalesScore: 4.0,
          positiveFeedback: 'Great experience overall',
        },
        TEST_TENANT_ID
      );

      expect(csiScore.overall_csi).toBeGreaterThan(0);
      expect(csiScore.overall_csi).toBeLessThanOrEqual(5);
      expect(csiScore.sales_consultant_score).toBe(4.5);
    });

    it('should create follow-up for low CSI scores', async () => {
      const survey = await CSISurveyService.createCSISurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
      });

      const csiScore = await CSISurveyService.recordCSIResponse(
        survey.id,
        {
          salesConsultantScore: 2.5,
          facilityScore: 2.0,
          deliveryTimingScore: 2.5,
          vehicleQualityScore: 3.0,
          afterSalesScore: 2.0,
          negativeFeedback: 'Poor service quality',
        },
        TEST_TENANT_ID
      );

      expect(csiScore.overall_csi).toBeLessThan(3.0);

      // Check next best action
      const { data: actions } = await supabase
        .from('auto_next_best_actions')
        .select('*')
        .eq('customer_id', testCustomerId)
        .eq('action_type', 'follow_up_low_csi');

      expect(actions!.length).toBeGreaterThan(0);
    });
  });

  describe('Customer Health Score Service', () => {
    it('should calculate customer health score', async () => {
      const healthScore = await CustomerHealthScoreService.calculateHealthScore(
        TEST_TENANT_ID,
        testCustomerId
      );

      expect(healthScore).toBeDefined();
      expect(healthScore.overall_health_score).toBeGreaterThanOrEqual(0);
      expect(healthScore.overall_health_score).toBeLessThanOrEqual(100);
      expect(healthScore.health_status).toBeDefined();
    });

    it('should identify risk factors', async () => {
      const healthScore = await CustomerHealthScoreService.calculateHealthScore(
        TEST_TENANT_ID,
        testCustomerId
      );

      expect(healthScore.risk_factors).toBeDefined();
      expect(Array.isArray(healthScore.risk_factors)).toBe(true);
    });

    it('should get at-risk customers', async () => {
      const atRiskCustomers = await CustomerHealthScoreService.getCustomersAtRisk(
        TEST_TENANT_ID,
        10
      );

      expect(Array.isArray(atRiskCustomers)).toBe(true);
    });
  });

  describe('Next Best Action Engine', () => {
    it('should generate recommendations for customer', async () => {
      const recommendations = await NextBestActionEngine.generateRecommendations(
        TEST_TENANT_ID,
        testCustomerId,
        testJourneyId
      );

      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        const action = recommendations[0];
        expect(action.action_type).toBeDefined();
        expect(action.action_priority).toBeDefined();
        expect(action.confidence_score).toBeGreaterThanOrEqual(0);
        expect(action.confidence_score).toBeLessThanOrEqual(1);
      }
    });

    it('should get pending actions', async () => {
      const pendingActions = await NextBestActionEngine.getPendingActions(
        TEST_TENANT_ID,
        undefined,
        20
      );

      expect(Array.isArray(pendingActions)).toBe(true);
    });

    it('should update action status', async () => {
      const recommendations = await NextBestActionEngine.generateRecommendations(
        TEST_TENANT_ID,
        testCustomerId
      );

      if (recommendations.length > 0) {
        await NextBestActionEngine.updateActionStatus(
          recommendations[0].id,
          TEST_TENANT_ID,
          'completed',
          'successful',
          'Test completion'
        );

        const { data: updated } = await supabase
          .from('auto_next_best_actions')
          .select('*')
          .eq('id', recommendations[0].id)
          .single();

        expect(updated!.status).toBe('completed');
        expect(updated!.outcome).toBe('successful');
      }
    });
  });

  describe('Lost Analysis AI Service', () => {
    it('should record lost opportunity', async () => {
      const lostAnalysis = await LostAnalysisAIService.recordLostOpportunity(
        TEST_TENANT_ID,
        {
          customerId: testCustomerId,
          journeyId: testJourneyId,
          lostAtStage: 'quotation',
          lostDate: new Date(),
          reason: {
            primary: 'price_too_high',
            secondary: ['competitor_better_offer'],
            category: 'price',
          },
          competitorInfo: {
            brand: 'Honda',
            model: 'Accord',
            price: 1200000000,
            priceDifference: 50000000,
          },
          customerFeedback: 'Found better deal elsewhere',
        }
      );

      expect(lostAnalysis).toBeDefined();
      expect(lostAnalysis.primary_reason).toBe('price_too_high');
      expect(lostAnalysis.competitor_brand).toBe('Honda');
    });

    it('should perform AI analysis on lost opportunity', async () => {
      const lostAnalysis = await LostAnalysisAIService.recordLostOpportunity(
        TEST_TENANT_ID,
        {
          customerId: testCustomerId,
          journeyId: testJourneyId,
          lostAtStage: 'negotiation',
          lostDate: new Date(),
          reason: {
            primary: 'competitor_better_offer',
            secondary: [],
            category: 'competition',
          },
          customerFeedback: 'Decided to go with competitor',
        }
      );

      // Run analysis synchronously for test stability
      await LostAnalysisAIService.performAIAnalysis(TEST_TENANT_ID, lostAnalysis.id);

      const { data: analyzed } = await supabase
        .from('auto_lost_analysis')
        .select('*')
        .eq('id', lostAnalysis.id)
        .single();

      expect(analyzed!.ai_analyzed).toBe(true);
      expect(analyzed!.ai_analysis_result).toBeDefined();
    });

    it('should get lost opportunity analytics', async () => {
      const analytics = await LostAnalysisAIService.getLostOpportunityAnalytics(
        TEST_TENANT_ID,
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(analytics).toBeDefined();
      expect(analytics.totalLost).toBeGreaterThanOrEqual(0);
      expect(analytics.byStage).toBeDefined();
      expect(analytics.byReason).toBeDefined();
    });

    it('should get prevention insights', async () => {
      const insights = await LostAnalysisAIService.getPreventionInsights(
        TEST_TENANT_ID,
        'last_90_days'
      );

      expect(insights).toBeDefined();
      expect(Array.isArray(insights.criticalIssues)).toBe(true);
      expect(Array.isArray(insights.processImprovements)).toBe(true);
      expect(Array.isArray(insights.trainingNeeds)).toBe(true);
      expect(Array.isArray(insights.competitiveThreats)).toBe(true);
    });
  });

  describe('Integration - Full Customer Journey', () => {
    it('should handle complete experience lifecycle', async () => {
      // 1. Create NPS survey
      const npsSurvey = await NPSSurveyService.createAutoSurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
        triggerEvent: 'vehicle_delivered',
      });

      // 2. Record NPS response
      const npsScore = await NPSSurveyService.recordNPSResponse(
        npsSurvey.id,
        { score: 8, feedbackText: 'Good experience' },
        TEST_TENANT_ID
      );

      // 3. Create CSI survey
      const csiSurvey = await CSISurveyService.createCSISurvey({
        tenantId: TEST_TENANT_ID,
        customerId: testCustomerId,
        journeyId: testJourneyId,
      });

      // 4. Record CSI response
      const csiScore = await CSISurveyService.recordCSIResponse(
        csiSurvey.id,
        {
          salesConsultantScore: 4.5,
          facilityScore: 4.2,
          deliveryTimingScore: 4.0,
          vehicleQualityScore: 4.8,
          afterSalesScore: 4.3,
        },
        TEST_TENANT_ID
      );

      // 5. Calculate health score
      const healthScore = await CustomerHealthScoreService.calculateHealthScore(
        TEST_TENANT_ID,
        testCustomerId
      );

      // 6. Generate recommendations
      const recommendations = await NextBestActionEngine.generateRecommendations(
        TEST_TENANT_ID,
        testCustomerId,
        testJourneyId
      );

      // Verify all steps completed
      expect(npsScore.category).toBe('passive');
      expect(csiScore.overall_csi).toBeGreaterThan(4.0);
      expect(healthScore.overall_health_score).toBeGreaterThan(0);
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
