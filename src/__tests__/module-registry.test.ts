/**
 * Tests for ModuleRegistry system.
 * 
 * @remarks
 * This test suite validates the module registry's ability to:
 * - Register module adapters
 * - Prevent duplicate registrations
 * - Retrieve adapters (gracefully and strictly)
 * - Check adapter existence
 * - Handle invalid adapters
 */

import { moduleRegistry } from '@/core/adapters/registry';
import {
  isModuleAdapter,
  DuplicateModuleError,
  AdapterNotFoundError,
} from '@/core/adapters/types';
import type { ModuleAdapter, ModuleId, CoreServiceCatalogItem, CoreBookingOrder, TenantContext } from '@/core/types';

// Mock console.log to avoid noise in test output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('ModuleRegistry', () => {
  // Create test adapters
  const createTestAdapter = (moduleId: ModuleId, moduleName: string): ModuleAdapter => ({
    moduleId,
    moduleName,
    transformServiceItem: (item: CoreServiceCatalogItem) => item,
    transformBookingOrder: (order: CoreBookingOrder) => order,
    validateBookingRules: async () => true,
    calculatePricing: async (item: CoreServiceCatalogItem) => item.basePrice,
    onBookingCompleted: async () => {},
    getModuleWidgets: () => [],
  });

  beforeEach(() => {
    // Clear registry before each test to ensure isolation
    moduleRegistry.clear();
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('register()', () => {
    it('successfully registers a valid module adapter', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      
      expect(() => moduleRegistry.register(spaAdapter)).not.toThrow();
      expect(moduleRegistry.has('spa')).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ModuleRegistry] Registered adapter: Beauty Spa & Wellness (spa)'
      );
    });

    it('throws DuplicateModuleError when registering same moduleId twice', () => {
      const spaAdapter1 = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const spaAdapter2 = createTestAdapter('spa', 'Another Spa Module');
      
      moduleRegistry.register(spaAdapter1);
      
      expect(() => moduleRegistry.register(spaAdapter2)).toThrow(DuplicateModuleError);
      expect(() => moduleRegistry.register(spaAdapter2)).toThrow(
        'Module adapter already registered: spa'
      );
    });

    it('allows registering different modules', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const cleaningAdapter = createTestAdapter('cleaning', 'Cleaning Services');
      
      moduleRegistry.register(spaAdapter);
      moduleRegistry.register(cleaningAdapter);
      
      expect(moduleRegistry.has('spa')).toBe(true);
      expect(moduleRegistry.has('cleaning')).toBe(true);
    });

    it('throws error for invalid adapter (missing moduleId)', () => {
      const invalidAdapter = {
        moduleName: 'Invalid Module',
      };
      
      expect(() => moduleRegistry.register(invalidAdapter as ModuleAdapter)).toThrow(
        'Invalid adapter: must implement ModuleAdapter interface'
      );
    });

    it('throws error for invalid adapter (missing moduleName)', () => {
      const invalidAdapter = {
        moduleId: 'spa',
      };
      
      expect(() => moduleRegistry.register(invalidAdapter as ModuleAdapter)).toThrow(
        'Invalid adapter: must implement ModuleAdapter interface'
      );
    });

    it('accepts adapter with only required properties', () => {
      const minimalAdapter: ModuleAdapter = {
        moduleId: 'spa',
        moduleName: 'Minimal Spa Module',
      };
      
      expect(() => moduleRegistry.register(minimalAdapter)).not.toThrow();
      expect(moduleRegistry.has('spa')).toBe(true);
    });

    it('throws error for adapter with invalid optional method (not a function)', () => {
      const invalidAdapter = {
        moduleId: 'spa',
        moduleName: 'Spa Module',
        validateBookingRules: 'not-a-function',
      };
      
      expect(() => moduleRegistry.register(invalidAdapter as unknown as ModuleAdapter)).toThrow(
        'Invalid adapter: must implement ModuleAdapter interface'
      );
    });
  });

  describe('get()', () => {
    it('returns adapter when module is registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      const retrieved = moduleRegistry.get('spa');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.moduleId).toBe('spa');
      expect(retrieved?.moduleName).toBe('Beauty Spa & Wellness');
    });

    it('returns undefined when module is not registered', () => {
      const retrieved = moduleRegistry.get('spa');
      
      expect(retrieved).toBeUndefined();
    });

    it('returns correct adapter when multiple modules registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const cleaningAdapter = createTestAdapter('cleaning', 'Cleaning Services');
      
      moduleRegistry.register(spaAdapter);
      moduleRegistry.register(cleaningAdapter);
      
      const retrievedSpa = moduleRegistry.get('spa');
      const retrievedCleaning = moduleRegistry.get('cleaning');
      
      expect(retrievedSpa?.moduleId).toBe('spa');
      expect(retrievedCleaning?.moduleId).toBe('cleaning');
    });
  });

  describe('getRequired()', () => {
    it('returns adapter when module is registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      const retrieved = moduleRegistry.getRequired('spa');
      
      expect(retrieved).toBeDefined();
      expect(retrieved.moduleId).toBe('spa');
      expect(retrieved.moduleName).toBe('Beauty Spa & Wellness');
    });

    it('throws AdapterNotFoundError when module is not registered', () => {
      expect(() => moduleRegistry.getRequired('spa')).toThrow(AdapterNotFoundError);
      expect(() => moduleRegistry.getRequired('spa')).toThrow(
        'Module adapter not found: spa'
      );
    });

    it('returns correct adapter when multiple modules registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const cleaningAdapter = createTestAdapter('cleaning', 'Cleaning Services');
      
      moduleRegistry.register(spaAdapter);
      moduleRegistry.register(cleaningAdapter);
      
      const retrievedSpa = moduleRegistry.getRequired('spa');
      const retrievedCleaning = moduleRegistry.getRequired('cleaning');
      
      expect(retrievedSpa.moduleId).toBe('spa');
      expect(retrievedCleaning.moduleId).toBe('cleaning');
    });
  });

  describe('has()', () => {
    it('returns true when module is registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      expect(moduleRegistry.has('spa')).toBe(true);
    });

    it('returns false when module is not registered', () => {
      expect(moduleRegistry.has('spa')).toBe(false);
    });

    it('returns correct results for multiple modules', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      expect(moduleRegistry.has('spa')).toBe(true);
      expect(moduleRegistry.has('cleaning')).toBe(false);
      expect(moduleRegistry.has('home-service')).toBe(false);
    });
  });

  describe('getAllModuleIds()', () => {
    it('returns empty array when no modules registered', () => {
      const moduleIds = moduleRegistry.getAllModuleIds();
      
      expect(moduleIds).toEqual([]);
    });

    it('returns array with single module ID when one module registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      const moduleIds = moduleRegistry.getAllModuleIds();
      
      expect(moduleIds).toEqual(['spa']);
    });

    it('returns array with all module IDs when multiple modules registered', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const cleaningAdapter = createTestAdapter('cleaning', 'Cleaning Services');
      const homeServiceAdapter = createTestAdapter('home-service', 'Home Services');
      
      moduleRegistry.register(spaAdapter);
      moduleRegistry.register(cleaningAdapter);
      moduleRegistry.register(homeServiceAdapter);
      
      const moduleIds = moduleRegistry.getAllModuleIds();
      
      expect(moduleIds).toHaveLength(3);
      expect(moduleIds).toContain('spa');
      expect(moduleIds).toContain('cleaning');
      expect(moduleIds).toContain('home-service');
    });
  });

  describe('clear()', () => {
    it('removes all registered adapters', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const cleaningAdapter = createTestAdapter('cleaning', 'Cleaning Services');
      
      moduleRegistry.register(spaAdapter);
      moduleRegistry.register(cleaningAdapter);
      
      expect(moduleRegistry.has('spa')).toBe(true);
      expect(moduleRegistry.has('cleaning')).toBe(true);
      
      moduleRegistry.clear();
      
      expect(moduleRegistry.has('spa')).toBe(false);
      expect(moduleRegistry.has('cleaning')).toBe(false);
      expect(moduleRegistry.getAllModuleIds()).toEqual([]);
    });

    it('allows re-registration after clear', () => {
      const spaAdapter1 = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const spaAdapter2 = createTestAdapter('spa', 'New Spa Module');
      
      moduleRegistry.register(spaAdapter1);
      moduleRegistry.clear();
      
      expect(() => moduleRegistry.register(spaAdapter2)).not.toThrow();
      expect(moduleRegistry.get('spa')?.moduleName).toBe('New Spa Module');
    });
  });

  describe('integration scenarios', () => {
    it('supports typical core service usage pattern (graceful get)', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      // Simulate core service checking for adapter
      const adapter = moduleRegistry.get('spa');
      
      if (adapter?.validateBookingRules) {
        // Adapter exists and has method, use it
        expect(typeof adapter.validateBookingRules).toBe('function');
      } else {
        // Adapter missing or method not implemented, use default behavior
        expect(adapter).toBeUndefined();
      }
    });

    it('supports module-specific API route pattern (strict get)', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      // Simulate module-specific route requiring adapter
      expect(() => {
        const adapter = moduleRegistry.getRequired('spa');
        expect(adapter.moduleId).toBe('spa');
      }).not.toThrow();
    });

    it('supports feature detection pattern', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      moduleRegistry.register(spaAdapter);
      
      // Simulate UI feature detection
      const showSpaWidgets = moduleRegistry.has('spa');
      const showCleaningWidgets = moduleRegistry.has('cleaning');
      
      expect(showSpaWidgets).toBe(true);
      expect(showCleaningWidgets).toBe(false);
    });

    it('supports multi-module iteration pattern', () => {
      const spaAdapter = createTestAdapter('spa', 'Beauty Spa & Wellness');
      const cleaningAdapter = createTestAdapter('cleaning', 'Cleaning Services');
      
      moduleRegistry.register(spaAdapter);
      moduleRegistry.register(cleaningAdapter);
      
      // Simulate iterating over all modules
      const allModuleIds = moduleRegistry.getAllModuleIds();
      const moduleNames = allModuleIds.map(id => {
        const adapter = moduleRegistry.getRequired(id);
        return adapter.moduleName;
      });
      
      expect(moduleNames).toContain('Beauty Spa & Wellness');
      expect(moduleNames).toContain('Cleaning Services');
    });
  });
});

describe('isModuleAdapter type guard', () => {
  it('returns true for valid adapter with all properties', () => {
    const validAdapter: ModuleAdapter = {
      moduleId: 'spa',
      moduleName: 'Beauty Spa & Wellness',
      transformServiceItem: () => ({}),
      transformBookingOrder: () => ({}),
      validateBookingRules: async () => true,
      calculatePricing: async () => 0,
      onBookingCompleted: async () => {},
      getModuleWidgets: () => [],
    };
    
    expect(isModuleAdapter(validAdapter)).toBe(true);
  });

  it('returns true for minimal valid adapter (only required properties)', () => {
    const minimalAdapter: ModuleAdapter = {
      moduleId: 'spa',
      moduleName: 'Minimal Spa Module',
    };
    
    expect(isModuleAdapter(minimalAdapter)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isModuleAdapter(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isModuleAdapter(undefined)).toBe(false);
  });

  it('returns false for non-object types', () => {
    expect(isModuleAdapter('string')).toBe(false);
    expect(isModuleAdapter(123)).toBe(false);
    expect(isModuleAdapter(true)).toBe(false);
  });

  it('returns false for object missing moduleId', () => {
    const invalidAdapter = {
      moduleName: 'Missing Module ID',
    };
    
    expect(isModuleAdapter(invalidAdapter)).toBe(false);
  });

  it('returns false for object missing moduleName', () => {
    const invalidAdapter = {
      moduleId: 'spa',
    };
    
    expect(isModuleAdapter(invalidAdapter)).toBe(false);
  });

  it('returns false for object with non-string moduleId', () => {
    const invalidAdapter = {
      moduleId: 123,
      moduleName: 'Invalid Module',
    };
    
    expect(isModuleAdapter(invalidAdapter)).toBe(false);
  });

  it('returns false for object with non-string moduleName', () => {
    const invalidAdapter = {
      moduleId: 'spa',
      moduleName: 123,
    };
    
    expect(isModuleAdapter(invalidAdapter)).toBe(false);
  });

  it('returns false when optional method is not a function', () => {
    const invalidAdapter = {
      moduleId: 'spa',
      moduleName: 'Spa Module',
      validateBookingRules: 'not-a-function',
    };
    
    expect(isModuleAdapter(invalidAdapter)).toBe(false);
  });

  it('returns true when some optional methods are functions', () => {
    const partialAdapter = {
      moduleId: 'spa',
      moduleName: 'Spa Module',
      validateBookingRules: async () => true,
      calculatePricing: async () => 0,
      // Other methods omitted
    };
    
    expect(isModuleAdapter(partialAdapter)).toBe(true);
  });
});

describe('ModuleRegistryError classes', () => {
  it('DuplicateModuleError has correct properties', () => {
    const error = new DuplicateModuleError('spa');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DuplicateModuleError);
    expect(error.name).toBe('DuplicateModuleError');
    expect(error.message).toBe('Module adapter already registered: spa');
    expect(error.moduleId).toBe('spa');
  });

  it('AdapterNotFoundError has correct properties', () => {
    const error = new AdapterNotFoundError('cleaning');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AdapterNotFoundError);
    expect(error.name).toBe('AdapterNotFoundError');
    expect(error.message).toBe('Module adapter not found: cleaning');
    expect(error.moduleId).toBe('cleaning');
  });
});
