/**
 * @fileoverview Org Unit Engine Unit Tests
 * 
 * Verifies 10 contract methods with mocked repository.
 * Tests business logic without DB dependency.
 */

import { OrgUnitEngine, createOrgUnitEngine } from '../org-unit.engine';
import type { IOrgUnitRepository } from '../org-unit.repository';
import type { OrgUnit, CreateOrgUnitInput, UpdateOrgUnitInput, OrgUnitFilter } from '../index';
import {
  OrgUnitNotFoundError,
  OrgUnitParentNotFoundError,
  OrgUnitCodeConflictError,
  OrgUnitCircularReferenceError,
  OrgUnitTenantMismatchError
} from '../index';

describe('OrgUnitEngine', () => {
  let engine: OrgUnitEngine;
  let mockRepository: IOrgUnitRepository;

  const TENANT_A = 'tenant-a-id';
  const TENANT_B = 'tenant-b-id';

  const mockOrgUnit = (overrides?: Partial<OrgUnit>): OrgUnit => ({
    id: 'unit-1',
    tenantId: TENANT_A,
    unitType: 'branch',
    name: 'Branch 1',
    code: 'BR-001',
    parentId: undefined,
    isActive: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findChildren: jest.fn(),
      findHierarchy: jest.fn(),
      findDescendantIds: jest.fn(),
      exists: jest.fn(),
      codeExists: jest.fn()
    };

    engine = new OrgUnitEngine(mockRepository);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createOrgUnit', () => {
    it('should create org unit without parent', async () => {
      const input: CreateOrgUnitInput = {
        tenantId: TENANT_A,
        unitType: 'company',
        name: 'Acme Corp'
      };

      const created = mockOrgUnit({ unitType: 'company', name: 'Acme Corp' });
      jest.mocked(mockRepository.codeExists).mockResolvedValue(false);
      jest.mocked(mockRepository.create).mockResolvedValue(created);

      const result = await engine.createOrgUnit(input);

      expect(result).toEqual(created);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should create org unit with valid parent', async () => {
      const parent = mockOrgUnit({ id: 'parent-1', unitType: 'region' });
      const input: CreateOrgUnitInput = {
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch 1',
        parentId: 'parent-1'
      };

      jest.mocked(mockRepository.findById).mockResolvedValue(parent);
      jest.mocked(mockRepository.codeExists).mockResolvedValue(false);
      jest.mocked(mockRepository.create).mockResolvedValue(mockOrgUnit());

      await engine.createOrgUnit(input);

      expect(mockRepository.findById).toHaveBeenCalledWith('parent-1', TENANT_A);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should reject create if parent not found', async () => {
      const input: CreateOrgUnitInput = {
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch 1',
        parentId: 'nonexistent'
      };

      jest.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(engine.createOrgUnit(input)).rejects.toThrow(OrgUnitParentNotFoundError);
    });

    it('should reject create if parent belongs to different tenant', async () => {
      const parentDifferentTenant = mockOrgUnit({ id: 'parent-1', tenantId: TENANT_B });
      const input: CreateOrgUnitInput = {
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch 1',
        parentId: 'parent-1'
      };

      jest.mocked(mockRepository.findById).mockResolvedValue(parentDifferentTenant);

      await expect(engine.createOrgUnit(input)).rejects.toThrow(OrgUnitTenantMismatchError);
    });

    it('should reject create if code already exists in tenant', async () => {
      const input: CreateOrgUnitInput = {
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch 1',
        code: 'BR-001'
      };

      jest.mocked(mockRepository.codeExists).mockResolvedValue(true);

      await expect(engine.createOrgUnit(input)).rejects.toThrow(OrgUnitCodeConflictError);
    });
  });

  describe('updateOrgUnit', () => {
    it('should update org unit', async () => {
      const existing = mockOrgUnit();
      const updated = mockOrgUnit({ name: 'Branch 1 Updated' });

      jest.mocked(mockRepository.findById).mockResolvedValue(existing);
      jest.mocked(mockRepository.update).mockResolvedValue(updated);

      const result = await engine.updateOrgUnit('unit-1', TENANT_A, { name: 'Branch 1 Updated' });

      expect(result.name).toBe('Branch 1 Updated');
      expect(mockRepository.update).toHaveBeenCalledWith('unit-1', TENANT_A, { name: 'Branch 1 Updated' });
    });

    it('should reject update if unit not found', async () => {
      jest.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(engine.updateOrgUnit('nonexistent', TENANT_A, { name: 'New Name' }))
        .rejects.toThrow(OrgUnitNotFoundError);
    });

    it('should reject parent change if circular reference', async () => {
      const existing = mockOrgUnit({ id: 'unit-1' });
      jest.mocked(mockRepository.findById).mockResolvedValue(existing);
      jest.mocked(mockRepository.findDescendantIds).mockResolvedValue(['child-1', 'child-2', 'new-parent']);

      await expect(engine.updateOrgUnit('unit-1', TENANT_A, { parentId: 'new-parent' }))
        .rejects.toThrow(OrgUnitCircularReferenceError);
    });

    it('should reject code update if conflict', async () => {
      const existing = mockOrgUnit({ code: 'OLD-001' });
      jest.mocked(mockRepository.findById).mockResolvedValue(existing);
      jest.mocked(mockRepository.codeExists).mockResolvedValue(true);

      await expect(engine.updateOrgUnit('unit-1', TENANT_A, { code: 'NEW-001' }))
        .rejects.toThrow(OrgUnitCodeConflictError);
    });
  });

  describe('archiveOrgUnit', () => {
    it('should archive org unit', async () => {
      jest.mocked(mockRepository.exists).mockResolvedValue(true);
      jest.mocked(mockRepository.archive).mockResolvedValue();

      await engine.archiveOrgUnit('unit-1', TENANT_A);

      expect(mockRepository.archive).toHaveBeenCalledWith('unit-1', TENANT_A);
    });

    it('should reject archive if unit not found', async () => {
      jest.mocked(mockRepository.exists).mockResolvedValue(false);

      await expect(engine.archiveOrgUnit('nonexistent', TENANT_A))
        .rejects.toThrow(OrgUnitNotFoundError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getOrgUnit', () => {
    it('should get org unit by id', async () => {
      const unit = mockOrgUnit();
      jest.mocked(mockRepository.findById).mockResolvedValue(unit);

      const result = await engine.getOrgUnit('unit-1', TENANT_A);

      expect(result).toEqual(unit);
      expect(mockRepository.findById).toHaveBeenCalledWith('unit-1', TENANT_A);
    });

    it('should return null if unit not found', async () => {
      jest.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await engine.getOrgUnit('nonexistent', TENANT_A);

      expect(result).toBeNull();
    });
  });

  describe('getOrgUnits', () => {
    it('should get org units by filter', async () => {
      const units = [mockOrgUnit(), mockOrgUnit({ id: 'unit-2' })];
      jest.mocked(mockRepository.findMany).mockResolvedValue(units);

      const filter: OrgUnitFilter = {
        tenantId: TENANT_A,
        unitType: 'branch',
        isActive: true
      };

      const result = await engine.getOrgUnits(filter);

      expect(result).toEqual(units);
      expect(mockRepository.findMany).toHaveBeenCalledWith(filter);
    });
  });

  describe('getChildren', () => {
    it('should get children of org unit', async () => {
      const parent = mockOrgUnit({ id: 'parent-1' });
      const children = [mockOrgUnit({ id: 'child-1' }), mockOrgUnit({ id: 'child-2' })];

      jest.mocked(mockRepository.findById).mockResolvedValue(parent);
      jest.mocked(mockRepository.findChildren).mockResolvedValue(children);

      const result = await engine.getChildren('parent-1', TENANT_A);

      expect(result).toEqual(children);
      expect(mockRepository.findChildren).toHaveBeenCalledWith('parent-1', TENANT_A);
    });

    it('should reject if parent not found', async () => {
      jest.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(engine.getChildren('nonexistent', TENANT_A))
        .rejects.toThrow(OrgUnitNotFoundError);
    });
  });

  describe('getHierarchy', () => {
    it('should get hierarchy from root', async () => {
      const hierarchy = [
        { unit: mockOrgUnit(), depth: 0, path: ['unit-1'], pathNames: ['Branch 1'] }
      ];

      jest.mocked(mockRepository.findById).mockResolvedValue(mockOrgUnit());
      jest.mocked(mockRepository.findHierarchy).mockResolvedValue(hierarchy);

      const result = await engine.getHierarchy('unit-1', TENANT_A);

      expect(result).toEqual(hierarchy);
      expect(mockRepository.findHierarchy).toHaveBeenCalledWith('unit-1', TENANT_A);
    });

    it('should get all hierarchies if rootId is null', async () => {
      const hierarchy = [
        { unit: mockOrgUnit(), depth: 0, path: ['unit-1'], pathNames: ['Branch 1'] }
      ];

      jest.mocked(mockRepository.findHierarchy).mockResolvedValue(hierarchy);

      const result = await engine.getHierarchy(null, TENANT_A);

      expect(result).toEqual(hierarchy);
      expect(mockRepository.findHierarchy).toHaveBeenCalledWith(null, TENANT_A);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('validateParent', () => {
    it('should return false for self-reference', async () => {
      const result = await engine.validateParent('unit-1', 'unit-1', TENANT_A);
      expect(result).toBe(false);
    });

    it('should return false if parent not found', async () => {
      jest.mocked(mockRepository.findById).mockResolvedValueOnce(null);

      const result = await engine.validateParent('child-1', 'parent-1', TENANT_A);
      expect(result).toBe(false);
    });

    it('should return false if child not found', async () => {
      jest.mocked(mockRepository.findById)
        .mockResolvedValueOnce(mockOrgUnit({ id: 'parent-1' }))
        .mockResolvedValueOnce(null);

      const result = await engine.validateParent('child-1', 'parent-1', TENANT_A);
      expect(result).toBe(false);
    });

    it('should return false if tenant mismatch', async () => {
      jest.mocked(mockRepository.findById)
        .mockResolvedValueOnce(mockOrgUnit({ id: 'parent-1', tenantId: TENANT_B }))
        .mockResolvedValueOnce(mockOrgUnit({ id: 'child-1', tenantId: TENANT_A }));

      const result = await engine.validateParent('child-1', 'parent-1', TENANT_A);
      expect(result).toBe(false);
    });

    it('should return false if circular reference detected', async () => {
      jest.mocked(mockRepository.findById)
        .mockResolvedValueOnce(mockOrgUnit({ id: 'parent-1' }))
        .mockResolvedValueOnce(mockOrgUnit({ id: 'child-1' }));
      jest.mocked(mockRepository.findDescendantIds).mockResolvedValue(['descendant-1', 'parent-1']);

      const result = await engine.validateParent('child-1', 'parent-1', TENANT_A);
      expect(result).toBe(false);
    });

    it('should return true if valid parent-child relationship', async () => {
      jest.mocked(mockRepository.findById)
        .mockResolvedValueOnce(mockOrgUnit({ id: 'parent-1' }))
        .mockResolvedValueOnce(mockOrgUnit({ id: 'child-1' }));
      jest.mocked(mockRepository.findDescendantIds).mockResolvedValue(['descendant-1']);

      const result = await engine.validateParent('child-1', 'parent-1', TENANT_A);
      expect(result).toBe(true);
    });
  });

  describe('detectCircularReference', () => {
    it('should return true for self-reference', async () => {
      const result = await engine.detectCircularReference('unit-1', 'unit-1', TENANT_A);
      expect(result).toBe(true);
    });

    it('should return true if parent is descendant', async () => {
      jest.mocked(mockRepository.findDescendantIds).mockResolvedValue(['child-1', 'grandchild-1', 'new-parent']);

      const result = await engine.detectCircularReference('unit-1', 'new-parent', TENANT_A);
      expect(result).toBe(true);
    });

    it('should return false if no circular reference', async () => {
      jest.mocked(mockRepository.findDescendantIds).mockResolvedValue(['child-1', 'grandchild-1']);

      const result = await engine.detectCircularReference('unit-1', 'valid-parent', TENANT_A);
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCOPE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getUserAccessibleUnits', () => {
    it('should return all active units in tenant', async () => {
      const units = [mockOrgUnit(), mockOrgUnit({ id: 'unit-2' })];
      jest.mocked(mockRepository.findMany).mockResolvedValue(units);

      const result = await engine.getUserAccessibleUnits('user-1', TENANT_A);

      expect(result).toEqual(units);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        unitType: undefined,
        isActive: true
      });
    });

    it('should filter by unit type if specified', async () => {
      const branches = [mockOrgUnit({ unitType: 'branch' })];
      jest.mocked(mockRepository.findMany).mockResolvedValue(branches);

      const result = await engine.getUserAccessibleUnits('user-1', TENANT_A, 'branch');

      expect(result).toEqual(branches);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        unitType: 'branch',
        isActive: true
      });
    });
  });
});

