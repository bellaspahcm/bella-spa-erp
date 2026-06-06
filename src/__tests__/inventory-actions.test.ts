import {
  addInventoryItem,
  autoConsumeForSession,
  consumeInventory,
  detectInventorySessionReconciliationIssues,
  getInventoryItems,
  getInventoryLogs,
  getInventoryLogsByDateRange,
  getInventorySummary,
  getPackageMaterials,
  restockItem,
  rollbackInventoryConsumption,
  saveMonthlyReconciliation,
  upsertPackageMaterials,
} from '../services/inventory-actions';
import type { Database } from '../types/database.types';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockEnqueueWithAutoClient = jest.fn();

type PackageMaterialRow = Database['public']['Tables']['package_materials']['Row'];
type PackageMaterialInsert = Database['public']['Tables']['package_materials']['Insert'];

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: any[]) => mockEnqueueWithAutoClient(...args),
}));

class MockQueryBuilder {
  constructor(private data: any = null, private error: any = null) {}

  select() { return this; }
  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  gte() { return this; }
  lte() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

type ScriptedResult = {
  table: string;
  op: string;
  data?: any;
  error?: any;
};

class ScriptedQueryBuilder {
  private op = '';

  constructor(
    private table: string,
    private scripts: ScriptedResult[],
    private calls: Array<{ table: string; op: string; payload?: any }>
  ) {}

  select() {
    if (!this.op) {
      this.op = 'select';
      this.calls.push({ table: this.table, op: 'select' });
    }
    return this;
  }

  update(payload: any) {
    this.op = 'update';
    this.calls.push({ table: this.table, op: 'update', payload });
    return this;
  }

  insert(payload: any) {
    this.op = 'insert';
    this.calls.push({ table: this.table, op: 'insert', payload });
    return this;
  }

  delete() {
    this.op = 'delete';
    this.calls.push({ table: this.table, op: 'delete' });
    return this;
  }

  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  gte() { return this; }
  lte() { return this; }
  in() { return this; }
  single() { return this; }

  then(onfulfilled: any) {
    const next = this.scripts.shift();
    if (!next) {
      throw new Error(`No scripted result for ${this.table}.${this.op}`);
    }
    if (next.table !== this.table || next.op !== this.op) {
      throw new Error(`Expected ${next.table}.${next.op}, got ${this.table}.${this.op}`);
    }
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null }).then(onfulfilled);
  }
}

describe('inventory read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-1',
    });
  });

  it('propagates inventory item query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'items query failed' }));

    await expect(getInventoryItems()).rejects.toThrow('Failed to fetch inventory items: items query failed');
  });

  it('propagates inventory log query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'logs query failed' }));

    await expect(getInventoryLogs()).rejects.toThrow('Failed to fetch inventory logs: logs query failed');
  });

  it('propagates date-range inventory log query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'date logs query failed' }));

    await expect(getInventoryLogsByDateRange('2026-05-01', '2026-05-30')).rejects.toThrow(
      'Failed to fetch inventory logs by date range: date logs query failed'
    );
  });

  it('propagates inventory summary query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'summary query failed' }));

    await expect(getInventorySummary()).rejects.toThrow('Failed to fetch inventory summary: summary query failed');
  });

  it('propagates package material query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'materials query failed' }));

    await expect(getPackageMaterials('pkg-1')).rejects.toThrow(
      'Failed to fetch package materials for package pkg-1: materials query failed'
    );
  });
});

describe('inventory write action side effects', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockEnqueueWithAutoClient.mockResolvedValue({ success: true });
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-1',
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  function installScriptedSupabase(scripts: ScriptedResult[]) {
    const calls: Array<{ table: string; op: string; payload?: any }> = [];
    mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
    return calls;
  }

  it('rolls back restock stock update when inventory log insert fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'select', data: { stock_level: 5 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert', error: { message: 'log insert failed' } },
      { table: 'inventory_items', op: 'update' },
    ]);

    const result = await restockItem('item-1', 3, 'manual restock');

    expect(result).toEqual({
      success: false,
      error: 'Lỗi ghi log nhập kho: log insert failed',
    });
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      { stock_level: 8 },
      { stock_level: 5 },
    ]);
    expect(calls.find(c => c.table === 'inventory_logs' && c.op === 'insert')?.payload).toMatchObject({
      item_id: 'item-1',
      change_amount: 3,
      reason: 'restock',
      tenant_id: 'tenant-1',
    });
  });

  it('rolls back consumption stock update when inventory log insert fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'select', data: { name: 'Gel', stock_level: 5 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert', error: { message: 'log insert failed' } },
      { table: 'inventory_items', op: 'update' },
    ]);

    const result = await consumeInventory('item-1', 2, 'session-1');

    expect(result).toEqual({
      success: false,
      error: 'Lỗi ghi log tiêu hao: log insert failed',
    });
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      { stock_level: 3 },
      { stock_level: 5 },
    ]);
    expect(calls.find(c => c.table === 'inventory_logs' && c.op === 'insert')?.payload).toMatchObject({
      item_id: 'item-1',
      change_amount: -2,
      reason: 'session_consumption',
      session_log_id: 'session-1',
      tenant_id: 'tenant-1',
    });
  });

  it('creates an item and writes an initial inventory log when opening stock is positive', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'insert', data: { id: 'item-new' } },
      { table: 'inventory_logs', op: 'insert' },
    ]);

    const result = await addInventoryItem({
      name: 'Serum',
      sku: 'SRM-001',
      unit: 'chai',
      stock_level: 12,
      min_stock_level: 3,
      price_per_unit: 100000,
      category: 'Skincare',
    });

    expect(result.success).toBe(true);
    expect(calls.find(c => c.table === 'inventory_items' && c.op === 'insert')?.payload).toMatchObject({
      name: 'Serum',
      sku: 'SRM-001',
      unit: 'chai',
      stock_level: 12,
      min_stock_level: 3,
      price_per_unit: 100000,
      category: 'Skincare',
      tenant_id: 'tenant-1',
    });
    expect(calls.find(c => c.table === 'inventory_logs' && c.op === 'insert')?.payload).toMatchObject({
      item_id: 'item-new',
      change_amount: 12,
      reason: 'initial',
      created_by: 'user-1',
      tenant_id: 'tenant-1',
    });
  });

  it('does not require an initial inventory log when opening stock is zero', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'insert', data: { id: 'item-new' } },
    ]);

    const result = await addInventoryItem({
      name: 'Serum',
      unit: 'chai',
      stock_level: 0,
      min_stock_level: 3,
      price_per_unit: 100000,
    });

    expect(result.success).toBe(true);
    expect(calls.filter(c => c.table === 'inventory_logs')).toHaveLength(0);
  });

  it('deletes a newly-created item when initial inventory log insert fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'insert', data: { id: 'item-new' } },
      { table: 'inventory_logs', op: 'insert', error: { message: 'initial log failed' } },
      { table: 'inventory_items', op: 'delete' },
    ]);

    const result = await addInventoryItem({
      name: 'Serum',
      unit: 'chai',
      stock_level: 12,
      min_stock_level: 3,
      price_per_unit: 100000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('initial log failed');
    expect(calls.filter(c => c.table === 'inventory_items').map(c => c.op)).toEqual(['insert', 'delete']);
  });

  it('saves monthly reconciliation for all valid entries', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'select', data: { name: 'Serum', unit: 'chai', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
      { table: 'inventory_items', op: 'select', data: { name: 'Gel', unit: 'tuyp', stock_level: 5 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
    ]);

    const result = await saveMonthlyReconciliation(2026, 6, [
      { item_id: 'item-1', actual_stock: 12, notes: 'counted' },
      { item_id: 'item-2', actual_stock: 5 },
    ]);

    expect(result).toEqual({ success: true, processed: 2, failed: 0 });
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ stock_level: 12 }),
      expect.objectContaining({ stock_level: 5 }),
    ]);
    expect(calls.filter(c => c.table === 'inventory_logs' && c.op === 'insert').map(c => c.payload)).toEqual([
      expect.objectContaining({
        item_id: 'item-1',
        change_amount: 2,
        reason: 'monthly_reconciliation',
        created_by: 'user-1',
        tenant_id: 'tenant-1',
      }),
      expect.objectContaining({
        item_id: 'item-2',
        change_amount: 0,
        reason: 'monthly_reconciliation',
        created_by: 'user-1',
        tenant_id: 'tenant-1',
      }),
    ]);
  });

  it('returns failure and skips database writes for invalid monthly reconciliation entries', async () => {
    const calls = installScriptedSupabase([]);

    const result = await saveMonthlyReconciliation(2026, 6, [
      { item_id: 'item-1', actual_stock: -1 },
      { item_id: '', actual_stock: 3 },
    ]);

    expect(result.success).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.error).toContain('2 lỗi');
    expect(calls).toHaveLength(0);
  });

  it('rolls back monthly reconciliation stock update when log insert fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'select', data: { name: 'Serum', unit: 'chai', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert', error: { message: 'monthly log failed' } },
      { table: 'inventory_items', op: 'update' },
    ]);

    const result = await saveMonthlyReconciliation(2026, 6, [
      { item_id: 'item-1', actual_stock: 12 },
    ]);

    expect(result.success).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.error).toContain('monthly log failed');
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ stock_level: 12 }),
      expect.objectContaining({ stock_level: 10 }),
    ]);
  });

  it('reports rollback failure when monthly reconciliation stock restore fails', async () => {
    installScriptedSupabase([
      { table: 'inventory_items', op: 'select', data: { name: 'Serum', unit: 'chai', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert', error: { message: 'monthly log failed' } },
      { table: 'inventory_items', op: 'update', error: { message: 'restore stock failed' } },
    ]);

    const result = await saveMonthlyReconciliation(2026, 6, [
      { item_id: 'item-1', actual_stock: 12 },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('monthly log failed');
    expect(result.error).toContain('rollback failed - restore stock failed');
  });

  it('does not report success when monthly reconciliation partially saves entries', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_items', op: 'select', data: { name: 'Serum', unit: 'chai', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
      { table: 'inventory_items', op: 'select', data: { name: 'Gel', unit: 'tuyp', stock_level: 5 } },
      { table: 'inventory_items', op: 'update', error: { message: 'update failed' } },
    ]);

    const result = await saveMonthlyReconciliation(2026, 6, [
      { item_id: 'item-1', actual_stock: 12 },
      { item_id: 'item-2', actual_stock: 6 },
    ]);

    expect(result.success).toBe(false);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.error).toContain('update failed');
    expect(calls.filter(c => c.table === 'inventory_logs' && c.op === 'insert')).toHaveLength(1);
  });

  it('detects session inventory reconciliation issues across sessions, logs, duplicates, and outbox', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'session_logs',
        op: 'select',
        data: [
          { id: 'session-missing-log', status: 'completed', completed_date: '2026-06-06', booking_id: 'booking-1' },
          { id: 'session-ok', status: 'completed', completed_date: '2026-06-06', booking_id: 'booking-2' },
          { id: 'session-dup', status: 'completed', completed_date: '2026-06-06', booking_id: 'booking-3' },
        ],
      },
      {
        table: 'inventory_logs',
        op: 'select',
        data: [
          { id: 'log-ok', item_id: 'item-1', session_log_id: 'session-ok', change_amount: -2, created_at: '2026-06-06' },
          { id: 'log-orphan', item_id: 'item-2', session_log_id: 'session-rolled-back', change_amount: -1, created_at: '2026-06-06' },
          { id: 'log-dup-1', item_id: 'item-3', session_log_id: 'session-dup', change_amount: -1, created_at: '2026-06-06' },
          { id: 'log-dup-2', item_id: 'item-3', session_log_id: 'session-dup', change_amount: -1, created_at: '2026-06-06' },
        ],
      },
      {
        table: 'session_logs',
        op: 'select',
        data: [
          { id: 'session-ok', status: 'completed', completed_date: '2026-06-06', booking_id: 'booking-2' },
          { id: 'session-dup', status: 'completed', completed_date: '2026-06-06', booking_id: 'booking-3' },
          { id: 'session-rolled-back', status: 'assigned', completed_date: null, booking_id: 'booking-4' },
        ],
      },
      {
        table: 'accounting_outbox',
        op: 'select',
        data: [{ id: 'outbox-ok', reference_id: 'session-ok', status: 'PENDING' }],
      },
    ]);

    const result = await detectInventorySessionReconciliationIssues();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(result.summary).toEqual({
      missing_inventory_log: 1,
      orphan_inventory_log: 1,
      duplicate_inventory_log: 1,
      missing_inventory_outbox: 1,
    });
    expect(result.issues.map((issue) => issue.type)).toEqual(expect.arrayContaining([
      'missing_inventory_log',
      'orphan_inventory_log',
      'duplicate_inventory_log',
      'missing_inventory_outbox',
    ]));
    expect(result.issues.find((issue) => issue.type === 'missing_inventory_log')).toMatchObject({
      severity: 'warning',
      sessionLogId: 'session-missing-log',
    });
    expect(result.issues.find((issue) => issue.type === 'orphan_inventory_log')).toMatchObject({
      severity: 'critical',
      sessionLogId: 'session-rolled-back',
      inventoryLogIds: ['log-orphan'],
    });
    expect(result.issues.find((issue) => issue.type === 'duplicate_inventory_log')).toMatchObject({
      severity: 'critical',
      sessionLogId: 'session-dup',
      itemId: 'item-3',
      inventoryLogIds: ['log-dup-1', 'log-dup-2'],
    });
    expect(result.issues.find((issue) => issue.type === 'missing_inventory_outbox')).toMatchObject({
      severity: 'warning',
      sessionLogId: 'session-dup',
      inventoryLogIds: ['log-dup-1', 'log-dup-2'],
    });
    expect(calls.map(c => `${c.table}.${c.op}`)).toEqual([
      'session_logs.select',
      'inventory_logs.select',
      'session_logs.select',
      'accounting_outbox.select',
    ]);
  });

  it('returns explicit failure when inventory reconciliation session query fails', async () => {
    installScriptedSupabase([
      { table: 'session_logs', op: 'select', error: { message: 'session query failed' } },
    ]);

    const result = await detectInventorySessionReconciliationIssues();

    expect(result).toEqual({
      success: false,
      error: 'Lỗi tải danh sách ca hoàn thành: session query failed',
      issues: [],
    });
  });

  it('halts rollback and preserves logs when restoring stock fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_logs', op: 'select', data: [{ id: 'log-1', item_id: 'item-1', change_amount: -2 }] },
      { table: 'inventory_items', op: 'select', data: { stock_level: 3 } },
      { table: 'inventory_items', op: 'update', error: { message: 'stock update failed' } },
    ]);

    const result = await rollbackInventoryConsumption('session-1');

    expect(result).toEqual({
      success: false,
      error: 'Lỗi hoàn kho vật tư item-1: stock update failed',
    });
    expect(calls.some(c => c.table === 'inventory_logs' && c.op === 'delete')).toBe(false);
  });

  it('treats repeated inventory rollback as a no-op when no consumption logs remain', async () => {
    const calls = installScriptedSupabase([
      { table: 'inventory_logs', op: 'select', data: [] },
    ]);

    const result = await rollbackInventoryConsumption('session-1');

    expect(result).toEqual({ success: true, processed: 0 });
    expect(calls).toEqual([{ table: 'inventory_logs', op: 'select' }]);
    expect(calls.some(c => c.table === 'inventory_items' && c.op === 'update')).toBe(false);
    expect(calls.some(c => c.table === 'inventory_logs' && c.op === 'delete')).toBe(false);
  });

  it('replaces package materials by deleting old rows and inserting valid new rows', async () => {
    const calls = installScriptedSupabase([
      { table: 'package_materials', op: 'select', data: [] },
      { table: 'package_materials', op: 'delete' },
      { table: 'package_materials', op: 'insert' },
    ]);

    const result = await upsertPackageMaterials('pkg-1', [
      { item_id: 'item-1', quantity_per_session: 2 },
      { item_id: 'item-2', quantity_per_session: 0 },
      { item_id: 'item-3', quantity_per_session: 1.5 },
    ]);

    expect(result).toEqual({ success: true, inserted: 2 });
    expect(calls.filter(c => c.table === 'package_materials').map(c => c.op)).toEqual([
      'select',
      'delete',
      'insert',
    ]);
    expect(calls.find(c => c.table === 'package_materials' && c.op === 'insert')?.payload).toEqual([
      {
        tenant_id: 'tenant-1',
        package_id: 'pkg-1',
        item_id: 'item-1',
        quantity_per_session: 2,
      },
      {
        tenant_id: 'tenant-1',
        package_id: 'pkg-1',
        item_id: 'item-3',
        quantity_per_session: 1.5,
      },
    ]);
  });

  it('deletes old package materials without inserting when replacement rows are empty', async () => {
    const calls = installScriptedSupabase([
      { table: 'package_materials', op: 'select', data: [] },
      { table: 'package_materials', op: 'delete' },
    ]);

    const result = await upsertPackageMaterials('pkg-1', []);

    expect(result).toEqual({ success: true, inserted: 0 });
    expect(calls.filter(c => c.table === 'package_materials').map(c => c.op)).toEqual([
      'select',
      'delete',
    ]);
    expect(calls.some(c => c.table === 'package_materials' && c.op === 'insert')).toBe(false);
  });

  it('does not insert replacement package materials when delete fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'package_materials', op: 'select', data: [] },
      { table: 'package_materials', op: 'delete', error: { message: 'delete failed' } },
    ]);

    const result = await upsertPackageMaterials('pkg-1', [
      { item_id: 'item-1', quantity_per_session: 2 },
    ]);

    expect(result).toEqual({
      success: false,
      error: 'Lỗi xóa định mức cũ: delete failed',
    });
    expect(calls.some(c => c.table === 'package_materials' && c.op === 'insert')).toBe(false);
  });

  it('restores old package materials when replacement insert fails', async () => {
    const oldRows: PackageMaterialRow[] = [
      {
        id: 'pm-1',
        tenant_id: 'tenant-1',
        package_id: 'pkg-1',
        item_id: 'item-old',
        quantity_per_session: 3,
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ];
    const calls = installScriptedSupabase([
      { table: 'package_materials', op: 'select', data: oldRows },
      { table: 'package_materials', op: 'delete' },
      { table: 'package_materials', op: 'insert', error: { message: 'insert failed' } },
      { table: 'package_materials', op: 'insert' },
    ]);

    const result = await upsertPackageMaterials('pkg-1', [
      { item_id: 'item-new', quantity_per_session: 2 },
    ]);

    expect(result).toEqual({
      success: false,
      error: 'Lỗi lưu định mức mới: insert failed',
    });
    const insertPayloads = calls
      .filter(c => c.table === 'package_materials' && c.op === 'insert')
      .map(c => c.payload);
    expect(insertPayloads).toHaveLength(2);
    expect(insertPayloads[1]).toEqual<PackageMaterialInsert[]>([
      {
        tenant_id: 'tenant-1',
        package_id: 'pkg-1',
        item_id: 'item-old',
        quantity_per_session: 3,
      },
    ]);
  });

  it('reports rollback failure when restoring old package materials fails', async () => {
    const oldRows: PackageMaterialRow[] = [
      {
        id: 'pm-1',
        tenant_id: 'tenant-1',
        package_id: 'pkg-1',
        item_id: 'item-old',
        quantity_per_session: 3,
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ];
    installScriptedSupabase([
      { table: 'package_materials', op: 'select', data: oldRows },
      { table: 'package_materials', op: 'delete' },
      { table: 'package_materials', op: 'insert', error: { message: 'insert failed' } },
      { table: 'package_materials', op: 'insert', error: { message: 'restore failed' } },
    ]);

    const result = await upsertPackageMaterials('pkg-1', [
      { item_id: 'item-new', quantity_per_session: 2 },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Lỗi lưu định mức mới: insert failed');
    expect(result.error).toContain('rollback failed: restore failed');
  });

  it('bypasses auto consumption when tenant config disables it', async () => {
    const calls = installScriptedSupabase([
      { table: 'tenants', op: 'select', data: { salary_config: { auto_consume_inventory: false } } },
    ]);

    const result = await autoConsumeForSession('pkg-1', 'session-1');

    expect(result).toEqual({ success: true, bypassed: true });
    expect(calls).toEqual([{ table: 'tenants', op: 'select' }]);
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('consumes all configured package materials and enqueues accounting outbox', async () => {
    const calls = installScriptedSupabase([
      { table: 'tenants', op: 'select', data: { salary_config: { auto_consume_inventory: true } } },
      { table: 'inventory_logs', op: 'select', data: [] },
      {
        table: 'package_materials',
        op: 'select',
        data: [
          { quantity_per_session: 2, inventory_items: { id: 'item-1', price_per_unit: 1000 } },
          { quantity_per_session: 1.5, inventory_items: { id: 'item-2', price_per_unit: 2000 } },
        ],
      },
      { table: 'inventory_items', op: 'select', data: { name: 'Gel', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
      { table: 'inventory_items', op: 'select', data: { name: 'Oil', stock_level: 5 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
    ]);

    const result = await autoConsumeForSession('pkg-1', 'session-1');

    expect(result).toEqual({ success: true, processed: 2, totalCost: 5000 });
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      { stock_level: 8 },
      { stock_level: 3.5 },
    ]);
    expect(calls.filter(c => c.table === 'inventory_logs' && c.op === 'insert').map(c => c.payload)).toEqual([
      expect.objectContaining({
        item_id: 'item-1',
        change_amount: -2,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        tenant_id: 'tenant-1',
      }),
      expect.objectContaining({
        item_id: 'item-2',
        change_amount: -1.5,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        tenant_id: 'tenant-1',
      }),
    ]);
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockFrom }),
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'INVENTORY_CONSUMED',
        referenceType: 'SESSION_LOG',
        referenceId: 'session-1',
        payload: expect.objectContaining({
          amount: 5000,
          branchId: 'tenant-1',
        }),
      }),
      '[autoConsumeForSession]'
    );
  });

  it('does not consume inventory twice when the session already has consumption logs', async () => {
    const calls = installScriptedSupabase([
      { table: 'tenants', op: 'select', data: { salary_config: { auto_consume_inventory: true } } },
      { table: 'inventory_logs', op: 'select', data: [{ id: 'log-1', change_amount: -2 }] },
    ]);

    const result = await autoConsumeForSession('pkg-1', 'session-1');

    expect(result).toEqual({
      success: true,
      bypassed: true,
      alreadyConsumed: true,
      processed: 1,
      totalCost: 0,
    });
    expect(calls).toEqual([
      { table: 'tenants', op: 'select' },
      { table: 'inventory_logs', op: 'select' },
    ]);
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('returns explicit failure when existing consumption log check fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'tenants', op: 'select', data: { salary_config: { auto_consume_inventory: true } } },
      { table: 'inventory_logs', op: 'select', error: { message: 'log check failed' } },
    ]);

    const result = await autoConsumeForSession('pkg-1', 'session-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('log check failed');
    expect(calls).toEqual([
      { table: 'tenants', op: 'select' },
      { table: 'inventory_logs', op: 'select' },
    ]);
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('rolls back earlier auto consumption when a later material cannot be consumed', async () => {
    const calls = installScriptedSupabase([
      { table: 'tenants', op: 'select', data: { salary_config: { auto_consume_inventory: true } } },
      { table: 'inventory_logs', op: 'select', data: [] },
      {
        table: 'package_materials',
        op: 'select',
        data: [
          { quantity_per_session: 2, inventory_items: { id: 'item-1', price_per_unit: 1000 } },
          { quantity_per_session: 9, inventory_items: { id: 'item-2', price_per_unit: 2000 } },
        ],
      },
      { table: 'inventory_items', op: 'select', data: { name: 'Gel', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
      { table: 'inventory_items', op: 'select', data: { name: 'Oil', stock_level: 5 } },
      { table: 'inventory_logs', op: 'select', data: [{ id: 'log-1', item_id: 'item-1', change_amount: -2 }] },
      { table: 'inventory_items', op: 'select', data: { stock_level: 8 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'delete' },
    ]);

    const result = await autoConsumeForSession('pkg-1', 'session-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Oil');
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      { stock_level: 8 },
      { stock_level: 10 },
    ]);
    expect(calls.filter(c => c.table === 'inventory_logs').map(c => c.op)).toEqual(['select', 'insert', 'select', 'delete']);
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('rolls back auto consumption when accounting outbox enqueue returns false', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    const calls = installScriptedSupabase([
      { table: 'tenants', op: 'select', data: { salary_config: { auto_consume_inventory: true } } },
      { table: 'inventory_logs', op: 'select', data: [] },
      {
        table: 'package_materials',
        op: 'select',
        data: [
          { quantity_per_session: 2, inventory_items: { id: 'item-1', price_per_unit: 1000 } },
        ],
      },
      { table: 'inventory_items', op: 'select', data: { name: 'Gel', stock_level: 10 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'insert' },
      { table: 'inventory_logs', op: 'select', data: [{ id: 'log-1', item_id: 'item-1', change_amount: -2 }] },
      { table: 'inventory_items', op: 'select', data: { stock_level: 8 } },
      { table: 'inventory_items', op: 'update' },
      { table: 'inventory_logs', op: 'delete' },
    ]);

    const result = await autoConsumeForSession('pkg-1', 'session-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to enqueue INVENTORY_CONSUMED accounting event');
    expect(calls.filter(c => c.table === 'inventory_items' && c.op === 'update').map(c => c.payload)).toEqual([
      { stock_level: 8 },
      { stock_level: 10 },
    ]);
    expect(calls.filter(c => c.table === 'inventory_logs').map(c => c.op)).toEqual(['select', 'insert', 'select', 'delete']);
  });
});
