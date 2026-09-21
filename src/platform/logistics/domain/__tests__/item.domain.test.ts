/**
 * Item Domain Tests
 * 
 * E7.1.6.1: Item domain kernel verification
 * 
 * Coverage: 8 invariants
 * 1. SKU code required and non-empty
 * 2. Name required
 * 3. Serial tracking requires lot tracking
 * 4. Weight cannot be negative
 * 5. Standard cost cannot be negative
 * 6. Currency must be ISO 4217 format
 * 7. Dimensions must be non-negative
 * 8. Status transitions validated
 * 
 * Pure unit tests (no database, no HTTP, no infrastructure).
 */

import { ItemDomain } from '../item.domain';
import type { CreateItemProps, Item } from '../item.types';

describe('ItemDomain', () => {
  // Helper: valid item props
  const validItemProps: CreateItemProps = {
    tenantId: 'tenant-1',
    skuCode: 'SKU-001',
    name: 'Test Item',
    baseUom: 'EA',
  };

  describe('create()', () => {
    describe('Invariant 1: SKU code required and non-empty', () => {
      it('succeeds with valid SKU code', () => {
        const result = ItemDomain.create(validItemProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.skuCode).toBe('SKU-001');
      });

      it('fails when SKU code missing', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          skuCode: '',
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('SKU code is required');
        expect(result.errorCode).toBe('ITEM_SKU_CODE_REQUIRED');
      });

      it('fails when SKU code is whitespace only', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          skuCode: '   ',
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('SKU code is required');
      });

      it('trims SKU code whitespace', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          skuCode: '  SKU-002  ',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.skuCode).toBe('SKU-002');
      });
    });

    describe('Invariant 2: Name required', () => {
      it('succeeds with valid name', () => {
        const result = ItemDomain.create(validItemProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.name).toBe('Test Item');
      });

      it('fails when name missing', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          name: '',
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Item name is required');
        expect(result.errorCode).toBe('ITEM_NAME_REQUIRED');
      });

      it('fails when name is whitespace only', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          name: '   ',
        });
        
        expect(result.isFailure).toBe(true);
      });

      it('trims name whitespace', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          name: '  Test Item  ',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.name).toBe('Test Item');
      });
    });

    describe('Invariant 3: Serial tracking requires lot tracking', () => {
      it('succeeds when both lot and serial tracking enabled', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          lotTracked: true,
          serialTracked: true,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.lotTracked).toBe(true);
        expect(result.value?.serialTracked).toBe(true);
      });

      it('succeeds when only lot tracking enabled', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          lotTracked: true,
          serialTracked: false,
        });
        
        expect(result.isSuccess).toBe(true);
      });

      it('succeeds when neither lot nor serial tracking', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          lotTracked: false,
          serialTracked: false,
        });
        
        expect(result.isSuccess).toBe(true);
      });

      it('fails when serial tracking without lot tracking', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          lotTracked: false,
          serialTracked: true,
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Serial tracking requires lot tracking to be enabled');
        expect(result.errorCode).toBe('ITEM_SERIAL_REQUIRES_LOT');
      });
    });

    describe('Invariant 4: Weight cannot be negative', () => {
      it('succeeds with positive weight', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          weightKg: 10.5,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.weightKg).toBe(10.5);
      });

      it('succeeds with zero weight', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          weightKg: 0,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.weightKg).toBe(0);
      });

      it('succeeds when weight not provided', () => {
        const result = ItemDomain.create(validItemProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.weightKg).toBeNull();
      });

      it('fails with negative weight', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          weightKg: -5,
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Weight cannot be negative');
        expect(result.errorCode).toBe('ITEM_WEIGHT_NEGATIVE');
      });
    });

    describe('Invariant 5: Standard cost cannot be negative', () => {
      it('succeeds with positive cost', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          standardCost: 100.50,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.standardCost).toBe(100.50);
      });

      it('succeeds with zero cost', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          standardCost: 0,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.standardCost).toBe(0);
      });

      it('succeeds when cost not provided', () => {
        const result = ItemDomain.create(validItemProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.standardCost).toBeNull();
      });

      it('fails with negative cost', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          standardCost: -50,
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Standard cost cannot be negative');
        expect(result.errorCode).toBe('ITEM_COST_NEGATIVE');
      });
    });

    describe('Invariant 6: Currency must be ISO 4217 format', () => {
      it('succeeds with valid 3-letter currency', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          currency: 'USD',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.currency).toBe('USD');
      });

      it('succeeds with VND currency', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          currency: 'VND',
        });
        
        expect(result.isSuccess).toBe(true);
      });

      it('defaults to VND when not provided', () => {
        const result = ItemDomain.create(validItemProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.currency).toBe('VND');
      });

      it('fails with non-3-letter currency', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          currency: 'US',
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Currency must be 3-letter ISO 4217 code (e.g., VND, USD)');
        expect(result.errorCode).toBe('ITEM_CURRENCY_INVALID');
      });

      it('fails with lowercase currency', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          currency: 'usd',
        });
        
        expect(result.isFailure).toBe(true);
      });

      it('fails with numeric currency', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          currency: '123',
        });
        
        expect(result.isFailure).toBe(true);
      });
    });

    describe('Invariant 7: Dimensions must be non-negative', () => {
      it('succeeds with valid dimensions', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          dimensionsJson: {
            length: 10,
            width: 5,
            height: 3,
            unit: 'cm',
          },
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.dimensionsJson).toEqual({
          length: 10,
          width: 5,
          height: 3,
          unit: 'cm',
        });
      });

      it('succeeds with zero dimensions', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          dimensionsJson: {
            length: 0,
            width: 0,
            height: 0,
          },
        });
        
        expect(result.isSuccess).toBe(true);
      });

      it('fails with negative length', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          dimensionsJson: {
            length: -10,
            width: 5,
            height: 3,
          },
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Length cannot be negative');
        expect(result.errorCode).toBe('ITEM_DIMENSION_NEGATIVE');
      });

      it('fails with negative width', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          dimensionsJson: {
            length: 10,
            width: -5,
            height: 3,
          },
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Width cannot be negative');
      });

      it('fails with negative height', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          dimensionsJson: {
            length: 10,
            width: 5,
            height: -3,
          },
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Height cannot be negative');
      });
    });

    describe('Invariant 8: Status transitions validated', () => {
      it('defaults to ACTIVE status', () => {
        const result = ItemDomain.create(validItemProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.status).toBe('ACTIVE');
      });

      it('allows PENDING status on creation', () => {
        const result = ItemDomain.create({
          ...validItemProps,
          status: 'PENDING',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.status).toBe('PENDING');
      });
    });
  });

  describe('update()', () => {
    const existingItem: Item = {
      id: 'item-1',
      tenantId: 'tenant-1',
      skuCode: 'SKU-001',
      name: 'Original Name',
      description: null,
      type: 'GOODS',
      category: null,
      baseUom: 'EA',
      weightKg: null,
      dimensionsJson: null,
      standardCost: null,
      currency: 'VND',
      lotTracked: false,
      serialTracked: false,
      expiryTracked: false,
      status: 'ACTIVE',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: null,
      updatedBy: null,
    };

    it('updates name successfully', () => {
      const result = ItemDomain.update(existingItem, {
        name: 'Updated Name',
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.name).toBe('Updated Name');
      expect(result.value?.skuCode).toBe('SKU-001'); // Immutable
    });

    it('fails when updating name to empty', () => {
      const result = ItemDomain.update(existingItem, {
        name: '',
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Item name cannot be empty');
    });

    it('enforces serial→lot invariant on update', () => {
      const result = ItemDomain.update(existingItem, {
        lotTracked: false,
        serialTracked: true,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Serial tracking requires lot tracking to be enabled');
    });

    it('validates weight on update', () => {
      const result = ItemDomain.update(existingItem, {
        weightKg: -10,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Weight cannot be negative');
    });

    it('validates cost on update', () => {
      const result = ItemDomain.update(existingItem, {
        standardCost: -100,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Standard cost cannot be negative');
    });

    it('validates currency on update', () => {
      const result = ItemDomain.update(existingItem, {
        currency: 'US',
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Currency must be 3-letter ISO 4217 code');
    });
  });

  describe('canTransitionTo()', () => {
    const activeItem: Item = {
      id: 'item-1',
      tenantId: 'tenant-1',
      skuCode: 'SKU-001',
      name: 'Test Item',
      description: null,
      type: 'GOODS',
      category: null,
      baseUom: 'EA',
      weightKg: null,
      dimensionsJson: null,
      standardCost: null,
      currency: 'VND',
      lotTracked: false,
      serialTracked: false,
      expiryTracked: false,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };

    it('allows ACTIVE → INACTIVE', () => {
      const result = ItemDomain.canTransitionTo(activeItem, 'INACTIVE');
      expect(result.isSuccess).toBe(true);
    });

    it('allows ACTIVE → DISCONTINUED', () => {
      const result = ItemDomain.canTransitionTo(activeItem, 'DISCONTINUED');
      expect(result.isSuccess).toBe(true);
    });

    it('rejects ACTIVE → PENDING', () => {
      const result = ItemDomain.canTransitionTo(activeItem, 'PENDING');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot transition from ACTIVE to PENDING');
    });

    it('rejects transition from DISCONTINUED (terminal state)', () => {
      const discontinuedItem = { ...activeItem, status: 'DISCONTINUED' as const };
      const result = ItemDomain.canTransitionTo(discontinuedItem, 'ACTIVE');
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot transition from DISCONTINUED to ACTIVE');
    });
  });

  describe('requiresLotTracking()', () => {
    it('returns true when lotTracked enabled', () => {
      const item = { ...validItemProps, lotTracked: true } as Item;
      expect(ItemDomain.requiresLotTracking(item)).toBe(true);
    });

    it('returns true when serialTracked enabled (implies lot)', () => {
      const item = { ...validItemProps, lotTracked: true, serialTracked: true } as Item;
      expect(ItemDomain.requiresLotTracking(item)).toBe(true);
    });

    it('returns true when expiryTracked enabled', () => {
      const item = { ...validItemProps, expiryTracked: true } as Item;
      expect(ItemDomain.requiresLotTracking(item)).toBe(true);
    });

    it('returns false when no tracking enabled', () => {
      const item = { ...validItemProps, lotTracked: false, serialTracked: false, expiryTracked: false } as Item;
      expect(ItemDomain.requiresLotTracking(item)).toBe(false);
    });
  });

  describe('calculateVolume()', () => {
    it('calculates volume correctly', () => {
      const item = {
        ...validItemProps,
        dimensionsJson: { length: 10, width: 5, height: 2 },
      } as Item;
      
      const volume = ItemDomain.calculateVolume(item);
      expect(volume).toBe(100);
    });

    it('returns null when dimensions missing', () => {
      const item = { ...validItemProps, dimensionsJson: null } as Item;
      expect(ItemDomain.calculateVolume(item)).toBeNull();
    });

    it('returns null when dimensions incomplete', () => {
      const item = {
        ...validItemProps,
        dimensionsJson: { length: 10, width: 5 },
      } as Item;
      
      expect(ItemDomain.calculateVolume(item)).toBeNull();
    });
  });
});
