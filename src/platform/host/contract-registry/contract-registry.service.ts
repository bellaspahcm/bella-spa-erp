/**
 * Contract Registry Service
 * 
 * Manages API contracts, event schemas, and versioning for the platform.
 * Enforces Constitution Law 8 (Registry-First & ADR).
 * 
 * Key Responsibilities:
 * - Contract registration and discovery
 * - Contract versioning and compatibility checks
 * - Runtime contract validation
 * - Deprecation management
 * 
 * @module platform/host/contract-registry
 */

import type {
  ContractMetadata,
  ContractType,
  ContractStatus,
  ContractQueryFilter,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SchemaDefinition,
  JSONSchema,
  EndpointDefinition,
  EventDefinition,
} from './types';

/**
 * Contract Registry Service
 * 
 * Singleton service managing all platform contracts.
 * Thread-safe in-memory registry with optional persistence.
 */
export class ContractRegistryService {
  private contracts: Map<string, Map<string, ContractMetadata>>;
  private schemas: Map<string, SchemaDefinition>;
  private static instance: ContractRegistryService;

  private constructor() {
    this.contracts = new Map();
    this.schemas = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ContractRegistryService {
    if (!ContractRegistryService.instance) {
      ContractRegistryService.instance = new ContractRegistryService();
    }
    return ContractRegistryService.instance;
  }

  /**
   * Clear all registered contracts and schemas (mainly for testing)
   */
  public clear(): void {
    this.contracts.clear();
    this.schemas.clear();
  }

  // ==========================================================================
  // Contract Registration
  // ==========================================================================

  /**
   * Register a new contract
   * 
   * @param contract - Contract metadata to register
   * @throws Error if contract already exists with same version
   */
  public registerContract(contract: ContractMetadata): void {
    const key = this.getContractKey(contract.name, contract.version);
    
    // Check if contract already exists
    if (this.contracts.has(contract.name)) {
      const versions = this.contracts.get(contract.name)!;
      if (versions.has(contract.version)) {
        throw new Error(
          `Contract ${contract.name}@${contract.version} already registered`
        );
      }
    }

    // Validate contract metadata
    this.validateContractMetadata(contract);

    // Register schemas if provided
    if (contract.schemas) {
      for (const schema of contract.schemas) {
        this.registerSchema(schema);
      }
    }

    // Store contract
    if (!this.contracts.has(contract.name)) {
      this.contracts.set(contract.name, new Map());
    }
    this.contracts.get(contract.name)!.set(contract.version, {
      ...contract,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`[ContractRegistry] Registered: ${key}`);
  }

  /**
   * Update an existing contract
   * 
   * @param name - Contract name
   * @param version - Contract version
   * @param updates - Partial contract updates
   */
  public updateContract(
    name: string,
    version: string,
    updates: Partial<ContractMetadata>
  ): void {
    const contract = this.getContract(name, version);
    if (!contract) {
      throw new Error(`Contract ${name}@${version} not found`);
    }

    // Merge updates
    const updated: ContractMetadata = {
      ...contract,
      ...updates,
      name, // Immutable
      version, // Immutable
      registeredAt: contract.registeredAt, // Immutable
      updatedAt: new Date().toISOString(),
    };

    this.contracts.get(name)!.set(version, updated);
    console.log(`[ContractRegistry] Updated: ${name}@${version}`);
  }

  // ==========================================================================
  // Contract Retrieval
  // ==========================================================================

  /**
   * Get a specific contract by name and version
   * 
   * @param name - Contract name
   * @param version - Contract version (exact match)
   * @returns Contract metadata or undefined if not found
   */
  public getContract(name: string, version: string): ContractMetadata | undefined {
    const versions = this.contracts.get(name);
    if (!versions) {
      return undefined;
    }
    return versions.get(version);
  }

  /**
   * Get all versions of a contract
   * 
   * @param name - Contract name
   * @returns Array of contract metadata for all versions
   */
  public getContractVersions(name: string): ContractMetadata[] {
    const versions = this.contracts.get(name);
    if (!versions) {
      return [];
    }
    return Array.from(versions.values());
  }

  /**
   * Get latest version of a contract
   * 
   * @param name - Contract name
   * @returns Latest contract metadata or undefined if not found
   */
  public getLatestContract(name: string): ContractMetadata | undefined {
    const versions = this.getContractVersions(name);
    if (versions.length === 0) {
      return undefined;
    }

    // Sort by version (semantic versioning)
    const sorted = versions.sort((a, b) => {
      return this.compareVersions(b.version, a.version); // Descending
    });

    return sorted[0];
  }

  /**
   * Query contracts by filters
   * 
   * @param filter - Query filter
   * @returns Array of matching contracts
   */
  public queryContracts(filter: ContractQueryFilter): ContractMetadata[] {
    const results: ContractMetadata[] = [];

    for (const versions of this.contracts.values()) {
      for (const contract of versions.values()) {
        if (this.matchesFilter(contract, filter)) {
          results.push(contract);
        }
      }
    }

    return results;
  }

  /**
   * Get all registered contracts
   * 
   * @returns Array of all contracts
   */
  public getAllContracts(): ContractMetadata[] {
    const results: ContractMetadata[] = [];
    for (const versions of this.contracts.values()) {
      results.push(...versions.values());
    }
    return results;
  }

  // ==========================================================================
  // Contract Validation
  // ==========================================================================

  /**
   * Validate data against a contract endpoint schema
   * 
   * @param contractName - Contract name
   * @param version - Contract version
   * @param endpointPath - Endpoint path
   * @param method - HTTP method
   * @param data - Data to validate (request or response)
   * @param type - 'request' or 'response'
   * @returns Validation result
   */
  public validateEndpoint(
    contractName: string,
    version: string,
    endpointPath: string,
    method: string,
    data: unknown,
    type: 'request' | 'response'
  ): ValidationResult {
    const contract = this.getContract(contractName, version);
    if (!contract) {
      return {
        valid: false,
        errors: [{
          path: '$',
          message: `Contract ${contractName}@${version} not found`,
          expected: 'registered contract',
          actual: 'not found',
        }],
        warnings: [],
      };
    }

    // Find endpoint definition
    const endpoint = contract.endpoints?.find(
      (e) => e.path === endpointPath && e.method === method
    );

    if (!endpoint) {
      return {
        valid: false,
        errors: [{
          path: '$',
          message: `Endpoint ${method} ${endpointPath} not found in contract`,
          expected: 'registered endpoint',
          actual: 'not found',
        }],
        warnings: [],
      };
    }

    // Get schema reference
    const schemaRef = type === 'request' 
      ? endpoint.requestSchema 
      : endpoint.responseSchema;

    // Validate against schema
    return this.validateAgainstSchema(data, schemaRef);
  }

  /**
   * Validate event payload against event schema
   * 
   * @param contractName - Contract name
   * @param version - Contract version
   * @param eventType - Event type
   * @param payload - Event payload to validate
   * @returns Validation result
   */
  public validateEvent(
    contractName: string,
    version: string,
    eventType: string,
    payload: unknown
  ): ValidationResult {
    const contract = this.getContract(contractName, version);
    if (!contract) {
      return {
        valid: false,
        errors: [{
          path: '$',
          message: `Contract ${contractName}@${version} not found`,
          expected: 'registered contract',
          actual: 'not found',
        }],
        warnings: [],
      };
    }

    // Find event definition
    const event = contract.events?.find((e) => e.eventType === eventType);
    if (!event) {
      return {
        valid: false,
        errors: [{
          path: '$',
          message: `Event ${eventType} not found in contract`,
          expected: 'registered event',
          actual: 'not found',
        }],
        warnings: [],
      };
    }

    // Validate against schema
    return this.validateAgainstSchema(payload, event.payloadSchema);
  }

  // ==========================================================================
  // Schema Management
  // ==========================================================================

  /**
   * Register a schema definition
   * 
   * @param schema - Schema definition
   */
  public registerSchema(schema: SchemaDefinition): void {
    const key = `${schema.schemaId}@${schema.version}`;
    if (this.schemas.has(key)) {
      console.warn(`[ContractRegistry] Schema ${key} already registered, skipping`);
      return;
    }

    this.schemas.set(key, {
      ...schema,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`[ContractRegistry] Registered schema: ${key}`);
  }

  /**
   * Get a schema definition
   * 
   * @param schemaId - Schema identifier
   * @param version - Schema version
   * @returns Schema definition or undefined if not found
   */
  public getSchema(schemaId: string, version: string): SchemaDefinition | undefined {
    const key = `${schemaId}@${version}`;
    return this.schemas.get(key);
  }

  // ==========================================================================
  // Contract Deprecation
  // ==========================================================================

  /**
   * Mark a contract as deprecated
   * 
   * @param name - Contract name
   * @param version - Contract version
   * @param reason - Deprecation reason
   * @param retirementDate - Optional retirement date
   */
  public deprecateContract(
    name: string,
    version: string,
    reason: string,
    retirementDate?: string
  ): void {
    const contract = this.getContract(name, version);
    if (!contract) {
      throw new Error(`Contract ${name}@${version} not found`);
    }

    this.updateContract(name, version, {
      status: 'deprecated',
      deprecation: {
        deprecatedSince: new Date().toISOString(),
        retirementDate,
        reason,
      },
    });

    console.warn(`[ContractRegistry] Deprecated: ${name}@${version} - ${reason}`);
  }

  /**
   * Retire a contract (final removal)
   * 
   * @param name - Contract name
   * @param version - Contract version
   */
  public retireContract(name: string, version: string): void {
    const contract = this.getContract(name, version);
    if (!contract) {
      throw new Error(`Contract ${name}@${version} not found`);
    }

    this.updateContract(name, version, {
      status: 'retired',
    });

    console.warn(`[ContractRegistry] Retired: ${name}@${version}`);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private getContractKey(name: string, version: string): string {
    return `${name}@${version}`;
  }

  private validateContractMetadata(contract: ContractMetadata): void {
    if (!contract.name || contract.name.trim() === '') {
      throw new Error('Contract name is required');
    }
    if (!contract.version || !this.isValidVersion(contract.version)) {
      throw new Error(`Invalid contract version: ${contract.version}`);
    }
    if (!contract.description) {
      throw new Error('Contract description is required');
    }
  }

  private isValidVersion(version: string): boolean {
    // Simple semver validation (x.y.z)
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
  }

  private matchesFilter(contract: ContractMetadata, filter: ContractQueryFilter): boolean {
    if (filter.name && contract.name !== filter.name) return false;
    if (filter.type && contract.type !== filter.type) return false;
    if (filter.status && contract.status !== filter.status) return false;
    if (filter.version && contract.version !== filter.version) return false;
    if (filter.owner && contract.owner !== filter.owner) return false;
    return true;
  }

  private validateAgainstSchema(
    data: unknown,
    schemaRef: { schemaId: string; version: string; schema?: JSONSchema }
  ): ValidationResult {
    // Get schema (inline or from registry)
    const schema = schemaRef.schema || this.getSchema(schemaRef.schemaId, schemaRef.version)?.schema;
    
    if (!schema) {
      return {
        valid: false,
        errors: [{
          path: '$',
          message: `Schema ${schemaRef.schemaId}@${schemaRef.version} not found`,
          expected: 'registered schema',
          actual: 'not found',
        }],
        warnings: [],
      };
    }

    // Basic validation (simplified JSON Schema validation)
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateValue(data, schema, '$', errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateValue(
    value: unknown,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Type validation
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actualType = this.getType(value);
      
      if (!types.includes(actualType)) {
        errors.push({
          path,
          message: `Type mismatch`,
          expected: types.join(' | '),
          actual: actualType,
          schemaRule: 'type',
        });
        return; // Skip further validation if type is wrong
      }
    }

    // Object validation
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;

      // Required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in obj)) {
            errors.push({
              path: `${path}.${prop}`,
              message: `Required property missing`,
              expected: 'property to exist',
              actual: 'undefined',
              schemaRule: 'required',
            });
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in obj) {
            this.validateValue(obj[prop], propSchema, `${path}.${prop}`, errors, warnings);
          }
        }
      }
    }

    // String validation
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          path,
          message: `String too short`,
          expected: `>= ${schema.minLength} characters`,
          actual: `${value.length} characters`,
          schemaRule: 'minLength',
        });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          path,
          message: `String too long`,
          expected: `<= ${schema.maxLength} characters`,
          actual: `${value.length} characters`,
          schemaRule: 'maxLength',
        });
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push({
          path,
          message: `String does not match pattern`,
          expected: schema.pattern,
          actual: value,
          schemaRule: 'pattern',
        });
      }
    }

    // Number validation
    if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          path,
          message: `Number too small`,
          expected: `>= ${schema.minimum}`,
          actual: value,
          schemaRule: 'minimum',
        });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          path,
          message: `Number too large`,
          expected: `<= ${schema.maximum}`,
          actual: value,
          schemaRule: 'maximum',
        });
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push({
          path,
          message: `Array too short`,
          expected: `>= ${schema.minItems} items`,
          actual: `${value.length} items`,
          schemaRule: 'minItems',
        });
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push({
          path,
          message: `Array too long`,
          expected: `<= ${schema.maxItems} items`,
          actual: `${value.length} items`,
          schemaRule: 'maxItems',
        });
      }
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(item, schema.items!, `${path}[${index}]`, errors, warnings);
        });
      }
    }
  }

  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

// Export singleton instance
export const contractRegistry = ContractRegistryService.getInstance();
