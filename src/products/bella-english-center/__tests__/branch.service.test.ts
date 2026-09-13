/**
 * @fileoverview E1 Branch Service Tests
 * 
 * Tests English Center branch service layer integration with Platform Org Unit contract.
 */

import { englishBranchService } from '../services/branch.service';
import { orgUnitEngine } from '@/platform';

// Mock Platform orgUnitEngine
jest.mock('@/platform', () => ({
  orgUnitEngine: {
    createOrgUnit: jest.fn(),
    updateOrgUnit: jest.fn(),
    archiveOrgUnit: jest.fn(),
    getOrgUnit: jest.fn(),
    getOrgUnits: jest.fn(),
    getChildren: jest.fn(),
    getHierarchy: jest.fn(),
  },
  OrgUnitNotFoundError: class OrgUnitNotFoundError extends Error {
    constructor(id: string) {
      super(`Org unit not found: ${id}`);
      this.name = 'OrgUnitNotFoundError';
    }
  },
}));

const TENANT_ID = 'test-tenant-1';

describe('EnglishBranchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBranch', () => {
    it('should create branch with English Center metadata', async () => {
      const mockBranch = {
        id: 'branch-1',
        tenantId: TENANT_ID,
        unitType: 'branch' as const,
        name: 'Chi Nhánh Quận 1',
        code: 'HCM-Q1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(orgUnitEngine.createOrgUnit).mockResolvedValue(mockBranch);

      const result = await englishBranchService.createBranch({
        tenantId: TENANT_ID,
        name: 'Chi Nhánh Quận 1',
        code: 'HCM-Q1',
        address: '123 Main St',
        phone: '0901234567',
        email: 'q1@bellaspa.vn',
        capacity: 100,
      });

      expect(orgUnitEngine.createOrgUnit).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        unitType: 'branch',
        name: 'Chi Nhánh Quận 1',
        code: 'HCM-Q1',
        parentId: undefined,
        metadata: {
          type: 'english_center',
          address: '123 Main St',
          phone: '0901234567',
          email: 'q1@bellaspa.vn',
          capacity: 100,
          openingHours: undefined,
        },
      });

      expect(result).toEqual(mockBranch);
    });

    it('should create branch under region', async () => {
      const mockBranch = {
        id: 'branch-1',
        tenantId: TENANT_ID,
        unitType: 'branch' as const,
        name: 'Chi Nhánh Quận 1',
        code: 'HCM-Q1',
        parentId: 'region-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(orgUnitEngine.createOrgUnit).mockResolvedValue(mockBranch);

      await englishBranchService.createBranch({
        tenantId: TENANT_ID,
        name: 'Chi Nhánh Quận 1',
        code: 'HCM-Q1',
        regionId: 'region-1',
      });

      expect(orgUnitEngine.createOrgUnit).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'region-1',
        })
      );
    });
  });

  describe('getActiveBranches', () => {
    it('should fetch active branches only', async () => {
      const mockBranches = [
        {
          id: 'branch-1',
          tenantId: TENANT_ID,
          unitType: 'branch' as const,
          name: 'Branch 1',
          code: 'BR-1',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'branch-2',
          tenantId: TENANT_ID,
          unitType: 'branch' as const,
          name: 'Branch 2',
          code: 'BR-2',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.mocked(orgUnitEngine.getOrgUnits).mockResolvedValue(mockBranches);

      const result = await englishBranchService.getActiveBranches(TENANT_ID);

      expect(orgUnitEngine.getOrgUnits).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        unitType: 'branch',
        isActive: true,
      });

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('BR-1');
    });
  });

  describe('validateActiveBranch', () => {
    it('should return true for active branch', async () => {
      const mockBranch = {
        id: 'branch-1',
        tenantId: TENANT_ID,
        unitType: 'branch' as const,
        name: 'Branch 1',
        code: 'BR-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(orgUnitEngine.getOrgUnit).mockResolvedValue(mockBranch);

      const result = await englishBranchService.validateActiveBranch('branch-1', TENANT_ID);

      expect(result).toBe(true);
    });

    it('should return false for inactive branch', async () => {
      const mockBranch = {
        id: 'branch-1',
        tenantId: TENANT_ID,
        unitType: 'branch' as const,
        name: 'Branch 1',
        code: 'BR-1',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(orgUnitEngine.getOrgUnit).mockResolvedValue(mockBranch);

      const result = await englishBranchService.validateActiveBranch('branch-1', TENANT_ID);

      expect(result).toBe(false);
    });

    it('should return false for nonexistent branch', async () => {
      jest.mocked(orgUnitEngine.getOrgUnit).mockResolvedValue(null);

      const result = await englishBranchService.validateActiveBranch('nonexistent', TENANT_ID);

      expect(result).toBe(false);
    });
  });

  describe('getBranchHierarchy', () => {
    it('should get full hierarchy', async () => {
      const mockHierarchy = [
        {
          id: 'company-1',
          tenantId: TENANT_ID,
          unitType: 'company' as const,
          name: 'Bella English Center',
          code: 'BEC',
          isActive: true,
          children: [
            {
              id: 'region-1',
              tenantId: TENANT_ID,
              unitType: 'region' as const,
              name: 'Hồ Chí Minh',
              code: 'HCM',
              isActive: true,
              children: [
                {
                  id: 'branch-1',
                  tenantId: TENANT_ID,
                  unitType: 'branch' as const,
                  name: 'Quận 1',
                  code: 'HCM-Q1',
                  isActive: true,
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      jest.mocked(orgUnitEngine.getHierarchy).mockResolvedValue(mockHierarchy);

      const result = await englishBranchService.getBranchHierarchy(null, TENANT_ID);

      expect(orgUnitEngine.getHierarchy).toHaveBeenCalledWith(null, TENANT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].children).toHaveLength(1);
    });
  });
});
