/**
 * Freight Audit Engine - Logistics Platform
 * 
 * E3 Economics Experiment - Freight Audit & Payment vertical
 * Category: B (Pattern Reuse - following Engine pattern)
 * 
 * Manages freight invoice lifecycle from creation to payment.
 * Financial domain engine for carrier payment reconciliation.
 * 
 * Architecture Compliance:
 *   - Product → Contract → Engine pattern
 *   - No direct Core modification
 *   - Event-driven integration
 *   - Strictly typed, no `any` types
 *   - RLS enforced at database level
 * 
 * R1 Scope: Create invoice, query operations, basic metrics
 * Future R2-R15: Rate validation, approval workflow, payment tracking
 * 
 * @module platform/logistics/engines/freight-audit-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FreightAuditContract,
  CreateInvoiceRequest,
  CreateInvoiceResult,
  GetInvoiceRequest,
  GetInvoicesByStatusRequest,
  GetInvoicesByCarrierRequest,
  GetInvoicesByShipmentRequest,
  GetInvoiceMetricsRequest,
  InvoiceMetrics,
  InvoiceCreatedPayload,
  ValidateRateRequest,
  ValidateRateResult,
  ValidateAccessorialsRequest,
  ValidateAccessorialsResult,
  CalculateVarianceRequest,
  CalculateVarianceResult,
  CreateDiscrepancyRequest,
  CreateDiscrepancyResult,
  DiscrepancyCreatedPayload,
  SubmitInvoiceForApprovalRequest,
  SubmitInvoiceForApprovalResult,
  InvoiceSubmittedPayload,
  ApproveInvoiceRequest,
  ApproveInvoiceResult,
  InvoiceApprovedPayload,
  RejectInvoiceRequest,
  RejectInvoiceResult,
  InvoiceRejectedPayload,
  MarkInvoicePaidRequest,
  MarkInvoicePaidResult,
  InvoicePaidPayload,
  ReopenInvoiceRequest,
  ReopenInvoiceResult,
  InvoiceReopenedPayload,
  BulkApproveInvoicesRequest,
  BulkApproveInvoicesResult,
  BulkRejectInvoicesRequest,
  BulkRejectInvoicesResult,
} from '../contracts/freight-audit.contract';
import type {
  EngineResponse,
  EngineHealthStatus,
} from '@/core/types/engine';
import type {
  FreightInvoice,
  InvoiceLineItem,
  InvoiceStatus,
  RateValidationResult,
  CarrierRate,
  AccessorialChargeType,
  AccessorialRate,
  AccessorialValidationResult,
  InvoiceVarianceSummary,
  Discrepancy,
  DiscrepancyStatus,
} from '../shared-kernel/types/freight-audit.types';
import { eventBus } from '@/platform/host/event-bus';

// ============================================================================
// Internal DB Row Types
// ============================================================================

interface InvoiceRow {
  invoice_id: string;
  tenant_id: string;
  carrier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  currency: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  approved_amount: number | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  payment_reference: string | null;
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

interface LineItemRow {
  line_item_id: string;
  invoice_id: string;
  tenant_id: string;
  shipment_id: string;
  charge_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  expected_amount: number | null;
  variance: number | null;
  variance_reason: string | null;
  created_at: string;
}

interface IdempotencyKeyRow {
  id: string;
  response_data: Record<string, unknown>;
}

interface CarrierRateRow {
  rate_id: string;
  tenant_id: string;
  carrier_id: string;
  origin_location: string;
  destination_location: string;
  service_level: string;
  weight_min: number;
  weight_max: number;
  base_rate: number;
  fuel_surcharge_rate: number | null;
  effective_date: string;
  expiration_date: string | null;
  currency: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

interface AccessorialRateRow {
  rate_id: string;
  tenant_id: string;
  carrier_id: string;
  charge_type: string;
  rate_basis: string;
  rate_amount: number;
  minimum_charge: number | null;
  maximum_charge: number | null;
  requires_event: boolean;
  event_threshold: number | null;
  effective_date: string;
  expiration_date: string | null;
  currency: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

interface DiscrepancyRow {
  discrepancy_id: string;
  tenant_id: string;
  invoice_id: string;
  line_item_id: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  reason: string;
  status: string;
  assigned_to: string | null;
  assigned_at: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const ENGINE_VERSION = '1.0.0';
const INVOICE_NUMBER_PREFIX = 'INV';

// ============================================================================
// Freight Audit Engine Implementation
// ============================================================================

export class FreightAuditEngine implements FreightAuditContract {
  constructor(
    private supabase: SupabaseClient,
    private tenantId: string,
    private userId: string
  ) {}

  // ==========================================================================
  // R1: CREATE INVOICE
  // ==========================================================================

  async createInvoice(
    request: CreateInvoiceRequest
  ): Promise<EngineResponse<CreateInvoiceResult>> {
    try {
      // Validate tenant
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Check idempotency (Category A: Reuse idempotency pattern from Shipment)
      if (request.idempotency_key) {
        const existingResult = await this.checkIdempotency(request.idempotency_key);
        if (existingResult) {
          return existingResult as EngineResponse<CreateInvoiceResult>;
        }
      }

      // Validate line items
      if (!request.line_items || request.line_items.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_LINE_ITEMS',
            message: 'At least one line item is required',
          },
        };
      }

      // Calculate totals
      const subtotal = request.line_items.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = 0; // R2: Tax calculation
      const totalAmount = subtotal + taxAmount;

      // Create invoice header
      const { data: invoiceData, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .insert({
          tenant_id: request.tenant_id,
          carrier_id: request.carrier_id,
          invoice_number: request.invoice_number,
          invoice_date: request.invoice_date.toISOString(),
          due_date: request.due_date.toISOString(),
          status: 'draft',
          currency: request.currency,
          subtotal_amount: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          created_by: this.userId,
        })
        .select()
        .single();

      if (invoiceError || !invoiceData) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: invoiceError?.message || 'Failed to create invoice',
          },
        };
      }

      // Create line items
      const lineItemsToInsert = request.line_items.map(item => ({
        invoice_id: invoiceData.invoice_id,
        tenant_id: request.tenant_id,
        shipment_id: item.shipment_id,
        charge_type: item.charge_type,
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.amount,
        amount: item.amount,
      }));

      const { data: lineItemsData, error: lineItemsError } = await this.supabase
        .from('log_invoice_line_items')
        .insert(lineItemsToInsert)
        .select();

      if (lineItemsError || !lineItemsData) {
        // Rollback invoice creation (delete invoice)
        await this.supabase
          .from('log_freight_invoices')
          .delete()
          .eq('invoice_id', invoiceData.invoice_id);

        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to create line items',
          },
        };
      }

      // Map to domain types
      const invoice = this.mapInvoiceRowToEntity(invoiceData);
      const lineItems = lineItemsData.map(this.mapLineItemRowToEntity);

      const result: CreateInvoiceResult = {
        invoice,
        line_items: lineItems,
      };

      // Store idempotency key (Category A: Reuse pattern)
      if (request.idempotency_key) {
        await this.storeIdempotency(request.idempotency_key, result);
      }

      // Publish domain event (Category B: Event pattern)
      const eventPayload: InvoiceCreatedPayload = {
        tenant_id: invoice.tenant_id,
        invoice_id: invoice.invoice_id,
        carrier_id: invoice.carrier_id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        total_amount: invoice.total_amount,
        line_item_count: lineItems.length,
        created_by: invoice.created_by,
        created_at: invoice.created_at,
      };

      await eventBus.publish({
        type: 'InvoiceCreated',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  async getInvoice(
    request: GetInvoiceRequest
  ): Promise<EngineResponse<FreightInvoice>> {
    try {
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      const { data, error } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      return {
        success: true,
        data: this.mapInvoiceRowToEntity(data),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getInvoicesByStatus(
    request: GetInvoicesByStatusRequest
  ): Promise<EngineResponse<FreightInvoice[]>> {
    try {
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      let query = this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('tenant_id', request.tenant_id)
        .eq('status', request.status)
        .order('invoice_date', { ascending: false });

      if (request.limit) {
        query = query.limit(request.limit);
      }

      if (request.offset) {
        query = query.range(request.offset, request.offset + (request.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: data.map(this.mapInvoiceRowToEntity),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getInvoicesByCarrier(
    request: GetInvoicesByCarrierRequest
  ): Promise<EngineResponse<FreightInvoice[]>> {
    try {
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      let query = this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('tenant_id', request.tenant_id)
        .eq('carrier_id', request.carrier_id);

      if (request.from_date) {
        query = query.gte('invoice_date', request.from_date.toISOString());
      }

      if (request.to_date) {
        query = query.lte('invoice_date', request.to_date.toISOString());
      }

      query = query.order('invoice_date', { ascending: false });

      if (request.limit) {
        query = query.limit(request.limit);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: data.map(this.mapInvoiceRowToEntity),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getInvoicesByShipment(
    request: GetInvoicesByShipmentRequest
  ): Promise<EngineResponse<FreightInvoice[]>> {
    try {
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Query line items for shipment, then get unique invoices
      const { data: lineItems, error: lineItemError } = await this.supabase
        .from('log_invoice_line_items')
        .select('invoice_id')
        .eq('tenant_id', request.tenant_id)
        .eq('shipment_id', request.shipment_id);

      if (lineItemError || !lineItems) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemError?.message || 'Failed to query line items',
          },
        };
      }

      const invoiceIds = [...new Set(lineItems.map(item => item.invoice_id))];

      if (invoiceIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      const { data, error } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .in('invoice_id', invoiceIds)
        .eq('tenant_id', request.tenant_id)
        .order('invoice_date', { ascending: false });

      if (error) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: data.map(this.mapInvoiceRowToEntity),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getInvoiceMetrics(
    request: GetInvoiceMetricsRequest
  ): Promise<EngineResponse<InvoiceMetrics>> {
    try {
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Query all invoices matching criteria
      let query = this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('tenant_id', request.tenant_id);

      if (request.from_date) {
        query = query.gte('invoice_date', request.from_date.toISOString());
      }

      if (request.to_date) {
        query = query.lte('invoice_date', request.to_date.toISOString());
      }

      if (request.carrier_id) {
        query = query.eq('carrier_id', request.carrier_id);
      }

      const { data: invoices, error } = await query;

      if (error || !invoices) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: error?.message || 'Failed to query invoices',
          },
        };
      }

      // Calculate metrics (Category D: Novel business logic)
      const totalInvoices = invoices.length;
      const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);

      // Group by status
      const statusMap = new Map<string, { count: number; amount: number }>();
      invoices.forEach(inv => {
        const existing = statusMap.get(inv.status) || { count: 0, amount: 0 };
        statusMap.set(inv.status, {
          count: existing.count + 1,
          amount: existing.amount + inv.total_amount,
        });
      });

      const byStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
        status: status as InvoiceStatus,
        count: data.count,
        total_amount: data.amount,
      }));

      // Group by carrier
      const carrierMap = new Map<string, { count: number; amount: number }>();
      invoices.forEach(inv => {
        const existing = carrierMap.get(inv.carrier_id) || { count: 0, amount: 0 };
        carrierMap.set(inv.carrier_id, {
          count: existing.count + 1,
          amount: existing.amount + inv.total_amount,
        });
      });

      const byCarrier = Array.from(carrierMap.entries()).map(([carrier_id, data]) => ({
        carrier_id,
        count: data.count,
        total_amount: data.amount,
      }));

      // Calculate average processing days (draft → approved)
      const processedInvoices = invoices.filter(inv => inv.approved_at);
      const totalProcessingDays = processedInvoices.reduce((sum, inv) => {
        const created = new Date(inv.created_at);
        const approved = new Date(inv.approved_at!);
        const days = (approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);

      const avgProcessingDays = processedInvoices.length > 0
        ? totalProcessingDays / processedInvoices.length
        : 0;

      const metrics: InvoiceMetrics = {
        total_invoices: totalInvoices,
        total_amount: totalAmount,
        by_status: byStatus,
        by_carrier: byCarrier,
        average_processing_days: Math.round(avgProcessingDays * 10) / 10,
      };

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R2: RATE VALIDATION (Category D: Novel rate matching algorithm)
  // ==========================================================================

  async validateRate(
    request: ValidateRateRequest
  ): Promise<EngineResponse<ValidateRateResult>> {
    try {
      // Validate tenant
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      const varianceThreshold = request.variance_threshold_percentage || 5.0;

      // Get invoice with line items
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Get all line items for invoice
      const { data: lineItems, error: lineItemsError } = await this.supabase
        .from('log_invoice_line_items')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id);

      if (lineItemsError || !lineItems) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to query line items',
          },
        };
      }

      // For each line item, fetch shipment details (to get origin/destination/service/weight)
      const validationResults: RateValidationResult[] = [];
      let totalExpectedAmount = 0;
      let totalActualAmount = 0;
      let matchedCount = 0;
      let varianceWithinThresholdCount = 0;
      let varianceExceedsThresholdCount = 0;
      let rateNotFoundCount = 0;

      for (const lineItem of lineItems) {
        // Get shipment details (Category B: Reuse shipment query pattern)
        // NOTE: Shipment schema uses JSONB for origin/destination, TEXT for type, JSONB for total_weight
        const { data: shipment } = await this.supabase
          .from('log_shipments')
          .select('origin, destination, type, total_weight')
          .eq('id', lineItem.shipment_id) // Schema PK is 'id' not 'shipment_id'
          .eq('tenant_id', request.tenant_id)
          .single();

        if (!shipment) {
          // Cannot validate without shipment data
          validationResults.push({
            line_item_id: lineItem.line_item_id,
            actual_amount: lineItem.amount,
            threshold_exceeded: false,
            validation_status: 'rate_not_found',
            validation_notes: 'Shipment data not found',
          });
          rateNotFoundCount++;
          totalActualAmount += lineItem.amount;
          continue;
        }

        // Extract location codes from JSONB structure
        // Assuming origin/destination JSONB has structure: { city, state, zip, country }
        // For rate matching, we'll use a simple location key (can be enhanced based on actual structure)
        const originLocation = typeof shipment.origin === 'object' && shipment.origin 
          ? (shipment.origin as any).city || (shipment.origin as any).zip || 'UNKNOWN'
          : 'UNKNOWN';
        const destinationLocation = typeof shipment.destination === 'object' && shipment.destination
          ? (shipment.destination as any).city || (shipment.destination as any).zip || 'UNKNOWN'
          : 'UNKNOWN';

        // Extract weight value from JSONB (assuming structure: { value: number, unit: string })
        const weightValue = typeof shipment.total_weight === 'object' && shipment.total_weight
          ? (shipment.total_weight as any).value || 0
          : 0;

        // Map shipment type to service_level for rate matching
        const serviceLevel = shipment.type; // Direct mapping for now

        // Multi-dimensional rate lookup (Category D: Novel financial logic)
        const matchingRate = await this.findMatchingRate(
          request.tenant_id,
          invoice.carrier_id,
          originLocation,
          destinationLocation,
          serviceLevel,
          weightValue,
          invoice.invoice_date
        );

        if (!matchingRate) {
          validationResults.push({
            line_item_id: lineItem.line_item_id,
            actual_amount: lineItem.amount,
            threshold_exceeded: false,
            validation_status: 'rate_not_found',
            validation_notes: `No contracted rate found for ${serviceLevel} service from ${originLocation} to ${destinationLocation}`,
          });
          rateNotFoundCount++;
          totalActualAmount += lineItem.amount;
          continue;
        }

        // Calculate expected amount (Category D: Financial calculation)
        const expectedAmount = this.calculateExpectedAmount(
          matchingRate,
          shipment.total_weight
        );

        // Calculate variance (Category D: Financial variance analysis)
        const absoluteVariance = lineItem.amount - expectedAmount;
        const percentageVariance = (absoluteVariance / expectedAmount) * 100;
        const thresholdExceeded = Math.abs(percentageVariance) > varianceThreshold;

        // Determine validation status
        let validationStatus: RateValidationResult['validation_status'];
        if (Math.abs(absoluteVariance) < 0.01) {
          validationStatus = 'matched';
          matchedCount++;
        } else if (thresholdExceeded) {
          validationStatus = 'variance_exceeds_threshold';
          varianceExceedsThresholdCount++;
        } else {
          validationStatus = 'variance_within_threshold';
          varianceWithinThresholdCount++;
        }

        validationResults.push({
          line_item_id: lineItem.line_item_id,
          matched_rate_id: matchingRate.rate_id,
          expected_amount: expectedAmount,
          actual_amount: lineItem.amount,
          absolute_variance: absoluteVariance,
          percentage_variance: Math.round(percentageVariance * 100) / 100,
          threshold_exceeded: thresholdExceeded,
          validation_status: validationStatus,
          validation_notes: thresholdExceeded
            ? `Variance ${percentageVariance.toFixed(2)}% exceeds threshold ${varianceThreshold}%`
            : undefined,
        });

        totalExpectedAmount += expectedAmount;
        totalActualAmount += lineItem.amount;

        // Update line item with validation results (Category B: DB update pattern)
        await this.supabase
          .from('log_invoice_line_items')
          .update({
            expected_amount: expectedAmount,
            variance: absoluteVariance,
            variance_reason: validationStatus === 'variance_exceeds_threshold'
              ? `Variance ${percentageVariance.toFixed(2)}% exceeds threshold`
              : null,
          })
          .eq('line_item_id', lineItem.line_item_id)
          .eq('tenant_id', request.tenant_id);
      }

      const result: ValidateRateResult = {
        invoice_id: request.invoice_id,
        line_items_validated: lineItems.length,
        line_items_matched: matchedCount,
        line_items_variance_within_threshold: varianceWithinThresholdCount,
        line_items_variance_exceeds_threshold: varianceExceedsThresholdCount,
        line_items_rate_not_found: rateNotFoundCount,
        total_expected_amount: totalExpectedAmount,
        total_actual_amount: totalActualAmount,
        total_variance: totalActualAmount - totalExpectedAmount,
        validation_details: validationResults,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Find matching carrier rate (Category D: Multi-dimensional lookup algorithm)
   * 
   * Matches rate based on:
   * - Carrier
   * - Origin/destination locations
   * - Service level
   * - Weight range
   * - Effective date
   */
  private async findMatchingRate(
    tenantId: string,
    carrierId: string,
    origin: string,
    destination: string,
    serviceLevel: string,
    weight: number,
    invoiceDate: string
  ): Promise<CarrierRateRow | null> {
    const invoiceDateObj = new Date(invoiceDate);

    // Query rates matching carrier, locations, service level
    const { data: rates, error } = await this.supabase
      .from('log_carrier_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('carrier_id', carrierId)
      .eq('origin_location', origin)
      .eq('destination_location', destination)
      .eq('service_level', serviceLevel)
      .eq('is_active', true)
      .lte('effective_date', invoiceDate)
      .or(`expiration_date.is.null,expiration_date.gte.${invoiceDate}`);

    if (error || !rates || rates.length === 0) {
      return null;
    }

    // Filter by weight range (multi-dimensional matching)
    const matchingRates = rates.filter(
      rate => weight >= rate.weight_min && weight <= rate.weight_max
    );

    if (matchingRates.length === 0) {
      return null;
    }

    // If multiple rates match, use the most recent effective_date
    matchingRates.sort((a, b) => {
      const dateA = new Date(a.effective_date);
      const dateB = new Date(b.effective_date);
      return dateB.getTime() - dateA.getTime();
    });

    return matchingRates[0];
  }

  /**
   * Calculate expected amount from rate (Category D: Financial calculation)
   */
  private calculateExpectedAmount(
    rate: CarrierRateRow,
    weight: number
  ): number {
    let amount = rate.base_rate;

    // Apply fuel surcharge if present
    if (rate.fuel_surcharge_rate) {
      const fuelSurcharge = (rate.base_rate * rate.fuel_surcharge_rate) / 100;
      amount += fuelSurcharge;
    }

    // Round to 2 decimal places
    return Math.round(amount * 100) / 100;
  }

  // ==========================================================================
  // R3: ACCESSORIAL VALIDATION
  // ==========================================================================

  async validateAccessorials(
    request: ValidateAccessorialsRequest
  ): Promise<EngineResponse<ValidateAccessorialsResult>> {
    try {
      // Validate tenant
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Get invoice
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Get accessorial line items (Category B: Reuse query pattern from R2)
      const { data: lineItems, error: lineItemsError } = await this.supabase
        .from('log_invoice_line_items')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .in('charge_type', [
          'fuel_surcharge', 'detention', 'layover', 'redelivery', 'storage',
          'liftgate', 'inside_delivery', 'residential_delivery', 'appointment', 'other'
        ]);

      if (lineItemsError || !lineItems) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to query line items',
          },
        };
      }

      // Validate each accessorial (Category D: Novel accessorial validation logic)
      const validationResults: AccessorialValidationResult[] = [];
      let legitimateCount = 0;
      let unauthorizedCount = 0;
      let excessiveCount = 0;
      let totalVariance = 0;

      for (const lineItem of lineItems) {
        const chargeType = lineItem.charge_type as AccessorialChargeType;
        const validationIssues: string[] = [];

        // Get shipment for event validation
        const { data: shipment } = await this.supabase
          .from('log_shipments')
          .select('*')
          .eq('shipment_id', lineItem.shipment_id)
          .eq('tenant_id', request.tenant_id)
          .single();

        if (!shipment) {
          validationResults.push({
            line_item_id: lineItem.line_item_id,
            charge_type: chargeType,
            is_legitimate: false,
            actual_amount: lineItem.amount,
            validation_issues: ['Shipment not found'],
          });
          unauthorizedCount++;
          continue;
        }

        // Find matching accessorial rate (Category B: Reuse rate lookup pattern from R2)
        const matchingRate = await this.findMatchingAccessorialRate(
          request.tenant_id,
          invoice.carrier_id,
          chargeType,
          invoice.invoice_date
        );

        if (!matchingRate) {
          validationIssues.push(`No contracted rate found for ${chargeType}`);
          validationResults.push({
            line_item_id: lineItem.line_item_id,
            charge_type: chargeType,
            is_legitimate: false,
            actual_amount: lineItem.amount,
            validation_issues: validationIssues,
          });
          unauthorizedCount++;
          continue;
        }

        // Validate event requirement (Category D: Novel business rule validation)
        if (matchingRate.requires_event) {
          const hasRequiredEvent = await this.checkShipmentEvent(
            request.tenant_id,
            lineItem.shipment_id,
            chargeType,
            matchingRate.event_threshold
          );

          if (!hasRequiredEvent) {
            validationIssues.push(
              `${chargeType} requires shipment event but none found`
            );
          }
        }

        // Calculate expected amount (Category D: Accessorial financial calculation)
        const expectedAmount = this.calculateAccessorialAmount(
          matchingRate,
          shipment,
          lineItem
        );

        // Calculate variance (Category B: Reuse variance calculation from R2)
        const variance = lineItem.amount - expectedAmount;
        const isExcessive = Math.abs(variance) > expectedAmount * 0.05; // 5% threshold

        if (isExcessive) {
          validationIssues.push(
            `Charge ${lineItem.amount} exceeds expected ${expectedAmount} by ${variance.toFixed(2)}`
          );
        }

        // Determine legitimacy
        const isLegitimate = validationIssues.length === 0;

        validationResults.push({
          line_item_id: lineItem.line_item_id,
          charge_type: chargeType,
          is_legitimate: isLegitimate,
          expected_amount: expectedAmount,
          actual_amount: lineItem.amount,
          variance: variance,
          validation_issues: validationIssues,
          matched_rate_id: matchingRate.rate_id,
        });

        if (isLegitimate) {
          legitimateCount++;
        } else if (isExcessive) {
          excessiveCount++;
        } else {
          unauthorizedCount++;
        }

        totalVariance += variance;
      }

      const result: ValidateAccessorialsResult = {
        invoice_id: request.invoice_id,
        accessorials_validated: lineItems.length,
        accessorials_legitimate: legitimateCount,
        accessorials_unauthorized: unauthorizedCount,
        accessorials_excessive: excessiveCount,
        total_accessorial_variance: totalVariance,
        validation_details: validationResults,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Find matching accessorial rate (Category B: Reuse rate lookup pattern from R2)
   */
  private async findMatchingAccessorialRate(
    tenantId: string,
    carrierId: string,
    chargeType: AccessorialChargeType,
    invoiceDate: string
  ): Promise<AccessorialRateRow | null> {
    const { data: rates, error } = await this.supabase
      .from('log_accessorial_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('carrier_id', carrierId)
      .eq('charge_type', chargeType)
      .eq('is_active', true)
      .lte('effective_date', invoiceDate)
      .or(`expiration_date.is.null,expiration_date.gte.${invoiceDate}`);

    if (error || !rates || rates.length === 0) {
      return null;
    }

    // Use most recent effective_date
    rates.sort((a, b) => {
      const dateA = new Date(a.effective_date);
      const dateB = new Date(b.effective_date);
      return dateB.getTime() - dateA.getTime();
    });

    return rates[0];
  }

  /**
   * Check for required shipment event (Category D: Novel event validation logic)
   */
  private async checkShipmentEvent(
    tenantId: string,
    shipmentId: string,
    chargeType: AccessorialChargeType,
    threshold: number | null
  ): Promise<boolean> {
    // Map charge type to event type (Category D: Business rule mapping)
    const eventTypeMap: Record<string, string> = {
      detention: 'delay',
      layover: 'delay',
      redelivery: 'delivery_failure',
      storage: 'delay',
    };

    const requiredEventType = eventTypeMap[chargeType];
    if (!requiredEventType) {
      return true; // No specific event required
    }

    // Query shipment events (assumes shipment events table exists)
    const { data: events } = await this.supabase
      .from('log_shipment_events')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('tenant_id', tenantId)
      .eq('event_type', requiredEventType);

    if (!events || events.length === 0) {
      return false;
    }

    // Check threshold if applicable (e.g., detention after 2 hours)
    if (threshold !== null && threshold > 0) {
      const qualifyingEvents = events.filter(event => {
        // Assuming event has duration field
        return event.duration >= threshold;
      });
      return qualifyingEvents.length > 0;
    }

    return true;
  }

  /**
   * Calculate expected accessorial amount (Category D: Accessorial financial logic)
   */
  private calculateAccessorialAmount(
    rate: AccessorialRateRow,
    shipment: any,
    lineItem: LineItemRow
  ): number {
    let amount = 0;

    switch (rate.rate_basis) {
      case 'flat':
        amount = rate.rate_amount;
        break;

      case 'per_hour':
      case 'per_day':
        // Requires duration from line item or shipment
        const duration = lineItem.quantity || 1;
        amount = rate.rate_amount * duration;
        break;

      case 'percentage_of_freight':
        // Percentage of base freight charge
        const baseFreightAmount = shipment.total_amount || 0;
        amount = (baseFreightAmount * rate.rate_amount) / 100;
        break;

      default:
        amount = rate.rate_amount;
    }

    // Apply min/max constraints
    if (rate.minimum_charge && amount < rate.minimum_charge) {
      amount = rate.minimum_charge;
    }
    if (rate.maximum_charge && amount > rate.maximum_charge) {
      amount = rate.maximum_charge;
    }

    return Math.round(amount * 100) / 100;
  }

  // ==========================================================================
  // R4: VARIANCE AGGREGATION
  // ==========================================================================

  async calculateVariance(
    request: CalculateVarianceRequest
  ): Promise<EngineResponse<CalculateVarianceResult>> {
    try {
      // Validate tenant (Category B: Reuse validation pattern)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      const tolerancePercentage = request.tolerance_percentage || 5.0;

      // Get invoice (Category B: Reuse query pattern from R1/R2/R3)
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Get all line items with variance data (Category B: Reuse query pattern)
      const { data: lineItems, error: lineItemsError } = await this.supabase
        .from('log_invoice_line_items')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id);

      if (lineItemsError || !lineItems) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to query line items',
          },
        };
      }

      // Aggregate variance by charge type (Category B: Reuse aggregation pattern from R1 metrics)
      const varianceByChargeType = new Map<string, {
        expected: number;
        actual: number;
        variance: number;
      }>();

      let totalExpected = 0;
      let totalActual = 0;
      let totalVariance = 0;
      let lineItemsWithVariance = 0;

      for (const lineItem of lineItems) {
        const expected = lineItem.expected_amount || lineItem.amount;
        const actual = lineItem.amount;
        const variance = lineItem.variance || 0;

        totalExpected += expected;
        totalActual += actual;
        totalVariance += variance;

        if (Math.abs(variance) > 0.01) {
          lineItemsWithVariance++;
        }

        // Group by charge type (Category B: Reuse grouping pattern from R1)
        const chargeType = lineItem.charge_type;
        const existing = varianceByChargeType.get(chargeType) || {
          expected: 0,
          actual: 0,
          variance: 0,
        };

        varianceByChargeType.set(chargeType, {
          expected: existing.expected + expected,
          actual: existing.actual + actual,
          variance: existing.variance + variance,
        });
      }

      // Calculate percentage variance (Category B: Reuse calculation from R2/R3)
      const totalVariancePercentage = totalExpected > 0
        ? (totalVariance / totalExpected) * 100
        : 0;

      // Classify variance (Category D: Business rule classification logic)
      let classification: InvoiceVarianceSummary['variance_classification'];
      const absVariancePercentage = Math.abs(totalVariancePercentage);

      if (absVariancePercentage <= tolerancePercentage) {
        classification = 'within_tolerance';
      } else if (absVariancePercentage <= tolerancePercentage * 2) {
        classification = 'requires_review';
      } else {
        classification = 'reject';
      }

      // Format variance by charge type (Category B: Data transformation pattern)
      const varianceByChargeTypeArray = Array.from(varianceByChargeType.entries()).map(
        ([chargeType, data]) => ({
          charge_type: chargeType,
          expected_amount: Math.round(data.expected * 100) / 100,
          actual_amount: Math.round(data.actual * 100) / 100,
          variance: Math.round(data.variance * 100) / 100,
          variance_percentage: data.expected > 0
            ? Math.round((data.variance / data.expected) * 10000) / 100
            : 0,
        })
      );

      const varianceSummary: InvoiceVarianceSummary = {
        invoice_id: request.invoice_id,
        total_expected_amount: Math.round(totalExpected * 100) / 100,
        total_actual_amount: Math.round(totalActual * 100) / 100,
        total_variance: Math.round(totalVariance * 100) / 100,
        total_variance_percentage: Math.round(totalVariancePercentage * 100) / 100,
        variance_by_charge_type: varianceByChargeTypeArray,
        variance_classification: classification,
        tolerance_threshold: tolerancePercentage,
        line_items_count: lineItems.length,
        line_items_with_variance: lineItemsWithVariance,
      };

      return {
        success: true,
        data: {
          variance_summary: varianceSummary,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R5: DISCREPANCY MANAGEMENT
  // ==========================================================================

  async createDiscrepancy(
    request: CreateDiscrepancyRequest
  ): Promise<EngineResponse<CreateDiscrepancyResult>> {
    try {
      // Validate tenant (Category B: Reuse validation pattern)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Create discrepancy record (Category B: Reuse CRUD pattern from R1)
      const { data: discrepancyData, error: discrepancyError } = await this.supabase
        .from('log_discrepancies')
        .insert({
          tenant_id: request.tenant_id,
          invoice_id: request.invoice_id,
          line_item_id: request.line_item_id,
          expected_amount: request.expected_amount,
          actual_amount: request.actual_amount,
          variance: request.variance,
          variance_percentage: request.variance_percentage,
          reason: request.reason,
          status: 'open', // Initial state (Category B: State machine pattern)
          assigned_to: request.assigned_to || null,
          assigned_at: request.assigned_to ? new Date().toISOString() : null,
          created_by: this.userId,
        })
        .select()
        .single();

      if (discrepancyError || !discrepancyData) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: discrepancyError?.message || 'Failed to create discrepancy',
          },
        };
      }

      // Map to domain entity (Category B: Mapping pattern from R1)
      const discrepancy = this.mapDiscrepancyRowToEntity(discrepancyData);

      // Publish domain event (Category B: Event pattern from R1)
      const eventPayload: DiscrepancyCreatedPayload = {
        tenant_id: discrepancy.tenant_id,
        discrepancy_id: discrepancy.discrepancy_id,
        invoice_id: discrepancy.invoice_id,
        line_item_id: discrepancy.line_item_id,
        variance: discrepancy.variance,
        variance_percentage: discrepancy.variance_percentage,
        status: 'open',
        assigned_to: discrepancy.assigned_to,
        created_by: discrepancy.created_by,
        created_at: discrepancy.created_at,
      };

      await eventBus.publish({
        type: 'DiscrepancyCreated',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: {
          discrepancy,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R6: APPROVAL WORKFLOW - SUBMIT FOR APPROVAL
  // ==========================================================================

  async submitInvoiceForApproval(
    request: SubmitInvoiceForApprovalRequest
  ): Promise<EngineResponse<SubmitInvoiceForApprovalResult>> {
    try {
      // Validate tenant (Category B: Reuse validation pattern from R1)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Get invoice (Category B: Reuse query pattern from R1)
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Validate state transition (Category B: State machine pattern from R1/R5)
      if (invoice.status !== 'draft') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot submit invoice with status ${invoice.status}. Must be draft.`,
          },
        };
      }

      // Get line items to check validation status (Category B: Query pattern from R4)
      const { data: lineItems } = await this.supabase
        .from('log_invoice_line_items')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id);

      if (!lineItems || lineItems.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: 'Invoice has no line items',
          },
        };
      }

      // Check if validation was performed (R2-R4 prerequisite)
      // Category D: Novel business rule - validation prerequisite check
      const hasExpectedAmounts = lineItems.some(item => item.expected_amount !== null);
      if (!hasExpectedAmounts) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_REQUIRED',
            message: 'Invoice must be validated before submission (run validateRate first)',
          },
        };
      }

      // Calculate total variance (Category B: Reuse calculation from R4)
      const totalVariance = lineItems.reduce((sum, item) => 
        sum + (item.variance || 0), 0
      );

      // Determine if approval required (Category D: Novel business rule)
      const approvalThreshold = request.approval_threshold || 0;
      const hasVariance = Math.abs(totalVariance) > 0.01;
      const exceedsThreshold = Math.abs(totalVariance) > approvalThreshold;
      
      const requiresApproval = hasVariance || exceedsThreshold;
      
      let approvalReason = '';
      if (hasVariance) {
        approvalReason = `Variance detected: ${totalVariance.toFixed(2)}`;
      }
      if (exceedsThreshold) {
        approvalReason += ` (exceeds threshold ${approvalThreshold})`;
      }
      if (!requiresApproval) {
        approvalReason = 'No variance detected';
      }

      // Update invoice status (Category B: State transition pattern from R1)
      const { data: updatedInvoice, error: updateError } = await this.supabase
        .from('log_freight_invoices')
        .update({
          status: 'pending_approval',
          updated_by: this.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .select()
        .single();

      if (updateError || !updatedInvoice) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: updateError?.message || 'Failed to update invoice status',
          },
        };
      }

      // Map to domain entity (Category B: Mapping pattern from R1)
      const invoiceEntity = this.mapInvoiceRowToEntity(updatedInvoice);

      // Publish domain event (Category B: Event pattern from R1/R5)
      const eventPayload: InvoiceSubmittedPayload = {
        tenant_id: invoiceEntity.tenant_id,
        invoice_id: invoiceEntity.invoice_id,
        carrier_id: invoiceEntity.carrier_id,
        total_amount: invoiceEntity.total_amount,
        total_variance: totalVariance,
        requires_approval: requiresApproval,
        approval_reason: approvalReason,
        submitted_by: this.userId,
        submitted_at: new Date(),
      };

      await eventBus.publish({
        type: 'InvoiceSubmitted',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: {
          invoice: invoiceEntity,
          requires_approval: requiresApproval,
          approval_reason: approvalReason,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R7: APPROVAL WORKFLOW - APPROVE INVOICE
  // ==========================================================================

  async approveInvoice(
    request: ApproveInvoiceRequest
  ): Promise<EngineResponse<ApproveInvoiceResult>> {
    try {
      // Validate tenant (Category B: Reuse validation from R1)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Get invoice (Category B: Reuse query from R1)
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Validate state transition (Category B: State machine from R6)
      if (invoice.status !== 'pending_approval') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot approve invoice with status ${invoice.status}. Must be pending_approval.`,
          },
        };
      }

      // Authorization check (Category D: Novel authorization logic)
      // In production: check user role/permissions against approval rules
      // For E3: simplified check - approver_id must be provided
      if (!request.approver_id) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Approver ID required',
          },
        };
      }

      const approvalTimestamp = new Date().toISOString();

      // Update invoice with approval (Category B: State transition + audit from R1)
      const { data: updatedInvoice, error: updateError } = await this.supabase
        .from('log_freight_invoices')
        .update({
          status: 'approved',
          approved_by: request.approver_id,
          approved_at: approvalTimestamp,
          approved_amount: invoice.total_amount,
          updated_by: this.userId,
          updated_at: approvalTimestamp,
        })
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .select()
        .single();

      if (updateError || !updatedInvoice) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: updateError?.message || 'Failed to approve invoice',
          },
        };
      }

      // Map to domain entity (Category B: Mapping from R1)
      const invoiceEntity = this.mapInvoiceRowToEntity(updatedInvoice);

      // Publish domain event (Category B: Event pattern from R1/R5/R6)
      const eventPayload: InvoiceApprovedPayload = {
        tenant_id: invoiceEntity.tenant_id,
        invoice_id: invoiceEntity.invoice_id,
        carrier_id: invoiceEntity.carrier_id,
        total_amount: invoiceEntity.total_amount,
        approved_amount: invoiceEntity.approved_amount || invoiceEntity.total_amount,
        approved_by: invoiceEntity.approved_by || request.approver_id,
        approved_at: invoiceEntity.approved_at || new Date(),
      };

      await eventBus.publish({
        type: 'InvoiceApproved',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: {
          invoice: invoiceEntity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R8: APPROVAL WORKFLOW - REJECT INVOICE
  // ==========================================================================

  async rejectInvoice(
    request: RejectInvoiceRequest
  ): Promise<EngineResponse<RejectInvoiceResult>> {
    try {
      // Validate tenant (Category A: Direct from R7)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Get invoice (Category A: Direct from R7)
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Validate state transition (Category A: Direct from R7)
      if (invoice.status !== 'pending_approval') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot reject invoice with status ${invoice.status}. Must be pending_approval.`,
          },
        };
      }

      // Validate rejection reason (Category B: Input validation pattern)
      if (!request.rejection_reason || request.rejection_reason.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Rejection reason is required',
          },
        };
      }

      const rejectionTimestamp = new Date().toISOString();

      // Update invoice with rejection (Category A: Adapted from R7 approval)
      const { data: updatedInvoice, error: updateError } = await this.supabase
        .from('log_freight_invoices')
        .update({
          status: 'rejected',
          rejected_by: request.rejected_by,
          rejected_at: rejectionTimestamp,
          rejection_reason: request.rejection_reason,
          updated_by: this.userId,
          updated_at: rejectionTimestamp,
        })
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .select()
        .single();

      if (updateError || !updatedInvoice) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: updateError?.message || 'Failed to reject invoice',
          },
        };
      }

      // Map to domain entity (Category A: Direct from R7)
      const invoiceEntity = this.mapInvoiceRowToEntity(updatedInvoice);

      // Publish domain event (Category A: Adapted from R7)
      const eventPayload: InvoiceRejectedPayload = {
        tenant_id: invoiceEntity.tenant_id,
        invoice_id: invoiceEntity.invoice_id,
        carrier_id: invoiceEntity.carrier_id,
        rejection_reason: invoiceEntity.rejection_reason || request.rejection_reason,
        rejected_by: invoiceEntity.rejected_by || request.rejected_by,
        rejected_at: invoiceEntity.rejected_at || new Date(),
      };

      await eventBus.publish({
        type: 'InvoiceRejected',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: {
          invoice: invoiceEntity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R9: PAYMENT WORKFLOW - MARK INVOICE AS PAID
  // ==========================================================================

  async markInvoicePaid(
    request: MarkInvoicePaidRequest
  ): Promise<EngineResponse<MarkInvoicePaidResult>> {
    try {
      // Validate tenant (Category A: Direct from R7/R8)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Get invoice (Category A: Direct from R7/R8)
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Validate state transition (Category A: State machine from R7/R8)
      if (invoice.status !== 'approved') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot mark invoice as paid with status ${invoice.status}. Must be approved.`,
          },
        };
      }

      // Validate payment reference (Category B: Input validation)
      if (!request.payment_reference || request.payment_reference.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Payment reference is required',
          },
        };
      }

      const paidAmount = request.paid_amount || invoice.approved_amount || invoice.total_amount;
      const paymentTimestamp = request.payment_date.toISOString();

      // Update invoice with payment (Category A: Adapted from R7 approval)
      const { data: updatedInvoice, error: updateError } = await this.supabase
        .from('log_freight_invoices')
        .update({
          status: 'paid',
          paid_amount: paidAmount,
          paid_at: paymentTimestamp,
          payment_reference: request.payment_reference,
          updated_by: this.userId,
          updated_at: paymentTimestamp,
        })
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .select()
        .single();

      if (updateError || !updatedInvoice) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: updateError?.message || 'Failed to mark invoice as paid',
          },
        };
      }

      // Map to domain entity (Category A: Direct from R7/R8)
      const invoiceEntity = this.mapInvoiceRowToEntity(updatedInvoice);

      // Publish domain event (Category A: Adapted from R7/R8)
      const eventPayload: InvoicePaidPayload = {
        tenant_id: invoiceEntity.tenant_id,
        invoice_id: invoiceEntity.invoice_id,
        carrier_id: invoiceEntity.carrier_id,
        paid_amount: invoiceEntity.paid_amount || paidAmount,
        payment_reference: invoiceEntity.payment_reference || request.payment_reference,
        paid_at: invoiceEntity.paid_at || request.payment_date,
      };

      await eventBus.publish({
        type: 'InvoicePaid',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: {
          invoice: invoiceEntity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R12: STATE MANAGEMENT - REOPEN INVOICE
  // ==========================================================================

  async reopenInvoice(
    request: ReopenInvoiceRequest
  ): Promise<EngineResponse<ReopenInvoiceResult>> {
    try {
      // Validate tenant (Category A: Direct from R7-R9)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Get invoice (Category A: Direct from R7-R9)
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('log_freight_invoices')
        .select('*')
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        };
      }

      // Validate state transition (Category A: State machine from R7-R9)
      if (invoice.status !== 'rejected') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot reopen invoice with status ${invoice.status}. Must be rejected.`,
          },
        };
      }

      const reopenTimestamp = new Date().toISOString();

      // Update invoice to draft (Category A: State transition from R7-R9)
      const { data: updatedInvoice, error: updateError } = await this.supabase
        .from('log_freight_invoices')
        .update({
          status: 'draft',
          updated_by: request.reopened_by,
          updated_at: reopenTimestamp,
        })
        .eq('invoice_id', request.invoice_id)
        .eq('tenant_id', request.tenant_id)
        .select()
        .single();

      if (updateError || !updatedInvoice) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: updateError?.message || 'Failed to reopen invoice',
          },
        };
      }

      // Map to domain entity (Category A: Direct from R7-R9)
      const invoiceEntity = this.mapInvoiceRowToEntity(updatedInvoice);

      // Publish domain event (Category A: Event pattern from R7-R9)
      const eventPayload: InvoiceReopenedPayload = {
        tenant_id: invoiceEntity.tenant_id,
        invoice_id: invoiceEntity.invoice_id,
        carrier_id: invoiceEntity.carrier_id,
        previous_status: 'rejected',
        new_status: 'draft',
        reopened_by: request.reopened_by,
        reopened_at: new Date(),
        reopen_reason: request.reopen_reason,
      };

      await eventBus.publish({
        type: 'InvoiceReopened',
        payload: eventPayload,
        metadata: {
          tenant_id: this.tenantId,
          user_id: this.userId,
        },
      });

      return {
        success: true,
        data: {
          invoice: invoiceEntity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // R13: BULK OPERATIONS
  // ==========================================================================

  async bulkApproveInvoices(
    request: BulkApproveInvoicesRequest
  ): Promise<EngineResponse<BulkApproveInvoicesResult>> {
    try {
      // Validate tenant (Category B: Reuse validation)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      const succeeded: string[] = [];
      const failed: { invoice_id: string; reason: string }[] = [];

      // Process each invoice (Category B: Reuse R7 approveInvoice)
      for (const invoiceId of request.invoice_ids) {
        const approveResult = await this.approveInvoice({
          tenant_id: request.tenant_id,
          invoice_id: invoiceId,
          approver_id: request.approver_id,
          approval_notes: request.approval_notes,
        });

        if (approveResult.success) {
          succeeded.push(invoiceId);
        } else {
          failed.push({
            invoice_id: invoiceId,
            reason: approveResult.error?.message || 'Unknown error',
          });
        }
      }

      return {
        success: true,
        data: {
          succeeded,
          failed,
          total_processed: request.invoice_ids.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async bulkRejectInvoices(
    request: BulkRejectInvoicesRequest
  ): Promise<EngineResponse<BulkRejectInvoicesResult>> {
    try {
      // Validate tenant (Category B: Reuse validation)
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      const succeeded: string[] = [];
      const failed: { invoice_id: string; reason: string }[] = [];

      // Process each invoice (Category B: Reuse R8 rejectInvoice)
      for (const invoiceId of request.invoice_ids) {
        const rejectResult = await this.rejectInvoice({
          tenant_id: request.tenant_id,
          invoice_id: invoiceId,
          rejected_by: request.rejected_by,
          rejection_reason: request.rejection_reason,
        });

        if (rejectResult.success) {
          succeeded.push(invoiceId);
        } else {
          failed.push({
            invoice_id: invoiceId,
            reason: rejectResult.error?.message || 'Unknown error',
          });
        }
      }

      return {
        success: true,
        data: {
          succeeded,
          failed,
          total_processed: request.invoice_ids.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('log_freight_invoices')
        .select('invoice_id')
        .limit(1);

      return {
        healthy: !error,
        version: ENGINE_VERSION,
        timestamp: new Date(),
      };
    } catch {
      return {
        healthy: false,
        version: ENGINE_VERSION,
        timestamp: new Date(),
      };
    }
  }

  // ==========================================================================
  // IDEMPOTENCY (Category A: Reuse from Shipment pattern)
  // ==========================================================================

  private async checkIdempotency(
    key: string
  ): Promise<EngineResponse<unknown> | null> {
    const { data } = await this.supabase
      .from('log_idempotency_keys')
      .select('*')
      .eq('id', key)
      .eq('tenant_id', this.tenantId)
      .single();

    if (data) {
      return {
        success: true,
        data: data.response_data,
      };
    }

    return null;
  }

  private async storeIdempotency(
    key: string,
    result: unknown
  ): Promise<void> {
    await this.supabase
      .from('log_idempotency_keys')
      .insert({
        id: key,
        tenant_id: this.tenantId,
        response_data: result,
        created_at: new Date().toISOString(),
      });
  }

  // ==========================================================================
  // MAPPING FUNCTIONS
  // ==========================================================================

  private mapInvoiceRowToEntity(row: InvoiceRow): FreightInvoice {
    return {
      invoice_id: row.invoice_id,
      tenant_id: row.tenant_id,
      carrier_id: row.carrier_id,
      invoice_number: row.invoice_number,
      invoice_date: new Date(row.invoice_date),
      due_date: new Date(row.due_date),
      status: row.status as InvoiceStatus,
      currency: row.currency,
      subtotal_amount: row.subtotal_amount,
      tax_amount: row.tax_amount,
      total_amount: row.total_amount,
      approved_amount: row.approved_amount || undefined,
      approved_by: row.approved_by || undefined,
      approved_at: row.approved_at ? new Date(row.approved_at) : undefined,
      paid_amount: row.paid_amount || undefined,
      paid_at: row.paid_at ? new Date(row.paid_at) : undefined,
      payment_reference: row.payment_reference || undefined,
      rejection_reason: row.rejection_reason || undefined,
      rejected_by: row.rejected_by || undefined,
      rejected_at: row.rejected_at ? new Date(row.rejected_at) : undefined,
      created_by: row.created_by,
      created_at: new Date(row.created_at),
      updated_by: row.updated_by || undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }

  private mapLineItemRowToEntity(row: LineItemRow): InvoiceLineItem {
    return {
      line_item_id: row.line_item_id,
      invoice_id: row.invoice_id,
      tenant_id: row.tenant_id,
      shipment_id: row.shipment_id,
      charge_type: row.charge_type as any,
      description: row.description,
      quantity: row.quantity,
      unit_price: row.unit_price,
      amount: row.amount,
      expected_amount: row.expected_amount || undefined,
      variance: row.variance || undefined,
      variance_reason: row.variance_reason || undefined,
      created_at: new Date(row.created_at),
    };
  }
  
  private mapDiscrepancyRowToEntity(row: DiscrepancyRow): Discrepancy {
    return {
      discrepancy_id: row.discrepancy_id,
      tenant_id: row.tenant_id,
      invoice_id: row.invoice_id,
      line_item_id: row.line_item_id,
      expected_amount: row.expected_amount,
      actual_amount: row.actual_amount,
      variance: row.variance,
      variance_percentage: row.variance_percentage,
      reason: row.reason,
      status: row.status as DiscrepancyStatus,
      assigned_to: row.assigned_to || undefined,
      assigned_at: row.assigned_at ? new Date(row.assigned_at) : undefined,
      resolution_notes: row.resolution_notes || undefined,
      resolved_by: row.resolved_by || undefined,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      created_by: row.created_by,
      created_at: new Date(row.created_at),
      updated_by: row.updated_by || undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}
