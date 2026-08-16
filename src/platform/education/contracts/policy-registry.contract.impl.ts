import { IPolicyRegistryContract, PolicyValue } from './policy-registry.contract';

// Central configuration registry. Tenant IDs are scoped only within config maps.
const POLICY_REGISTRY: Record<string, Record<string, unknown>> = {
  'tenant-standard': {
    'education.max_credits': 24,
    'education.passing_threshold': 5.0,
    'education.tuition_accounting_policy': 'standard',
  },
  'tenant-strict': {
    'education.max_credits': 18,
    'education.passing_threshold': 7.0,
    'education.tuition_accounting_policy': 'standard',
  },
  'tenant-corporate': {
    'education.max_credits': 999999, // Attempts to set unlimited credits
    'education.passing_threshold': 3.0,
    'education.tuition_accounting_policy': 'corporate',
  },
};

export class PolicyRegistryContractImpl implements IPolicyRegistryContract {
  public async getPolicy<T>(tenantId: string, key: string, requesterTenantId: string): Promise<PolicyValue<T>> {
    // Rule D: Configuration Context Isolation
    if (tenantId !== requesterTenantId) {
      throw new Error(`CONFIGURATION_CONTEXT_ISOLATION_VIOLATION: Requester tenant '${requesterTenantId}' is not authorized to access configurations for tenant '${tenantId}'.`);
    }

    const tenantConfig = POLICY_REGISTRY[tenantId];
    if (!tenantConfig) {
      throw new Error(`POLICY_NOT_FOUND: Tenant '${tenantId}' configuration is not registered.`);
    }

    const value = tenantConfig[key];
    if (value === undefined) {
      throw new Error(`POLICY_KEY_NOT_FOUND: Policy key '${key}' is not defined for tenant '${tenantId}'.`);
    }

    return {
      key,
      value: value as T,
      version: '1.0.0',
    };
  }
}
