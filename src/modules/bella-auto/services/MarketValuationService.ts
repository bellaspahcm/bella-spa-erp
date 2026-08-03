/**
 * Market Valuation Service
 * Manages market price data for trade-in valuation engine
 * 
 * @module bella-auto/services/MarketValuationService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type MarketValuation = Database['public']['Tables']['auto_market_valuations']['Row'];
type MarketValuationInsert = Database['public']['Tables']['auto_market_valuations']['Insert'];

export interface CreateMarketValuationData {
  tenantId: string;
  make: string;
  model: string;
  year: number;
  variant?: string;
  
  // Mileage bracket
  mileageBracketStart?: number;
  mileageBracketEnd?: number;
  
  // Prices by condition
  priceExcellent?: number;
  priceGood?: number;
  priceFair?: number;
  pricePoor?: number;
  
  // Source
  dataSource?: string;
  sourceUrl?: string;
  
  // Validity
  effectiveDate?: Date;
  expiresAt?: Date;
  
  // Regional
  region?: string;
  regionalAdjustmentPercentage?: number;
  
  // Additional factors
  popularityScore?: number;
  depreciationRate?: number;
  
  notes?: string;
  createdBy?: string;
}

export interface MarketPriceQuery {
  make: string;
  model: string;
  year: number;
  variant?: string;
  mileage?: number;
  region?: string;
}

export class MarketValuationService {
  /**
   * Create market valuation record
   */
  static async createMarketValuation(
    data: CreateMarketValuationData
  ): Promise<MarketValuation> {
    const supabase = getPrimaryClient();

    const valuationData: MarketValuationInsert = {
      tenant_id: data.tenantId,
      make: data.make,
      model: data.model,
      year: data.year,
      variant: data.variant,
      mileage_bracket_start: data.mileageBracketStart,
      mileage_bracket_end: data.mileageBracketEnd,
      price_excellent: data.priceExcellent,
      price_good: data.priceGood,
      price_fair: data.priceFair,
      price_poor: data.pricePoor,
      data_source: data.dataSource || 'manual_entry',
      source_url: data.sourceUrl,
      effective_date: data.effectiveDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      expires_at: data.expiresAt?.toISOString().split('T')[0],
      is_active: true,
      region: data.region,
      regional_adjustment_percentage: data.regionalAdjustmentPercentage || 0,
      popularity_score: data.popularityScore,
      depreciation_rate: data.depreciationRate,
      notes: data.notes,
      created_by: data.createdBy,
    };

    const { data: valuation, error } = await supabase
      .from('auto_market_valuations')
      .insert(valuationData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create market valuation: ${error.message}`);
    }

    return valuation;
  }

  /**
   * Get market price for specific vehicle
   */
  static async getMarketPrice(
    tenantId: string,
    query: MarketPriceQuery
  ): Promise<MarketValuation | null> {
    const supabase = getPrimaryClient();

    let dbQuery = supabase
      .from('auto_market_valuations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('make', query.make)
      .eq('model', query.model)
      .eq('year', query.year)
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString().split('T')[0])
      .order('effective_date', { ascending: false });

    if (query.variant) {
      dbQuery = dbQuery.eq('variant', query.variant);
    }

    if (query.region) {
      dbQuery = dbQuery.eq('region', query.region);
    }

    // Filter by mileage bracket if mileage provided
    if (query.mileage !== undefined) {
      dbQuery = dbQuery
        .or(`mileage_bracket_start.is.null,mileage_bracket_start.lte.${query.mileage}`)
        .or(`mileage_bracket_end.is.null,mileage_bracket_end.gte.${query.mileage}`);
    }

    const { data, error } = await dbQuery.limit(1).single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found", which is ok
      throw new Error(`Failed to get market price: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Update market valuation
   */
  static async updateMarketValuation(
    valuationId: string,
    tenantId: string,
    updates: Partial<CreateMarketValuationData>
  ): Promise<MarketValuation> {
    const supabase = getPrimaryClient();

    const updateData: any = {};

    if (updates.priceExcellent !== undefined) updateData.price_excellent = updates.priceExcellent;
    if (updates.priceGood !== undefined) updateData.price_good = updates.priceGood;
    if (updates.priceFair !== undefined) updateData.price_fair = updates.priceFair;
    if (updates.pricePoor !== undefined) updateData.price_poor = updates.pricePoor;
    if (updates.dataSource !== undefined) updateData.data_source = updates.dataSource;
    if (updates.sourceUrl !== undefined) updateData.source_url = updates.sourceUrl;
    if (updates.effectiveDate !== undefined) {
      updateData.effective_date = updates.effectiveDate.toISOString().split('T')[0];
    }
    if (updates.expiresAt !== undefined) {
      updateData.expires_at = updates.expiresAt.toISOString().split('T')[0];
    }
    if (updates.region !== undefined) updateData.region = updates.region;
    if (updates.regionalAdjustmentPercentage !== undefined) {
      updateData.regional_adjustment_percentage = updates.regionalAdjustmentPercentage;
    }
    if (updates.popularityScore !== undefined) updateData.popularity_score = updates.popularityScore;
    if (updates.depreciationRate !== undefined) updateData.depreciation_rate = updates.depreciationRate;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data: valuation, error } = await supabase
      .from('auto_market_valuations')
      .update(updateData)
      .eq('id', valuationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update market valuation: ${error.message}`);
    }

    return valuation;
  }

  /**
   * Deactivate market valuation
   */
  static async deactivateMarketValuation(
    valuationId: string,
    tenantId: string
  ): Promise<MarketValuation> {
    const supabase = getPrimaryClient();

    const { data: valuation, error } = await supabase
      .from('auto_market_valuations')
      .update({ is_active: false })
      .eq('id', valuationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deactivate valuation: ${error.message}`);
    }

    return valuation;
  }

  /**
   * Get all market valuations
   */
  static async getAllMarketValuations(
    tenantId: string,
    activeOnly: boolean = true
  ): Promise<MarketValuation[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_market_valuations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('make', { ascending: true })
      .order('model', { ascending: true })
      .order('year', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get market valuations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Bulk import market valuations (from CSV/API)
   */
  static async bulkImportMarketValuations(
    tenantId: string,
    valuations: CreateMarketValuationData[]
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const valuation of valuations) {
      try {
        await this.createMarketValuation(valuation);
        imported++;
      } catch (error) {
        failed++;
        errors.push(`${valuation.make} ${valuation.model} ${valuation.year}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, failed, errors };
  }

  /**
   * Get price trend for vehicle
   */
  static async getPriceTrend(
    tenantId: string,
    make: string,
    model: string,
    year: number,
    months: number = 12
  ): Promise<Array<{
    date: string;
    priceExcellent: number;
    priceGood: number;
    priceFair: number;
    pricePoor: number;
  }>> {
    const supabase = getPrimaryClient();

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('auto_market_valuations')
      .select('effective_date, price_excellent, price_good, price_fair, price_poor')
      .eq('tenant_id', tenantId)
      .eq('make', make)
      .eq('model', model)
      .eq('year', year)
      .gte('effective_date', startDate.toISOString().split('T')[0])
      .order('effective_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get price trend: ${error.message}`);
    }

    return (data || []).map(item => ({
      date: item.effective_date,
      priceExcellent: Number(item.price_excellent || 0),
      priceGood: Number(item.price_good || 0),
      priceFair: Number(item.price_fair || 0),
      pricePoor: Number(item.price_poor || 0),
    }));
  }

  /**
   * Get market summary by make
   */
  static async getMarketSummaryByMake(
    tenantId: string
  ): Promise<Array<{
    make: string;
    totalModels: number;
    totalRecords: number;
    averagePrice: number;
    latestUpdate: string;
  }>> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_market_valuations')
      .select('make, model, price_good, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get market summary: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    // Group by make
    const summaryMap = new Map<string, {
      make: string;
      models: Set<string>;
      totalRecords: number;
      totalPrice: number;
      latestUpdate: string;
    }>();

    for (const item of data) {
      if (!summaryMap.has(item.make)) {
        summaryMap.set(item.make, {
          make: item.make,
          models: new Set(),
          totalRecords: 0,
          totalPrice: 0,
          latestUpdate: item.updated_at,
        });
      }

      const summary = summaryMap.get(item.make)!;
      summary.models.add(item.model);
      summary.totalRecords++;
      summary.totalPrice += Number(item.price_good || 0);
      
      if (new Date(item.updated_at) > new Date(summary.latestUpdate)) {
        summary.latestUpdate = item.updated_at;
      }
    }

    return Array.from(summaryMap.values()).map(summary => ({
      make: summary.make,
      totalModels: summary.models.size,
      totalRecords: summary.totalRecords,
      averagePrice: summary.totalRecords > 0 ? summary.totalPrice / summary.totalRecords : 0,
      latestUpdate: summary.latestUpdate,
    }));
  }

  /**
   * Check for expired valuations
   */
  static async checkExpiredValuations(tenantId: string): Promise<number> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_market_valuations')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString().split('T')[0])
      .select('id');

    if (error) {
      throw new Error(`Failed to expire valuations: ${error.message}`);
    }

    return data?.length || 0;
  }
}
