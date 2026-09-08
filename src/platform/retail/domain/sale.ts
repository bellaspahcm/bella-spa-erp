/**
 * Sale Domain Entity
 * 
 * Canonical Authority: supabase/migrations/20260905000001_retail_os_canonical_schema.sql
 * Table: retail_sales
 * 
 * Business Rules:
 * 1. Sale number required and unique per tenant
 * 2. Amounts must be non-negative
 * 3. Total = Subtotal + Tax - Discount
 * 4. Status transitions: DRAFT → COMPLETED → [CANCELLED|REFUNDED]
 * 5. Completed sales cannot be modified
 * 6. Completed sales must have completed_at timestamp
 */

import type { RetailSale as RetailSaleRow } from '../../../types/retail-database.types';

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'LOYALTY_POINTS';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'FAILED';

export interface SaleProps {
  id: string;
  tenantId: string;
  saleNumber: string;
  customerId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: SaleStatus;
  saleDate: Date;
  completedAt?: Date;
  cashierId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSaleCommand {
  tenantId: string;
  saleNumber: string;
  customerId?: string;
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  cashierId?: string;
}

export interface UpdateSaleCommand {
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  paymentMethod?: PaymentMethod;
}

export class Sale {
  private constructor(private props: SaleProps) {}

  static create(command: CreateSaleCommand): Sale {
    // Validation
    if (!command.saleNumber || command.saleNumber.trim() === '') {
      throw new Error('Sale number is required');
    }

    if (command.subtotal < 0) {
      throw new Error('Subtotal cannot be negative');
    }

    const taxAmount = command.taxAmount ?? 0;
    const discountAmount = command.discountAmount ?? 0;

    if (taxAmount < 0) {
      throw new Error('Tax amount cannot be negative');
    }

    if (discountAmount < 0) {
      throw new Error('Discount amount cannot be negative');
    }

    const totalAmount = command.subtotal + taxAmount - discountAmount;

    if (totalAmount < 0) {
      throw new Error('Total amount cannot be negative');
    }

    const now = new Date();

    return new Sale({
      id: crypto.randomUUID(),
      tenantId: command.tenantId,
      saleNumber: command.saleNumber.trim(),
      customerId: command.customerId,
      subtotal: command.subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paymentMethod: command.paymentMethod,
      paymentStatus: 'PENDING',
      status: 'DRAFT',
      saleDate: now,
      cashierId: command.cashierId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(row: RetailSaleRow): Sale {
    return new Sale({
      id: row.id,
      tenantId: row.tenant_id,
      saleNumber: row.sale_number,
      customerId: row.customer_id ?? undefined,
      subtotal: row.subtotal,
      taxAmount: row.tax_amount,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      paymentMethod: row.payment_method as PaymentMethod,
      paymentStatus: row.payment_status as PaymentStatus,
      status: row.status as SaleStatus,
      saleDate: new Date(row.sale_date),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      cashierId: row.cashier_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  update(command: UpdateSaleCommand): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Cannot update completed, cancelled or refunded sale');
    }

    if (command.subtotal !== undefined) {
      if (command.subtotal < 0) {
        throw new Error('Subtotal cannot be negative');
      }
      this.props.subtotal = command.subtotal;
    }

    if (command.taxAmount !== undefined) {
      if (command.taxAmount < 0) {
        throw new Error('Tax amount cannot be negative');
      }
      this.props.taxAmount = command.taxAmount;
    }

    if (command.discountAmount !== undefined) {
      if (command.discountAmount < 0) {
        throw new Error('Discount amount cannot be negative');
      }
      this.props.discountAmount = command.discountAmount;
    }

    if (command.paymentMethod !== undefined) {
      this.props.paymentMethod = command.paymentMethod;
    }

    // Recalculate total
    this.props.totalAmount = this.props.subtotal + this.props.taxAmount - this.props.discountAmount;

    if (this.props.totalAmount < 0) {
      throw new Error('Total amount cannot be negative');
    }

    this.props.updatedAt = new Date();
  }

  complete(): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only complete DRAFT sales');
    }

    this.props.status = 'COMPLETED';
    this.props.paymentStatus = 'COMPLETED';
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (this.props.status === 'COMPLETED') {
      throw new Error('Cannot cancel completed sale - use refund instead');
    }

    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only cancel DRAFT sales');
    }

    this.props.status = 'CANCELLED';
    this.props.paymentStatus = 'FAILED';
    this.props.updatedAt = new Date();
  }

  refund(): void {
    if (this.props.status !== 'COMPLETED') {
      throw new Error('Can only refund COMPLETED sales');
    }

    this.props.status = 'REFUNDED';
    this.props.paymentStatus = 'REFUNDED';
    this.props.updatedAt = new Date();
  }

  toPersistence(): RetailSaleRow {
    return {
      id: this.props.id,
      tenant_id: this.props.tenantId,
      sale_number: this.props.saleNumber,
      customer_id: this.props.customerId ?? null,
      subtotal: this.props.subtotal,
      tax_amount: this.props.taxAmount,
      discount_amount: this.props.discountAmount,
      total_amount: this.props.totalAmount,
      payment_method: this.props.paymentMethod,
      payment_status: this.props.paymentStatus,
      status: this.props.status,
      sale_date: this.props.saleDate.toISOString(),
      completed_at: this.props.completedAt?.toISOString() ?? null,
      cashier_id: this.props.cashierId ?? null,
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString(),
    };
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get saleNumber(): string { return this.props.saleNumber; }
  get customerId(): string | undefined { return this.props.customerId; }
  get subtotal(): number { return this.props.subtotal; }
  get taxAmount(): number { return this.props.taxAmount; }
  get discountAmount(): number { return this.props.discountAmount; }
  get totalAmount(): number { return this.props.totalAmount; }
  get paymentMethod(): PaymentMethod { return this.props.paymentMethod; }
  get paymentStatus(): PaymentStatus { return this.props.paymentStatus; }
  get status(): SaleStatus { return this.props.status; }
  get saleDate(): Date { return this.props.saleDate; }
  get completedAt(): Date | undefined { return this.props.completedAt; }
  get cashierId(): string | undefined { return this.props.cashierId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get isDraft(): boolean { return this.props.status === 'DRAFT'; }
  get isCompleted(): boolean { return this.props.status === 'COMPLETED'; }
  get isCancelled(): boolean { return this.props.status === 'CANCELLED'; }
  get isRefunded(): boolean { return this.props.status === 'REFUNDED'; }
}
