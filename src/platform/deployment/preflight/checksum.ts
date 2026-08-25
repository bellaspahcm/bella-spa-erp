/**
 * G2: Checksum Validation
 * 
 * Validates migration file integrity:
 * - SHA-256 checksum of SQL file
 * - Detects tampering or accidental modification
 * - Ensures what's deployed matches what was reviewed
 */

import type { Migration, PreflightResult, ValidationFailure } from '../types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export async function validateChecksum(migration: Migration): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  // Check 1: Checksum is provided
  if (!migration.checksum || migration.checksum.trim() === '') {
    failures.push({
      gate: 'G2_CHECKSUM',
      reason: 'Migration checksum is missing',
      severity: 'ERROR',
      recommendation: 'Calculate SHA-256 checksum of migration SQL file before deployment'
    });
    
    return {
      pass: false,
      gate: 'G2_CHECKSUM',
      failures,
      timestamp: new Date()
    };
  }
  
  // Check 2: Checksum format (SHA-256 is 64 hex chars)
  const checksumPattern = /^[a-f0-9]{64}$/i;
  if (!checksumPattern.test(migration.checksum)) {
    failures.push({
      gate: 'G2_CHECKSUM',
      reason: `Invalid checksum format: '${migration.checksum}'. Expected 64 hex characters (SHA-256)`,
      severity: 'ERROR',
      recommendation: 'Use SHA-256 hash algorithm for checksum'
    });
  }
  
  // Check 3: Calculate actual checksum from file
  const migrationDir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationDir);
  const matchingFile = files.find(f => f.startsWith(migration.version));
  
  if (!matchingFile) {
    failures.push({
      gate: 'G2_CHECKSUM',
      reason: `Cannot verify checksum: migration file not found for version ${migration.version}`,
      severity: 'ERROR',
      recommendation: 'Migration file must exist in Git'
    });
    
    return {
      pass: false,
      gate: 'G2_CHECKSUM',
      failures,
      timestamp: new Date()
    };
  }
  
  const filePath = path.join(migrationDir, matchingFile);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const actualChecksum = crypto
    .createHash('sha256')
    .update(fileContent)
    .digest('hex');
  
  // Check 4: Checksum matches
  if (actualChecksum.toLowerCase() !== migration.checksum.toLowerCase()) {
    failures.push({
      gate: 'G2_CHECKSUM',
      reason: `Checksum mismatch detected.\n` +
              `  Expected: ${migration.checksum}\n` +
              `  Actual:   ${actualChecksum}\n` +
              `  This indicates the migration file has been modified after checksum calculation.`,
      severity: 'ERROR',
      recommendation: 'Do NOT deploy. Investigate file modification. Recalculate checksum if change was intentional and reviewed.'
    });
  }
  
  return {
    pass: failures.length === 0,
    gate: 'G2_CHECKSUM',
    failures,
    timestamp: new Date()
  };
}

/**
 * Calculate checksum for a migration file
 * Utility function for migration preparation
 */
export function calculateChecksum(sqlFilePath: string): string {
  const content = fs.readFileSync(sqlFilePath, 'utf-8');
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}
