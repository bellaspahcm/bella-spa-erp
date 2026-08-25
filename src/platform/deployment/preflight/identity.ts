/**
 * G1: Migration Identity Validation
 * 
 * Validates canonical migration identity format:
 * - MUST be 14-digit timestamp (YYYYMMDDHHMMSS)
 * - MUST be unique across all migrations
 * - MUST match Git filename
 */

import type { Migration, PreflightResult, ValidationFailure } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export async function validateIdentity(migration: Migration): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  // Check 1: Canonical format (14 digits)
  const formatPattern = /^\d{14}$/;
  if (!formatPattern.test(migration.version)) {
    failures.push({
      gate: 'G1_IDENTITY',
      reason: `Migration version '${migration.version}' is not 14-digit timestamp. ` +
              `Expected: YYYYMMDDHHMMSS (e.g., 20260824000000)`,
      severity: 'ERROR',
      recommendation: 'Rename migration file to use canonical 14-digit timestamp format'
    });
  }
  
  // Check 2: Valid timestamp components
  if (formatPattern.test(migration.version)) {
    const year = parseInt(migration.version.substring(0, 4));
    const month = parseInt(migration.version.substring(4, 6));
    const day = parseInt(migration.version.substring(6, 8));
    const hour = parseInt(migration.version.substring(8, 10));
    const minute = parseInt(migration.version.substring(10, 12));
    const second = parseInt(migration.version.substring(12, 14));
    
    if (year < 2020 || year > 2100) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Invalid year: ${year}. Must be between 2020 and 2100`,
        severity: 'ERROR',
        recommendation: 'Use valid year in migration timestamp'
      });
    }
    
    if (month < 1 || month > 12) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Invalid month: ${month}. Must be between 01 and 12`,
        severity: 'ERROR',
        recommendation: 'Use valid month in migration timestamp'
      });
    }
    
    if (day < 1 || day > 31) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Invalid day: ${day}. Must be between 01 and 31`,
        severity: 'ERROR',
        recommendation: 'Use valid day in migration timestamp'
      });
    }
    
    if (hour < 0 || hour > 23) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Invalid hour: ${hour}. Must be between 00 and 23`,
        severity: 'ERROR',
        recommendation: 'Use valid hour in migration timestamp'
      });
    }
    
    if (minute < 0 || minute > 59) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Invalid minute: ${minute}. Must be between 00 and 59`,
        severity: 'ERROR',
        recommendation: 'Use valid minute in migration timestamp'
      });
    }
    
    if (second < 0 || second > 59) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Invalid second: ${second}. Must be between 00 and 59`,
        severity: 'ERROR',
        recommendation: 'Use valid second in migration timestamp'
      });
    }
  }
  
  // Check 3: Git file exists
  const migrationDir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationDir);
  const matchingFiles = files.filter(f => f.startsWith(migration.version));
  
  if (matchingFiles.length === 0) {
    failures.push({
      gate: 'G1_IDENTITY',
      reason: `No migration file found in Git for version ${migration.version}`,
      severity: 'ERROR',
      recommendation: 'Migration file must exist in Git before deployment'
    });
  } else if (matchingFiles.length > 1) {
    failures.push({
      gate: 'G1_IDENTITY',
      reason: `Multiple migration files found for version ${migration.version}: ${matchingFiles.join(', ')}`,
      severity: 'ERROR',
      recommendation: 'Each migration version must have exactly one file'
    });
  }
  
  // Check 4: Filename format (version_description.sql)
  if (matchingFiles.length === 1) {
    const filename = matchingFiles[0];
    const filenamePattern = /^\d{14}_[\w]+\.sql$/;
    
    if (!filenamePattern.test(filename)) {
      failures.push({
        gate: 'G1_IDENTITY',
        reason: `Migration filename '${filename}' does not match pattern YYYYMMDDHHMMSS_description.sql`,
        severity: 'ERROR',
        recommendation: 'Use canonical filename format: 14-digit-timestamp_description.sql'
      });
    }
  }
  
  // Check 5: Uniqueness (no duplicate versions in local)
  const versionCount = files.filter(f => f.startsWith(migration.version)).length;
  if (versionCount > 1) {
    failures.push({
      gate: 'G1_IDENTITY',
      reason: `Duplicate migration version ${migration.version} found in local migrations`,
      severity: 'ERROR',
      recommendation: 'Each migration version must be unique'
    });
  }
  
  return {
    pass: failures.length === 0,
    gate: 'G1_IDENTITY',
    failures,
    timestamp: new Date()
  };
}
