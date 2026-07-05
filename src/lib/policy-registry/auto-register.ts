/**
 * Auto-Register Existing Policies
 * 
 * Automatically registers all existing policies in the system.
 * This file should be imported during application startup.
 * 
 * Registered Policies:
 * - Payroll Domain (2 policies)
 *   - BaseSalaryProvider
 *   - CompensationProvider
 * - Booking Domain (3 policies)
 *   - EligibilityPolicy
 *   - RecommendationPolicy
 *   - ApprovalPolicy
 * - Procurement Domain (3 policies)
 *   - ValidationPolicy
 *   - ApprovalPolicy
 *   - EscalationPolicy
 */

import { getRegistry } from './policy-registry';
import type { PolicyMetadata } from './types';

// Import existing policies
import { BaseSalaryProvider } from '@/services/providers/base-salary-provider';
import { CompensationProvider } from '@/services/providers/compensation-provider';
import { EligibilityPolicy as BookingEligibilityPolicy } from '@/services/policies/booking/eligibility-policy';
import { RecommendationPolicy as BookingRecommendationPolicy } from '@/services/policies/booking/recommendation-policy';
import { ApprovalPolicy as BookingApprovalPolicy } from '@/services/policies/booking/approval-policy';
import { ValidationPolicy as ProcurementValidationPolicy } from '@/services/policies/procurement/validation-policy';
import { ApprovalPolicy as ProcurementApprovalPolicy } from '@/services/policies/procurement/approval-policy';
import { EscalationPolicy as ProcurementEscalationPolicy } from '@/services/policies/procurement/escalation-policy';

/**
 * Register all policies
 * 
 * This function should be called during application startup.
 */
export async function registerAllPolicies(): Promise<void> {
  const registry = getRegistry();
  
  console.log('[PolicyRegistry] Auto-registering existing policies...');
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // PAYROLL DOMAIN
    // ═══════════════════════════════════════════════════════════════
    
    await registry.register(
      new BaseSalaryProvider(),
      {
        id: 'base-salary-v1',
        name: 'Base Salary Provider',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: ['salary', 'base', 'attendance', 'pro-rata'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'base-salary-eligibility',
        className: 'BaseSalaryProvider',
        description: 'Calculates base salary with pro-rata adjustments based on attendance (working days / 26).',
      }
    );
    
    await registry.register(
      new CompensationProvider(),
      {
        id: 'compensation-v1',
        name: 'Compensation Provider',
        version: '1.0.0',
        domain: 'payroll',
        category: 'reward',
        tags: ['salary', 'commission', 'sessions', 'rating', 'multiplier'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'compensation-eligibility',
        className: 'CompensationProvider',
        description: 'Calculates session commissions (ca làm việc × coefficient) and rating bonuses (5★ rewards).',
      }
    );
    
    // ═══════════════════════════════════════════════════════════════
    // BOOKING DOMAIN
    // ═══════════════════════════════════════════════════════════════
    
    await registry.register(
      new BookingEligibilityPolicy(),
      {
        id: 'booking-eligibility-v1',
        name: 'Booking Eligibility Policy',
        version: '1.0.0',
        domain: 'booking',
        category: 'eligibility',
        tags: ['booking', 'validation', 'capacity', 'availability'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'booking-eligibility',
        className: 'EligibilityPolicy',
        description: 'Validates booking eligibility based on capacity, time slot availability, and customer status.',
      }
    );
    
    await registry.register(
      new BookingRecommendationPolicy(),
      {
        id: 'booking-recommendation-v1',
        name: 'Booking Recommendation Policy',
        version: '1.0.0',
        domain: 'booking',
        category: 'recommendation',
        tags: ['booking', 'ai', 'personalization', 'upsell'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'booking-recommendation',
        className: 'RecommendationPolicy',
        description: 'Recommends optimal time slots, staff, and packages based on customer history and preferences.',
      }
    );
    
    await registry.register(
      new BookingApprovalPolicy(),
      {
        id: 'booking-approval-v1',
        name: 'Booking Approval Policy',
        version: '1.0.0',
        domain: 'booking',
        category: 'approval',
        tags: ['booking', 'workflow', 'authorization', 'deposit'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'booking-approval',
        className: 'ApprovalPolicy',
        description: 'Determines approval requirements and deposit amounts based on booking value and customer tier.',
      }
    );
    
    // ═══════════════════════════════════════════════════════════════
    // PROCUREMENT DOMAIN
    // ═══════════════════════════════════════════════════════════════
    
    await registry.register(
      new ProcurementValidationPolicy(),
      {
        id: 'procurement-validation-v1',
        name: 'Procurement Validation Policy',
        version: '1.0.0',
        domain: 'procurement',
        category: 'validation',
        tags: ['procurement', 'validation', 'inventory', 'budget'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'procurement-validation',
        className: 'ValidationPolicy',
        description: 'Validates procurement requests against inventory levels, budget constraints, and supplier availability.',
      }
    );
    
    await registry.register(
      new ProcurementApprovalPolicy(),
      {
        id: 'procurement-approval-v1',
        name: 'Procurement Approval Policy',
        version: '1.0.0',
        domain: 'procurement',
        category: 'approval',
        tags: ['procurement', 'workflow', 'authorization', 'threshold'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'procurement-approval',
        className: 'ApprovalPolicy',
        description: 'Determines approval requirements based on purchase amount thresholds and approval hierarchy.',
      }
    );
    
    await registry.register(
      new ProcurementEscalationPolicy(),
      {
        id: 'procurement-escalation-v1',
        name: 'Procurement Escalation Policy',
        version: '1.0.0',
        domain: 'procurement',
        category: 'escalation',
        tags: ['procurement', 'workflow', 'escalation', 'sla'],
        status: 'active',
        owner: 'bella-core',
        decisionType: 'procurement-escalation',
        className: 'EscalationPolicy',
        description: 'Handles escalation logic for delayed approvals, urgent requests, and SLA violations.',
      }
    );
    
    console.log('[PolicyRegistry] Successfully registered 8 policies');
    
    // Log statistics
    const stats = registry.getStatistics();
    console.log(`[PolicyRegistry] Total policies: ${stats.totalPolicies}`);
    console.log(`[PolicyRegistry] By domain:`, stats.byDomain);
    console.log(`[PolicyRegistry] By category:`, stats.byCategory);
    
  } catch (error) {
    console.error('[PolicyRegistry] Failed to auto-register policies:', error);
    throw error;
  }
}

/**
 * Initialize registry
 * 
 * Convenience function to initialize the registry.
 * Safe to call multiple times (won't re-register policies).
 */
export async function initializeRegistry(): Promise<void> {
  const registry = getRegistry();
  
  // Check if already initialized
  if (registry.getStatistics().totalPolicies > 0) {
    console.log('[PolicyRegistry] Already initialized, skipping auto-registration');
    return;
  }
  
  await registerAllPolicies();
}
