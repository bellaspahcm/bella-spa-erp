/**
 * F5.6 C7-H1 Finance OS — COA Resolver Implementation
 * 
 * Resolves Accounting Intents → Account Codes (C.3)
 * 
 * Architecture Boundary:
 * - Input: Accounting intents + Tenant ID + Policy context
 * - Output: Account mappings (intent → account code)
 * 
 * CRITICAL: COA resolution is TENANT-SPECIFIC
 * - Different tenants may use different account codes
 * - Same intent may map to different accounts per tenant
 * - Tenant COA version matters (historical integrity)
 * 
 * REGIME-NEUTRAL FOR NOW:
 * - Default mappings do NOT encode TT99/TT133 specifics
 * - Account codes are generic (4-digit standard structure)
 * - PRIMARY verification (TT99 Phụ lục II) will come later
 * 
 * @see docs/architecture/F5_6_C3_TENANT_COA_BOUNDARY.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { COAResolver, AccountingIntent, AccountMapping, PolicyContext } from '../finance-event-handler';

type SemanticGlMapRow = {
  gl_account_code: string;
};

/**
 * Default COA Resolver
 * 
 * Maps accounting intents → Account codes for tenant
 * 
 * Current Implementation: Default mappings (regime-neutral)
 * Future Implementation: Load from tenant COA configuration table
 * 
 * Example Mappings:
 * - RECOGNIZE_REVENUE → 4111 (Service Revenue)
 * - RECOGNIZE_RECEIVABLE → 1311 (AR - Patient)
 * - RECOGNIZE_CASH → 1111 (Cash)
 * - RECOGNIZE_COGS → 6211 (COGS - Pharmacy)
 * - RECOGNIZE_INVENTORY → 1521 (Inventory - Medication)
 * - RECOGNIZE_PAYABLE → 3311 (AP - Supplier)
 */
export class DefaultCOAResolver implements COAResolver {
  constructor(private readonly supabase?: SupabaseClient<Database>) {}

  /**
   * Default account mappings (regime-neutral)
   * 
   * Structure:
   * - 1xxx: Assets
   * - 2xxx: Liabilities (future)
   * - 3xxx: Payables
   * - 4xxx: Revenue
   * - 5xxx: Operating Expenses (future)
   * - 6xxx: COGS
   * 
   * NOTE: These are DEFAULT mappings for H1 E2E testing
   * Production will load from tenant-specific COA configuration
   */
  private readonly defaultMappings: Record<string, { account_code: string; account_name: string }> = {
    // ========== Revenue ==========
    'RECOGNIZE_REVENUE': {
      account_code: '4111',
      account_name: 'Service Revenue - Patient',
    },
    'REVERSE_REVENUE': {
      account_code: '4111',
      account_name: 'Service Revenue - Patient (reversal)',
    },
    
    // ========== Receivables ==========
    'RECOGNIZE_RECEIVABLE': {
      account_code: '1311',
      account_name: 'Accounts Receivable - Patient',
    },
    'SETTLE_RECEIVABLE': {
      account_code: '1311',
      account_name: 'Accounts Receivable - Patient (settlement)',
    },
    
    // ========== Cash ==========
    'RECOGNIZE_CASH': {
      account_code: '1111',
      account_name: 'Cash',
    },
    'REDUCE_CASH': {
      account_code: '1111',
      account_name: 'Cash (reduction)',
    },
    
    // ========== Inventory ==========
    'RECOGNIZE_INVENTORY': {
      account_code: '1521',
      account_name: 'Inventory - Medication',
    },
    'REDUCE_INVENTORY': {
      account_code: '1521',
      account_name: 'Inventory - Medication (reduction)',
    },
    
    // ========== COGS ==========
    'RECOGNIZE_COGS': {
      account_code: '6211',
      account_name: 'COGS - Pharmacy',
    },
    
    // ========== Payables ==========
    'RECOGNIZE_PAYABLE': {
      account_code: '3311',
      account_name: 'Accounts Payable - Supplier',
    },
    'SETTLE_PAYABLE': {
      account_code: '3311',
      account_name: 'Accounts Payable - Supplier (settlement)',
    },
    
    // ========== Prepayments ==========
    'RECOGNIZE_PREPAYMENT': {
      account_code: '1412',
      account_name: 'Vendor Prepayment',
    },
  };
  
  /**
   * Resolve intents → Account mappings
   * 
   * @param tenantId Tenant ID
   * @param intents Accounting intents
   * @param policyContext Policy context (for future use)
   * @returns Account mappings (intent → account code)
   */
  async resolve(
    tenantId: string,
    intents: AccountingIntent[],
    policyContext: PolicyContext
  ): Promise<AccountMapping[]> {
    // TODO: Load tenant-specific COA from database
    // For now, use default mappings
    
    const mappings: AccountMapping[] = [];
    
    for (const intent of intents) {
      const tenantMapping = await this.loadTenantSemanticMapping(
        tenantId,
        intent.intent_type,
        policyContext
      );
      const mapping = tenantMapping ?? this.defaultMappings[intent.intent_type];
      
      if (!mapping) {
        throw new COAResolutionError(
          `No account mapping for intent: ${intent.intent_type}`,
          tenantId,
          intent.intent_type
        );
      }
      
      mappings.push({
        intent_type: intent.intent_type,
        account_code: mapping.account_code,
        account_name: mapping.account_name,
      });
    }
    
    // Log for observability
    console.log('[COAResolver] Resolved:', {
      tenant_id: tenantId,
      policy_version: policyContext.version,
      intents: intents.map(i => i.intent_type),
      accounts: mappings.map(m => m.account_code),
    });
    
    return mappings;
  }
  
  /**
   * Future: Load tenant-specific COA from database
   * 
   * SELECT account_code, account_name
   * FROM tenant_coa_mappings
   * WHERE tenant_id = ?
   *   AND intent_type = ?
   *   AND coa_version = ?
   *   AND effective_date <= ?
   * ORDER BY effective_date DESC
   * LIMIT 1
   */
  private async loadTenantCOA(
    tenantId: string,
    intentType: string,
    coaVersion: string
  ): Promise<{ account_code: string; account_name: string } | null> {
    // TODO: Implement database lookup
    return null;
  }

  private async loadTenantSemanticMapping(
    tenantId: string,
    intentType: string,
    policyContext: PolicyContext
  ): Promise<{ account_code: string; account_name: string } | null> {
    if (!this.supabase || intentType !== 'RECOGNIZE_REVENUE') {
      return null;
    }

    const accountingEffectiveDate = policyContext.recognition_rules.accounting_effective_date;
    const asOf = typeof accountingEffectiveDate === 'string'
      ? accountingEffectiveDate
      : new Date().toISOString().slice(0, 10);

    const { data, error } = await this.supabase.rpc(
      'finance_get_accounting_semantic_gl_map_as_of' as never,
      {
        p_tenant_id: tenantId,
        p_semantic_key: 'SERVICE_REVENUE',
        p_as_of: asOf,
        p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1',
      } as never
    );

    if (error) {
      throw new COAResolutionError(
        `Failed to resolve tenant SERVICE_REVENUE mapping: ${error.message}`,
        tenantId,
        intentType
      );
    }

    const rows = data as SemanticGlMapRow[] | null;
    const row = rows?.[0];
    if (!row) {
      return null;
    }

    return {
      account_code: row.gl_account_code,
      account_name: 'Service Revenue',
    };
  }
}

/**
 * COA Resolution Error
 * 
 * Thrown when intent cannot be mapped to account code
 */
export class COAResolutionError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly intentType: string
  ) {
    super(message);
    this.name = 'COAResolutionError';
  }
}
