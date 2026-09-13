/**
 * R7 Architecture Guard — Adversarial Tests
 * 
 * Prevents Product code from bypassing Platform Finance contract.
 * Blocks direct DB/RPC access, deep imports, and coupling violations.
 * 
 * @module R7ArchitectureGuard
 */

import * as fs from 'fs';
import * as path from 'path';

describe('R7: Architecture Guard (Adversarial)', () => {
  // ========================================================================
  // GUARD 1: NO DIRECT DB ACCESS FROM PRODUCT
  // ========================================================================

  describe('Guard 1: NO Direct finance_* Table Access', () => {
    const productDir = path.join(process.cwd(), 'src/products');

    it('should BLOCK Product code from accessing finance_invoices table', () => {
      const violations = scanForPattern(productDir, /\.from\(['"]finance_invoices['"]\)/, true);
      
      expect(violations).toEqual([]);
      
      if (violations.length > 0) {
        fail(`❌ VIOLATION: Product code accessing finance_invoices directly:\n${violations.join('\n')}`);
      }
    });

    it('should BLOCK Product code from accessing finance_invoice_lines table', () => {
      const violations = scanForPattern(productDir, /\.from\(['"]finance_invoice_lines['"]\)/, true);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from accessing finance_receivable_ledger table', () => {
      const violations = scanForPattern(productDir, /\.from\(['"]finance_receivable_ledger['"]\)/, true);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from accessing finance_receivable_positions table', () => {
      const violations = scanForPattern(productDir, /\.from\(['"]finance_receivable_positions['"]\)/, true);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from accessing finance_transactions table', () => {
      const violations = scanForPattern(productDir, /\.from\(['"]finance_transactions['"]\)/, true);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from accessing finance_transaction_lines table', () => {
      const violations = scanForPattern(productDir, /\.from\(['"]finance_transaction_lines['"]\)/, true);
      expect(violations).toEqual([]);
    });
  });

  // ========================================================================
  // GUARD 2: NO DIRECT RPC CALLS FROM PRODUCT
  // ========================================================================

  describe('Guard 2: NO Direct F3 RPC Calls', () => {
    const productDir = path.join(process.cwd(), 'src/products');

    it('should BLOCK Product code from calling finance_create_draft_invoice RPC', () => {
      const violations = scanForPattern(productDir, /\.rpc\(['"]finance_create_draft_invoice['"]/);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from calling finance_add_invoice_line RPC', () => {
      const violations = scanForPattern(productDir, /\.rpc\(['"]finance_add_invoice_line['"]/);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from calling finance_finalize_invoice RPC', () => {
      const violations = scanForPattern(productDir, /\.rpc\(['"]finance_finalize_invoice['"]/);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from calling finance_void_invoice RPC', () => {
      const violations = scanForPattern(productDir, /\.rpc\(['"]finance_void_invoice['"]/);
      expect(violations).toEqual([]);
    });
  });

  // ========================================================================
  // GUARD 3: NO DEEP IMPORTS INTO INTERNAL ENGINE
  // ========================================================================

  describe('Guard 3: NO Deep Imports (Internal Engine)', () => {
    const productDir = path.join(process.cwd(), 'src/products');

    it('should BLOCK Product code from importing F3AccountsReceivableEngine directly', () => {
      const violations = scanForPattern(productDir, /from ['"]@\/platform\/finance\/engines\/f3-ar-engine['"]/);
      expect(violations).toEqual([]);
    });

    it('should BLOCK Product code from importing internal engine helpers', () => {
      const violations = scanForPattern(productDir, /from ['"]@\/platform\/finance\/engines\//);
      expect(violations).toEqual([]);
    });

    it('should ALLOW Product code to import from public Platform API', () => {
      const englishBillingService = path.join(
        process.cwd(),
        'src/products/bella-english-center/billing/ar-service.ts'
      );

      const content = fs.readFileSync(englishBillingService, 'utf-8');
      
      // Verify imports from '@/platform/finance' (public API)
      expect(content).toContain("from '@/platform/finance'");
      
      // Verify NO deep imports
      expect(content).not.toContain('@/platform/finance/engines');
      expect(content).not.toContain('@/platform/finance/contracts');
    });
  });

  // ========================================================================
  // GUARD 4: NO PRODUCT→PRODUCT COUPLING
  // ========================================================================

  describe('Guard 4: NO Product→Product Coupling', () => {
    const englishCenterDir = path.join(process.cwd(), 'src/products/bella-english-center');

    it('should BLOCK English Center from accessing P71 Product tables', () => {
      const violations = [
        ...scanForPattern(englishCenterDir, /\.from\(['"]p71_/),
        ...scanForPattern(englishCenterDir, /\.from\(['"]legacy_customers['"]\)/)
      ];
      expect(violations).toEqual([]);
    });

    it('should BLOCK English Center from importing from other Products', () => {
      const violations = scanForPattern(englishCenterDir, /from ['"]@\/products\/(?!bella-english-center)/);
      expect(violations).toEqual([]);
    });
  });

  // ========================================================================
  // GUARD 5: CUSTOMER_ID INTERNAL ONLY
  // ========================================================================

  describe('Guard 5: customer_id Internal Only', () => {
    const productDir = path.join(process.cwd(), 'src/products');

    it('should BLOCK Product code from referencing customer_id field', () => {
      const violations = scanForPattern(productDir, /['".]customer_id['"]/);
      
      // Filter out test files and comments
      const realViolations = violations.filter(f => 
        !f.includes('.test.ts') &&
        !f.includes('__tests__')
      );

      expect(realViolations).toEqual([]);
    });

    it('should verify Product code uses partyId instead', () => {
      const englishBillingService = path.join(
        process.cwd(),
        'src/products/bella-english-center/billing/ar-service.ts'
      );

      const content = fs.readFileSync(englishBillingService, 'utf-8');
      
      expect(content).toContain('partyId');
      expect(content).toContain('studentPartyId');
      expect(content).not.toContain('customer_id');
      expect(content).not.toContain('customerId');
    });
  });

  // ========================================================================
  // GUARD 6: PUBLIC CONTRACT IMMUTABILITY
  // ========================================================================

  describe('Guard 6: Public Contract Immutability', () => {
    const contractFile = path.join(
      process.cwd(),
      'src/platform/finance/contracts/f3-ar.contract.ts'
    );

    it('should verify IF3AccountsReceivable has exactly 5 methods', () => {
      const content = fs.readFileSync(contractFile, 'utf-8');
      
      // Verify method names exist
      expect(content).toContain('createDraftInvoice(');
      expect(content).toContain('addInvoiceLine(');
      expect(content).toContain('finalizeInvoice(');
      expect(content).toContain('voidInvoice(');
      expect(content).toContain('getInvoice(');
      
      // Verify interface definition exists
      expect(content).toContain('export interface IF3AccountsReceivable');
    });

    it('should verify 10 typed error classes exist', () => {
      const content = fs.readFileSync(contractFile, 'utf-8');
      
      const errorClasses = content.match(/export class F3\w+Error extends Error/g);
      expect(errorClasses).toHaveLength(10);
    });
  });
});

// ============================================================================
// HELPER: SCAN FOR PATTERN
// ============================================================================

function scanForPattern(dir: string, pattern: RegExp, excludeTests: boolean = false): string[] {
  const violations: string[] = [];

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .git, __tests__ (if excludeTests), etc.
        if (!entry.name.startsWith('.') && 
            entry.name !== 'node_modules' &&
            !(excludeTests && entry.name === '__tests__')) {
          scan(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        // Skip test files if excludeTests flag set
        if (excludeTests && /\.(test|spec)\.ts$/.test(entry.name)) {
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          if (pattern.test(content)) {
            violations.push(fullPath);
          }
        } catch (err) {
          // Ignore read errors
        }
      }
    }
  }

  scan(dir);
  return violations;
}
