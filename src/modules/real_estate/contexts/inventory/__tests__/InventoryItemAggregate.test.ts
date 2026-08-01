import { ProductCatalogAggregate, ProductCatalogProps } from '../../product_catalog/domain/ProductCatalogAggregate';
import { InventoryItemAggregate, InventoryItemProps } from '../domain/InventoryItemAggregate';
import { TransitionContext } from '@/platform/state-machine/state-machine';
import { LegalApprovalSpecification } from '../../product_catalog/domain/LegalApprovalSpecification';

describe('Real Estate Bounded Contexts - Capability 1', () => {
  const tenantId = 'tenant-abc';
  const projectId = 'project-xyz';
  const productId = 'prod-123';

  const transitionContext: TransitionContext = {
    tenantId,
    correlationId: 'corr-999',
    actor: { userId: 'agent-1', userName: 'Nguyen Van Agent' },
  };

  describe('ProductCatalogAggregate', () => {
    const validProps: ProductCatalogProps = {
      tenantId,
      projectId,
      productCode: 'A1205',
      productType: 'apartment',
      floor: '12',
      block: 'Block A',
      area: 75.5,
      unitPrice: 50000000,
      floorNumber: 12,
      unitCode: '05',
      areaM2: 75.5,
      direction: 'East',
      basePrice: 3775000000,
      floorPrice: 3500000000,
    };

    it('should create ProductCatalogAggregate with valid parameters', () => {
      const catalog = ProductCatalogAggregate.create(validProps);
      expect(catalog.productCode).toBe('A1205');
      expect(catalog.basePrice).toBe(3775000000);
      expect(catalog.floorPrice).toBe(3500000000);
    });

    it('should throw error if area is zero or negative', () => {
      expect(() => {
        ProductCatalogAggregate.create({ ...validProps, area: 0 });
      }).toThrow('Area must be greater than zero');
    });

    it('should throw error if floorPrice exceeds basePrice', () => {
      expect(() => {
        ProductCatalogAggregate.create({ ...validProps, floorPrice: 4000000000 });
      }).toThrow('Floor price cannot exceed base price');
    });

    it('should evaluate legal specifications correctly', () => {
      const catalog = ProductCatalogAggregate.create({
        ...validProps,
        metadata: {
          legalDocuments: {
            redBookApproved: true,
            constructionPermitApproved: true,
          },
        },
      });

      const spec = new LegalApprovalSpecification();
      expect(spec.isSatisfiedBy(catalog)).toBe(true);

      const invalidCatalog = ProductCatalogAggregate.create({
        ...validProps,
        metadata: {
          legalDocuments: {
            redBookApproved: true,
            constructionPermitApproved: false,
          },
        },
      });
      expect(spec.isSatisfiedBy(invalidCatalog)).toBe(false);
    });
  });

  describe('InventoryItemAggregate', () => {
    const validProps: InventoryItemProps = {
      id: 'inv-item-123',
      tenantId,
      productId,
      state: 'OFF_MARKET',
    };

    it('should initialize state', () => {
      const item = new InventoryItemAggregate(validProps);
      expect(item.state).toBe('OFF_MARKET');
    });

    it('should transition through valid lifecycle states and commit events', async () => {
      const item = new InventoryItemAggregate(validProps);

      // OFF_MARKET -> AVAILABLE
      await item.handleEvent('ACTIVATE', transitionContext);
      expect(item.state).toBe('AVAILABLE');

      // AVAILABLE -> HELD
      await item.handleEvent('HOLD', transitionContext);
      expect(item.state).toBe('HELD');

      // HELD -> AVAILABLE (Released)
      await item.handleEvent('RELEASE', transitionContext);
      expect(item.state).toBe('AVAILABLE');

      // AVAILABLE -> BOOKED
      await item.handleEvent('BOOK', transitionContext);
      expect(item.state).toBe('BOOKED');

      // BOOKED -> RESERVED
      await item.handleEvent('APPROVE_BOOKING', transitionContext);
      expect(item.state).toBe('RESERVED');

      // RESERVED -> DEPOSITED
      await item.handleEvent('DEPOSIT', transitionContext);
      expect(item.state).toBe('DEPOSITED');

      // DEPOSITED -> CONTRACT_SIGNED
      await item.handleEvent('SIGN_CONTRACT', transitionContext);
      expect(item.state).toBe('CONTRACT_SIGNED');

      // Verify recorded domain events
      const changes = item.getUncommittedChanges();
      expect(changes.length).toBe(7);
      expect(changes[0].eventType).toBe('re.inventory.item.activate');
      expect(changes[1].eventType).toBe('re.inventory.item.hold');
      expect(changes[2].eventType).toBe('re.inventory.item.release');
      expect(changes[3].eventType).toBe('re.inventory.item.book');
      expect(changes[4].eventType).toBe('re.inventory.item.approve_booking');
      expect(changes[5].eventType).toBe('re.inventory.item.deposit');
      expect(changes[6].eventType).toBe('re.inventory.item.sign_contract');

      expect(changes[0].payload.productId).toBe(productId);
      expect(changes[0].payload.actorId).toBe('agent-1');
    });

    it('should block invalid transitions', async () => {
      const item = new InventoryItemAggregate(validProps);
      // OFF_MARKET -> cannot execute HOLD directly
      await expect(item.handleEvent('HOLD', transitionContext)).rejects.toThrow(
        'State machine guard blocks event "HOLD" from state "OFF_MARKET"'
      );
    });
  });
});
