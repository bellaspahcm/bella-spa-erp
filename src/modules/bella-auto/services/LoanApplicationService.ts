/**
 * Bella Auto Phase 8 - Loan Application Service
 * 
 * Manages bank loan applications for vehicle financing.
 * 
 * Features:
 * - Loan application lifecycle (draft → submitted → approved → disbursed)
 * - Document checklist management
 * - Commission tracking for bank referrals
 * - Monthly payment calculation
 * - Approval workflow
 * 
 * @module bella-auto/services/LoanApplicationService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type LoanApplication = Database['public']['Tables']['auto_loan_applications']['Row'];
type LoanApplicationInsert = Database['public']['Tables']['auto_loan_applications']['Insert'];
type LoanApplicationUpdate = Database['public']['Tables']['auto_loan_applications']['Update'];

type LoanStatus = 
  | 'draft'
  | 'documents_pending'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'cancelled'
  | 'expired';

interface CreateLoanApplicationParams {
  tenantId: string;
  customerId: string;
  vehicleId?: string;
  saleId?: string;
  loanAmount: number;
  downPayment: number;
  loanTermMonths: number;
  interestRate: number;
  bankName: string;
  bankBranch?: string;
  customerIncomeMonthly?: number;
  customerEmploymentType?: string;
  createdBy?: string;
}

interface UpdateLoanStatusParams {
  loanId: string;
  tenantId: string;
  status: LoanStatus;
  notes?: string;
  updatedBy?: string;
  
  // For approval
  approvedBy?: string;
  approvedAmount?: number;
  approvedTermMonths?: number;
  approvedInterestRate?: number;
  
  // For rejection
  rejectionReason?: string;
}

interface DocumentChecklistItem {
  id_card: boolean;
  household_registration: boolean;
  income_proof: boolean;
  bank_statement: boolean;
  employment_certificate: boolean;
  vehicle_registration: boolean;
  other_documents: string[];
}

export class LoanApplicationService {
  /**
   * Generate unique loan application number
   */
  static async generateApplicationNumber(tenantId: string): Promise<string> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('generate_loan_application_number', { p_tenant_id: tenantId });
    
    if (error) {
      throw new Error(`Failed to generate application number: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Calculate monthly payment using standard loan formula
   * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
   */
  static calculateMonthlyPayment(
    loanAmount: number,
    annualInterestRate: number,
    termMonths: number
  ): number {
    if (annualInterestRate === 0) {
      return loanAmount / termMonths;
    }
    
    const monthlyRate = annualInterestRate / 100 / 12;
    const numerator = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
    const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
    
    return numerator / denominator;
  }
  
  /**
   * Create new loan application
   */
  static async create(params: CreateLoanApplicationParams): Promise<LoanApplication> {
    const supabase = getPrimaryClient();
    
    // Generate application number
    const applicationNumber = await this.generateApplicationNumber(params.tenantId);
    
    // Calculate monthly payment
    const monthlyPayment = this.calculateMonthlyPayment(
      params.loanAmount,
      params.interestRate,
      params.loanTermMonths
    );
    
    const loanData: LoanApplicationInsert = {
      tenant_id: params.tenantId,
      application_number: applicationNumber,
      customer_id: params.customerId,
      vehicle_id: params.vehicleId,
      sale_id: params.saleId,
      loan_amount: params.loanAmount,
      down_payment: params.downPayment,
      loan_term_months: params.loanTermMonths,
      interest_rate: params.interestRate,
      monthly_payment: monthlyPayment,
      bank_name: params.bankName,
      bank_branch: params.bankBranch,
      customer_income_monthly: params.customerIncomeMonthly,
      customer_employment_type: params.customerEmploymentType,
      status: 'draft',
      created_by: params.createdBy,
    };
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .insert(loanData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create loan application: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get loan application by ID
   */
  static async getById(loanId: string, tenantId: string): Promise<LoanApplication | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .select('*')
      .eq('id', loanId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch loan application: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get loan applications by customer
   */
  static async getByCustomer(customerId: string, tenantId: string): Promise<LoanApplication[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch customer loan applications: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get loan applications by sale
   */
  static async getBySale(saleId: string, tenantId: string): Promise<LoanApplication[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .select('*')
      .eq('sale_id', saleId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch sale loan applications: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Update document checklist
   */
  static async updateDocumentChecklist(
    loanId: string,
    tenantId: string,
    checklist: Partial<DocumentChecklistItem>,
    updatedBy?: string
  ): Promise<LoanApplication> {
    const supabase = getPrimaryClient();
    
    // Get current checklist
    const current = await this.getById(loanId, tenantId);
    if (!current) {
      throw new Error('Loan application not found');
    }
    
    const currentChecklist = (current.documents_checklist || {}) as DocumentChecklistItem;
    const updatedChecklist = { ...currentChecklist, ...checklist };
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .update({
        documents_checklist: updatedChecklist as LoanApplicationUpdate['documents_checklist'],
        updated_by: updatedBy,
      })
      .eq('id', loanId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update document checklist: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Check if all required documents are complete
   */
  static isDocumentChecklistComplete(checklist: Partial<DocumentChecklistItem> | null | undefined): boolean {
    if (!checklist) return false;
    
    const required = [
      'id_card',
      'household_registration',
      'income_proof',
      'bank_statement',
      'employment_certificate',
    ];
    
    return required.every(field => checklist[field] === true);
  }
  
  /**
   * Update loan application status
   */
  static async updateStatus(params: UpdateLoanStatusParams): Promise<LoanApplication> {
    const supabase = getPrimaryClient();
    
    const updates: LoanApplicationUpdate = {
      status: params.status,
      updated_by: params.updatedBy,
    };
    
    // Set timestamp based on status
    switch (params.status) {
      case 'submitted':
        updates.submitted_at = new Date().toISOString();
        break;
      case 'under_review':
        updates.reviewed_at = new Date().toISOString();
        break;
      case 'approved':
        updates.approved_at = new Date().toISOString();
        updates.approved_by = params.approvedBy;
        updates.approved_amount = params.approvedAmount;
        updates.approved_term_months = params.approvedTermMonths;
        updates.approved_interest_rate = params.approvedInterestRate;
        break;
      case 'rejected':
        updates.rejection_date = new Date().toISOString();
        updates.rejection_reason = params.rejectionReason;
        updates.rejection_notes = params.notes;
        break;
      case 'disbursed':
        updates.disbursed_at = new Date().toISOString();
        break;
    }
    
    if (params.notes && params.status !== 'rejected') {
      updates.internal_notes = params.notes;
    }
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .update(updates)
      .eq('id', params.loanId)
      .eq('tenant_id', params.tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update loan status: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Submit loan application to bank
   */
  static async submit(loanId: string, tenantId: string, submittedBy?: string): Promise<LoanApplication> {
    // Validate documents are complete
    const loan = await this.getById(loanId, tenantId);
    if (!loan) {
      throw new Error('Loan application not found');
    }
    
    if (!this.isDocumentChecklistComplete(loan.documents_checklist)) {
      throw new Error('Cannot submit: Required documents are incomplete');
    }
    
    return this.updateStatus({
      loanId,
      tenantId,
      status: 'submitted',
      updatedBy: submittedBy,
    });
  }
  
  /**
   * Approve loan application
   */
  static async approve(
    loanId: string,
    tenantId: string,
    approvalDetails: {
      approvedBy: string;
      approvedAmount?: number;
      approvedTermMonths?: number;
      approvedInterestRate?: number;
      notes?: string;
    }
  ): Promise<LoanApplication> {
    const loan = await this.getById(loanId, tenantId);
    if (!loan) {
      throw new Error('Loan application not found');
    }
    
    return this.updateStatus({
      loanId,
      tenantId,
      status: 'approved',
      approvedBy: approvalDetails.approvedBy,
      approvedAmount: approvalDetails.approvedAmount || Number(loan.loan_amount),
      approvedTermMonths: approvalDetails.approvedTermMonths || loan.loan_term_months,
      approvedInterestRate: approvalDetails.approvedInterestRate || Number(loan.interest_rate),
      notes: approvalDetails.notes,
      updatedBy: approvalDetails.approvedBy,
    });
  }
  
  /**
   * Reject loan application
   */
  static async reject(
    loanId: string,
    tenantId: string,
    rejectionDetails: {
      rejectedBy: string;
      rejectionReason: string;
      notes?: string;
    }
  ): Promise<LoanApplication> {
    return this.updateStatus({
      loanId,
      tenantId,
      status: 'rejected',
      rejectionReason: rejectionDetails.rejectionReason,
      notes: rejectionDetails.notes,
      updatedBy: rejectionDetails.rejectedBy,
    });
  }
  
  /**
   * Mark loan as disbursed
   */
  static async markDisbursed(loanId: string, tenantId: string, updatedBy?: string): Promise<LoanApplication> {
    return this.updateStatus({
      loanId,
      tenantId,
      status: 'disbursed',
      updatedBy,
    });
  }
  
  /**
   * Record commission payment
   */
  static async recordCommissionPayment(
    loanId: string,
    tenantId: string,
    commissionAmount: number,
    updatedBy?: string
  ): Promise<LoanApplication> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .update({
        referral_commission_amount: commissionAmount,
        commission_paid: true,
        commission_paid_date: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq('id', loanId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to record commission payment: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get loan applications by status
   */
  static async getByStatus(status: LoanStatus, tenantId: string): Promise<LoanApplication[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_loan_applications')
      .select('*')
      .eq('status', status)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch loan applications by status: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get statistics for loan applications
   */
  static async getStatistics(tenantId: string, dateRange?: { start: string; end: string }) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_loan_applications')
      .select('status, loan_amount, approved_amount')
      .eq('tenant_id', tenantId);
    
    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch loan statistics: ${error.message}`);
    }
    
    const stats = {
      total: data.length,
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      disbursed: 0,
      totalLoanAmount: 0,
      totalApprovedAmount: 0,
      approvalRate: 0,
    };
    
    data.forEach(loan => {
      stats.totalLoanAmount += Number(loan.loan_amount) || 0;
      
      if (loan.status === 'draft') stats.draft++;
      else if (loan.status === 'submitted' || loan.status === 'under_review' || loan.status === 'documents_pending') stats.submitted++;
      else if (loan.status === 'approved') {
        stats.approved++;
        stats.totalApprovedAmount += Number(loan.approved_amount || loan.loan_amount) || 0;
      }
      else if (loan.status === 'rejected') stats.rejected++;
      else if (loan.status === 'disbursed') {
        stats.disbursed++;
        stats.totalApprovedAmount += Number(loan.approved_amount || loan.loan_amount) || 0;
      }
    });
    
    const totalProcessed = stats.approved + stats.rejected + stats.disbursed;
    stats.approvalRate = totalProcessed > 0 
      ? ((stats.approved + stats.disbursed) / totalProcessed) * 100 
      : 0;
    
    return stats;
  }
}
