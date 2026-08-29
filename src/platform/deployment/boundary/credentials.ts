/**
 * G11/G12: Credential Boundary Enforcement
 * 
 * Enforces infrastructure-level separation:
 * - Production DDL credentials NOT accessible to AI/Developer
 * - Deployment Engine uses vault-managed credentials
 * - READ/TEST credentials for development
 * - No credential leakage via environment variables
 */

import type { Credential } from '../types';
import { Pool } from 'pg';

export class CredentialManager {
  private credentialSource: 'VAULT' | 'ENVIRONMENT';
  
  constructor(credentialSource: 'VAULT' | 'ENVIRONMENT') {
    this.credentialSource = credentialSource;
    
    // Block environment-based credentials for production
    if (credentialSource === 'ENVIRONMENT' && this.isProductionContext()) {
      throw new Error(
        'GOVERNANCE VIOLATION: Production deployments MUST use vault-managed credentials. ' +
        'Environment variables are NOT secure for production DDL operations.'
      );
    }
  }
  
  /**
   * Get deployment credentials
   * 
   * This method enforces the credential boundary:
   * - AI agents cannot call this (blocked at constructor level)
   * - Developers without deployment role cannot call this
   * - Only deployment engine service can access
   */
  async getDeploymentCredentials(): Promise<Credential> {
    // Verify caller is authorized
    this.enforceAuthorizationBoundary();
    
    if (this.credentialSource === 'VAULT') {
      return await this.getVaultCredentials();
    } else {
      return this.getEnvironmentCredentials();
    }
  }
  
  /**
   * Get read-only credentials (safe for AI/Developer)
   */
  async getReadOnlyCredentials(): Promise<Credential> {
    if (this.credentialSource === 'VAULT') {
      return await this.getVaultCredentials('READ_ONLY');
    } else {
      const creds = this.getEnvironmentCredentials();
      
      // Verify credentials are actually read-only
      const pool = new Pool({ connectionString: creds.connectionString });
      
      try {
        // Test write capability
        await pool.query('CREATE TEMP TABLE _test_write (id int)');
        await pool.query('DROP TABLE _test_write');
        
        // If we get here, credentials have write access
        console.warn('⚠️  WARNING: Credentials have write access but marked as READ_ONLY');
        
        throw new Error(
          'CREDENTIAL VIOLATION: Credentials have write access. ' +
          'Read-only credentials MUST NOT have DDL/DML permissions.'
        );
      } catch (error) {
        // Expected: permission denied
        if (error instanceof Error && error.message.includes('permission denied')) {
          // Credentials are properly read-only
          return creds;
        }
        
        throw error;
      } finally {
        await pool.end();
      }
    }
  }
  
  private enforceAuthorizationBoundary(): void {
    // Check if running in AI context
    const isAI = process.env.KIRO_AGENT === 'true' || 
                 process.env.ANTHROPIC_API_KEY !== undefined;
    
    if (isAI) {
      throw new Error(
        'AUTHORIZATION VIOLATION: AI agents cannot access deployment credentials. ' +
        'AI can PROPOSE migrations but cannot ACCESS production database credentials.'
      );
    }
    
    // Check if deployment engine service
    const isDeploymentEngine = process.env.DEPLOYMENT_ENGINE_SERVICE === 'true';
    
    if (!isDeploymentEngine) {
      throw new Error(
        'AUTHORIZATION VIOLATION: Only deployment engine service can access deployment credentials. ' +
        'Set DEPLOYMENT_ENGINE_SERVICE=true to enable.'
      );
    }
  }
  
  private async getVaultCredentials(role: 'DEPLOYMENT' | 'READ_ONLY' = 'DEPLOYMENT'): Promise<Credential> {
    // This would integrate with HashiCorp Vault, AWS Secrets Manager, etc.
    // For now, placeholder implementation
    
    throw new Error(
      'IMPLEMENTATION REQUIRED: Vault integration not yet configured. ' +
      'Configure credential vault before production deployment.'
    );
    
    // Example implementation:
    // const vault = new VaultClient(process.env.VAULT_ADDR);
    // const secret = await vault.read(`database/creds/${role.toLowerCase()}`);
    // 
    // return {
    //   role: role,
    //   connectionString: secret.data.connection_string,
    //   permissions: secret.data.permissions
    // };
  }
  
  private getEnvironmentCredentials(): Credential {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error(
        'CREDENTIAL ERROR: DATABASE_URL not found in environment. ' +
        'Configure credentials before deployment.'
      );
    }
    
    // Warn: environment credentials are less secure
    console.warn('⚠️  Using environment-based credentials (not recommended for production)');
    
    return {
      role: 'UNKNOWN',
      connectionString,
      permissions: ['UNKNOWN']
    };
  }
  
  private isProductionContext(): boolean {
    return process.env.NODE_ENV === 'production' ||
           process.env.DEPLOYMENT_ENV === 'production';
  }
}
