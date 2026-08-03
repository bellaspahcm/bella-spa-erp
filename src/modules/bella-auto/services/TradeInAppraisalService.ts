/**
 * Trade-In Appraisal Service
 * Manages trade-in vehicle appraisals, technical checklists, and valuation
 * 
 * @module bella-auto/services/TradeInAppraisalService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type TradeInAppraisal = Database['public']['Tables']['auto_trade_in_appraisals']['Row'];
type TradeInAppraisalInsert = Database['public']['Tables']['auto_trade_in_appraisals']['Insert'];
type MarketValuation = Database['public']['Tables']['auto_market_valuations']['Row'];

export interface CreateTradeInAppraisalData {
  tenantId: string;
  customerId?: string;
  vehicleId?: string;
  
  // Vehicle details (if not in system)
  vin?: string;
  licensePlate?: string;
  make: string;
  model: string;
  year: number;
  variant?: string;
  color?: string;
  
  // Basic info
  mileage: number;
  registrationDate?: Date;
  firstRegistrationDate?: Date;
  numberOfOwners?: number;
  
  // Appraiser
  appraisedBy?: string;
  appraiserName?: string;
  
  // Customer expectations
  customerExpectations?: string;
}

export interface TechnicalChecklistUpdate {
  engineCondition?: any;
  transmissionCondition?: any;
  exteriorCondition?: any;
  interiorCondition?: any;
  tiresBrakesCondition?: any;
  documentsCondition?: any;
  overallCondition?: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
  overallNotes?: string;
}

export interface ValuationResult {
  estimatedMarketValue: number;
  marketLow: number;
  marketAverage: number;
  marketHigh: number;
  suggestedTradeInValue: number;
  depreciationFactors: Array<{
    factor: string;
    impact: number; // percentage
    reason: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
}

export class TradeInAppraisalService {
  /**
   * Create a new trade-in appraisal
   */
  static async createAppraisal(
    data: CreateTradeInAppraisalData
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    // Generate appraisal number
    const { data: appraisalNumber } = await supabase
      .rpc('generate_trade_in_appraisal_number', { p_tenant_id: data.tenantId });

    if (!appraisalNumber) {
      throw new Error('Failed to generate appraisal number');
    }

    const appraisalData: TradeInAppraisalInsert = {
      tenant_id: data.tenantId,
      appraisal_number: appraisalNumber,
      customer_id: data.customerId,
      vehicle_id: data.vehicleId,
      vin: data.vin,
      license_plate: data.licensePlate,
      make: data.make,
      model: data.model,
      year: data.year,
      variant: data.variant,
      color: data.color,
      mileage: data.mileage,
      registration_date: data.registrationDate?.toISOString().split('T')[0],
      first_registration_date: data.firstRegistrationDate?.toISOString().split('T')[0],
      number_of_owners: data.numberOfOwners,
      appraised_by: data.appraisedBy,
      appraiser_name: data.appraiserName,
      customer_expectations: data.customerExpectations,
      status: 'draft',
    };

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .insert(appraisalData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create appraisal: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Update technical checklist
   */
  static async updateTechnicalChecklist(
    appraisalId: string,
    tenantId: string,
    checklist: TechnicalChecklistUpdate
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    const updateData: any = {};

    if (checklist.engineCondition !== undefined) {
      updateData.engine_condition = checklist.engineCondition;
    }
    if (checklist.transmissionCondition !== undefined) {
      updateData.transmission_condition = checklist.transmissionCondition;
    }
    if (checklist.exteriorCondition !== undefined) {
      updateData.exterior_condition = checklist.exteriorCondition;
    }
    if (checklist.interiorCondition !== undefined) {
      updateData.interior_condition = checklist.interiorCondition;
    }
    if (checklist.tiresBrakesCondition !== undefined) {
      updateData.tires_brakes_condition = checklist.tiresBrakesCondition;
    }
    if (checklist.documentsCondition !== undefined) {
      updateData.documents_condition = checklist.documentsCondition;
    }
    if (checklist.overallCondition !== undefined) {
      updateData.overall_condition = checklist.overallCondition;
    }
    if (checklist.overallNotes !== undefined) {
      updateData.overall_notes = checklist.overallNotes;
    }

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update(updateData)
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update checklist: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Calculate market valuation using valuation engine
   */
  static async calculateValuation(
    appraisalId: string,
    tenantId: string
  ): Promise<ValuationResult> {
    const supabase = getPrimaryClient();

    // Get appraisal details
    const { data: appraisal, error: appraisalError } = await supabase
      .from('auto_trade_in_appraisals')
      .select('*')
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .single();

    if (appraisalError || !appraisal) {
      throw new Error(`Appraisal not found: ${appraisalError?.message}`);
    }

    // Get market valuation data
    const { data: marketData } = await supabase
      .from('auto_market_valuations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('make', appraisal.make)
      .eq('model', appraisal.model)
      .eq('year', appraisal.year)
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString().split('T')[0])
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    let baseValue = 0;
    let marketLow = 0;
    let marketHigh = 0;

    if (marketData) {
      // Use market data based on overall condition
      switch (appraisal.overall_condition) {
        case 'excellent':
          baseValue = Number(marketData.price_excellent || 0);
          break;
        case 'good':
          baseValue = Number(marketData.price_good || 0);
          break;
        case 'fair':
          baseValue = Number(marketData.price_fair || 0);
          break;
        case 'poor':
        case 'very_poor':
          baseValue = Number(marketData.price_poor || 0);
          break;
        default:
          baseValue = Number(marketData.price_good || 0);
      }

      marketLow = Number(marketData.price_poor || 0);
      marketHigh = Number(marketData.price_excellent || 0);
    } else {
      // Fallback: Estimate based on depreciation (very rough)
      const currentYear = new Date().getFullYear();
      const vehicleAge = currentYear - appraisal.year;
      const depreciationRate = 0.15; // 15% per year
      const estimatedNewPrice = 500000000; // 500M VND (fallback)
      
      baseValue = estimatedNewPrice * Math.pow(1 - depreciationRate, vehicleAge);
      marketLow = baseValue * 0.8;
      marketHigh = baseValue * 1.2;
    }

    // Calculate depreciation factors
    const depreciationFactors: Array<{
      factor: string;
      impact: number;
      reason: string;
    }> = [];

    // Mileage depreciation
    const avgMileagePerYear = 15000; // km
    const expectedMileage = (new Date().getFullYear() - appraisal.year) * avgMileagePerYear;
    const mileageDiff = appraisal.mileage - expectedMileage;
    
    if (mileageDiff > 20000) {
      const impact = Math.min(15, (mileageDiff / 10000) * 2);
      depreciationFactors.push({
        factor: 'High Mileage',
        impact: -impact,
        reason: `${appraisal.mileage.toLocaleString()} km (${mileageDiff.toLocaleString()} km trên trung bình)`,
      });
      baseValue *= (1 - impact / 100);
    } else if (mileageDiff < -10000) {
      const impact = Math.min(5, Math.abs(mileageDiff) / 10000 * 2);
      depreciationFactors.push({
        factor: 'Low Mileage',
        impact: impact,
        reason: `${appraisal.mileage.toLocaleString()} km (thấp hơn trung bình)`,
      });
      baseValue *= (1 + impact / 100);
    }

    // Number of owners
    if (appraisal.number_of_owners && appraisal.number_of_owners > 2) {
      const impact = (appraisal.number_of_owners - 2) * 3;
      depreciationFactors.push({
        factor: 'Multiple Owners',
        impact: -impact,
        reason: `${appraisal.number_of_owners} chủ sở hữu`,
      });
      baseValue *= (1 - impact / 100);
    } else if (appraisal.number_of_owners === 1) {
      depreciationFactors.push({
        factor: 'Single Owner',
        impact: 3,
        reason: 'Chủ đầu tiên',
      });
      baseValue *= 1.03;
    }

    // Overall condition adjustment
    if (appraisal.overall_condition === 'poor' || appraisal.overall_condition === 'very_poor') {
      depreciationFactors.push({
        factor: 'Poor Condition',
        impact: -10,
        reason: 'Tình trạng xe kém',
      });
      baseValue *= 0.9;
    }

    // Calculate suggested trade-in value (70-80% of market value)
    const tradeInPercentage = 0.75; // 75% of estimated market value
    const suggestedTradeInValue = Math.round(baseValue * tradeInPercentage / 1000000) * 1000000; // Round to nearest million

    const marketAverage = (marketLow + marketHigh) / 2;
    const estimatedMarketValue = Math.round(baseValue / 1000000) * 1000000;

    // Confidence level
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (marketData) {
      confidence = 'high';
    } else {
      confidence = 'low';
    }

    const result: ValuationResult = {
      estimatedMarketValue,
      marketLow,
      marketAverage,
      marketHigh,
      suggestedTradeInValue,
      depreciationFactors,
      confidence,
    };

    // Update appraisal with valuation
    await supabase
      .from('auto_trade_in_appraisals')
      .update({
        estimated_market_value: estimatedMarketValue,
        offered_trade_in_value: suggestedTradeInValue,
        market_low: marketLow,
        market_average: marketAverage,
        market_high: marketHigh,
      })
      .eq('id', appraisalId);

    return result;
  }

  /**
   * Submit appraisal for approval
   */
  static async submitForApproval(
    appraisalId: string,
    tenantId: string,
    submittedBy: string
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    // First calculate valuation if not done
    const { data: currentAppraisal } = await supabase
      .from('auto_trade_in_appraisals')
      .select('estimated_market_value')
      .eq('id', appraisalId)
      .single();

    if (!currentAppraisal?.estimated_market_value) {
      await this.calculateValuation(appraisalId, tenantId);
    }

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update({
        status: 'pending_approval',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit for approval: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Approve appraisal (manager action)
   */
  static async approveAppraisal(
    appraisalId: string,
    tenantId: string,
    approvedBy: string,
    approverName: string,
    finalTradeInValue?: number
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    const updateData: any = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      approver_name: approverName,
    };

    if (finalTradeInValue !== undefined) {
      updateData.final_trade_in_value = finalTradeInValue;
    }

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update(updateData)
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve appraisal: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Send offer to customer
   */
  static async sendOfferToCustomer(
    appraisalId: string,
    tenantId: string,
    expiresInDays: number = 7
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update({
        status: 'offer_sent',
        offer_sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to send offer: ${error.message}`);
    }

    // TODO: Integrate with notification service to send email/SMS
    console.log(`[TradeIn] Offer sent to customer: ${appraisal.appraisal_number}`);

    return appraisal;
  }

  /**
   * Customer accepts offer
   */
  static async acceptOffer(
    appraisalId: string,
    tenantId: string
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update({
        status: 'accepted',
        customer_response_at: new Date().toISOString(),
      })
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to accept offer: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Customer rejects offer
   */
  static async rejectOffer(
    appraisalId: string,
    tenantId: string,
    reason?: string
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update({
        status: 'rejected',
        customer_response_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reject offer: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Link trade-in to new vehicle sale (as partial payment)
   */
  static async linkToSale(
    appraisalId: string,
    tenantId: string,
    saleId: string,
    useAsDownPayment: boolean = true
  ): Promise<TradeInAppraisal> {
    const supabase = getPrimaryClient();

    const { data: appraisal, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        linked_sale_id: saleId,
        used_as_down_payment: useAsDownPayment,
      })
      .eq('id', appraisalId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to link to sale: ${error.message}`);
    }

    return appraisal;
  }

  /**
   * Get appraisals by status
   */
  static async getAppraisalsByStatus(
    tenantId: string,
    status: string,
    limit?: number
  ): Promise<TradeInAppraisal[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_trade_in_appraisals')
      .select('*, customers(*)')
      .eq('tenant_id', tenantId)
      .eq('status', status)
      .order('appraisal_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get appraisals: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get appraisal statistics
   */
  static async getAppraisalStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalValuation: number;
    averageValuation: number;
    acceptanceRate: number;
    linkedToSales: number;
  }> {
    const supabase = getPrimaryClient();

    const { data: appraisals, error } = await supabase
      .from('auto_trade_in_appraisals')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('appraisal_date', startDate.toISOString().split('T')[0])
      .lte('appraisal_date', endDate.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    if (!appraisals || appraisals.length === 0) {
      return {
        total: 0,
        byStatus: {},
        totalValuation: 0,
        averageValuation: 0,
        acceptanceRate: 0,
        linkedToSales: 0,
      };
    }

    const byStatus: Record<string, number> = {};
    let totalValuation = 0;
    let offersCount = 0;
    let acceptedCount = 0;
    let linkedToSales = 0;

    for (const appraisal of appraisals) {
      byStatus[appraisal.status] = (byStatus[appraisal.status] || 0) + 1;

      if (appraisal.final_trade_in_value) {
        totalValuation += Number(appraisal.final_trade_in_value);
      } else if (appraisal.offered_trade_in_value) {
        totalValuation += Number(appraisal.offered_trade_in_value);
      }

      if (appraisal.status === 'offer_sent' || appraisal.status === 'accepted' || appraisal.status === 'rejected') {
        offersCount++;
      }

      if (appraisal.status === 'accepted' || appraisal.status === 'completed') {
        acceptedCount++;
      }

      if (appraisal.linked_sale_id) {
        linkedToSales++;
      }
    }

    const acceptanceRate = offersCount > 0 ? (acceptedCount / offersCount) * 100 : 0;
    const averageValuation = appraisals.length > 0 ? totalValuation / appraisals.length : 0;

    return {
      total: appraisals.length,
      byStatus,
      totalValuation,
      averageValuation,
      acceptanceRate: Math.round(acceptanceRate * 10) / 10,
      linkedToSales,
    };
  }

  /**
   * Check and expire old offers
   */
  static async expireOldOffers(tenantId: string): Promise<number> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_trade_in_appraisals')
      .update({ status: 'expired' })
      .eq('tenant_id', tenantId)
      .eq('status', 'offer_sent')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to expire offers: ${error.message}`);
    }

    return data?.length || 0;
  }
}
