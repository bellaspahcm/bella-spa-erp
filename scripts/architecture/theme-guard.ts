#!/usr/bin/env node
/**
 * BELLA THEME ARCHITECTURE GUARD
 * 
 * Prevents CSS leakage between tenant themes through automated enforcement.
 * Detects anti-patterns that cause visual regressions across tenant presets.
 * 
 * Usage:
 *   npm run theme:guard
 *   npm run theme:guard -- --verbose
 *   npm run theme:guard -- --fix-report
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = BLOCK-level violation detected (must fix before commit)
 *   2 = WARN-level issues detected (review recommended)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

type ViolationSeverity = 'BLOCK' | 'WARN';

interface ThemeViolation {
  file: string;
  line: number;
  rule: string;
  severity: ViolationSeverity;
  message: string;
  snippet: string;
  suggestion?: string;
}

interface GuardResult {
  passed: boolean;
  violations: ThemeViolation[];
  blockCount: number;
  warnCount: number;
  filesScanned: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const SHARED_COMPONENT_PATHS = [
  'src/components/ui/**/*.tsx',
  'src/components/shared/**/*.tsx',
  'src/components/layout/**/*.tsx',
  'src/app/components/**/*.tsx',
];

const THEME_CSS_PATHS = [
  'src/app/globals.css',
  'src/styles/**/*.css',
];

// Tenant-specific color utilities that should NOT appear in shared components
const TENANT_COLOR_PATTERNS = [
  /className={[^}]*\b(?:bg|text|border)-(?:emerald|rose|pink|blue|indigo|navy|amber|sky)-\d+/,
  /className="[^"]*\b(?:bg|text|border)-(?:emerald|rose|pink|blue|indigo|navy|amber|sky)-\d+/,
  /className='[^']*\b(?:bg|text|border)-(?:emerald|rose|pink|blue|indigo|navy|amber|sky)-\d+/,
];

// Allowed structural/geometry classes (not visual colors)
const ALLOWED_UTILITY_PATTERNS = [
  /\b(?:p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr)-\d+/,  // spacing
  /\b(?:w|h|min-w|min-h|max-w|max-h)-\d+/,              // dimensions
  /\b(?:rounded|border)-\d+/,                            // geometry only (not border-color)
  /\b(?:flex|grid|gap|space)-/,                          // layout
  /\b(?:text|font)-(?:xs|sm|base|lg|xl|2xl|3xl)/,       // typography size
  /\bopacity-\d+/,                                       // opacity
  /\bz-\d+/,                                             // z-index
];

// ============================================================================
// GUARD RULES
// ============================================================================

/**
 * RULE 1: Tenant color utilities in shared JSX components
 * SEVERITY: BLOCK
 */
export function checkTenantColorInSharedJSX(
  filePath: string,
  content: string,
  violations: ThemeViolation[]
): void {
  // Skip tenant-specific product folders
  if (
    filePath.includes('/products/') ||
    filePath.includes('/tenants/') ||
    filePath.includes('tenant-specific')
  ) {
    return;
  }

  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of TENANT_COLOR_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // Check if it's a legitimate structural class
        const isStructural = ALLOWED_UTILITY_PATTERNS.some(allowed => 
          allowed.test(match[0])
        );
        
        if (!isStructural) {
          violations.push({
            file: filePath,
            line: i + 1,
            rule: 'TENANT_COLOR_IN_SHARED_JSX',
            severity: 'BLOCK',
            message: 'Shared component contains tenant-specific color utility',
            snippet: line.trim().substring(0, 120),
            suggestion: 'Use semantic CSS class (e.g., "sidebar-item-active") instead of tenant color'
          });
        }
      }
    }
  }
}

/**
 * RULE 2: Duplicate visual owners for same component state
 * SEVERITY: BLOCK
 * 
 * Example violation:
 *   .sidebar-item.active { background: #emerald; }
 *   .sidebar-item-active { background: #blue; }  // CONFLICT
 */
export function checkDuplicateVisualOwners(
  filePath: string,
  content: string,
  violations: ThemeViolation[]
): void {
  const lines = content.split('\n');
  const stateOwners = new Map<string, { line: number; selector: string; property: string }[]>();
  
  // Parse CSS and track visual property ownership
  let currentSelector = '';
  let bracketDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Track selector
    if (line.includes('{') && !line.startsWith('/*') && !line.startsWith('//')) {
      const selectorMatch = line.match(/^([^{]+)\s*{/);
      if (selectorMatch) {
        currentSelector = selectorMatch[1].trim();
        bracketDepth++;
      }
    }
    
    if (line.includes('}')) {
      bracketDepth--;
      if (bracketDepth === 0) {
        currentSelector = '';
      }
    }
    
    // Track visual properties (background, color, border-color)
    if (currentSelector && bracketDepth > 0) {
      const visualPropertyMatch = line.match(/^\s*(background|color|border-color|background-color)\s*:/);
      if (visualPropertyMatch) {
        const property = visualPropertyMatch[1];
        
        // Extract component + state from selector
        // e.g., ".sidebar-item.active" or ".sidebar-item-active"
        const componentStateKey = extractComponentState(currentSelector);
        
        if (componentStateKey) {
          if (!stateOwners.has(componentStateKey)) {
            stateOwners.set(componentStateKey, []);
          }
          
          stateOwners.get(componentStateKey)!.push({
            line: i + 1,
            selector: currentSelector,
            property
          });
        }
      }
    }
  }
  
  // Detect duplicates
  for (const [key, owners] of stateOwners.entries()) {
    if (owners.length > 1) {
      // Check if they're from different tenant scopes (allowed)
      const hasDifferentTenantScopes = owners.every(owner => 
        owner.selector.includes('[data-tenant-brand-preset')
      );
      
      if (!hasDifferentTenantScopes) {
        violations.push({
          file: filePath,
          line: owners[0].line,
          rule: 'DUPLICATE_VISUAL_OWNER',
          severity: 'BLOCK',
          message: `Duplicate visual ownership for "${key}": found ${owners.length} conflicting definitions`,
          snippet: owners.map(o => `Line ${o.line}: ${o.selector}`).join('; '),
          suggestion: 'Consolidate into single definition or ensure each is tenant-scoped'
        });
      }
    }
  }
}

/**
 * Extract component + state identifier from CSS selector
 * e.g., ".sidebar-item.active" → "sidebar-item:active"
 *       ".sidebar-item-active" → "sidebar-item:active"
 */
function extractComponentState(selector: string): string | null {
  // Remove tenant scope prefix
  const withoutTenantScope = selector.replace(/html\[data-tenant-[^\]]+\]\s*/g, '');
  
  // Extract base component and state
  const match = withoutTenantScope.match(/\.([\w-]+?)(?:\.(\w+)|-(active|hover|focus|disabled))/);
  if (match) {
    const component = match[1];
    const state = match[2] || match[3] || 'default';
    return `${component}:${state}`;
  }
  
  return null;
}

/**
 * RULE 3: Hover selectors that can also match active items
 * SEVERITY: BLOCK
 * 
 * Example violation:
 *   .sidebar-item:hover { background: #blue; }  // Will override active state!
 * 
 * Correct:
 *   .sidebar-item:not(.active):hover { background: #blue; }
 *   .sidebar-item-active:hover { ... }  // OK - this IS the active item
 */
export function checkHoverActiveLeakage(
  filePath: string,
  content: string,
  violations: ThemeViolation[]
): void {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect hover without active exclusion
    const hoverMatch = line.match(/^([^{]+):hover\s*{/);
    if (hoverMatch) {
      const selector = hoverMatch[1].trim();
      
      // Skip if this IS an active item (legitimate active hover state)
      // Note: selector already has :hover stripped by regex capture group
      const isActiveItemHover = 
        /-active$/.test(selector) ||
        /\.active$/.test(selector) ||
        /\[aria-selected="true"\]$/.test(selector) ||
        /\[data-active="true"\]$/.test(selector);      
      if (isActiveItemHover) {
        continue; // This is OK - hovering the active item itself
      }
      
      // Check if it excludes active state (flexible matching)
      const hasActiveExclusion = 
        /not\([^)]*active[^)]*\)/.test(selector) || // :not(...active...)
        /not\([^)]*aria-selected="true"[^)]*\)/.test(selector) ||
        /not\([^)]*data-active="true"[^)]*\)/.test(selector);      
      // Check if this is a component that has active states
      const hasActiveState = 
        selector.includes('sidebar-item') ||
        selector.includes('nav-item') ||
        selector.includes('tab-') ||
        selector.includes('menu-item') ||
        selector.includes('calendar-day') ||
        selector.includes('ribbon-day');
      
      if (hasActiveState && !hasActiveExclusion) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: 'HOVER_ACTIVE_LEAKAGE',
          severity: 'BLOCK',
          message: 'Hover selector can override active state',
          snippet: line.substring(0, 120),
          suggestion: 'Add :not(.active) or :not(.component-active) to hover selector'
        });
      }
    }
  }
}

/**
 * RULE 4: Broad tenant selectors without component scope
 * SEVERITY: BLOCK
 * 
 * Example violation:
 *   html[data-tenant="jade"] span { color: #green; }  // Affects ALL spans!
 * 
 * Correct:
 *   html[data-tenant="jade"] .sidebar-item span { color: #green; }
 */
export function checkBroadTenantSelectors(
  filePath: string,
  content: string,
  violations: ThemeViolation[]
): void {
  const lines = content.split('\n');
  const broadElements = ['span', 'svg', 'button', 'input', 'div', 'p', 'a'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Match tenant selector followed by broad element without component scope
    for (const element of broadElements) {
      const pattern = new RegExp(
        `html\\[data-tenant-(?:module|brand-preset)="[^"]+"]\\s+${element}(?:\\s|:|\\[|{)`,
        'i'
      );
      
      if (pattern.test(line)) {
        // Check if there's a component class between tenant and element
        const hasComponentScope = /html\[data-tenant[^\]]+\]\s+\.[a-z-]+.*?\s+(?:span|svg|button|input|div|p|a)/i.test(line);
        
        if (!hasComponentScope) {
          violations.push({
            file: filePath,
            line: i + 1,
            rule: 'BROAD_TENANT_SELECTOR',
            severity: 'BLOCK',
            message: `Tenant selector targets <${element}> without component scope`,
            snippet: line.substring(0, 120),
            suggestion: `Add component class: html[data-tenant="..."] .component-name ${element}`
          });
        }
      }
    }
  }
}

/**
 * RULE 5: Growing :not() exclusion chains
 * SEVERITY: WARN (becomes BLOCK at 3+)
 * 
 * Example:
 *   .sidebar:not([data-tenant="A"]):not([data-tenant="B"]):not([data-tenant="C"])
 * 
 * This pattern indicates tenants are inheriting each other's styles.
 */
export function checkExclusionChains(
  filePath: string,
  content: string,
  violations: ThemeViolation[]
): void {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Count :not() occurrences
    const notMatches = line.match(/:not\([^)]+\)/g);
    if (notMatches && notMatches.length >= 2) {
      const severity: ViolationSeverity = notMatches.length >= 3 ? 'BLOCK' : 'WARN';
      
      violations.push({
        file: filePath,
        line: i + 1,
        rule: 'EXCLUSION_CHAIN_SMELL',
        severity,
        message: `Found ${notMatches.length} chained :not() selectors - indicates tenant inheritance issue`,
        snippet: line.trim().substring(0, 120),
        suggestion: 'Each tenant should define complete theme; avoid inheritance via :not() chains'
      });
    }
  }
}

/**
 * RULE 6: Tenant preset inheriting visual state from another tenant
 * SEVERITY: WARN
 * 
 * This is harder to detect statically, but we can warn when default styles
 * exist outside any tenant scope.
 */
export function checkAccidentalInheritance(
  filePath: string,
  content: string,
  violations: ThemeViolation[]
): void {
  const lines = content.split('\n');
  
  // Look for visual properties on component classes without tenant scope
  let inTenantScope = false;
  let bracketDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Track tenant scope
    if (line.includes('html[data-tenant')) {
      inTenantScope = true;
    }
    
    if (line.includes('{')) bracketDepth++;
    if (line.includes('}')) {
      bracketDepth--;
      if (bracketDepth === 0) {
        inTenantScope = false;
      }
    }
    
    // Check for component visual styles outside tenant scope
    if (!inTenantScope && bracketDepth > 0) {
      const hasComponentClass = line.match(/^\s*\.(beauty-erp-|sidebar|nav-item)/);
      const hasVisualProperty = line.match(/^\s*(background|color|border-color)\s*:/);
      
      if (hasComponentClass && hasVisualProperty) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: 'ACCIDENTAL_INHERITANCE',
          severity: 'WARN',
          message: 'Component visual style defined outside tenant scope - may cause inheritance issues',
          snippet: line.substring(0, 120),
          suggestion: 'Move visual styles inside [data-tenant-brand-preset] scope or use CSS variables'
        });
      }
    }
  }
}

// ============================================================================
// FILE SCANNING
// ============================================================================

function expandGlob(pattern: string): string[] {
  const files: string[] = [];
  
  // Check if pattern is a direct file path (not a glob)
  if (!pattern.includes('*')) {
    const fullPath = path.join(WORKSPACE_ROOT, pattern);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      files.push(pattern);
    }
    return files;
  }
  
  // Handle glob patterns
  const baseDir = path.join(WORKSPACE_ROOT, pattern.split('**')[0]);
  
  function walkDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    // Ensure it's a directory before scanning
    if (!fs.statSync(dir).isDirectory()) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(WORKSPACE_ROOT, fullPath);
        
        // Match pattern
        if (pattern.includes('**/*.tsx') && relativePath.endsWith('.tsx')) {
          files.push(relativePath);
        } else if (pattern.includes('**/*.css') && relativePath.endsWith('.css')) {
          files.push(relativePath);
        }
      }
    }
  }
  
  walkDir(baseDir);
  return files;
}

function scanFile(filePath: string, violations: ThemeViolation[]): void {
  const absolutePath = path.join(WORKSPACE_ROOT, filePath);
  if (!fs.existsSync(absolutePath)) return;
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const ext = path.extname(filePath);
  
  if (ext === '.tsx' || ext === '.jsx') {
    // JSX component checks
    checkTenantColorInSharedJSX(filePath, content, violations);
  } else if (ext === '.css') {
    // CSS checks
    checkDuplicateVisualOwners(filePath, content, violations);
    checkHoverActiveLeakage(filePath, content, violations);
    checkBroadTenantSelectors(filePath, content, violations);
    checkExclusionChains(filePath, content, violations);
    checkAccidentalInheritance(filePath, content, violations);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function runGuard(verbose: boolean = false): GuardResult {
  console.log('\n🛡️  BELLA THEME ARCHITECTURE GUARD');
  console.log('=====================================\n');
  
  const violations: ThemeViolation[] = [];
  let filesScanned = 0;
  
  // Scan CSS files
  console.log('📁 Scanning CSS theme files...');
  for (const pattern of THEME_CSS_PATHS) {
    const files = expandGlob(pattern);
    for (const file of files) {
      if (verbose) {
        console.log(`   Checking: ${file}`);
      }
      scanFile(file, violations);
      filesScanned++;
    }
  }
  
  // Scan shared components
  console.log('📁 Scanning shared component files...');
  for (const pattern of SHARED_COMPONENT_PATHS) {
    const files = expandGlob(pattern);
    for (const file of files) {
      if (verbose) {
        console.log(`   Checking: ${file}`);
      }
      scanFile(file, violations);
      filesScanned++;
    }
  }
  
  const blockCount = violations.filter(v => v.severity === 'BLOCK').length;
  const warnCount = violations.filter(v => v.severity === 'WARN').length;
  
  console.log(`\n✅ Scanned ${filesScanned} files\n`);
  
  return {
    passed: blockCount === 0,
    violations,
    blockCount,
    warnCount,
    filesScanned
  };
}

function printReport(result: GuardResult): void {
  if (result.violations.length === 0) {
    console.log('✅ No theme architecture violations detected!\n');
    return;
  }
  
  console.log('❌ THEME ARCHITECTURE VIOLATIONS DETECTED\n');
  console.log('==========================================\n');
  
  // Group by severity
  const blockViolations = result.violations.filter(v => v.severity === 'BLOCK');
  const warnViolations = result.violations.filter(v => v.severity === 'WARN');
  
  if (blockViolations.length > 0) {
    console.log(`🔴 BLOCK (${blockViolations.length}) - Must fix before commit:\n`);
    
    for (const violation of blockViolations) {
      console.log(`  File: ${violation.file}:${violation.line}`);
      console.log(`  Rule: ${violation.rule}`);
      console.log(`  Issue: ${violation.message}`);
      console.log(`  Code: ${violation.snippet}`);
      if (violation.suggestion) {
        console.log(`  Fix: ${violation.suggestion}`);
      }
      console.log('');
    }
  }
  
  if (warnViolations.length > 0) {
    console.log(`⚠️  WARN (${warnViolations.length}) - Review recommended:\n`);
    
    for (const violation of warnViolations) {
      console.log(`  File: ${violation.file}:${violation.line}`);
      console.log(`  Rule: ${violation.rule}`);
      console.log(`  Issue: ${violation.message}`);
      if (violation.suggestion) {
        console.log(`  Fix: ${violation.suggestion}`);
      }
      console.log('');
    }
  }
  
  console.log('\n==========================================');
  console.log(`Total: ${result.blockCount} BLOCK, ${result.warnCount} WARN\n`);
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  
  const result = runGuard(verbose);
  printReport(result);
  
  if (!result.passed) {
    console.error('❌ Theme architecture guard FAILED - fix BLOCK violations before committing\n');
    process.exit(1);
  }
  
  if (result.warnCount > 0) {
    console.log('⚠️  Theme architecture guard PASSED with warnings - review recommended\n');
    process.exit(2);
  }
  
  console.log('✅ Theme architecture guard PASSED\n');
  process.exit(0);
}

export { runGuard, printReport, type GuardResult, type ThemeViolation };
