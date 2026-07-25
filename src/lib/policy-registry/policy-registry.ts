/**
 * Policy Registry
 * 
 * Central registry for discovering, registering, and managing business policies.
 * 
 * Key Features:
 * - Register policies dynamically
 * - Discover installed policies
 * - Query/filter policies by domain, category, tags
 * - Get policy metadata
 * - Track policy dependencies
 * 
 * This is the foundation of Bella EIP's plugin architecture.
 */

import type {
  PolicyMetadata,
  RegisteredPolicy,
  PolicyQueryFilter,
  PolicyRegistrationOptions,
  RegistryStatistics,
} from './types';

/**
 * PolicyRegistry (Singleton)
 * 
 * Manages all policies in the system.
 */
export class PolicyRegistry {
  private static instance: PolicyRegistry;
  
  /** In-memory policy storage */
  private policies: Map<string, RegisteredPolicy> = new Map();
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PolicyRegistry {
    if (!PolicyRegistry.instance) {
      PolicyRegistry.instance = new PolicyRegistry();
    }
    return PolicyRegistry.instance;
  }
  
  /**
   * Register a new policy
   * 
   * @param policy - Policy instance to register
   * @param metadata - Policy metadata
   * @param options - Registration options
   * @returns Registered policy ID
   */
  public async register(
    policy: unknown,
    metadata: Omit<PolicyMetadata, 'createdAt' | 'updatedAt'>,
    options?: PolicyRegistrationOptions
  ): Promise<string> {
    const id = options?.id || metadata.id;
    
    // Check if policy already exists
    if (this.policies.has(id) && !options?.force) {
      throw new Error(`Policy '${id}' is already registered. Use force=true to override.`);
    }
    
    // Create full metadata with timestamps
    const now = new Date().toISOString();
    const fullMetadata: PolicyMetadata = {
      ...metadata,
      createdAt: now,
      updatedAt: now,
    };
    
    // Apply metadata overrides if provided
    if (options?.metadata) {
      Object.assign(fullMetadata, options.metadata);
    }
    
    // Validate metadata
    this.validateMetadata(fullMetadata);
    
    // Register policy
    const registered: RegisteredPolicy = {
      metadata: fullMetadata,
      policy,
      registeredAt: now,
    };
    
    this.policies.set(id, registered);
    
    return id;
  }
  
  /**
   * Get a policy by ID
   * 
   * @param id - Policy ID
   * @returns Registered policy or undefined
   */
  public getPolicy(id: string): RegisteredPolicy | undefined {
    return this.policies.get(id);
  }
  
  /**
   * List all policies with optional filters
   * 
   * @param filter - Query filter
   * @returns Array of registered policies
   */
  public listPolicies(filter?: PolicyQueryFilter): RegisteredPolicy[] {
    let results = Array.from(this.policies.values());
    
    if (!filter) {
      return results;
    }
    
    // Filter by domain
    if (filter.domain) {
      results = results.filter(p => p.metadata.domain === filter.domain);
    }
    
    // Filter by category
    if (filter.category) {
      results = results.filter(p => p.metadata.category === filter.category);
    }
    
    // Filter by tags (all tags must match)
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(p =>
        filter.tags!.every(tag => p.metadata.tags.includes(tag))
      );
    }
    
    // Filter by status
    if (filter.status) {
      results = results.filter(p => p.metadata.status === filter.status);
    }
    
    // Search by name (case-insensitive partial match)
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      results = results.filter(p =>
        p.metadata.name.toLowerCase().includes(searchLower) ||
        p.metadata.description.toLowerCase().includes(searchLower)
      );
    }
    
    return results;
  }
  
  /**
   * Get policies by domain
   * 
   * @param domain - Domain name
   * @returns Array of policies in that domain
   */
  public getPoliciesByDomain(domain: string): RegisteredPolicy[] {
    return this.listPolicies({ domain });
  }
  
  /**
   * Get policies by category
   * 
   * @param category - Category name
   * @returns Array of policies in that category
   */
  public getPoliciesByCategory(
    category: PolicyMetadata['category']
  ): RegisteredPolicy[] {
    return this.listPolicies({ category });
  }
  
  /**
   * Check if a policy is registered
   * 
   * @param id - Policy ID
   * @returns True if registered
   */
  public hasPolicy(id: string): boolean {
    return this.policies.has(id);
  }
  
  /**
   * Unregister a policy
   * 
   * @param id - Policy ID
   * @returns True if unregistered, false if not found
   */
  public unregister(id: string): boolean {
    return this.policies.delete(id);
  }
  
  /**
   * Clear all policies
   * 
   * WARNING: This removes all registered policies!
   */
  public clear(): void {
    this.policies.clear();
  }
  
  /**
   * Get registry statistics
   * 
   * @returns Statistics about registered policies
   */
  public getStatistics(): RegistryStatistics {
    const policies = Array.from(this.policies.values());
    
    // Count by domain
    const byDomain: Record<string, number> = {};
    policies.forEach(p => {
      byDomain[p.metadata.domain] = (byDomain[p.metadata.domain] || 0) + 1;
    });
    
    // Count by category
    const byCategory: Record<string, number> = {};
    policies.forEach(p => {
      byCategory[p.metadata.category] = (byCategory[p.metadata.category] || 0) + 1;
    });
    
    // Count by status
    const byStatus: Record<PolicyMetadata['status'], number> = {
      active: 0,
      deprecated: 0,
      experimental: 0,
    };
    policies.forEach(p => {
      byStatus[p.metadata.status]++;
    });
    
    return {
      totalPolicies: policies.length,
      byDomain,
      byCategory,
      byStatus,
    };
  }
  
  /**
   * Validate policy metadata
   * 
   * @param metadata - Metadata to validate
   * @throws Error if metadata is invalid
   */
  private validateMetadata(metadata: PolicyMetadata): void {
    // Required fields
    if (!metadata.id) throw new Error('Policy ID is required');
    if (!metadata.name) throw new Error('Policy name is required');
    if (!metadata.version) throw new Error('Policy version is required');
    if (!metadata.domain) throw new Error('Policy domain is required');
    if (!metadata.category) throw new Error('Policy category is required');
    if (!metadata.decisionType) throw new Error('Policy decisionType is required');
    if (!metadata.className) throw new Error('Policy className is required');
    
    // Version format (basic semver check)
    if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      throw new Error(`Invalid version format: ${metadata.version}. Use semver (e.g., 1.0.0)`);
    }
  }
}

/**
 * Helper function to get registry instance
 * 
 * Convenience wrapper around PolicyRegistry.getInstance()
 */
export function getRegistry(): PolicyRegistry {
  return PolicyRegistry.getInstance();
}
