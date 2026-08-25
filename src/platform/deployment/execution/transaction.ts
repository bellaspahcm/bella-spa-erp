/**
 * Transaction Management
 * 
 * Handles transaction lifecycle for migration execution:
 * - Isolation level configuration
 * - Savepoint management
 * - Rollback on failure
 * - Lock timeout configuration
 */

import type { Pool, PoolClient } from 'pg';

export interface TransactionConfig {
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  lockTimeout?: number; // milliseconds
  statementTimeout?: number; // milliseconds
}

export class TransactionManager {
  private client: PoolClient;
  private savepoints: string[] = [];
  
  constructor(client: PoolClient) {
    this.client = client;
  }
  
  async begin(config?: TransactionConfig): Promise<void> {
    const isolationLevel = config?.isolationLevel || 'READ COMMITTED';
    
    await this.client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    
    // Set timeouts if specified
    if (config?.lockTimeout) {
      await this.client.query(`SET LOCAL lock_timeout = '${config.lockTimeout}ms'`);
    }
    
    if (config?.statementTimeout) {
      await this.client.query(`SET LOCAL statement_timeout = '${config.statementTimeout}ms'`);
    }
  }
  
  async commit(): Promise<void> {
    await this.client.query('COMMIT');
    this.savepoints = [];
  }
  
  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
    this.savepoints = [];
  }
  
  async createSavepoint(name: string): Promise<void> {
    await this.client.query(`SAVEPOINT ${name}`);
    this.savepoints.push(name);
  }
  
  async rollbackToSavepoint(name: string): Promise<void> {
    if (!this.savepoints.includes(name)) {
      throw new Error(`Savepoint '${name}' does not exist`);
    }
    
    await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    
    // Remove savepoints after this one
    const index = this.savepoints.indexOf(name);
    this.savepoints = this.savepoints.slice(0, index + 1);
  }
  
  async releaseSavepoint(name: string): Promise<void> {
    if (!this.savepoints.includes(name)) {
      throw new Error(`Savepoint '${name}' does not exist`);
    }
    
    await this.client.query(`RELEASE SAVEPOINT ${name}`);
    
    // Remove this savepoint
    const index = this.savepoints.indexOf(name);
    this.savepoints.splice(index, 1);
  }
}
