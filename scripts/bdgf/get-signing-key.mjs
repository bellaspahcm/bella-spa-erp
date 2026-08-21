#!/usr/bin/env node
/**
 * BDGF Signing Key Management
 * 
 * Abstraction layer for GATE_SIGNING_KEY retrieval.
 * Supports multiple backends with automatic fallback.
 * 
 * Priority Order:
 * 1. AWS Secrets Manager (production)
 * 2. Environment variable from secrets manager (GATE_SIGNING_KEY_FROM_SECRETS_MANAGER)
 * 3. .env file (development only, with warning)
 * 
 * Architecture Proof Week - Day 2
 * Stream A: BDGF Productionization
 */

import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const SECRETS_MANAGER_CONFIG = {
  enabled: process.env.BDGF_USE_SECRETS_MANAGER === 'true',
  backend: process.env.SECRETS_MANAGER_BACKEND || 'aws', // 'aws' | 'vault' | 'azure' | 'gcp'
  
  // AWS Secrets Manager
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    secretId: process.env.AWS_SECRET_ID || 'bdgf/gate-signing-key'
  },
  
  // Cache configuration
  cache: {
    enabled: process.env.SECRETS_CACHE_ENABLED !== 'false', // default true
    ttl: parseInt(process.env.SECRETS_CACHE_TTL || '300', 10) // 5 minutes default
  }
};

// In-memory cache (simple for MVP)
let cachedKey = null;
let cacheTimestamp = null;

// ============================================================================
// AWS SECRETS MANAGER BACKEND
// ============================================================================

/**
 * Retrieve signing key from AWS Secrets Manager
 * 
 * @returns {Promise<string>} Signing key
 * @throws {Error} If retrieval fails
 */
async function getFromAWSSecretsManager() {
  try {
    // Dynamic import (only load if AWS backend is used)
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    
    const client = new SecretsManagerClient({
      region: SECRETS_MANAGER_CONFIG.aws.region
    });
    
    const command = new GetSecretValueCommand({
      SecretId: SECRETS_MANAGER_CONFIG.aws.secretId
    });
    
    const response = await client.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }
    
    // Secret might be stored as JSON or plain string
    try {
      const parsed = JSON.parse(response.SecretString);
      // If JSON, expect { "key": "value" } or { "GATE_SIGNING_KEY": "value" }
      return parsed.key || parsed.GATE_SIGNING_KEY || parsed.value;
    } catch {
      // Plain string format
      return response.SecretString;
    }
    
  } catch (error) {
    throw new Error(`AWS Secrets Manager retrieval failed: ${error.message}`);
  }
}

// ============================================================================
// HASHICORP VAULT BACKEND
// ============================================================================

/**
 * Retrieve signing key from HashiCorp Vault
 * 
 * @returns {Promise<string>} Signing key
 * @throws {Error} If retrieval fails
 */
async function getFromVault() {
  try {
    const vaultAddr = process.env.VAULT_ADDR;
    const vaultToken = process.env.VAULT_TOKEN;
    const vaultPath = process.env.VAULT_SECRET_PATH || 'secret/data/bdgf/gate-signing-key';
    
    if (!vaultAddr || !vaultToken) {
      throw new Error('VAULT_ADDR and VAULT_TOKEN must be set');
    }
    
    // Dynamic import
    const vault = await import('node-vault');
    const client = vault.default({
      endpoint: vaultAddr,
      token: vaultToken
    });
    
    const result = await client.read(vaultPath);
    
    if (!result?.data?.data?.key) {
      throw new Error('Vault secret does not contain "key" field');
    }
    
    return result.data.data.key;
    
  } catch (error) {
    throw new Error(`Vault retrieval failed: ${error.message}`);
  }
}

// ============================================================================
// ENVIRONMENT VARIABLE BACKEND (Development)
// ============================================================================

/**
 * Retrieve signing key from environment variables
 * 
 * Priority:
 * 1. GATE_SIGNING_KEY_FROM_SECRETS_MANAGER (injected by secrets manager)
 * 2. GATE_SIGNING_KEY (from .env, development only)
 * 
 * @returns {string} Signing key
 * @throws {Error} If not configured
 */
function getFromEnvironment() {
  // Check for injected secret (e.g., from k8s secrets, ECS task definition)
  const injectedKey = process.env.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER;
  if (injectedKey) {
    console.log('✅ Using GATE_SIGNING_KEY_FROM_SECRETS_MANAGER');
    return injectedKey;
  }
  
  // Fallback to .env (development only)
  const envKey = process.env.GATE_SIGNING_KEY;
  if (envKey) {
    console.warn('⚠️  WARNING: Using GATE_SIGNING_KEY from .env (development only)');
    console.warn('⚠️  Production MUST use secrets manager');
    console.warn('⚠️  Set BDGF_USE_SECRETS_MANAGER=true for production');
    return envKey;
  }
  
  throw new Error(
    'GATE_SIGNING_KEY not configured. ' +
    'Set GATE_SIGNING_KEY in .env (dev) or enable secrets manager (prod)'
  );
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Check if cached key is still valid
 * 
 * @returns {string|null} Cached key if valid, null otherwise
 */
function getCachedKey() {
  if (!SECRETS_MANAGER_CONFIG.cache.enabled) {
    return null;
  }
  
  if (!cachedKey || !cacheTimestamp) {
    return null;
  }
  
  const now = Date.now();
  const age = (now - cacheTimestamp) / 1000; // seconds
  
  if (age > SECRETS_MANAGER_CONFIG.cache.ttl) {
    // Cache expired
    cachedKey = null;
    cacheTimestamp = null;
    return null;
  }
  
  return cachedKey;
}

/**
 * Update cache with new key
 * 
 * @param {string} key 
 */
function setCachedKey(key) {
  if (!SECRETS_MANAGER_CONFIG.cache.enabled) {
    return;
  }
  
  cachedKey = key;
  cacheTimestamp = Date.now();
}

/**
 * Clear cache (useful for testing or key rotation)
 */
function clearCache() {
  cachedKey = null;
  cacheTimestamp = null;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Get GATE_SIGNING_KEY from configured backend
 * 
 * Automatic backend selection:
 * - If BDGF_USE_SECRETS_MANAGER=true → use secrets manager
 * - Otherwise → use environment variables
 * 
 * Caching:
 * - Keys are cached for 5 minutes by default (configurable)
 * - Reduces secrets manager API calls
 * - Cache can be disabled with SECRETS_CACHE_ENABLED=false
 * 
 * @returns {Promise<string>} Signing key
 * @throws {Error} If retrieval fails
 * 
 * @example
 * // Development (.env)
 * const key = await getSigningKey();
 * 
 * @example
 * // Production (AWS Secrets Manager)
 * // Set: BDGF_USE_SECRETS_MANAGER=true
 * // Set: AWS_REGION=us-east-1
 * const key = await getSigningKey();
 */
async function getSigningKey() {
  // Check cache first
  const cached = getCachedKey();
  if (cached) {
    return cached;
  }
  
  let key;
  
  // Retrieve from configured backend
  if (SECRETS_MANAGER_CONFIG.enabled) {
    // Secrets manager backend
    const backend = SECRETS_MANAGER_CONFIG.backend;
    
    try {
      switch (backend) {
        case 'aws':
          console.log('🔐 Retrieving signing key from AWS Secrets Manager...');
          key = await getFromAWSSecretsManager();
          console.log('✅ Signing key retrieved from AWS Secrets Manager');
          break;
          
        case 'vault':
          console.log('🔐 Retrieving signing key from HashiCorp Vault...');
          key = await getFromVault();
          console.log('✅ Signing key retrieved from Vault');
          break;
          
        case 'azure':
          throw new Error('Azure Key Vault backend not yet implemented');
          
        case 'gcp':
          throw new Error('Google Secret Manager backend not yet implemented');
          
        default:
          throw new Error(`Unknown secrets manager backend: ${backend}`);
      }
    } catch (error) {
      // Fail closed: do NOT fallback to .env if secrets manager is explicitly enabled
      throw new Error(
        `Secrets manager retrieval failed (backend: ${backend}): ${error.message}. ` +
        'Production mode requires secrets manager. Set BDGF_USE_SECRETS_MANAGER=false for development.'
      );
    }
  } else {
    // Environment variable backend (development)
    key = getFromEnvironment();
  }
  
  // Validate key format
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid signing key: must be non-empty string');
  }
  
  if (key.length < 32) {
    throw new Error('Invalid signing key: must be at least 32 characters (256 bits recommended)');
  }
  
  // Store in cache
  setCachedKey(key);
  
  return key;
}

/**
 * Synchronous version for backwards compatibility
 * 
 * Only works with environment variables (not secrets manager).
 * Use getSigningKey() async version for production.
 * 
 * @returns {string} Signing key
 * @throws {Error} If secrets manager is enabled or key not found
 * @deprecated Use getSigningKey() async version
 */
function getSigningKeySync() {
  if (SECRETS_MANAGER_CONFIG.enabled) {
    throw new Error(
      'Cannot use getSigningKeySync() when secrets manager is enabled. ' +
      'Use async getSigningKey() instead.'
    );
  }
  
  return getFromEnvironment();
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check for secrets management configuration
 * 
 * Verifies:
 * - Key can be retrieved
 * - Key meets minimum security requirements
 * - Secrets manager connectivity (if enabled)
 * 
 * @returns {Promise<{healthy: boolean, backend: string, checks: Object}>}
 */
async function healthCheck() {
  const checks = {
    backend_configured: false,
    key_retrievable: false,
    key_valid_format: false,
    key_sufficient_length: false,
    secrets_manager_reachable: false
  };
  
  let backend = 'unknown';
  let error = null;
  
  try {
    // Determine backend
    if (SECRETS_MANAGER_CONFIG.enabled) {
      backend = SECRETS_MANAGER_CONFIG.backend;
      checks.backend_configured = true;
    } else {
      backend = 'environment';
      checks.backend_configured = true;
    }
    
    // Try to retrieve key
    const key = await getSigningKey();
    checks.key_retrievable = true;
    
    // Validate format
    if (typeof key === 'string' && key.length > 0) {
      checks.key_valid_format = true;
    }
    
    // Check length
    if (key.length >= 32) {
      checks.key_sufficient_length = true;
    }
    
    // If secrets manager, mark as reachable
    if (SECRETS_MANAGER_CONFIG.enabled) {
      checks.secrets_manager_reachable = true;
    }
    
  } catch (err) {
    error = err.message;
  }
  
  const healthy = Object.values(checks).every(check => check === true);
  
  return {
    healthy,
    backend,
    checks,
    error,
    cache_enabled: SECRETS_MANAGER_CONFIG.cache.enabled,
    cache_ttl: SECRETS_MANAGER_CONFIG.cache.ttl
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  getSigningKey,
  getSigningKeySync,
  healthCheck,
  clearCache,
  SECRETS_MANAGER_CONFIG
};

export default getSigningKey;
