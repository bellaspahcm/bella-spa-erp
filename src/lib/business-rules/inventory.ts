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
