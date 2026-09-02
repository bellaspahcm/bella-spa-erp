/**
 * Bella Auto Phase 8 - Insurance Service
 * 
 * Manages vehicle insurance policies with auto-renewal reminders.
 * 
 * Features:
 * - Insurance policy lifecycle management
 * - Auto-renewal reminders (30 days before expiry)
 * - Coverage items tracking
 * - Commission tracking for insurance referrals
 * - Policy expiration monitoring
 * 
 * @module bella-auto/services/InsuranceService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type InsurancePolicy = Database['public']['Tables']['auto_insurance_policies']['Row'];
type InsurancePolicyInsert = Database['public']['Tables']['auto_insurance_policies']['Insert'];
type InsurancePolicyUpdate = Database['public']['Tables']['auto_insurance_policies']['Update'];

type PolicyType = 'compulsory' | 'voluntary' | 'comprehensive' | 'combined';
type PolicyStatus = 'draft' | 'active' | 'expired' | 'cancelled' | 'renewed';
type PaymentFrequency = 'annual' | 'semi_annual' | 'quarterly' | 'monthly';

interface CoverageItems {
  collision: boolean;
  theft: boolean;
  fire: boolean;
  flood: boolean;
  third_party_liability: boolean;
  personal_accident: boolean;
  passenger_accident: boolean;
}

interface CreateInsurancePolicyParams {
  tenantId: string;
  policyNumber: string;
  customerId: string;
  vehicleId: string;
  saleId?: string;
  insuranceCompany: string;
  insuranceBranch?: string;
  policyType: PolicyType;
  coverageAmount?: number;
  deductibleAmount?: number;
  coverageItems?: Partial<CoverageItems>;
  premiumAmount: number;
  premiumPaymentFrequency?: PaymentFrequency;
  effectiveDate: string;
  expiryDate: string;
  autoRenewal?: boolean;
  referralCommissionPercentage?: number;
  createdBy?: string;
}

interface ExpiringPolicy {
  policy_id: string;
  policy_number: string;
  customer_id: string;
  customer_name: string;
  vehicle_id: string;
  expiry_date: string;
  days_until_expiry: number;
  insurance_company: string;
  premium_amount: number;
}

export class InsuranceService {
  /**
   * Create new insurance policy
   */
  static async create(params: CreateInsurancePolicyParams): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    // Calculate commission amount if percentage provided
    const commissionAmount = params.referralCommissionPercentage
      ? (params.premiumAmount * params.referralCommissionPercentage) / 100
      : undefined;
    
    const policyData: InsurancePolicyInsert = {
      tenant_id: params.tenantId,
      policy_number: params.policyNumber,
      customer_id: params.customerId,
      vehicle_id: params.vehicleId,
      sale_id: params.saleId,
      insurance_company: params.insuranceCompany,
      insurance_branch: params.insuranceBranch,
      policy_type: params.policyType,
      coverage_amount: params.coverageAmount,
      deductible_amount: params.deductibleAmount,
      coverage_items: params.coverageItems as Database['public']['Tables']['auto_insurance_policies']['Row']['coverage_items'],
      premium_amount: params.premiumAmount,
      premium_payment_frequency: params.premiumPaymentFrequency,
      effective_date: params.effectiveDate,
      expiry_date: params.expiryDate,
      auto_renewal: params.autoRenewal ?? false,
      referral_commission_percentage: params.referralCommissionPercentage,
      referral_commission_amount: commissionAmount,
      status: 'draft',
      created_by: params.createdBy,
    };
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .insert(policyData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create insurance policy: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get insurance policy by ID
   */
  static async getById(policyId: string, tenantId: string): Promise<InsurancePolicy | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .select('*')
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch insurance policy: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get insurance policies by customer
   */
  static async getByCustomer(customerId: string, tenantId: string): Promise<InsurancePolicy[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch customer insurance policies: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get insurance policies by vehicle
   */
  static async getByVehicle(vehicleId: string, tenantId: string): Promise<InsurancePolicy[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch vehicle insurance policies: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get active insurance policy for vehicle
   */
  static async getActiveByVehicle(vehicleId: string, tenantId: string): Promise<InsurancePolicy | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch active vehicle insurance: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Update insurance policy status
   */
  static async updateStatus(
    policyId: string,
    tenantId: string,
    status: PolicyStatus,
    updatedBy?: string
  ): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    const updates: InsurancePolicyUpdate = {
      status,
      updated_by: updatedBy,
    };
    
    // Set is_active based on status
    if (status === 'active') {
      updates.is_active = true;
    } else if (status === 'expired' || status === 'cancelled' || status === 'renewed') {
      updates.is_active = false;
    }
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .update(updates)
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update insurance status: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Activate insurance policy
   */
  static async activate(policyId: string, tenantId: string, activatedBy?: string): Promise<InsurancePolicy> {
    return this.updateStatus(policyId, tenantId, 'active', activatedBy);
  }
  
  /**
   * Cancel insurance policy
   */
  static async cancel(
    policyId: string,
    tenantId: string,
    cancellationReason: string,
    cancelledBy?: string
  ): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .update({
        status: 'cancelled',
        is_active: false,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
        updated_by: cancelledBy,
      })
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to cancel insurance policy: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Mark insurance policy as expired
   */
  static async markExpired(policyId: string, tenantId: string): Promise<InsurancePolicy> {
    return this.updateStatus(policyId, tenantId, 'expired');
  }
  
  /**
   * Renew insurance policy (create new policy from existing)
   */
  static async renew(
    oldPolicyId: string,
    tenantId: string,
    renewalParams: {
      newPolicyNumber: string;
      effectiveDate: string;
      expiryDate: string;
      premiumAmount?: number;
      createdBy?: string;
    }
  ): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    // Get old policy
    const oldPolicy = await this.getById(oldPolicyId, tenantId);
    if (!oldPolicy) {
      throw new Error('Old policy not found');
    }
    
    // Mark old policy as renewed
    await this.updateStatus(oldPolicyId, tenantId, 'renewed', renewalParams.createdBy);
    
    // Create new policy
    const newPolicyData: InsurancePolicyInsert = {
      tenant_id: tenantId,
      policy_number: renewalParams.newPolicyNumber,
      customer_id: oldPolicy.customer_id,
      vehicle_id: oldPolicy.vehicle_id,
      sale_id: oldPolicy.sale_id,
      insurance_company: oldPolicy.insurance_company,
      insurance_branch: oldPolicy.insurance_branch,
      policy_type: oldPolicy.policy_type,
      coverage_amount: oldPolicy.coverage_amount,
      deductible_amount: oldPolicy.deductible_amount,
      coverage_items: oldPolicy.coverage_items as Database['public']['Tables']['auto_insurance_policies']['Row']['coverage_items'],
      premium_amount: renewalParams.premiumAmount ?? oldPolicy.premium_amount,
      premium_payment_frequency: oldPolicy.premium_payment_frequency,
      effective_date: renewalParams.effectiveDate,
      expiry_date: renewalParams.expiryDate,
      auto_renewal: oldPolicy.auto_renewal,
      referral_commission_percentage: oldPolicy.referral_commission_percentage,
      status: 'active',
      is_active: true,
      created_by: renewalParams.createdBy,
    };
    
    const { data: newPolicy, error } = await supabase
      .from('auto_insurance_policies')
      .insert(newPolicyData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create renewal policy: ${error.message}`);
    }
    
    return newPolicy;
  }
  
  /**
   * Get expiring insurance policies (30 days before expiry by default)
   */
  static async getExpiringPolicies(
    tenantId: string,
    daysBefore: number = 30
  ): Promise<ExpiringPolicy[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('check_expiring_insurance_policies', {
        p_tenant_id: tenantId,
        p_days_before: daysBefore,
      });
    
    if (error) {
      throw new Error(`Failed to fetch expiring policies: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Mark renewal reminder as sent
   */
  static async markRenewalReminderSent(
    policyId: string,
    tenantId: string
  ): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .update({
        renewal_reminder_sent: true,
        renewal_reminder_date: new Date().toISOString(),
      })
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark renewal reminder sent: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Process expired policies (cron job)
   */
  static async processExpiredPolicies(tenantId: string): Promise<number> {
    const supabase = getPrimaryClient();
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .update({
        status: 'expired',
        is_active: false,
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lt('expiry_date', today)
      .select();
    
    if (error) {
      throw new Error(`Failed to process expired policies: ${error.message}`);
    }
    
    return data?.length || 0;
  }
  
  /**
   * Record commission payment
   */
  static async recordCommissionPayment(
    policyId: string,
    tenantId: string,
    commissionAmount: number,
    updatedBy?: string
  ): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .update({
        referral_commission_amount: commissionAmount,
        commission_paid: true,
        commission_paid_date: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to record commission payment: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get insurance statistics
   */
  static async getStatistics(tenantId: string, dateRange?: { start: string; end: string }) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_insurance_policies')
      .select('status, policy_type, premium_amount, referral_commission_amount')
      .eq('tenant_id', tenantId);
    
    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch insurance statistics: ${error.message}`);
    }
    
    const stats = {
      total: data.length,
      active: 0,
      expired: 0,
      cancelled: 0,
      compulsory: 0,
      voluntary: 0,
      comprehensive: 0,
      combined: 0,
      totalPremium: 0,
      totalCommission: 0,
    };
    
    data.forEach(policy => {
      stats.totalPremium += Number(policy.premium_amount) || 0;
      stats.totalCommission += Number(policy.referral_commission_amount) || 0;
      
      if (policy.status === 'active') stats.active++;
      else if (policy.status === 'expired') stats.expired++;
      else if (policy.status === 'cancelled') stats.cancelled++;
      
      if (policy.policy_type === 'compulsory') stats.compulsory++;
      else if (policy.policy_type === 'voluntary') stats.voluntary++;
      else if (policy.policy_type === 'comprehensive') stats.comprehensive++;
      else if (policy.policy_type === 'combined') stats.combined++;
    });
    
    return stats;
  }
  
  /**
   * Update coverage items
   */
  static async updateCoverageItems(
    policyId: string,
    tenantId: string,
    coverageItems: Partial<CoverageItems>,
    updatedBy?: string
  ): Promise<InsurancePolicy> {
    const supabase = getPrimaryClient();
    
    // Get current coverage
    const current = await this.getById(policyId, tenantId);
    if (!current) {
      throw new Error('Insurance policy not found');
    }
    
    const currentCoverage = (current.coverage_items || {}) as unknown as CoverageItems;
    const updatedCoverage = { ...currentCoverage, ...coverageItems };
    
    const { data, error } = await supabase
      .from('auto_insurance_policies')
      .update({
        coverage_items: updatedCoverage as Database['public']['Tables']['auto_insurance_policies']['Row']['coverage_items'],
        updated_by: updatedBy,
      })
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update coverage items: ${error.message}`);
    }
    
    return data;
  }
}
