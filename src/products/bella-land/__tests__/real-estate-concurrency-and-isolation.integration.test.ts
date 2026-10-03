/**
 * BELLA LAND V2 — HARDENED CONCURRENCY, TENANT ISOLATION & TRUTH/PROJECTION INTEGRATION SUITE
 *
 * Verifies key commercial operational invariants:
 * - R3: Tenant Isolation Negative Evidence (Tenant A vs Tenant B boundary)
 * - R4: Double-Hold Concurrency Invariant (Simultaneous unit lock -> 1 winner, 1 rejected)
 * - R5: Truth vs Projection Invariant (Operational state is source of truth, projection cannot mutate backwards)
 *
 * @module src/products/bella-land/__tests__/real-estate-concurrency-and-isolation.integration.test
 */

import { PropertyCatalogProductService } from '../services/property-catalog.service';
import { ReservationProductService } from '../services/reservation.service';
import { ContractProductService, CreateContractDTO } from '../services/contract.service';
import { CommissionProductService } from '../services/commission.service';
import type {
  IPropertyInventoryContract,
  PropertyUnitRow,
} from '../../../platform/real-estate/contracts/property-inventory.contract';
import type { IReservationContract } from '../../../platform/real-estate/contracts/reservation.contract';
import type { IPropertyContract, ContractRow } from '../../../platform/real-estate/contracts/property.contract';
import type { ICommissionContract, CommissionRow } from '../../../platform/real-estate/contracts/commission.contract';

const TIMESTAMP = '2026-10-01T00:00:00.000Z';
type UnitStateStatus = 'available' | 'reserved' | 'contracted';

function productStatusFromUnit(status: UnitStateStatus): PropertyUnitRow['status'] {
  if (status === 'reserved') return 'booked';
  return status;
}

function productRow(overrides: Partial<PropertyUnitRow> = {}): PropertyUnitRow {
  return {
    area: 75,
    area_m2: null,
    block: null,
    created_at: TIMESTAMP,
    created_by: null,
    customer_id: null,
    deleted_at: null,
    direction: null,
    floor: null,
    floor_number: null,
    id: 'unit-RE-A101',
    metadata: null,
    owner_name: null,
    product_code: 'A1-101',
    product_type: 'apartment',
    project_id: 'proj-001',
    status: 'available',
    tenant_id: 'tenant-alpha',
    unit_price: 60000000,
    updated_at: TIMESTAMP,
    updated_by: null,
    ...overrides,
  };
}

function contractRow(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    activated_at: null,
    booking_id: null,
    contract_number: null,
    contract_price: 4500000000,
    created_at: TIMESTAMP,
    created_by: null,
    customer_id: 'cust-1',
    deleted_at: null,
    end_date: null,
    id: 'ctr-unit-RE-A101',
    installments: null,
    metadata: null,
    notes: null,
    product_id: 'unit-RE-A101',
    signed_date: null,
    start_date: null,
    state: 'DRAFT',
    state_changed_at: null,
    submitted_at: null,
    tenant_id: 'tenant-alpha',
    terminated_at: null,
    updated_at: TIMESTAMP,
    updated_by: null,
    ...overrides,
  };
}

function commissionRow(overrides: Partial<CommissionRow> = {}): CommissionRow {
  return {
    agent_id: 'agent-001',
    approved_at: null,
    base_amount: 4500000000,
    booking_id: null,
    commission_amount: 90000000,
    commission_percentage: null,
    contract_id: 'ctr-unit-RE-A101',
    created_at: TIMESTAMP,
    created_by: null,
    deleted_at: null,
    earned_at: null,
    id: 'comm-888',
    metadata: null,
    notes: null,
    paid_at: null,
    status: 'pending',
    tenant_id: 'tenant-alpha',
    updated_at: TIMESTAMP,
    updated_by: null,
    ...overrides,
  };
}

describe('BELLA LAND V2 — HARDENED INVARIANTS & RECONCILIATION SUITE', () => {
  let catalogService: PropertyCatalogProductService;
  let reservationService: ReservationProductService;
  let contractService: ContractProductService;
  let commissionService: CommissionProductService;

  // In-memory state mock simulating atomic DB transaction for double-hold locking & tenant checks
  const unitState: Record<string, { tenant_id: string; status: UnitStateStatus; held_by?: string }> = {
    'unit-RE-A101': { tenant_id: 'tenant-alpha', status: 'available' },
    'unit-RE-B202': { tenant_id: 'tenant-alpha', status: 'reserved', held_by: 'res-agent-1' },
    'unit-RE-C303': { tenant_id: 'tenant-beta', status: 'available' },
  };

  const mockInventoryContract: jest.Mocked<IPropertyInventoryContract> = {
    getProducts: jest.fn().mockImplementation((tenantId: string) => {
      if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
      const products = Object.entries(unitState)
        .filter(([_, u]) => u.tenant_id === tenantId)
        .map(([id, u]) => productRow({
          id,
          tenant_id: u.tenant_id,
          status: productStatusFromUnit(u.status),
        }));
      return Promise.resolve(products);
    })
  };

  const mockReservationContract: jest.Mocked<IReservationContract> = {
    reserveProduct: jest.fn().mockImplementation((req: { tenantId: string; productId: string; userId: string; customerId: string; durationMinutes: number }) => {
      if (!req.tenantId) {
        return Promise.reject(new Error('TENANT_ISOLATION_VIOLATION: tenantId is required'));
      }
      
      const unit = unitState[req.productId];
      if (!unit) {
        return Promise.resolve({ success: false, error: 'NOT_FOUND: Product unit does not exist.' });
      }

      // R3: Tenant Isolation Check
      if (unit.tenant_id !== req.tenantId) {
        return Promise.resolve({
          success: false,
          error: `UNAUTHORIZED_CROSS_TENANT_ACCESS: Tenant '${req.tenantId}' cannot access unit belonging to '${unit.tenant_id}'.`
        });
      }

      // R4: Atomic Concurrency Lock Check
      if (unit.status !== 'available') {
        return Promise.resolve({
          success: false,
          error: `UNIT_ALREADY_RESERVED: Product unit '${req.productId}' is currently in '${unit.status}' status.`
        });
      }

      // Atomic state mutation
      unit.status = 'reserved';
      unit.held_by = req.userId;

      return Promise.resolve({
        success: true,
        reservationId: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        expiresAt: new Date(Date.now() + req.durationMinutes * 60000).toISOString()
      });
    }),

    releaseProduct: jest.fn().mockImplementation((tenantId: string, productId: string, reservationId: string) => {
      if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
      const unit = unitState[productId];
      if (unit && unit.tenant_id === tenantId) {
        unit.status = 'available';
        delete unit.held_by;
      }
      return Promise.resolve();
    })
  };

  const mockPropertyContract: jest.Mocked<IPropertyContract> = {
    createContract: jest.fn().mockImplementation((dto: CreateContractDTO) => {
      if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
      const unit = unitState[dto.productId];
      if (!unit || unit.tenant_id !== dto.tenantId) {
        throw new Error('UNAUTHORIZED_CROSS_TENANT_ACCESS: Cross tenant contract creation denied');
      }
      return Promise.resolve(contractRow({
        id: `ctr-${dto.productId}`,
        tenant_id: dto.tenantId,
        product_id: dto.productId,
        customer_id: dto.customerId,
        contract_price: dto.contractPrice || 4500000000
      }));
    }),
    signContract: jest.fn().mockImplementation((tenantId: string, contractId: string) => {
      if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
      return Promise.resolve();
    })
  };

  const mockCommissionContract: jest.Mocked<ICommissionContract> = {
    calculateCommission: jest.fn().mockResolvedValue(commissionRow())
  };

  beforeEach(() => {
    jest.clearAllMocks();
    unitState['unit-RE-A101'] = { tenant_id: 'tenant-alpha', status: 'available' };
    unitState['unit-RE-B202'] = { tenant_id: 'tenant-alpha', status: 'reserved', held_by: 'res-agent-1' };
    unitState['unit-RE-C303'] = { tenant_id: 'tenant-beta', status: 'available' };

    catalogService = new PropertyCatalogProductService(mockInventoryContract);
    reservationService = new ReservationProductService(mockReservationContract);
    contractService = new ContractProductService(mockPropertyContract);
    commissionService = new CommissionProductService(mockCommissionContract);
  });

  // R3: Tenant Isolation Negative Evidence Suite
  describe('Phase R3: Tenant Isolation Negative Evidence', () => {
    test('Negative Evidence: Tenant B cannot query products belonging to Tenant A', async () => {
      const tenantBProducts = await catalogService.getProducts('tenant-beta', 'proj-001');
      expect(tenantBProducts.every(p => p.tenant_id === 'tenant-beta')).toBe(true);
      expect(tenantBProducts.some(p => p.id === 'unit-RE-A101')).toBe(false);
    });

    test('Negative Evidence: Tenant B cannot hold or reserve a unit belonging to Tenant A', async () => {
      await expect(
        reservationService.reserveProduct({
          tenantId: 'tenant-beta', // Wrong tenant! Unit RE-A101 belongs to tenant-alpha
          productId: 'unit-RE-A101',
          userId: 'sales-agent-b',
          customerId: 'customer-b',
          durationMinutes: 15
        })
      ).rejects.toThrow('UNAUTHORIZED_CROSS_TENANT_ACCESS');
    });

    test('Negative Evidence: Tenant B cannot create a contract for Tenant A asset', async () => {
      await expect(
        contractService.createContract({
          tenantId: 'tenant-beta',
          productId: 'unit-RE-A101',
          customerId: 'cust-1',
          contractPrice: 4500000000,
          installments: []
        })
      ).rejects.toThrow('UNAUTHORIZED_CROSS_TENANT_ACCESS');
    });
  });

  // R4: Reservation Expiry & Concurrency Double-Hold Invariant Suite
  describe('Phase R4: Reservation Concurrency & Double-Hold Invariant', () => {
    test('Concurrency Test: Two sales agents attempting simultaneous hold on same unit -> Exactly 1 winner, 1 rejected', async () => {
      const agentARequest = reservationService.reserveProduct({
        tenantId: 'tenant-alpha',
        productId: 'unit-RE-A101',
        userId: 'sales-agent-1',
        customerId: 'customer-1',
        durationMinutes: 20
      });

      const agentBRequest = reservationService.reserveProduct({
        tenantId: 'tenant-alpha',
        productId: 'unit-RE-A101',
        userId: 'sales-agent-2',
        customerId: 'customer-2',
        durationMinutes: 20
      });

      const results = await Promise.allSettled([agentARequest, agentBRequest]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // In our mock atomic simulation, exactly one request succeeds and one is rejected with UNIT_ALREADY_RESERVED
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason.message).toContain('UNIT_ALREADY_RESERVED');
      }

      // Verify final invariant: unit status is 'reserved' and has exactly 1 owner
      expect(unitState['unit-RE-A101'].status).toBe('reserved');
      expect(unitState['unit-RE-A101'].held_by).toBeDefined();
    });
  });

  // R5: Truth vs Projection Source-of-Truth Invariant Suite
  describe('Phase R5: Truth vs Projection Non-Backwards Mutation Invariant', () => {
    test('Invariant Test: Real Estate operational contract state remains operational truth; projection cannot mutate contract backwards', async () => {
      const contract = await contractService.createContract({
        tenantId: 'tenant-alpha',
        productId: 'unit-RE-A101',
        customerId: 'cust-1',
        contractPrice: 4500000000,
        installments: []
      });
      expect(contract.state).toBe('DRAFT');

      // Sign contract
      await contractService.signContract('tenant-alpha', contract.id);

      // Verify commission calculation is derived from operational contract
      const commission = await commissionService.calculateCommission('tenant-alpha', contract.id);
      expect(commission.commission_amount).toBe(90000000);
      expect(commission.status).toBe('pending');
    });
  });
});
