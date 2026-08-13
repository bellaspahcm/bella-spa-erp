/**
 * BELLA LAND — RUNTIME CONFORMANCE INTEGRATION TEST SUITE
 *
 * Verifies that the Bella Land product services satisfy the OS integration requirements:
 * - Gate 1: Manifest Alignment & Source of Truth
 * - Gate 2: Contract-Only Dependency Injection
 * - Gate 3: Tenant Isolation Boundary
 * - Gate 7: Non-Bypassable State Machine Guards (Kernel FSM)
 * - Gate 10: Decoupled Accounting Ledger Posting
 *
 * @module src/products/bella-land/__tests__/bella-land-conformance.integration.test
 */

import { PropertyCatalogProductService } from '../services/property-catalog.service';
import { ReservationProductService } from '../services/reservation.service';
import { ContractProductService } from '../services/contract.service';
import { CommissionProductService } from '../services/commission.service';
import { bellaLandManifest } from '../manifest';

describe('BELLA LAND V2 — RUNTIME CONFORMANCE INTEGRATION TESTS', () => {
  let catalogService: PropertyCatalogProductService;
  let reservationService: ReservationProductService;
  let contractService: ContractProductService;
  let commissionService: CommissionProductService;

  const mockInventoryContract: any = {
    getProducts: jest.fn().mockResolvedValue([
      { id: 'unit-001', tenant_id: 'tenant-land-1', project_id: 'proj-001', status: 'available' }
    ])
  };

  const mockReservationContract: any = {
    reserveProduct: jest.fn().mockImplementation((req) => {
      if (req.productId === 'unit-locked') {
        return Promise.resolve({
          success: false,
          error: 'INVALID_STATE_TRANSITION: Cannot perform this operation. Unit is currently in \'completed\' status.'
        });
      }
      return Promise.resolve({
        success: true,
        reservationId: 'res-101',
        expiresAt: new Date(Date.now() + 30 * 60000).toISOString()
      });
    }),
    releaseProduct: jest.fn().mockResolvedValue(undefined)
  };

  const mockPropertyContract: any = {
    createContract: jest.fn().mockResolvedValue({
      id: 'ctr-101',
      tenant_id: 'tenant-land-1',
      product_id: 'unit-001',
      state: 'DRAFT',
      contract_price: 3500000000
    }),
    signContract: jest.fn().mockImplementation((tenantId, contractId) => {
      if (contractId === 'ctr-invalid-fsm') {
        return Promise.reject(new Error('INVALID_STATE_TRANSITION: Cannot transition status to contracted.'));
      }
      if (contractId === 'ctr-ledger-fail') {
        return Promise.reject(new Error('LEDGER_POSTING_FAILED: Ledger is out of balance.'));
      }
      return Promise.resolve();
    })
  };

  const mockCommissionContract: any = {
    calculateCommission: jest.fn().mockResolvedValue({
      id: 'comm-101',
      tenant_id: 'tenant-land-1',
      contract_id: 'ctr-101',
      commission_amount: 70000000,
      status: 'pending'
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    catalogService = new PropertyCatalogProductService(mockInventoryContract);
    reservationService = new ReservationProductService(mockReservationContract);
    contractService = new ContractProductService(mockPropertyContract);
    commissionService = new CommissionProductService(mockCommissionContract);
  });

  // Gate 1: Manifest Alignment
  test('Gate 1: Manifest lists all enabled capabilities and workflows', () => {
    expect(bellaLandManifest.id).toBe('bella-land');
    expect(bellaLandManifest.capabilities).toContain('property_inventory_query');
    expect(bellaLandManifest.capabilities).toContain('sales_reservation_command');
    expect(bellaLandManifest.capabilities).toContain('sales_contract_command');
    expect(bellaLandManifest.capabilities).toContain('commission_policy_command');
    expect(bellaLandManifest.workflows).toContain('property_sales_lifecycle');
  });

  // Gate 2: Contract Dependency Injection
  test('Gate 2: Product services only invoke public Kernel contracts', async () => {
    const products = await catalogService.getProducts('tenant-land-1', 'proj-001');
    expect(products.length).toBe(1);
    expect(products[0].id).toBe('unit-001');
    expect(mockInventoryContract.getProducts).toHaveBeenCalledWith('tenant-land-1', 'proj-001');
  });

  // Gate 3: Tenant Isolation Boundary
  test('Gate 3: Throws error when tenantId is empty (tenant boundary isolation)', async () => {
    await expect(
      catalogService.getProducts('', 'proj-001')
    ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    await expect(
      reservationService.reserveProduct({
        tenantId: '',
        productId: 'unit-001',
        userId: 'agent-1',
        customerId: 'cust-1',
        durationMinutes: 30
      })
    ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
  });

  // Gate 7: Non-Bypassable State Machine Guards (Kernel FSM)
  test('Gate 7: FSM blocks reservation of completed/unavailable units', async () => {
    await expect(
      reservationService.reserveProduct({
        tenantId: 'tenant-land-1',
        productId: 'unit-locked', // Locked unit
        userId: 'agent-1',
        customerId: 'cust-1',
        durationMinutes: 30
      })
    ).rejects.toThrow('Reservation failed: INVALID_STATE_TRANSITION');
  });

  test('Gate 7: FSM blocks contract signature if unit is in incorrect status', async () => {
    await expect(
      contractService.signContract('tenant-land-1', 'ctr-invalid-fsm')
    ).rejects.toThrow('INVALID_STATE_TRANSITION');
  });

  // Gate 10: Ledger Posting Side-Effect Validation
  test('Gate 10: Bubbles error if accounting ledger posting fails during sign', async () => {
    await expect(
      contractService.signContract('tenant-land-1', 'ctr-ledger-fail')
    ).rejects.toThrow('LEDGER_POSTING_FAILED');
  });
});
