/**
 * Bella Auto Phase 8 - Financial Reporting Service
 * 
 * Provides financial analytics and reporting specific to automotive business.
 * 
 * Features:
 * - Gross profit margin per vehicle sold
 * - Service center revenue analytics
 * - Commission tracking (bank loans, insurance, accessories)
 * - Revenue breakdown by source
 * - Financial performance metrics
 * 
 * @module bella-auto/services/FinancialReportingService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

interface DateRange {
  start: string;
  end: string;
}

interface SaleRow {
  id: string;
  vehicle_id: string;
  sale_price: number | null;
  sale_date: string;
  salesperson_id: string | null;
  salesperson_commission?: number | null;
  auto_vehicles: {
    id: string;
    make: string;
    model: string;
    purchase_price: number | null;
  };
}

interface RepairOrderRow {
  id: string;
  total_labor_cost: number | null;
  total_parts_cost: number | null;
  total_amount: number | null;
  service_type: string | null;
}

interface LoanRow {
  referral_commission_amount: number | null;
  commission_paid: boolean | null;
}

interface InsurancePolicyRow {
  referral_commission_amount: number | null;
  commission_paid: boolean | null;
}

interface TradeInRow {
  final_trade_in_value: number | null;
}

interface ExpenseRow {
  amount: number | null;
}

interface SalePriceRow {
  sale_price: number | null;
}

interface VehicleProfitMargin {
  saleId: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  salePrice: number;
  costPrice: number;
  grossProfit: number;
  profitMargin: number; // percentage
  saleDate: string;
  salesperson: string;
}

interface ServiceRevenue {
  totalRevenue: number;
  serviceCount: number;
  averageTicket: number;
  revenueByType: {
    maintenance: number;
    repair: number;
    warranty: number;
  };
  partsRevenue: number;
  laborRevenue: number;
}

interface CommissionBreakdown {
  totalCommission: number;
  vehicleSalesCommission: number;
  loanReferralCommission: number;
  insuranceReferralCommission: number;
  accessoriesCommission: number;
  commissionPaid: number;
  commissionPending: number;
}

interface RevenueBreakdown {
  totalRevenue: number;
  vehicleSales: number;
  serviceMaintenance: number;
  accessories: number;
  loanReferral: number;
  insuranceReferral: number;
  tradeIn: number;
}

interface FinancialMetrics {
  grossRevenue: number;
  netRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitMargin: number; // percentage
  operatingExpenses: number;
  netProfit: number;
  netProfitMargin: number; // percentage
  vehiclesSold: number;
  averageVehiclePrice: number;
  averageProfitPerVehicle: number;
}

export class FinancialReportingService {
  /**
   * Calculate profit margin for individual vehicle sales
   */
  static async getVehicleProfitMargins(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<VehicleProfitMargin[]> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_sales')
      .select(`
        id,
        vehicle_id,
        sale_price,
        sale_date,
        salesperson_id,
        auto_vehicles!inner (
          id,
          make,
          model,
          purchase_price
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');
    
    if (dateRange) {
      query = query
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch vehicle profit margins: ${error.message}`);
    }
    
    const margins: VehicleProfitMargin[] = (data || []).map((sale: SaleRow) => {
      const vehicle = sale.auto_vehicles;
      const salePrice = Number(sale.sale_price) || 0;
      const costPrice = Number(vehicle.purchase_price) || 0;
      const grossProfit = salePrice - costPrice;
      const profitMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;
      
      return {
        saleId: sale.id,
        vehicleId: vehicle.id,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        salePrice,
        costPrice,
        grossProfit,
        profitMargin,
        saleDate: sale.sale_date,
        salesperson: sale.salesperson_id || 'Unknown',
      };
    });
    
    return margins;
  }
  
  /**
   * Get service center revenue analytics
   */
  static async getServiceRevenue(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<ServiceRevenue> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_repair_orders')
      .select(`
        id,
        total_labor_cost,
        total_parts_cost,
        total_amount,
        service_type
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');
    
    if (dateRange) {
      query = query
        .gte('completed_date', dateRange.start)
        .lte('completed_date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch service revenue: ${error.message}`);
    }
    
    const revenue: ServiceRevenue = {
      totalRevenue: 0,
      serviceCount: data?.length || 0,
      averageTicket: 0,
      revenueByType: {
        maintenance: 0,
        repair: 0,
        warranty: 0,
      },
      partsRevenue: 0,
      laborRevenue: 0,
    };
    
    (data || []).forEach((order: RepairOrderRow) => {
      const totalAmount = Number(order.total_amount) || 0;
      const laborCost = Number(order.total_labor_cost) || 0;
      const partsCost = Number(order.total_parts_cost) || 0;
      
      revenue.totalRevenue += totalAmount;
      revenue.laborRevenue += laborCost;
      revenue.partsRevenue += partsCost;
      
      if (order.service_type === 'maintenance') {
        revenue.revenueByType.maintenance += totalAmount;
      } else if (order.service_type === 'repair') {
        revenue.revenueByType.repair += totalAmount;
      } else if (order.service_type === 'warranty') {
        revenue.revenueByType.warranty += totalAmount;
      }
    });
    
    revenue.averageTicket = revenue.serviceCount > 0 
      ? revenue.totalRevenue / revenue.serviceCount 
      : 0;
    
    return revenue;
  }
  
  /**
   * Get commission breakdown
   */
  static async getCommissionBreakdown(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<CommissionBreakdown> {
    const supabase = getPrimaryClient();
    
    const breakdown: CommissionBreakdown = {
      totalCommission: 0,
      vehicleSalesCommission: 0,
      loanReferralCommission: 0,
      insuranceReferralCommission: 0,
      accessoriesCommission: 0,
      commissionPaid: 0,
      commissionPending: 0,
    };
    
    // Get vehicle sales commission from auto_sales
    let salesQuery = supabase
      .from('auto_sales')
      .select('salesperson_commission')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');
    
    if (dateRange) {
      salesQuery = salesQuery
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end);
    }
    
    const { data: salesData } = await salesQuery;
    
    (salesData || []).forEach((sale: SalePriceRow) => {
      const commission = Number(sale.salesperson_commission) || 0;
      breakdown.vehicleSalesCommission += commission;
    });
    
    // Get loan referral commission
    let loanQuery = supabase
      .from('auto_loan_applications')
      .select('referral_commission_amount, commission_paid')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'disbursed']);
    
    if (dateRange) {
      loanQuery = loanQuery
        .gte('approved_at', dateRange.start)
        .lte('approved_at', dateRange.end);
    }
    
    const { data: loanData } = await loanQuery;
    
    (loanData || []).forEach((loan: LoanRow) => {
      const commission = Number(loan.referral_commission_amount) || 0;
      breakdown.loanReferralCommission += commission;
      
      if (loan.commission_paid) {
        breakdown.commissionPaid += commission;
      } else {
        breakdown.commissionPending += commission;
      }
    });
    
    // Get insurance referral commission
    let insuranceQuery = supabase
      .from('auto_insurance_policies')
      .select('referral_commission_amount, commission_paid')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
    
    if (dateRange) {
      insuranceQuery = insuranceQuery
        .gte('effective_date', dateRange.start)
        .lte('effective_date', dateRange.end);
    }
    
    const { data: insuranceData } = await insuranceQuery;
    
    (insuranceData || []).forEach((policy: InsurancePolicyRow) => {
      const commission = Number(policy.referral_commission_amount) || 0;
      breakdown.insuranceReferralCommission += commission;
      
      if (policy.commission_paid) {
        breakdown.commissionPaid += commission;
      } else {
        breakdown.commissionPending += commission;
      }
    });
    
    breakdown.totalCommission = 
      breakdown.vehicleSalesCommission +
      breakdown.loanReferralCommission +
      breakdown.insuranceReferralCommission +
      breakdown.accessoriesCommission;
    
    return breakdown;
  }
  
  /**
   * Get revenue breakdown by source
   */
  static async getRevenueBreakdown(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<RevenueBreakdown> {
    const supabase = getPrimaryClient();
    
    const breakdown: RevenueBreakdown = {
      totalRevenue: 0,
      vehicleSales: 0,
      serviceMaintenance: 0,
      accessories: 0,
      loanReferral: 0,
      insuranceReferral: 0,
      tradeIn: 0,
    };
    
    // Vehicle sales revenue
    let salesQuery = supabase
      .from('auto_sales')
      .select('sale_price')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');
    
    if (dateRange) {
      salesQuery = salesQuery
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end);
    }
    
    const { data: salesData } = await salesQuery;
    
    (salesData || []).forEach((sale: SalePriceRow) => {
      breakdown.vehicleSales += Number(sale.sale_price) || 0;
    });
    
    // Service revenue
    const serviceRevenue = await this.getServiceRevenue(tenantId, dateRange);
    breakdown.serviceMaintenance = serviceRevenue.totalRevenue;
    
    // Commission revenue
    const commission = await this.getCommissionBreakdown(tenantId, dateRange);
    breakdown.loanReferral = commission.loanReferralCommission;
    breakdown.insuranceReferral = commission.insuranceReferralCommission;
    
    // Trade-in revenue (negative if we bought)
    let tradeInQuery = supabase
      .from('auto_trade_in_appraisals')
      .select('final_trade_in_value')
      .eq('tenant_id', tenantId)
      .eq('status', 'accepted');
    
    if (dateRange) {
      tradeInQuery = tradeInQuery
        .gte('accepted_at', dateRange.start)
        .lte('accepted_at', dateRange.end);
    }
    
    const { data: tradeInData } = await tradeInQuery;
    
    (tradeInData || []).forEach((appraisal: TradeInRow) => {
      breakdown.tradeIn += Number(appraisal.final_trade_in_value) || 0;
    });
    
    breakdown.totalRevenue = 
      breakdown.vehicleSales +
      breakdown.serviceMaintenance +
      breakdown.accessories +
      breakdown.loanReferral +
      breakdown.insuranceReferral -
      breakdown.tradeIn; // Trade-in is cost
    
    return breakdown;
  }
  
  /**
   * Get comprehensive financial metrics
   */
  static async getFinancialMetrics(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<FinancialMetrics> {
    const supabase = getPrimaryClient();
    
    // Get revenue breakdown
    const revenueBreakdown = await this.getRevenueBreakdown(tenantId, dateRange);
    
    // Get vehicle profit margins
    const profitMargins = await this.getVehicleProfitMargins(tenantId, dateRange);
    
    // Calculate costs from profit margins
    let totalCost = 0;
    profitMargins.forEach(margin => {
      totalCost += margin.costPrice;
    });
    
    // Get operating expenses from expenses table
    let expensesQuery = supabase
      .from('expenses')
      .select('amount')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'paid']);
    
    if (dateRange) {
      expensesQuery = expensesQuery
        .gte('expense_date', dateRange.start)
        .lte('expense_date', dateRange.end);
    }
    
    const { data: expensesData } = await expensesQuery;
    
    let operatingExpenses = 0;
    (expensesData || []).forEach((expense: ExpenseRow) => {
      operatingExpenses += Number(expense.amount) || 0;
    });
    
    const grossRevenue = revenueBreakdown.totalRevenue;
    const grossProfit = grossRevenue - totalCost;
    const grossProfitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
    const netProfit = grossProfit - operatingExpenses;
    const netProfitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    
    const vehiclesSold = profitMargins.length;
    const averageVehiclePrice = vehiclesSold > 0 
      ? revenueBreakdown.vehicleSales / vehiclesSold 
      : 0;
    const averageProfitPerVehicle = vehiclesSold > 0 
      ? profitMargins.reduce((sum, m) => sum + m.grossProfit, 0) / vehiclesSold 
      : 0;
    
    return {
      grossRevenue,
      netRevenue: grossRevenue,
      totalCost,
      grossProfit,
      grossProfitMargin,
      operatingExpenses,
      netProfit,
      netProfitMargin,
      vehiclesSold,
      averageVehiclePrice,
      averageProfitPerVehicle,
    };
  }
  
  /**
   * Get top performing vehicles by profit
   */
  static async getTopPerformingVehicles(
    tenantId: string,
    dateRange?: DateRange,
    limit: number = 10
  ): Promise<VehicleProfitMargin[]> {
    const margins = await this.getVehicleProfitMargins(tenantId, dateRange);
    
    return margins
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, limit);
  }
  
  /**
   * Get salesperson performance by commission
   */
  static async getSalespersonPerformance(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<Array<{
    salespersonId: string;
    vehiclesSold: number;
    totalRevenue: number;
    totalCommission: number;
    averageMargin: number;
  }>> {
    const margins = await this.getVehicleProfitMargins(tenantId, dateRange);
    
    const performanceMap = new Map<string, {
      vehiclesSold: number;
      totalRevenue: number;
      totalProfit: number;
      totalCommission: number;
    }>();
    
    margins.forEach(margin => {
      const existing = performanceMap.get(margin.salesperson) || {
        vehiclesSold: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalCommission: 0,
      };
      
      existing.vehiclesSold += 1;
      existing.totalRevenue += margin.salePrice;
      existing.totalProfit += margin.grossProfit;
      // Commission calculation would come from auto_sales table
      
      performanceMap.set(margin.salesperson, existing);
    });
    
    return Array.from(performanceMap.entries()).map(([salespersonId, data]) => ({
      salespersonId,
      vehiclesSold: data.vehiclesSold,
      totalRevenue: data.totalRevenue,
      totalCommission: data.totalCommission,
      averageMargin: data.vehiclesSold > 0 
        ? (data.totalProfit / data.totalRevenue) * 100 
        : 0,
    }));
  }
  
  /**
   * Generate monthly financial summary
   */
  static async getMonthlySummary(tenantId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    const dateRange = { start: startDate, end: endDate };
    
    const [metrics, revenueBreakdown, commission, serviceRevenue] = await Promise.all([
      this.getFinancialMetrics(tenantId, dateRange),
      this.getRevenueBreakdown(tenantId, dateRange),
      this.getCommissionBreakdown(tenantId, dateRange),
      this.getServiceRevenue(tenantId, dateRange),
    ]);
    
    return {
      period: { year, month, startDate, endDate },
      metrics,
      revenueBreakdown,
      commission,
      serviceRevenue,
    };
  }
}
