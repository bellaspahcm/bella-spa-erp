/**
 * Unit Tests - DecisionProviderRegistry
 * 
 * Tests for DecisionProviderRegistry provider management and selection.
 */

import type { IDecisionProvider } from '../../abstractions';
import type { DecisionContext, DecisionResult } from '../../types';
import {
  createProviderRegistry,
  DecisionProviderRegistry,
  ProviderConflictError,
  ProviderNotFoundError,
} from '../DecisionProviderRegistry';

// Mock provider implementation
class MockProvider implements IDecisionProvider {
  constructor(
    public readonly name: string,
    public readonly supportedRuleTypes: string[]
  ) {}

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    return {
      approved: true,
      confidence: 1.0,
      provider: this.name,
      executionTime: 0,
      timestamp: new Date(),
    };
  }

  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }
}

describe('DecisionProviderRegistry', () => {
  describe('constructor', () => {
    it('should create empty registry', () => {
      const registry = new DecisionProviderRegistry();
      expect(registry.listProviders()).toEqual([]);
      expect(registry.listRuleTypes()).toEqual([]);
    });
  });

  describe('register', () => {
    it('should register provider successfully', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);

      expect(registry.listProviders()).toContain('TestProvider');
      expect(registry.listRuleTypes()).toContain('if-then');
    });

    it('should register provider with multiple rule types', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', [
        'if-then',
        'decision-table',
        'decision-tree',
      ]);

      registry.register(provider);

      expect(registry.listRuleTypes()).toEqual([
        'if-then',
        'decision-table',
        'decision-tree',
      ]);
    });

    it('should throw error if provider has no name', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('', ['if-then']);

      expect(() => registry.register(provider)).toThrow('Provider must have a name');
    });

    it('should throw error if provider has no supported rule types', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', []);

      expect(() => registry.register(provider)).toThrow(
        'Provider "TestProvider" has no supported rule types'
      );
    });

    it('should throw ProviderConflictError if rule type already registered', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['if-then']);

      registry.register(provider1);

      expect(() => registry.register(provider2)).toThrow(ProviderConflictError);
      expect(() => registry.register(provider2)).toThrow(
        'Rule type "if-then" is already handled by "Provider1"'
      );
    });

    it('should throw error if provider name already registered', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('TestProvider', ['if-then']);
      const provider2 = new MockProvider('TestProvider', ['bi-query']);

      registry.register(provider1);

      expect(() => registry.register(provider2)).toThrow(
        'Provider with name "TestProvider" is already registered'
      );
    });

    it('should register providers with different rule types', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['bi-query']);

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.listProviders()).toEqual(['Provider1', 'Provider2']);
      expect(registry.listRuleTypes()).toEqual(['if-then', 'bi-query']);
    });

    it('should override provider with higher priority', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['if-then']);

      registry.register(provider1, { priority: 0 });
      registry.register(provider2, { priority: 10 });

      const selectedProvider = registry.getProvider('if-then');
      expect(selectedProvider?.name).toBe('Provider2');
    });

    it('should not override provider with lower priority', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['if-then']);

      registry.register(provider1, { priority: 10 });

      expect(() => registry.register(provider2, { priority: 5 })).toThrow(
        ProviderConflictError
      );
    });

    it('should use override rule types if provided', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then', 'decision-table']);

      registry.register(provider, {
        overrideRuleTypes: ['custom-type'],
      });

      expect(registry.listRuleTypes()).toEqual(['custom-type']);
      expect(registry.hasProvider('if-then')).toBe(false);
      expect(registry.hasProvider('custom-type')).toBe(true);
    });

    it('should register provider with metadata', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);
      const metadata = {
        description: 'Test provider',
        version: '1.0.0',
      };

      registry.register(provider, { metadata });

      const providerMetadata = registry.getProviderMetadata('TestProvider');
      expect(providerMetadata).toEqual(metadata);
    });
  });

  describe('getProvider', () => {
    it('should return provider for registered rule type', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);

      const selectedProvider = registry.getProvider('if-then');
      expect(selectedProvider).toBe(provider);
    });

    it('should return undefined for unregistered rule type', () => {
      const registry = new DecisionProviderRegistry();

      const provider = registry.getProvider('unknown-type');
      expect(provider).toBeUndefined();
    });

    it('should return correct provider for multiple registrations', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['bi-query']);

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.getProvider('if-then')).toBe(provider1);
      expect(registry.getProvider('bi-query')).toBe(provider2);
    });
  });

  describe('getProviderOrThrow', () => {
    it('should return provider for registered rule type', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);

      const selectedProvider = registry.getProviderOrThrow('if-then');
      expect(selectedProvider).toBe(provider);
    });

    it('should throw ProviderNotFoundError for unregistered rule type', () => {
      const registry = new DecisionProviderRegistry();

      expect(() => registry.getProviderOrThrow('unknown-type')).toThrow(
        ProviderNotFoundError
      );
      expect(() => registry.getProviderOrThrow('unknown-type')).toThrow(
        'No provider found for rule type: "unknown-type"'
      );
    });
  });

  describe('getProviderByName', () => {
    it('should return provider by name', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);

      const selectedProvider = registry.getProviderByName('TestProvider');
      expect(selectedProvider).toBe(provider);
    });

    it('should return undefined for unknown name', () => {
      const registry = new DecisionProviderRegistry();

      const provider = registry.getProviderByName('UnknownProvider');
      expect(provider).toBeUndefined();
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered rule type', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);

      expect(registry.hasProvider('if-then')).toBe(true);
    });

    it('should return false for unregistered rule type', () => {
      const registry = new DecisionProviderRegistry();

      expect(registry.hasProvider('unknown-type')).toBe(false);
    });
  });

  describe('listProviders', () => {
    it('should return empty array for empty registry', () => {
      const registry = new DecisionProviderRegistry();

      expect(registry.listProviders()).toEqual([]);
    });

    it('should return all registered provider names', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['bi-query']);

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.listProviders()).toEqual(['Provider1', 'Provider2']);
    });

    it('should not include duplicate names', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then', 'decision-table']);

      registry.register(provider);

      const providers = registry.listProviders();
      expect(providers).toEqual(['TestProvider']);
      expect(providers.length).toBe(1);
    });
  });

  describe('listRuleTypes', () => {
    it('should return empty array for empty registry', () => {
      const registry = new DecisionProviderRegistry();

      expect(registry.listRuleTypes()).toEqual([]);
    });

    it('should return all registered rule types', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then', 'decision-table']);
      const provider2 = new MockProvider('Provider2', ['bi-query']);

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.listRuleTypes()).toEqual(['if-then', 'decision-table', 'bi-query']);
    });
  });

  describe('getProviderMetadata', () => {
    it('should return metadata for provider with metadata', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);
      const metadata = {
        description: 'Test provider',
        version: '1.0.0',
      };

      registry.register(provider, { metadata });

      expect(registry.getProviderMetadata('TestProvider')).toEqual(metadata);
    });

    it('should return undefined for provider without metadata', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);

      expect(registry.getProviderMetadata('TestProvider')).toBeUndefined();
    });

    it('should return undefined for unknown provider', () => {
      const registry = new DecisionProviderRegistry();

      expect(registry.getProviderMetadata('UnknownProvider')).toBeUndefined();
    });
  });

  describe('getProviderInfo', () => {
    it('should return provider info', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then', 'decision-table']);

      registry.register(provider, { priority: 10 });

      const info = registry.getProviderInfo('TestProvider');
      expect(info).toEqual({
        name: 'TestProvider',
        supportedRuleTypes: ['if-then', 'decision-table'],
        priority: 10,
        metadata: undefined,
      });
    });

    it('should return undefined for unknown provider', () => {
      const registry = new DecisionProviderRegistry();

      expect(registry.getProviderInfo('UnknownProvider')).toBeUndefined();
    });

    it('should include metadata in info', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);
      const metadata = { description: 'Test', version: '1.0.0' };

      registry.register(provider, { metadata });

      const info = registry.getProviderInfo('TestProvider');
      expect(info?.metadata).toEqual(metadata);
    });
  });

  describe('clear', () => {
    it('should clear all providers', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then']);
      const provider2 = new MockProvider('Provider2', ['bi-query']);

      registry.register(provider1);
      registry.register(provider2);

      registry.clear();

      expect(registry.listProviders()).toEqual([]);
      expect(registry.listRuleTypes()).toEqual([]);
      expect(registry.hasProvider('if-then')).toBe(false);
      expect(registry.hasProvider('bi-query')).toBe(false);
    });

    it('should allow re-registration after clear', () => {
      const registry = new DecisionProviderRegistry();
      const provider = new MockProvider('TestProvider', ['if-then']);

      registry.register(provider);
      registry.clear();
      registry.register(provider);

      expect(registry.listProviders()).toEqual(['TestProvider']);
      expect(registry.hasProvider('if-then')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats for empty registry', () => {
      const registry = new DecisionProviderRegistry();

      const stats = registry.getStats();
      expect(stats).toEqual({
        providerCount: 0,
        ruleTypeCount: 0,
        providers: [],
      });
    });

    it('should return stats with providers', () => {
      const registry = new DecisionProviderRegistry();
      const provider1 = new MockProvider('Provider1', ['if-then', 'decision-table']);
      const provider2 = new MockProvider('Provider2', ['bi-query']);

      registry.register(provider1);
      registry.register(provider2);

      const stats = registry.getStats();
      expect(stats.providerCount).toBe(2);
      expect(stats.ruleTypeCount).toBe(3);
      expect(stats.providers).toEqual([
        { name: 'Provider1', ruleTypes: ['if-then', 'decision-table'] },
        { name: 'Provider2', ruleTypes: ['bi-query'] },
      ]);
    });
  });

  describe('createProviderRegistry', () => {
    it('should create new registry instance', () => {
      const registry = createProviderRegistry();

      expect(registry).toBeInstanceOf(DecisionProviderRegistry);
      expect(registry.listProviders()).toEqual([]);
    });
  });

  describe('validation', () => {
    it('should throw error if provider is null', () => {
      const registry = new DecisionProviderRegistry();

      expect(() => registry.register(null as any)).toThrow('Provider is required');
    });

    it('should throw error if provider has no evaluate method', () => {
      const registry = new DecisionProviderRegistry();
      const invalidProvider = {
        name: 'Invalid',
        supportedRuleTypes: ['test'],
        canHandle: () => true,
        // Missing evaluate
      };

      expect(() => registry.register(invalidProvider as any)).toThrow(
        'Provider "Invalid" must implement evaluate()'
      );
    });

    it('should throw error if provider has no canHandle method', () => {
      const registry = new DecisionProviderRegistry();
      const invalidProvider = {
        name: 'Invalid',
        supportedRuleTypes: ['test'],
        evaluate: async () => ({} as any),
        // Missing canHandle
      };

      expect(() => registry.register(invalidProvider as any)).toThrow(
        'Provider "Invalid" must implement canHandle()'
      );
    });

    it('should throw error if supportedRuleTypes is not array', () => {
      const registry = new DecisionProviderRegistry();
      const invalidProvider = {
        name: 'Invalid',
        supportedRuleTypes: 'not-array',
        evaluate: async () => ({} as any),
        canHandle: () => true,
      };

      expect(() => registry.register(invalidProvider as any)).toThrow(
        'Provider "Invalid" supportedRuleTypes must be an array'
      );
    });
  });
});
