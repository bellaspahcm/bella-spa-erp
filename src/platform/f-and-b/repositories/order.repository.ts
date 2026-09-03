/**
 * F&B Order Repository
 * 
 * Business Logic based on Business Truth Discovery
 * Confidence: 0.88 (Order workflow)
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { Order, OrderLine, OrderStatus, OrderType } from '../types';

export interface CreateOrderDTO {
  tenant_id: string;
  customer_id?: string;
  table_id?: string;
  order_type: OrderType;
  tax?: number;
  discount?: number;
  created_by?: string;
}

export interface AddOrderLineDTO {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Create new order
   * Business Truth: Order starts with status = PENDING
   */
  async createOrder(dto: CreateOrderDTO): Promise<Order> {
    const result = await this.db.query<Order>(
      `
      INSERT INTO f_and_b_orders (
        tenant_id,
        customer_id,
        table_id,
        status,
        order_type,
        tax,
        discount,
        created_by
      )
      VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7)
      RETURNING *
      `,
      [
        dto.tenant_id,
        dto.customer_id || null,
        dto.table_id || null,
        dto.order_type,
        dto.tax || null,
        dto.discount || null,
        dto.created_by || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Add line item to order
   * Business Truth: Subtotal = quantity * unit_price (enforced by trigger)
   * Business Truth: Order total recalculated automatically (trigger)
   */
  async addOrderLine(
    tenant_id: string,
    order_id: string,
    dto: AddOrderLineDTO
  ): Promise<OrderLine> {
    const result = await this.db.query<OrderLine>(
      `
      INSERT INTO f_and_b_order_lines (
        tenant_id,
        order_id,
        menu_item_id,
        quantity,
        unit_price,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        tenant_id,
        order_id,
        dto.menu_item_id,
        dto.quantity,
        dto.unit_price,
        dto.notes || null,
      ]
    );

    // Order total automatically recalculated by trigger
    return result.rows[0];
  }

  /**
   * Update order status
   * Business Truth: Order workflow
   * PENDING → PREPARING → READY → SERVED → PAID → COMPLETED
   */
  async updateStatus(
    tenant_id: string,
    order_id: string,
    status: OrderStatus,
    updated_by?: string
  ): Promise<Order> {
    const result = await this.db.query<Order>(
      `
      UPDATE f_and_b_orders
      SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $2
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
      `,
      [status, updated_by || null, order_id, tenant_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Order ${order_id} not found`);
    }

    return result.rows[0];
  }

  /**
   * Send order to kitchen
   * Business Truth: Status changes to PREPARING
   * Business Rule: Inventory decrease (if strategy = DECREASE_ON_KITCHEN_CONFIRM)
   */
  async sendToKitchen(
    tenant_id: string,
    order_id: string,
    inventoryStrategy: 'DECREASE_ON_KITCHEN_CONFIRM' | 'DECREASE_ON_PAYMENT'
  ): Promise<Order> {
    const order = await this.updateStatus(tenant_id, order_id, 'PREPARING');

    // Business Rule: Inventory decrease timing (configurable)
    if (inventoryStrategy === 'DECREASE_ON_KITCHEN_CONFIRM') {
      await this.decreaseInventoryForOrder(tenant_id, order_id);
    }

    return order;
  }

  /**
   * Mark order as ready
   * Business Truth: Kitchen completed preparation
   */
  async markReady(tenant_id: string, order_id: string): Promise<Order> {
    return this.updateStatus(tenant_id, order_id, 'READY');
  }

  /**
   * Mark order as served
   * Business Truth: Food delivered to customer
   */
  async markServed(tenant_id: string, order_id: string): Promise<Order> {
    return this.updateStatus(tenant_id, order_id, 'SERVED');
  }

  /**
   * Process payment
   * Business Truth: Payment completed, status = PAID
   * Business Rule: Inventory decrease (if strategy = DECREASE_ON_PAYMENT)
   */
  async processPayment(
    tenant_id: string,
    order_id: string,
    inventoryStrategy: 'DECREASE_ON_KITCHEN_CONFIRM' | 'DECREASE_ON_PAYMENT'
  ): Promise<Order> {
    const order = await this.updateStatus(tenant_id, order_id, 'PAID');

    // Business Rule: Inventory decrease timing (configurable)
    if (inventoryStrategy === 'DECREASE_ON_PAYMENT') {
      await this.decreaseInventoryForOrder(tenant_id, order_id);
    }

    return order;
  }

  /**
   * Complete order
   * Business Truth: Final state
   */
  async completeOrder(tenant_id: string, order_id: string): Promise<Order> {
    return this.updateStatus(tenant_id, order_id, 'COMPLETED');
  }

  /**
   * Cancel order
   * Business Truth: Order cancelled (may need inventory adjustment)
   */
  async cancelOrder(tenant_id: string, order_id: string): Promise<Order> {
    // TODO: Handle inventory restoration if already decreased
    return this.updateStatus(tenant_id, order_id, 'CANCELLED');
  }

  /**
   * Get order with lines
   */
  async getOrder(tenant_id: string, order_id: string): Promise<Order & { lines: OrderLine[] }> {
    const orderResult = await this.db.query<Order>(
      `SELECT * FROM f_and_b_orders WHERE id = $1 AND tenant_id = $2`,
      [order_id, tenant_id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error(`Order ${order_id} not found`);
    }

    const linesResult = await this.db.query<OrderLine>(
      `SELECT * FROM f_and_b_order_lines WHERE order_id = $1 AND tenant_id = $2`,
      [order_id, tenant_id]
    );

    return {
      ...orderResult.rows[0],
      lines: linesResult.rows,
    };
  }

  /**
   * Business Rule: Decrease inventory for order
   * 
   * Evidence: toasttab.com (conflicting models)
   * Decision: Configurable timing
   * Confidence: 0.70
   * 
   * Note: Simplified for MVP (no recipe tracking)
   */
  private async decreaseInventoryForOrder(
    tenant_id: string,
    order_id: string
  ): Promise<void> {
    // TODO: Implement inventory decrease logic
    // For MVP: Simplified (no recipe/ingredient mapping)
    // Deferred: Recipe-to-inventory tracking (insufficient evidence)
    
    // Placeholder: Would decrease inventory based on order lines
    // In full implementation: recipe → ingredients → inventory items
  }
}
