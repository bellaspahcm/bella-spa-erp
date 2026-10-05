jest.mock('server-only', () => ({}), { virtual: true });

const mockCreateClient = jest.fn();
const mockResolveSingleStaffBranchContext = jest.fn();
const mockRecalculateAndSaveSalaryRecord = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/services/beauty-branch-context', () => ({
  resolveSingleStaffBranchContext: (...args: unknown[]) => mockResolveSingleStaffBranchContext(...args),
}));

jest.mock('@/modules/hr-salary/actions/admin-salary-actions', () => ({
  recalculateAndSaveSalaryRecord: (...args: unknown[]) => mockRecalculateAndSaveSalaryRecord(...args),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

import { createProductSale } from '@/modules/product-sales/actions/product-sales-actions';

type InsertCall = {
  table: string;
  payload: unknown;
};

function createSupabaseMock(insertCalls: InsertCall[]) {
  class QueryBuilder {
    private operation: 'insert' | '' = '';
    private payload: unknown;

    constructor(private table: string) {}

    select() {
      return this;
    }

    eq() {
      return this;
    }

    insert(payload: unknown) {
      this.operation = 'insert';
      this.payload = payload;
      insertCalls.push({ table: this.table, payload });
      return this;
    }

    single() {
      if (this.table === 'tenants') {
        return Promise.resolve({
          data: {
            id: 'tenant-1',
            metadata: {
              commission_config: {
                product_sales_commission_default: {
                  type: 'percentage',
                  value: 10,
                },
              },
            },
          },
          error: null,
        });
      }

      if (this.table === 'product_sales' && this.operation === 'insert') {
        return Promise.resolve({
          data: {
            id: 'sale-1',
            calculated_commission: 30_000,
          },
          error: null,
        });
      }

      return Promise.resolve({
        data: null,
        error: { message: `Unexpected query ${this.table}.${this.operation}` },
      });
    }
  }

  return {
    from: jest.fn((table: string) => new QueryBuilder(table)),
  };
}

describe('product sales branch-aware writer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveSingleStaffBranchContext.mockResolvedValue({
      success: true,
      context: {
        branchId: 'branch-a',
        rootOrgUnitId: 'branch-a',
      },
    });
    mockRecalculateAndSaveSalaryRecord.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
  });

  it('persists Platform-authorized branch_id on product_sales insert', async () => {
    const insertCalls: InsertCall[] = [];
    mockCreateClient.mockResolvedValue(createSupabaseMock(insertCalls));

    const result = await createProductSale({
      tenantId: 'tenant-1',
      ktvId: 'ktv-1',
      productName: 'Serum',
      quantity: 2,
      unitPrice: 150_000,
      totalSalesAmount: 300_000,
      paymentMethod: 'cash',
      saleDate: '2026-10-05',
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: 'sale-1',
        calculatedCommission: 30_000,
      },
    });
    expect(mockResolveSingleStaffBranchContext).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'ktv-1',
      asOfDate: '2026-10-05',
      branchId: undefined,
    }));
    expect(insertCalls).toEqual([
      {
        table: 'product_sales',
        payload: expect.objectContaining({
          tenant_id: 'tenant-1',
          ktv_id: 'ktv-1',
          branch_id: 'branch-a',
          product_name: 'Serum',
        }),
      },
    ]);
  });

  it('denies product sale before write when Platform branch authorization fails', async () => {
    const insertCalls: InsertCall[] = [];
    mockCreateClient.mockResolvedValue(createSupabaseMock(insertCalls));
    mockResolveSingleStaffBranchContext.mockResolvedValueOnce({
      success: false,
      error: 'KTV không thuộc chi nhánh bán sản phẩm này',
    });

    const result = await createProductSale({
      tenantId: 'tenant-1',
      ktvId: 'ktv-1',
      productName: 'Serum',
      quantity: 1,
      unitPrice: 150_000,
      totalSalesAmount: 150_000,
      paymentMethod: 'cash',
      saleDate: '2026-10-05',
      branchId: 'branch-b',
    });

    expect(result).toEqual({
      success: false,
      error: 'KTV không thuộc chi nhánh bán sản phẩm này',
    });
    expect(insertCalls).toEqual([]);
  });
});
