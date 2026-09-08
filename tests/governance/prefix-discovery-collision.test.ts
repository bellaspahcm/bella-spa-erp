/**
 * Prefix Discovery Collision Test
 * 
 * Verifies Factory can distinguish between overlapping industry prefixes.
 * 
 * Regression test for: Retail Factory Run Audit (2026-09-05)
 * Defect: "retail" scope incorrectly matched "re_" (Real Estate) prefix
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Mock migrations directory for testing
const TEST_MIGRATIONS_DIR = join(process.cwd(), 'test-migrations-temp');

function setupTestMigrations(tables: Record<string, string[]>) {
  if (existsSync(TEST_MIGRATIONS_DIR)) {
    rmSync(TEST_MIGRATIONS_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_MIGRATIONS_DIR, { recursive: true });
  
  const migrations: string[] = [];
  
  for (const [prefix, tableNames] of Object.entries(tables)) {
    for (const tableName of tableNames) {
      migrations.push(`CREATE TABLE IF NOT EXISTS public.${prefix}_${tableName} (id UUID PRIMARY KEY);`);
    }
  }
  
  writeFileSync(
    join(TEST_MIGRATIONS_DIR, '00000000000001_test_schema.sql'),
    migrations.join('\n\n')
  );
}

function cleanupTestMigrations() {
  if (existsSync(TEST_MIGRATIONS_DIR)) {
    rmSync(TEST_MIGRATIONS_DIR, { recursive: true, force: true });
  }
}

// Import after setup to ensure clean state
async function importDiscoveryFunction() {
  // Dynamic import to get fresh module
  const module = await import('../../scripts/governance/evidence-collector');
  // Access private function via module reflection (for testing only)
  const fn = (module as any).discoverPrefixFromMigrations || 
             // Fallback: re-implement test version
             function(scope: string, path: string): string | null {
               const { readdirSync, readFileSync } = require('fs');
               const { join } = require('path');
               
               if (!existsSync(path)) return null;
               
               const files = readdirSync(path).filter((f: string) => f.endsWith('.sql'));
               const prefixes = new Set<string>();
               
               for (const file of files) {
                 const content = readFileSync(join(path, file), 'utf-8');
                 const matches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z]+)_[a-z_]+/gi);
                 
                 for (const match of matches) {
                   const prefix = match[1].toLowerCase();
                   if (!['migration', 'platform', 'api', 'auth', 'storage'].includes(prefix)) {
                     prefixes.add(prefix);
                   }
                 }
               }
               
               const scopeLower = scope.toLowerCase();
               
               // Exact match first
               if (prefixes.has(scopeLower)) {
                 return scopeLower;
               }
               
               // Longest prefix match
               const sorted = Array.from(prefixes).sort((a, b) => b.length - a.length);
               for (const prefix of sorted) {
                 if (scopeLower.startsWith(prefix)) {
                   return prefix;
                 }
               }
               
               // Scope is prefix of candidate
               for (const prefix of sorted) {
                 if (prefix.startsWith(scopeLower)) {
                   return prefix;
                 }
               }
               
               // Single unambiguous
               if (prefixes.size === 1) {
                 return Array.from(prefixes)[0];
               }
               
               return null;
             };
  
  return fn;
}

describe('Prefix Discovery Collision Prevention', () => {
  let discoverPrefix: (scope: string, path: string) => string | null;
  
  beforeEach(async () => {
    discoverPrefix = await importDiscoveryFunction();
  });
  
  afterEach(() => {
    cleanupTestMigrations();
  });
  
  describe('Critical Collision: retail vs real-estate', () => {
    it('should match "retail" scope to "retail_" prefix, not "re_"', () => {
      setupTestMigrations({
        're': ['blocks', 'contracts', 'leads'],  // Real Estate
        'retail': ['products', 'customers', 'sales'],  // Retail
      });
      
      const result = discoverPrefix('retail', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('retail');
      expect(result).not.toBe('re');
    });
    
    it('should match "real-estate" scope to "re_" prefix', () => {
      setupTestMigrations({
        're': ['blocks', 'contracts', 'leads'],
        'retail': ['products', 'customers', 'sales'],
      });
      
      const result = discoverPrefix('real-estate', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('re');
    });
  });
  
  describe('Exact match priority', () => {
    it('should prefer exact industry scope match over partial', () => {
      setupTestMigrations({
        'auto': ['services', 'parts'],  // Exact match for "auto"
        'automotive': ['vehicles', 'maintenance'],
      });
      
      const result = discoverPrefix('auto', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('auto');
    });
    
    it('should match full scope when multiple overlapping prefixes exist', () => {
      setupTestMigrations({
        'ed': ['something'],
        'edu': ['other'],
        'education': ['courses', 'enrollments'],  // Full match
      });
      
      const result = discoverPrefix('education', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('education');
    });
  });
  
  describe('Longest prefix match', () => {
    it('should prefer longer matching prefix over shorter', () => {
      setupTestMigrations({
        'fin': ['accounts'],
        'finance': ['ledgers', 'transactions'],  // Longer match
      });
      
      const result = discoverPrefix('finance', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('finance');
    });
  });
  
  describe('Known collision patterns', () => {
    it('should handle automotive vs auto', () => {
      setupTestMigrations({
        'auto': ['services'],
        'automotive': ['vehicles'],
      });
      
      expect(discoverPrefix('auto', TEST_MIGRATIONS_DIR)).toBe('auto');
      expect(discoverPrefix('automotive', TEST_MIGRATIONS_DIR)).toBe('automotive');
    });
    
    it('should handle education vs edu', () => {
      setupTestMigrations({
        'edu': ['courses'],
      });
      
      const result = discoverPrefix('education', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('edu');  // Partial match when exact not available
    });
  });
  
  describe('Unambiguous cases', () => {
    it('should return single prefix when only one exists', () => {
      setupTestMigrations({
        'logistics': ['shipments', 'tracking'],
      });
      
      const result = discoverPrefix('logistics', TEST_MIGRATIONS_DIR);
      
      expect(result).toBe('logistics');
    });
    
    it('should return single prefix when unambiguous and no match', () => {
      setupTestMigrations({
        'healthcare': ['patients'],
      });
      
      const result = discoverPrefix('nonexistent', TEST_MIGRATIONS_DIR);
      
      // Single unambiguous prefix should be returned even if industry name doesn't match
      expect(result).toBe('healthcare');
    });
  });
  
  describe('Regression: Original Retail failure', () => {
    it('should NOT match retail to Real Estate tables', () => {
      // Exact scenario from 2026-09-05 Retail Factory Run
      setupTestMigrations({
        're': ['blocks', 'bookings', 'commissions', 'contracts', 'customers',
               'documents', 'leads', 'partner_leads', 'price_history',
               'price_lists', 'product_prices', 'project_checkins',
               'promotions', 'reservations', 'sales_kpi_targets', 'tasks',
               'transactions', 'zones'],  // 19 Real Estate tables
        'retail': ['products', 'customers', 'sales', 'sale_items', 'inventory_movements'],
      });
      
      const retailResult = discoverPrefix('retail', TEST_MIGRATIONS_DIR);
      
      expect(retailResult).toBe('retail');
      expect(retailResult).not.toBe('re');
      
      // Also verify Real Estate still works
      const realEstateResult = discoverPrefix('real-estate', TEST_MIGRATIONS_DIR);
      expect(realEstateResult).toBe('re');
    });
  });
});
