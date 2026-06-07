export const INVENTORY_REASONS = {
  initial: 'initial',
  restock: 'restock',
  sessionConsumption: 'session_consumption',
  monthlyReconciliation: 'monthly_reconciliation',
} as const;

export type InventoryMovementKind =
  | 'purchase'
  | 'consumption'
  | 'reconciliation'
  | 'unknown';

export type InventoryStockInput = {
  stockLevel: number | string | null | undefined;
  amount: number | string | null | undefined;
};

export type InventorySummaryItemLike = {
  stock_level?: number | string | null;
  min_stock_level?: number | string | null;
  price_per_unit?: number | string | null;
};

export type PackageMaterialInput = {
  item_id?: string | null;
  quantity_per_session?: number | string | null;
};

export type SessionMaterialLike = {
  quantity_per_session?: number | string | null;
  inventory_items?: {
    id?: string | null;
    price_per_unit?: number | string | null;
  } | null;
};

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function classifyInventoryMovementReason(reason: string | null | undefined): InventoryMovementKind {
  const normalized = normalize(reason);

  if (['purchase', 'import', 'stock_in', INVENTORY_REASONS.restock, INVENTORY_REASONS.initial].includes(normalized)) {
    return 'purchase';
  }

  if (['consume', 'consumed', 'session_consumed', 'used', INVENTORY_REASONS.sessionConsumption].includes(normalized)) {
    return 'consumption';
  }

  if ([INVENTORY_REASONS.monthlyReconciliation, 'reconciliation', 'stock_count'].includes(normalized)) {
    return 'reconciliation';
  }

  return 'unknown';
}

export function calculateRestockMovement(input: InventoryStockInput) {
  const previousStock = Math.max(0, asFiniteNumber(input.stockLevel));
  const amount = asFiniteNumber(input.amount);

  if (amount <= 0) {
    return { error: 'Số lượng nhập kho không hợp lệ' };
  }

  return {
    previousStock,
    changeAmount: amount,
    newStock: previousStock + amount,
    reason: INVENTORY_REASONS.restock,
  };
}

export function calculateConsumptionMovement(
  input: InventoryStockInput & { itemName?: string | null },
) {
  const previousStock = Math.max(0, asFiniteNumber(input.stockLevel));
  const amount = asFiniteNumber(input.amount);

  if (amount <= 0) {
    return { error: 'Số lượng tiêu hao không hợp lệ' };
  }

  if (previousStock < amount) {
    const itemName = input.itemName || 'Mat hang';
    return {
      error: `${itemName} không đủ tồn kho (Hiện có: ${previousStock}, Cần tiêu hao: ${amount})`,
    };
  }

  return {
    previousStock,
    changeAmount: -amount,
    newStock: previousStock - amount,
    reason: INVENTORY_REASONS.sessionConsumption,
  };
}

export function calculateRollbackStock(input: {
  stockLevel: number | string | null | undefined;
  changeAmount: number | string | null | undefined;
}) {
  return Math.max(0, asFiniteNumber(input.stockLevel) + Math.abs(asFiniteNumber(input.changeAmount)));
}

export function calculateLowStockState(input: {
  stockLevel: number | string | null | undefined;
  minStockLevel: number | string | null | undefined;
}) {
  const stockLevel = Math.max(0, asFiniteNumber(input.stockLevel));
  const minStockLevel = Math.max(0, asFiniteNumber(input.minStockLevel));
  return {
    stockLevel,
    minStockLevel,
    isLowStock: stockLevel <= minStockLevel,
  };
}

export function calculateInventorySummary(items: InventorySummaryItemLike[] | null | undefined) {
  const list = items ?? [];
  return {
    totalItems: list.length,
    lowStockCount: list.filter((item) => calculateLowStockState({
      stockLevel: item.stock_level,
      minStockLevel: item.min_stock_level,
    }).isLowStock).length,
    totalValue: list.reduce(
      (sum, item) => sum + Math.max(0, asFiniteNumber(item.stock_level)) * Math.max(0, asFiniteNumber(item.price_per_unit)),
      0,
    ),
  };
}

export function normalizePackageMaterialRows(rows: PackageMaterialInput[] | null | undefined) {
  return (rows ?? [])
    .map((row) => ({
      item_id: String(row.item_id ?? '').trim(),
      quantity_per_session: asFiniteNumber(row.quantity_per_session),
    }))
    .filter((row) => row.item_id && row.quantity_per_session > 0);
}

export function calculateOpeningStock(stockLevel: number | string | null | undefined) {
  const initialStock = asFiniteNumber(stockLevel);
  if (initialStock < 0) {
    return { error: 'Tồn kho ban đầu không hợp lệ' };
  }
  return { initialStock };
}

export function calculateMonthlyReconciliationEntry(input: {
  actualStock: number | string | null | undefined;
  expectedStock: number | string | null | undefined;
  unit?: string | null;
  periodLabel: string;
  notes?: string | null;
}) {
  const actualStock = asFiniteNumber(input.actualStock, Number.NaN);
  if (!Number.isFinite(actualStock) || actualStock < 0) {
    return { error: 'Số lượng thực tế không hợp lệ' };
  }

  const expectedStock = asFiniteNumber(input.expectedStock);
  const variance = actualStock - expectedStock;
  const noteText = variance === 0
    ? `Kiểm kê tháng ${input.periodLabel}: khớp sổ${input.notes ? ` - ${input.notes}` : ''}`
    : `Kiểm kê tháng ${input.periodLabel}: thực tế ${actualStock} vs dự kiến ${expectedStock} (${variance > 0 ? '+' : ''}${variance} ${input.unit || ''})${input.notes ? ` - ${input.notes}` : ''}`;

  return {
    actualStock,
    expectedStock,
    variance,
    noteText,
    reason: INVENTORY_REASONS.monthlyReconciliation,
  };
}

export function buildSessionConsumptionPlan(materials: SessionMaterialLike[] | null | undefined) {
  const items = (materials ?? []).flatMap((material) => {
    const quantity = asFiniteNumber(material.quantity_per_session);
    const itemId = material.inventory_items?.id;
    if (!itemId || quantity <= 0) return [];

    const unitCost = Math.max(0, asFiniteNumber(material.inventory_items?.price_per_unit));
    return [{
      itemId,
      quantity,
      unitCost,
      cost: quantity * unitCost,
    }];
  });

  return {
    items,
    totalCost: items.reduce((sum, item) => sum + item.cost, 0),
  };
}
