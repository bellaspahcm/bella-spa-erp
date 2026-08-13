/**
 * Real Estate Kernel — Integration Test Suite
 *
 * Validates domain model state transitions, repository saving, reservation engines,
 * contract engines, and their financial integration with the Accounting Kernel.
 *
 * @module platform/real-estate/__tests__/real-estate-kernel.integration.test
 */

import { PropertyUnit } from '../domain/property-unit.entity';
import { PropertyUnitRepository } from '../repositories/property-unit.repository';
import { PropertyInventoryService } from '../engines/property-inventory.service';
import { ReservationService } from '../engines/reservation.service';
import { PropertyService } from '../engines/property.service';
import { CommissionService } from '../engines/commission.service';
import { AccountingService } from '../../accounting/engines/accounting.service';

describe('Real Estate Kernel & Accounting Kernel — Integration Tests', () => {
  let repository: PropertyUnitRepository;
  let mockSupabase: any;
  let mockProductsDb: any[];
  let mockReservationsDb: any[];
  let mockContractsDb: any[];
  let mockCommissionsDb: any[];
  let mockAccountsDb: any[];
  let mockJournalEntriesDb: any[];
  let mockJournalLinesDb: any[];

  beforeEach(() => {
    mockProductsDb = [
      {
        id: 'prod-101',
        tenant_id: 'tenant-1',
        project_id: 'proj-1',
        product_code: 'APT-101',
        product_type: 'apartment',
        unit_code: 'A-101',
        area: 75,
        unit_price: 3000000000,
        status: 'available',
        owner_name: null
      }
    ];

    mockReservationsDb = [];
    mockContractsDb = [];
    mockCommissionsDb = [];
    
    mockAccountsDb = [
      { id: 'acc-1', tenant_id: 'tenant-1', code: '131', name: 'Phải thu khách hàng', type: 'asset' },
      { id: 'acc-2', tenant_id: 'tenant-1', code: '5111', name: 'Doanh thu bán hàng', type: 'revenue' }
    ];

    mockJournalEntriesDb = [];
    mockJournalLinesDb = [];

    // Mock Supabase Chain Client using stateful builder pattern to support complex chain calls (.select().eq().eq().single())
    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        const filters: Record<string, any> = {};
        let patchData: any = null;

        const chain: any = {
          select: jest.fn().mockImplementation(() => chain),
          eq: jest.fn().mockImplementation((col: string, val: any) => {
            filters[col] = val;
            return chain;
          }),
          in: jest.fn().mockImplementation((col: string, vals: any[]) => {
            filters[col] = vals;
            return chain;
          }),
          order: jest.fn().mockImplementation(() => {
            const matches = mockProductsDb.filter(p => {
              if (filters.project_id && p.project_id !== filters.project_id) return false;
              if (filters.tenant_id && p.tenant_id !== filters.tenant_id) return false;
              return true;
            });
            return Promise.resolve({ data: matches, error: null });
          }),
          single: jest.fn().mockImplementation(() => {
            if (table === 'real_estate_products') {
              const match = mockProductsDb.find(p => {
                if (filters.id && p.id !== filters.id) return false;
                if (filters.tenant_id && p.tenant_id !== filters.tenant_id) return false;
                return true;
              });
              return Promise.resolve(match ? { data: match, error: null } : { data: null, error: { code: 'PGRST116', message: 'Not found' } });
            }
            if (table === 're_contracts') {
              const match = mockContractsDb.find(c => {
                if (filters.id && c.id !== filters.id) return false;
                if (filters.tenant_id && c.tenant_id !== filters.tenant_id) return false;
                return true;
              });
              return Promise.resolve(match ? { data: match, error: null } : { data: null, error: { code: 'PGRST116', message: 'Not found' } });
            }
            return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
          }),
          update: jest.fn().mockImplementation((patch: any) => {
            patchData = patch;
            return chain;
          }),
          insert: jest.fn().mockImplementation((rows: any) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            const createdRows = arr.map(row => {
              const created = { id: `id-${Math.floor(1000 + Math.random() * 9000)}`, ...row };
              if (table === 're_reservations') mockReservationsDb.push(created);
              if (table === 're_contracts') mockContractsDb.push(created);
              if (table === 're_commissions') mockCommissionsDb.push(created);
              if (table === 'journal_entries') mockJournalEntriesDb.push(created);
              if (table === 'journal_lines') mockJournalLinesDb.push(created);
              return created;
            });

            const resultPromise: any = Promise.resolve({ data: createdRows[0], error: null });
            resultPromise.select = () => ({
              single: () => Promise.resolve({ data: createdRows[0], error: null })
            });
            return resultPromise;
          }),
          delete: jest.fn().mockImplementation(() => {
            return Promise.resolve({ error: null });
          })
        };

        chain.then = (onfulfilled: any) => {
          if (patchData) {
            if (table === 'real_estate_products') {
              const match = mockProductsDb.find(p => {
                if (filters.id && p.id !== filters.id) return false;
                if (filters.tenant_id && p.tenant_id !== filters.tenant_id) return false;
                return true;
              });
              if (match) Object.assign(match, patchData);
            }
            if (table === 're_contracts') {
              const match = mockContractsDb.find(c => {
                if (filters.id && c.id !== filters.id) return false;
                if (filters.tenant_id && c.tenant_id !== filters.tenant_id) return false;
                return true;
              });
              if (match) Object.assign(match, patchData);
            }
            if (table === 're_reservations') {
              const match = mockReservationsDb.find(r => {
                if (filters.id && r.id !== filters.id) return false;
                if (filters.tenant_id && r.tenant_id !== filters.tenant_id) return false;
                return true;
              });
              if (match) Object.assign(match, patchData);
            }
            return Promise.resolve({ error: null }).then(onfulfilled);
          } else {
            if (table === 'accounting_accounts') {
              const matches = mockAccountsDb.filter(a => {
                if (filters.tenant_id && a.tenant_id !== filters.tenant_id) return false;
                if (filters.code && !filters.code.includes(a.code)) return false;
                return true;
              });
              return Promise.resolve({ data: matches, error: null }).then(onfulfilled);
            }
            return Promise.resolve({ data: [], error: null }).then(onfulfilled);
          }
        };

        return chain;
      })
    };

    repository = new PropertyUnitRepository();
  });

  describe('Domain Invariants', () => {
    test('State Machine should block invalid transitions', () => {
      const unit = new PropertyUnit({
        id: 'prod-1',
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        productCode: 'A1',
        productType: 'apartment',
        unitCode: 'U1',
        area: 50,
        unitPrice: 1000,
        status: 'available',
        ownerName: null
      });

      // Cannot sign contract if not deposited/held
      expect(() => unit.signContract()).toThrow('INVALID_STATE_TRANSITION');

      // Valid flow: reserve -> depositPaid -> signContract -> complete
      unit.reserve('cust-1');
      expect(unit.status).toBe('held');
      expect(unit.ownerName).toBe('cust-1');

      unit.depositPaid();
      expect(unit.status).toBe('deposited');

      unit.signContract();
      expect(unit.status).toBe('contracted');

      unit.complete();
      expect(unit.status).toBe('completed');
    });
  });

  describe('Reservation Engine', () => {
    test('Should reserve available unit successfully', async () => {
      const reservationService = new ReservationService(repository, mockSupabase);
      const res = await reservationService.reserveProduct({
        tenantId: 'tenant-1',
        productId: 'prod-101',
        userId: 'agent-1',
        customerId: 'cust-1',
        durationMinutes: 30
      });

      expect(res.success).toBe(true);
      expect(res.reservationId).toBeDefined();
      expect(mockProductsDb[0].status).toBe('held');
      expect(mockProductsDb[0].owner_name).toBe('cust-1');
      expect(mockReservationsDb.length).toBe(1);
    });

    test('Should release active hold successfully', async () => {
      mockProductsDb[0].status = 'held';
      mockProductsDb[0].owner_name = 'cust-1';
      // Seed a reservation in mock DB
      mockReservationsDb.push({
        id: 'res-1',
        tenant_id: 'tenant-1',
        product_id: 'prod-101',
        user_id: 'agent-1',
        customer_id: 'cust-1',
        duration_minutes: 30,
        status: 'pending_deposit',
        expires_at: new Date().toISOString()
      });

      const reservationService = new ReservationService(repository, mockSupabase);
      await reservationService.releaseProduct('tenant-1', 'prod-101', 'res-1');

      expect(mockProductsDb[0].status).toBe('available');
      expect(mockProductsDb[0].owner_name).toBeNull();
      expect(mockReservationsDb.length).toBe(1); // the updated reservation
      expect(mockReservationsDb[0].status).toBe('cancelled'); // verify state changes to cancelled
    });
  });

  describe('Property Contract & Ledger Posting Integration', () => {
    test('Should sign contract, update inventory status, and post balanced journal entries', async () => {
      mockProductsDb[0].status = 'held';
      mockProductsDb[0].owner_name = 'cust-1';

      const accountingService = new AccountingService(mockSupabase);
      const propertyService = new PropertyService(repository, accountingService, mockSupabase);

      // Create draft contract
      const contract = await propertyService.createContract({
        tenantId: 'tenant-1',
        productId: 'prod-101',
        customerId: 'cust-1',
        contractPrice: 3000000000,
        installments: [
          { dueDate: '2026-09-01', percentage: 50 },
          { dueDate: '2026-10-01', percentage: 50 }
        ]
      });

      expect(contract.state).toBe('DRAFT');

      // Sign contract
      await propertyService.signContract('tenant-1', contract.id);

      // Verify status transitions
      expect(mockProductsDb[0].status).toBe('contracted');
      
      const signedContract = mockContractsDb.find(c => c.id === contract.id);
      expect(signedContract.state).toBe('ACTIVE');

      // Verify Accounting Ledger Posting side-effects
      expect(mockJournalEntriesDb.length).toBe(1);
      expect(mockJournalEntriesDb[0].reference_type).toBe('contract');
      expect(mockJournalEntriesDb[0].reference_id).toBe(contract.id);

      // Check journal lines: Account 131 debited, Account 5111 credited
      expect(mockJournalLinesDb.length).toBe(2);
      const debitLine = mockJournalLinesDb.find(l => l.debit > 0);
      const creditLine = mockJournalLinesDb.find(l => l.credit > 0);

      expect(debitLine.debit).toBe(3000000000);
      expect(creditLine.credit).toBe(3000000000);
    });
  });

  describe('Commission calculation', () => {
    test('Should calculate 2% commission for signed contracts', async () => {
      mockContractsDb.push({
        id: 'ctr-active-1',
        tenant_id: 'tenant-1',
        product_id: 'prod-101',
        customer_id: 'cust-1',
        contract_no: 'HĐ-1',
        contract_price: 3000000000,
        state: 'ACTIVE'
      });

      const commissionService = new CommissionService(mockSupabase);
      const commission = await commissionService.calculateCommission('tenant-1', 'ctr-active-1');

      expect(commission.commission_amount).toBe(60000000); // 2% of 3,000,000,000
      expect(commission.status).toBe('pending');
      expect(mockCommissionsDb.length).toBe(1);
    });
  });
});
