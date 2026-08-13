/**
 * BELLA MEDICAL CLINIC — V2 MEDICAL BILLING PRODUCT SERVICE
 *
 * Orchestrates outpatient invoicing and health insurance (BHYT) calculations
 * in full compliance with:
 * - H12 Constitution & Law 3 (Contract-Only dependency injection)
 * - Manifest Single Source of Truth
 *
 * @module src/products/bella-medical/services/medical-billing.service
 */

import { medicalProductManifest } from '../manifest';

export interface MedicalBillingItem {
  itemCode: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
}

export interface CalculatedBillingLine {
  itemCode: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  bhytCovered: number;
  patientPay: number;
}

export interface CalculatedBillingResult {
  totalAmount: number;
  bhytCoveredAmount: number;
  patientCoPayAmount: number;
  bhytBenefitRate: number;
  items: CalculatedBillingLine[];
}

export interface IRevenueContract {
  recordRevenue(request: {
    tenantId: string;
    encounterId: string;
    invoiceId: string;
    amount: number;
    bhytAmount: number;
    patientPayable: number;
    paymentMethod: string;
  }): Promise<void>;
}

export class MedicalBillingProductService {
  constructor(private readonly revenueContract: IRevenueContract) {}

  private assertCapability(capabilityId: string) {
    const capabilities = medicalProductManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  private assertWorkflow(workflowId: string) {
    const workflows = medicalProductManifest.workflows || [];
    if (!workflows.includes(workflowId)) {
      throw new Error(`MANIFEST_VIOLATION: Workflow '${workflowId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Calculates outpatient billing totals, applying BHYT benefit rates
   */
  async calculateOutpatientBilling(
    tenantId: string,
    benefitRate: number,
    items: MedicalBillingItem[]
  ): Promise<CalculatedBillingResult> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    const hasBHYT = benefitRate > 0;
    let totalAmount = 0;
    let bhytCoveredAmount = 0;
    let patientCoPayAmount = 0;

    const itemsCalculated = items.map((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      const lineBHYT = hasBHYT ? (lineTotal * benefitRate) / 100 : 0;
      const linePatient = lineTotal - lineBHYT;

      totalAmount += lineTotal;
      bhytCoveredAmount += lineBHYT;
      patientCoPayAmount += linePatient;

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        total: lineTotal,
        bhytCovered: lineBHYT,
        patientPay: linePatient,
      };
    });

    return {
      totalAmount,
      bhytCoveredAmount,
      patientCoPayAmount,
      bhytBenefitRate: benefitRate,
      items: itemsCalculated,
    };
  }

  /**
   * Processes a medical payment and posts the invoice to the Accounting outbox via Public Contract
   */
  async processMedicalPayment(request: {
    tenantId: string;
    encounterId: string;
    invoiceId: string;
    paymentMethod: 'cash' | 'transfer' | 'card' | 'bhyt_direct';
    billingResult: CalculatedBillingResult;
  }): Promise<{ success: boolean; invoiceId: string }> {
    this.assertCapability('medical_resource_command');
    this.assertWorkflow('outpatient_consultation_flow');
    if (!request.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!request.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    // Record revenue through public revenue contract (Zero Direct Table Writes)
    await this.revenueContract.recordRevenue({
      tenantId: request.tenantId,
      encounterId: request.encounterId,
      invoiceId: request.invoiceId,
      amount: request.billingResult.totalAmount,
      bhytAmount: request.billingResult.bhytCoveredAmount,
      patientPayable: request.billingResult.patientCoPayAmount,
      paymentMethod: request.paymentMethod,
    });

    return {
      success: true,
      invoiceId: request.invoiceId,
    };
  }
}
