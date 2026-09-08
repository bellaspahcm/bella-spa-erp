/**
 * SaleItem Domain Entity
 * 
 * Canonical Authority: supabase/migrations/20260905000001_retail_os_canonical_schema.sql
 * Table: retail_sale_items
 * 
 * Business Rules:
 * 1. Quantity must be positive
 * 2. Unit price must be non-negative
 * 3. Discount amount must be non-negative
 * 4. Line total = (quantity * unit_price) - discount_amount
 * 5. Line total must be non-negative
 */

import type { RetailSaleItem as RetailSaleItemRow } from '../../../types/retail-database.types';

export interface SaleItemProps {
  id: string;
  tenantId: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  createdAt: Date;
}

export interface CreateSaleItemCommand {
  tenantId: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}

export class SaleItem {
  private constructor(private props: SaleItemProps) {}

  static create(command: CreateSaleItemCommand): SaleItem {
    // Validation: quantity must be positive
    if (command.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Validation: unit price must be non-negative
    if (command.unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    const discountAmount = command.discountAmount ?? 0;

    // Validation: discount amount must be non-negative
    if (discountAmount < 0) {
      throw new Error('Discount amount cannot be negative');
    }

    // Calculate line total
    const lineTotal = (command.quantity * command.unitPrice) - discountAmount;

    // Validation: line total must be non-negative
    if (lineTotal < 0) {
      throw new Error('Line total cannot be negative (discount too large)');
    }

    return new SaleItem({
      id: crypto.randomUUID(),
      tenantId: command.tenantId,
      saleId: command.saleId,
      productId: command.productId,
      quantity: command.quantity,
      unitPrice: command.unitPrice,
      discountAmount,
      lineTotal,
      createdAt: new Date(),
    });
  }

  static fromPersistence(row: RetailSaleItemRow): SaleItem {
    return new SaleItem({
      id: row.id,
      tenantId: row.tenant_id,
      saleId: row.sale_id,
      productId: row.product_id,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      discountAmount: row.discount_amount,
      lineTotal: row.line_total,
      createdAt: new Date(row.created_at),
    });
  }

  updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    this.props.quantity = newQuantity;
    this.recalculateLineTotal();
  }

  updateUnitPrice(newPrice: number): void {
    if (newPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    this.props.unitPrice = newPrice;
    this.recalculateLineTotal();
  }

  applyDiscount(discountAmount: number): void {
    if (discountAmount < 0) {
      throw new Error('Discount amount cannot be negative');
    }

    this.props.discountAmount = discountAmount;
    this.recalculateLineTotal();
  }

  private recalculateLineTotal(): void {
    const lineTotal = (this.props.quantity * this.props.unitPrice) - this.props.discountAmount;

    if (lineTotal < 0) {
      throw new Error('Line total cannot be negative (discount too large)');
    }

    this.props.lineTotal = lineTotal;
  }

  toPersistence(): RetailSaleItemRow {
    return {
      id: this.props.id,
      tenant_id: this.props.tenantId,
      sale_id: this.props.saleId,
      product_id: this.props.productId,
      quantity: this.props.quantity,
      unit_price: this.props.unitPrice,
      discount_amount: this.props.discountAmount,
      line_total: this.props.lineTotal,
      created_at: this.props.createdAt.toISOString(),
    };
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get saleId(): string { return this.props.saleId; }
  get productId(): string { return this.props.productId; }
  get quantity(): number { return this.props.quantity; }
  get unitPrice(): number { return this.props.unitPrice; }
  get discountAmount(): number { return this.props.discountAmount; }
  get lineTotal(): number { return this.props.lineTotal; }
  get createdAt(): Date { return this.props.createdAt; }
}
