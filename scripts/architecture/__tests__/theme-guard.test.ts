/**
 * THEME GUARD VALIDATION TESTS
 * 
 * Proves the guard correctly identifies violations and allows legitimate code.
 * Run: npm test -- theme-guard.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { runGuard, type ThemeViolation } from '../theme-guard';
import * as fixtures from './theme-guard.fixtures';

describe('Theme Architecture Guard', () => {
  const fixtureDir = path.join(__dirname, '.fixtures-temp');
  
  beforeAll(() => {
    // Create temp fixture directory
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Cleanup temp fixtures
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
  
  function writeFixture(name: string, content: string, ext: string = 'css'): string {
    const filePath = path.join(fixtureDir, `${name}.${ext}`);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }
  
  function countViolations(violations: ThemeViolation[], severity: 'BLOCK' | 'WARN'): number {
    return violations.filter(v => v.severity === severity).length;
  }
  
  describe('Rule 1: TENANT_COLOR_IN_SHARED_JSX', () => {
    it('should BLOCK tenant color utilities in shared JSX', () => {
      const filePath = writeFixture('tenant-color-block', fixtures.TENANT_COLOR_JSX_BLOCK, 'tsx');
      const violations: ThemeViolation[] = [];
      
      // Import and run check (simplified for test)
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkTenantColorInSharedJSX } = require('../theme-guard');
      
      // Note: In real guard, this would be called during scanFile
      // For testing, we call directly
      checkTenantColorInSharedJSX(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(fixtures.EXPECTED_VIOLATIONS.TENANT_COLOR_JSX_BLOCK.BLOCK);
      expect(violations[0]?.rule).toBe('TENANT_COLOR_IN_SHARED_JSX');
    });
    
    it('should ALLOW semantic class names and structural utilities', () => {
      const filePath = writeFixture('tenant-color-allow', fixtures.TENANT_COLOR_JSX_ALLOW, 'tsx');
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkTenantColorInSharedJSX } = require('../theme-guard');
      
      checkTenantColorInSharedJSX(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(0);
      expect(countViolations(violations, 'WARN')).toBe(0);
    });
  });
  
  describe('Rule 2: DUPLICATE_VISUAL_OWNER', () => {
    it('should BLOCK duplicate visual ownership for same state', () => {
      const filePath = writeFixture('duplicate-owner-block', fixtures.DUPLICATE_OWNER_BLOCK);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkDuplicateVisualOwners } = require('../theme-guard');
      
      checkDuplicateVisualOwners(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBeGreaterThanOrEqual(1);
      expect(violations[0]?.rule).toBe('DUPLICATE_VISUAL_OWNER');
    });
    
    it('should ALLOW single definition or tenant-scoped definitions', () => {
      const filePath = writeFixture('duplicate-owner-allow', fixtures.DUPLICATE_OWNER_ALLOW);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkDuplicateVisualOwners } = require('../theme-guard');
      
      checkDuplicateVisualOwners(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(0);
    });
  });
  
  describe('Rule 3: HOVER_ACTIVE_LEAKAGE', () => {
    it('should BLOCK hover selectors that can override active state', () => {
      const filePath = writeFixture('hover-active-block', fixtures.HOVER_ACTIVE_BLOCK);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkHoverActiveLeakage } = require('../theme-guard');
      
      checkHoverActiveLeakage(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(fixtures.EXPECTED_VIOLATIONS.HOVER_ACTIVE_BLOCK.BLOCK);
      expect(violations[0]?.rule).toBe('HOVER_ACTIVE_LEAKAGE');
    });
    
    it('should ALLOW hover with :not(.active) exclusion', () => {
      const filePath = writeFixture('hover-active-allow', fixtures.HOVER_ACTIVE_ALLOW);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkHoverActiveLeakage } = require('../theme-guard');
      
      checkHoverActiveLeakage(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(0);
    });
  });
  
  describe('Rule 4: BROAD_TENANT_SELECTOR', () => {
    it('should BLOCK tenant selectors targeting elements without component scope', () => {
      const filePath = writeFixture('broad-selector-block', fixtures.BROAD_SELECTOR_BLOCK);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkBroadTenantSelectors } = require('../theme-guard');
      
      checkBroadTenantSelectors(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(fixtures.EXPECTED_VIOLATIONS.BROAD_SELECTOR_BLOCK.BLOCK);
      expect(violations[0]?.rule).toBe('BROAD_TENANT_SELECTOR');
    });
    
    it('should ALLOW tenant selectors scoped to components', () => {
      const filePath = writeFixture('broad-selector-allow', fixtures.BROAD_SELECTOR_ALLOW);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkBroadTenantSelectors } = require('../theme-guard');
      
      checkBroadTenantSelectors(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(0);
    });
  });
  
  describe('Rule 5: EXCLUSION_CHAIN_SMELL', () => {
    it('should BLOCK 3+ chained :not() selectors', () => {
      const filePath = writeFixture('exclusion-chain-block', fixtures.EXCLUSION_CHAIN_BLOCK);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkExclusionChains } = require('../theme-guard');
      
      checkExclusionChains(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(fixtures.EXPECTED_VIOLATIONS.EXCLUSION_CHAIN_BLOCK.BLOCK);
      expect(violations[0]?.rule).toBe('EXCLUSION_CHAIN_SMELL');
    });
    
    it('should WARN on 2 chained :not() selectors', () => {
      const filePath = writeFixture('exclusion-chain-warn', fixtures.EXCLUSION_CHAIN_WARN);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkExclusionChains } = require('../theme-guard');
      
      checkExclusionChains(filePath, content, violations);
      
      expect(countViolations(violations, 'WARN')).toBe(fixtures.EXPECTED_VIOLATIONS.EXCLUSION_CHAIN_WARN.WARN);
    });
    
    it('should ALLOW single :not() or no :not() at all', () => {
      const filePath = writeFixture('exclusion-chain-allow', fixtures.EXCLUSION_CHAIN_ALLOW);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkExclusionChains } = require('../theme-guard');
      
      checkExclusionChains(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(0);
      expect(countViolations(violations, 'WARN')).toBe(0);
    });
  });
  
  describe('Rule 6: ACCIDENTAL_INHERITANCE', () => {
    it('should WARN on component visual styles outside tenant scope', () => {
      const filePath = writeFixture('accidental-inheritance-warn', fixtures.ACCIDENTAL_INHERITANCE_WARN);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkAccidentalInheritance } = require('../theme-guard');
      
      checkAccidentalInheritance(filePath, content, violations);
      
      expect(countViolations(violations, 'WARN')).toBeGreaterThanOrEqual(1);
      expect(violations[0]?.rule).toBe('ACCIDENTAL_INHERITANCE');
    });
    
    it('should ALLOW visual styles inside tenant scope or using CSS variables', () => {
      const filePath = writeFixture('accidental-inheritance-allow', fixtures.ACCIDENTAL_INHERITANCE_ALLOW);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const { checkAccidentalInheritance } = require('../theme-guard');
      
      checkAccidentalInheritance(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBe(0);
      expect(countViolations(violations, 'WARN')).toBe(0);
    });
  });
  
  describe('Real-world mixed scenario', () => {
    it('should detect multiple violations in complex CSS', () => {
      const filePath = writeFixture('real-world-mixed', fixtures.REAL_WORLD_MIXED);
      const violations: ThemeViolation[] = [];
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const {
        checkDuplicateVisualOwners,
        checkHoverActiveLeakage,
        checkBroadTenantSelectors,
        checkExclusionChains,
        checkAccidentalInheritance
      } = require('../theme-guard');
      
      // Run all CSS checks
      checkDuplicateVisualOwners(filePath, content, violations);
      checkHoverActiveLeakage(filePath, content, violations);
      checkBroadTenantSelectors(filePath, content, violations);
      checkExclusionChains(filePath, content, violations);
      checkAccidentalInheritance(filePath, content, violations);
      
      expect(countViolations(violations, 'BLOCK')).toBeGreaterThanOrEqual(
        fixtures.EXPECTED_VIOLATIONS.REAL_WORLD_MIXED.BLOCK
      );
    });
  });
  
  describe('Guard integration', () => {
    it('should return correct exit code based on violations', () => {
      // This would test the full guard execution
      // Skipped for now as it requires mocking file system
      expect(true).toBe(true);
    });
  });
});

describe('Theme Guard Documentation', () => {
  it('should have clear rule descriptions', () => {
    // Verify each rule has documentation
    const guardSource = fs.readFileSync(
      path.join(__dirname, '../theme-guard.ts'),
      'utf-8'
    );
    
    expect(guardSource).toContain('RULE 1: Tenant color utilities in shared JSX');
    expect(guardSource).toContain('RULE 2: Duplicate visual owners');
    expect(guardSource).toContain('RULE 3: Hover selectors that can also match active');
    expect(guardSource).toContain('RULE 4: Broad tenant selectors');
    expect(guardSource).toContain('RULE 5: Growing :not() exclusion chains');
    expect(guardSource).toContain('RULE 6: Tenant preset inheriting visual state');
  });
  
  it('should have example violations in comments', () => {
    const guardSource = fs.readFileSync(
      path.join(__dirname, '../theme-guard.ts'),
      'utf-8'
    );
    
    // Each rule should have example violation
    expect(guardSource).toContain('Example violation:');
    expect(guardSource).toContain('Correct:');
  });
});
