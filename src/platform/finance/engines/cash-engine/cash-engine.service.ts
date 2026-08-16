/**
 * Finance OS F2.3 — Cash Reporting Engine Service
 *
 * Implements the ICashReportingEngine contract. Provides read-only query APIs for bank accounts,
 * cash positions, and cash movements with strict pagination ceiling limits, multi-layer
 * tenant isolation, and telemetry trace wrapping with isolated error containment.
 *
 * Compliance:
 * - TypeSafety-NoAny: Strictly typed with zero 'any' usages.
 * - Invariant F2.3.1: Read-only query scope.
 * - Invariant F2.3.2: Multi-layer Tenant isolation.
 * - Invariant F2.3.4: Telemetry failure containment.
 * - Invariant F2.3.5: Hard pagination ceiling limits.
 *
 * @module platform/finance/engines/cash-engine/cash-engine.service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  ICashReportingEngine,
  ICashReconstructionEngine,
  BankAccount,
  CashPosition,
  CashMovement,
  CashQuarantineEvent,
  QueryMovementsRequest,
  CashRunway
} from '../../contracts/cash-engine.contract';
import type { FinanceEngineResponse, Money } from '../../shared-kernel/types';
import { TelemetryTracer } from '@/platform/security/telemetry-tracer';

export class CashEngineService implements ICashReportingEngine, ICashReconstructionEngine {
  public readonly engineName = 'CashReportingEngine';
  public readonly engineVersion = '1.0.0';

  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly contextTenantId?: string,
    private readonly permissions: string[] = []
  ) {}

  // Typed client accessor for database operations
  private get client(): SupabaseClient<Database> {
    return this.supabase as unknown as SupabaseClient<Database>;
  }

  /**
   * Helper: Validates that the requested tenant ID matches the caller context tenant ID (Layer 1 check)
   * and that the caller possesses the read permission 'finance.cash.read'.
   */
  private checkAccess(tenantId: string): void {
    // 1. Enforce permission context check
    if (this.permissions && this.permissions.length > 0) {
      if (!this.permissions.includes('finance.cash.read')) {
        throw new Error('UNAUTHORIZED_ACCESS: Missing required permission finance.cash.read');
      }
    }

    // 2. Enforce tenant isolation context check
    if (this.contextTenantId && this.contextTenantId !== tenantId) {
      throw new Error(`UNAUTHORIZED_TENANT_ACCESS: Context tenant '${this.contextTenantId}' is not authorized to access tenant '${tenantId}'`);
    }
  }

  /**
   * Wrapper: Traces execution via TelemetryTracer, ensuring telemetry errors are isolated
   * and never bubble up to crash the reporting query.
   */
  private async traceOperation<T>(
    tenantId: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    let traceId = '';
    
    try {
      traceId = TelemetryTracer.startTrace(tenantId, 'shared', operation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Telemetry Warning] startTrace failed: ${msg}`);
    }

    try {
      const result = await fn();
      
      if (traceId) {
        try {
          TelemetryTracer.incrementQueryCount(traceId);
          const duration = Date.now() - start;
          TelemetryTracer.endTrace(traceId, tenantId, 'shared', operation, duration, true);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[Telemetry Warning] endTrace failed: ${msg}`);
        }
      }
      return result;
    } catch (queryErr: unknown) {
      if (traceId) {
        try {
          const duration = Date.now() - start;
          const errMsg = queryErr instanceof Error ? queryErr.message : String(queryErr);
          TelemetryTracer.endTrace(traceId, tenantId, 'shared', operation, duration, false, errMsg);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[Telemetry Warning] endTrace failed: ${msg}`);
        }
      }
      throw queryErr;
    }
  }

  private createErrorResponse<T>(code: string, message: string): FinanceEngineResponse<T> {
    return {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Helper: Resolves decimal places for supported currencies.
   */
  private getCurrencyDecimals(currency: string): number {
    const c = currency.toUpperCase();
    if (c === 'VND') return 0;
    if (c === 'USD' || c === 'EUR' || c === 'SGD') return 2;
    return 2; // fallback
  }

  // ==========================================================================
  // bank account queries
  // ==========================================================================

  public async getBankAccount(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<BankAccount>> {
    try {
      this.checkAccess(tenantId);
      
      return await this.traceOperation(tenantId, 'finance.cash.get_bank_account', async () => {
        const { data, error } = await this.client
          .from('finance_bank_accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', bankAccountId)
          .single();

        if (error || !data) {
          return this.createErrorResponse('BANK_ACCOUNT_NOT_FOUND', error?.message || 'Bank account not found');
        }

        return { success: true, data: data as BankAccount };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  public async listBankAccounts(tenantId: string): Promise<FinanceEngineResponse<BankAccount[]>> {
    try {
      this.checkAccess(tenantId);

      return await this.traceOperation(tenantId, 'finance.cash.list_bank_accounts', async () => {
        const { data, error } = await this.client
          .from('finance_bank_accounts')
          .select('*')
          .eq('tenant_id', tenantId);

        if (error) {
          return this.createErrorResponse('DATABASE_ERROR', error.message);
        }

        return { success: true, data: (data || []) as BankAccount[] };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  // ==========================================================================
  // cash position & movements queries
  // ==========================================================================

  public async getCashPosition(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<CashPosition>> {
    try {
      this.checkAccess(tenantId);

      return await this.traceOperation(tenantId, 'finance.cash.get_cash_position', async () => {
        const { data, error } = await this.client
          .from('finance_cash_positions')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('bank_account_id', bankAccountId)
          .single();

        if (error || !data) {
          return this.createErrorResponse('POSITION_NOT_FOUND', error?.message || 'Cash position not found');
        }

        const position: CashPosition = {
          id: data.id,
          tenant_id: data.tenant_id,
          bank_account_id: data.bank_account_id,
          balance_minor: String(data.balance_minor),
          currency: data.currency,
          functional_balance_minor: String(data.functional_balance_minor),
          functional_currency: data.functional_currency,
          valuation_rate: String(data.valuation_rate),
          valuation_as_of: new Date(data.valuation_as_of),
          version: Number(data.version)
        };

        return { success: true, data: position };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  public async listCashPositions(tenantId: string): Promise<FinanceEngineResponse<CashPosition[]>> {
    try {
      this.checkAccess(tenantId);

      return await this.traceOperation(tenantId, 'finance.cash.list_cash_positions', async () => {
        const { data, error } = await this.client
          .from('finance_cash_positions')
          .select('*')
          .eq('tenant_id', tenantId);

        if (error) {
          return this.createErrorResponse('DATABASE_ERROR', error.message);
        }

        const list: CashPosition[] = (data || []).map((row) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          bank_account_id: row.bank_account_id,
          balance_minor: String(row.balance_minor),
          currency: row.currency,
          functional_balance_minor: String(row.functional_balance_minor),
          functional_currency: row.functional_currency,
          valuation_rate: String(row.valuation_rate),
          valuation_as_of: new Date(row.valuation_as_of),
          version: Number(row.version)
        }));

        return { success: true, data: list };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  public async getCashMovements(req: QueryMovementsRequest): Promise<FinanceEngineResponse<CashMovement[]>> {
    try {
      this.checkAccess(req.tenant_id);

      // Pagination constraints (Gate F2.3.5: Reject invalid pagination parameters)
      const limit = req.limit !== undefined ? req.limit : 50;
      const offset = req.offset !== undefined ? req.offset : 0;

      if (limit < 1 || limit > 200) {
        return this.createErrorResponse('INVALID_PAGINATION_LIMIT', 'Limit must be between 1 and 200');
      }

      if (offset < 0) {
        return this.createErrorResponse('INVALID_PAGINATION_OFFSET', 'Offset must be non-negative');
      }

      return await this.traceOperation(req.tenant_id, 'finance.cash.get_cash_movements', async () => {
        let query = this.client
          .from('finance_cash_movements')
          .select('*')
          .eq('tenant_id', req.tenant_id)
          .order('recorded_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (req.bank_account_id) {
          query = query.eq('bank_account_id', req.bank_account_id);
        }

        if (req.direction) {
          query = query.eq('direction', req.direction);
        }

        if (req.start_date) {
          query = query.gte('recorded_at', req.start_date.toISOString());
        }

        if (req.end_date) {
          query = query.lte('recorded_at', req.end_date.toISOString());
        }

        const { data, error } = await query;

        if (error) {
          return this.createErrorResponse('DATABASE_ERROR', error.message);
        }

        const list: CashMovement[] = (data || []).map((row) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          bank_account_id: row.bank_account_id,
          idempotency_key: row.idempotency_key,
          direction: row.direction as 'INFLOW' | 'OUTFLOW',
          amount_minor: String(row.amount_minor),
          currency: row.currency,
          functional_amount_minor: String(row.functional_amount_minor),
          functional_currency: row.functional_currency,
          valuation_rate: String(row.valuation_rate),
          f1_transaction_id: row.f1_transaction_id,
          cash_leg_reference: row.cash_leg_reference,
          source_type: row.source_type as 'F1_POSTING' | 'REVERSAL',
          source_id: row.source_id,
          description: row.description || undefined,
          recorded_at: new Date(row.recorded_at)
        }));

        return { success: true, data: list };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  // ==========================================================================
  // runway analytics query
  // ==========================================================================

  public async getConsolidatedRunway(tenantId: string): Promise<FinanceEngineResponse<CashRunway>> {
    try {
      this.checkAccess(tenantId);

      return await this.traceOperation(tenantId, 'finance.cash.get_runway', async () => {
        // 1. Sum functional currency directly across positions (T11 Compliance - No Revaluation)
        const { data: positions, error: posErr } = await this.client
          .from('finance_cash_positions')
          .select('functional_balance_minor, functional_currency')
          .eq('tenant_id', tenantId);

        if (posErr) {
          return this.createErrorResponse('DATABASE_ERROR', posErr.message);
        }

        let totalFunctional = BigInt(0);
        let functionalCurrency = 'VND';

        if (positions && positions.length > 0) {
          functionalCurrency = positions[0].functional_currency;
          for (const pos of positions) {
            totalFunctional += BigInt(pos.functional_balance_minor || 0);
          }
        }

        const consolidatedCash: Money = {
          amount_minor: totalFunctional.toString(),
          currency: functionalCurrency
        };

        // 2. Query authoritative burn rate from mv_cash_flow (P1 Compliance)
        const { data: burnData, error: burnErr } = await this.client
          .from('mv_cash_flow')
          .select('burn_rate')
          .eq('tenant_id', tenantId)
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (burnErr) {
          return {
            success: true,
            data: {
              runway_days: null,
              consolidated_cash: consolidatedCash,
              status: 'UNAVAILABLE'
            }
          };
        }

        if (!burnData) {
          return {
            success: true,
            data: {
              runway_days: null,
              consolidated_cash: consolidatedCash,
              status: 'NO_BURN_RATE'
            }
          };
        }

        const monthlyBurnRate = Number(burnData.burn_rate || 0);

        if (monthlyBurnRate <= 0) {
          return {
            success: true,
            data: {
              runway_days: null,
              consolidated_cash: consolidatedCash,
              status: 'ZERO_BURN'
            }
          };
        }

        // Convert monthly burn rate (which is in functional currency major units) to minor units scale
        const decimals = this.getCurrencyDecimals(functionalCurrency);
        const monthlyBurnMinor = BigInt(Math.round(monthlyBurnRate * (10 ** decimals)));
        const dailyBurnMinor = monthlyBurnMinor / BigInt(30);

        if (dailyBurnMinor === BigInt(0)) {
          return {
            success: true,
            data: {
              runway_days: null,
              consolidated_cash: consolidatedCash,
              status: 'ZERO_BURN'
            }
          };
        }

        // Calculate runway days
        const runwayDays = Number(totalFunctional / dailyBurnMinor);

        return {
          success: true,
          data: {
            runway_days: runwayDays,
            consolidated_cash: consolidatedCash,
            status: 'CALCULATED'
          }
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  // ==========================================================================
  // quarantine diagnostics query
  // ==========================================================================

  public async getQuarantineEvents(
    tenantId: string,
    status?: 'PENDING' | 'RESOLVED'
  ): Promise<FinanceEngineResponse<CashQuarantineEvent[]>> {
    try {
      this.checkAccess(tenantId);

      return await this.traceOperation(tenantId, 'finance.cash.get_quarantine_events', async () => {
        let query = this.client
          .from('finance_cash_quarantine')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
          return this.createErrorResponse('DATABASE_ERROR', error.message);
        }

        const events: CashQuarantineEvent[] = (data || []).map((row) => {
          let failureReason = row.failure_reason;
          let failureCode = 'QUARANTINE_ERROR';

          const codeMatch = failureReason.match(/\s*\[Code:\s*([^\]]+)\]/);
          if (codeMatch) {
            failureCode = codeMatch[1];
            failureReason = failureReason.replace(codeMatch[0], '').trim();
          }

          return {
            id: row.id,
            tenant_id: row.tenant_id,
            event_id: row.event_id,
            event_type: row.event_type,
            payload: row.payload,
            failure_reason: failureReason,
            failure_code: failureCode,
            status: row.status as 'PENDING' | 'RESOLVED',
            resolved_by: row.resolved_by || null,
            resolved_at: row.resolved_at ? new Date(row.resolved_at) : null,
            created_at: new Date(row.created_at)
          };
        });

        return { success: true, data: events };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }

  // ==========================================================================
  // position reconstruction query (restricted)
  // ==========================================================================

  public async reconstructCashPositions(
    tenantId: string,
    bankAccountId?: string
  ): Promise<FinanceEngineResponse<{ reconstructed_accounts_count: number }>> {
    try {
      // 1. Enforce fail-closed permission context check (finance.cash.reconstruct)
      if (!this.permissions || !this.permissions.includes('finance.cash.reconstruct')) {
        throw new Error('UNAUTHORIZED_ACCESS: Missing required permission finance.cash.reconstruct');
      }

      // 2. Enforce tenant isolation context check
      if (this.contextTenantId && this.contextTenantId !== tenantId) {
        throw new Error(`UNAUTHORIZED_TENANT_ACCESS: Context tenant '${this.contextTenantId}' is not authorized to access tenant '${tenantId}'`);
      }

      return await this.traceOperation(tenantId, 'finance.cash.reconstruct_positions', async () => {
        const { data, error } = await this.client.rpc('finance_reconstruct_cash_positions', {
          p_tenant_id: tenantId,
          p_bank_account_id: bankAccountId || null
        });

        if (error) {
          // Detect the specific custom database error ERRCODE F2012
          const isMismatch = error.message && error.message.includes('BANK_ACCOUNT_TENANT_MISMATCH');
          const errCode = isMismatch ? 'BANK_ACCOUNT_TENANT_MISMATCH' : 'RECONSTRUCTION_FAILED';
          return this.createErrorResponse(errCode, error.message);
        }

        const count = data && typeof data === 'object' && 'reconstructed_count' in data
          ? (data as { reconstructed_count: number }).reconstructed_count
          : 0;

        return {
          success: true,
          data: { reconstructed_accounts_count: count }
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith('UNAUTHORIZED') ? 'FORBIDDEN' : 'DATABASE_ERROR';
      return this.createErrorResponse(code, msg);
    }
  }
}
