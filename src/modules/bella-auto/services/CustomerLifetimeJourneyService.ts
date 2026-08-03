/**
 * Bella Auto Phase 9 - Customer Lifetime Journey Service
 * 
 * Provides comprehensive 10-year customer journey view aggregating all touchpoints.
 * 
 * Features:
 * - Lifetime event aggregation
 * - Financial impact tracking
 * - Milestone detection
 * - Sentiment analysis
 * - Journey summary statistics
 * 
 * @module bella-auto/services/CustomerLifetimeJourneyService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type LifetimeEvent = Database['public']['Tables']['auto_customer_lifetime_events']['Row'];
type LifetimeEventInsert = Database['public']['Tables']['auto_customer_lifetime_events']['Insert'];

type EventType =
  | 'first_contact'
  | 'test_drive'
  | 'quotation_sent'
  | 'deposit_paid'
  | 'vehicle_purchased'
  | 'vehicle_delivered'
  | 'first_service'
  | 'regular_service'
  | 'repair_visit'
  | 'warranty_claim'
  | 'insurance_renewal'
  | 'trade_in_inquiry'
  | 'trade_in_completed'
  | 'referral_made'
  | 'complaint'
  | 'compliment'
  | 'churn_warning'
  | 'win_back'
  | 'milestone';

type Sentiment = 'positive' | 'neutral' | 'negative';

interface CreateEventParams {
  tenantId: string;
  customerId: string;
  eventDate: string;
  eventType: EventType;
  eventTitle: string;
  eventDescription?: string;
  journeyId?: string;
  saleId?: string;
  vehicleId?: string;
  serviceAppointmentId?: string;
  repairOrderId?: string;
  revenueAmount?: number;
  costAmount?: number;
  profitAmount?: number;
  sentiment?: Sentiment;
  npsScore?: number;
  csiScore?: number;
  tags?: string[];
  isMilestone?: boolean;
  createdBy?: string;
}

export class CustomerLifetimeJourneyService {
  /**
   * Create lifetime event
   */
  static async createEvent(params: CreateEventParams): Promise<LifetimeEvent> {
    const supabase = getPrimaryClient();
    
    const eventData: LifetimeEventInsert = {
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      event_date: params.eventDate,
      event_type: params.eventType,
      event_title: params.eventTitle,
      event_description: params.eventDescription,
      journey_id: params.journeyId,
      sale_id: params.saleId,
      vehicle_id: params.vehicleId,
      service_appointment_id: params.serviceAppointmentId,
      repair_order_id: params.repairOrderId,
      revenue_amount: params.revenueAmount,
      cost_amount: params.costAmount,
      profit_amount: params.profitAmount,
      sentiment: params.sentiment,
      nps_score: params.npsScore,
      csi_score: params.csiScore,
      tags: params.tags,
      is_milestone: params.isMilestone || false,
      created_by: params.createdBy,
    };
    
    const { data, error } = await supabase
      .from('auto_customer_lifetime_events')
      .insert(eventData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create lifetime event: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get customer lifetime journey (all events)
   */
  static async getCustomerJourney(
    customerId: string,
    tenantId: string,
    limit?: number
  ): Promise<LifetimeEvent[]> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_customer_lifetime_events')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('event_date', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch customer journey: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get customer lifetime summary (using RPC)
   */
  static async getCustomerSummary(customerId: string, tenantId: string) {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('get_customer_lifetime_summary', {
        p_tenant_id: tenantId,
        p_customer_id: customerId,
      });
    
    if (error) {
      throw new Error(`Failed to fetch customer summary: ${error.message}`);
    }
    
    return data?.[0] || null;
  }
  
  /**
   * Get events by type
   */
  static async getEventsByType(
    customerId: string,
    tenantId: string,
    eventType: EventType
  ): Promise<LifetimeEvent[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_customer_lifetime_events')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('event_type', eventType)
      .order('event_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch events by type: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get milestone events
   */
  static async getMilestones(
    customerId: string,
    tenantId: string
  ): Promise<LifetimeEvent[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_customer_lifetime_events')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('is_milestone', true)
      .order('event_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch milestones: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get events by date range
   */
  static async getEventsByDateRange(
    customerId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<LifetimeEvent[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_customer_lifetime_events')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch events by date range: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get financial summary for customer
   */
  static async getFinancialSummary(customerId: string, tenantId: string) {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_customer_lifetime_events')
      .select('revenue_amount, cost_amount, profit_amount')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId);
    
    if (error) {
      throw new Error(`Failed to fetch financial summary: ${error.message}`);
    }
    
    const summary = {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      transactionCount: data.length,
    };
    
    data.forEach(event => {
      summary.totalRevenue += Number(event.revenue_amount) || 0;
      summary.totalCost += Number(event.cost_amount) || 0;
      summary.totalProfit += Number(event.profit_amount) || 0;
    });
    
    return summary;
  }
  
  /**
   * Get sentiment analysis
   */
  static async getSentimentAnalysis(customerId: string, tenantId: string) {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_customer_lifetime_events')
      .select('sentiment, nps_score, csi_score, event_date')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .not('sentiment', 'is', null);
    
    if (error) {
      throw new Error(`Failed to fetch sentiment analysis: ${error.message}`);
    }
    
    const analysis = {
      totalEvents: data.length,
      positive: 0,
      neutral: 0,
      negative: 0,
      averageNPS: 0,
      averageCSI: 0,
      sentimentTrend: 'stable' as 'improving' | 'stable' | 'declining',
    };
    
    let npsSum = 0;
    let npsCount = 0;
    let csiSum = 0;
    let csiCount = 0;
    
    data.forEach(event => {
      if (event.sentiment === 'positive') analysis.positive++;
      else if (event.sentiment === 'neutral') analysis.neutral++;
      else if (event.sentiment === 'negative') analysis.negative++;
      
      if (event.nps_score !== null) {
        npsSum += event.nps_score;
        npsCount++;
      }
      
      if (event.csi_score !== null) {
        csiSum += Number(event.csi_score);
        csiCount++;
      }
    });
    
    analysis.averageNPS = npsCount > 0 ? npsSum / npsCount : 0;
    analysis.averageCSI = csiCount > 0 ? csiSum / csiCount : 0;
    
    // Simple trend analysis (compare first half vs second half)
    if (data.length >= 4) {
      const mid = Math.floor(data.length / 2);
      const firstHalf = data.slice(0, mid);
      const secondHalf = data.slice(mid);
      
      const firstPositive = firstHalf.filter(e => e.sentiment === 'positive').length / firstHalf.length;
      const secondPositive = secondHalf.filter(e => e.sentiment === 'positive').length / secondHalf.length;
      
      if (secondPositive > firstPositive + 0.1) analysis.sentimentTrend = 'improving';
      else if (secondPositive < firstPositive - 0.1) analysis.sentimentTrend = 'declining';
    }
    
    return analysis;
  }
  
  /**
   * Detect and create milestone events
   */
  static async detectMilestones(customerId: string, tenantId: string): Promise<LifetimeEvent[]> {
    const events = await this.getCustomerJourney(customerId, tenantId);
    const milestones: LifetimeEvent[] = [];
    
    // Milestone 1: First purchase
    const firstPurchase = events.find(e => e.event_type === 'vehicle_purchased');
    if (firstPurchase && !firstPurchase.is_milestone) {
      const milestone = await this.createEvent({
        tenantId,
        customerId,
        eventDate: firstPurchase.event_date,
        eventType: 'milestone',
        eventTitle: '🎉 First Vehicle Purchase',
        eventDescription: 'Customer made their first vehicle purchase',
        saleId: firstPurchase.sale_id || undefined,
        vehicleId: firstPurchase.vehicle_id || undefined,
        sentiment: 'positive',
        isMilestone: true,
        tags: ['milestone', 'first_purchase'],
      });
      milestones.push(milestone);
    }
    
    // Milestone 2: 1-year ownership
    const deliveryEvents = events.filter(e => e.event_type === 'vehicle_delivered');
    for (const delivery of deliveryEvents) {
      const deliveryDate = new Date(delivery.event_date);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (deliveryDate <= oneYearAgo) {
        const existingMilestone = events.find(
          e => e.event_type === 'milestone' && 
          e.tags?.includes('1_year_ownership') &&
          e.vehicle_id === delivery.vehicle_id
        );
        
        if (!existingMilestone) {
          const milestoneDate = new Date(deliveryDate);
          milestoneDate.setFullYear(milestoneDate.getFullYear() + 1);
          
          const milestone = await this.createEvent({
            tenantId,
            customerId,
            eventDate: milestoneDate.toISOString().split('T')[0],
            eventType: 'milestone',
            eventTitle: '🎊 1-Year Ownership Anniversary',
            eventDescription: 'Customer has owned vehicle for 1 year',
            vehicleId: delivery.vehicle_id || undefined,
            sentiment: 'positive',
            isMilestone: true,
            tags: ['milestone', '1_year_ownership'],
          });
          milestones.push(milestone);
        }
      }
    }
    
    // Milestone 3: 10 service visits
    const serviceVisits = events.filter(e => 
      e.event_type === 'regular_service' || e.event_type === 'repair_visit'
    );
    
    if (serviceVisits.length >= 10) {
      const tenthVisit = serviceVisits[serviceVisits.length - 10];
      const existingMilestone = events.find(
        e => e.event_type === 'milestone' && e.tags?.includes('10_services')
      );
      
      if (!existingMilestone) {
        const milestone = await this.createEvent({
          tenantId,
          customerId,
          eventDate: tenthVisit.event_date,
          eventType: 'milestone',
          eventTitle: '⭐ 10 Service Visits',
          eventDescription: 'Customer completed 10 service visits - loyal customer',
          sentiment: 'positive',
          isMilestone: true,
          tags: ['milestone', '10_services', 'loyalty'],
        });
        milestones.push(milestone);
      }
    }
    
    return milestones;
  }
  
  /**
   * Get journey timeline (grouped by year)
   */
  static async getTimelineByYear(customerId: string, tenantId: string) {
    const events = await this.getCustomerJourney(customerId, tenantId);
    
    const timelineByYear = new Map<number, LifetimeEvent[]>();
    
    events.forEach(event => {
      const year = new Date(event.event_date).getFullYear();
      if (!timelineByYear.has(year)) {
        timelineByYear.set(year, []);
      }
      timelineByYear.get(year)!.push(event);
    });
    
    // Convert to array and sort by year descending
    return Array.from(timelineByYear.entries())
      .map(([year, yearEvents]) => ({
        year,
        eventCount: yearEvents.length,
        events: yearEvents.sort((a, b) => 
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        ),
        revenue: yearEvents.reduce((sum, e) => sum + (Number(e.revenue_amount) || 0), 0),
        profit: yearEvents.reduce((sum, e) => sum + (Number(e.profit_amount) || 0), 0),
      }))
      .sort((a, b) => b.year - a.year);
  }
  
  /**
   * Export customer journey to timeline format
   */
  static async exportToTimeline(customerId: string, tenantId: string) {
    const [journey, summary, financial, sentiment] = await Promise.all([
      this.getCustomerJourney(customerId, tenantId),
      this.getCustomerSummary(customerId, tenantId),
      this.getFinancialSummary(customerId, tenantId),
      this.getSentimentAnalysis(customerId, tenantId),
    ]);
    
    return {
      customerId,
      summary,
      financial,
      sentiment,
      timeline: journey,
      exportDate: new Date().toISOString(),
    };
  }
}
