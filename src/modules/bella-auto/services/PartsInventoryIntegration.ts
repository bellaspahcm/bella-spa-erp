/**
 * Parts Inventory Integration
 * Auto-deduct parts from inventory when repair orders are completed
 * Integrates with existing inventory system
 * 
 * @module bella-auto/services/PartsInventoryIntegration
 */

import { getPrimaryClient } from '@/lib/database/read-replica';

export interface PartDeduction {
  inventoryItemId: string;
  partNumber: string;
  partName: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  repairOrderId: string;
  repairOrderNumber: string;
}

export interface InventoryCheckResult {
  available: boolean;
  currentStock: number;
  requiredQuantity: number;
  shortfall?: number;
}

export class PartsInventoryIntegration {
  /**
   * Check parts availability for repair order
   */
  static async checkPartsAvailability(
    tenantId: string,
    repairOrderId: string
  ): Promise<{
    allAvailable: boolean;
    items: Array<{
      itemId: string;
      partNumber?: string;
      partName: string;
      requiredQuantity: number;
      availableStock: number;
      shortfall: number;
    }>;
  }> {
    const supabase = getPrimaryClient();

    // Get all parts from repair order line items
    const { data: lineItems, error: itemsError } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId)
      .eq('item_type', 'part');

    if (itemsError) {
      throw new Error(`Failed to get line items: ${itemsError.message}`);
    }

    if (!lineItems || lineItems.length === 0) {
      return { allAvailable: true, items: [] };
    }

    const availabilityChecks = [];

    for (const item of lineItems) {
      if (!item.inventory_item_id) {
        // Part not tracked in inventory
        availabilityChecks.push({
          itemId: item.id,
          partNumber: item.part_number,
          partName: item.item_name,
          requiredQuantity: item.quantity,
          availableStock: item.quantity, // Assume available
          shortfall: 0,
        });
        continue;
      }

      // Check inventory stock
      const { data: inventoryItem } = await supabase
        .from('inventory')
        .select('quantity_on_hand')
        .eq('id', item.inventory_item_id)
        .eq('tenant_id', tenantId)
        .single();

      const availableStock = inventoryItem?.quantity_on_hand || 0;
      const requiredQuantity = item.quantity;
      const shortfall = Math.max(0, requiredQuantity - availableStock);

      availabilityChecks.push({
        itemId: item.id,
        partNumber: item.part_number,
        partName: item.item_name,
        requiredQuantity,
        availableStock,
        shortfall,
      });
    }

    const allAvailable = availabilityChecks.every(check => check.shortfall === 0);

    return {
      allAvailable,
      items: availabilityChecks,
    };
  }

  /**
   * Auto-deduct parts when repair order is completed
   */
  static async deductPartsOnCompletion(
    tenantId: string,
    repairOrderId: string,
    completedBy: string
  ): Promise<PartDeduction[]> {
    const supabase = getPrimaryClient();

    // Get repair order details
    const { data: repairOrder, error: roError } = await supabase
      .from('auto_repair_orders')
      .select('order_number')
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .single();

    if (roError || !repairOrder) {
      throw new Error(`Repair order not found: ${roError?.message}`);
    }

    // Get all parts from repair order
    const { data: lineItems, error: itemsError } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId)
      .eq('item_type', 'part')
      .eq('status', 'completed'); // Only deduct completed items

    if (itemsError) {
      throw new Error(`Failed to get line items: ${itemsError.message}`);
    }

    if (!lineItems || lineItems.length === 0) {
      return [];
    }

    const deductions: PartDeduction[] = [];

    for (const item of lineItems) {
      if (!item.inventory_item_id) {
        // Part not tracked in inventory, skip
        continue;
      }

      // Check if already deducted
      const { data: existingDeduction } = await supabase
        .from('inventory_transactions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('inventory_item_id', item.inventory_item_id)
        .eq('reference_type', 'repair_order')
        .eq('reference_id', repairOrderId)
        .eq('transaction_type', 'usage')
        .single();

      if (existingDeduction) {
        console.log(`[PartsInventory] Part already deducted: ${item.item_name}`);
        continue;
      }

      // Get current inventory item
      const { data: inventoryItem, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', item.inventory_item_id)
        .eq('tenant_id', tenantId)
        .single();

      if (invError || !inventoryItem) {
        console.error(`[PartsInventory] Inventory item not found: ${item.inventory_item_id}`);
        continue;
      }

      const quantityUsed = item.quantity;
      const unitCost = Number(inventoryItem.unit_cost || 0);
      const totalCost = quantityUsed * unitCost;

      // Check if enough stock
      if (inventoryItem.quantity_on_hand < quantityUsed) {
        console.warn(
          `[PartsInventory] Insufficient stock for ${item.item_name}. ` +
          `Available: ${inventoryItem.quantity_on_hand}, Required: ${quantityUsed}`
        );
        // Still proceed with deduction (will go negative)
      }

      // Create inventory transaction
      const { error: transError } = await supabase
        .from('inventory_transactions')
        .insert({
          tenant_id: tenantId,
          inventory_item_id: item.inventory_item_id,
          transaction_type: 'usage',
          quantity: quantityUsed,
          unit_cost: unitCost,
          total_cost: totalCost,
          reference_type: 'repair_order',
          reference_id: repairOrderId,
          notes: `Auto-deducted for repair order ${repairOrder.order_number}`,
          performed_by: completedBy,
          transaction_date: new Date().toISOString().split('T')[0],
        });

      if (transError) {
        console.error(`[PartsInventory] Failed to create transaction: ${transError.message}`);
        continue;
      }

      // Update inventory quantity
      const newQuantity = inventoryItem.quantity_on_hand - quantityUsed;
      await supabase
        .from('inventory')
        .update({
          quantity_on_hand: newQuantity,
          last_updated: new Date().toISOString(),
        })
        .eq('id', item.inventory_item_id);

      // Check for low stock alert
      if (inventoryItem.reorder_point && newQuantity <= inventoryItem.reorder_point) {
        await this.createLowStockAlert(tenantId, item.inventory_item_id, newQuantity);
      }

      deductions.push({
        inventoryItemId: item.inventory_item_id,
        partNumber: item.part_number || '',
        partName: item.item_name,
        quantityUsed,
        unitCost,
        totalCost,
        repairOrderId,
        repairOrderNumber: repairOrder.order_number,
      });
    }

    return deductions;
  }

  /**
   * Reserve parts for repair order (when approved)
   */
  static async reserveParts(
    tenantId: string,
    repairOrderId: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Get all parts from repair order
    const { data: lineItems, error } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId)
      .eq('item_type', 'part');

    if (error || !lineItems) return;

    for (const item of lineItems) {
      if (!item.inventory_item_id) continue;

      // Update inventory reserved quantity
      const { data: inventoryItem } = await supabase
        .from('inventory')
        .select('quantity_reserved')
        .eq('id', item.inventory_item_id)
        .single();

      if (inventoryItem) {
        const newReserved = (inventoryItem.quantity_reserved || 0) + item.quantity;
        await supabase
          .from('inventory')
          .update({ quantity_reserved: newReserved })
          .eq('id', item.inventory_item_id);
      }
    }
  }

  /**
   * Release reserved parts (when repair order cancelled)
   */
  static async releaseParts(
    tenantId: string,
    repairOrderId: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Get all parts from repair order
    const { data: lineItems, error } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId)
      .eq('item_type', 'part');

    if (error || !lineItems) return;

    for (const item of lineItems) {
      if (!item.inventory_item_id) continue;

      // Update inventory reserved quantity
      const { data: inventoryItem } = await supabase
        .from('inventory')
        .select('quantity_reserved')
        .eq('id', item.inventory_item_id)
        .single();

      if (inventoryItem) {
        const newReserved = Math.max(0, (inventoryItem.quantity_reserved || 0) - item.quantity);
        await supabase
          .from('inventory')
          .update({ quantity_reserved: newReserved })
          .eq('id', item.inventory_item_id);
      }
    }
  }

  /**
   * Get parts usage report
   */
  static async getPartsUsageReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    partNumber: string;
    partName: string;
    totalQuantityUsed: number;
    totalCost: number;
    usageCount: number;
    averageCostPerUsage: number;
  }>> {
    const supabase = getPrimaryClient();

    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *,
        inventory!inner(item_code, item_name)
      `)
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'usage')
      .eq('reference_type', 'repair_order')
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0]);

    if (error || !transactions) {
      return [];
    }

    // Aggregate by part
    const partsMap = new Map<string, {
      partNumber: string;
      partName: string;
      totalQuantityUsed: number;
      totalCost: number;
      usageCount: number;
    }>();

    for (const trans of transactions) {
      const inv = trans.inventory as any;
      const partNumber = inv.item_code || '';
      const partName = inv.item_name || '';

      const existing = partsMap.get(partNumber) || {
        partNumber,
        partName,
        totalQuantityUsed: 0,
        totalCost: 0,
        usageCount: 0,
      };

      existing.totalQuantityUsed += trans.quantity;
      existing.totalCost += Number(trans.total_cost || 0);
      existing.usageCount += 1;

      partsMap.set(partNumber, existing);
    }

    return Array.from(partsMap.values()).map(part => ({
      ...part,
      averageCostPerUsage: part.usageCount > 0 ? part.totalCost / part.usageCount : 0,
    }));
  }

  /**
   * Get low stock alerts
   */
  static async getLowStockAlerts(
    tenantId: string
  ): Promise<Array<{
    inventoryItemId: string;
    partNumber: string;
    partName: string;
    currentStock: number;
    reorderPoint: number;
    status: 'low' | 'critical' | 'out_of_stock';
  }>> {
    const supabase = getPrimaryClient();

    const { data: items, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('reorder_point', 'is', null)
      .order('quantity_on_hand', { ascending: true });

    if (error || !items) {
      return [];
    }

    const alerts = [];

    for (const item of items) {
      const currentStock = item.quantity_on_hand || 0;
      const reorderPoint = item.reorder_point || 0;

      if (currentStock <= 0) {
        alerts.push({
          inventoryItemId: item.id,
          partNumber: item.item_code || '',
          partName: item.item_name || '',
          currentStock,
          reorderPoint,
          status: 'out_of_stock' as const,
        });
      } else if (currentStock <= reorderPoint * 0.5) {
        alerts.push({
          inventoryItemId: item.id,
          partNumber: item.item_code || '',
          partName: item.item_name || '',
          currentStock,
          reorderPoint,
          status: 'critical' as const,
        });
      } else if (currentStock <= reorderPoint) {
        alerts.push({
          inventoryItemId: item.id,
          partNumber: item.item_code || '',
          partName: item.item_name || '',
          currentStock,
          reorderPoint,
          status: 'low' as const,
        });
      }
    }

    return alerts;
  }

  /**
   * Create low stock alert
   */
  private static async createLowStockAlert(
    tenantId: string,
    inventoryItemId: string,
    currentStock: number
  ): Promise<void> {
    // TODO: Integrate with notification/alert system
    console.log(`[PartsInventory] Low stock alert: Item ${inventoryItemId}, Stock: ${currentStock}`);
  }

  /**
   * Get parts cost for repair order
   */
  static async getPartsCoSTForRepairOrder(
    tenantId: string,
    repairOrderId: string
  ): Promise<{
    totalPartsCost: number;
    items: Array<{
      partName: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }>;
  }> {
    const supabase = getPrimaryClient();

    const { data: lineItems, error } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId)
      .eq('item_type', 'part');

    if (error || !lineItems) {
      return { totalPartsCost: 0, items: [] };
    }

    const items = lineItems.map(item => ({
      partName: item.item_name,
      quantity: item.quantity,
      unitCost: Number(item.unit_price || 0),
      totalCost: Number(item.total_amount || 0),
    }));

    const totalPartsCost = items.reduce((sum, item) => sum + item.totalCost, 0);

    return { totalPartsCost, items };
  }
}
